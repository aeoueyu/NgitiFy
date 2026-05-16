import React from 'react';
import styles from '../../styles/patient/PatientPortal.module.css';

export function PatientPageFrame({ title, subtitle, actions, children }) {
    return (
        <main className={styles.page}>
            <header className={styles.header}>
                <div className={styles.headerCopy}>
                    <h1 className={styles.title}>{title}</h1>
                    {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
                </div>
                {actions ? <div className={styles.headerActions}>{actions}</div> : null}
            </header>
            {children}
        </main>
    );
}

export function PatientSectionHeader({ eyebrow, title, description, action }) {
    return (
        <div className={styles.sectionHeader}>
            <div>
                {eyebrow ? <span className={styles.sectionEyebrow}>{eyebrow}</span> : null}
                <h2 className={styles.sectionTitle}>{title}</h2>
                {description ? <p className={styles.sectionDescription}>{description}</p> : null}
            </div>
            {action ? <div>{action}</div> : null}
        </div>
    );
}

export function PatientStatusBadge({ status, label }) {
    const normalizedStatus = String(status || '').toLowerCase();
    const statusClassName = {
        pending: styles.statusPending,
        confirmed: styles.statusConfirmed,
        'in-clinic': styles.statusInClinic,
        completed: styles.statusCompleted,
        cancelled: styles.statusCancelled,
    }[normalizedStatus] || styles.statusDefault;

    return (
        <span className={`${styles.statusBadge} ${statusClassName}`}>
            {label || (normalizedStatus === 'in-clinic' ? 'In Clinic' : status || 'Status')}
        </span>
    );
}

export function PatientEmptyState({ icon, title, message, action }) {
    return (
        <div className={styles.emptyState}>
            {icon ? <div className={styles.emptyIcon}>{icon}</div> : null}
            <h3 className={styles.emptyTitle}>{title}</h3>
            <p className={styles.emptyText}>{message}</p>
            {action ? <div className={styles.emptyAction}>{action}</div> : null}
        </div>
    );
}

