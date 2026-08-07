import React, { useCallback, useEffect, useState } from 'react';
import {
    FaCheckCircle,
    FaClock,
    FaDatabase,
    FaDownload,
    FaExclamationTriangle,
    FaPlus,
    FaShieldAlt,
    FaSyncAlt,
    FaTimesCircle,
} from 'react-icons/fa';

import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import styles from '../../styles/admin/DatabaseBackup.module.css';
import tblStyles from '../../styles/wideTable.module.css';

const formatBytes = (bytes) => {
    if (!bytes || bytes <= 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
    return `${(bytes / Math.pow(1024, index)).toFixed(1)} ${sizes[index]}`;
};

const formatDate = (value) => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '-';

    return parsed.toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const formatDuration = (durationMs) => {
    const duration = Number(durationMs);
    if (!Number.isFinite(duration) || duration <= 0) return '-';

    const totalSeconds = Math.round(duration / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes <= 0) return `${seconds}s`;
    return `${minutes}m ${seconds}s`;
};

const shortenChecksum = (value) => {
    const checksum = String(value || '').trim();
    if (!checksum) return '-';
    if (checksum.length <= 18) return checksum;
    return `${checksum.slice(0, 10)}...${checksum.slice(-8)}`;
};

const getTriggerLabel = (triggerType) => (
    String(triggerType || '').trim().toLowerCase() === 'scheduled'
        ? 'Automatic schedule'
        : 'Created manually'
);

const getStatusMeta = (backup) => {
    const normalized = String(backup?.status || '').trim().toLowerCase();
    if (normalized === 'running') {
        return { label: 'In progress', className: styles.statusRunning, icon: FaSyncAlt };
    }
    if (normalized === 'success') {
        return { label: 'Completed', className: styles.statusSuccess, icon: FaCheckCircle };
    }
    return { label: 'Failed', className: styles.statusFailed, icon: FaTimesCircle };
};

const getFileMeta = (backup) => {
    if (backup?.fileState === 'pruned') {
        return { label: 'Removed by file limit', className: styles.filePruned };
    }
    if (backup?.fileState === 'available') {
        return { label: 'Available for download', className: styles.fileAvailable };
    }
    if (backup?.fileState === 'missing') {
        return { label: 'File missing', className: styles.fileMissing };
    }
    return { label: 'Not applicable', className: styles.fileNeutral };
};

const getVerificationMeta = (backup) => {
    const normalized = String(backup?.verificationStatus || 'unverified').trim().toLowerCase();
    if (normalized === 'verified') {
        return { label: 'Restore verified', className: styles.verifySuccess, icon: FaCheckCircle };
    }
    if (normalized === 'failed') {
        return { label: 'Verification failed', className: styles.verifyFailed, icon: FaTimesCircle };
    }
    return { label: 'Not yet verified', className: styles.verifyNeutral, icon: FaClock };
};

const clampWholeNumber = (value, fallback, min, max) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(Math.round(parsed), min), max);
};

