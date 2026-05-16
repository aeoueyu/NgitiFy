import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaDownload, FaFilter, FaSearch } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { formatDateShort, formatTime } from '../../utils/dateUtils';
import scheduleStyles from '../../styles/shared/SchedulePage.module.css';
import wideTable from '../../styles/wideTable.module.css';

const RANGE_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'today', label: 'Today' },
    { value: '3days', label: '3 Days' },
    { value: '7days', label: '7 Days' },
    { value: 'custom', label: 'Custom' },
];

const ACTION_OPTIONS = [
    { value: 'All', label: 'All Actions' },
    { value: 'entry', label: 'Entry Logs' },
    { value: 'lifecycle', label: 'Lifecycle Actions' },
    { value: 'status', label: 'Status Changes' },
    { value: 'archive', label: 'Archive / Restore' },
    { value: 'delete', label: 'Permanent Delete' },
];
const ITEMS_PER_PAGE = 20;
const ENTRY_ACTIONS = new Set(['LOGIN', 'LOGOUT', 'SESSION_TIMEOUT']);
const ARCHIVE_ACTIONS = new Set(['ARCHIVE_USER', 'RESTORE_USER', 'ARCHIVE_PATIENT', 'RESTORE_PATIENT']);
const LIFECYCLE_ACTIONS = new Set([...ENTRY_ACTIONS, 'STATUS_CHANGE', ...ARCHIVE_ACTIONS, 'DELETE_USER']);

const ROLE_LABELS = {
    administrator: 'Administrator',
    owner: 'Owner',
    'branch-manager': 'Branch Manager',
    dentist: 'Dentist',
    secretary: 'Secretary',
    patient: 'Patient',
    guest: 'Guest',
    system: 'System',
};

const getAuditLogRole = (log = {}) => {
    const objectUserRole = typeof log.user === 'object' ? log.user?.role : '';
    return String(log.actorRole || log.role || objectUserRole || 'system').trim().toLowerCase();
};

const formatActionLabel = (action = '') => {
    const rawAction = String(action || '').trim().toUpperCase();
    if (!rawAction) return 'Unknown action performed';
    if (rawAction === 'UPDATE_SURGERY_STATUS') return 'Dental Treatment';
    if (rawAction === 'UPDATE_SCHEDULE') return 'Update Schedule';
    return rawAction
        .toLowerCase()
        .split('_')
        .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
        .join(' ');
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
        case 'patient':
            return wideTable.statusBlue;
        default:
            return wideTable.statusGray;
    }
};

const getActionCategory = (rawAction = '') => {
    const normalized = String(rawAction || '').trim().toUpperCase();
    if (ENTRY_ACTIONS.has(normalized)) return 'entry';
    if (normalized === 'STATUS_CHANGE') return 'status';
    if (ARCHIVE_ACTIONS.has(normalized)) return 'archive';
    if (normalized === 'DELETE_USER') return 'delete';
    if (LIFECYCLE_ACTIONS.has(normalized)) return 'lifecycle';
    return 'other';
};

const matchesActionFilter = (rawAction = '', actionFilter = 'All') => {
    if (actionFilter === 'All') return true;
    const category = getActionCategory(rawAction);
    if (actionFilter === 'entry') return category === 'entry';
    if (actionFilter === 'status') return category === 'status';
    if (actionFilter === 'archive') return category === 'archive';
    if (actionFilter === 'delete') return category === 'delete';
    if (actionFilter === 'lifecycle') return ['entry', 'status', 'archive', 'delete', 'lifecycle'].includes(category) && category !== 'other';
    return false;
};

const getActionBadgeClass = (rawAction = '') => {
    const category = getActionCategory(rawAction);
    if (category === 'entry') return wideTable.statusBlue;
    if (category === 'status') return wideTable.statusAmber;
    if (category === 'archive') return wideTable.statusGray;
    if (category === 'delete') return wideTable.statusRed;
    return wideTable.statusGreen;
};

