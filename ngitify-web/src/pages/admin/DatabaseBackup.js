import React, { useState, useEffect, useCallback } from 'react';
import {
    FaDatabase, FaDownload, FaPlus, FaCheckCircle,
    FaTimesCircle, FaSyncAlt, FaExclamationTriangle
} from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import styles from '../../styles/admin/DatabaseBackup.module.css';

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

const formatDate = (iso) =>
    new Date(iso).toLocaleString('en-PH', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });

// ── Main Component ────────────────────────────────────────────────────────────

export default function DatabaseBackup() {
    const { addToast } = useToast();

    const [backups, setBackups]           = useState([]);
    const [loading, setLoading]           = useState(true);
    const [creating, setCreating]         = useState(false);
    const [downloading, setDownloading]   = useState(null); // filename currently downloading

    // ── Fetch backup list ─────────────────────────────────────────────────────

    const fetchBackups = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch('/backup/list');
            if (res.ok) {
                const data = await res.json();
                setBackups(data);
            } else {
                addToast('Failed to load backup list.', 'error');
            }
        } catch (err) {
            console.error('Error fetching backups:', err);
            addToast('Network error loading backups.', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => { fetchBackups(); }, [fetchBackups]);

    // ── Create backup ─────────────────────────────────────────────────────────

    const handleCreate = async () => {
        if (creating) return;
        setCreating(true);
        addToast('Creating backup… this may take a moment.', 'info');
        try {
            const res = await authFetch('/backup/create', { method: 'POST' });
            if (res.ok) {
                addToast('Backup created successfully!', 'success');
                fetchBackups();
            } else {
                const data = await res.json().catch(() => ({}));
                addToast(data.message || 'Backup creation failed.', 'error');
            }
        } catch (err) {
            addToast('Network error. Backup could not be created.', 'error');
        } finally {
            setCreating(false);
        }
    };

    // ── Download backup ───────────────────────────────────────────────────────

    const handleDownload = async (filename) => {
        setDownloading(filename);
        try {
            const res = await authFetch(`/backup/download/${encodeURIComponent(filename)}`);
            if (!res.ok) {
                addToast('Download failed. File may no longer exist on the server.', 'error');
                return;
            }
            // Stream the blob and trigger a browser download
            const blob = await res.blob();
            const url  = window.URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch (err) {
            addToast('Download error. Please try again.', 'error');
        } finally {
            setDownloading(null);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    const successCount = backups.filter(b => b.status === 'success').length;
    const failedCount  = backups.filter(b => b.status === 'failed').length;

    return (
        <div className={styles.container}>

            {/* ── Page Header ─────────────────────────────────────────────── */}
            <div className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                    <div>
                        <h1 className={styles.pageTitle}>Database Backup</h1>
                        <p className={styles.pageSubtitle}>
                            Create and download MongoDB backups for disaster recovery.
                        </p>
                    </div>
                </div>
                <button
                    className={styles.createBtn}
                    onClick={handleCreate}
                    disabled={creating}
                >
                    {creating
                        ? <><FaSyncAlt className={styles.spinning} /> Creating…</>
                        : <><FaPlus /> Create Backup Now</>
                    }
                </button>
            </div>

            {/* ── Info Banner ──────────────────────────────────────────────── */}
            <div className={styles.infoBanner}>
                <FaExclamationTriangle className={styles.infoIcon} />
                <p>
                    Backups are stored on the server in <code>/backend/backups/</code>.
                    Download and store copies off-site regularly.
                    Requires <code>mongodump</code> to be installed on the server.
                </p>
            </div>

            {/* ── Stats Row ────────────────────────────────────────────────── */}
            <div className={styles.statsRow}>
                <div className={styles.statCard}>
                    <span className={styles.statValue}>{backups.length}</span>
                    <span className={styles.statLabel}>Total Backups</span>
                </div>
                <div className={styles.statCard}>
                    <span className={`${styles.statValue} ${styles.statGreen}`}>{successCount}</span>
                    <span className={styles.statLabel}>Successful</span>
                </div>
                <div className={styles.statCard}>
                    <span className={`${styles.statValue} ${styles.statRed}`}>{failedCount}</span>
                    <span className={styles.statLabel}>Failed</span>
                </div>
                {backups.length > 0 && (
                    <div className={styles.statCard}>
                        <span className={styles.statValue} style={{ fontSize: 15 }}>
                            {formatDate(backups[0].createdAt)}
                        </span>
                        <span className={styles.statLabel}>Last Backup</span>
                    </div>
                )}
            </div>

            {/* ── Backup Table ─────────────────────────────────────────────── */}
            <div className={styles.tableCard}>
                <div className={styles.tableHeader}>
                    <h2 className={styles.tableTitle}>Backup History</h2>
                    <button
                        className={styles.refreshBtn}
                        onClick={fetchBackups}
                        disabled={loading}
                        title="Refresh list"
                    >
                        <FaSyncAlt className={loading ? styles.spinning : ''} />
                        Refresh
                    </button>
                </div>

                {loading ? (
                    <div className={styles.loadingState}>
                        <FaSyncAlt className={styles.spinning} />
                        <span>Loading backups…</span>
                    </div>
                ) : backups.length === 0 ? (
                    <div className={styles.emptyState}>
                        <FaDatabase className={styles.emptyIcon} />
                        <p>No backups yet. Click <strong>Create Backup Now</strong> to get started.</p>
                    </div>
                ) : (
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Filename</th>
                                    <th>Size</th>
                                    <th>Status</th>
                                    <th>Created By</th>
                                    <th>Date</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {backups.map((backup) => (
                                    <tr key={backup._id}>
                                        {/* Filename */}
                                        <td>
                                            <span className={styles.filename}>{backup.filename}</span>
                                        </td>

                                        {/* Size */}
                                        <td className={styles.sizeCell}>
                                            {backup.status === 'success'
                                                ? formatBytes(backup.size)
                                                : '—'
                                            }
                                        </td>

                                        {/* Status */}
                                        <td>
                                            {backup.status === 'success' ? (
                                                <span className={`${styles.statusBadge} ${styles.statusSuccess}`}>
                                                    <FaCheckCircle /> Success
                                                </span>
                                            ) : (
                                                <span className={`${styles.statusBadge} ${styles.statusFailed}`}
                                                    title={backup.errorMessage || 'Unknown error'}
                                                >
                                                    <FaTimesCircle /> Failed
                                                </span>
                                            )}
                                        </td>

                                        {/* Created By */}
                                        <td className={styles.createdByCell}>
                                            {backup.createdByName || '—'}
                                        </td>

                                        {/* Date */}
                                        <td className={styles.dateCell}>
                                            {formatDate(backup.createdAt)}
                                        </td>

                                        {/* Download */}
                                        <td>
                                            {backup.status === 'success' && backup.fileExists ? (
                                                <button
                                                    className={styles.downloadBtn}
                                                    onClick={() => handleDownload(backup.filename)}
                                                    disabled={downloading === backup.filename}
                                                >
                                                    {downloading === backup.filename ? (
                                                        <><FaSyncAlt className={styles.spinning} /> Downloading…</>
                                                    ) : (
                                                        <><FaDownload /> Download</>
                                                    )}
                                                </button>
                                            ) : (
                                                <span className={styles.unavailable}>
                                                    {backup.status === 'failed' ? 'N/A' : 'File missing'}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
