import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    FaListUl, FaSearch, FaFilter,
    FaUserPlus, FaCalendarAlt, FaUserEdit,
    FaHeadset, FaKey, FaListOl,
    FaToggleOn, FaSave, FaBan,
    FaCheck, FaTimes, FaLock
} from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import { formatDateShort, formatTime } from '../../utils/dateUtils';
import UserAvatar from '../../components/common/UserAvatar';
import styles from '../../styles/admin/ActivityLogs.module.css'; // reuse admin CSS

// ── Secretary-specific action categories ───────────────────────────────────────
//   Mapped to the logged actions defined in the implementation plan (Phase 8).

const CATEGORIES = ['All', 'Patients', 'Appointments', 'Queue', 'Chat', 'Account'];

const ACTION_CATEGORY_MAP = {
    // Patient actions
    Patients: [
        'ADD_PATIENT', 'PATIENT_REGISTERED', 'CREATE_PATIENT',
        'EDIT_USER', 'UPDATE_PATIENT', 'PATIENT_UPDATED',
        'RESEND_ACTIVATION',
    ],
    // Appointment actions
    Appointments: [
        'CREATE_APPOINTMENT', 'APPOINTMENT_CREATED',
        'UPDATE_APPOINTMENT', 'APPOINTMENT_UPDATED',
        'APPOINTMENT_STATUS_UPDATE', 'APPOINTMENT_ACCEPTED',
        'APPOINTMENT_DECLINED', 'APPOINTMENT_CANCELLED',
        'DELETE_APPOINTMENT', 'SLOT_BLOCKED', 'SLOT_UNAVAILABLE',
    ],
    // Queue actions
    Queue: [
        'QUEUE_CREATE', 'QUEUE_UPDATE', 'QUEUE_DELETE',
        'QUEUE_ADVANCE', 'QUEUE_REMOVE', 'QUEUE_RESET',
    ],
    // Chat / Support actions
    Chat: [
        'TICKET_RESOLVED', 'TICKET_CREATED', 'CHAT_RESOLVED',
        'SUPPORT_TICKET_RESOLVED',
    ],
    // Account / security actions
    Account: [
        'PASSWORD_CHANGED', 'PASSWORD_RESET', 'PROFILE_UPDATED',
        'LOGIN', 'LOGOUT', 'SESSION_TIMEOUT',
        'NOTIFICATION_PREFERENCES_UPDATED',
    ],
};

const getCategoryForAction = (action = '') => {
    const a = action.toUpperCase();
    for (const [cat, keywords] of Object.entries(ACTION_CATEGORY_MAP)) {
        if (keywords.some(k => a.includes(k))) return cat;
    }
    return 'Account'; // fallback
};

// ── Icon + colour per action keyword ──────────────────────────────────────────

const getActionMeta = (action = '') => {
    const a = action.toUpperCase();

    if (a.includes('LOGIN'))
        return { icon: <FaKey />,        color: '#27ae60' };
    if (a.includes('LOGOUT') || a.includes('SESSION'))
        return { icon: <FaKey />,        color: '#7f8c8d' };
    if (a.includes('PASSWORD') || a.includes('PROFILE'))
        return { icon: <FaLock />,       color: '#8e44ad' };
    if (a.includes('NOTIFICATION'))
        return { icon: <FaToggleOn />,   color: '#8e44ad' };

    if (a.includes('ADD_PATIENT') || a.includes('CREATE_PATIENT') || a.includes('PATIENT_REGISTERED'))
        return { icon: <FaUserPlus />,   color: '#2980b9' };
    if (a.includes('UPDATE_PATIENT') || a.includes('EDIT_USER') || a.includes('PATIENT_UPDATED') || a.includes('RESEND'))
        return { icon: <FaUserEdit />,   color: '#3498db' };

    if (a.includes('CREATE_APPOINTMENT') || a.includes('APPOINTMENT_CREATED'))
        return { icon: <FaCalendarAlt />, color: '#1abc9c' };
    if (a.includes('APPOINTMENT_ACCEPTED') || a.includes('APPOINTMENT_STATUS'))
        return { icon: <FaCheck />,      color: '#27ae60' };
    if (a.includes('APPOINTMENT_DECLINED'))
        return { icon: <FaTimes />,      color: '#e74c3c' };
    if (a.includes('APPOINTMENT_CANCELLED') || a.includes('DELETE_APPOINTMENT'))
        return { icon: <FaBan />,        color: '#e67e22' };
    if (a.includes('APPOINTMENT_UPDATED') || a.includes('UPDATE_APPOINTMENT'))
        return { icon: <FaSave />,       color: '#3498db' };
    if (a.includes('SLOT'))
        return { icon: <FaToggleOn />,   color: '#e67e22' };

    if (a.includes('QUEUE_CREATE'))
        return { icon: <FaUserPlus />,   color: '#16a085' };
    if (a.includes('QUEUE_ADVANCE') || a.includes('QUEUE_UPDATE'))
        return { icon: <FaListOl />,     color: '#1abc9c' };
    if (a.includes('QUEUE_DELETE') || a.includes('QUEUE_REMOVE') || a.includes('QUEUE_RESET'))
        return { icon: <FaTimes />,      color: '#e74c3c' };

    if (a.includes('TICKET') || a.includes('CHAT'))
        return { icon: <FaHeadset />,    color: '#8e44ad' };

    return { icon: <FaListUl />, color: '#95a5a6' };
};

