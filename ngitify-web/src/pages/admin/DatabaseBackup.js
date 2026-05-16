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
        ? 'Scheduled'
        : 'Manual'
);

const getStatusMeta = (backup) => {
    const normalized = String(backup?.status || '').trim().toLowerCase();
    if (normalized === 'running') {
        return { label: 'Running', className: styles.statusRunning, icon: FaSyncAlt };
    }
    if (normalized === 'success') {
        return { label: 'Success', className: styles.statusSuccess, icon: FaCheckCircle };
    }
    return { label: 'Failed', className: styles.statusFailed, icon: FaTimesCircle };
};

const getFileMeta = (backup) => {
    if (backup?.fileState === 'pruned') {
        return { label: 'Pruned by retention', className: styles.filePruned };
    }
    if (backup?.fileState === 'available') {
        return { label: 'Available', className: styles.fileAvailable };
    }
    if (backup?.fileState === 'missing') {
        return { label: 'Missing', className: styles.fileMissing };
    }
    return { label: 'N/A', className: styles.fileNeutral };
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
                addToast('Failed to load backup status.', 'error');
            }

            if (listRes.ok) {
                setBackups(await listRes.json());
            } else {
                hadError = true;
                addToast('Failed to load backup history.', 'error');
            }

            if (silent && !hadError) {
                addToast('Backup status refreshed.', 'success');
            }
        } catch (error) {
            console.error('Error loading backup data:', error);
            addToast('Network error loading backup tools.', 'error');
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
        addToast('Creating backup. This may take a moment.', 'info');

        try {
            const res = await authFetch('/backup/create', { method: 'POST' });
            const data = await res.json().catch(() => ({}));

            if (res.ok) {
                const prunedCount = Number(data?.retention?.deletedCount || 0);
                addToast(
                    prunedCount > 0
                        ? `Backup created successfully. Retention pruned ${prunedCount} older backup(s).`
                        : 'Backup created successfully.',
                    'success'
                );
                await loadData();
                return;
            }

            if (res.status === 409) {
                addToast(data.message || 'A backup is already running.', 'warning');
                await loadData({ silent: false });
                return;
            }

            addToast(data.message || 'Backup creation failed.', 'error');
        } catch (error) {
            console.error('Backup create error:', error);
            addToast('Network error. Backup could not be created.', 'error');
        } finally {
            setCreating(false);
        }
    };

    const handleDownload = async (filename) => {
        setDownloading(filename);
        try {
            const res = await authFetch(`/backup/download/${encodeURIComponent(filename)}`);
            if (!res.ok) {
                addToast('Download failed. The file may no longer exist on the server.', 'error');
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
                            Create verified MongoDB backup archives, monitor scheduler readiness, and track local retention from one admin control center.
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
                                ? <><FaClock /> Backup Running...</>
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
                            {mongodump.available ? 'Backup binary ready' : 'Backup binary unavailable'}
                        </h2>
                        <p className={styles.bannerCopy}>
                            {mongodump.available
                                ? `${mongodump.version || status?.binary || 'mongodump'}`
                                : (mongodump.error || 'The server could not execute mongodump.')}
                        </p>
                    </div>
                </div>

                <div className={styles.bannerCard}>
                    <div className={styles.bannerIcon}>
                        <FaShieldAlt />
                    </div>
                    <div>
                        <h2 className={styles.bannerTitle}>Local protection only</h2>
                        <p className={styles.bannerCopy}>
                            Backups are stored in <code>{status?.backupDir || 'backend/backups'}</code>. Keep downloading copies off-server until off-site sync is added.
                        </p>
                    </div>
                </div>
            </div>

            {activeBackup && (
                <div className={styles.jobBanner}>
                    <FaSyncAlt className={styles.spinning} />
                    <div>
                        <strong>{activeBackup.filename}</strong> is currently running.
                        Started {formatDate(activeBackup.startedAt)} by {activeBackup.createdByName || getTriggerLabel(activeBackup.triggerType)}.
                    </div>
                </div>
            )}

            <div className={styles.statsRow}>
                <div className={styles.statCard}>
                    <span className={styles.statValue}>{summary.totalRuns ?? backups.length}</span>
                    <span className={styles.statLabel}>Total Runs</span>
                </div>
                <div className={styles.statCard}>
                    <span className={`${styles.statValue} ${styles.statGreen}`}>{summary.successfulRuns ?? backups.filter((backup) => backup.status === 'success').length}</span>
                    <span className={styles.statLabel}>Successful</span>
                </div>
                <div className={styles.statCard}>
                    <span className={`${styles.statValue} ${styles.statRed}`}>{summary.failedRuns ?? backups.filter((backup) => backup.status === 'failed').length}</span>
                    <span className={styles.statLabel}>Failed</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statValue}>{scheduler.enabled ? `${scheduler.intervalHours || 24}h` : 'Off'}</span>
                    <span className={styles.statLabel}>Auto Backup</span>
                </div>
                <div className={styles.statCard}>
                    <span className={styles.statValue}>{scheduler.retentionCount > 0 ? scheduler.retentionCount : 'Off'}</span>
                    <span className={styles.statLabel}>Local Retention</span>
                </div>
            </div>

            <div className={styles.detailsGrid}>
                <div className={styles.detailCard}>
                    <div className={styles.detailHeader}>
                        <FaClock />
                        <h2>Scheduler</h2>
                    </div>
                    <div className={styles.detailList}>
                        <div className={styles.detailRow}>
                            <span>Automatic backups</span>
                            <strong>{scheduler.enabled ? 'Enabled' : 'Disabled'}</strong>
                        </div>
                        <div className={styles.detailRow}>
                            <span>Interval</span>
                            <strong>{scheduler.enabled ? `${scheduler.intervalHours || 24} hour(s)` : 'Manual only'}</strong>
                        </div>
                        <div className={styles.detailRow}>
                            <span>Next automatic run</span>
                            <strong>{scheduler.enabled ? formatDate(scheduler.nextAutomaticBackupAt) : '-'}</strong>
                        </div>
                        <div className={styles.detailRow}>
                            <span>Last updated</span>
                            <strong>{scheduler.updatedAt ? formatDate(scheduler.updatedAt) : 'Env/defaults'}</strong>
                        </div>
                    </div>
                </div>

                <div className={styles.detailCard}>
                    <div className={styles.detailHeader}>
                        <FaDatabase />
                        <h2>Retention</h2>
                    </div>
                    <div className={styles.detailList}>
                        <div className={styles.detailRow}>
                            <span>Local retention limit</span>
                            <strong>{scheduler.retentionCount > 0 ? `${scheduler.retentionCount} successful backups` : 'Disabled'}</strong>
                        </div>
                        <div className={styles.detailRow}>
                            <span>Pruning behavior</span>
                            <strong>{scheduler.retentionCount > 0 ? 'Older local files are deleted automatically' : 'No automatic pruning'}</strong>
                        </div>
                        <div className={styles.detailRow}>
                            <span>Storage strategy</span>
                            <strong>Server local only</strong>
                        </div>
                    </div>
                </div>

                <div className={styles.detailCard}>
                    <div className={styles.detailHeader}>
                        <FaDatabase />
                        <h2>Verification</h2>
                    </div>
                    <div className={styles.detailList}>
                        <div className={styles.detailRow}>
                            <span>Archive format</span>
                            <strong>`mongodump --archive --gzip`</strong>
                        </div>
                        <div className={styles.detailRow}>
                            <span>Integrity metadata</span>
                            <strong>SHA-256 + duration saved per run</strong>
                        </div>
                        <div className={styles.detailRow}>
                            <span>Binary path</span>
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
                            These settings control the local scheduler only. They improve backup frequency, but they are still not real-time replication.
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
                        <span className={styles.fieldLabel}>Automatic backups</span>
                        <span className={styles.fieldHelp}>Turn scheduled `mongodump` runs on or off.</span>
                        <input
                            type="checkbox"
                            className={styles.checkbox}
                            checked={settingsForm.enabled}
                            onChange={(event) => handleSettingsChange('enabled', event.target.checked)}
                        />
                    </label>

                    <label className={styles.fieldCard}>
                        <span className={styles.fieldLabel}>Interval hours</span>
                        <span className={styles.fieldHelp}>Choose how often the server creates a full archive. Allowed: 1 to 168 hours.</span>
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
                        <span className={styles.fieldLabel}>Retention count</span>
                        <span className={styles.fieldHelp}>Keep this many successful local backups before pruning older files. Use 0 to disable pruning.</span>
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
                    Automatic backups now use saved admin settings and fall back to environment defaults when no saved settings exist:
                    <code>BACKUP_AUTO_ENABLED</code>,
                    <code>BACKUP_AUTO_INTERVAL_HOURS</code>,
                    <code>BACKUP_RETENTION_COUNT</code>,
                    and optional <code>MONGODUMP_BIN</code>.
                    Restore is still intentionally manual and should be done outside the live admin UI.
                </p>
            </div>

            <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                    <div>
                        <h2 className={styles.tableTitle}>Backup History</h2>
                        <p className={styles.tableSubtitle}>
                            Recent runs include runtime status, checksum, trigger source, and local file state.
                        </p>
                    </div>
                </div>

                {loading ? (
                    <div className={styles.loadingState}>
                        <FaSyncAlt className={styles.spinning} />
                        <span>Loading backup tools...</span>
                    </div>
                ) : backups.length === 0 ? (
                    <div className={styles.emptyState}>
                        <FaDatabase className={styles.emptyIcon} />
                        <p>No backups yet. Click <strong>Create Backup Now</strong> to start the first verified archive.</p>
                    </div>
                ) : (
                    <div className={`${styles.tableWrapper} ${tblStyles.tableWrapper}`}>
                        <table className={`${styles.table} ${tblStyles.table}`}>
                            <thead>
                                <tr>
                                    <th>Filename</th>
                                    <th>Trigger</th>
                                    <th>Size</th>
                                    <th>Duration</th>
                                    <th>Checksum</th>
                                    <th>File</th>
                                    <th>Status</th>
                                    <th>Created By</th>
                                    <th>Completed</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {backups.map((backup) => {
                                    const statusMeta = getStatusMeta(backup);
                                    const fileMeta = getFileMeta(backup);
                                    const StatusIcon = statusMeta.icon;
                                    const canDownload = backup.status === 'success' && backup.fileState === 'available';

                                    return (
                                        <tr key={backup._id}>
                                            <td>
                                                <span className={styles.filename}>{backup.filename}</span>
                                            </td>
                                            <td>
                                                <span className={styles.neutralBadge}>{getTriggerLabel(backup.triggerType)}</span>
                                            </td>
                                            <td className={styles.sizeCell}>
                                                {backup.status === 'success' ? formatBytes(backup.size) : '-'}
                                            </td>
                                            <td className={styles.sizeCell}>
                                                {formatDuration(backup.durationMs)}
                                            </td>
                                            <td title={backup.checksumSha256 || ''}>
                                                <span className={styles.checksumCell}>{shortenChecksum(backup.checksumSha256)}</span>
                                            </td>
                                            <td>
                                                <span className={`${styles.fileBadge} ${fileMeta.className}`}>
                                                    {fileMeta.label}
                                                </span>
                                            </td>
                                            <td>
                                                <span
                                                    className={`${styles.statusBadge} ${statusMeta.className} ${backup.status === 'running' ? styles.statusAnimated : ''}`}
                                                    title={backup.errorMessage || ''}
                                                >
                                                    <StatusIcon className={backup.status === 'running' ? styles.spinning : ''} />
                                                    {statusMeta.label}
                                                </span>
                                            </td>
                                            <td className={styles.createdByCell}>
                                                {backup.createdByName || '-'}
                                            </td>
                                            <td className={styles.dateCell}>
                                                {formatDate(backup.completedAt || backup.createdAt)}
                                            </td>
                                            <td>
                                                {canDownload ? (
                                                    <button
                                                        className={styles.downloadBtn}
                                                        onClick={() => handleDownload(backup.filename)}
                                                        disabled={downloading === backup.filename}
                                                    >
                                                        {downloading === backup.filename
                                                            ? <><FaSyncAlt className={styles.spinning} /> Downloading...</>
                                                            : <><FaDownload /> Download</>
                                                        }
                                                    </button>
                                                ) : (
                                                    <span className={styles.unavailable}>
                                                        {backup.fileState === 'pruned'
                                                            ? 'Pruned'
                                                            : backup.status === 'failed'
                                                                ? 'N/A'
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
