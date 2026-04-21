import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEdit, FaEnvelope, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/ManageDentists.module.css';
import EditCoAdmin from './EditCoAdmin';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';

const ManageCoAdmins = () => {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const { user: currentUser } = useAuth();

    const [coAdmins, setCoAdmins] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState('');

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedCoAdminId, setSelectedCoAdminId] = useState(null);

    // ConfirmModal state — handles both delete and toggle-status confirmations
    const [confirmConfig, setConfirmConfig] = useState(null);

    const isCoAdmin = currentUser?.role === 'co-administrator';

    // Resolve the current user's ID consistently across token shapes
    const currentUserId = currentUser?.userId || currentUser?.id || currentUser?._id;

    // ─────────────────────────────────────────────────────────────────
    // FETCH
    // ─────────────────────────────────────────────────────────────────
    const fetchCoAdmins = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const res = await authFetch('/users?role=co-administrator');
            if (res.ok) {
                const data = await res.json();
                setCoAdmins(data);
            } else {
                setError('Failed to load co-administrators.');
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchCoAdmins(); }, [fetchCoAdmins]);

    // ─────────────────────────────────────────────────────────────────
    // FILTER
    // §6.2: When a Co-Admin views this page, the Administrator account
    // row must not appear in the list.
    // ─────────────────────────────────────────────────────────────────
    const visibleCoAdmins = isCoAdmin
        ? coAdmins.filter(u => u.role !== 'administrator')
        : coAdmins;

    const filtered = visibleCoAdmins.filter(u => {
        const fullName = `${u.name?.first ?? ''} ${u.name?.last ?? ''}`.toLowerCase();
        return (
            fullName.includes(searchTerm.toLowerCase()) ||
            (u.email ?? '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    });

    // ─────────────────────────────────────────────────────────────────
    // TOGGLE STATUS (Deactivate / Activate)
    // ─────────────────────────────────────────────────────────────────
    const handleToggleStatus = (u) => {
        const newStatus = u.status === 'active' ? 'inactive' : 'active';
        const fullName = `${u.name?.first} ${u.name?.last}`;

        if (newStatus === 'active' && !u.isVerified) {
            addToast(`Cannot activate ${fullName}. Their email is not yet verified.`, 'error');
            return;
        }

        setConfirmConfig({
            title: newStatus === 'active' ? 'Activate Account' : 'Deactivate Account',
            message: newStatus === 'active'
                ? `Are you sure you want to ACTIVATE ${fullName}? They will regain access to the system.`
                : `Are you sure you want to DEACTIVATE ${fullName}? Their active session will be ended immediately.`,
            confirmText: newStatus === 'active' ? 'Yes, Activate' : 'Yes, Deactivate',
            isDestructive: newStatus !== 'active',
            onConfirm: () => executeToggleStatus(u._id, newStatus, fullName),
            onCancel: () => setConfirmConfig(null),
        });
    };

    const executeToggleStatus = async (id, newStatus, fullName) => {
        try {
            const res = await authFetch(`/user/toggle-status/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                // Optimistic update — no need to re-fetch the whole list
                setCoAdmins(prev =>
                    prev.map(u => u._id === id ? { ...u, status: newStatus } : u)
                );
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

    // ─────────────────────────────────────────────────────────────────
    // RESEND ACTIVATION
    // ─────────────────────────────────────────────────────────────────
    const handleResendActivation = async (u) => {
        try {
            const res = await authFetch(`/user/resend-activation/${u._id}`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                addToast(`Activation email resent to ${u.email}.`, 'success');
            } else {
                addToast(data.message || 'Failed to resend activation email.', 'error');
            }
        } catch {
            addToast('Cannot connect to server.', 'error');
        }
    };

    // ─────────────────────────────────────────────────────────────────
    // DELETE (Administrator only)
    // ─────────────────────────────────────────────────────────────────
    const handleDelete = (u) => {
        const fullName = `${u.name?.first} ${u.name?.last}`;
        setConfirmConfig({
            title: 'Remove Co-Administrator',
            message: `Are you sure you want to permanently remove ${fullName} as a Co-Administrator? This action cannot be undone.`,
            confirmText: 'Yes, Remove',
            isDestructive: true,
            onConfirm: () => executeDelete(u._id, fullName),
            onCancel: () => setConfirmConfig(null),
        });
    };

    const executeDelete = async (id, fullName) => {
        try {
            const res = await authFetch(`/users/${id}`, { method: 'DELETE' });
            if (res.ok) {
                addToast(`${fullName} has been removed.`, 'success');
                fetchCoAdmins();
            } else {
                const data = await res.json();
                addToast(data.message || 'Failed to remove co-administrator.', 'error');
            }
        } catch {
            addToast('Network error during delete.', 'error');
        } finally {
            setConfirmConfig(null);
        }
    };

    // ─────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────
    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
        });
    };

    // ─────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────
    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Co-Administrators</h1>
                <p className={styles.subtitle}>View and manage co-administrator accounts.</p>
            </header>

            <div className={styles.controlsRow}>
                <div className={styles.searchFilterGroup}>
                    <div className={styles.searchWrapper}>
                        <input
                            type="text"
                            className={styles.searchInput}
                            placeholder="Search by name or email..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* §6.2: Add button visible to BOTH administrator and co-administrator */}
                <button className={styles.addBtn} onClick={() => navigate('/admin/add-co-admin')}>
                    + Add Co-Administrator
                </button>
            </div>

            {error && (
                <div style={{ color: '#dc2626', padding: '10px', marginBottom: '10px' }}>
                    {error}
                </div>
            )}

            <div className={styles.tableContainer}>
                <table className={styles.userTable}>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email Address</th>
                            <th>Assigned Branches</th>
                            <th>Date Created</th>
                            <th style={{ width: '150px' }}>Account Status</th>
                            <th style={{ width: '160px', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                                    Loading records...
                                </td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                                    No co-administrators found.
                                </td>
                            </tr>
                        ) : (
                            filtered.map(u => {
                                // §6.2: Hide action buttons on the logged-in user's own row
                                const isOwnRow    = String(u._id) === String(currentUserId);
                                // Defense-in-depth: if an admin row somehow passes the visibleCoAdmins
                                // filter (e.g. stale cache), treat it as read-only for Co-Admin viewers.
                                const isAdminRow  = u.role === 'administrator';
                                const isReadOnly  = isCoAdmin && isAdminRow;

                                return (
                                    <tr key={u._id} style={{ opacity: u.status === 'inactive' ? 0.6 : 1 }}>

                                        {/* Name */}
                                        <td>
                                            <span className={styles.fwBold}>
                                                {u.name?.first} {u.name?.last}
                                            </span>
                                            {isOwnRow && (
                                                <span style={{ fontSize: '11px', color: '#0f766e', display: 'block', fontWeight: '600', marginTop: '2px' }}>
                                                    (You)
                                                </span>
                                            )}
                                            {!u.isVerified && (
                                                <span style={{ fontSize: '11px', color: '#ef4444', display: 'block', fontWeight: '500', marginTop: '2px' }}>
                                                    Unverified Email
                                                </span>
                                            )}
                                        </td>

                                        {/* Email */}
                                        <td>{u.email}</td>

                                        {/* Assigned Branches */}
                                        <td>
                                            {u.assignedBranches?.length > 0
                                                ? u.assignedBranches.join(', ')
                                                : <span style={{ color: '#94a3b8', fontSize: '13px' }}>Not assigned</span>
                                            }
                                        </td>

                                        {/* Date Created — §6.2 spec */}
                                        <td style={{ fontSize: '13px', color: '#475569' }}>
                                            {formatDate(u.createdAt)}
                                        </td>

                                        {/* Account Status */}
                                        <td>
                                            <span className={`${styles.statusDot} ${u.status === 'active' ? styles.activeDot : styles.inactiveDot}`} />
                                            <span style={{ fontWeight: '500', color: u.status === 'active' ? '#15803d' : '#b91c1c' }}>
                                                {u.status === 'active' ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>

                                        {/* Actions */}
                                        <td style={{ textAlign: 'center' }}>
                                            {isReadOnly ? (
                                                // Defense-in-depth: Administrator row is read-only for Co-Admin viewers
                                                <span style={{
                                                    fontSize: '11px',
                                                    fontWeight: '600',
                                                    color: '#0f766e',
                                                    backgroundColor: '#ccfbf1',
                                                    padding: '3px 8px',
                                                    borderRadius: '4px',
                                                    letterSpacing: '0.03em'
                                                }}>
                                                    READ ONLY
                                                </span>
                                            ) : isOwnRow ? (
                                                // §6.2: No action buttons on own row
                                                <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>—</span>
                                            ) : (
                                                <>
                                                    {/* Edit */}
                                                    <button
                                                        className={styles.iconBtn}
                                                        onClick={() => { setSelectedCoAdminId(u._id); setIsEditModalOpen(true); }}
                                                        title="Edit Co-Administrator"
                                                    >
                                                        <FaEdit />
                                                    </button>

                                                    {/* Deactivate / Activate toggle */}
                                                    <button
                                                        className={styles.iconBtn}
                                                        onClick={() => handleToggleStatus(u)}
                                                        title={u.status === 'active' ? 'Deactivate Account' : 'Activate Account'}
                                                        style={{ color: u.status === 'active' ? '#f59e0b' : '#16a34a' }}
                                                    >
                                                        {u.status === 'active' ? <FaToggleOn /> : <FaToggleOff />}
                                                    </button>

                                                    {/* Resend activation email (only for unverified) */}
                                                    {!u.isVerified && (
                                                        <button
                                                            className={styles.iconBtn}
                                                            onClick={() => handleResendActivation(u)}
                                                            title="Resend Activation Email"
                                                            style={{ color: '#3b82f6' }}
                                                        >
                                                            <FaEnvelope />
                                                        </button>
                                                    )}

                                                    {/* Delete — Administrator only (§6.2) */}
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
                        )}
                    </tbody>
                </table>
            </div>

            {/* Edit Modal */}
            {isEditModalOpen && selectedCoAdminId && (
                <EditCoAdmin
                    coAdminId={selectedCoAdminId}
                    onClose={() => { setIsEditModalOpen(false); setSelectedCoAdminId(null); }}
                    onSuccess={fetchCoAdmins}
                />
            )}

            {/* Confirm Modal — shared for toggle-status and delete */}
            {confirmConfig && (
                <ConfirmModal
                    isOpen={true}
                    title={confirmConfig.title}
                    message={confirmConfig.message}
                    confirmText={confirmConfig.confirmText}
                    isDestructive={confirmConfig.isDestructive}
                    onConfirm={confirmConfig.onConfirm}
                    onCancel={confirmConfig.onCancel}
                />
            )}
        </div>
    );
};

export default ManageCoAdmins;