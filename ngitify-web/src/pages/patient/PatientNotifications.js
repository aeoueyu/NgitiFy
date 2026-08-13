import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBell, FaCheckCircle } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import {
    formatRelativeTimestamp,
    getNotificationTarget,
    NOTIFICATION_META,
} from '../../utils/patientPortal';
import { PatientEmptyState, PatientPageFrame, PatientSectionHeader } from '../../components/patient/PatientFrame';
import PatientIcon from '../../components/patient/PatientIcon';
import styles from '../../styles/patient/PatientPortal.module.css';

function NotificationRow({ item, onClick }) {
    const meta = NOTIFICATION_META[item.type] || { icon: 'notifications-outline', library: 'Ionicons', color: '#01538b', label: 'Notification' };
    return (
        <button
            type="button"
            className={styles.listCard}
            onClick={() => onClick(item)}
            aria-label={`${item.isRead ? 'Read' : 'Unread'} ${meta.label}: ${item.title || meta.label}. ${item.message}`}
            style={{
                textAlign: 'left',
                width: '100%',
                cursor: 'pointer',
                border: item.isRead ? '1px solid rgba(1, 83, 139, 0.07)' : '1px solid rgba(45, 204, 246, 0.4)',
            }}
        >
            <div className={styles.listHeader}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <span className={styles.toolIcon} style={{ color: meta.color }} aria-hidden="true">
                        <PatientIcon name={meta.icon} color={meta.color} />
                    </span>
                    <div>
                        <h3 className={styles.listTitle}>{item.title || meta.label}</h3>
                        <p className={styles.listMeta}>{formatRelativeTimestamp(item.createdAt)} • {meta.label}</p>
                    </div>
                </div>
                {!item.isRead ? <span className={styles.statusBadge} style={{ background: '#dceeff', color: '#0b4f93' }}>Unread</span> : null}
            </div>
            <p className={styles.toolText}>{item.message}</p>
        </button>
    );
}

export default function PatientNotifications() {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [markingAll, setMarkingAll] = useState(false);

    const fetchNotifications = useCallback(async () => {
        try {
            setError('');
            const response = await authFetch('/notifications');
            if (!response.ok) {
                throw new Error('Could not load notifications.');
            }
            const payload = await response.json();
            setNotifications(Array.isArray(payload) ? payload : []);
        } catch {
            setNotifications([]);
            setError('Could not load notifications. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
        const intervalId = window.setInterval(fetchNotifications, 30000);
        const handleFocus = () => fetchNotifications();
        window.addEventListener('focus', handleFocus);
        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
        };
    }, [fetchNotifications]);

    const unreadCount = useMemo(
        () => notifications.filter((item) => !item.isRead).length,
        [notifications]
    );

    const handleNotificationClick = async (item) => {
        if (!item.isRead) {
            setNotifications((current) => current.map((entry) => (
                entry._id === item._id ? { ...entry, isRead: true } : entry
            )));
            try {
                await authFetch(`/notifications/${item._id}/read`, { method: 'PATCH' });
            } catch {
                // Keep the optimistic UI state.
            }
        }

        const target = getNotificationTarget(item.type || '');
        if (target) {
            navigate(target);
        }
    };

    const handleMarkAllRead = async () => {
        if (!unreadCount) return;
        setMarkingAll(true);
        setNotifications((current) => current.map((entry) => ({ ...entry, isRead: true })));
        try {
            await authFetch('/notifications/read-all', { method: 'PATCH' });
        } catch {
            // Keep the optimistic UI state.
        } finally {
            setMarkingAll(false);
        }
    };

    return (
        <PatientPageFrame
            title="Notifications"
            subtitle="Appointment alerts, predictive visit reminders, support updates, and patient-facing clinic notices."
        >
            <div className={styles.metricGrid}>
                <article className={styles.metricCard}>
                    <span className={styles.metricLabel}>Unread</span>
                    <h3 className={styles.metricValue}>{unreadCount}</h3>
                    <p className={styles.metricSub}>Items that still need your attention.</p>
                </article>
                <article className={styles.metricCard}>
                    <span className={styles.metricLabel}>All Notifications</span>
                    <h3 className={styles.metricValue}>{notifications.length}</h3>
                    <p className={styles.metricSub}>Stored in your patient account activity stream.</p>
                </article>
                <article className={styles.metricCard}>
                    <span className={styles.metricLabel}>Quick Action</span>
                    <button type="button" className={styles.buttonSecondary} onClick={handleMarkAllRead} disabled={!unreadCount || markingAll}>
                        {markingAll ? 'Updating...' : 'Mark All as Read'}
                    </button>
                </article>
            </div>

            <PatientSectionHeader
                eyebrow="Inbox"
                title={unreadCount ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'All caught up'}
                description="Open a notification to mark it as read and jump to the related patient feature."
            />

            {loading ? (
                <div className={styles.loaderBox}>
                    <span className={styles.loaderText}>Loading notifications...</span>
                </div>
            ) : error ? (
                <PatientEmptyState
                    icon={<FaBell />}
                    title="Could not load notifications"
                    message={error}
                    action={(
                        <button type="button" className={styles.buttonSecondary} onClick={fetchNotifications}>
                            Try Again
                        </button>
                    )}
                />
            ) : notifications.length ? (
                notifications.map((item) => (
                    <NotificationRow key={item._id} item={item} onClick={handleNotificationClick} />
                ))
            ) : (
                <PatientEmptyState
                    icon={<FaCheckCircle />}
                    title="No notifications yet"
                    message="Appointment confirmations, visit reminders, support replies, and radiograph updates will appear here."
                />
            )}
        </PatientPageFrame>
    );
}
