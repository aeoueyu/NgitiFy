import React, { useState, useEffect, useCallback } from 'react';
import { FaSearch, FaUserPlus, FaEdit, FaEye, FaToggleOn, FaToggleOff, FaEnvelope } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/ManageDentists.module.css';
import tblStyles from '../../styles/wideTable.module.css';
import UserTabs from './UserTabs';
import AddOwner from './AddOwner';
import EditOwner from './EditOwner';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useToast } from '../../context/ToastContext';

export default function ManageOwners() {
    const { addToast } = useToast();

    const [ownersList, setOwnersList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [verifiedFilter, setVerifiedFilter] = useState('All');

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedOwnerId, setSelectedOwnerId] = useState(null);
    const [confirmConfig, setConfirmConfig] = useState(null);

    const fetchOwners = useCallback(async () => {
        try {
            setIsLoading(true);
            const res = await authFetch('/users?role=owner');
            if (res.ok) {
                const data = await res.json();
                setOwnersList(
                    data
                        .filter(u => u.role === 'owner')
                        .map(u => ({
                            id: u._id,
                            name: `${u.name?.first || ''} ${u.name?.last || ''}`.trim() || 'Unknown',
                            email: u.email || 'N/A',
                            status: u.status === 'active' ? 'Active' : 'Inactive',
                            isVerified: u.isVerified,
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

    useEffect(() => { fetchOwners(); }, [fetchOwners]);

    const filteredOwners = ownersList.filter(o => {
        const matchesSearch =
            o.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            o.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'All' || o.status === statusFilter;
        const matchesVerified = verifiedFilter === 'All' ||
                                (verifiedFilter === 'Verified' && o.isVerified) ||
                                (verifiedFilter === 'Unverified' && !o.isVerified);
        return matchesSearch && matchesStatus && matchesVerified;
    });

    const handleToggleStatus = (owner) => {
        const newStatus = owner.status === 'Active' ? 'inactive' : 'active';
        if (newStatus === 'active' && !owner.isVerified) {
            addToast(`Cannot activate ${owner.name}. Their email is not yet verified.`, 'error');
            return;
        }
        setConfirmConfig({
            title: newStatus === 'active' ? 'Activate Account' : 'Deactivate Account',
            message: newStatus === 'active'
                ? `Are you sure you want to ACTIVATE ${owner.name}?`
                : `Are you sure you want to DEACTIVATE ${owner.name}? They will lose system access.`,
            confirmText: newStatus === 'active' ? 'Yes, Activate' : 'Yes, Deactivate',
            isDestructive: newStatus !== 'active',
            onConfirm: () => executeToggleStatus(owner.id, newStatus, owner.name),
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
                setOwnersList(prev => prev.map(o =>
                    o.id === id ? { ...o, status: newStatus === 'active' ? 'Active' : 'Inactive' } : o
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

    const handleResendActivation = async (owner) => {
        try {
            const res = await authFetch(`/user/resend-activation/${owner.id}`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) addToast(`Activation email resent to ${owner.email}.`, 'success');
            else addToast(data.message || 'Failed to resend.', 'error');
        } catch {
            addToast('Cannot connect to server.', 'error');
        }
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
                    <select
                        className={styles.filterSelect}
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
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
                            <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Loading records...</td></tr>
                        ) : filteredOwners.length > 0 ? (
                            filteredOwners.map(owner => (
                                <tr key={owner.id} style={{ opacity: owner.status === 'Inactive' ? 0.6 : 1 }}>
                                    <td className={tblStyles.wrapCell}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span className={styles.fwBold}>{owner.name}</span>
                                            <span style={{ color: '#6b7f92', fontSize: '12px' }}>Owner account</span>
                                        </div>
                                        {!owner.isVerified && (
                                            <span style={{ fontSize: '11px', color: '#ef4444', display: 'block', fontWeight: '500', marginTop: '2px' }}>
                                                Unverified Email
                                            </span>
                                        )}
                                    </td>
                                    <td className={tblStyles.wrapCell} style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'initial' }}>{owner.email}</td>
                                    <td>
                                        <span className={`${tblStyles.statusBadge} ${owner.status === 'Active' ? tblStyles.statusGreen : tblStyles.statusRed}`}>
                                            {owner.status}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div className={`${tblStyles.iconActions} ${styles.actionRow}`}>
                                            <button
                                                type="button"
                                                className={`${styles.actionIconButton} ${tblStyles.iconAction} ${styles.viewIconButton}`}
                                                onClick={() => { setSelectedOwnerId(owner.id); setIsEditModalOpen(true); }}
                                                title="View Owner"
                                            >
                                                <FaEye />
                                            </button>
                                            <button
                                                type="button"
                                                className={`${styles.actionIconButton} ${tblStyles.iconAction} ${styles.editIconButton}`}
                                                onClick={() => { setSelectedOwnerId(owner.id); setIsEditModalOpen(true); }}
                                                title="Edit Owner"
                                            >
                                                <FaEdit />
                                            </button>
                                            {!owner.isVerified && (
                                                <button
                                                    type="button"
                                                    className={`${styles.actionIconButton} ${tblStyles.iconAction} ${styles.warningIconButton}`}
                                                    onClick={() => handleResendActivation(owner)}
                                                    title="Resend Activation Email"
                                                >
                                                    <FaEnvelope />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                className={`${styles.actionIconButton} ${tblStyles.iconAction} ${owner.status === 'Inactive' ? styles.activateIconButton : styles.deactivateIconButton}`}
                                                onClick={() => handleToggleStatus(owner)}
                                                title={owner.status === 'Active' ? 'Deactivate' : 'Activate'}
                                            >
                                                {owner.status === 'Active' ? <FaToggleOn /> : <FaToggleOff />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No owners found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isAddModalOpen && <AddOwner onClose={() => setIsAddModalOpen(false)} onSuccess={fetchOwners} />}
            {isEditModalOpen && selectedOwnerId && (
                <EditOwner
                    ownerId={selectedOwnerId}
                    onClose={() => { setIsEditModalOpen(false); setSelectedOwnerId(null); }}
                    onSuccess={fetchOwners}
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
}