export default function DatabaseBackup() {
    const { addToast } = useToast();

    const [status, setStatus] = useState(null);
    const [backups, setBackups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [creating, setCreating] = useState(false);
    const [downloading, setDownloading] = useState(null);
    const [verifying, setVerifying] = useState(null);
    const [savingSettings, setSavingSettings] = useState(false);
    const [settingsForm, setSettingsForm] = useState({
        enabled: false,
        intervalHours: 24,
        retentionCount: 14,
    });

    const loadData = useCallback(async ({ silent = false } = {}) => {
        if (silent) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        try {
            const [statusRes, listRes] = await Promise.all([
                authFetch('/backup/status'),
                authFetch('/backup/list'),
            ]);

            let hadError = false;

            if (statusRes.ok) {
                setStatus(await statusRes.json());
            } else {
                hadError = true;
                addToast('Unable to load the current backup readiness status.', 'error');
            }

            if (listRes.ok) {
                setBackups(await listRes.json());
            } else {
                hadError = true;
                addToast('Unable to load the backup history.', 'error');
            }

            if (silent && !hadError) {
                addToast('Backup information refreshed successfully.', 'success');
            }
        } catch (error) {
            console.error('Error loading backup data:', error);
            addToast('Network error. Backup information could not be loaded.', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [addToast]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const schedulerEnabled = status?.scheduler?.enabled;
    const schedulerIntervalHours = status?.scheduler?.intervalHours;
    const schedulerRetentionCount = status?.scheduler?.retentionCount;

    useEffect(() => {
        if (typeof schedulerEnabled === 'undefined') return;

        setSettingsForm({
            enabled: schedulerEnabled === true,
            intervalHours: clampWholeNumber(schedulerIntervalHours, 24, 1, 168),
            retentionCount: clampWholeNumber(schedulerRetentionCount, 14, 0, 90),
        });
    }, [schedulerEnabled, schedulerIntervalHours, schedulerRetentionCount]);

    const handleCreate = async () => {
        if (creating) return;
        setCreating(true);
        addToast('Creating a database backup. Please wait while the backup file is being prepared.', 'info');

        try {
            const res = await authFetch('/backup/create', { method: 'POST' });
            const data = await res.json().catch(() => ({}));

            if (res.ok) {
                const prunedCount = Number(data?.retention?.deletedCount || 0);
                addToast(
                    prunedCount > 0
                        ? `Backup created successfully. ${prunedCount} older backup(s) were removed based on the retention limit.`
                        : 'Backup created successfully.',
                    'success'
                );
                await loadData();
                return;
            }

            if (res.status === 409) {
                addToast(data.message || 'A backup is already in progress. Please wait for it to finish.', 'warning');
                await loadData({ silent: false });
                return;
            }

            addToast(data.message || 'Backup creation failed.', 'error');
        } catch (error) {
            console.error('Backup create error:', error);
            addToast('Network error. The backup could not be created.', 'error');
        } finally {
            setCreating(false);
        }
    };

    const handleDownload = async (filename) => {
        setDownloading(filename);
        try {
            const res = await authFetch(`/backup/download/${encodeURIComponent(filename)}`);
            if (!res.ok) {
                addToast('Download failed. The backup file may no longer be available on the server.', 'error');
                return;
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Backup download error:', error);
            addToast('Download error. Please try again.', 'error');
        } finally {
            setDownloading(null);
        }
    };

    const handleVerify = async (filename) => {
        if (verifying) return;

        setVerifying(filename);
        addToast('Verifying the backup by restoring it to a temporary database.', 'info');

        try {
            const res = await authFetch(`/backup/verify/${encodeURIComponent(filename)}`, { method: 'POST' });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                addToast(data.message || 'Backup verification failed.', 'error');
                await loadData();
                return;
            }

            addToast(data.message || 'Backup verified successfully.', 'success');
            await loadData();
        } catch (error) {
            console.error('Backup verify error:', error);
            addToast('Network error. Backup verification could not be completed.', 'error');
        } finally {
            setVerifying(null);
        }
    };

    const handleSettingsChange = (key, value) => {
        setSettingsForm((current) => ({
            ...current,
            [key]: value,
        }));
    };

    const handleSaveSettings = async () => {
        if (savingSettings) return;

        const payload = {
            enabled: settingsForm.enabled === true,
            intervalHours: clampWholeNumber(settingsForm.intervalHours, 24, 1, 168),
            retentionCount: clampWholeNumber(settingsForm.retentionCount, 14, 0, 90),
        };

        setSavingSettings(true);

        try {
            const res = await authFetch('/backup/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                addToast(data.message || 'Backup settings could not be saved.', 'error');
                return;
            }

            addToast(data.message || 'Backup settings saved successfully.', 'success');
            setStatus((current) => (
                current
                    ? { ...current, scheduler: data.scheduler || current.scheduler }
                    : current
            ));
            setSettingsForm({
                enabled: payload.enabled,
                intervalHours: payload.intervalHours,
                retentionCount: payload.retentionCount,
            });
            await loadData();
        } catch (error) {
            console.error('Backup settings save error:', error);
            addToast('Network error. Backup settings could not be saved.', 'error');
        } finally {
            setSavingSettings(false);
        }
    };

    const summary = status?.summary || {};
    const scheduler = status?.scheduler || {};
    const mongodump = status?.mongodump || {};
    const mongorestore = status?.mongorestore || {};
    const activeBackup = status?.activeBackup || null;
    const schedulerDirty = (
        settingsForm.enabled !== (scheduler.enabled === true)
        || clampWholeNumber(settingsForm.intervalHours, 24, 1, 168) !== clampWholeNumber(scheduler.intervalHours, 24, 1, 168)
        || clampWholeNumber(settingsForm.retentionCount, 14, 0, 90) !== clampWholeNumber(scheduler.retentionCount, 14, 0, 90)
    );

    const createDisabled = creating || loading || Boolean(activeBackup) || mongodump.available === false;

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                    <div>
                        <h1 className={styles.pageTitle}>Database Backup</h1>
                        <p className={styles.pageSubtitle}>
                            Create database backup files, verify that they can be restored, and manage the automatic backup schedule from one admin page.
                        </p>
                    </div>
                </div>

                <div className={styles.headerActions}>
                    <button
                        className={styles.secondaryBtn}
                        onClick={() => loadData({ silent: true })}
                        disabled={loading || refreshing || creating}
                    >
                        <FaSyncAlt className={refreshing ? styles.spinning : ''} />
                        Refresh
                    </button>

                    <button
                        className={styles.createBtn}
                        onClick={handleCreate}
                        disabled={createDisabled}
                    >
                        {creating
                            ? <><FaSyncAlt className={styles.spinning} /> Creating...</>
                            : activeBackup
                                ? <><FaClock /> Backup in Progress...</>
                                : <><FaPlus /> Create Backup Now</>
                        }
                    </button>
                </div>
            </div>

            <div className={styles.bannerGrid}>
                <div className={`${styles.bannerCard} ${mongodump.available ? styles.bannerReady : styles.bannerWarning}`}>
                    <div className={styles.bannerIcon}>
                        {mongodump.available ? <FaCheckCircle /> : <FaExclamationTriangle />}
                    </div>
                    <div>
                        <h2 className={styles.bannerTitle}>
                            {mongodump.available ? 'Backup tool ready' : 'Backup tool unavailable'}
                        </h2>
                        <p className={styles.bannerCopy}>
                            {mongodump.available
                                ? `The server can create compressed database backup files. ${mongodump.version || status?.binary || ''}`
                                : (mongodump.error || 'The server could not run the database backup tool.')}
                        </p>
                    </div>
                </div>

                <div className={styles.bannerCard}>
                    <div className={styles.bannerIcon}>
                        <FaShieldAlt />
                    </div>
                    <div>
                        <h2 className={styles.bannerTitle}>Stored on this server</h2>
                        <p className={styles.bannerCopy}>
                            Backup files are saved in <code>{status?.backupDir || 'backend/backups'}</code>. Download important copies and keep them outside the server for additional protection.
                        </p>
                    </div>
                </div>

                <div className={`${styles.bannerCard} ${mongorestore.available ? styles.bannerReady : styles.bannerWarning}`}>
                    <div className={styles.bannerIcon}>
                        {mongorestore.available ? <FaCheckCircle /> : <FaExclamationTriangle />}
                    </div>
                    <div>
                        <h2 className={styles.bannerTitle}>
                            {mongorestore.available ? 'Restore verification ready' : 'Restore verification unavailable'}
                        </h2>
                        <p className={styles.bannerCopy}>
                            {mongorestore.available
                                ? `The server can test a backup by restoring it into a temporary database. ${mongorestore.version || ''}`
                                : (mongorestore.error || 'The server could not run the restore verification tool.')}
                        </p>
                    </div>
                </div>
            </div>

            {activeBackup && (
                <div className={styles.jobBanner}>
                    <FaSyncAlt className={styles.spinning} />
                    <div>
                        <strong>{activeBackup.filename}</strong> is currently being created.
                        Started {formatDate(activeBackup.startedAt)} by {activeBackup.createdByName || getTriggerLabel(activeBackup.triggerType)}.
                    </div>
                </div>
            )}

            <div className={styles.statsRow}>
                <div className={styles.statCard}>
                    <span className={styles.statValue}>{summary.totalRuns ?? backups.length}</span>
                    <span className={styles.statLabel}>Backup Attempts</span>
                </div>
                <div className={styles.statCard}>
                    <span className={`${styles.statValue} ${styles.statGreen}`}>{summary.successfulRuns ?? backups.filter((backup) => backup.status === 'success').length}</span>
                    <span className={styles.statLabel}>Completed</span>
                </div>
                <div className={styles.statCard}>
                    <span className={`${styles.statValue} ${styles.statRed}`}>{summary.failedRuns ?? backups.filter((backup) => backup.status === 'failed').length}</span>
                    <span className={styles.statLabel}>Failed</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statValue}>{scheduler.enabled ? `${scheduler.intervalHours || 24}h` : 'Off'}</span>
                    <span className={styles.statLabel}>Automatic Schedule</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statValue}>{scheduler.retentionCount > 0 ? scheduler.retentionCount : 'Off'}</span>
                    <span className={styles.statLabel}>Files Kept</span>
                </div>
            </div>

            <div className={styles.detailsGrid}>
                <div className={styles.detailCard}>
                    <div className={styles.detailHeader}>
                        <FaClock />
                        <h2>Automatic Schedule</h2>
                    </div>
                    <div className={styles.detailList}>
                        <div className={styles.detailRow}>
                            <span>Status</span>
                            <strong>{scheduler.enabled ? 'Enabled' : 'Disabled'}</strong>
                        </div>
                        <div className={styles.detailRow}>
                            <span>Backup frequency</span>
                            <strong>{scheduler.enabled ? `Every ${scheduler.intervalHours || 24} hour(s)` : 'Manual backup only'}</strong>
                        </div>
                        <div className={styles.detailRow}>
                            <span>Next automatic backup</span>
                            <strong>{scheduler.enabled ? formatDate(scheduler.nextAutomaticBackupAt) : '-'}</strong>
                        </div>
                        <div className={styles.detailRow}>
                            <span>Settings last updated</span>
                            <strong>{scheduler.updatedAt ? formatDate(scheduler.updatedAt) : 'System defaults'}</strong>
                        </div>
                    </div>
                </div>

                <div className={styles.detailCard}>
                    <div className={styles.detailHeader}>
                        <FaDatabase />
                        <h2>File Retention</h2>
                    </div>
                    <div className={styles.detailList}>
                        <div className={styles.detailRow}>
                            <span>Backup files to keep</span>
                            <strong>{scheduler.retentionCount > 0 ? `${scheduler.retentionCount} completed backups` : 'No limit set'}</strong>
                        </div>
                        <div className={styles.detailRow}>
                            <span>When the limit is exceeded</span>
                            <strong>{scheduler.retentionCount > 0 ? 'Oldest backup files are removed automatically' : 'Old files are not removed automatically'}</strong>
                        </div>
                        <div className={styles.detailRow}>
                            <span>Storage location</span>
                            <strong>Server storage</strong>
                        </div>
                    </div>
                </div>

                <div className={styles.detailCard}>
                    <div className={styles.detailHeader}>
                        <FaDatabase />
                        <h2>Backup Verification</h2>
                    </div>
                    <div className={styles.detailList}>
                        <div className={styles.detailRow}>
                            <span>Backup file type</span>
                            <strong>Compressed database archive</strong>
                        </div>
                        <div className={styles.detailRow}>
                            <span>Integrity record</span>
                            <strong>Checksum and duration are saved</strong>
                        </div>
                        <div className={styles.detailRow}>
                            <span>Restore test</span>
                            <strong>{mongorestore.available ? 'Available using a temporary database' : 'Unavailable'}</strong>
                        </div>
                        <div className={styles.detailRow}>
                            <span>Backup tool path</span>
                            <strong>{status?.binary || 'mongodump'}</strong>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.settingsCard}>
                <div className={styles.settingsHeader}>
                    <div>
                        <h2 className={styles.tableTitle}>Automatic Backup Settings</h2>
                        <p className={styles.tableSubtitle}>
                            These settings control when the server creates backup files automatically. Automatic backups are scheduled copies of the database, not real-time database replication.
                        </p>
                    </div>
                    <button
                        className={styles.createBtn}
                        onClick={handleSaveSettings}
                        disabled={loading || savingSettings || refreshing || !schedulerDirty}
                    >
                        {savingSettings
                            ? <><FaSyncAlt className={styles.spinning} /> Saving...</>
                            : 'Save Settings'}
                    </button>
                </div>

                <div className={styles.settingsGrid}>
                    <label className={styles.fieldCard}>
                        <span className={styles.fieldLabel}>Enable automatic backups</span>
                        <span className={styles.fieldHelp}>When enabled, the server creates backup files on the schedule below.</span>
                        <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={settingsForm.enabled}
                            onChange={(event) => handleSettingsChange('enabled', event.target.checked)}
                        />
                    </label>

                    <label className={styles.fieldCard}>
                        <span className={styles.fieldLabel}>Backup frequency in hours</span>
                        <span className={styles.fieldHelp}>Set how often the server should create a full database backup. Allowed range: 1 to 168 hours.</span>
                        <input
                            type="number"
                            min="1"
                            max="168"
                            step="1"
                            className={styles.textInput}
                            value={settingsForm.intervalHours}
                            onChange={(event) => handleSettingsChange('intervalHours', event.target.value)}
                        />
                    </label>

                    <label className={styles.fieldCard}>
                        <span className={styles.fieldLabel}>Number of completed backups to keep</span>
                        <span className={styles.fieldHelp}>When the limit is reached, the oldest backup files are removed automatically. Use 0 if older files should not be removed automatically.</span>
                        <input
                            type="number"
                            min="0"
                            max="90"
                            step="1"
                            className={styles.textInput}
                            value={settingsForm.retentionCount}
                            onChange={(event) => handleSettingsChange('retentionCount', event.target.value)}
                        />
                    </label>
                </div>
            </div>

            <div className={styles.infoBanner}>
                <FaExclamationTriangle className={styles.infoIcon} />
                <p>
                    Automatic backups use the saved admin settings on this page. If no saved settings exist, the server uses these configured defaults:
                    <code>BACKUP_AUTO_ENABLED</code>,
                    <code>BACKUP_AUTO_INTERVAL_HOURS</code>,
                    <code>BACKUP_RETENTION_COUNT</code>,
                    and optional <code>MONGODUMP_BIN</code>.
                    The Verify action restores the backup into a temporary database, checks that collections and documents can be read, records the result, and then removes the temporary database.
                </p>
            </div>

            <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                    <div>
                        <h2 className={styles.tableTitle}>Backup History</h2>
                        <p className={styles.tableSubtitle}>
                            This table shows each backup attempt, whether the file is still available, and whether the backup has passed restore verification.
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className={styles.loadingState}>
                        <FaSyncAlt className={styles.spinning} />
                        <span>Loading backup information...</span>
                    </div>
                ) : backups.length === 0 ? (
                    <div className={styles.emptyState}>
                        <FaDatabase className={styles.emptyIcon} />
                        <p>No backups have been created yet. Click <strong>Create Backup Now</strong> to create the first database backup file.</p>
                    </div>
                ) : (
                    <div className={`${styles.tableWrapper} ${tblStyles.tableWrapper}`}>
                        <table className={`${styles.table} ${tblStyles.table}`}>
                            <thead>
                                <tr>
                                    <th className={styles.filenameColumn}>Filename</th>
                                    <th className={styles.triggerColumn}>Created Through</th>
                                    <th className={styles.sizeColumn}>Size</th>
                                    <th className={styles.durationColumn}>Duration</th>
                                    <th className={styles.checksumColumn}>Integrity Checksum</th>
                                    <th className={styles.verificationColumn}>Verification</th>
                                    <th className={styles.fileColumn}>File Availability</th>
                                    <th className={styles.statusColumn}>Status</th>
                                    <th className={styles.createdByColumn}>Created By</th>
                                    <th className={styles.completedColumn}>Completed On</th>
                                    <th className={styles.actionColumn}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {backups.map((backup) => {
                                    const statusMeta = getStatusMeta(backup);
                                    const fileMeta = getFileMeta(backup);
                                    const verificationMeta = getVerificationMeta(backup);
                                    const StatusIcon = statusMeta.icon;
                                    const VerificationIcon = verificationMeta.icon;
                                    const canDownload = backup.status === 'success' && backup.fileState === 'available';
                                    const canVerify = canDownload && mongorestore.available !== false;

                                    return (
                                        <tr key={backup._id}>
                                            <td className={styles.filenameColumn}>
                                                <span className={styles.filename}>{backup.filename}</span>
                                            </td>
                                            <td className={styles.triggerColumn}>
                                                <span className={styles.neutralBadge}>{getTriggerLabel(backup.triggerType)}</span>
                                            </td>
                                            <td className={`${styles.sizeCell} ${styles.sizeColumn}`}>
                                                {backup.status === 'success' ? formatBytes(backup.size) : '-'}
                                            </td>
                                            <td className={`${styles.sizeCell} ${styles.durationColumn}`}>
                                                {formatDuration(backup.durationMs)}
                                            </td>
                                            <td className={styles.checksumColumn} title={backup.checksumSha256 || ''}>
                                                <span className={styles.checksumCell}>{shortenChecksum(backup.checksumSha256)}</span>
                                            </td>
                                            <td className={styles.verificationColumn} title={backup.verificationError || ''}>
                                                <span className={`${styles.verifyBadge} ${verificationMeta.className}`}>
                                                    <VerificationIcon />
                                                    {verificationMeta.label}
                                                </span>
                                                {backup.verificationStatus === 'verified' && (
                                                    <span className={styles.verifyMeta}>
                                                        {backup.verificationCollections || 0} collections, {backup.verificationDocuments || 0} documents
                                                    </span>
                                                )}
                                                {backup.verificationStatus === 'failed' && backup.verificationError && (
                                                    <span className={styles.verifyMeta}>{backup.verificationError}</span>
                                                )}
                                            </td>
                                            <td className={styles.fileColumn}>
                                                <span className={`${styles.fileBadge} ${fileMeta.className}`}>
                                                    {fileMeta.label}
                                                </span>
                                            </td>
                                            <td className={styles.statusColumn}>
                                                <span
                                                    className={`${styles.statusBadge} ${statusMeta.className} ${backup.status === 'running' ? styles.statusAnimated : ''}`}
                                                    title={backup.errorMessage || ''}
                                                >
                                                    <StatusIcon className={backup.status === 'running' ? styles.spinning : ''} />
                                                    {statusMeta.label}
                                                </span>
                                            </td>
                                            <td className={`${styles.createdByCell} ${styles.createdByColumn}`}>
                                                {backup.createdByName || '-'}
                                            </td>
                                            <td className={`${styles.dateCell} ${styles.completedColumn}`}>
                                                {formatDate(backup.completedAt || backup.createdAt)}
                                            </td>
                                            <td className={styles.actionColumn}>
                                                {canDownload ? (
                                                    <div className={styles.actionStack}>
                                                        <button
                                                            className={styles.downloadBtn}
                                                            onClick={() => handleDownload(backup.filename)}
                                                            disabled={downloading === backup.filename || verifying === backup.filename}
                                                        >
                                                            {downloading === backup.filename
                                                                ? <><FaSyncAlt className={styles.spinning} /> Downloading...</>
                                                                : <><FaDownload /> Download</>
                                                            }
                                                        </button>
                                                        <button
                                                            className={styles.secondaryBtn}
                                                            onClick={() => handleVerify(backup.filename)}
                                                            disabled={!canVerify || verifying === backup.filename || downloading === backup.filename}
                                                        >
                                                            {verifying === backup.filename
                                                                ? <><FaSyncAlt className={styles.spinning} /> Verifying...</>
                                                                : <><FaShieldAlt /> Verify Restore</>
                                                            }
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className={styles.unavailable}>
                                                        {backup.fileState === 'pruned'
                                                            ? 'Removed'
                                                            : backup.status === 'failed'
                                                                ? 'Not applicable'
                                                                : backup.status === 'running'
                                                                    ? 'Pending'
                                                                    : 'Unavailable'}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
