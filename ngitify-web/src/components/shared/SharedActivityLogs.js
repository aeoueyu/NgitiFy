import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaDownload, FaFilter, FaSearch, FaTimes } from 'react-icons/fa';
import UserAvatar from '../common/UserAvatar';
import { authFetch } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import { formatDateShort, formatTime } from '../../utils/dateUtils';
import styles from '../../styles/admin/ActivityLogs.module.css';
import tblStyles from '../../styles/wideTable.module.css';

const ITEMS_PER_PAGE = 20;

const ACTION_CATEGORIES = {
    'User Management': ['ADD_', 'CREATE_USER', 'DELETE_USER', 'ARCHIVE_USER', 'EDIT_USER', 'ROLE_', 'GRANT_'],
    Appointments: ['APPOINTMENT', 'QUEUE_', 'SURGERY'],
    Clinical: ['TREATMENT', 'ODONTOGRAM', 'RADIOGRAPH', 'EMR'],
    Inventory: ['INVENTORY', 'MATERIAL_USAGE'],
    Security: ['LOGIN', 'LOGOUT', 'PASSWORD', 'SESSION', 'TICKET', 'EMAIL_CHANGE'],
    System: ['BACKUP', 'CONFIG', 'BRANCH_', 'INTEGRITY'],
};

const ROLE_LABELS = {
    administrator: 'Administrator',
    owner: 'Owner',
    'branch-manager': 'Branch Manager',
    dentist: 'Dentist',
    secretary: 'Secretary',
    system: 'System',
};

const getCategoryForAction = (action = '') => {
    const upperAction = action.toUpperCase();
    return Object.entries(ACTION_CATEGORIES).find(([, keywords]) => (
        keywords.some((keyword) => upperAction.includes(keyword))
    ))?.[0] || 'System';
};

const formatActionLabel = (action = '') => {
    if (!action) return 'Unknown Action';
    if (action.toUpperCase() === 'UPDATE_SURGERY_STATUS') return 'Dental Treatment';
    return action;
};

const getRoleOptions = (role) => {
    if (role === 'dentist' || role === 'secretary') return [];
    if (role === 'branch-manager') return ['All', 'branch-manager', 'dentist', 'secretary', 'system'];
    return ['All', 'administrator', 'owner', 'branch-manager', 'dentist', 'secretary', 'system'];
};

const buildCsv = (rows) => {
    const headers = ['Date', 'Time', 'User', 'Role', 'Category', 'Action', 'Details'];
    const csvRows = [headers.join(',')];

    rows.forEach((row) => {
        const safeColumns = [
            row.formattedDate,
            row.formattedTime,
            row.userName,
            ROLE_LABELS[row.role] || row.role,
            row.category,
            row.action,
            row.details || '',
        ].map((value) => `"${String(value).replace(/"/g, '""')}"`);

        csvRows.push(safeColumns.join(','));
    });

    return csvRows.join('\n');
};

