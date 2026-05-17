import React from 'react';
import scheduleStyles from '../../styles/shared/SchedulePage.module.css';

export default function LogDetailsModal({
    isOpen,
    onClose,
    title = 'Log Details',
    subtitle = 'Review the full log entry.',
    summaryItems = [],
    detailsTitle = 'Details',
    detailsText = '',
}) {
    if (!isOpen) return null;

    return (
        <div className={scheduleStyles.modalOverlay} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="log-details-title">
            <div
                className={scheduleStyles.wideModal}
                style={{ width: 'min(760px, 92vw)', maxHeight: '88vh' }}
                onClick={(event) => event.stopPropagation()}
            >
                <div className={scheduleStyles.modalHeader}>
                    <div>
                        <h2 id="log-details-title" className={scheduleStyles.modalTitle}>{title}</h2>
                        <p className={scheduleStyles.modalSubtitle}>{subtitle}</p>
                    </div>
                    <button type="button" className={scheduleStyles.closeButton} onClick={onClose} aria-label="Close details modal">
                        ×
                    </button>
                </div>

                <div className={scheduleStyles.viewerBody}>
                    {summaryItems.length > 0 && (
                        <div className={scheduleStyles.viewerSummary}>
                            {summaryItems.map((item) => (
                                <div key={item.label} className={scheduleStyles.summaryCard}>
                                    <span className={scheduleStyles.summaryLabel}>{item.label}</span>
                                    <strong className={scheduleStyles.summaryValue}>{item.value}</strong>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className={scheduleStyles.notesPanel}>
                        <h3 className={scheduleStyles.panelTitle}>{detailsTitle}</h3>
                        <p style={{ margin: 0, color: '#334155', lineHeight: 1.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {detailsText || 'No extra details recorded.'}
                        </p>
                    </div>
                </div>

                <div className={scheduleStyles.modalActions}>
                    <button type="button" className={scheduleStyles.secondaryButton} onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}
