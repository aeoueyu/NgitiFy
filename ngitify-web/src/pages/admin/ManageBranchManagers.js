// ngitify-web/src/pages/admin/ManageBranchManagers.js
import React, { useState, useEffect, useCallback } from 'react';
import styles from '../../styles/admin/ManageSecretaries.module.css'; // Reuse secretary styles
import { FaSearch, FaUserPlus, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import UserAvatar from '../../components/common/UserAvatar';

import UserTabs from './UserTabs';
import AddBranchManager from './AddBranchManager';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useToast } from '../../context/ToastContext';

export default function ManageBranchManagers() {
    const { addToast } = useToast();

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    const [managersList, setManagersList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState(null);

    const fetchManagers = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await authFetch('/users?role=branch-manager');
            if (response.ok) {
                const data = await response.json();
                const mapped = data
                    .filter(u => u.role === 'branch-manager')
                    .map(u => {
                        let parsedName = 'Unknown';
                        if (typeof u.name === 'object' && u.name !== null) {
                            parsedName = `${u.name.first || ''} ${u.name.last || ''}`.trim();
                        }
                        return {
                            id: u._id,
                            name: parsedName,
                            email: u.email || 'N/A',
                            status: u.status === 'active' ? 'Active' : 'Inactive',
                            isVerified: u.isVerified,
                            profileImage: u.profileImage,
                            assignedBranches: u.assignedBranches || []
                        };
                    });
                setManagersList(mapped);
            }
        } catch (error) {
            console.error('Failed to fetch branch managers:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchManagers(); }, [fetchManagers]);

    const filtered = managersList.filter(m => {
        const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              m.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'All' || m.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleToggleStatus = (manager) => {
        const newStatus = manager.status === 'Active' ? 'inactive' : 'active';
        if (newStatus === 'active' && !manager.isVerified) {
            addToast(`Cannot activate ${manager.name}. Their email is not yet verified.`, 'error');
            return;
        }
        setConfirmConfig({
            title: newStatus === 'active' ? 'Activate Account' : 'Deactivate Account',
            message: `Are you sure you want to ${newStatus === 'active' ? 'ACTIVATE' : 'DEACTIVATE'} ${manager.name}?`,
            confirmText: newStatus === 'active' ? 'Yes, Activate' : 'Yes, Deactivate',
            isDestructive: newStatus !== 'active',
            onConfirm: () => executeToggleStatus(manager.id, newStatus, manager.name),
            onCancel: () => setConfirmConfig(null)
        });
    };

    const executeToggleStatus = async (id, newStatus, name) => {
        try {
            const res = await authFetch(`/user/toggle-status/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                setManagersList(prev => prev.map(m =>
                    m.id === id ? { ...m, status: newStatus === 'active' ? 'Active' : 'Inactive' } : m
                ));
                addToast(`Successfully ${newStatus === 'active' ? 'activated' : 'deactivated'} ${name}'s account.`, 'success');
            } else {
                const data = await res.json();
                addToast(data.message || 'Failed to update status.', 'error');
            }
        } catch (error) {
            addToast('Cannot connect to server.', 'error');
        } finally {
            setConfirmConfig(null);
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Manage Branch Managers</h1>
                <p className={styles.subtitle}>View and manage branch manager accounts.</p>
            </header>

            <div className={styles.controlsRow}>
                <div className={styles.searchFilterGroup}>
                    <div className={styles.searchWrapper}>
                        <FaSearch className={styles.searchIcon} />
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            className={styles.searchInput}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <select className={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="All">All Statuses</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                    </select>
                </div>
                <button className={styles.addBtn} onClick={() => setIsAddModalOpen(true)}>
                    <FaUserPlus className={styles.btnIcon} /> Add Branch Manager
                </button>
            </div>

            <UserTabs activeTab="branch-managers" />

            <div className={styles.tableContainer}>
                <table className={styles.userTable}>
                    <thead>
                        <tr>
                            <th style={{ width: '60px', textAlign: 'center' }}>Pic</th>
                            <th>Name</th>
                            <th>Email Address</th>
                            <th>Assigned Branch</th>
                            <th style={{ width: '180px' }}>Account Status</th>
                            <th style={{ width: '80px', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="6" style={{textAlign: 'center', padding: '30px', color: '#64748b'}}>Loading records...</td></tr>
                        ) : filtered.length > 0 ? (
                            filtered.map((manager) => (
                                <tr key={manager.id} style={{ opacity: manager.status === 'Inactive' ? 0.6 : 1 }}>
                                    <td style={{ textAlign: 'center' }}>
                                        <UserAvatar user={{ name: manager.name, profileImage: manager.profileImage }} size={40} />
                                    </td>
                                    <td>
                                        <span className={styles.fwBold}>{manager.name}</span>
                                        {!manager.isVerified && <span style={{fontSize: '11px', color: '#ef4444', display: 'block', fontWeight: '500', marginTop: '2px'}}>Unverified Email</span>}
                                    </td>
                                    <td>{manager.email}</td>
                                    <td>
                                        {manager.assignedBranches.length > 0
                                            ? manager.assignedBranches.join(', ')
                                            : <span style={{ color: '#94a3b8', fontSize: '13px' }}>Not assigned</span>
                                        }
                                    </td>
                                    <td>
                                        <span className={`${styles.statusDot} ${manager.status === 'Active' ? styles.activeDot : styles.inactiveDot}`}></span>
                                        <span style={{ fontWeight: '500', color: manager.status === 'Active' ? '#15803d' : '#b91c1c' }}>{manager.status}</span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button
                                            className={styles.iconBtn}
                                            onClick={() => handleToggleStatus(manager)}
                                            title={manager.status === 'Active' ? 'Deactivate' : 'Activate'}
                                            style={{ color: manager.status === 'Inactive' ? '#22c55e' : '#94a3b8', fontSize: '20px' }}
                                        >
                                            {manager.status === 'Active' ? <FaToggleOn /> : <FaToggleOff />}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan="6" style={{textAlign: 'center', padding: '30px', color: '#64748b'}}>No branch managers found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isAddModalOpen && <AddBranchManager onClose={() => setIsAddModalOpen(false)} onSuccess={fetchManagers} />}

            <ConfirmModal
                isOpen={!!confirmConfig}
                title={confirmConfig?.title}
                message={confirmConfig?.message}
                confirmText={confirmConfig?.confirmText}
                isDestructive={confirmConfig?.isDestructive}
                onConfirm={confirmConfig?.onConfirm}
                onCancel={() => setConfirmConfig(null)}
            />
        </div>
    );
}