import React, { useState, useEffect, useCallback } from 'react';
import { FaEdit, FaEnvelope, FaToggleOn, FaToggleOff, FaSearch, FaUserPlus } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/ManageDentists.module.css';
import EditCoAdmin from './EditCoAdmin';
import AddCoAdmin from './AddCoAdmin';
import UserTabs from './UserTabs';
import UserAvatar from '../../components/common/UserAvatar';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';

const ManageCoAdmins = () => {
    const { addToast } = useToast();
    const { user: currentUser } = useAuth();

    const [coAdmins, setCoAdmins]             = useState([]);
    const [isLoading, setIsLoading]           = useState(true);
    const [searchQuery, setSearchQuery]       = useState('');
    const [statusFilter, setStatusFilter]     = useState('All');
    const [verifiedFilter, setVerifiedFilter] = useState('All');

    const [isAddModalOpen, setIsAddModalOpen]         = useState(false);
    const [isEditModalOpen, setIsEditModalOpen]       = useState(false);
    const [selectedCoAdminId, setSelectedCoAdminId]   = useState(null);
    const [confirmConfig, setConfirmConfig]           = useState(null);

    const isCoAdmin     = currentUser?.role === 'co-administrator';
    const currentUserId = currentUser?.userId || currentUser?.id || currentUser?._id;

    // ─── Fetch ────────────────────────────────────────────────────────
    const fetchCoAdmins = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await authFetch('/users?role=co-administrator');
            if (res.ok) {
                const data = await res.json();
                setCoAdmins(data.map(u => ({
                    ...u,
                    // Normalise status so filter comparisons are consistent
                    _statusLabel: u.status === 'active' ? 'Active' : 'Inactive',
                })));
            } else {
                addToast('Failed to load co-administrators.', 'error');
            }
        } catch {
            addToast('Network error. Please try again.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, []); // eslint-disable-line

    useEffect(() => { fetchCoAdmins(); }, [fetchCoAdmins]);

    // ─── Filtered list ────────────────────────────────────────────────
    const visibleCoAdmins = isCoAdmin
        ? coAdmins.filter(u => u.role !== 'administrator')
        : coAdmins;

    const filteredCoAdmins = visibleCoAdmins.filter(u => {
        const fullName        = `${u.name?.first ?? ''} ${u.name?.last ?? ''}`.toLowerCase();
        const matchesSearch   = fullName.includes(searchQuery.toLowerCase()) ||
                                (u.email ?? '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus   = statusFilter === 'All' || u._statusLabel === statusFilter;
        const matchesVerified = verifiedFilter === 'All' ||
                                (verifiedFilter === 'Verified'   &&  u.isVerified) ||
                                (verifiedFilter === 'Unverified' && !u.isVerified);
        return matchesSearch && matchesStatus && matchesVerified;
    });

    // ─── Toggle Status ────────────────────────────────────────────────
    const handleToggleStatus = (u) => {
        const newStatus = u.status === 'active' ? 'inactive' : 'active';
        const fullName  = `${u.name?.first} ${u.name?.last}`;
        if (newStatus === 'active' && !u.isVerified) {
            addToast(`Cannot activate ${fullName}. Their email is not yet verified.`, 'error');
            return;
        }
        setConfirmConfig({
            title:         newStatus === 'active' ? 'Activate Account' : 'Deactivate Account',
            message:       newStatus === 'active'
                ? `Are you sure you want to ACTIVATE ${fullName}? They will regain access to the system.`
                : `Are you sure you want to DEACTIVATE ${fullName}? Their active session will be ended immediately.`,
            confirmText:   newStatus === 'active' ? 'Yes, Activate' : 'Yes, Deactivate',
            isDestructive: newStatus !== 'active',
            onConfirm:     () => executeToggleStatus(u._id, newStatus, fullName),
            onCancel:      () => setConfirmConfig(null),
        });
    };

    const executeToggleStatus = async (id, newStatus, fullName) => {
        try {
            const res = await authFetch(`/user/toggle-status/${id}`, {
                method: 'PUT',
                body:   JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                setCoAdmins(prev => prev.map(u =>
                    u._id === id
                        ? { ...u, status: newStatus, _statusLabel: newStatus === 'active' ? 'Active' : 'Inactive' }
                        : u
                ));
                addToast(
                    `${fullName}'s account has been ${newStatus === 'active' ? 'activated' : 'deactivated'}.`,
                    'success'
                );
            } else {
                const data = await res.json();
                addToast(data.message || 'Failed to update account status.', 'error');
            }
        } catch {
            addToast('Cannot connect to server.', 'error');
        } finally {
            setConfirmConfig(null);
        }
    };

    // ─── Resend Activation ────────────────────────────────────────────
    const handleResendActivation = async (u) => {
        try {
            const res  = await authFetch(`/user/resend-activation/${u._id}`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) addToast(`Activation email resent to ${u.email}.`, 'success');
            else        addToast(data.message || 'Failed to resend activation email.', 'error');
        } catch {
            addToast('Cannot connect to server.', 'error');
        }
    };

    // ─── Delete ───────────────────────────────────────────────────────
    const handleDelete = (u) => {
        const fullName = `${u.name?.first} ${u.name?.last}`;
        setConfirmConfig({
            title:         'Remove Co-Administrator',
            message:       `Are you sure you want to permanently remove ${fullName} as a Co-Administrator? This action cannot be undone.`,
            confirmText:   'Yes, Remove',
            isDestructive: true,
            onConfirm: async () => {
                try {
                    const res = await authFetch(`/users/${u._id}`, { method: 'DELETE' });
                    if (res.ok) { addToast(`${fullName} has been removed.`, 'success'); fetchCoAdmins(); }
                    else        { const data = await res.json(); addToast(data.message || 'Failed to remove co-administrator.', 'error'); }
                } catch { addToast('Network error during delete.', 'error'); }
                finally  { setConfirmConfig(null); }
            },
            onCancel: () => setConfirmConfig(null),
        });
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    // ─── Render ───────────────────────────────────────────────────────
    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Manage Co-Administrators</h1>
                <p className={styles.subtitle}>View, filter, and manage co-administrator accounts.</p>
            </header>

            <div className={styles.controlsRow}>
                <div className={styles.searchFilterGroup}>

                    <div className={styles.searchWrapper}>
                        <FaSearch className={styles.searchIcon} />
                        <input
                            type="text"
                            placeholder="Search co-administrators by name or email..."
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
                        <button className={`${styles.filterPill} ${verifiedFilter === 'All'        ? styles.activePill : ''}`} onClick={() => setVerifiedFilter('All')}>All</button>
                        <button className={`${styles.filterPill} ${verifiedFilter === 'Verified'   ? styles.activePill : ''}`} onClick={() => setVerifiedFilter('Verified')}>Verified</button>
                        <button className={`${styles.filterPill} ${verifiedFilter === 'Unverified' ? styles.activePill : ''}`} onClick={() => setVerifiedFilter('Unverified')}>Unverified</button>
                    </div>
                </div>

                <button className={styles.addBtn} onClick={() => setIsAddModalOpen(true)}>
                    <FaUserPlus className={styles.btnIcon} /> Add Co-Administrator
                </button>
            </div>

            <UserTabs activeTab="coAdmins" />

            <div className={styles.tableContainer}>
                <table className={styles.userTable}>
                    <thead>
                        <tr>
                            <th style={{ width: '60px', textAlign: 'center' }}>Pic</th>
                            <th>Co-Admin Name</th>
                            <th>Email Address</th>
                            <th>Assigned Branches</th>
                            <th>Date Created</th>
                            <th style={{ width: '150px' }}>Account Status</th>
                            <th style={{ width: '160px', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Loading records...</td></tr>
                        ) : filteredCoAdmins.length > 0 ? (
                            filteredCoAdmins.map(u => {
                                const isOwnRow   = String(u._id) === String(currentUserId);
                                const isAdminRow = u.role === 'administrator';
                                const isReadOnly = isCoAdmin && isAdminRow;

                                return (
                                    <tr key={u._id} style={{ opacity: u.status === 'inactive' ? 0.6 : 1 }}>
                                        <td style={{ textAlign: 'center' }}>
                                            <UserAvatar
                                                user={{ name: `${u.name?.first || ''} ${u.name?.last || ''}`.trim(), profileImage: u.profileImage }}
                                                size={40}
                                            />
                                        </td>
                                        <td>
                                            <span className={styles.fwBold}>{u.name?.first} {u.name?.last}</span>
                                            {isOwnRow && (
                                                <span style={{ fontSize: '11px', color: '#0f766e', display: 'block', fontWeight: '600', marginTop: '2px' }}>(You)</span>
                                            )}
                                            {!u.isVerified && (
                                                <span style={{ fontSize: '11px', color: '#ef4444', display: 'block', fontWeight: '500', marginTop: '2px' }}>Unverified Email</span>
                                            )}
                                        </td>
                                        <td>{u.email}</td>
                                        <td>
                                            {u.assignedBranches?.length > 0
                                                ? u.assignedBranches.join(', ')
                                                : <span style={{ color: '#94a3b8', fontSize: '13px' }}>Not assigned</span>}
                                        </td>
                                        <td style={{ fontSize: '13px', color: '#475569' }}>{formatDate(u.createdAt)}</td>
                                        <td>
                                            <span className={`${styles.statusDot} ${u.status === 'active' ? styles.activeDot : styles.inactiveDot}`} />
                                            <span style={{ fontWeight: '500', color: u.status === 'active' ? '#15803d' : '#b91c1c' }}>
                                                {u._statusLabel}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {isReadOnly ? (
                                                <span style={{ fontSize: '11px', fontWeight: '600', color: '#0f766e', backgroundColor: '#ccfbf1', padding: '3px 8px', borderRadius: '4px' }}>
                                                    READ ONLY
                                                </span>
                                            ) : isOwnRow ? (
                                                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>—</span>
                                            ) : (
                                                <>
                                                    <button
                                                        className={styles.iconBtn}
                                                        onClick={() => { setSelectedCoAdminId(u._id); setIsEditModalOpen(true); }}
                                                        title="Edit Co-Administrator"
                                                    >
                                                        <FaEdit />
                                                    </button>
                                                    <button
                                                        className={styles.iconBtn}
                                                        onClick={() => handleToggleStatus(u)}
                                                        title={u.status === 'active' ? 'Deactivate Account' : 'Activate Account'}
                                                        style={{ color: u.status === 'active' ? '#94a3b8' : '#22c55e', fontSize: '20px' }}
                                                    >
                                                        {u.status === 'active' ? <FaToggleOn /> : <FaToggleOff />}
                                                    </button>
                                                    {!u.isVerified && (
                                                        <button
                                                            className={styles.iconBtn}
                                                            onClick={() => handleResendActivation(u)}
                                                            title="Resend Activation Email"
                                                            style={{ color: '#f59e0b' }}
                                                        >
                                                            <FaEnvelope />
                                                        </button>
                                                    )}
                                                    {!isCoAdmin && (
                                                        <button
                                                            className={styles.iconBtn}
                                                            onClick={() => handleDelete(u)}
                                                            title="Remove Co-Administrator"
                                                            style={{ color: '#dc2626' }}
                                                        >
                                                            🗑
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr><td colSpan="7" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No co-administrators found matching filters.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isAddModalOpen && (
                <AddCoAdmin onClose={() => setIsAddModalOpen(false)} onSuccess={fetchCoAdmins} />
            )}
            {isEditModalOpen && selectedCoAdminId && (
                <EditCoAdmin
                    coAdminId={selectedCoAdminId}
                    onClose={() => { setIsEditModalOpen(false); setSelectedCoAdminId(null); }}
                    onSuccess={fetchCoAdmins}
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

export default ManageCoAdmins;