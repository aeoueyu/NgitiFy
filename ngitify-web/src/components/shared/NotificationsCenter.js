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
import scheduleStyles from '../../styles/shared/SchedulePage.module.css';
import wideTable from '../../styles/wideTable.module.css';

const TYPE_META = {
    NEW_APPOINTMENT: { label: 'Appointment', tone: wideTable.statusBlue, icon: FaCalendarAlt },
    APPOINTMENT_CANCELLED: { label: 'Cancelled', tone: wideTable.statusRed, icon: FaCalendarAlt },
    APPOINTMENT_CONFIRMED: { label: 'Confirmed', tone: wideTable.statusGreen, icon: FaCalendarAlt },
    APPOINTMENT_DECLINED: { label: 'Declined', tone: wideTable.statusRed, icon: FaCalendarAlt },
    APPOINTMENT_REMINDER: { label: 'Reminder', tone: wideTable.statusBlue, icon: FaCalendarAlt },
    NEW_PATIENT_REGISTRATION: { label: 'Patient', tone: wideTable.statusGreen, icon: FaFileMedical },
    NEW_RADIOGRAPH: { label: 'Radiograph', tone: wideTable.statusBlue, icon: FaFileMedical },
    CHAT_TICKET_RAISED: { label: 'Support Ticket', tone: wideTable.statusAmber, icon: FaComments },
    LOW_INVENTORY: { label: 'Inventory', tone: wideTable.statusAmber, icon: FaBell },
    PREDICTIVE_VISIT_DUE: { label: 'Visit Due', tone: wideTable.statusAmber, icon: FaBell },
    PREDICTIVE_VISIT_OVERDUE: { label: 'Visit Overdue', tone: wideTable.statusRed, icon: FaBell },
    DENTAL_HEALTH_TIP: { label: 'Health Tip', tone: wideTable.statusGray, icon: FaBell },
    INQUIRY_ESCALATED: { label: 'Escalated', tone: wideTable.statusAmber, icon: FaComments },
    QUEUE_EVENT: { label: 'Queue', tone: wideTable.statusGreen, icon: FaCalendarAlt },
};

const RANGE_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'today', label: 'Today' },
    { value: '3days', label: '3 Days' },
    { value: '7days', label: '7 Days' },
    { value: 'custom', label: 'Custom' },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const getTodayString = () => new Date().toISOString().split('T')[0];

