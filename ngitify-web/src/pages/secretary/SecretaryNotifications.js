import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaBell, FaCheckDouble, FaFilter,
    FaCalendarCheck, FaCalendarTimes, FaClock,
    FaHeadset, FaListUl, FaUserPlus, FaCheck, FaTimes
} from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import ConfirmModal from '../../components/common/ConfirmModal';
import styles from '../../styles/admin/Notifications.module.css'; // reuse admin CSS

// ── Notification type metadata ─────────────────────────────────────────────────

const TYPE_META = {
    NEW_APPOINTMENT:          { label: 'New Booking',     color: '#2980b9', icon: <FaCalendarCheck /> },
    APPOINTMENT_CANCELLED:    { label: 'Cancelled',       color: '#e74c3c', icon: <FaCalendarTimes /> },
    APPOINTMENT_REMINDER:     { label: 'Reminder',        color: '#8e44ad', icon: <FaClock />         },
    CHAT_TICKET_RAISED:       { label: 'Chat Escalation', color: '#e67e22', icon: <FaHeadset />       },
    QUEUE_EVENT:              { label: 'Queue',           color: '#16a085', icon: <FaListUl />        },
    NEW_PATIENT_REGISTRATION: { label: 'New Patient',     color: '#27ae60', icon: <FaUserPlus />      },
};

const FILTERS = [
    'All',
    'Unread',
    'NEW_APPOINTMENT',
    'APPOINTMENT_CANCELLED',
    'CHAT_TICKET_RAISED',
    'QUEUE_EVENT',
    'NEW_PATIENT_REGISTRATION',
];

// ── Helpers ────────────────────────────────────────────────────────────────────

const formatTime = (iso) =>
    new Date(iso).toLocaleString('en-PH', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });

const getTypeInfo = (type) =>
    TYPE_META[type] || { label: type, color: '#7f8c8d', icon: <FaBell /> };

// ── Main Component ─────────────────────────────────────────────────────────────

