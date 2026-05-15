import React, { useState, useEffect, useCallback } from 'react';
import { FaArchive, FaEdit, FaEye, FaSearch, FaToggleOn, FaToggleOff, FaUndo, FaUserPlus } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/ManageDentists.module.css';
import tblStyles from '../../styles/wideTable.module.css';
import EditBranchManager from './EditBranchManager';
import AddBranchManager from './AddBranchManager';
import ViewBranchManager from './ViewBranchManager';
import UserTabs from './UserTabs';
import LifecycleActionModal from '../../components/common/LifecycleActionModal';
import { useToast } from '../../context/ToastContext';
import {
    getAccessRecoveryLabel,
    getAccountLifecycleKey,
    getAccountLifecycleLabel,
    hasExpiredTemporaryPassword,
    matchesAccountLifecycleFilter,
    shouldShowAccessRecovery,
} from '../../utils/accountStatus';

const ManageBranchManagers = () => {
    const { addToast } = useToast();

    const [managers, setManagers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('active');
    const [branchFilter, setBranchFilter] = useState('All');

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedManagerId, setSelectedManagerId] = useState(null);
    const [lifecycleConfig, setLifecycleConfig] = useState(null);

    const fetchManagers = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await authFetch('/users?role=branch-manager&includeArchived=true');
            if (res.ok) {
                const data = await res.json();
                setManagers(data.map((u) => ({
                    id: u._id,
                    name: `${u.name?.first || ''} ${u.name?.last || ''}`.trim() || 'Unknown',
                    email: u.email || 'N/A',
                    rawStatus: u.status || 'inactive',
                    isArchived: Boolean(u.isArchived),
                    isVerified: u.isVerified,
                    isPasswordChanged: u.isPasswordChanged === true,
                    temporaryPasswordExpires: u.temporaryPasswordExpires || null,
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

    useEffect(() => {
        fetchManagers();
        const intervalId = window.setInterval(fetchManagers, 30000);
        const handleFocus = () => fetchManagers();
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') fetchManagers();
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [fetchManagers]);

    const allBranches = [...new Set(managers.map((m) => m.assignedBranch).filter(Boolean))].sort();

    const filteredManagers = managers.filter((m) => {
        const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = matchesAccountLifecycleFilter(m, statusFilter);
        const matchesBranch = branchFilter === 'All' || m.assignedBranch === branchFilter;
        return matchesSearch && matchesStatus && matchesBranch;
    });

    const openManagerModal = (id) => {
        setSelectedManagerId(id);
        setIsEditModalOpen(true);
    };

    const openManagerView = (id) => {
        setSelectedManagerId(id);
        setIsEditModalOpen(false);
        setIsViewModalOpen(true);
    };

    const handleToggleStatus = (manager) => {
        if (manager.isArchived) {
            addToast(`Restore ${manager.name} from archive before changing activation status.`, 'error');
            return;
        }

        const newStatus = manager.rawStatus === 'active' ? 'inactive' : 'active';
        if (newStatus === 'active' && !manager.isVerified) {
            addToast(`Cannot activate ${manager.name}. Their email is not yet verified.`, 'error');
            return;
        }
        if (newStatus === 'active' && hasExpiredTemporaryPassword(manager)) {
            addToast(`Temporary password expired for ${manager.name}. Use Reissue Access Email instead.`, 'error');
            return;
        }

        setLifecycleConfig({
            scope: 'user',
            entityType: 'staff',
            targetId: manager.id,
            action: newStatus === 'active' ? 'activate' : 'deactivate',
            title: newStatus === 'active' ? 'Activate Account' : 'Deactivate Account',
            message: newStatus === 'active'
                ? `Are you sure you want to ACTIVATE ${manager.name}? They will regain access to the system.`
                : `Are you sure you want to DEACTIVATE ${manager.name}? They will lose access to the system.`,
            confirmText: newStatus === 'active' ? 'Yes, Activate' : 'Yes, Deactivate',
            isDestructive: newStatus !== 'active',
            subjectName: manager.name,
            onConfirm: ({ reason }) => executeToggleStatus(manager.id, newStatus, manager.name, reason),
        });
    };

    const executeToggleStatus = async (id, newStatus, name, reason = '') => {
        try {
            const res = await authFetch(`/user/toggle-status/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus, reason }),
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
            setLifecycleConfig(null);
        }
    };

    const handleArchiveToggle = (manager) => {
        const nextArchivedState = !manager.isArchived;
        setLifecycleConfig({
            scope: 'user',
            entityType: 'staff',
            targetId: manager.id,
            action: nextArchivedState ? 'archive' : 'restore',
            title: nextArchivedState ? 'Archive Branch Manager' : 'Restore Branch Manager',
            message: nextArchivedState
                ? `Archive ${manager.name}? This removes the account from normal staff lists and keeps the record read-only until restored.`
                : `Restore ${manager.name} from archive? The account will return as inactive until it is activated again.`,
            confirmText: nextArchivedState ? 'Yes, Archive' : 'Yes, Restore',
            isDestructive: nextArchivedState,
            subjectName: manager.name,
            onConfirm: ({ reason }) => executeArchiveToggle(manager.id, nextArchivedState, manager.name, reason),
        });
    };

    const executeArchiveToggle = async (id, nextArchivedState, name, reason = '') => {
        try {
            const res = await authFetch(`/user/archive/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ isArchived: nextArchivedState, reason }),
            });

            if (res.ok) {
                setManagers((prev) => prev.map((manager) =>
                    manager.id === id
                        ? { ...manager, isArchived: nextArchivedState, rawStatus: 'inactive' }
                        : manager
                ));
                addToast(
                    nextArchivedState
                        ? `${name} has been archived successfully.`
                        : `${name} has been restored from archive. Activate the account separately if needed.`,
                    'success'
                );
            } else {
                const data = await res.json();
                addToast(data.message || 'Failed to update archive status.', 'error');
            }
        } catch (error) {
            console.error('Error archiving branch manager:', error);
            addToast('Cannot connect to server.', 'error');
        } finally {
            setLifecycleConfig(null);
        }
    };

    const handleRecoverAccess = async (manager) => {
        if (manager.isArchived) {
            addToast(`Restore ${manager.name} from archive before reissuing access.`, 'error');
            return null;
        }
        try {
            const res = await authFetch(`/user/reissue-access/${manager.id}`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                const updatedAccount = {
                    status: data.account?.status || manager.rawStatus,
                    rawStatus: data.account?.status || manager.rawStatus,
                    isVerified: data.account?.isVerified ?? manager.isVerified,
                    isPasswordChanged: data.account?.isPasswordChanged ?? manager.isPasswordChanged,
                    temporaryPasswordExpires: data.account?.temporaryPasswordExpires || manager.temporaryPasswordExpires,
                };
                setManagers((prev) => prev.map((entry) => (
                    entry.id === manager.id ? { ...entry, ...updatedAccount } : entry
                )));
                addToast(data.message || `${getAccessRecoveryLabel(manager)} sent to ${manager.email}.`, 'success');
                return updatedAccount;
            } else {
                addToast(data.message || 'Failed to reissue access email.', 'error');
            }
        } catch {
            addToast('Cannot connect to server.', 'error');
        }
        return null;
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
                        <button className={`${styles.filterPill} ${statusFilter === 'active' ? styles.activePill : ''}`} onClick={() => setStatusFilter('active')}>Active</button>
                        <button className={`${styles.filterPill} ${statusFilter === 'needsActivation' ? styles.activePill : ''}`} onClick={() => setStatusFilter('needsActivation')}>Needs Activation</button>
                        <button className={`${styles.filterPill} ${statusFilter === 'inactive' ? styles.activePill : ''}`} onClick={() => setStatusFilter('inactive')}>Inactive</button>
                        <button className={`${styles.filterPill} ${statusFilter === 'archived' ? styles.activePill : ''}`} onClick={() => setStatusFilter('archived')}>Archived</button>
                        <button className={`${styles.filterPill} ${statusFilter === 'all' ? styles.activePill : ''}`} onClick={() => setStatusFilter('all')}>All</button>
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
                            <th style={{ width: '168px', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Loading records...</td></tr>
                        ) : filteredManagers.length > 0 ? (
                            filteredManagers.map((manager) => {
                                const statusKey = getAccountLifecycleKey(manager);
                                const computedStatus = getAccountLifecycleLabel(manager);
                                const isArchivedRecord = statusKey === 'archived';
                                return (
                                <tr key={manager.id} style={{ opacity: statusKey === 'inactive' || isArchivedRecord ? 0.6 : 1 }}>
                                    <td className={tblStyles.wrapCell}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span className={styles.fwBold}>{manager.name}</span>
                                            <span style={{ color: '#6b7f92', fontSize: '12px' }}>
                                                {manager.assignedBranch || 'No branch'}
                                            </span>
                                        </div>
                                        {isArchivedRecord ? (
                                            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: '600', marginTop: '2px' }}>
                                                Archived record
                                            </span>
                                        ) : hasExpiredTemporaryPassword(manager) ? (
                                            <span style={{ fontSize: '11px', color: '#b45309', display: 'block', fontWeight: '600', marginTop: '2px' }}>
                                                Temporary password expired
                                            </span>
                                        ) : (
                                        !manager.isVerified && (
                                            <span style={{ fontSize: '11px', color: '#ef4444', display: 'block', fontWeight: '500', marginTop: '2px' }}>
                                                Unverified Email
                                            </span>
                                        ))}
                                    </td>
                                    <td className={tblStyles.wrapCell} style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'initial' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span>{manager.email}</span>
                                            {shouldShowAccessRecovery(manager) && !isArchivedRecord && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRecoverAccess(manager)}
                                                    style={{ color: '#01538b', fontSize: '12px', fontWeight: 600, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                                                >
                                                    {getAccessRecoveryLabel(manager)}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`${tblStyles.statusBadge} ${statusKey === 'active' ? tblStyles.statusGreen : statusKey === 'needsActivation' ? tblStyles.statusAmber : statusKey === 'archived' ? tblStyles.statusGray : tblStyles.statusRed}`}>
                                            {computedStatus}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div className={`${tblStyles.iconActions} ${styles.actionRow}`}>
                                            <button
                                                type="button"
                                                className={`${styles.actionIconButton} ${tblStyles.iconAction} ${styles.viewIconButton}`}
                                                onClick={() => openManagerView(manager.id)}
                                                title="View Branch Manager"
                                            >
                                                <FaEye />
                                            </button>
                                            <button
                                                type="button"
                                                className={`${styles.actionIconButton} ${tblStyles.iconAction} ${styles.editIconButton}`}
                                                onClick={() => openManagerModal(manager.id)}
                                                title={isArchivedRecord ? 'Archived records are read-only' : 'Edit Branch Manager'}
                                                disabled={isArchivedRecord}
                                            >
                                                <FaEdit />
                                            </button>
                                            <button
                                                type="button"
                                                className={`${styles.actionIconButton} ${tblStyles.iconAction} ${statusKey !== 'active' ? styles.activateIconButton : styles.deactivateIconButton}`}
                                                onClick={() => handleToggleStatus({ ...manager, status: computedStatus })}
                                                title={isArchivedRecord ? 'Restore before changing activation status' : statusKey === 'active' ? 'Deactivate Account' : 'Activate Account'}
                                                disabled={isArchivedRecord}
                                            >
                                                {statusKey === 'active' ? <FaToggleOn /> : <FaToggleOff />}
                                            </button>
                                            <button
                                                type="button"
                                                className={`${styles.actionIconButton} ${tblStyles.iconAction} ${isArchivedRecord ? styles.activateIconButton : styles.warningIconButton}`}
                                                onClick={() => handleArchiveToggle(manager)}
                                                title={isArchivedRecord ? 'Restore Branch Manager' : 'Archive Branch Manager'}
                                            >
                                                {isArchivedRecord ? <FaUndo /> : <FaArchive />}
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
            {isViewModalOpen && selectedManagerId && (
                <ViewBranchManager
                    managerId={selectedManagerId}
                    onClose={() => { setIsViewModalOpen(false); setSelectedManagerId(null); }}
                    onEdit={() => { setIsViewModalOpen(false); setIsEditModalOpen(true); }}
                    onRecoverAccess={handleRecoverAccess}
                />
            )}
            {isEditModalOpen && selectedManagerId && (
                <EditBranchManager
                    managerId={selectedManagerId}
                    onClose={() => { setIsEditModalOpen(false); setSelectedManagerId(null); }}
                    onSuccess={fetchManagers}
                />
            )}
            <LifecycleActionModal
                isOpen={!!lifecycleConfig}
                scope={lifecycleConfig?.scope}
                entityType={lifecycleConfig?.entityType}
                targetId={lifecycleConfig?.targetId}
                action={lifecycleConfig?.action}
                title={lifecycleConfig?.title}
                message={lifecycleConfig?.message}
                subjectName={lifecycleConfig?.subjectName}
                confirmText={lifecycleConfig?.confirmText}
                isDestructive={lifecycleConfig?.isDestructive}
                onConfirm={lifecycleConfig?.onConfirm}
                onCancel={() => setLifecycleConfig(null)}
            />
        </div>
    );
};

export default ManageBranchManagers;
