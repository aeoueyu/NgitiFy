import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import ConfirmModal from '../../components/common/ConfirmModal';
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
    QUEUE_EVENT: { label: 'Queue', tone: 'success' },
};

const FILTERS = ['All', 'Unread', ...Object.keys(TYPE_LABELS)];

export default function SecretaryNotifications() {
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('All');
    const [declineTarget, setDeclineTarget] = useState(null);
    const [actionLoading, setActionLoading] = useState(null);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await authFetch('/notifications');
            if (!res.ok) throw new Error();

            const data = await res.json();
            const list = Array.isArray(data) ? data : [];
            const sorted = [...list].sort((a, b) => {
                if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
                return new Date(b.createdAt) - new Date(a.createdAt);
            });

            setNotifications(sorted);
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

    const handleAccept = async (notification) => {
        const appointmentId = notification.relatedId;
        if (!appointmentId) {
            addToast('Cannot find the appointment reference.', 'error');
            return;
        }

        setActionLoading(notification._id);
        try {
            const res = await authFetch(`/surgeries/${appointmentId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'confirmed' }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || 'Failed to confirm appointment.');
            }

            addToast('Appointment confirmed successfully.', 'success');
            await markAsRead(notification._id);
            fetchNotifications();
        } catch (error) {
            addToast(error.message || 'Could not connect to the server.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeclineConfirm = async () => {
        if (!declineTarget) return;

        const { notification, appointmentId } = declineTarget;
        setActionLoading(notification._id);

        try {
            const res = await authFetch(`/surgeries/${appointmentId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'cancelled' }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.message || 'Failed to decline appointment.');
            }

            addToast('Appointment declined.', 'info');
            await markAsRead(notification._id);
            fetchNotifications();
        } catch (error) {
            addToast(error.message || 'Could not connect to the server.', 'error');
        } finally {
            setActionLoading(null);
            setDeclineTarget(null);
        }
    };

    const triggerDecline = (notification) => {
        const appointmentId = notification.relatedId;
        if (!appointmentId) {
            addToast('Cannot find the appointment reference.', 'error');
            return;
        }

        setDeclineTarget({ notification, appointmentId });
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

    const renderActionButtons = (notification) => {
        const isLoading = actionLoading === notification._id;

        if (notification.type === 'NEW_APPOINTMENT' && !notification.isRead) {
            return (
                <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        className={styles.primaryBtn}
                        disabled={isLoading}
                        onClick={(event) => {
                            event.stopPropagation();
                            handleAccept(notification);
                        }}
                        style={{ opacity: isLoading ? 0.7 : 1 }}
                    >
                        {isLoading ? 'Confirming...' : 'Accept'}
                    </button>
                    <button
                        type="button"
                        className={styles.secondaryBtn}
                        disabled={isLoading}
                        onClick={(event) => {
                            event.stopPropagation();
                            triggerDecline(notification);
                        }}
                        style={{ opacity: isLoading ? 0.7 : 1 }}
                    >
                        Decline
                    </button>
                </div>
            );
        }

        if (notification.type === 'CHAT_TICKET_RAISED') {
            return (
                <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={(event) => {
                        event.stopPropagation();
                        if (!notification.isRead) {
                            markAsRead(notification._id);
                        }
                        navigate('/secretary/chat-support');
                    }}
                >
                    View Chat
                </button>
            );
        }

        if (!notification.isRead) {
            return (
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
            );
        }

        return null;
    };

    return (
        <>
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
                            const actionButton = renderActionButtons(notification);

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

                                    {actionButton}
                                </article>
                            );
                        })
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={!!declineTarget}
                title="Decline Appointment"
                message="Are you sure you want to decline this appointment request? The patient will be notified and the time slot will be freed."
                confirmText="Yes, Decline"
                isDestructive={true}
                onConfirm={handleDeclineConfirm}
                onCancel={() => setDeclineTarget(null)}
            />
        </>
    );
}
