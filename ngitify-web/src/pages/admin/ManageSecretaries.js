// ngitify-web/src/pages/admin/ManageSecretaries.js
import React, { useState, useEffect, useCallback } from 'react';
import styles from '../../styles/admin/ManageSecretaries.module.css';
import tblStyles from '../../styles/wideTable.module.css';
import { FaSearch, FaUserPlus, FaEdit, FaEye, FaToggleOn, FaToggleOff, FaArchive, FaUndo } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';

import UserTabs from './UserTabs';
import AddSecretary from './AddSecretary';
import EditSecretary from './EditSecretary';
import ViewSecretary from './ViewSecretary';
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

export default function ManageSecretaries() {
    const { addToast } = useToast();
    const { user } = useAuth();
    const isBranchManager = user?.role === 'branch-manager';

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('active');
    const [branchFilter, setBranchFilter] = useState('All');

    const [secretariesList, setSecretariesList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedSecretaryId, setSelectedSecretaryId] = useState(null);

    const [lifecycleConfig, setLifecycleConfig] = useState(null);

    const fetchSecretaries = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await authFetch('/users?role=secretary&includeArchived=true');
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
                            rawStatus: u.status || 'inactive',
                            isArchived: Boolean(u.isArchived),
                            isVerified: u.isVerified,
                            isPasswordChanged: u.isPasswordChanged === true,
                            temporaryPasswordExpires: u.temporaryPasswordExpires || null,
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

    useEffect(() => {
        fetchSecretaries();
        const intervalId = window.setInterval(fetchSecretaries, 30000);
        const handleFocus = () => fetchSecretaries();
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') fetchSecretaries();
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [fetchSecretaries]);

    const allBranches = [...new Set(secretariesList.flatMap(s => s.assignedBranches))].sort();

    const filteredSecretaries = secretariesList.filter(secretary => {
        const matchesSearch = secretary.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            secretary.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = matchesAccountLifecycleFilter(secretary, statusFilter);
        const matchesBranch = branchFilter === 'All' || secretary.assignedBranches.includes(branchFilter);
        return matchesSearch && matchesStatus && matchesBranch;
    });

    const handleToggleStatus = (secretary) => {
        if (secretary.isArchived) {
            addToast(`Restore ${secretary.name} from archive before changing activation status.`, 'error');
            return;
        }

        const newStatus = secretary.rawStatus === 'active' ? 'inactive' : 'active';
        if (newStatus === 'active' && !secretary.isVerified) {
            addToast(`Cannot activate ${secretary.name}. Their email is not yet verified.`, 'error');
            return;
        }
        if (newStatus === 'active' && hasExpiredTemporaryPassword(secretary)) {
            addToast(`Temporary password expired for ${secretary.name}. Use Reissue Access Email instead.`, 'error');
            return;
        }
        setLifecycleConfig({
            scope: 'user',
            entityType: 'staff',
            targetId: secretary.id,
            action: newStatus === 'active' ? 'activate' : 'deactivate',
            title: newStatus === 'active' ? 'Activate Account' : 'Deactivate Account',
            message: newStatus === 'active'
                ? `Are you sure you want to ACTIVATE ${secretary.name}? They will regain access to the system.`
                : `Are you sure you want to DEACTIVATE ${secretary.name}? They will lose access to the system.`,
            confirmText: newStatus === 'active' ? 'Yes, Activate' : 'Yes, Deactivate',
            isDestructive: newStatus !== 'active',
            subjectName: secretary.name,
            onConfirm: ({ reason }) => executeToggleStatus(secretary.id, newStatus, secretary.name, reason),
        });
    };

    const executeToggleStatus = async (id, newStatus, name, reason = '') => {
        try {
            const res = await authFetch(`/user/toggle-status/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus, reason })
            });
            if (res.ok) {
                setSecretariesList(prev => prev.map(s =>
                    s.id === id ? { ...s, rawStatus: newStatus } : s
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
            setLifecycleConfig(null);
        }
    };

    const handleArchiveToggle = (secretary) => {
        const nextArchivedState = !secretary.isArchived;
        setLifecycleConfig({
            scope: 'user',
            entityType: 'staff',
            targetId: secretary.id,
            action: nextArchivedState ? 'archive' : 'restore',
            title: nextArchivedState ? 'Archive Secretary' : 'Restore Secretary',
            message: nextArchivedState
                ? `Archive ${secretary.name}? This removes the account from normal staff lists and keeps the record read-only until restored.`
                : `Restore ${secretary.name} from archive? The account will return as inactive until it is activated again.`,
            confirmText: nextArchivedState ? 'Yes, Archive' : 'Yes, Restore',
            isDestructive: nextArchivedState,
            subjectName: secretary.name,
            onConfirm: ({ reason }) => executeArchiveToggle(secretary.id, nextArchivedState, secretary.name, reason),
        });
    };

    const executeArchiveToggle = async (id, nextArchivedState, name, reason = '') => {
        try {
            const res = await authFetch(`/user/archive/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ isArchived: nextArchivedState, reason })
            });
            if (res.ok) {
                setSecretariesList(prev => prev.map(s =>
                    s.id === id ? { ...s, isArchived: nextArchivedState, rawStatus: 'inactive' } : s
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
            console.error('Error archiving secretary:', error);
            addToast('Cannot connect to server.', 'error');
        } finally {
            setLifecycleConfig(null);
        }
    };

    const handleRecoverAccess = async (secretary) => {
        if (secretary.isArchived) {
            addToast(`Restore ${secretary.name} from archive before reissuing access.`, 'error');
            return null;
        }
        try {
            const res = await authFetch(`/user/reissue-access/${secretary.id}`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                const updatedAccount = {
                    status: data.account?.status || secretary.rawStatus,
                    rawStatus: data.account?.status || secretary.rawStatus,
                    isVerified: data.account?.isVerified ?? secretary.isVerified,
                    isPasswordChanged: data.account?.isPasswordChanged ?? secretary.isPasswordChanged,
                    temporaryPasswordExpires: data.account?.temporaryPasswordExpires || secretary.temporaryPasswordExpires,
                };
                setSecretariesList((prev) => prev.map((entry) => (
                    entry.id === secretary.id ? { ...entry, ...updatedAccount } : entry
                )));
                addToast(data.message || `${getAccessRecoveryLabel(secretary)} sent to ${secretary.email}.`, 'success');
                return updatedAccount;
            } else {
                addToast(data.message || 'Failed to reissue access email.', 'error');
            }
        } catch {
            addToast('Cannot connect to server.', 'error');
        }
        return null;
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

                    <div className={styles.pillGroup}>
                        <button className={`${styles.filterPill} ${statusFilter === 'active' ? styles.activePill : ''}`} onClick={() => setStatusFilter('active')}>Active</button>
                        <button className={`${styles.filterPill} ${statusFilter === 'needsActivation' ? styles.activePill : ''}`} onClick={() => setStatusFilter('needsActivation')}>Needs Activation</button>
                        <button className={`${styles.filterPill} ${statusFilter === 'inactive' ? styles.activePill : ''}`} onClick={() => setStatusFilter('inactive')}>Inactive</button>
                        <button className={`${styles.filterPill} ${statusFilter === 'archived' ? styles.activePill : ''}`} onClick={() => setStatusFilter('archived')}>Archived</button>
                        <button className={`${styles.filterPill} ${statusFilter === 'all' ? styles.activePill : ''}`} onClick={() => setStatusFilter('all')}>All</button>
                    </div>

                    {!isBranchManager ? (
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
                    ) : (
                        <div style={{ display: 'inline-flex', alignItems: 'center', minHeight: '46px', padding: '0 18px', borderRadius: '999px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#01538b', fontSize: '13px', fontWeight: 700 }}>
                            Branch locked to {user?.assignedBranch || 'your branch'}
                        </div>
                    )}
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
                            <th style={{ width: '168px', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="4" style={{textAlign: 'center', padding: '30px', color: '#64748b'}}>Loading records...</td></tr>
                        ) : filteredSecretaries.length > 0 ? (
                            filteredSecretaries.map((secretary) => {
                                const statusKey = getAccountLifecycleKey(secretary);
                                const computedStatus = getAccountLifecycleLabel(secretary);
                                const isArchivedRecord = statusKey === 'archived';
                                return (
                                <tr key={secretary.id} style={{ opacity: statusKey === 'inactive' || isArchivedRecord ? 0.6 : 1 }}>
                                    <td className={tblStyles.wrapCell}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span className={styles.fwBold}>{secretary.name}</span>
                                            <span style={{ color: '#6b7f92', fontSize: '12px' }}>
                                                {secretary.assignedBranches.length > 0 ? secretary.assignedBranches.join(', ') : 'No branch'}
                                            </span>
                                        </div>
                                        {isArchivedRecord ? (
                                            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: '600', marginTop: '2px' }}>Archived record</span>
                                        ) : hasExpiredTemporaryPassword(secretary) ? (
                                            <span style={{ fontSize: '11px', color: '#b45309', display: 'block', fontWeight: '600', marginTop: '2px' }}>Temporary password expired</span>
                                        ) : (
                                            !secretary.isVerified && <span style={{fontSize: '11px', color: '#ef4444', display: 'block', fontWeight: '500', marginTop: '2px'}}>Unverified Email</span>
                                        )}
                                    </td>
                                    <td className={tblStyles.wrapCell} style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'initial' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span>{secretary.email}</span>
                                            {shouldShowAccessRecovery(secretary) && !isArchivedRecord && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRecoverAccess(secretary)}
                                                    style={{ color: '#01538b', fontSize: '12px', fontWeight: 600, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                                                >
                                                    {getAccessRecoveryLabel(secretary)}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    {/* ✅ PHASE 2: Show assigned branches */}
                                    <td>
                                        <span className={`${tblStyles.statusBadge} ${statusKey === 'active' ? tblStyles.statusGreen : statusKey === 'needsActivation' ? tblStyles.statusAmber : statusKey === 'archived' ? tblStyles.statusGray : tblStyles.statusRed}`}>
                                            {computedStatus}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div className={`${tblStyles.iconActions} ${styles.actionRow}`}>
                                            <button type="button" className={`${styles.actionIconButton} ${tblStyles.iconAction} ${styles.viewIconButton}`} onClick={() => handleViewClick(secretary.id)} title="View Profile"><FaEye /></button>
                                            <button
                                                type="button"
                                                className={`${styles.actionIconButton} ${tblStyles.iconAction} ${styles.editIconButton}`}
                                                onClick={() => handleEditClick(secretary.id)}
                                                title={isArchivedRecord ? 'Archived records are read-only' : 'Edit Profile'}
                                                disabled={isArchivedRecord}
                                            >
                                                <FaEdit />
                                            </button>
                                            <button
                                                type="button"
                                                className={`${styles.actionIconButton} ${tblStyles.iconAction} ${statusKey !== 'active' ? styles.activateIconButton : styles.deactivateIconButton}`}
                                                onClick={() => handleToggleStatus({ ...secretary, status: computedStatus })}
                                                title={isArchivedRecord ? 'Restore before changing activation status' : statusKey === 'active' ? 'Deactivate Account' : 'Activate Account'}
                                                disabled={isArchivedRecord}
                                            >
                                                {statusKey === 'active' ? <FaToggleOn /> : <FaToggleOff />}
                                            </button>
                                            <button
                                                type="button"
                                                className={`${styles.actionIconButton} ${tblStyles.iconAction} ${isArchivedRecord ? styles.activateIconButton : styles.warningIconButton}`}
                                                onClick={() => handleArchiveToggle(secretary)}
                                                title={isArchivedRecord ? 'Restore Secretary' : 'Archive Secretary'}
                                            >
                                                {isArchivedRecord ? <FaUndo /> : <FaArchive />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                            })
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
                    onRecoverAccess={handleRecoverAccess}
                />
            )}
            {isEditModalOpen && selectedSecretaryId && <EditSecretary secretaryId={selectedSecretaryId} onClose={handleCloseEditModal} onSuccess={fetchSecretaries} />}

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
}
