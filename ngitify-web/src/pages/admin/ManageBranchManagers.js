import React, { useState, useEffect, useCallback } from 'react';
import { FaEdit, FaEye, FaEnvelope, FaSearch, FaToggleOn, FaToggleOff, FaUserPlus } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/ManageDentists.module.css';
import tblStyles from '../../styles/wideTable.module.css';
import EditBranchManager from './EditBranchManager';
import AddBranchManager from './AddBranchManager';
import UserTabs from './UserTabs';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useToast } from '../../context/ToastContext';

const ManageBranchManagers = () => {
    const { addToast } = useToast();

    const [managers, setManagers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('Active');
    const [branchFilter, setBranchFilter] = useState('All');

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedManagerId, setSelectedManagerId] = useState(null);
    const [confirmConfig, setConfirmConfig] = useState(null);

    const fetchManagers = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await authFetch('/users?role=branch-manager');
            if (res.ok) {
                const data = await res.json();
                setManagers(data.map((u) => ({
                    id: u._id,
                    name: `${u.name?.first || ''} ${u.name?.last || ''}`.trim() || 'Unknown',
                    email: u.email || 'N/A',
                    rawStatus: u.status || 'inactive',
                    isVerified: u.isVerified,
                    profileImage: u.profileImage,
                    assignedBranch: u.assignedBranch || u.assignedBranches?.[0] || '',
                })));
            } else {
                addToast('Failed to load branch managers.', 'error');
            }
        } catch {
            addToast('Network error. Please try again.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [addToast]);

    useEffect(() => { fetchManagers(); }, [fetchManagers]);

    const allBranches = [...new Set(managers.map((m) => m.assignedBranch).filter(Boolean))].sort();

    const filteredManagers = managers.filter((m) => {
        const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.email.toLowerCase().includes(searchQuery.toLowerCase());
        const computedStatus = (!m.isVerified || m.rawStatus !== 'active') ? 'Inactive' : 'Active';
        const matchesStatus = statusFilter === 'All' || computedStatus === statusFilter;
        const matchesBranch = branchFilter === 'All' || m.assignedBranch === branchFilter;
        return matchesSearch && matchesStatus && matchesBranch;
    });

    const openManagerModal = (id) => {
        setSelectedManagerId(id);
        setIsEditModalOpen(true);
    };

    const handleToggleStatus = (manager) => {
        const newStatus = manager.status === 'Active' ? 'inactive' : 'active';
        if (newStatus === 'active' && !manager.isVerified) {
            addToast(`Cannot activate ${manager.name}. Their email is not yet verified.`, 'error');
            return;
        }

        setConfirmConfig({
            title: newStatus === 'active' ? 'Activate Account' : 'Deactivate Account',
            message: newStatus === 'active'
                ? `Are you sure you want to ACTIVATE ${manager.name}? They will regain access to the system.`
                : `Are you sure you want to DEACTIVATE ${manager.name}? They will lose access to the system.`,
            confirmText: newStatus === 'active' ? 'Yes, Activate' : 'Yes, Deactivate',
            isDestructive: newStatus !== 'active',
            onConfirm: () => executeToggleStatus(manager.id, newStatus, manager.name),
            onCancel: () => setConfirmConfig(null),
        });
    };

    const executeToggleStatus = async (id, newStatus, name) => {
        try {
            const res = await authFetch(`/user/toggle-status/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus }),
            });

            if (res.ok) {
                setManagers((prev) => prev.map((manager) =>
                    manager.id === id
                        ? { ...manager, rawStatus: newStatus }
                        : manager
                ));
                addToast(`Successfully ${newStatus === 'active' ? 'activated' : 'deactivated'} ${name}'s account.`, 'success');
            } else {
                const data = await res.json();
                addToast(data.message || 'Failed to update status.', 'error');
            }
        } catch {
            addToast('Cannot connect to server.', 'error');
        } finally {
            setConfirmConfig(null);
        }
    };

    const handleResendActivation = async (manager) => {
        try {
            const res = await authFetch(`/user/resend-activation/${manager.id}`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                addToast(`Activation email resent to ${manager.email}.`, 'success');
            } else {
                addToast(data.message || 'Failed to resend activation email.', 'error');
            }
        } catch {
            addToast('Cannot connect to server.', 'error');
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 className={styles.title}>Manage Branch Managers</h1>
                    <p className={styles.subtitle}>View, filter, and manage clinic branch managers.</p>
                </div>
                <button className={styles.addBtn} onClick={() => setIsAddModalOpen(true)}>
                    <FaUserPlus className={styles.btnIcon} /> Add Branch Manager
                </button>
            </header>

            <div className={styles.controlsRow}>
                <div className={styles.searchFilterGroup}>
                    <div className={styles.searchWrapper}>
                        <FaSearch className={styles.searchIcon} />
                        <input
                            type="text"
                            placeholder="Search branch managers by name or email..."
                            className={styles.searchInput}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <div className={styles.pillGroup}>
                        <button className={`${styles.filterPill} ${statusFilter === 'Active' ? styles.activePill : ''}`} onClick={() => setStatusFilter('Active')}>Active</button>
                        <button className={`${styles.filterPill} ${statusFilter === 'Inactive' ? styles.activePill : ''}`} onClick={() => setStatusFilter('Inactive')}>Inactive</button>
                        <button className={`${styles.filterPill} ${statusFilter === 'All' ? styles.activePill : ''}`} onClick={() => setStatusFilter('All')}>All</button>
                    </div>

                    <select
                        className={styles.filterSelect}
                        value={branchFilter}
                        onChange={(e) => setBranchFilter(e.target.value)}
                    >
                        <option value="All">All Branches</option>
                        {allBranches.map((branch) => (
                            <option key={branch} value={branch}>{branch}</option>
                        ))}
                    </select>
                </div>
            </div>

            <UserTabs activeTab="branchManagers" />

            <div className={`${styles.tableContainer} ${tblStyles.tableWrapper}`}>
                <table className={`${styles.userTable} ${tblStyles.table}`}>
                    <thead>
                        <tr>
                            <th style={{ width: '34%' }}>Name</th>
                            <th style={{ width: '36%' }}>Email Address</th>
                            <th style={{ width: '110px' }}>Status</th>
                            <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Loading records...</td></tr>
                        ) : filteredManagers.length > 0 ? (
                            filteredManagers.map((manager) => {
                                const computedStatus = (!manager.isVerified || manager.rawStatus !== 'active') ? 'Inactive' : 'Active';
                                return (
                                <tr key={manager.id} style={{ opacity: computedStatus === 'Inactive' ? 0.6 : 1 }}>
                                    <td className={tblStyles.wrapCell}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span className={styles.fwBold}>{manager.name}</span>
                                            <span style={{ color: '#6b7f92', fontSize: '12px' }}>
                                                {manager.assignedBranch || 'No branch'}
                                            </span>
                                        </div>
                                        {!manager.isVerified && (
                                            <span style={{ fontSize: '11px', color: '#ef4444', display: 'block', fontWeight: '500', marginTop: '2px' }}>
                                                Unverified Email
                                            </span>
                                        )}
                                    </td>
                                    <td className={tblStyles.wrapCell} style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'initial' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span>{manager.email}</span>
                                            {!manager.isVerified && <span style={{ color: '#01538b', fontSize: '12px', fontWeight: 600 }}>Resend Activation Link to email</span>}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`${tblStyles.statusBadge} ${computedStatus === 'Active' ? tblStyles.statusGreen : tblStyles.statusRed}`}>
                                            {computedStatus}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div className={`${tblStyles.iconActions} ${styles.actionRow}`}>
                                            <button
                                                type="button"
                                                className={`${styles.actionIconButton} ${tblStyles.iconAction} ${styles.viewIconButton}`}
                                                onClick={() => openManagerModal(manager.id)}
                                                title="View Branch Manager"
                                            >
                                                <FaEye />
                                            </button>
                                            <button
                                                type="button"
                                                className={`${styles.actionIconButton} ${tblStyles.iconAction} ${styles.editIconButton}`}
                                                onClick={() => openManagerModal(manager.id)}
                                                title="Edit Branch Manager"
                                            >
                                                <FaEdit />
                                            </button>
                                            {!manager.isVerified && (
                                                <button
                                                    type="button"
                                                    className={`${styles.actionIconButton} ${tblStyles.iconAction} ${styles.warningIconButton}`}
                                                    onClick={() => handleResendActivation(manager)}
                                                    title="Resend Activation Email"
                                                >
                                                    <FaEnvelope />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                className={`${styles.actionIconButton} ${tblStyles.iconAction} ${computedStatus === 'Inactive' ? styles.activateIconButton : styles.deactivateIconButton}`}
                                                onClick={() => handleToggleStatus({ ...manager, status: computedStatus })}
                                                title={computedStatus === 'Active' ? 'Deactivate Account' : 'Activate Account'}
                                            >
                                                {computedStatus === 'Active' ? <FaToggleOn /> : <FaToggleOff />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                            })
                        ) : (
                            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No branch managers found matching filters.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isAddModalOpen && (
                <AddBranchManager onClose={() => setIsAddModalOpen(false)} onSuccess={fetchManagers} />
            )}
            {isEditModalOpen && selectedManagerId && (
                <EditBranchManager
                    managerId={selectedManagerId}
                    onClose={() => { setIsEditModalOpen(false); setSelectedManagerId(null); }}
                    onSuccess={fetchManagers}
                />
            )}
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
};

export default ManageBranchManagers;
