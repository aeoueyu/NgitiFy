// ngitify-web/src/pages/admin/ActivityLogs.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    FaListUl, FaSearch, FaFilter, FaUserPlus, FaCalendarAlt,
    FaShieldAlt, FaTools, FaSignInAlt, FaSignOutAlt, FaUserEdit,
    FaTrashAlt, FaToggleOn, FaSave, FaDatabase, FaHeadset,
    FaCodeBranch, FaKey, FaClock, FaTooth, FaBoxes
} from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import { formatDateShort, formatTime } from '../../utils/dateUtils';
import UserAvatar from '../../components/common/UserAvatar';
import styles from '../../styles/admin/ActivityLogs.module.css';

// ── Action Category Map ──────────────────────────────────────────────────────

const ACTION_CATEGORIES = {
    'User Management': [
        'ADD_DENTIST', 'ADD_SECRETARY', 'ADD_PATIENT', 'ADD_BRANCH_MANAGER',
        'ADD_CO_ADMINISTRATOR', 'CREATE_USER', 'ARCHIVE_USER', 'DELETE_USER',
        'STATUS_UPDATE', 'ROLE_CHANGED', 'EDIT_USER', 'RESEND_ACTIVATION',
        'GRANT_ADMIN_ACCESS',
    ],
    Appointments: [
        'CREATE_APPOINTMENT', 'UPDATE_APPOINTMENT', 'DELETE_APPOINTMENT',
        'APPOINTMENT_STATUS_UPDATE', 'QUEUE_CREATE', 'QUEUE_UPDATE',
        'QUEUE_DELETE',
    ],
    System: [
        'CONFIG_CHANGED', 'BACKUP_CREATED', 'BRANCH_ADDED', 'BRANCH_UPDATED',
        'INTEGRITY_CHECK', 'INVENTORY_UPDATE', 'INVENTORY_ADD',
        'INVENTORY_DELETE', 'TREATMENT_LOG_ADDED', 'TREATMENT_LOG_DELETED',
        'ODONTOGRAM_UPDATED', 'RADIOGRAPH_UPLOADED', 'RADIOGRAPH_DELETED',
    ],
    Security: [
        'LOGIN', 'LOGOUT', 'PASSWORD_CHANGED', 'PASSWORD_RESET',
        'SESSION_TIMEOUT', 'TICKET_CREATED', 'TICKET_RESOLVED',
        'EMAIL_CHANGE_REQUEST',
    ],
};

// ── Icon + Color per action keyword ─────────────────────────────────────────

const getActionMeta = (action = '') => {
    const a = action.toUpperCase();

    if (a.includes('LOGIN'))    return { icon: <FaSignInAlt />,  color: '#27ae60', category: 'Security' };
    if (a.includes('LOGOUT'))   return { icon: <FaSignOutAlt />, color: '#7f8c8d', category: 'Security' };
    if (a.includes('PASSWORD') || a.includes('RESET'))
                                return { icon: <FaKey />,        color: '#e74c3c', category: 'Security' };
    if (a.includes('SESSION'))  return { icon: <FaClock />,      color: '#e74c3c', category: 'Security' };
    if (a.includes('TICKET'))   return { icon: <FaHeadset />,    color: '#8e44ad', category: 'Security' };

    if (a.includes('ADD_') || a.includes('CREATE_USER') || a.includes('RESEND'))
                                return { icon: <FaUserPlus />,   color: '#2980b9', category: 'User Management' };
    if (a.includes('ARCHIVE'))  return { icon: <FaToggleOn />,   color: '#e67e22', category: 'User Management' };
    if (a.includes('DELETE_USER') || a.includes('DELETE'))
                                return { icon: <FaTrashAlt />,   color: '#e74c3c', category: 'User Management' };
    if (a.includes('ROLE') || a.includes('GRANT'))
                                return { icon: <FaShieldAlt />,  color: '#9b59b6', category: 'User Management' };
    if (a.includes('EDIT_USER') || a.includes('STATUS'))
                                return { icon: <FaUserEdit />,   color: '#3498db', category: 'User Management' };

    if (a.includes('APPOINTMENT') || a.includes('SURGERY'))
                                return { icon: <FaCalendarAlt />,color: '#1abc9c', category: 'Appointments' };
    if (a.includes('QUEUE'))    return { icon: <FaListUl />,     color: '#16a085', category: 'Appointments' };

    if (a.includes('BACKUP'))   return { icon: <FaDatabase />,   color: '#2c3e50', category: 'System' };
    if (a.includes('CONFIG') || a.includes('SYSTEM'))
                                return { icon: <FaTools />,      color: '#7f8c8d', category: 'System' };
    if (a.includes('BRANCH'))   return { icon: <FaCodeBranch />, color: '#2980b9', category: 'System' };
    if (a.includes('INVENTORY')) return { icon: <FaBoxes />,     color: '#e67e22', category: 'System' };
    if (a.includes('TREATMENT') || a.includes('ODONTOGRAM') || a.includes('RADIOGRAPH'))
                                return { icon: <FaTooth />,      color: '#1abc9c', category: 'System' };
    if (a.includes('SAVE') || a.includes('UPDATE') || a.includes('EDIT'))
                                return { icon: <FaSave />,       color: '#3498db', category: 'System' };

    return { icon: <FaShieldAlt />, color: '#95a5a6', category: 'System' };
};

