import React, { useState, useEffect, useCallback } from 'react';
import { FaSearch, FaUserPlus, FaEdit, FaEye, FaToggleOn, FaToggleOff, FaArchive, FaUndo } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/ManageDentists.module.css';
import tblStyles from '../../styles/wideTable.module.css';
import UserTabs from './UserTabs';
import AddOwner from './AddOwner';
import EditOwner from './EditOwner';
import ViewOwner from './ViewOwner';
import LifecycleActionModal from '../../components/common/LifecycleActionModal';
import { useToast } from '../../context/ToastContext';
import {
    countAccountsByLifecycle,
    getAccessRecoveryLabel,
    getAccountLifecycleKey,
    getAccountLifecycleLabel,
    hasExpiredTemporaryPassword,
    matchesAccountLifecycleFilter,
    shouldShowAccessRecovery,
} from '../../utils/accountStatus';

export default function ManageOwners() {
    const { addToast } = useToast();

    const [ownersList, setOwnersList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('active');

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedOwnerId, setSelectedOwnerId] = useState(null);
    const [lifecycleConfig, setLifecycleConfig] = useState(null);

    const fetchOwners = useCallback(async () => {
        try {
            setIsLoading(true);
            const res = await authFetch('/users?role=owner&includeArchived=true');
            if (res.ok) {
                const data = await res.json();
                setOwnersList(
                    data
                        .filter(u => u.role === 'owner')
                        .map(u => ({
                            id: u._id,
                            name: `${u.name?.first || ''} ${u.name?.last || ''}`.trim() || 'Unknown',
                            email: u.email || 'N/A',
                            rawStatus: u.status || 'inactive',
                            isArchived: Boolean(u.isArchived),
                            isVerified: u.isVerified,
                            isPasswordChanged: u.isPasswordChanged === true,
                            temporaryPasswordExpires: u.temporaryPasswordExpires || null,
                            profileImage: u.profileImage,
                        }))
                );
            }
        } catch (err) {
            console.error('Failed to fetch owners:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchOwners();
        const intervalId = window.setInterval(fetchOwners, 30000);
        const handleFocus = () => fetchOwners();
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') fetchOwners();
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [fetchOwners]);

    const filteredOwners = ownersList.filter(o => {
        const matchesSearch =
            o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            o.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = matchesAccountLifecycleFilter(o, statusFilter);
        return matchesSearch && matchesStatus;
    });

    const summaryCounts = {
        visible: filteredOwners.length,
        active: countAccountsByLifecycle(ownersList, 'active'),
        needsActivation: countAccountsByLifecycle(ownersList, 'needsActivation'),
        inactive: countAccountsByLifecycle(ownersList, 'inactive'),
        archived: countAccountsByLifecycle(ownersList, 'archived'),
    };

    const handleToggleStatus = (owner) => {
        if (owner.isArchived) {
            addToast(`Restore ${owner.name} from archive before changing activation status.`, 'error');
            return;
        }
        const newStatus = owner.rawStatus === 'active' ? 'inactive' : 'active';
        if (newStatus === 'active' && !owner.isVerified) {
            addToast(`Cannot activate ${owner.name}. Their email is not yet verified.`, 'error');
            return;
        }
        if (newStatus === 'active' && hasExpiredTemporaryPassword(owner)) {
            addToast(`Temporary password expired for ${owner.name}. Use Reissue Access Email instead.`, 'error');
            return;
        }
        setLifecycleConfig({
            scope: 'user',
            entityType: 'staff',
            targetId: owner.id,
            action: newStatus === 'active' ? 'activate' : 'deactivate',
            title: newStatus === 'active' ? 'Activate Account' : 'Deactivate Account',
            message: newStatus === 'active'
                ? `Are you sure you want to ACTIVATE ${owner.name}?`
                : `Are you sure you want to DEACTIVATE ${owner.name}? They will lose system access.`,
            confirmText: newStatus === 'active' ? 'Yes, Activate' : 'Yes, Deactivate',
            isDestructive: newStatus !== 'active',
            subjectName: owner.name,
            onConfirm: ({ reason }) => executeToggleStatus(owner.id, newStatus, owner.name, reason),
        });
    };

    const executeToggleStatus = async (id, newStatus, name, reason = '') => {
        try {
            const res = await authFetch(`/user/toggle-status/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus, reason }),
            });
            if (res.ok) {
                setOwnersList(prev => prev.map(o =>
                    o.id === id ? { ...o, rawStatus: newStatus } : o
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

    const handleArchiveToggle = (owner) => {
        const nextArchivedState = !owner.isArchived;
        setLifecycleConfig({
            scope: 'user',
            entityType: 'staff',
            targetId: owner.id,
            action: nextArchivedState ? 'archive' : 'restore',
            title: nextArchivedState ? 'Archive Owner' : 'Restore Owner',
            message: nextArchivedState
                ? `Archive ${owner.name}? This removes the account from normal owner lists and keeps the record read-only until restored.`
                : `Restore ${owner.name} from archive? The account will return as inactive until it is activated again.`,
            confirmText: nextArchivedState ? 'Yes, Archive' : 'Yes, Restore',
            isDestructive: nextArchivedState,
            subjectName: owner.name,
            onConfirm: ({ reason }) => executeArchiveToggle(owner.id, nextArchivedState, owner.name, reason),
        });
    };

    const executeArchiveToggle = async (id, nextArchivedState, name, reason = '') => {
        try {
            const res = await authFetch(`/user/archive/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ isArchived: nextArchivedState, reason }),
            });
            if (res.ok) {
                setOwnersList(prev => prev.map(o =>
                    o.id === id ? { ...o, isArchived: nextArchivedState, rawStatus: 'inactive' } : o
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
            console.error('Error archiving owner:', error);
            addToast('Cannot connect to server.', 'error');
        } finally {
            setLifecycleConfig(null);
        }
    };

    const handleRecoverAccess = async (owner) => {
        if (owner.isArchived) {
            addToast(`Restore ${owner.name} from archive before reissuing access.`, 'error');
            return null;
        }
        try {
            const res = await authFetch(`/user/reissue-access/${owner.id}`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                const updatedAccount = {
                    status: data.account?.status || owner.rawStatus,
                    rawStatus: data.account?.status || owner.rawStatus,
                    isVerified: data.account?.isVerified ?? owner.isVerified,
                    isPasswordChanged: data.account?.isPasswordChanged ?? owner.isPasswordChanged,
                    temporaryPasswordExpires: data.account?.temporaryPasswordExpires || owner.temporaryPasswordExpires,
                };
                setOwnersList((prev) => prev.map((entry) => (
                    entry.id === owner.id ? { ...entry, ...updatedAccount } : entry
                )));
                addToast(data.message || `${getAccessRecoveryLabel(owner)} sent to ${owner.email}.`, 'success');
                return updatedAccount;
            }
            addToast(data.message || 'Failed to reissue access email.', 'error');
        } catch {
            addToast('Cannot connect to server.', 'error');
        }
        return null;
    };

    const handleViewClick = (id) => {
        setSelectedOwnerId(id);
        setIsEditModalOpen(false);
        setIsViewModalOpen(true);
    };

    const handleEditClick = (id) => {
        setSelectedOwnerId(id);
        setIsViewModalOpen(false);
        setIsEditModalOpen(true);
    };

    return (
        <div className={styles.container}>
            <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 className={styles.title}>Manage Owners</h1>
                    <p className={styles.subtitle}>View and manage clinic owner accounts.</p>
                </div>
                <button className={styles.addBtn} onClick={() => setIsAddModalOpen(true)}>
                    <FaUserPlus className={styles.btnIcon} /> Add New Owner
                </button>
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
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className={styles.pillGroup}>
                        <button className={`${styles.filterPill} ${statusFilter === 'active' ? styles.activePill : ''}`} onClick={() => setStatusFilter('active')}>Active</button>
                        <button className={`${styles.filterPill} ${statusFilter === 'needsActivation' ? styles.activePill : ''}`} onClick={() => setStatusFilter('needsActivation')}>Needs Activation</button>
                        <button className={`${styles.filterPill} ${statusFilter === 'inactive' ? styles.activePill : ''}`} onClick={() => setStatusFilter('inactive')}>Inactive</button>
                        <button className={`${styles.filterPill} ${statusFilter === 'archived' ? styles.activePill : ''}`} onClick={() => setStatusFilter('archived')}>Archived</button>
                        <button className={`${styles.filterPill} ${statusFilter === 'all' ? styles.activePill : ''}`} onClick={() => setStatusFilter('all')}>All</button>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
                <div style={{ padding: '12px 14px', borderRadius: '16px', background: '#f8fbff', border: '1px solid #dbe6f1', minWidth: '150px' }}>
                    <strong style={{ display: 'block', color: '#123e63', fontSize: '18px' }}>{summaryCounts.visible}</strong>
                    <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 700 }}>Visible Owners</span>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: '16px', background: '#ecfdf5', border: '1px solid #bbf7d0', minWidth: '150px' }}>
                    <strong style={{ display: 'block', color: '#166534', fontSize: '18px' }}>{summaryCounts.active}</strong>
                    <span style={{ color: '#166534', fontSize: '12px', fontWeight: 700 }}>Active</span>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: '16px', background: '#fff7ed', border: '1px solid #fdba74', minWidth: '150px' }}>
                    <strong style={{ display: 'block', color: '#b45309', fontSize: '18px' }}>{summaryCounts.needsActivation}</strong>
                    <span style={{ color: '#b45309', fontSize: '12px', fontWeight: 700 }}>Needs Activation</span>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: '16px', background: '#fef2f2', border: '1px solid #fecaca', minWidth: '150px' }}>
                    <strong style={{ display: 'block', color: '#991b1b', fontSize: '18px' }}>{summaryCounts.inactive}</strong>
                    <span style={{ color: '#991b1b', fontSize: '12px', fontWeight: 700 }}>Inactive</span>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #cbd5e1', minWidth: '150px' }}>
                    <strong style={{ display: 'block', color: '#475569', fontSize: '18px' }}>{summaryCounts.archived}</strong>
                    <span style={{ color: '#475569', fontSize: '12px', fontWeight: 700 }}>Archived</span>
                </div>
            </div>

            <UserTabs activeTab="owners" />

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
                        ) : filteredOwners.length > 0 ? (
                            filteredOwners.map((owner) => {
                                const statusKey = getAccountLifecycleKey(owner);
                                const computedStatus = getAccountLifecycleLabel(owner);
                                const isArchivedRecord = statusKey === 'archived';
                                return (
                                <tr key={owner.id} style={{ opacity: statusKey === 'inactive' || isArchivedRecord ? 0.6 : 1 }}>
                                    <td className={tblStyles.wrapCell}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span className={styles.fwBold}>{owner.name}</span>
                                            <span style={{ color: '#6b7f92', fontSize: '12px' }}>Owner account</span>
                                        </div>
                                        {isArchivedRecord ? (
                                            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: '600', marginTop: '2px' }}>
                                                Archived record
                                            </span>
                                        ) : hasExpiredTemporaryPassword(owner) ? (
                                            <span style={{ fontSize: '11px', color: '#b45309', display: 'block', fontWeight: '600', marginTop: '2px' }}>
                                                Temporary password expired
                                            </span>
                                        ) : (
                                        !owner.isVerified && (
                                            <span style={{ fontSize: '11px', color: '#ef4444', display: 'block', fontWeight: '500', marginTop: '2px' }}>
                                                Unverified Email
                                            </span>
                                        ))}
                                    </td>
                                    <td className={tblStyles.wrapCell} style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'initial' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span>{owner.email}</span>
                                            {shouldShowAccessRecovery(owner) && !isArchivedRecord && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRecoverAccess(owner)}
                                                    style={{ color: '#01538b', fontSize: '12px', fontWeight: 600, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                                                >
                                                    {getAccessRecoveryLabel(owner)}
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
                                                onClick={() => handleViewClick(owner.id)}
                                                title="View Owner"
                                            >
                                                <FaEye />
                                            </button>
                                            <button
                                                type="button"
                                                className={`${styles.actionIconButton} ${tblStyles.iconAction} ${styles.editIconButton}`}
                                                onClick={() => handleEditClick(owner.id)}
                                                title={isArchivedRecord ? 'Archived records are read-only' : 'Edit Owner'}
                                                disabled={isArchivedRecord}
                                            >
                                                <FaEdit />
                                            </button>
                                            <button
                                                type="button"
                                                className={`${styles.actionIconButton} ${tblStyles.iconAction} ${statusKey !== 'active' ? styles.activateIconButton : styles.deactivateIconButton}`}
                                                onClick={() => handleToggleStatus({ ...owner, status: computedStatus })}
                                                title={isArchivedRecord ? 'Restore before changing activation status' : statusKey === 'active' ? 'Deactivate' : 'Activate'}
                                                disabled={isArchivedRecord}
                                            >
                                                {statusKey === 'active' ? <FaToggleOn /> : <FaToggleOff />}
                                            </button>
                                            <button
                                                type="button"
                                                className={`${styles.actionIconButton} ${tblStyles.iconAction} ${isArchivedRecord ? styles.activateIconButton : styles.warningIconButton}`}
                                                onClick={() => handleArchiveToggle(owner)}
                                                title={isArchivedRecord ? 'Restore Owner' : 'Archive Owner'}
                                            >
                                                {isArchivedRecord ? <FaUndo /> : <FaArchive />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                            })
                        ) : (
                            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No owners found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isAddModalOpen && <AddOwner onClose={() => setIsAddModalOpen(false)} onSuccess={fetchOwners} />}
            {isViewModalOpen && selectedOwnerId && (
                <ViewOwner
                    ownerId={selectedOwnerId}
                    onClose={() => { setIsViewModalOpen(false); setSelectedOwnerId(null); }}
                    onEdit={() => { setIsViewModalOpen(false); setIsEditModalOpen(true); }}
                    onRecoverAccess={handleRecoverAccess}
                />
            )}
            {isEditModalOpen && selectedOwnerId && (
                <EditOwner
                    ownerId={selectedOwnerId}
                    onClose={() => { setIsEditModalOpen(false); setSelectedOwnerId(null); }}
                    onSuccess={fetchOwners}
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
}