// ── Constants ──────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 20;

// ── Main Component ─────────────────────────────────────────────────────────────

export default function SecretaryActivityLogs() {
    const { user } = useAuth();

    const [logs, setLogs]       = useState([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [search, setSearch]       = useState('');
    const [catFilter, setCatFilter] = useState('All');
    const [dateFrom, setDateFrom]   = useState('');
    const [dateTo, setDateTo]       = useState('');

    // Pagination
    const [page, setPage] = useState(1);

    // ── Fetch ──────────────────────────────────────────────────────────────────

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            // Scope to the secretary's own user ID so they only see their own logs.
            // The backend /audit-logs route accepts an optional ?userId= query param.
            const userId = user?.userId || user?.id || user?._id;
            const params = userId ? `?userId=${userId}` : '';
            const res = await authFetch(`/audit-logs${params}`);

            if (res.ok) {
                const data = await res.json();
                const mapped = data.map(log => {
                    const date = new Date(log.timestamp || log.createdAt);
                    return {
                        id:             log._id,
                        action:         log.action || 'Unknown Action',
                        user:           log.user   || 'Secretary',
                        role:           (log.role  || 'secretary').toLowerCase(),
                        details:        log.details || '',
                        date,
                        formattedDate:  formatDateShort(date),
                        formattedTime:  formatTime(date),
                        category:       getCategoryForAction(log.action),
                        meta:           getActionMeta(log.action),
                    };
                });
                // Newest first
                mapped.sort((a, b) => b.date - a.date);
                setLogs(mapped);
            }
        } catch (err) {
            console.error('Error fetching activity logs:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    // Reset to page 1 whenever filters change
    useEffect(() => { setPage(1); }, [search, catFilter, dateFrom, dateTo]);

    // ── Filter logic ───────────────────────────────────────────────────────────

    const filtered = useMemo(() => {
        return logs.filter(log => {
            const q = search.toLowerCase();
            if (q && !log.action.toLowerCase().includes(q) &&
                     !log.details.toLowerCase().includes(q)) return false;

            if (catFilter !== 'All' && log.category !== catFilter) return false;

            if (dateFrom) {
                if (log.date < new Date(dateFrom).setHours(0, 0, 0, 0)) return false;
            }
            if (dateTo) {
                if (log.date > new Date(dateTo).setHours(23, 59, 59, 999)) return false;
            }
            return true;
        });
    }, [logs, search, catFilter, dateFrom, dateTo]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const paginated  = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    const hasActiveFilter = search || catFilter !== 'All' || dateFrom || dateTo;

    const clearFilters = () => {
        setSearch('');
        setCatFilter('All');
        setDateFrom('');
        setDateTo('');
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div className={styles.container}>

            {/* ── Page Header ── */}
            <div className={styles.pageHeader}>
                <FaListUl className={styles.headerIcon} />
                <div>
                    <h1 className={styles.pageTitle}>My Activity Logs</h1>
                    <p className={styles.pageSubtitle}>
                        A personal audit trail of all actions you have performed in the system.
                    </p>
                </div>
            </div>

            {/* ── Filters ── */}
            <div className={styles.filtersCard}>
                <div className={styles.filtersRow}>

                    {/* Search */}
                    <div className={styles.searchWrapper}>
                        <FaSearch className={styles.searchIcon} />
                        <input
                            className={styles.searchInput}
                            type="text"
                            placeholder="Search by action or detail…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Date range */}
                    <div className={styles.dateGroup}>
                        <input
                            className={styles.dateInput}
                            type="date"
                            value={dateFrom}
                            onChange={e => setDateFrom(e.target.value)}
                            title="From date"
                        />
                        <span className={styles.dateSep}>–</span>
                        <input
                            className={styles.dateInput}
                            type="date"
                            value={dateTo}
                            onChange={e => setDateTo(e.target.value)}
                            title="To date"
                        />
                    </div>

                    {hasActiveFilter && (
                        <button className={styles.clearBtn} onClick={clearFilters}>
                            Clear
                        </button>
                    )}
                </div>

                {/* Category tab strip */}
                <div className={styles.categoryTabs}>
                    <FaFilter className={styles.filterTabIcon} />
                    {CATEGORIES.map(c => (
                        <button
                            key={c}
                            className={`${styles.categoryTab} ${catFilter === c ? styles.activeTab : ''}`}
                            onClick={() => setCatFilter(c)}
                        >
                            {c}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Result Count ── */}
            {!loading && (
                <p className={styles.resultCount}>
                    Showing <strong>{filtered.length}</strong> event{filtered.length !== 1 ? 's' : ''}
                    {hasActiveFilter ? ' matching your filters' : ''}
                </p>
            )}

            {/* ── Timeline ── */}
            {loading ? (
                <div className={styles.loadingState}>
                    <div className={styles.spinner} />
                    <p>Loading your activity logs…</p>
                </div>
            ) : paginated.length === 0 ? (
                <div className={styles.emptyState}>
                    <FaListUl className={styles.emptyIcon} />
                    <p>No activity found{hasActiveFilter ? ' for the selected filters' : ''}.</p>
                    {hasActiveFilter && (
                        <button
                            className={styles.clearBtn}
                            onClick={clearFilters}
                            style={{ marginTop: '12px' }}
                        >
                            Clear Filters
                        </button>
                    )}
                </div>
            ) : (
                <div className={styles.timeline}>
                    {paginated.map((log, idx) => {
                        const { icon, color } = log.meta;
                        const showDateLabel =
                            idx === 0 ||
                            paginated[idx - 1].formattedDate !== log.formattedDate;

                        return (
                            <React.Fragment key={log.id}>
                                {/* Date divider */}
                                {showDateLabel && (
                                    <div className={styles.dateDivider}>
                                        <span>{log.formattedDate}</span>
                                    </div>
                                )}

                                <div className={styles.timelineItem}>
                                    {/* Dot + connector line */}
                                    <div className={styles.timelineDotCol}>
                                        <div
                                            className={styles.timelineDot}
                                            style={{
                                                backgroundColor: color,
                                                boxShadow: `0 0 0 4px ${color}22`,
                                            }}
                                        >
                                            {icon}
                                        </div>
                                        {idx < paginated.length - 1 && (
                                            <div className={styles.timelineLine} />
                                        )}
                                    </div>

                                    {/* Content card */}
                                    <div className={styles.timelineContent}>
                                        <div className={styles.timelineHeader}>
                                            <UserAvatar
                                                user={{ name: log.user, profileImage: null }}
                                                size={30}
                                            />
                                            <div className={styles.timelineMeta}>
                                                <span className={styles.timelineUser}>
                                                    {log.user}
                                                </span>
                                                <span
                                                    className={styles.roleChip}
                                                    data-role={log.role}
                                                >
                                                    {log.role}
                                                </span>
                                            </div>
                                            <span className={styles.timelineTime}>
                                                {log.formattedTime}
                                            </span>
                                        </div>

                                        <div className={styles.timelineBody}>
                                            <span
                                                className={styles.actionChip}
                                                style={{ borderColor: color, color }}
                                            >
                                                {log.action}
                                            </span>
                                            {log.details && (
                                                <p className={styles.timelineDetails}>
                                                    {log.details}
                                                </p>
                                            )}
                                        </div>

                                        <span
                                            className={styles.categoryLabel}
                                            style={{ color }}
                                        >
                                            {log.category}
                                        </span>
                                    </div>
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>
            )}

            {/* ── Pagination ── */}
            {!loading && filtered.length > ITEMS_PER_PAGE && (
                <div className={styles.pagination}>
                    <button
                        className={styles.pageBtn}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        ← Prev
                    </button>
                    <span className={styles.pageInfo}>
                        Page {page} of {totalPages}
                    </span>
                    <button
                        className={styles.pageBtn}
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
}