export default function AuditTrail() {
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    const [actionFilter, setActionFilter] = useState('All');
    const [auditLogs, setAuditLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [rangeFilter, setRangeFilter] = useState('all');
    const [customFrom, setCustomFrom] = useState(getTodayString());
    const [customTo, setCustomTo] = useState(getTodayString());
    const [page, setPage] = useState(1);

    const fetchAuditLogs = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await authFetch('/audit-logs');
            if (!response.ok) return;

            const data = await response.json();
            const mappedLogs = data.map((log) => {
                let userName = 'System Generated';
                const userRole = getAuditLogRole(log);

                if (log.user) {
                    if (typeof log.user === 'object') {
                        const first = log.user.name?.first || log.user.firstName || '';
                        const last = log.user.name?.last || log.user.lastName || '';
                        userName = `${first} ${last}`.trim() || log.user.email || 'Unknown User';
                    } else if (typeof log.user === 'string') {
                        userName = log.user;
                    }
                }

                const rawDate = new Date(log.createdAt || log.timestamp);
                return {
                    id: log._id || Math.random().toString(),
                    rawAction: String(log.action || '').trim().toUpperCase(),
                    action: formatActionLabel(log.action),
                    userName,
                    role: userRole.toLowerCase(),
                    date: formatDateShort(rawDate) !== 'N/A' ? formatDateShort(rawDate) : 'Unknown Date',
                    time: formatTime(rawDate) !== 'N/A' ? formatTime(rawDate) : '',
                    rawDate,
                    details: log.details || '',
                };
            });

            mappedLogs.sort((a, b) => b.rawDate - a.rawDate);
            setAuditLogs(mappedLogs);
        } catch (error) {
            console.error('Error fetching audit logs:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAuditLogs();
    }, [fetchAuditLogs]);

    const selectedRange = useMemo(
        () => getDateRange(rangeFilter, customFrom, customTo),
        [rangeFilter, customFrom, customTo]
    );

    const filteredLogs = useMemo(() => auditLogs.filter((log) => {
        const matchesSearch = !searchQuery.trim()
            || log.action.toLowerCase().includes(searchQuery.toLowerCase())
            || log.userName.toLowerCase().includes(searchQuery.toLowerCase())
            || String(log.details || '').toLowerCase().includes(searchQuery.toLowerCase());

        const matchesRole = roleFilter === 'All' || log.role === roleFilter.toLowerCase();
        const matchesAction = matchesActionFilter(log.rawAction, actionFilter);
        const dateKey = Number.isNaN(log.rawDate.getTime()) ? '' : log.rawDate.toISOString().split('T')[0];
        const matchesDate = !selectedRange || (dateKey >= selectedRange.from && dateKey <= selectedRange.to);

        return matchesSearch && matchesRole && matchesAction && matchesDate;
    }), [actionFilter, auditLogs, roleFilter, searchQuery, selectedRange]);

    useEffect(() => {
        setPage(1);
    }, [actionFilter, customFrom, customTo, rangeFilter, roleFilter, searchQuery]);

    const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE));
    const paginatedLogs = useMemo(
        () => filteredLogs.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
        [filteredLogs, page]
    );

    useEffect(() => {
        setPage((current) => Math.min(current, totalPages));
    }, [totalPages]);

    const handleExportCSV = () => {
        if (filteredLogs.length === 0) return;

        const headers = ['Date', 'Time', 'User', 'Role', 'Action', 'Details'];
        const csvRows = [headers.join(',')];
        filteredLogs.forEach((log) => {
            const row = [
                log.date,
                log.time,
                log.userName,
                log.role,
                `"${String(log.action).replace(/"/g, '""')}"`,
                `"${String(log.details || '').replace(/"/g, '""')}"`,
            ];
            csvRows.push(row.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([`\uFEFF${csvString}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        const timestamp = new Date().toISOString().slice(0, 10);
        link.setAttribute('href', url);
        link.setAttribute('download', `System_Audit_Logs_${timestamp}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className={scheduleStyles.page}>
            <div className={scheduleStyles.headerRow}>
                <div>
                    <h1 className={scheduleStyles.pageTitle}>System Audit Logs</h1>
                    <p className={scheduleStyles.pageSubtitle}>View a chronological history of all user actions and system changes.</p>
                </div>
                <button className={scheduleStyles.secondaryButton} onClick={handleExportCSV} disabled={filteredLogs.length === 0}>
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
                            placeholder="Search by action, user, or details..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
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
                        <select
                            className={scheduleStyles.filterSelect}
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                        >
                            <option value="All">All Roles</option>
                            <option value="administrator">Administrator</option>
                            <option value="owner">Owner</option>
                            <option value="branch-manager">Branch Manager</option>
                            <option value="dentist">Dentists</option>
                            <option value="secretary">Secretaries</option>
                            <option value="patient">Patients</option>
                            <option value="system">System</option>
                        </select>
                    </div>

                    <div className={scheduleStyles.filterSelectWrap}>
                        <FaFilter className={scheduleStyles.filterIcon} />
                        <select
                            className={scheduleStyles.filterSelect}
                            value={actionFilter}
                            onChange={(e) => setActionFilter(e.target.value)}
                        >
                            {ACTION_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className={`${scheduleStyles.tableContainer} ${wideTable.tableWrapper}`}>
                <table className={wideTable.table}>
                    <thead>
                        <tr>
                            <th style={{ minWidth: '170px' }}>Date</th>
                            <th style={{ minWidth: '220px' }}>User</th>
                            <th style={{ minWidth: '170px' }}>Role</th>
                            <th style={{ minWidth: '220px' }}>Action</th>
                            <th style={{ minWidth: '420px' }}>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan="5" className={scheduleStyles.stateBlock}>Fetching system logs...</td>
                            </tr>
                        ) : paginatedLogs.length > 0 ? (
                            paginatedLogs.map((log) => (
                                <tr key={log.id}>
                                    <td>
                                        <div className={scheduleStyles.patientCell}>
                                            <strong>{log.date}</strong>
                                            <span>{log.time}</span>
                                        </div>
                                    </td>
                                    <td title={log.userName}>{log.userName}</td>
                                    <td>
                                        <span className={`${wideTable.statusBadge} ${getRoleBadgeClass(log.role)}`}>
                                            {ROLE_LABELS[log.role] || log.role}
                                        </span>
                                    </td>
                                    <td title={log.action}>
                                        <span className={`${wideTable.statusBadge} ${getActionBadgeClass(log.rawAction)}`}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td title={log.details || 'No extra details recorded.'}>{log.details || 'No extra details recorded.'}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="5" className={scheduleStyles.emptyStateBox}>
                                    No audit logs match the current filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {!isLoading && filteredLogs.length > 0 && (
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
