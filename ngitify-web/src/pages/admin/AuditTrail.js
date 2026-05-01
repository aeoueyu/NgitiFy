import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styles from '../../styles/admin/AuditTrail.module.css';
import { FaSearch, FaHistory, FaDownload, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { authFetch } from '../../utils/api'; 
import { formatDateShort, formatTime } from '../../utils/dateUtils'; // NEW: Imported Date Utilities

const formatActionLabel = (action = '') => {
    if (!action) return 'Unknown action performed';
    if (action.toUpperCase() === 'UPDATE_SURGERY_STATUS') return 'Dental Treatment';
    return action;
};

export default function AuditTrail() {
    // Original States
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    const [auditLogs, setAuditLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // NEW States: Date Filtering & Pagination
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    const fetchAuditLogs = useCallback(async () => {
        try {
            setIsLoading(true);
            
            const response = await authFetch('/audit-logs');

            if (response.ok) {
                const data = await response.json();
                
                const mappedLogs = data.map(log => {
                    let userName = 'System Generated';
                    let userRole = 'system';
                    
                    if (log.user) {
                        if (typeof log.user === 'object') {
                            const first = log.user.name?.first || log.user.firstName || '';
                            const last = log.user.name?.last || log.user.lastName || '';
                            userName = `${first} ${last}`.trim() || log.user.email || 'Unknown User';
                            userRole = log.user.role || 'system';
                        } else if (typeof log.user === 'string') {
                            userName = log.user;
                        }
                    }

                    const logDate = new Date(log.createdAt || log.timestamp);
                    // --- TASK 1.2 UPDATE: dateUtils implementation ---
                    const formattedDate = formatDateShort(logDate) !== 'N/A' ? formatDateShort(logDate) : 'Unknown Date';
                    const formattedTime = formatTime(logDate) !== 'N/A' ? formatTime(logDate) : '';

                    return {
                        id: log._id || Math.random().toString(),
                        action: formatActionLabel(log.action),
                        userName: userName,
                        role: userRole.toLowerCase(),
                        date: formattedDate,
                        time: formattedTime,
                        rawDate: logDate
                    };
                });

                mappedLogs.sort((a, b) => b.rawDate - a.rawDate);
                setAuditLogs(mappedLogs);
            } else {
                console.error("Failed to load audit logs");
            }
        } catch (error) {
            console.error("Error fetching audit logs:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAuditLogs();
    }, [fetchAuditLogs]);

    // Reset to page 1 whenever filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, roleFilter, startDate, endDate]);

    // Apply Search, Role, and Date Filters
    const filteredLogs = useMemo(() => {
        return auditLogs.filter(log => {
            const matchesSearch = 
                log.action.toLowerCase().includes(searchQuery.toLowerCase()) || 
                log.userName.toLowerCase().includes(searchQuery.toLowerCase());
                
            const matchesRole = roleFilter === 'All' || log.role === roleFilter.toLowerCase();
            
            let matchesDate = true;
            if (startDate || endDate) {
                const logTime = new Date(log.rawDate).setHours(0, 0, 0, 0);
                if (startDate) {
                    const start = new Date(startDate).setHours(0, 0, 0, 0);
                    if (logTime < start) matchesDate = false;
                }
                if (endDate) {
                    const end = new Date(endDate).setHours(23, 59, 59, 999);
                    if (logTime > end) matchesDate = false;
                }
            }
            
            return matchesSearch && matchesRole && matchesDate;
        });
    }, [auditLogs, searchQuery, roleFilter, startDate, endDate]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
    const paginatedLogs = filteredLogs.slice(
        (currentPage - 1) * itemsPerPage, 
        currentPage * itemsPerPage
    );

    // NEW: Real CSV Export Functionality
    const handleExportCSV = () => {
        if (filteredLogs.length === 0) {
            alert("No data available to export.");
            return;
        }

        const headers = ["Date", "Time", "User", "Role", "Action Performed"];
        const csvRows = [headers.join(',')];

        filteredLogs.forEach(log => {
            // Wrap action in quotes to handle commas within the text safely
            const safeAction = `"${log.action.replace(/"/g, '""')}"`;
            const row = [
                log.date,
                log.time,
                log.userName,
                log.role,
                safeAction
            ];
            csvRows.push(row.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        
        const timestamp = new Date().toISOString().slice(0, 10);
        
        link.setAttribute("href", url);
        link.setAttribute("download", `System_Audit_Logs_${timestamp}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getRoleBadgeClass = (role) => {
        switch(role) {
            case 'administrator': return styles.roleAdmin;
            case 'co-administrator': return styles.roleAdmin;
            case 'branch-manager': return styles.roleAdmin;
            case 'dentist': return styles.roleDentist;
            case 'secretary': return styles.roleSecretary;
            default: return styles.roleSystem;
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>System Audit Logs</h1>
                <p className={styles.subtitle}>View a chronological history of all user actions and system changes.</p>
            </header>

            <div className={styles.controlsRow}>
                <div className={styles.searchFilterGroup}>
                    <div className={styles.searchWrapper}>
                        <FaSearch className={styles.searchIcon} />
                        <input 
                            type="text" 
                            placeholder="Search by action or user..." 
                            className={styles.searchInput} 
                            value={searchQuery} 
                            onChange={(e) => setSearchQuery(e.target.value)} 
                        />
                    </div>
                    
                    <select 
                        className={styles.filterSelect}
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                    >
                        <option value="All">All Roles</option>
                        <option value="administrator">Administrator</option>
                        <option value="co-administrator">Co-Administrator</option>
                        <option value="branch-manager">Branch Manager</option>
                        <option value="dentist">Dentists</option>
                        <option value="secretary">Secretaries</option>
                        <option value="system">System</option>
                    </select>

                    <div className={styles.dateFilterWrapper}>
                        <input 
                            type="date" 
                            className={styles.dateInput} 
                            value={startDate} 
                            onChange={(e) => setStartDate(e.target.value)}
                            title="Start Date"
                        />
                        <span className={styles.dateSeparator}>-</span>
                        <input 
                            type="date" 
                            className={styles.dateInput} 
                            value={endDate} 
                            onChange={(e) => setEndDate(e.target.value)}
                            title="End Date"
                        />
                    </div>
                </div>
                
                <button className={styles.exportBtn} onClick={handleExportCSV}>
                    <FaDownload style={{ fontSize: '14px' }} /> Export CSV
                </button>
            </div>

            <div className={styles.tableContainer}>
                <table className={styles.userTable}>
                    <thead>
                        <tr>
                            <th>Date & Time</th>
                            <th>User</th>
                            <th>Role</th>
                            <th>Action Performed</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="4" style={{textAlign: 'center', padding: '40px', color: '#01538b'}}>Fetching system logs...</td></tr>
                        ) : paginatedLogs.length > 0 ? (
                            paginatedLogs.map((log) => (
                                <tr key={log.id}>
                                    <td>
                                        <span className={styles.fwBold}>{log.date}</span><br />
                                        <span className={styles.timeText}>{log.time}</span>
                                    </td>
                                    <td style={{ color: '#334155', fontWeight: '500' }}>
                                        {log.userName}
                                    </td>
                                    <td>
                                        <span className={`${styles.roleBadge} ${getRoleBadgeClass(log.role)}`}>
                                            {log.role}
                                        </span>
                                    </td>
                                    <td className={styles.actionText}>
                                        {log.action}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="4" style={{textAlign: 'center', padding: '50px', color: '#64748b'}}>
                                    <FaHistory style={{ fontSize: '24px', color: '#cbd5e1', marginBottom: '10px', display: 'block', margin: '0 auto' }} />
                                    No audit logs match your current filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {!isLoading && filteredLogs.length > 0 && (
                <div className={styles.paginationContainer}>
                    <span className={styles.paginationText}>
                        Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length} entries
                    </span>
                    <div className={styles.paginationControls}>
                        <button 
                            className={styles.pageBtn} 
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            <FaChevronLeft /> Prev
                        </button>
                        <span className={styles.pageIndicator}>Page {currentPage} of {totalPages}</span>
                        <button 
                            className={styles.pageBtn} 
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                        >
                            Next <FaChevronRight />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