export default function SecretaryNotifications() {
    const navigate      = useNavigate();
    const { addToast }  = useToast();

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading]             = useState(true);
    const [activeFilter, setActiveFilter]   = useState('All');

    // Confirm modal for Decline action (needs optional reason)
    const [declineTarget, setDeclineTarget] = useState(null); // { notif, appointmentId }
    const [actionLoading, setActionLoading] = useState(null); // notif._id being actioned

    // ── Fetch ──────────────────────────────────────────────────────────────────

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await authFetch('/notifications');
            if (res.ok) {
                const data = await res.json();
                // Sort: unread first, then by newest
                const sorted = [...data].sort((a, b) => {
                    if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
                    return new Date(b.createdAt) - new Date(a.createdAt);
                });
                setNotifications(sorted);
            }
        } catch (err) {
            console.error('Error fetching notifications:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

    // ── Read actions ───────────────────────────────────────────────────────────

    const markAsRead = async (id) => {
        try {
            const res = await authFetch(`/notifications/${id}/read`, { method: 'PATCH' });
            if (res.ok) {
                setNotifications(prev =>
                    prev.map(n => n._id === id ? { ...n, isRead: true } : n)
                );
            }
        } catch {
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
        } catch {
            addToast('Failed to mark all as read.', 'error');
        }
    };

    // ── Appointment actions (Accept / Decline) ─────────────────────────────────

    const handleAccept = async (notif) => {
        // relatedId on the notification points to the Surgery/Appointment document
        const appointmentId = notif.relatedId;
        if (!appointmentId) {
            addToast('Cannot find the appointment reference.', 'error');
            return;
        }
        setActionLoading(notif._id);
        try {
            const res = await authFetch(`/surgeries/${appointmentId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'confirmed' }),
            });
            if (res.ok) {
                addToast('Appointment confirmed successfully.', 'success');
                // Mark the notification as read and remove the action buttons
                await markAsRead(notif._id);
                // Refresh to get updated state
                fetchNotifications();
            } else {
                const data = await res.json();
                addToast(data.message || 'Failed to confirm appointment.', 'error');
            }
        } catch {
            addToast('Could not connect to the server.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeclineConfirm = async () => {
        if (!declineTarget) return;
        const { notif, appointmentId } = declineTarget;
        setActionLoading(notif._id);
        try {
            const res = await authFetch(`/surgeries/${appointmentId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'cancelled' }),
            });
            if (res.ok) {
                addToast('Appointment declined.', 'info');
                await markAsRead(notif._id);
                fetchNotifications();
            } else {
                const data = await res.json();
                addToast(data.message || 'Failed to decline appointment.', 'error');
            }
        } catch {
            addToast('Could not connect to the server.', 'error');
        } finally {
            setActionLoading(null);
            setDeclineTarget(null);
        }
    };

    const triggerDecline = (notif) => {
        const appointmentId = notif.relatedId;
        if (!appointmentId) {
            addToast('Cannot find the appointment reference.', 'error');
            return;
        }
        setDeclineTarget({ notif, appointmentId });
    };

    // ── Filter logic ───────────────────────────────────────────────────────────

    const filtered = notifications.filter(n => {
        if (activeFilter === 'All')    return true;
        if (activeFilter === 'Unread') return !n.isRead;
        return n.type === activeFilter;
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    // ── Notification card renderer ─────────────────────────────────────────────

    const renderActionButtons = (notif) => {
        const isLoading = actionLoading === notif._id;

        // Accept / Decline for new appointment bookings that haven't been read yet
        // (once read/actioned, the buttons disappear)
        if (notif.type === 'NEW_APPOINTMENT' && !notif.isRead) {
            return (
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                    <button
                        disabled={isLoading}
                        onClick={(e) => { e.stopPropagation(); handleAccept(notif); }}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            background: '#27ae60', color: 'white', border: 'none',
                            borderRadius: '6px', padding: '7px 14px',
                            fontSize: '12px', fontWeight: '700',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            opacity: isLoading ? 0.7 : 1,
                            fontFamily: 'inherit', transition: 'background 0.2s',
                        }}
                    >
                        <FaCheck /> {isLoading ? 'Confirming…' : 'Accept'}
                    </button>
                    <button
                        disabled={isLoading}
                        onClick={(e) => { e.stopPropagation(); triggerDecline(notif); }}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            background: '#e74c3c', color: 'white', border: 'none',
                            borderRadius: '6px', padding: '7px 14px',
                            fontSize: '12px', fontWeight: '700',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            opacity: isLoading ? 0.7 : 1,
                            fontFamily: 'inherit', transition: 'background 0.2s',
                        }}
                    >
                        <FaTimes /> Decline
                    </button>
                </div>
            );
        }

        // View Chat button for escalated chat tickets
        if (notif.type === 'CHAT_TICKET_RAISED') {
            return (
                <div style={{ marginTop: '10px' }}>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (!notif.isRead) markAsRead(notif._id);
                            navigate('/secretary/chat-support');
                        }}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            background: '#01538b', color: 'white', border: 'none',
                            borderRadius: '6px', padding: '7px 14px',
                            fontSize: '12px', fontWeight: '700',
                            cursor: 'pointer', fontFamily: 'inherit',
                            transition: 'background 0.2s',
                        }}
                    >
                        <FaHeadset /> View Chat
                    </button>
                </div>
            );
        }

        return null;
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.loadingState}>Loading notifications…</div>
            </div>
        );
    }

    return (
        <>
            <div className={styles.container}>

                {/* ── Page Header ── */}
                <div className={styles.pageHeader}>
                    <div className={styles.headerLeft}>
                        <FaBell className={styles.headerIcon} />
                        <div>
                            <h1 className={styles.pageTitle}>Notifications</h1>
                            <p className={styles.pageSubtitle}>
                                {unreadCount > 0
                                    ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
                                    : 'All caught up!'
                                }
                            </p>
                        </div>
                    </div>
                    {unreadCount > 0 && (
                        <button className={styles.markAllBtn} onClick={markAllAsRead}>
                            <FaCheckDouble /> Mark All as Read
                        </button>
                    )}
                </div>

                {/* ── Filter Tabs ── */}
                <div className={styles.filterBar}>
                    <FaFilter className={styles.filterIcon} />
                    {FILTERS.map(f => {
                        const label = f === 'All'    ? 'All'
                            : f === 'Unread' ? `Unread (${unreadCount})`
                            : getTypeInfo(f).label;
                        return (
                            <button
                                key={f}
                                className={`${styles.filterBtn} ${activeFilter === f ? styles.activeFilter : ''}`}
                                onClick={() => setActiveFilter(f)}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>

                {/* ── Notification List ── */}
                <div className={styles.notificationList}>
                    {filtered.length === 0 ? (
                        <div className={styles.emptyState}>
                            <FaBell className={styles.emptyIcon} />
                            <p>No notifications found for this filter.</p>
                        </div>
                    ) : (
                        filtered.map(notif => {
                            const typeInfo = getTypeInfo(notif.type);
                            const actions  = renderActionButtons(notif);

                            return (
                                <div
                                    key={notif._id}
                                    className={`${styles.notifCard} ${!notif.isRead ? styles.unread : ''}`}
                                    onClick={() => !notif.isRead && markAsRead(notif._id)}
                                >
                                    {/* Type badge */}
                                    <div
                                        className={styles.typeBadge}
                                        style={{ backgroundColor: typeInfo.color }}
                                    >
                                        {typeInfo.label}
                                    </div>

                                    {/* Content */}
                                    <div className={styles.notifContent}>
                                        <div className={styles.notifHeader}>
                                            <h4 className={styles.notifTitle}>{notif.title}</h4>
                                            {!notif.isRead && <span className={styles.unreadDot} />}
                                        </div>
                                        <p className={styles.notifMessage}>{notif.message}</p>
                                        <span className={styles.notifTime}>
                                            {formatTime(notif.createdAt)}
                                        </span>

                                        {/* Inline action buttons */}
                                        {actions}
                                    </div>

                                    {/* Mark Read button (only for non-actioned unread cards) */}
                                    {!notif.isRead && !actions && (
                                        <button
                                            className={styles.readBtn}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                markAsRead(notif._id);
                                            }}
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

            {/* ── Decline Confirmation Modal ── */}
            <ConfirmModal
                isOpen={!!declineTarget}
                title="Decline Appointment"
                message={`Are you sure you want to decline this appointment request? The patient will be notified and the time slot will be freed.`}
                confirmText="Yes, Decline"
                isDestructive={true}
                onConfirm={handleDeclineConfirm}
                onCancel={() => setDeclineTarget(null)}
            />
        </>
    );
}