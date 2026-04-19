import React, { useState, useEffect, useCallback } from 'react';
import { FaBell, FaCheckDouble, FaFilter } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import styles from '../../styles/admin/Notifications.module.css';

const TYPE_LABELS = {
    NEW_APPOINTMENT: { label: 'New Appointment', color: '#2980b9' },
    APPOINTMENT_CANCELLED: { label: 'Cancelled', color: '#e74c3c' },
    LOW_INVENTORY: { label: 'Low Inventory', color: '#e67e22' },
    NEW_PATIENT_REGISTRATION: { label: 'New Patient', color: '#27ae60' },
    CHAT_TICKET_RAISED: { label: 'Support Ticket', color: '#8e44ad' },
};

const FILTERS = ['All', 'Unread', 'NEW_APPOINTMENT', 'LOW_INVENTORY', 'NEW_PATIENT_REGISTRATION', 'CHAT_TICKET_RAISED'];

export default function Notifications() {
    const { addToast } = useToast();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState('All');

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await authFetch('/notifications');
            if (res.ok) {
                const data = await res.json();
                setNotifications(data);
            }
        } catch (err) {
            console.error('Error fetching notifications:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const markAsRead = async (id) => {
        try {
            const res = await authFetch(`/notifications/${id}/read`, { method: 'PATCH' });
            if (res.ok) {
                setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
            }
        } catch (err) {
            addToast('Failed to mark as read.', 'error');
        }
    };

    const markAllAsRead = async () => {
        try {
            const res = await authFetch('/notifications/read-all', { method: 'PATCH' });
            if (res.ok) {
                setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                addToast('All notifications marked as read.', 'success');
            }
        } catch (err) {
            addToast('Failed to mark all as read.', 'error');
        }
    };

    const filtered = notifications.filter(n => {
        if (activeFilter === 'All') return true;
        if (activeFilter === 'Unread') return !n.isRead;
        return n.type === activeFilter;
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const getTypeInfo = (type) => TYPE_LABELS[type] || { label: type, color: '#7f8c8d' };

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingState}>Loading notifications...</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                    <FaBell className={styles.headerIcon} />
                    <div>
                        <h1 className={styles.pageTitle}>Notifications</h1>
                        <p className={styles.pageSubtitle}>
                            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
                        </p>
                    </div>
                </div>
                {unreadCount > 0 && (
                    <button className={styles.markAllBtn} onClick={markAllAsRead}>
                        <FaCheckDouble /> Mark All as Read
                    </button>
                )}
            </div>

            {/* Filter Tabs */}
            <div className={styles.filterBar}>
                <FaFilter className={styles.filterIcon} />
                {FILTERS.map(f => (
                    <button
                        key={f}
                        className={`${styles.filterBtn} ${activeFilter === f ? styles.activeFilter : ''}`}
                        onClick={() => setActiveFilter(f)}
                    >
                        {f === 'All' ? 'All' : f === 'Unread' ? `Unread (${unreadCount})` : (TYPE_LABELS[f]?.label || f)}
                    </button>
                ))}
            </div>

            {/* Notification List */}
            <div className={styles.notificationList}>
                {filtered.length === 0 ? (
                    <div className={styles.emptyState}>
                        <FaBell className={styles.emptyIcon} />
                        <p>No notifications found for this filter.</p>
                    </div>
                ) : (
                    filtered.map(notif => {
                        const typeInfo = getTypeInfo(notif.type);
                        return (
                            <div
                                key={notif._id}
                                className={`${styles.notifCard} ${!notif.isRead ? styles.unread : ''}`}
                                onClick={() => !notif.isRead && markAsRead(notif._id)}
                            >
                                <div
                                    className={styles.typeBadge}
                                    style={{ backgroundColor: typeInfo.color }}
                                >
                                    {typeInfo.label}
                                </div>
                                <div className={styles.notifContent}>
                                    <div className={styles.notifHeader}>
                                        <h4 className={styles.notifTitle}>{notif.title}</h4>
                                        {!notif.isRead && <span className={styles.unreadDot} />}
                                    </div>
                                    <p className={styles.notifMessage}>{notif.message}</p>
                                    <span className={styles.notifTime}>
                                        {new Date(notif.createdAt).toLocaleString('en-PH', {
                                            month: 'short', day: 'numeric', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit'
                                        })}
                                    </span>
                                </div>
                                {!notif.isRead && (
                                    <button
                                        className={styles.readBtn}
                                        onClick={(e) => { e.stopPropagation(); markAsRead(notif._id); }}
                                    >
                                        Mark Read
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}