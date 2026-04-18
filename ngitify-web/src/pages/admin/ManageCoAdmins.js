// ngitify-web/src/pages/admin/ManageCoAdmins.js
import React, { useState, useEffect, useCallback } from 'react';
import styles from '../../styles/admin/ManageSecretaries.module.css'; // Reuse secretary styles
import { FaSearch, FaUserPlus, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import UserAvatar from '../../components/common/UserAvatar';

import UserTabs from './UserTabs';
import AddCoAdmin from './AddCoAdmin';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useToast } from '../../context/ToastContext';

export default function ManageCoAdmins() {
    const { addToast } = useToast();

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    const [coAdminsList, setCoAdminsList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState(null);

    const fetchCoAdmins = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await authFetch('/users?role=co-administrator');
            if (response.ok) {
                const data = await response.json();
                const mapped = data
                    .filter(u => u.role === 'co-administrator')
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
                setCoAdminsList(mapped);
            }
        } catch (error) {
            console.error('Failed to fetch co-admins:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchCoAdmins(); }, [fetchCoAdmins]);

    const filtered = coAdminsList.filter(m => {
        const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              m.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'All' || m.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const handleToggleStatus = (coAdmin) => {
        const newStatus = coAdmin.status === 'Active' ? 'inactive' : 'active';
        if (newStatus === 'active' && !coAdmin.isVerified) {
            addToast(`Cannot activate ${coAdmin.name}. Their email is not yet verified.`, 'error');
            return;
        }
        setConfirmConfig({
            title: newStatus === 'active' ? 'Activate Account' : 'Deactivate Account',
            message: `Are you sure you want to ${newStatus === 'active' ? 'ACTIVATE' : 'DEACTIVATE'} ${coAdmin.name}?`,
            confirmText: newStatus === 'active' ? 'Yes, Activate' : 'Yes, Deactivate',
            isDestructive: newStatus !== 'active',
            onConfirm: () => executeToggleStatus(coAdmin.id, newStatus, coAdmin.name),
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
                setCoAdminsList(prev => prev.map(m =>
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
                <h1 className={styles.title}>Manage Co-Administrators</h1>
                <p className={styles.subtitle}>View and manage co-administrator accounts.</p>
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
                    <FaUserPlus className={styles.btnIcon} /> Add Co-Admin
                </button>
            </div>

            <UserTabs activeTab="co-admins" />

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
                            filtered.map((coAdmin) => (
                                <tr key={coAdmin.id} style={{ opacity: coAdmin.status === 'Inactive' ? 0.6 : 1 }}>
                                    <td style={{ textAlign: 'center' }}>
                                        <UserAvatar user={{ name: coAdmin.name, profileImage: coAdmin.profileImage }} size={40} />
                                    </td>
                                    <td>
                                        <span className={styles.fwBold}>{coAdmin.name}</span>
                                        {!coAdmin.isVerified && <span style={{fontSize: '11px', color: '#ef4444', display: 'block', fontWeight: '500', marginTop: '2px'}}>Unverified Email</span>}
                                    </td>
                                    <td>{coAdmin.email}</td>
                                    <td>
                                        {coAdmin.assignedBranches.length > 0
                                            ? coAdmin.assignedBranches.join(', ')
                                            : <span style={{ color: '#94a3b8', fontSize: '13px' }}>Not assigned</span>
                                        }
                                    </td>
                                    <td>
                                        <span className={`${styles.statusDot} ${coAdmin.status === 'Active' ? styles.activeDot : styles.inactiveDot}`}></span>
                                        <span style={{ fontWeight: '500', color: coAdmin.status === 'Active' ? '#15803d' : '#b91c1c' }}>{coAdmin.status}</span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button
                                            className={styles.iconBtn}
                                            onClick={() => handleToggleStatus(coAdmin)}
                                            title={coAdmin.status === 'Active' ? 'Deactivate' : 'Activate'}
                                            style={{ color: coAdmin.status === 'Inactive' ? '#22c55e' : '#94a3b8', fontSize: '20px' }}
                                        >
                                            {coAdmin.status === 'Active' ? <FaToggleOn /> : <FaToggleOff />}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan="6" style={{textAlign: 'center', padding: '30px', color: '#64748b'}}>No co-admins found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isAddModalOpen && <AddCoAdmin onClose={() => setIsAddModalOpen(false)} onSuccess={fetchCoAdmins} />}

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