const addDays = (dateString, count) => {
    const date = new Date(`${dateString}T12:00:00`);
    date.setDate(date.getDate() + count);
    return date.toISOString().split('T')[0];
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

const getDateRange = (range, customFrom, customTo) => {
    const today = getTodayString();
    if (range === 'all') return null;
    if (range === '3days') return { from: today, to: addDays(today, 2) };
    if (range === '7days') return { from: today, to: addDays(today, 6) };
    if (range === 'custom') {
        const from = customFrom || today;
        const to = customTo || from;
        return from <= to ? { from, to } : { from: to, to: from };
    }
    return { from: today, to: today };
};

export default function NotificationsCenter({
    enableAppointmentActions = false,
    chatPath = '',
}) {
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRange, setSelectedRange] = useState('all');
    const [customFrom, setCustomFrom] = useState(getTodayString());
    const [customTo, setCustomTo] = useState(getTodayString());
    const [typeFilter, setTypeFilter] = useState('all');
    const [readFilter, setReadFilter] = useState('all');
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedNotification, setSelectedNotification] = useState(null);
    const [declineTarget, setDeclineTarget] = useState(null);

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

    const handleAcceptAppointment = async (notification) => {
        if (!notification.relatedId) {
            addToast('Cannot find the appointment reference.', 'error');
            return;
        }

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
        }
    };

    const handleDeclineAppointment = async () => {
        if (!declineTarget?.relatedId) return;
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
        }
    };

    const unreadCount = notifications.filter((item) => !item.isRead).length;
    const typeOptions = useMemo(
        () => ['all', ...new Set(notifications.map((item) => item.type).filter(Boolean))],
        [notifications]
    );

    const dateRange = useMemo(
        () => getDateRange(selectedRange, customFrom, customTo),
        [customFrom, customTo, selectedRange]
    );

    const filteredNotifications = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        return notifications.filter((item) => {
            const createdAt = new Date(item.createdAt);
            const createdDateKey = createdAt.toISOString().split('T')[0];
            const matchesRange = !dateRange || (createdDateKey >= dateRange.from && createdDateKey <= dateRange.to);
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
    }, [dateRange, notifications, readFilter, searchQuery, typeFilter]);

    useEffect(() => {
        setCurrentPage(1);
    }, [pageSize, searchQuery, selectedRange, typeFilter, readFilter, customFrom, customTo]);

    const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / pageSize));
    const pagedNotifications = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredNotifications.slice(start, start + pageSize);
    }, [currentPage, filteredNotifications, pageSize]);

    useEffect(() => {
        setCurrentPage((prev) => Math.min(prev, totalPages));
    }, [totalPages]);

    return (
        <>
            <div className={scheduleStyles.page}>
                <div className={scheduleStyles.headerRow}>
                    <div>
                        <h1 className={scheduleStyles.pageTitle}>Notifications</h1>
                        <p className={scheduleStyles.pageSubtitle}>
                            {unreadCount > 0
                                ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
                                : 'All caught up.'}
                        </p>
                    </div>

                    {unreadCount > 0 && (
                        <button type="button" className={scheduleStyles.primaryButton} onClick={markAllAsRead}>
                            Mark All as Read
                        </button>
                    )}
                </div>

                <div className={scheduleStyles.toolbar}>
                    <div className={scheduleStyles.toolbarFilters}>
                        <div className={scheduleStyles.searchWrapper}>
                            <FaSearch className={scheduleStyles.searchIcon} />
                            <input
                                className={scheduleStyles.searchInput}
                                type="search"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Search title or message"
                            />
                        </div>

                        <div className={scheduleStyles.pillGroup}>
                            {RANGE_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    className={`${scheduleStyles.filterPill} ${selectedRange === option.value ? scheduleStyles.activePill : ''}`}
                                    onClick={() => setSelectedRange(option.value)}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>

                        {selectedRange === 'custom' && (
                            <div className={scheduleStyles.customDateRange}>
                                <label className={scheduleStyles.dateField}>
                                    <span>From</span>
                                    <input className={scheduleStyles.formControl} type="date" value={customFrom} max={customTo || undefined} onChange={(event) => setCustomFrom(event.target.value)} />
                                </label>
                                <label className={scheduleStyles.dateField}>
                                    <span>To</span>
                                    <input className={scheduleStyles.formControl} type="date" value={customTo} min={customFrom || undefined} onChange={(event) => setCustomTo(event.target.value)} />
                                </label>
                            </div>
                        )}

                        <div className={scheduleStyles.inlineFilterRow}>
                            <select className={scheduleStyles.filterSelect} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                                <option value="all">All Types</option>
                                {typeOptions.filter((value) => value !== 'all').map((value) => (
                                    <option key={value} value={value}>{TYPE_META[value]?.label || value}</option>
                                ))}
                            </select>

                            <select className={scheduleStyles.filterSelect} value={readFilter} onChange={(event) => setReadFilter(event.target.value)}>
                                <option value="all">All Read Status</option>
                                <option value="unread">Unread</option>
                                <option value="read">Read</option>
                            </select>

                            <select className={scheduleStyles.filterSelect} value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
                                {PAGE_SIZE_OPTIONS.map((option) => (
                                    <option key={option} value={option}>{option} per page</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className={scheduleStyles.tableContainer}>
                    <table className={wideTable.table}>
                        <thead>
                            <tr>
                                <th style={{ width: '14%' }}>Type</th>
                                <th style={{ width: '20%' }}>Title</th>
                                <th style={{ width: '34%' }}>Message</th>
                                <th style={{ width: '18%' }}>Date</th>
                                <th style={{ width: '10%' }}>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className={scheduleStyles.stateBlock}>Loading notifications...</td>
                                </tr>
                            ) : filteredNotifications.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className={scheduleStyles.emptyStateBox}>No notifications found for the current filters.</td>
                                </tr>
                            ) : (
                                pagedNotifications.map((notification) => {
                                    const meta = TYPE_META[notification.type] || { label: notification.type, tone: wideTable.statusGray, icon: FaBell };
                                    const Icon = meta.icon;

                                    return (
                                        <tr
                                            key={notification._id}
                                            onClick={() => setSelectedNotification(notification)}
                                            style={{
                                                cursor: 'pointer',
                                                backgroundColor: notification.isRead ? undefined : '#eff8ff',
                                                boxShadow: notification.isRead ? undefined : 'inset 4px 0 0 #01538b',
                                            }}
                                        >
                                            <td>
                                                <span className={`${wideTable.statusBadge} ${meta.tone}`} title={meta.label}>
                                                    <Icon /> {meta.label}
                                                </span>
                                            </td>
                                            <td title={notification.title}>{notification.title}</td>
                                            <td title={notification.message}>{notification.message}</td>
                                            <td>
                                                <div className={scheduleStyles.patientCell}>
                                                    <strong>{new Date(notification.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
                                                    <span>{getRelativeTime(notification.createdAt)}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`${wideTable.statusBadge} ${notification.isRead ? wideTable.statusGray : wideTable.statusBlue}`}>
                                                    {notification.isRead ? 'Read' : 'Unread'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {!loading && filteredNotifications.length > 0 && (
                    <div className={scheduleStyles.paginationRow}>
                        <span className={scheduleStyles.helperText}>
                            Showing {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, filteredNotifications.length)} of {filteredNotifications.length} notifications
                        </span>
                        <div className={scheduleStyles.actionRow}>
                            <button
                                type="button"
                                className={scheduleStyles.secondaryButton}
                                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                            >
                                Previous
                            </button>
                            <button
                                type="button"
                                className={scheduleStyles.secondaryButton}
                                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {selectedNotification && (
                <div className={scheduleStyles.modalOverlay}>
                    <div className={scheduleStyles.wideModal} style={{ width: 'min(640px, 92vw)' }}>
                        <div className={scheduleStyles.modalHeader}>
                            <div>
                                <h3 className={scheduleStyles.modalTitle}>{selectedNotification.title}</h3>
                                <p className={scheduleStyles.modalSubtitle}>
                                    {(TYPE_META[selectedNotification.type]?.label || selectedNotification.type)}
                                    {' • '}
                                    {new Date(selectedNotification.createdAt).toLocaleString('en-PH')}
                                </p>
                            </div>
                            <button type="button" className={scheduleStyles.closeButton} onClick={() => setSelectedNotification(null)}>
                                <FaTimes />
                            </button>
                        </div>

                        <div className={scheduleStyles.modalBody}>
                            <p style={{ margin: 0, color: '#475569', lineHeight: 1.7 }}>{selectedNotification.message}</p>
                            <div style={{ marginTop: '18px' }}>
                                <div style={{ color: '#64748b', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                                    Notification Details
                                </div>
                                <div style={{ display: 'grid', gap: '8px', color: '#334155', fontSize: '14px' }}>
                                    <div><strong>Type:</strong> {TYPE_META[selectedNotification.type]?.label || selectedNotification.type || '-'}</div>
                                    <div><strong>Status:</strong> {selectedNotification.isRead ? 'Read' : 'Unread'}</div>
                                    <div><strong>Received:</strong> {new Date(selectedNotification.createdAt).toLocaleString('en-PH')}</div>
                                    <div><strong>Reference:</strong> {selectedNotification.relatedId || '-'}</div>
                                </div>
                            </div>
                            {!selectedNotification.isRead && (
                                <div style={{ marginTop: '14px' }}>
                                    <button type="button" className={scheduleStyles.secondaryButton} onClick={() => markAsRead(selectedNotification._id)}>
                                        Mark as Read
                                    </button>
                                </div>
                            )}
                            {selectedNotification.type === 'CHAT_TICKET_RAISED' && chatPath && (
                                <div style={{ marginTop: '14px' }}>
                                    <button type="button" className={scheduleStyles.secondaryButton} onClick={() => navigate(chatPath)}>
                                        View Chat
                                    </button>
                                </div>
                            )}
                            {enableAppointmentActions && selectedNotification.type === 'NEW_APPOINTMENT' && !selectedNotification.isRead && (
                                <div style={{ marginTop: '14px' }}>
                                    <button type="button" className={scheduleStyles.secondaryButton} onClick={() => handleAcceptAppointment(selectedNotification)}>
                                        Confirm Appointment
                                    </button>
                                    <button type="button" className={scheduleStyles.secondaryButton} style={{ marginLeft: '8px' }} onClick={() => setDeclineTarget(selectedNotification)}>
                                        Decline
                                    </button>
                                </div>
                            )}
                            {selectedNotification.isRead && (
                                <div style={{ marginTop: '14px', color: '#64748b', fontSize: '13px', fontWeight: 600 }}>
                                    <FaCheck style={{ marginRight: '6px' }} />
                                    Notification already marked as read.
                                </div>
                            )}
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
