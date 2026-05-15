import React from 'react';
import styles from './LifecycleHistoryPanel.module.css';
import {
    formatLifecycleDateTime,
    getLifecycleSnapshot,
} from '../../utils/lifecycleHistory';

const getToneClassName = (tone) => {
    if (tone === 'archive') return styles.historyCardArchive;
    if (tone === 'restore') return styles.historyCardRestore;
    if (tone === 'deactivate') return styles.historyCardDeactivate;
    return '';
};

export default function LifecycleHistoryPanel({
    account = {},
    entityLabel = 'account',
}) {
    const snapshot = getLifecycleSnapshot(account);

    return (
        <section className={styles.panel}>
            <div className={styles.header}>
                <div>
                    <h3 className={styles.title}>Lifecycle History</h3>
                    <p className={styles.subtitle}>
                        Review the current lifecycle state, retention status, and the latest archive or access actions for this {entityLabel}.
                    </p>
                </div>
            </div>

            <div className={styles.pillRow}>
                <span className={styles.pill}>{snapshot.lifecycleLabel}</span>
                <span className={styles.pill}>{snapshot.verificationLabel}</span>
                {snapshot.retention.isArchived && (
                    <span className={snapshot.retention.isRetentionSatisfied ? styles.successPill : styles.warningPill}>
                        {snapshot.retention.statusLabel}
                    </span>
                )}
            </div>

            {snapshot.historyEntries.length > 0 ? (
                <div className={styles.historyGrid}>
                    {snapshot.historyEntries.map((entry) => (
                        <div key={entry.key} className={`${styles.historyCard} ${getToneClassName(entry.tone)}`.trim()}>
                            <span className={styles.historyLabel}>{entry.label}</span>
                            <p className={styles.historyValue}>{formatLifecycleDateTime(entry.date)}</p>
                            <p className={styles.historyMeta}>Handled by: {entry.actor}</p>
                            <p className={styles.historyMeta}>
                                Reason: {entry.reason || 'No explicit reason was recorded.'}
                            </p>
                        </div>
                    ))}
                </div>
            ) : (
                <div className={styles.emptyState}>
                    No archive, restore, or deactivation history has been recorded yet.
                </div>
            )}
        </section>
    );
}
