import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaDownload, FaFilter, FaSearch } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import { formatDateShort, formatTime } from '../../utils/dateUtils';
import LogDetailsModal from './LogDetailsModal';
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
    Appointments: ['APPOINTMENT', 'QUEUE_', 'SURGERY', 'SCHEDULE'],
    Clinical: ['TREATMENT', 'ODONTOGRAM', 'RADIOGRAPH', 'EMR'],
    Inventory: ['INVENTORY', 'MATERIAL_USAGE'],
    Security: ['LOGIN', 'LOGOUT', 'PASSWORD', 'SESSION', 'TICKET', 'EMAIL_CHANGE'],
    System: ['BACKUP', 'CONFIG', 'BRANCH_', 'INTEGRITY'],
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
    if (action.toUpperCase() === 'UPDATE_SCHEDULE') return 'Update Schedule';
    return action;
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
    const headers = ['Date', 'Time', 'Category', 'Action', 'Details'];
    const csvRows = [headers.join(',')];

    rows.forEach((row) => {
        const safeColumns = [
            row.formattedDate,
            row.formattedTime,
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
        case 'patient':
            return wideTable.statusBlue;
        case 'secretary':
            return wideTable.statusGray;
        default:
            return wideTable.statusGray;
    }
};

export default function SharedActivityLogs() {
    const { user } = useAuth();
    const role = user?.role || '';
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [rangeFilter, setRangeFilter] = useState('all');
    const [customFrom, setCustomFrom] = useState(getTodayString());
    const [customTo, setCustomTo] = useState(getTodayString());
    const [page, setPage] = useState(1);
    const [selectedLog, setSelectedLog] = useState(null);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            const userId = user?.userId || user?.id || user?._id;
            let response;

            if (role === 'patient') {
                response = await authFetch('/activity-logs/patient');
            } else {
                const params = new URLSearchParams({ limit: '500' });
                if (userId) {
                    params.set('userId', userId);
                }
                response = await authFetch(`/audit-logs?${params.toString()}`);
            }

            if (!response.ok) throw new Error('Failed to load activity logs.');

            const data = await response.json();
            const mapped = data.map((log) => {
                const timestamp = new Date(log.timestamp || log.createdAt);

                return {
                    id: log._id,
                    action: formatActionLabel(log.action),
                    category: getCategoryForAction(log.action),
                    role: (log.role || 'system').toLowerCase(),
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
    }, [role, user]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    useEffect(() => {
        setPage(1);
    }, [search, categoryFilter, rangeFilter, customFrom, customTo]);

    const selectedRange = useMemo(
        () => getDateRange(rangeFilter, customFrom, customTo),
        [rangeFilter, customFrom, customTo]
    );

    const filteredLogs = useMemo(() => logs.filter((log) => {
        const searchValue = search.trim().toLowerCase();
        if (searchValue) {
            const matchesSearch = [log.action, log.details, log.category]
                .some((value) => String(value || '').toLowerCase().includes(searchValue));
            if (!matchesSearch) return false;
        }

        if (categoryFilter !== 'All' && log.category !== categoryFilter) return false;

        const dateKey = log.timestamp.toISOString().split('T')[0];
        return !selectedRange || (dateKey >= selectedRange.from && dateKey <= selectedRange.to);
    }), [categoryFilter, logs, search, selectedRange]);

    const paginatedLogs = useMemo(() => (
        filteredLogs.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)
    ), [filteredLogs, page]);

    const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE));
    const categories = ['All', ...Object.keys(ACTION_CATEGORIES)];
    const title = 'My Activity Logs';
    const subtitle = 'Review only the actions recorded under your own account.';

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
                            placeholder="Search action, detail, or category..."
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

            <div className={`${scheduleStyles.tableContainer} ${wideTable.tableWrapper}`} style={{ overflowX: 'auto', overflowY: 'hidden' }}>
                <table className={wideTable.table} style={{ '--wide-table-min-width': '980px' }}>
                    <thead>
                        <tr>
                            <th style={{ minWidth: '190px' }}>Date</th>
                            <th style={{ minWidth: '260px' }}>Action</th>
                            <th style={{ minWidth: '220px' }}>Category</th>
                            <th style={{ minWidth: '180px' }}>View Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="4" className={scheduleStyles.stateBlock}>Loading activity logs...</td>
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
                                    <td>
                                        <span className={`${wideTable.statusBadge} ${getRoleBadgeClass(log.role)}`}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td title={log.category}>{log.category}</td>
                                    <td>
                                        <button
                                            type="button"
                                            className={scheduleStyles.secondaryButton}
                                            style={{ padding: '8px 12px', fontSize: '12px' }}
                                            onClick={() => setSelectedLog(log)}
                                        >
                                            View Details
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="4" className={scheduleStyles.emptyStateBox}>
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

            <LogDetailsModal
                isOpen={Boolean(selectedLog)}
                onClose={() => setSelectedLog(null)}
                title="Activity Log Details"
                subtitle="Review the complete details recorded for this account action."
                summaryItems={selectedLog ? [
                    { label: 'Date', value: selectedLog.formattedDate },
                    { label: 'Time', value: selectedLog.formattedTime },
                    { label: 'Action', value: selectedLog.action },
                    { label: 'Category', value: selectedLog.category },
                ] : []}
                detailsTitle="Recorded Details"
                detailsText={selectedLog?.details}
            />
        </div>
    );
}
