import React, { useState, useEffect, useCallback } from 'react';
import styles from '../../styles/owner/SystemAuditLogs.module.css'; 
import { FaSearch, FaHistory, FaDownload } from 'react-icons/fa';

export default function SystemAuditLogs() {
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('All');
    const [auditLogs, setAuditLogs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchAuditLogs = useCallback(async () => {
        try {
            setIsLoading(true);
            const token = localStorage.getItem('token');
            // Ensure this endpoint exists in your Monorepo backend!
            const response = await fetch('http://localhost:5000/api/audit-logs', {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                
                // Map the data to ensure frontend stability even if some fields are missing
                const mappedLogs = data.map(log => {
                    // Handle nested user objects or string fallbacks
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

                    // Format Date
                    const logDate = new Date(log.createdAt || log.timestamp);
                    const formattedDate = !isNaN(logDate) 
                        ? logDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                        : 'Unknown Date';
                    const formattedTime = !isNaN(logDate)
                        ? logDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                        : '';

                    return {
                        id: log._id || Math.random().toString(),
                        action: log.action || 'Unknown action performed',
                        userName: userName,
                        role: userRole.toLowerCase(),
                        date: formattedDate,
                        time: formattedTime,
                        rawDate: logDate // kept for sorting if needed
                    };
                });

                // Sort newest first
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

    // Apply Search and Role Filters
    const filteredLogs = auditLogs.filter(log => {
        const matchesSearch = 
            log.action.toLowerCase().includes(searchQuery.toLowerCase()) || 
            log.userName.toLowerCase().includes(searchQuery.toLowerCase());
            
        const matchesRole = roleFilter === 'All' || log.role === roleFilter.toLowerCase();
        
        return matchesSearch && matchesRole;
    });

    // Helper for Role Badge styling
    const getRoleBadgeClass = (role) => {
        switch(role) {
            case 'owner': return styles.roleOwner;
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
                            placeholder="Search by action or user name..." 
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
                        <option value="owner">Owner</option>
                        <option value="dentist">Dentists</option>
                        <option value="secretary">Secretaries</option>
                        <option value="system">System</option>
                    </select>
                </div>
                
                <button className={styles.exportBtn} onClick={() => alert("Export functionality coming soon!")}>
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
                        ) : filteredLogs.length > 0 ? (
                            filteredLogs.map((log) => (
                                <tr key={log.id}>
                                    <td>
                                        <span className={styles.fwBold}>{log.date}</span>
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
        </div>
    );
}