import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaDownload, FaFilter, FaSearch } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import { formatDateShort, formatTime } from '../../utils/dateUtils';
import scheduleStyles from '../../styles/shared/SchedulePage.module.css';
import wideTable from '../../styles/wideTable.module.css';

const ITEMS_PER_PAGE = 20;
const RANGE_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'today', label: 'Today' },
    { value: '3days', label: '3 Days' },
    { value: '7days', label: '7 Days' },
    { value: 'custom', label: 'Custom' },
];

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

const getTodayString = () => new Date().toISOString().split('T')[0];

const addDays = (dateString, count) => {
    const date = new Date(`${dateString}T12:00:00`);
    date.setDate(date.getDate() + count);
    return date.toISOString().split('T')[0];
};

const getDateRange = (range, customFrom, customTo) => {
    const today = getTodayString();
    if (range === 'all') return null;
    if (range === '3days') return { from: addDays(today, -2), to: today };
    if (range === '7days') return { from: addDays(today, -6), to: today };
    if (range === 'custom') {
        const from = customFrom || today;
        const to = customTo || from;
        return from <= to ? { from, to } : { from: to, to: from };
    }
    return { from: today, to: today };
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

const getRoleBadgeClass = (role) => {
    switch (role) {
        case 'administrator':
            return wideTable.statusBlue;
        case 'owner':
            return wideTable.statusGreen;
        case 'branch-manager':
            return wideTable.statusAmber;
        case 'dentist':
            return wideTable.statusGreen;
        case 'secretary':
            return wideTable.statusGray;
        default:
            return wideTable.statusGray;
    }
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
    const [rangeFilter, setRangeFilter] = useState('all');
    const [customFrom, setCustomFrom] = useState(getTodayString());
    const [customTo, setCustomTo] = useState(getTodayString());
    const [page, setPage] = useState(1);

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
    }, [search, roleFilter, categoryFilter, rangeFilter, customFrom, customTo]);

    const selectedRange = useMemo(
        () => getDateRange(rangeFilter, customFrom, customTo),
        [rangeFilter, customFrom, customTo]
    );

    const filteredLogs = useMemo(() => logs.filter((log) => {
        const searchValue = search.trim().toLowerCase();
        if (searchValue) {
            const matchesSearch = [log.action, log.userName, log.details, log.category]
                .some((value) => String(value || '').toLowerCase().includes(searchValue));
            if (!matchesSearch) return false;
        }

        if (roleFilter !== 'All' && log.role !== roleFilter) return false;
        if (categoryFilter !== 'All' && log.category !== categoryFilter) return false;

        const dateKey = log.timestamp.toISOString().split('T')[0];
        return !selectedRange || (dateKey >= selectedRange.from && dateKey <= selectedRange.to);
    }), [categoryFilter, logs, roleFilter, search, selectedRange]);

    const paginatedLogs = useMemo(() => (
        filteredLogs.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
    ), [filteredLogs, page]);

    const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE));
    const roleOptions = getRoleOptions(role);
    const categories = ['All', ...Object.keys(ACTION_CATEGORIES)];
    const title = isDentist || isSecretary ? 'My Activity Logs' : 'Activity Logs';
    const subtitle = isDentist || isSecretary
        ? 'Review your recorded actions in a single shared audit table.'
        : 'Review user actions and system events in one shared tabular log view.';

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

    return (
        <div className={scheduleStyles.page}>
            <div className={scheduleStyles.headerRow}>
                <div>
                    <h1 className={scheduleStyles.pageTitle}>{title}</h1>
                    <p className={scheduleStyles.pageSubtitle}>{subtitle}</p>
                </div>
                <button type="button" className={scheduleStyles.secondaryButton} onClick={handleExportCsv} disabled={filteredLogs.length === 0}>
                    <FaDownload /> Export CSV
                </button>
            </div>

            <div className={scheduleStyles.toolbar}>
                <div className={scheduleStyles.toolbarFilters}>
                    <div className={scheduleStyles.searchWrapper}>
                        <FaSearch className={scheduleStyles.searchIcon} />
                        <input
                            className={scheduleStyles.searchInput}
                            type="text"
                            placeholder="Search action, user, detail, or category..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>

                    <div className={scheduleStyles.pillGroup}>
                        {RANGE_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={`${scheduleStyles.filterPill} ${rangeFilter === option.value ? scheduleStyles.activePill : ''}`}
                                onClick={() => setRangeFilter(option.value)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    {rangeFilter === 'custom' && (
                        <div className={scheduleStyles.customDateRange}>
                            <label className={scheduleStyles.dateField}>
                                <span>From</span>
                                <input
                                    className={scheduleStyles.formControl}
                                    type="date"
                                    value={customFrom}
                                    max={customTo || undefined}
                                    onChange={(event) => setCustomFrom(event.target.value)}
                                />
                            </label>
                            <label className={scheduleStyles.dateField}>
                                <span>To</span>
                                <input
                                    className={scheduleStyles.formControl}
                                    type="date"
                                    value={customTo}
                                    min={customFrom || undefined}
                                    onChange={(event) => setCustomTo(event.target.value)}
                                />
                            </label>
                        </div>
                    )}

                    {roleOptions.length > 0 && (
                        <div className={scheduleStyles.filterSelectWrap}>
                            <FaFilter className={scheduleStyles.filterIcon} />
                            <select className={scheduleStyles.filterSelect} value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
                                {roleOptions.map((item) => (
                                    <option key={item} value={item}>
                                        {item === 'All' ? 'All Roles' : (ROLE_LABELS[item] || item)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className={scheduleStyles.filterSelectWrap}>
                        <FaFilter className={scheduleStyles.filterIcon} />
                        <select className={scheduleStyles.filterSelect} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                            {categories.map((item) => (
                                <option key={item} value={item}>
                                    {item === 'All' ? 'All Categories' : item}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className={scheduleStyles.tableContainer}>
                <table className={wideTable.table}>
                    <thead>
                        <tr>
                            <th style={{ width: '18%' }}>Date</th>
                            <th style={{ width: '18%' }}>User</th>
                            <th style={{ width: '14%' }}>Role</th>
                            <th style={{ width: '18%' }}>Action</th>
                            <th style={{ width: '32%' }}>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="5" className={scheduleStyles.stateBlock}>Loading activity logs...</td>
                            </tr>
                        ) : paginatedLogs.length > 0 ? (
                            paginatedLogs.map((log) => (
                                <tr key={log.id}>
                                    <td title={`${log.formattedDate} ${log.formattedTime}`}>
                                        <div className={scheduleStyles.patientCell}>
                                            <strong>{log.formattedDate}</strong>
                                            <span>{log.formattedTime}</span>
                                        </div>
                                    </td>
                                    <td title={log.userName}>{log.userName}</td>
                                    <td>
                                        <span className={`${wideTable.statusBadge} ${getRoleBadgeClass(log.role)}`}>
                                            {ROLE_LABELS[log.role] || log.role}
                                        </span>
                                    </td>
                                    <td title={`${log.category} • ${log.action}`}>{log.action}</td>
                                    <td title={log.details || 'No extra details recorded.'}>{log.details || 'No extra details recorded.'}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="5" className={scheduleStyles.emptyStateBox}>
                                    No activity logs match the current filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {!loading && filteredLogs.length > 0 && (
                <div className={scheduleStyles.toolbar} style={{ marginTop: '18px' }}>
                    <div className={scheduleStyles.pageSubtitle}>
                        Showing {(page - 1) * ITEMS_PER_PAGE + 1} to {Math.min(page * ITEMS_PER_PAGE, filteredLogs.length)} of {filteredLogs.length} logs
                    </div>
                    <div className={scheduleStyles.actionRow}>
                        <button type="button" className={scheduleStyles.secondaryButton} onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
                            Previous
                        </button>
                        <button type="button" className={scheduleStyles.secondaryButton} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>
                            Next
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
