// ngitify-web/src/pages/admin/ManageDentists.js
import React, { useState, useEffect, useCallback } from 'react';
import styles from '../../styles/admin/ManageDentists.module.css';
import tblStyles from '../../styles/wideTable.module.css';
import { FaSearch, FaUserPlus, FaEdit, FaEye, FaToggleOn, FaToggleOff, FaArchive, FaUndo } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';

import UserTabs from './UserTabs';
import AddDentist from './AddDentist';
import EditDentist from './EditDentist';
import ViewDentist from './ViewDentist';
import LifecycleActionModal from '../../components/common/LifecycleActionModal';
import { useToast } from '../../context/ToastContext';
import {
    getAccountLifecycleKey,
    getAccountLifecycleLabel,
    matchesAccountLifecycleFilter,
} from '../../utils/accountStatus';

export default function ManageDentists() {
    const { addToast } = useToast();
    const { user } = useAuth();
    const isBranchManager = user?.role === 'branch-manager';

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('active');
    const [branchFilter, setBranchFilter] = useState('All');

    const [dentistsList, setDentistsList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedDentistId, setSelectedDentistId] = useState(null);

    const [lifecycleConfig, setLifecycleConfig] = useState(null);

    const fetchDentists = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await authFetch('/users?role=dentist&includeArchived=true');
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
                            rawStatus: u.status || 'inactive',
                            isArchived: Boolean(u.isArchived),
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

    useEffect(() => {
        fetchDentists();
        const intervalId = window.setInterval(fetchDentists, 30000);
        const handleFocus = () => fetchDentists();
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') fetchDentists();
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [fetchDentists]);

    const allBranches = [...new Set(dentistsList.flatMap(d => d.assignedBranches))].sort();

    const filteredDentists = dentistsList.filter(dentist => {
        const matchesSearch = dentist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            dentist.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = matchesAccountLifecycleFilter(dentist, statusFilter);
        const matchesBranch = branchFilter === 'All' || dentist.assignedBranches.includes(branchFilter);
        return matchesSearch && matchesStatus && matchesBranch;
    });

    const handleToggleStatus = (dentist) => {
        if (dentist.isArchived) {
            addToast(`Restore Dr. ${dentist.name} from archive before changing activation status.`, 'error');
            return;
        }

        const newStatus = dentist.rawStatus === 'active' ? 'inactive' : 'active';
        if (newStatus === 'active' && !dentist.isVerified) {
            addToast(`Cannot activate Dr. ${dentist.name}. Their email is not yet verified.`, 'error');
            return;
        }
        setLifecycleConfig({
            scope: 'user',
            entityType: 'staff',
            targetId: dentist.id,
            action: newStatus === 'active' ? 'activate' : 'deactivate',
            title: newStatus === 'active' ? 'Activate Account' : 'Deactivate Account',
            message: newStatus === 'active'
                ? `Are you sure you want to ACTIVATE Dr. ${dentist.name}? They will regain access to the system.`
                : `Are you sure you want to DEACTIVATE Dr. ${dentist.name}? They will lose access to the system.`,
            confirmText: newStatus === 'active' ? 'Yes, Activate' : 'Yes, Deactivate',
            isDestructive: newStatus !== 'active',
            subjectName: `Dr. ${dentist.name}`,
            onConfirm: ({ reason }) => executeToggleStatus(dentist.id, newStatus, dentist.name, reason),
        });
    };

    const executeToggleStatus = async (id, newStatus, name, reason = '') => {
        try {
            const res = await authFetch(`/user/toggle-status/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus, reason })
            });
            if (res.ok) {
                setDentistsList(prev => prev.map(d =>
                    d.id === id ? { ...d, rawStatus: newStatus } : d
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
            setLifecycleConfig(null);
        }
    };

    const handleArchiveToggle = (dentist) => {
        const nextArchivedState = !dentist.isArchived;
        setLifecycleConfig({
            scope: 'user',
            entityType: 'staff',
            targetId: dentist.id,
            action: nextArchivedState ? 'archive' : 'restore',
            title: nextArchivedState ? 'Archive Dentist' : 'Restore Dentist',
            message: nextArchivedState
                ? `Archive Dr. ${dentist.name}? This removes the account from normal staff lists and keeps the record read-only until restored.`
                : `Restore Dr. ${dentist.name} from archive? The account will return as inactive until it is activated again.`,
            confirmText: nextArchivedState ? 'Yes, Archive' : 'Yes, Restore',
            isDestructive: nextArchivedState,
            subjectName: `Dr. ${dentist.name}`,
            onConfirm: ({ reason }) => executeArchiveToggle(dentist.id, nextArchivedState, dentist.name, reason),
        });
    };

    const executeArchiveToggle = async (id, nextArchivedState, name, reason = '') => {
        try {
            const res = await authFetch(`/user/archive/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ isArchived: nextArchivedState, reason })
            });
            if (res.ok) {
                setDentistsList(prev => prev.map(d =>
                    d.id === id ? { ...d, isArchived: nextArchivedState, rawStatus: 'inactive' } : d
                ));
                addToast(
                    nextArchivedState
                        ? `Dr. ${name} has been archived successfully.`
                        : `Dr. ${name} has been restored from archive. Activate the account separately if needed.`,
                    'success'
                );
            } else {
                const data = await res.json();
                addToast(data.message || 'Failed to update archive status.', 'error');
            }
        } catch (error) {
            console.error('Error archiving dentist:', error);
            addToast('Cannot connect to server.', 'error');
        } finally {
            setLifecycleConfig(null);
        }
    };

    const handleResendActivation = async (dentist) => {
        if (dentist.isArchived) {
            addToast(`Restore Dr. ${dentist.name} from archive before resending activation.`, 'error');
            return;
        }
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

            {!isBranchManager && <UserTabs activeTab="dentists" />} 

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
                        ) : filteredDentists.length > 0 ? (
                            filteredDentists.map((dentist) => {
                                const statusKey = getAccountLifecycleKey(dentist);
                                const computedStatus = getAccountLifecycleLabel(dentist);
                                const isArchivedRecord = statusKey === 'archived';
                                return (
                                <tr key={dentist.id} style={{ opacity: statusKey === 'inactive' || isArchivedRecord ? 0.6 : 1 }}>
                                    <td className={tblStyles.wrapCell}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span className={styles.fwBold}>Dr. {dentist.name}</span>
                                            <span style={{ color: '#6b7f92', fontSize: '12px' }}>
                                                {dentist.assignedBranches.length > 0 ? dentist.assignedBranches.join(', ') : 'No branch'}
                                            </span>
                                        </div>
                                        {isArchivedRecord ? (
                                            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: '600', marginTop: '2px' }}>Archived record</span>
                                        ) : (
                                            !dentist.isVerified && <span style={{fontSize: '11px', color: '#ef4444', display: 'block', fontWeight: '500', marginTop: '2px'}}>Unverified Email</span>
                                        )}
                                    </td>
                                    <td className={tblStyles.wrapCell} style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'initial' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span>{dentist.email}</span>
                                            {!dentist.isVerified && !isArchivedRecord && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleResendActivation(dentist)}
                                                    style={{ color: '#01538b', fontSize: '12px', fontWeight: 600, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                                                >
                                                    Resend Activation Link to email
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
                                            <button type="button" className={`${styles.actionIconButton} ${tblStyles.iconAction} ${styles.viewIconButton}`} onClick={() => handleViewClick(dentist.id)} title="View Profile"><FaEye /></button>
                                            <button
                                                type="button"
                                                className={`${styles.actionIconButton} ${tblStyles.iconAction} ${styles.editIconButton}`}
                                                onClick={() => handleEditClick(dentist.id)}
                                                title={isArchivedRecord ? 'Archived records are read-only' : 'Edit Profile'}
                                                disabled={isArchivedRecord}
                                            >
                                                <FaEdit />
                                            </button>
                                            <button
                                                type="button"
                                                className={`${styles.actionIconButton} ${tblStyles.iconAction} ${statusKey !== 'active' ? styles.activateIconButton : styles.deactivateIconButton}`}
                                                onClick={() => handleToggleStatus({ ...dentist, status: computedStatus })}
                                                title={isArchivedRecord ? 'Restore before changing activation status' : statusKey === 'active' ? 'Deactivate Account' : 'Activate Account'}
                                                disabled={isArchivedRecord}
                                            >
                                                {statusKey === 'active' ? <FaToggleOn /> : <FaToggleOff />}
                                            </button>
                                            <button
                                                type="button"
                                                className={`${styles.actionIconButton} ${tblStyles.iconAction} ${isArchivedRecord ? styles.activateIconButton : styles.warningIconButton}`}
                                                onClick={() => handleArchiveToggle(dentist)}
                                                title={isArchivedRecord ? 'Restore Dentist' : 'Archive Dentist'}
                                            >
                                                {isArchivedRecord ? <FaUndo /> : <FaArchive />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                            })
                        ) : (
                            <tr><td colSpan="4" style={{textAlign: 'center', padding: '30px', color: '#64748b'}}>No dentists found matching filters.</td></tr>
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
                    onResendActivation={handleResendActivation}
                />
            )}

            {isEditModalOpen && selectedDentistId && <EditDentist dentistId={selectedDentistId} onClose={handleCloseEditModal} onSuccess={fetchDentists} />}

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
