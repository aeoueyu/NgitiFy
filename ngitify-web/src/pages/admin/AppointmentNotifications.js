import React, { useState, useEffect } from 'react';
import { authFetch } from '../../utils/api'; // Ensure this path matches your utility
import styles from '../../styles/admin/AppointmentNotifications.module.css';

export default function AppointmentNotifications() {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchNotifications = async () => {
        try {
            const response = await authFetch('/notifications');
            if (response.ok) {
                const data = await response.json();
                // Filter specifically for appointments if needed, or show all
                setNotifications(data);
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
    }, []);

    const markAsRead = async (id) => {
        try {
            const res = await authFetch(`/notifications/${id}/read`, { method: 'PATCH' });
            if (res.ok) {
                setNotifications((current) => current.map(n =>
                    n._id === id ? { ...n, isRead: true } : n
                ));
                window.dispatchEvent(new Event('ngitify-notifications-updated'));
            }
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            const res = await authFetch('/notifications/read-all', { method: 'PATCH' });
            if (res.ok) {
                setNotifications((current) => current.map(n => ({ ...n, isRead: true })));
                window.dispatchEvent(new Event('ngitify-notifications-updated'));
            }
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    };

    if (loading) return <div className={styles.container}>Loading notifications...</div>;

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>Appointment Alerts</h2>
                <button className={styles.markAllBtn} onClick={markAllAsRead}>
                    Mark All as Read
                </button>
            </div>

            <div className={styles.notificationList}>
                {notifications.length === 0 ? (
                    <div className={styles.emptyState}>No notifications to display.</div>
                ) : (
                    notifications.map(notif => (
                        <div 
                            key={notif._id} 
                            className={`${styles.notificationCard} ${!notif.isRead ? styles.unread : ''}`}
                            onClick={() => {
                                if (!notif.isRead) markAsRead(notif._id);
                            }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => {
                                if ((event.key === 'Enter' || event.key === ' ') && !notif.isRead) {
                                    event.preventDefault();
                                    markAsRead(notif._id);
                                }
                            }}
                        >
                            <div className={styles.content}>
                                <h4>{notif.title}</h4>
                                <p>{notif.message}</p>
                                <small>{new Date(notif.createdAt).toLocaleString()}</small>
                            </div>
                            {!notif.isRead && (
                                <button className={styles.readBtn} onClick={(event) => {
                                    event.stopPropagation();
                                    markAsRead(notif._id);
                                }}>
                                    Mark Read
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
