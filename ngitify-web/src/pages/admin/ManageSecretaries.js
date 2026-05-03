// ngitify-web/src/pages/admin/ManageSecretaries.js
import React, { useState, useEffect, useCallback } from 'react';
import styles from '../../styles/admin/ManageSecretaries.module.css';
import tblStyles from '../../styles/wideTable.module.css';
import { FaSearch, FaUserPlus, FaEdit, FaEye, FaToggleOn, FaToggleOff, FaEnvelope } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';

import UserTabs from './UserTabs';
import AddSecretary from './AddSecretary';
import EditSecretary from './EditSecretary';
import ViewSecretary from './ViewSecretary';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useToast } from '../../context/ToastContext';

export default function ManageSecretaries() {
    const { addToast } = useToast();
    const { user } = useAuth();
    const isBranchManager = user?.role === 'branch-manager';

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [verifiedFilter, setVerifiedFilter] = useState('All');
    const [branchFilter, setBranchFilter] = useState('All');

    const [secretariesList, setSecretariesList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedSecretaryId, setSelectedSecretaryId] = useState(null);

    const [confirmConfig, setConfirmConfig] = useState(null);

    const fetchSecretaries = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await authFetch('/users?role=secretary');
            if (response.ok) {
                const data = await response.json();
                const mappedSecretaries = data
                    .filter(u => u.role === 'secretary')
                    .map(u => {
                        let parsedName = 'Unknown Secretary';
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
                setSecretariesList(mappedSecretaries);
            }
        } catch (error) {
            console.error('Failed to fetch secretaries:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchSecretaries(); }, [fetchSecretaries]);

    const allBranches = [...new Set(secretariesList.flatMap(s => s.assignedBranches))].sort();

    const filteredSecretaries = secretariesList.filter(secretary => {
        const matchesSearch = secretary.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            secretary.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'All' || secretary.status === statusFilter;
        const matchesVerified = verifiedFilter === 'All' ||
                                (verifiedFilter === 'Verified' && secretary.isVerified) ||
                                (verifiedFilter === 'Unverified' && !secretary.isVerified);
        const matchesBranch = branchFilter === 'All' || secretary.assignedBranches.includes(branchFilter);
        return matchesSearch && matchesStatus && matchesVerified && matchesBranch;
    });

    const handleToggleStatus = (secretary) => {
        const newStatus = secretary.status === 'Active' ? 'inactive' : 'active';
        if (newStatus === 'active' && !secretary.isVerified) {
            addToast(`Cannot activate ${secretary.name}. Their email is not yet verified.`, 'error');
            return;
        }
        setConfirmConfig({
            title: newStatus === 'active' ? 'Activate Account' : 'Deactivate Account',
            message: newStatus === 'active'
                ? `Are you sure you want to ACTIVATE ${secretary.name}? They will regain access to the system.`
                : `Are you sure you want to DEACTIVATE ${secretary.name}? They will lose access to the system.`,
            confirmText: newStatus === 'active' ? 'Yes, Activate' : 'Yes, Deactivate',
            isDestructive: newStatus !== 'active',
            onConfirm: () => executeToggleStatus(secretary.id, newStatus, secretary.name),
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
                setSecretariesList(prev => prev.map(s =>
                    s.id === id ? { ...s, status: newStatus === 'active' ? 'Active' : 'Inactive' } : s
                ));
                addToast(`Successfully ${newStatus === 'active' ? 'activated' : 'deactivated'} ${name}'s account.`, 'success');
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

    const handleResendActivation = async (secretary) => {
        try {
            const res = await authFetch(`/user/resend-activation/${secretary.id}`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                addToast(`Activation email resent to ${secretary.email}.`, 'success');
            } else {
                addToast(data.message || 'Failed to resend activation email.', 'error');
            }
        } catch {
            addToast('Cannot connect to server.', 'error');
        }
    };

    const handleEditClick = (id) => { setIsViewModalOpen(false); setSelectedSecretaryId(id); setIsEditModalOpen(true); };
    const handleViewClick = (id) => { setIsEditModalOpen(false); setSelectedSecretaryId(id); setIsViewModalOpen(true); };
    const handleCloseEditModal = () => { setIsEditModalOpen(false); setSelectedSecretaryId(null); };
    const handleCloseViewModal = () => { setIsViewModalOpen(false); setSelectedSecretaryId(null); };

    return (
        <div className={styles.container}>
            <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 className={styles.title}>Manage Secretaries</h1>
                    <p className={styles.subtitle}>View, filter, and manage clinic front desk personnel.</p>
                </div>
                <button className={styles.addBtn} onClick={() => setIsAddModalOpen(true)}>
                    <FaUserPlus className={styles.btnIcon} /> Add New Secretary
                </button>
            </header>

            <div className={styles.controlsRow}>
                <div className={styles.searchFilterGroup}>
                    <div className={styles.searchWrapper}>
                        <FaSearch className={styles.searchIcon} />
                        <input
                            type="text"
                            placeholder="Search secretaries by name or email..."
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

            {!isBranchManager && <UserTabs activeTab="secretaries" />}

            <div className={`${styles.tableContainer} ${tblStyles.tableWrapper}`}>
                <table className={`${styles.userTable} ${tblStyles.table}`}>
                    <thead>
                        <tr>
                            <th style={{ width: '34%' }}>Name</th>
                            <th>Email Address</th>
                            {/* ✅ PHASE 2: Branch column */}
                            <th style={{ width: '110px' }}>Status</th>
                            <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="4" style={{textAlign: 'center', padding: '30px', color: '#64748b'}}>Loading records...</td></tr>
                        ) : filteredSecretaries.length > 0 ? (
                            filteredSecretaries.map((secretary) => (
                                <tr key={secretary.id} style={{ opacity: secretary.status === 'Inactive' ? 0.6 : 1 }}>
                                    <td className={tblStyles.wrapCell}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span className={styles.fwBold}>{secretary.name}</span>
                                            <span style={{ color: '#6b7f92', fontSize: '12px' }}>
                                                {secretary.assignedBranches.length > 0 ? secretary.assignedBranches.join(', ') : 'No branch'}
                                            </span>
                                        </div>
                                        {!secretary.isVerified && <span style={{fontSize: '11px', color: '#ef4444', display: 'block', fontWeight: '500', marginTop: '2px'}}>Unverified Email</span>}
                                    </td>
                                    <td className={tblStyles.wrapCell} style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'initial' }}>{secretary.email}</td>
                                    {/* ✅ PHASE 2: Show assigned branches */}
                                    <td>
                                        <span className={`${tblStyles.statusBadge} ${secretary.status === 'Active' ? tblStyles.statusGreen : tblStyles.statusRed}`}>
                                            {secretary.status}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div className={`${tblStyles.iconActions} ${styles.actionRow}`}>
                                            <button type="button" className={`${styles.actionIconButton} ${tblStyles.iconAction} ${styles.viewIconButton}`} onClick={() => handleViewClick(secretary.id)} title="View Profile"><FaEye /></button>
                                            <button type="button" className={`${styles.actionIconButton} ${tblStyles.iconAction} ${styles.editIconButton}`} onClick={() => handleEditClick(secretary.id)} title="Edit Profile"><FaEdit /></button>
                                            {!secretary.isVerified && (
                                                <button
                                                    type="button"
                                                    className={`${styles.actionIconButton} ${tblStyles.iconAction} ${styles.warningIconButton}`}
                                                    onClick={() => handleResendActivation(secretary)}
                                                    title="Resend Activation Email"
                                                >
                                                    <FaEnvelope />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                className={`${styles.actionIconButton} ${tblStyles.iconAction} ${secretary.status === 'Inactive' ? styles.activateIconButton : styles.deactivateIconButton}`}
                                                onClick={() => handleToggleStatus(secretary)}
                                                title={secretary.status === 'Active' ? 'Deactivate Account' : 'Activate Account'}
                                            >
                                                {secretary.status === 'Active' ? <FaToggleOn /> : <FaToggleOff />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan="4" style={{textAlign: 'center', padding: '30px', color: '#64748b'}}>No secretaries found matching filters.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isAddModalOpen && <AddSecretary onClose={() => setIsAddModalOpen(false)} onSuccess={fetchSecretaries} />}
            {isViewModalOpen && selectedSecretaryId && (
                <ViewSecretary
                    secretaryId={selectedSecretaryId}
                    onClose={handleCloseViewModal}
                    onEdit={() => { setIsViewModalOpen(false); setIsEditModalOpen(true); }}
                />
            )}
            {isEditModalOpen && selectedSecretaryId && <EditSecretary secretaryId={selectedSecretaryId} onClose={handleCloseEditModal} onSuccess={fetchSecretaries} />}

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