const getCategoryForAction = (action = '') => {
    const a = action.toUpperCase();
    for (const [cat, keywords] of Object.entries(ACTION_CATEGORIES)) {
        if (keywords.some(k => a.includes(k))) return cat;
    }
    return getActionMeta(action).category;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const ROLES = ['All', 'administrator', 'co-administrator', 'branch-manager', 'dentist', 'secretary', 'system'];
const CATEGORIES = ['All', 'User Management', 'Appointments', 'System', 'Security'];
const ITEMS_PER_PAGE = 20;

// ── Main Component ───────────────────────────────────────────────────────────

export default function ActivityLogs() {
    const [logs, setLogs]               = useState([]);
    const [loading, setLoading]         = useState(true);

    // Filters
    const [search, setSearch]           = useState('');
    const [roleFilter, setRoleFilter]   = useState('All');
    const [catFilter, setCatFilter]     = useState('All');
    const [dateFrom, setDateFrom]       = useState('');
    const [dateTo, setDateTo]           = useState('');

    // Pagination
    const [page, setPage]               = useState(1);

    // Detect branch manager to scope the UI
    const { user } = useAuth ? useAuth() : { user: null };
    const isBranchManager = user?.role === 'branch-manager';

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch('/audit-logs');
            if (res.ok) {
                const data = await res.json();
                const mapped = data.map(log => {
                    const date = new Date(log.timestamp || log.createdAt);
                    return {
                        id:       log._id,
                        action:   log.action || 'Unknown Action',
                        user:     log.user   || 'System',
                        role:     (log.role  || 'system').toLowerCase(),
                        details:  log.details || '',
                        date,
                        formattedDate: formatDateShort(date),
                        formattedTime: formatTime(date),
                        category: getCategoryForAction(log.action),
                        meta:     getActionMeta(log.action),
                    };
                });
                // newest first
                mapped.sort((a, b) => b.date - a.date);
                setLogs(mapped);
            }
        } catch (err) {
            console.error('Error fetching activity logs:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    // Reset page when filters change
    useEffect(() => { setPage(1); }, [search, roleFilter, catFilter, dateFrom, dateTo]);

    const filtered = useMemo(() => {
        return logs.filter(log => {
            const q = search.toLowerCase();
            if (q && !log.action.toLowerCase().includes(q) &&
                     !log.user.toLowerCase().includes(q) &&
                     !log.details.toLowerCase().includes(q)) return false;
            if (roleFilter !== 'All' && log.role !== roleFilter) return false;
            if (catFilter  !== 'All' && log.category !== catFilter) return false;
            if (dateFrom) {
                const from = new Date(dateFrom).setHours(0, 0, 0, 0);
                if (log.date < from) return false;
            }
            if (dateTo) {
                const to = new Date(dateTo).setHours(23, 59, 59, 999);
                if (log.date > to) return false;
            }
            return true;
        });
    }, [logs, search, roleFilter, catFilter, dateFrom, dateTo]);

    const totalPages   = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const paginated    = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    const clearFilters = () => {
        setSearch('');
        setRoleFilter('All');
        setCatFilter('All');
        setDateFrom('');
        setDateTo('');
    };

    const hasActiveFilter = search || roleFilter !== 'All' || catFilter !== 'All' || dateFrom || dateTo;

    return (
        <div className={styles.container}>
            {/* ── Page Header ── */}
            <div className={styles.pageHeader}>
                <FaListUl className={styles.headerIcon} />
                <div>
                    <h1 className={styles.pageTitle}>Activity Logs</h1>
                    <p className={styles.pageSubtitle}>
                        A human-readable timeline of all system events and user actions.
                    </p>
                </div>
            </div>

            {/* ── Filters ── */}
            <div className={styles.filtersCard}>
                <div className={styles.filtersRow}>
                    <div className={styles.searchWrapper}>
                        <FaSearch className={styles.searchIcon} />
                        <input
                            className={styles.searchInput}
                            type="text"
                            placeholder="Search by action, user, or detail..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>
                    {!isBranchManager && (
                        <select
                            className={styles.select}
                            value={roleFilter}
                            onChange={e => setRoleFilter(e.target.value)}
                        >
                            {ROLES.map(r => (
                                <option key={r} value={r}>
                                    {r === 'All' ? 'All Roles' : r}
                                </option>
                            ))}
                        </select>
                    )}

                    <select
                        className={styles.select}
                        value={catFilter}
                        onChange={e => setCatFilter(e.target.value)}
                    >
                        {CATEGORIES.map(c => (
                            <option key={c} value={c}>
                                {c === 'All' ? 'All Categories' : c}
                            </option>
                        ))}
                    </select>

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

            {/* ── Results Count ── */}
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
                    <p>Loading activity logs...</p>
                </div>
            ) : paginated.length === 0 ? (
                <div className={styles.emptyState}>
                    <FaListUl className={styles.emptyIcon} />
                    <p>No activity found for the selected filters.</p>
                    {hasActiveFilter && (
                        <button className={styles.clearBtn} onClick={clearFilters}>
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
                                {showDateLabel && (
                                    <div className={styles.dateDivider}>
                                        <span>{log.formattedDate}</span>
                                    </div>
                                )}

                                <div className={styles.timelineItem}>
                                    {/* Dot + Line */}
                                    <div className={styles.timelineDotCol}>
                                        <div
                                            className={styles.timelineDot}
                                            style={{ backgroundColor: color, boxShadow: `0 0 0 4px ${color}22` }}
                                        >
                                            {icon}
                                        </div>
                                        {idx < paginated.length - 1 && (
                                            <div className={styles.timelineLine} />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className={styles.timelineContent}>
                                        <div className={styles.timelineHeader}>
                                            <UserAvatar
                                                user={{ name: log.user, profileImage: null }}
                                                size={30}
                                            />
                                            <div className={styles.timelineMeta}>
                                                <span className={styles.timelineUser}>{log.user}</span>
                                                <span
                                                    className={styles.roleChip}
                                                    data-role={log.role}
                                                >
                                                    {log.role}
                                                </span>
                                            </div>
                                            <span className={styles.timelineTime}>{log.formattedTime}</span>
                                        </div>

                                        <div className={styles.timelineBody}>
                                            <span
                                                className={styles.actionChip}
                                                style={{ borderColor: color, color }}
                                            >
                                                {log.action}
                                            </span>
                                            {log.details && (
                                                <p className={styles.timelineDetails}>{log.details}</p>
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
                    <span className={styles.pageInfo}>Page {page} of {totalPages}</span>
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