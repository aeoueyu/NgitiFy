import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import styles from '../../styles/admin/Notifications.module.css';

const TYPE_LABELS = {
    NEW_APPOINTMENT: { label: 'New Appointment', tone: 'info' },
    APPOINTMENT_CANCELLED: { label: 'Cancelled', tone: 'danger' },
    APPOINTMENT_CONFIRMED: { label: 'Confirmed', tone: 'success' },
    APPOINTMENT_DECLINED: { label: 'Declined', tone: 'danger' },
    APPOINTMENT_REMINDER: { label: 'Reminder', tone: 'info' },
    LOW_INVENTORY: { label: 'Low Inventory', tone: 'warning' },
    NEW_PATIENT_REGISTRATION: { label: 'New Patient', tone: 'success' },
    CHAT_TICKET_RAISED: { label: 'Support Ticket', tone: 'accent' },
    PREDICTIVE_VISIT_DUE: { label: 'Visit Due', tone: 'warning' },
    PREDICTIVE_VISIT_OVERDUE: { label: 'Visit Overdue', tone: 'danger' },
    DENTAL_HEALTH_TIP: { label: 'Health Tip', tone: 'accent' },
    INQUIRY_ESCALATED: { label: 'Inquiry Escalated', tone: 'warning' },
    NEW_RADIOGRAPH: { label: 'Radiograph', tone: 'info' },
};

const FILTERS = ['All', 'Unread', ...Object.keys(TYPE_LABELS)];

export default function Notifications() {
    const { addToast } = useToast();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('All');

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await authFetch('/notifications');
            if (!res.ok) throw new Error();
            const data = await res.json();
            setNotifications(Array.isArray(data) ? data : []);
        } catch (error) {
            addToast('Failed to load notifications.', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const markAsRead = async (id) => {
        try {
            const res = await authFetch(`/notifications/${id}/read`, { method: 'PATCH' });
            if (!res.ok) throw new Error();
            setNotifications((prev) => prev.map((item) => (
                item._id === id ? { ...item, isRead: true } : item
            )));
        } catch (error) {
            addToast('Failed to mark notification as read.', 'error');
        }
    };

    const markAllAsRead = async () => {
        try {
            const res = await authFetch('/notifications/read-all', { method: 'PATCH' });
            if (!res.ok) throw new Error();
            setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
            addToast('All notifications marked as read.', 'success');
        } catch (error) {
            addToast('Failed to mark all notifications as read.', 'error');
        }
    };

    const unreadCount = notifications.filter((item) => !item.isRead).length;

    const filteredNotifications = useMemo(() => notifications.filter((item) => {
        if (activeFilter === 'All') return true;
        if (activeFilter === 'Unread') return !item.isRead;
        return item.type === activeFilter;
    }), [activeFilter, notifications]);

    const filterCounts = useMemo(() => notifications.reduce((acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1;
        return acc;
    }, {}), [notifications]);

    const getTypeInfo = (type) => TYPE_LABELS[type] || { label: type, tone: 'muted' };

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Notifications</h1>
                    <p className={styles.pageSubtitle}>
                        {unreadCount > 0
                            ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
                            : 'All caught up.'}
                    </p>
                </div>
                {unreadCount > 0 && (
                    <button className={styles.primaryBtn} onClick={markAllAsRead} type="button">
                        Mark All as Read
                    </button>
                )}
            </div>

            <div className={styles.filterBar}>
                {FILTERS.map((filter) => {
                    const count = filter === 'Unread'
                        ? unreadCount
                        : filter === 'All'
                            ? notifications.length
                            : (filterCounts[filter] || 0);
                    const label = filter === 'All'
                        ? 'All'
                        : filter === 'Unread'
                            ? 'Unread'
                            : (TYPE_LABELS[filter]?.label || filter);

                    return (
                        <button
                            key={filter}
                            type="button"
                            className={`${styles.filterBtn} ${activeFilter === filter ? styles.activeFilter : ''}`}
                            onClick={() => setActiveFilter(filter)}
                        >
                            <span>{label}</span>
                            <span className={styles.filterCount}>{count}</span>
                        </button>
                    );
                })}
            </div>

            <div className={styles.listCard}>
                {loading ? (
                    <div className={styles.stateBlock}>Loading notifications...</div>
                ) : filteredNotifications.length === 0 ? (
                    <div className={styles.stateBlock}>No notifications found for this filter.</div>
                ) : (
                    filteredNotifications.map((notification) => {
                        const typeInfo = getTypeInfo(notification.type);
                        return (
                            <article
                                key={notification._id}
                                className={`${styles.notificationCard} ${!notification.isRead ? styles.unread : ''}`}
                                onClick={() => !notification.isRead && markAsRead(notification._id)}
                            >
                                <div className={styles.notificationTop}>
                                    <span className={`${styles.typeBadge} ${styles[`tone-${typeInfo.tone}`]}`}>
                                        {typeInfo.label}
                                    </span>
                                    <span className={styles.timeText}>
                                        {new Date(notification.createdAt).toLocaleString('en-PH', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </span>
                                </div>

                                <div className={styles.notificationBody}>
                                    <div className={styles.notificationHeading}>
                                        <h2 className={styles.notificationTitle}>{notification.title}</h2>
                                        {!notification.isRead && <span className={styles.unreadDot} />}
                                    </div>
                                    <p className={styles.notificationMessage}>{notification.message}</p>
                                </div>

                                {!notification.isRead && (
                                    <button
                                        type="button"
                                        className={styles.secondaryBtn}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            markAsRead(notification._id);
                                        }}
                                    >
                                        Mark Read
                                    </button>
                                )}
                            </article>
                        );
                    })
                )}
            </div>
        </div>
    );
}
