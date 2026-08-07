import React from 'react';
import { FaBell, FaTimes } from 'react-icons/fa';
import { formatTime, formatWeekdayDate } from '../../utils/dateUtils';
import PasswordChangeWarning from '../common/PasswordChangeWarning';
import styles from '../../styles/admin/AdminDashboard.module.css';

export function AdminDashboardPage({
    title,
    currentTime,
    subtitle,
    notificationPath,
    unreadCount = 0,
    navigate,
    children,
}) {
    return (
        <main className={styles['main-content']}>
            <header className={styles.header}>
                <div className={styles['header-left']}>
                    <h1 className={styles.title}>{title}</h1>
                    <p className={styles.subtitle}>
                        {formatWeekdayDate(currentTime)}
                        <span className={styles.divider}>|</span>
                        <strong className={styles['time-accent']}>{formatTime(currentTime, true)}</strong>
                        {subtitle ? (
                            <>
                                <span className={styles.divider}>|</span>
                                {subtitle}
                            </>
                        ) : null}
                    </p>
                </div>
                {notificationPath ? (
                    <div className={styles['header-right']}>
                        <button
                            type="button"
                            className={styles['bell-btn']}
                            onClick={() => navigate(notificationPath)}
                            aria-label="Notifications"
                        >
                            <FaBell className={styles['bell-icon']} />
                            {unreadCount > 0 ? (
                                <span className={styles['bell-badge']}>
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            ) : null}
                        </button>
                    </div>
                ) : null}
            </header>
            <PasswordChangeWarning />
            {children}
        </main>
    );
}

export function AdminAlertBanner({ children, onClose }) {
    return (
        <div className={styles['alert-banner']}>
            <div className={styles['alert-content']}>{children}</div>
            <button
                type="button"
                className={styles['alert-close-btn']}
                onClick={onClose}
                aria-label="Close Alert"
            >
                <FaTimes />
            </button>
        </div>
    );
}

export function AdminStatCard({
    title,
    value,
    description,
    icon,
    iconTone = 'bg-cyan',
    trend,
    trendTone = 'trend-neutral',
    onClick,
    valueClassName = '',
    descClassName = '',
}) {
    const content = (
        <>
            <div className={styles['stat-header']}>
                <p className={styles['stat-title']}>{title}</p>
                <div className={`${styles['stat-icon-wrapper']} ${styles[iconTone] || ''}`}>
                    {icon}
                </div>
            </div>
            <div className={styles['stat-value-wrapper']}>
                <h2 className={`${styles['stat-value']} ${valueClassName}`}>{value}</h2>
                {trend ? (
                    <span className={`${styles['trend-indicator']} ${styles[trendTone] || ''}`}>
                        {trend}
                    </span>
                ) : null}
            </div>
            <p className={`${styles['stat-desc']} ${descClassName}`}>{description}</p>
        </>
    );

    if (onClick) {
        return (
            <button
                type="button"
                className={`${styles['stat-card']} ${styles.clickable} ${styles.statButton}`}
                onClick={onClick}
            >
                {content}
            </button>
        );
    }

    return <div className={styles['stat-card']}>{content}</div>;
}

export function AdminCalendarCard({
    monthLabel,
    calendarDays,
    onPrevMonth,
    onNextMonth,
    onSelectDate,
    holidays = [],
    showHolidays = false,
}) {
    return (
        <section className={styles['calendar-card']}>
            <div className={styles['calendar-header']}>
                <h3 className={styles['month-text']}>{monthLabel}</h3>
                <div className={styles['cal-nav']}>
                    <button type="button" className={styles['cal-nav-btn']} onClick={onPrevMonth}>&lt;</button>
                    <button type="button" className={styles['cal-nav-btn']} onClick={onNextMonth}>&gt;</button>
                </div>
            </div>

            <div className={styles['calendar-grid']}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
                    <div key={day} className={styles['day-name']}>{day}</div>
                ))}

                {calendarDays.map((day, index) => (
                    <div
                        key={`${day.date?.toISOString?.() || day.num}-${index}`}
                        title={day.holidayName || ''}
                        onClick={() => onSelectDate(day)}
                        className={[
                            styles['date-num'],
                            day.faded ? styles.faded : '',
                            day.isToday && !day.faded ? styles.today : '',
                            day.active ? styles.active : '',
                            day.isHoliday && !day.faded ? styles.holiday : '',
                        ].join(' ')}
                    >
                        {day.num}
                        {day.hasEvent ? (
                            <div className={`${styles['event-dot']} ${day.active ? styles.white : ''}`} />
                        ) : null}
                    </div>
                ))}
            </div>

            {showHolidays ? (
                <div className={styles['holiday-panel']}>
                    <p className={styles['holiday-heading']}>Holidays This Month</p>
                    {holidays.length > 0 ? (
                        <div className={styles['holiday-list']}>
                            {holidays.map((holiday) => (
                                <div key={`${holiday.month}-${holiday.day}`} className={styles['holiday-item']}>
                                    <span className={styles['holiday-date']}>{holiday.day}</span>
                                    <span className={styles['holiday-name']}>{holiday.name}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className={styles['holiday-empty']}>No fixed holidays in this month.</p>
                    )}
                </div>
            ) : null}
        </section>
    );
}

export function AdminQuickActions({ actions }) {
    if (!actions?.length) return null;

    return (
        <div className={styles['quick-actions-bar']}>
            {actions.map((action) => (
                <button
                    key={action.label}
                    type="button"
                    className={`${styles['quick-action-btn']} ${action.secondary ? styles.secondary : ''}`}
                    onClick={action.onClick}
                >
                    {action.icon}
                    {action.label}
                </button>
            ))}
        </div>
    );
}

export { styles as adminDashboardStyles };
