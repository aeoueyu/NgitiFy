import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    FaBell,
    FaCalendarAlt,
    FaCheck,
    FaComments,
    FaFileMedical,
    FaSearch,
    FaTimes,
} from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import ConfirmModal from '../common/ConfirmModal';
import styles from '../../styles/admin/Notifications.module.css';

const TYPE_META = {
    NEW_APPOINTMENT: { label: 'Appointment', tone: 'info', icon: FaCalendarAlt },
    APPOINTMENT_CANCELLED: { label: 'Cancelled', tone: 'danger', icon: FaCalendarAlt },
    APPOINTMENT_CONFIRMED: { label: 'Confirmed', tone: 'success', icon: FaCalendarAlt },
    APPOINTMENT_DECLINED: { label: 'Declined', tone: 'danger', icon: FaCalendarAlt },
    APPOINTMENT_REMINDER: { label: 'Reminder', tone: 'info', icon: FaCalendarAlt },
    NEW_PATIENT_REGISTRATION: { label: 'Patient', tone: 'success', icon: FaFileMedical },
    NEW_RADIOGRAPH: { label: 'Radiograph', tone: 'info', icon: FaFileMedical },
    CHAT_TICKET_RAISED: { label: 'Support Ticket', tone: 'accent', icon: FaComments },
    LOW_INVENTORY: { label: 'Inventory', tone: 'warning', icon: FaBell },
    PREDICTIVE_VISIT_DUE: { label: 'Visit Due', tone: 'warning', icon: FaBell },
    PREDICTIVE_VISIT_OVERDUE: { label: 'Visit Overdue', tone: 'danger', icon: FaBell },
    DENTAL_HEALTH_TIP: { label: 'Health Tip', tone: 'accent', icon: FaBell },
    INQUIRY_ESCALATED: { label: 'Escalated', tone: 'warning', icon: FaComments },
    QUEUE_EVENT: { label: 'Queue', tone: 'success', icon: FaCalendarAlt },
};

const RANGE_OPTIONS = [
    { value: 'today', label: 'Today' },
    { value: 'last7', label: 'Last 7 Days' },
    { value: 'last30', label: 'Last 1 Month' },
    { value: 'custom', label: 'Custom Range' },
];

const startOfDay = (value) => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
};

const endOfDay = (value) => {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
};

const getRelativeTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    const diffMs = Date.now() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 24) {
        if (diffHours <= 0) {
            const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
            return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
        }
        return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    }
    return date.toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export default function NotificationsCenter({
    enableAppointmentActions = false,
    chatPath = '',
}) {
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRange, setSelectedRange] = useState('today');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [readFilter, setReadFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedNotification, setSelectedNotification] = useState(null);
    const [declineTarget, setDeclineTarget] = useState(null);
    const [actionLoading, setActionLoading] = useState('');

    const fetchNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const response = await authFetch('/notifications');
            const data = await response.json().catch(() => ([]));
            if (!response.ok) {
                throw new Error('Failed to load notifications.');
            }
            setNotifications(Array.isArray(data) ? data : []);
        } catch (error) {
            addToast(error.message || 'Failed to load notifications.', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        fetchNotifications();
    }, [fetchNotifications]);

    const markAsRead = useCallback(async (id) => {
        try {
            const response = await authFetch(`/notifications/${id}/read`, { method: 'PATCH' });
            if (!response.ok) throw new Error();
            setNotifications((prev) => prev.map((item) => (
                item._id === id ? { ...item, isRead: true } : item
            )));
        } catch {
            addToast('Failed to mark the notification as read.', 'error');
        }
    }, [addToast]);

    const markAllAsRead = async () => {
        try {
            const response = await authFetch('/notifications/read-all', { method: 'PATCH' });
            if (!response.ok) throw new Error();
            setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
            addToast('All notifications marked as read.', 'success');
        } catch {
            addToast('Failed to mark all notifications as read.', 'error');
        }
    };

    const handleOpenDetail = async (notification) => {
        setSelectedNotification(notification);
        if (!notification.isRead) {
            await markAsRead(notification._id);
        }
    };

    const handleAcceptAppointment = async (notification) => {
        if (!notification.relatedId) {
            addToast('Cannot find the appointment reference.', 'error');
            return;
        }

        setActionLoading(notification._id);
        try {
            const response = await authFetch(`/appointments/${notification.relatedId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'confirmed' }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.message || 'Failed to confirm the appointment.');
            }
            await markAsRead(notification._id);
            addToast('Appointment confirmed successfully.', 'success');
            await fetchNotifications();
        } catch (error) {
            addToast(error.message || 'Failed to confirm the appointment.', 'error');
        } finally {
            setActionLoading('');
        }
    };

    const handleDeclineAppointment = async () => {
        if (!declineTarget?.relatedId) return;
        setActionLoading(declineTarget._id);
        try {
            const response = await authFetch(`/appointments/${declineTarget.relatedId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status: 'cancelled' }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(data.message || 'Failed to decline the appointment.');
            }
            await markAsRead(declineTarget._id);
            addToast('Appointment declined.', 'info');
            setDeclineTarget(null);
            await fetchNotifications();
        } catch (error) {
            addToast(error.message || 'Failed to decline the appointment.', 'error');
        } finally {
            setActionLoading('');
        }
    };

    const unreadCount = notifications.filter((item) => !item.isRead).length;
    const typeOptions = useMemo(
        () => ['all', ...new Set(notifications.map((item) => item.type).filter(Boolean))],
        [notifications]
    );

    const filteredNotifications = useMemo(() => {
        const now = new Date();
        const query = searchQuery.trim().toLowerCase();

        return notifications.filter((item) => {
            const createdAt = new Date(item.createdAt);
            let matchesRange = true;

            if (selectedRange === 'today') {
                matchesRange = createdAt >= startOfDay(now) && createdAt <= endOfDay(now);
            } else if (selectedRange === 'last7') {
                const start = startOfDay(now);
                start.setDate(start.getDate() - 6);
                matchesRange = createdAt >= start && createdAt <= endOfDay(now);
            } else if (selectedRange === 'last30') {
                const start = startOfDay(now);
                start.setDate(start.getDate() - 30);
                matchesRange = createdAt >= start && createdAt <= endOfDay(now);
            } else if (selectedRange === 'custom') {
                if (customFrom) {
                    matchesRange = matchesRange && createdAt >= startOfDay(customFrom);
                }
                if (customTo) {
                    matchesRange = matchesRange && createdAt <= endOfDay(customTo);
                }
            }

            const matchesType = typeFilter === 'all' || item.type === typeFilter;
            const matchesRead = readFilter === 'all'
                || (readFilter === 'unread' && !item.isRead)
                || (readFilter === 'read' && item.isRead);
            const matchesSearch = !query || [
                item.title,
                item.message,
                TYPE_META[item.type]?.label,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(query);

            return matchesRange && matchesType && matchesRead && matchesSearch;
        }).sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
    }, [customFrom, customTo, notifications, readFilter, searchQuery, selectedRange, typeFilter]);

    const renderActionButtons = (notification, compact = false) => {
        const isLoading = actionLoading === notification._id;

        if (enableAppointmentActions && notification.type === 'NEW_APPOINTMENT' && !notification.isRead) {
            return (
                <div className={`${styles.actionRow} ${compact ? styles.actionRowCompact : ''}`}>
                    <button
                        type="button"
                        className={styles.primaryBtn}
                        onClick={(event) => {
                            event.stopPropagation();
                            handleAcceptAppointment(notification);
                        }}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Confirming...' : 'Accept'}
                    </button>
                    <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={(event) => {
                            event.stopPropagation();
                            setDeclineTarget(notification);
                        }}
                        disabled={isLoading}
                    >
                        Decline
                    </button>
                </div>
            );
        }

        if (notification.type === 'CHAT_TICKET_RAISED' && chatPath) {
            return (
                <button
                    type="button"
                    className={styles.secondaryBtn}
                    onClick={(event) => {
                        event.stopPropagation();
                        navigate(chatPath);
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
                        <button type="button" className={styles.primaryBtn} onClick={markAllAsRead}>
                            Mark All as Read
                        </button>
                    )}
                </div>

                <div className={styles.filtersCard}>
                    <div className={styles.rangeGroup}>
                        {RANGE_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={`${styles.filterPill} ${selectedRange === option.value ? styles.filterPillActive : ''}`}
                                onClick={() => setSelectedRange(option.value)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    {selectedRange === 'custom' && (
                        <div className={styles.customRangeRow}>
                            <input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
                            <input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
                        </div>
                    )}

                    <div className={styles.filterGrid}>
                        <label className={styles.controlLabel}>
                            <span>Search</span>
                            <div className={styles.searchField}>
                                <FaSearch />
                                <input
                                    type="search"
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    placeholder="Search title or message"
                                />
                            </div>
                        </label>

                        <label className={styles.controlLabel}>
                            <span>Notification Type</span>
                            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                                <option value="all">All Types</option>
                                {typeOptions.filter((value) => value !== 'all').map((value) => (
                                    <option key={value} value={value}>{TYPE_META[value]?.label || value}</option>
                                ))}
                            </select>
                        </label>

                        <label className={styles.controlLabel}>
                            <span>Read Status</span>
                            <select value={readFilter} onChange={(event) => setReadFilter(event.target.value)}>
                                <option value="all">All</option>
                                <option value="unread">Unread Only</option>
                                <option value="read">Read Only</option>
                            </select>
                        </label>
                    </div>
                </div>

                <div className={styles.listCard}>
                    {loading ? (
                        <div className={styles.stateBlock}>Loading notifications...</div>
                    ) : filteredNotifications.length === 0 ? (
                        <div className={styles.stateBlock}>No notifications found for the current filters.</div>
                    ) : (
                        filteredNotifications.map((notification) => {
                            const meta = TYPE_META[notification.type] || { label: notification.type, tone: 'muted', icon: FaBell };
                            const Icon = meta.icon;

                            return (
                                <article
                                    key={notification._id}
                                    className={`${styles.notificationCard} ${!notification.isRead ? styles.unread : ''}`}
                                    onClick={() => handleOpenDetail(notification)}
                                >
                                    <div className={styles.notificationTop}>
                                        <div className={styles.notificationMeta}>
                                            <span className={`${styles.iconBadge} ${styles[`tone-${meta.tone}`]}`}>
                                                <Icon />
                                            </span>
                                            <span className={`${styles.typeBadge} ${styles[`tone-${meta.tone}`]}`}>
                                                {meta.label}
                                            </span>
                                        </div>
                                        <span className={styles.timeText}>{getRelativeTime(notification.createdAt)}</span>
                                    </div>

                                    <div className={styles.notificationBody}>
                                        <div className={styles.notificationHeading}>
                                            <h2 className={styles.notificationTitle}>{notification.title}</h2>
                                            {!notification.isRead && <span className={styles.unreadDot} />}
                                        </div>
                                        <p className={styles.notificationMessage}>{notification.message}</p>
                                    </div>

                                    {renderActionButtons(notification, true)}
                                </article>
                            );
                        })
                    )}
                </div>
            </div>

            {selectedNotification && (
                <div className={styles.modalOverlay}>
                    <div className={styles.detailModal}>
                        <div className={styles.modalHeader}>
                            <div>
                                <h2 className={styles.modalTitle}>{selectedNotification.title}</h2>
                                <p className={styles.modalMeta}>
                                    {TYPE_META[selectedNotification.type]?.label || selectedNotification.type}
                                    {' • '}
                                    {new Date(selectedNotification.createdAt).toLocaleString('en-PH')}
                                </p>
                            </div>
                            <button type="button" className={styles.closeBtn} onClick={() => setSelectedNotification(null)}>
                                <FaTimes />
                            </button>
                        </div>

                        <div className={styles.modalContent}>
                            <p className={styles.modalMessage}>{selectedNotification.message}</p>
                            {!selectedNotification.isRead && (
                                <div className={styles.modalReadFlag}>
                                    <FaCheck />
                                    Marked as read when opened
                                </div>
                            )}
                            {renderActionButtons(selectedNotification)}
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={Boolean(declineTarget)}
                title="Decline Appointment"
                message="Are you sure you want to decline this appointment request? The time slot will be released."
                confirmText="Yes, Decline"
                isDestructive={true}
                onConfirm={handleDeclineAppointment}
                onCancel={() => setDeclineTarget(null)}
            />
        </>
    );
}
