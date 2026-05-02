// ngitify-web/src/pages/admin/ManageDentists.js
import React, { useState, useEffect, useCallback } from 'react';
import styles from '../../styles/admin/ManageDentists.module.css';
import tblStyles from '../../styles/wideTable.module.css';
import { FaSearch, FaUserPlus, FaEdit, FaEye, FaToggleOn, FaToggleOff, FaEnvelope } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import UserAvatar from '../../components/common/UserAvatar';

import UserTabs from './UserTabs';
import AddDentist from './AddDentist';
import EditDentist from './EditDentist';
import ViewDentist from './ViewDentist';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useToast } from '../../context/ToastContext';

export default function ManageDentists() {
    const { addToast } = useToast();
    const { user } = useAuth();
    const isBranchManager = user?.role === 'branch-manager';

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [verifiedFilter, setVerifiedFilter] = useState('All');
    const [branchFilter, setBranchFilter] = useState('All');

    const [dentistsList, setDentistsList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedDentistId, setSelectedDentistId] = useState(null);

    const [confirmConfig, setConfirmConfig] = useState(null);

    const fetchDentists = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await authFetch('/users?role=dentist');
            if (response.ok) {
                const data = await response.json();
                const mappedDentists = data
                    .filter(u => u.role === 'dentist')
                    .map(u => {
                        let parsedName = 'Unknown Dentist';
                        if (typeof u.name === 'object' && u.name !== null) {
                            parsedName = `${u.name.first || ''} ${u.name.last || ''}`.trim();
                        } else if (u.firstName) {
                            parsedName = `${u.firstName} ${u.lastName || ''}`.trim();
                        } else if (typeof u.name === 'string') {
                            parsedName = u.name;
                        }
                        return {
                            id: u._id,
                            name: parsedName,
                            email: u.email || 'N/A',
                            status: u.status === 'active' ? 'Active' : 'Inactive',
                            isVerified: u.isVerified,
                            profileImage: u.profileImage,
                            // ✅ PHASE 2: Branch assignment
                            assignedBranches: u.assignedBranches || []
                        };
                    });
                setDentistsList(mappedDentists);
            }
        } catch (error) {
            console.error('Failed to fetch dentists:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchDentists(); }, [fetchDentists]);

    const allBranches = [...new Set(dentistsList.flatMap(d => d.assignedBranches))].sort();

    const filteredDentists = dentistsList.filter(dentist => {
        const matchesSearch = dentist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            dentist.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'All' || dentist.status === statusFilter;
        const matchesVerified = verifiedFilter === 'All' ||
                                (verifiedFilter === 'Verified' && dentist.isVerified) ||
                                (verifiedFilter === 'Unverified' && !dentist.isVerified);
        const matchesBranch = branchFilter === 'All' || dentist.assignedBranches.includes(branchFilter);
        return matchesSearch && matchesStatus && matchesVerified && matchesBranch;
    });

    const handleToggleStatus = (dentist) => {
        const newStatus = dentist.status === 'Active' ? 'inactive' : 'active';
        if (newStatus === 'active' && !dentist.isVerified) {
            addToast(`Cannot activate Dr. ${dentist.name}. Their email is not yet verified.`, 'error');
            return;
        }
        setConfirmConfig({
            title: newStatus === 'active' ? 'Activate Account' : 'Deactivate Account',
            message: newStatus === 'active'
                ? `Are you sure you want to ACTIVATE Dr. ${dentist.name}? They will regain access to the system.`
                : `Are you sure you want to DEACTIVATE Dr. ${dentist.name}? They will lose access to the system.`,
            confirmText: newStatus === 'active' ? 'Yes, Activate' : 'Yes, Deactivate',
            isDestructive: newStatus !== 'active',
            onConfirm: () => executeToggleStatus(dentist.id, newStatus, dentist.name),
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
                setDentistsList(prev => prev.map(d =>
                    d.id === id ? { ...d, status: newStatus === 'active' ? 'Active' : 'Inactive' } : d
                ));
                addToast(`Successfully ${newStatus === 'active' ? 'activated' : 'deactivated'} Dr. ${name}'s account.`, 'success');
            } else {
                const data = await res.json();
                addToast(data.message || 'Failed to update status.', 'error');
            }
        } catch (error) {
            console.error('Error toggling status:', error);
            addToast('Cannot connect to server.', 'error');
        } finally {
            setConfirmConfig(null);
        }
    };

    const handleResendActivation = async (dentist) => {
        try {
            const res = await authFetch(`/user/resend-activation/${dentist.id}`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                addToast(`Activation email resent to ${dentist.email}.`, 'success');
            } else {
                addToast(data.message || 'Failed to resend activation email.', 'error');
            }
        } catch {
            addToast('Cannot connect to server.', 'error');
        }
    };

    const handleEditClick = (dentistId) => { setIsViewModalOpen(false); setSelectedDentistId(dentistId); setIsEditModalOpen(true); };
    const handleCloseEditModal = () => { setIsEditModalOpen(false); setSelectedDentistId(null); };
    const handleViewClick = (dentistId) => { setIsEditModalOpen(false); setSelectedDentistId(dentistId); setIsViewModalOpen(true); };
    const handleCloseViewModal = () => { setIsViewModalOpen(false); setSelectedDentistId(null); };

    return (
        <div className={styles.container}>
            <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 className={styles.title}>Manage Dentists</h1>
                    <p className={styles.subtitle}>View, filter, and manage clinic dental professionals.</p>
                </div>
                <button className={styles.addBtn} onClick={() => setIsAddModalOpen(true)}>
                    <FaUserPlus className={styles.btnIcon} /> Add New Dentist
                </button>
            </header>   

            <div className={styles.controlsRow}>
                <div className={styles.searchFilterGroup}>
                    <div className={styles.searchWrapper}>
                        <FaSearch className={styles.searchIcon} />
                        <input
                            type="text"
                            placeholder="Search dentists by name or email..."
                            className={styles.searchInput}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <select
                        className={styles.filterSelect}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="All">All Statuses</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                    </select>

                    <div className={styles.pillGroup}>
                        <button className={`${styles.filterPill} ${verifiedFilter === 'All' ? styles.activePill : ''}`} onClick={() => setVerifiedFilter('All')}>All</button>
                        <button className={`${styles.filterPill} ${verifiedFilter === 'Verified' ? styles.activePill : ''}`} onClick={() => setVerifiedFilter('Verified')}>Verified</button>
                        <button className={`${styles.filterPill} ${verifiedFilter === 'Unverified' ? styles.activePill : ''}`} onClick={() => setVerifiedFilter('Unverified')}>Unverified</button>
                    </div>

                    <select
                        className={styles.filterSelect}
                        value={branchFilter}
                        onChange={(e) => setBranchFilter(e.target.value)}
                    >
                        <option value="All">All Branches</option>
                        {allBranches.map(branch => (
                            <option key={branch} value={branch}>{branch}</option>
                        ))}
                    </select>
                </div>
            </div>

            {!isBranchManager && <UserTabs activeTab="dentists" />} 

            <div className={`${styles.tableContainer} ${tblStyles.tableWrapper}`}>
                <table className={`${styles.userTable} ${tblStyles.table}`}>
                    <thead>
                        <tr>
                            <th style={{ width: '60px', textAlign: 'center' }}>Pic</th>
                            <th>Dentist Name</th>
                            <th>Email Address</th>
                            {/* ✅ PHASE 2: Branch column */}
                            <th>Assigned Branch</th>
                            <th style={{ width: '180px' }}>Account Status</th>
                            <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="6" style={{textAlign: 'center', padding: '30px', color: '#64748b'}}>Loading records...</td></tr>
                        ) : filteredDentists.length > 0 ? (
                            filteredDentists.map((dentist) => (
                                <tr key={dentist.id} style={{ opacity: dentist.status === 'Inactive' ? 0.6 : 1 }}>
                                    <td style={{ textAlign: 'center' }}>
                                        <UserAvatar user={{ name: dentist.name, profileImage: dentist.profileImage }} size={40} />
                                    </td>
                                    <td>
                                        <span className={styles.fwBold}>Dr. {dentist.name}</span>
                                        {!dentist.isVerified && <span style={{fontSize: '11px', color: '#ef4444', display: 'block', fontWeight: '500', marginTop: '2px'}}>Unverified Email</span>}
                                    </td>
                                    <td>{dentist.email}</td>
                                    {/* ✅ PHASE 2: Show assigned branches */}
                                    <td>
                                        {dentist.assignedBranches.length > 0
                                            ? dentist.assignedBranches.join(', ')
                                            : <span style={{ color: '#94a3b8', fontSize: '13px' }}>Not assigned</span>
                                        }
                                    </td>
                                    <td>
                                        <span className={`${styles.statusDot} ${dentist.status === 'Active' ? styles.activeDot : styles.inactiveDot}`}></span>
                                        <span style={{ fontWeight: '500', color: dentist.status === 'Active' ? '#15803d' : '#b91c1c' }}>{dentist.status}</span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button className={styles.iconBtn} onClick={() => handleViewClick(dentist.id)} title="View Profile"><FaEye /></button>
                                        <button className={styles.iconBtn} onClick={() => handleEditClick(dentist.id)} title="Edit Profile"><FaEdit /></button>
                                        {!dentist.isVerified && (
                                            <button
                                                className={styles.iconBtn}
                                                onClick={() => handleResendActivation(dentist)}
                                                title="Resend Activation Email"
                                                style={{ color: '#f59e0b' }}
                                            >
                                                <FaEnvelope />
                                            </button>
                                        )}
                                        <button
                                            className={styles.iconBtn}
                                            onClick={() => handleToggleStatus(dentist)}
                                            title={dentist.status === 'Active' ? 'Deactivate Account' : 'Activate Account'}
                                            style={{ color: dentist.status === 'Inactive' ? '#22c55e' : '#94a3b8', fontSize: '20px' }}
                                        >
                                            {dentist.status === 'Active' ? <FaToggleOn /> : <FaToggleOff />}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan="6" style={{textAlign: 'center', padding: '30px', color: '#64748b'}}>No dentists found matching filters.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isAddModalOpen && <AddDentist onClose={() => setIsAddModalOpen(false)} onSuccess={fetchDentists} />}

            {isViewModalOpen && selectedDentistId && (
                <ViewDentist
                    dentistId={selectedDentistId}
                    onClose={handleCloseViewModal}
                    onEdit={() => { setIsViewModalOpen(false); setIsEditModalOpen(true); }}
                />
            )}

            {isEditModalOpen && selectedDentistId && <EditDentist dentistId={selectedDentistId} onClose={handleCloseEditModal} onSuccess={fetchDentists} />}

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
