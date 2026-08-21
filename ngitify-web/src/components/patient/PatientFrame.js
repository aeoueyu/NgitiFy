import React from 'react';
import adminStyles from '../../styles/admin/AdminDashboard.module.css';
import styles from '../../styles/patient/PatientPortal.module.css';

export function PatientPageFrame({
    title,
    subtitle,
    actions,
    children,
    hideHeader = false,
}) {
    return (
        <main className={`${adminStyles['main-content']} ${styles.page}`}>
            {!hideHeader ? (
                <header className={`${adminStyles.header} ${styles.header}`}>
                    <div className={`${adminStyles['header-left']} ${styles.headerCopy}`}>
                        <h1 className={`${adminStyles.title} ${styles.title}`}>
                            {title}
                        </h1>

                        {subtitle ? (
                            <p className={`${adminStyles.subtitle} ${styles.subtitle}`}>
                                {subtitle}
                            </p>
                        ) : null}
                    </div>

                    {actions ? (
                        <div className={`${adminStyles['header-right']} ${styles.headerActions}`}>
                            {actions}
                        </div>
                    ) : null}
                </header>
            ) : null}

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
        <span className={`${styles.statusBadge} ${statusClassName}`} aria-label={`Status: ${label || status || 'Status'}`}>
            {label || (normalizedStatus === 'in-clinic' ? 'In Clinic' : status || 'Status')}
        </span>
    );
}

export function PatientEmptyState({ icon, title, message, action }) {
    return (
        <div className={styles.emptyState} role="status" aria-live="polite">
            {icon ? <div className={styles.emptyIcon}>{icon}</div> : null}
            <h3 className={styles.emptyTitle}>{title}</h3>
            <p className={styles.emptyText}>{message}</p>
            {action ? <div className={styles.emptyAction}>{action}</div> : null}
        </div>
    );
}