export default function SharedActivityLogs() {
    const { user } = useAuth();
    const role = user?.role || '';
    const isDentist = role === 'dentist';
    const isSecretary = role === 'secretary';

    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [page, setPage] = useState(1);
    const [selectedLog, setSelectedLog] = useState(null);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const userId = user?.userId || user?.id || user?._id;
            const params = new URLSearchParams({ limit: '500' });
            if ((isDentist || isSecretary) && userId) {
                params.set('userId', userId);
            }

            const response = await authFetch(`/audit-logs?${params.toString()}`);
            if (!response.ok) throw new Error('Failed to load activity logs.');

            const data = await response.json();
            const mapped = data.map((log) => {
                const timestamp = new Date(log.timestamp || log.createdAt);
                const userName = typeof log.user === 'object'
                    ? `${log.user.name?.first || ''} ${log.user.name?.last || ''}`.trim() || log.user.email || 'System'
                    : (log.user || 'System');

                return {
                    id: log._id,
                    action: formatActionLabel(log.action),
                    category: getCategoryForAction(log.action),
                    role: (log.role || 'system').toLowerCase(),
                    userName,
                    details: log.details || '',
                    timestamp,
                    formattedDate: formatDateShort(timestamp),
                    formattedTime: formatTime(timestamp),
                };
            });

            mapped.sort((left, right) => right.timestamp - left.timestamp);
            setLogs(mapped);
        } catch (error) {
            console.error('Error fetching activity logs:', error);
        } finally {
            setLoading(false);
        }
    }, [isDentist, isSecretary, user]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    useEffect(() => {
        setPage(1);
    }, [search, roleFilter, categoryFilter, dateFrom, dateTo]);

    const filteredLogs = useMemo(() => logs.filter((log) => {
        const searchValue = search.trim().toLowerCase();
        if (searchValue) {
            const matchesSearch = [log.action, log.userName, log.details, log.category]
                .some((value) => value.toLowerCase().includes(searchValue));
            if (!matchesSearch) return false;
        }

        if (roleFilter !== 'All' && log.role !== roleFilter) return false;
        if (categoryFilter !== 'All' && log.category !== categoryFilter) return false;

        if (dateFrom) {
            const fromDate = new Date(dateFrom);
            fromDate.setHours(0, 0, 0, 0);
            if (log.timestamp < fromDate) return false;
        }

        if (dateTo) {
            const toDate = new Date(dateTo);
            toDate.setHours(23, 59, 59, 999);
            if (log.timestamp > toDate) return false;
        }

        return true;
    }), [categoryFilter, dateFrom, dateTo, logs, roleFilter, search]);

    const paginatedLogs = useMemo(() => (
        filteredLogs.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
    ), [filteredLogs, page]);

    const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE));
    const roleOptions = getRoleOptions(role);
    const categories = ['All', ...Object.keys(ACTION_CATEGORIES)];
    const hasActiveFilters = Boolean(search || dateFrom || dateTo || roleFilter !== 'All' || categoryFilter !== 'All');

    const title = isDentist || isSecretary ? 'My Activity Logs' : 'Activity Logs';
    const subtitle = isDentist || isSecretary
        ? 'A compact audit trail of your recorded system actions.'
        : 'Review user actions and system events in one shared log view.';

    const handleExportCsv = () => {
        if (filteredLogs.length === 0) return;

        const csvString = buildCsv(filteredLogs);
        const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `activity_logs_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const clearFilters = () => {
        setSearch('');
        setRoleFilter('All');
        setCategoryFilter('All');
        setDateFrom('');
        setDateTo('');
    };

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>{title}</h1>
                    <p className={styles.pageSubtitle}>{subtitle}</p>
                </div>
            </div>

            <div className={styles.filtersCard}>
                <div className={styles.filtersRow}>
                    <div className={styles.searchWrapper}>
                        <FaSearch className={styles.searchIcon} />
                        <input
                            className={styles.searchInput}
                            type="text"
                            placeholder="Search by action, user, detail, or category..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>

                    {roleOptions.length > 0 && (
                        <select className={styles.select} value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                            {roleOptions.map((item) => (
                                <option key={item} value={item}>
                                    {item === 'All' ? 'All Roles' : (ROLE_LABELS[item] || item)}
                                </option>
                            ))}
                        </select>
                    )}

                    <select className={styles.select} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                        {categories.map((item) => (
                            <option key={item} value={item}>
                                {item === 'All' ? 'All Categories' : item}
                            </option>
                        ))}
                    </select>

                    <div className={styles.dateGroup}>
                        <input className={styles.dateInput} type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
                        <span className={styles.dateSep}>-</span>
                        <input className={styles.dateInput} type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
                    </div>

                    {hasActiveFilters && (
                        <button type="button" className={styles.clearBtn} onClick={clearFilters}>
                            Clear
                        </button>
                    )}
                </div>

                <div className={styles.categoryTabs}>
                    <span className={styles.filterTab}>
                        <FaFilter />
                    </span>
                    {categories.map((item) => (
                        <button
                            key={item}
                            type="button"
                            className={`${styles.filterTab} ${categoryFilter === item ? styles.activeTab : ''}`}
                            onClick={() => setCategoryFilter(item)}
                        >
                            {item}
                        </button>
                    ))}
                    <button type="button" className={styles.filterTab} onClick={handleExportCsv} disabled={filteredLogs.length === 0}>
                        <FaDownload /> Export CSV
                    </button>
                </div>
            </div>

            <div className={tblStyles.tableWrapper} style={{ marginTop: '20px' }}>
                <table className={tblStyles.table}>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>User</th>
                            <th>Role</th>
                            <th>Category</th>
                            <th>Action</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '32px' }}>Loading activity logs...</td>
                            </tr>
                        ) : paginatedLogs.length > 0 ? (
                            paginatedLogs.map((log) => (
                                <tr key={log.id} onClick={() => setSelectedLog(log)} style={{ cursor: 'pointer' }}>
                                    <td>
                                        <div style={{ fontWeight: 700 }}>{log.formattedDate}</div>
                                        <div style={{ color: '#5c7083', fontSize: '12px' }}>{log.formattedTime}</div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <UserAvatar user={{ name: log.userName }} size={34} />
                                            <div style={{ fontWeight: 700 }}>{log.userName}</div>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`${tblStyles.statusBadge} ${tblStyles.statusBlue}`}>
                                            {ROLE_LABELS[log.role] || log.role}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`${tblStyles.statusBadge} ${tblStyles.statusGray}`}>
                                            {log.category}
                                        </span>
                                    </td>
                                    <td className={tblStyles.wrapCell}>{log.action}</td>
                                    <td className={tblStyles.wrapCell}>{log.details || 'No extra details recorded.'}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                                    No activity logs match your current filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {!loading && filteredLogs.length > 0 && (
                <div className={styles.pagination}>
                    <button type="button" className={styles.filterTab} onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
                        Previous
                    </button>
                    <span style={{ color: '#4b647b', fontWeight: 700 }}>Page {page} of {totalPages}</span>
                    <button type="button" className={styles.filterTab} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>
                        Next
                    </button>
                </div>
            )}

            {selectedLog && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(15, 23, 42, 0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1100,
                        padding: '24px',
                    }}
                    onClick={() => setSelectedLog(null)}
                >
                    <div
                        style={{
                            width: 'min(680px, 100%)',
                            background: '#fff',
                            borderRadius: '18px',
                            padding: '24px',
                            boxShadow: '0 20px 40px rgba(15, 23, 42, 0.24)',
                        }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <div>
                                <h3 style={{ margin: 0, color: '#0f2c44' }}>{selectedLog.action}</h3>
                                <p style={{ margin: '6px 0 0', color: '#5c7083' }}>
                                    {selectedLog.formattedDate} at {selectedLog.formattedTime}
                                </p>
                            </div>
                            <button type="button" className={styles.clearBtn} onClick={() => setSelectedLog(null)}>
                                <FaTimes />
                            </button>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                            <div>
                                <div style={{ fontSize: '12px', fontWeight: 800, color: '#4b647b', textTransform: 'uppercase' }}>User</div>
                                <div style={{ marginTop: '6px', color: '#20384d', fontWeight: 700 }}>{selectedLog.userName}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '12px', fontWeight: 800, color: '#4b647b', textTransform: 'uppercase' }}>Role</div>
                                <div style={{ marginTop: '6px', color: '#20384d', fontWeight: 700 }}>{ROLE_LABELS[selectedLog.role] || selectedLog.role}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '12px', fontWeight: 800, color: '#4b647b', textTransform: 'uppercase' }}>Category</div>
                                <div style={{ marginTop: '6px', color: '#20384d', fontWeight: 700 }}>{selectedLog.category}</div>
                            </div>
                        </div>

                        <div>
                            <div style={{ fontSize: '12px', fontWeight: 800, color: '#4b647b', textTransform: 'uppercase', marginBottom: '8px' }}>Details</div>
                            <div style={{ color: '#20384d', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                {selectedLog.details || 'No extra details recorded.'}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
