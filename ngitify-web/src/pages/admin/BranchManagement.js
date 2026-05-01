import React, { useState, useEffect, useCallback } from 'react';
import { FaCodeBranch, FaPlus, FaEdit, FaPowerOff, FaPhone, FaMapMarkerAlt, FaUserTie } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import ConfirmModal from '../../components/common/ConfirmModal';
import styles from '../../styles/admin/BranchManagement.module.css';

const EMPTY_FORM = { name: '', address: '', contactNumber: '' };

export default function BranchManagement() {
    const { addToast } = useToast();
    const { user } = useAuth();
    const isBranchManager = user?.role === 'branch-manager';
    const assignedBranch = user?.assignedBranch || '';

    const [branches, setBranches]       = useState([]);
    const [managers, setManagers]       = useState([]);
    const [loading, setLoading]         = useState(true);

    // Modal state
    const [showModal, setShowModal]     = useState(false);
    const [editTarget, setEditTarget]   = useState(null); // null = add, object = edit
    const [form, setForm]               = useState(EMPTY_FORM);
    const [submitting, setSubmitting]   = useState(false);
    const [formError, setFormError]     = useState('');

    // Deactivate confirm
    const [confirmTarget, setConfirmTarget] = useState(null);

    // ── Fetch ─────────────────────────────────────────────────
    const fetchBranches = useCallback(async () => {
        try {
            const res = await authFetch(isBranchManager ? '/branches' : '/branches?all=true');
            if (res.ok) setBranches(await res.json());
        } catch (err) {
            addToast('Failed to load branches.', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast, isBranchManager]);

    const fetchManagers = useCallback(async () => {
        try {
            const res = await authFetch('/users?role=branch-manager');
            if (res.ok) setManagers(await res.json());
        } catch (err) { /* silent */ }
    }, []);

    useEffect(() => {
        fetchBranches();
        fetchManagers();
    }, [fetchBranches, fetchManagers]);

    // ── Open Add Modal ────────────────────────────────────────
    const openAdd = () => {
        setEditTarget(null);
        setForm(EMPTY_FORM);
        setFormError('');
        setShowModal(true);
    };

    // ── Open Edit Modal ───────────────────────────────────────
    const openEdit = (branch) => {
        setEditTarget(branch);
        setForm({ name: branch.name, address: branch.address || '', contactNumber: branch.contactNumber || '' });
        setFormError('');
        setShowModal(true);
    };

    // ── Submit (Add or Edit) ──────────────────────────────────
    const handleSubmit = async () => {
        if (!form.name.trim()) { setFormError('Branch name is required.'); return; }
        setSubmitting(true);
        setFormError('');

        try {
            const isEdit = !!editTarget;
            const res = await authFetch(
                isEdit ? `/branches/${editTarget._id}` : '/branches',
                {
                    method: isEdit ? 'PUT' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...form, isActive: isEdit ? editTarget.isActive : true })
                }
            );
            const data = await res.json();
            if (res.ok) {
                addToast(`Branch ${isEdit ? 'updated' : 'created'} successfully.`, 'success');
                setShowModal(false);
                fetchBranches();
            } else {
                setFormError(data.message || 'Failed to save branch.');
            }
        } catch (err) {
            setFormError('Network error. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // ── Toggle Active / Inactive ──────────────────────────────
    const handleToggleActive = async (branch) => {
        try {
            const res = await authFetch(`/branches/${branch._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: branch.name,
                    address: branch.address,
                    contactNumber: branch.contactNumber,
                    isActive: !branch.isActive
                })
            });
            if (res.ok) {
                addToast(`Branch ${!branch.isActive ? 'activated' : 'deactivated'} successfully.`, 'success');
                setConfirmTarget(null);
                fetchBranches();
            } else {
                const d = await res.json();
                addToast(d.message || 'Failed to update branch.', 'error');
            }
        } catch (err) {
            addToast('Network error.', 'error');
        }
    };

    // ── Manager name lookup ───────────────────────────────────
    const getManagerName = (managerIds = []) => {
        if (!managerIds.length) return 'No manager assigned';
        const match = managers.find(m => managerIds.map(String).includes(String(m._id)));
        return match ? `${match.name?.first} ${match.name?.last}` : 'No manager assigned';
    };

    const activeBranches   = branches.filter(b => b.isActive);
    const inactiveBranches = branches.filter(b => !b.isActive);

    if (loading) return <div className={styles.container}><p className={styles.loading}>Loading branches...</p></div>;

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.pageHeader}>
                <div className={styles.headerLeft}>
                    <FaCodeBranch className={styles.headerIcon} />
                    <div>
                        <h1 className={styles.pageTitle}>Branch Management</h1>
                        <p className={styles.pageSubtitle}>
                            {isBranchManager
                                ? `Viewing ${assignedBranch || 'your assigned branch'} only`
                                : `${activeBranches.length} active branch${activeBranches.length !== 1 ? 'es' : ''}`}
                        </p>
                    </div>
                </div>
                {!isBranchManager && (
                    <button className={styles.addBtn} onClick={openAdd}>
                        <FaPlus /> Add Branch
                    </button>
                )}
            </div>

            {/* Active Branches */}
            <h2 className={styles.sectionLabel}>Active Branches</h2>
            {activeBranches.length === 0 ? (
                <div className={styles.emptyState}>No active branches yet. Click "Add Branch" to create one.</div>
            ) : (
                <div className={styles.grid}>
                    {activeBranches.map(branch => (
                            <BranchCard
                                key={branch._id}
                                branch={branch}
                                managerName={getManagerName(branch.managerIds)}
                                onEdit={() => openEdit(branch)}
                                onToggle={() => setConfirmTarget(branch)}
                                readOnly={isBranchManager}
                            />
                        ))}
                    </div>
            )}

            {/* Inactive Branches */}
            {inactiveBranches.length > 0 && (
                <>
                    <h2 className={`${styles.sectionLabel} ${styles.inactiveLabel}`}>Inactive Branches</h2>
                    <div className={styles.grid}>
                        {inactiveBranches.map(branch => (
                            <BranchCard
                                key={branch._id}
                                branch={branch}
                                managerName={getManagerName(branch.managerIds)}
                                onEdit={() => openEdit(branch)}
                                onToggle={() => setConfirmTarget(branch)}
                                inactive
                                readOnly={isBranchManager}
                            />
                        ))}
                    </div>
                </>
            )}

            {/* Add / Edit Modal */}
            {!isBranchManager && showModal && (
                <div className={styles.overlay}>
                    <div className={styles.modal}>
                        <h2 className={styles.modalTitle}>
                            {editTarget ? 'Edit Branch' : 'Add New Branch'}
                        </h2>

                        {formError && <p className={styles.formError}>{formError}</p>}

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Branch Name <span className={styles.required}>*</span></label>
                            <input
                                className={styles.input}
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                placeholder="e.g. Main Branch - Makati"
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Address</label>
                            <input
                                className={styles.input}
                                value={form.address}
                                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                                placeholder="Full address"
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Contact Number</label>
                            <input
                                className={styles.input}
                                value={form.contactNumber}
                                onChange={e => setForm(f => ({ ...f, contactNumber: e.target.value }))}
                                placeholder="+63 9XX XXX XXXX"
                            />
                        </div>

                        <div className={styles.modalActions}>
                            <button className={styles.cancelBtn} onClick={() => setShowModal(false)} disabled={submitting}>
                                Cancel
                            </button>
                            <button className={styles.submitBtn} onClick={handleSubmit} disabled={submitting}>
                                {submitting ? 'Saving...' : (editTarget ? 'Save Changes' : 'Add Branch')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Toggle Modal */}
            {!isBranchManager && (
                <ConfirmModal
                    isOpen={!!confirmTarget}
                    title={confirmTarget?.isActive ? 'Deactivate Branch' : 'Activate Branch'}
                    message={
                        confirmTarget?.isActive
                            ? `Are you sure you want to deactivate "${confirmTarget?.name}"? It will no longer appear in active branch lists.`
                            : `Reactivate "${confirmTarget?.name}"?`
                    }
                    confirmText={confirmTarget?.isActive ? 'Deactivate' : 'Activate'}
                    isDestructive={confirmTarget?.isActive}
                    onConfirm={() => handleToggleActive(confirmTarget)}
                    onCancel={() => setConfirmTarget(null)}
                />
            )}
        </div>
    );
}

function BranchCard({ branch, managerName, onEdit, onToggle, inactive, readOnly = false }) {
    return (
        <div className={`${styles.card} ${inactive ? styles.cardInactive : ''}`}>
            <div className={styles.cardHeader}>
                <div className={styles.branchIcon}>
                    <FaCodeBranch />
                </div>
                <span className={`${styles.statusBadge} ${branch.isActive ? styles.badgeActive : styles.badgeInactive}`}>
                    {branch.isActive ? 'Active' : 'Inactive'}
                </span>
            </div>

            <h3 className={styles.branchName}>{branch.name}</h3>

            <div className={styles.branchMeta}>
                {branch.address && (
                    <p className={styles.metaRow}>
                        <FaMapMarkerAlt className={styles.metaIcon} />
                        {branch.address}
                    </p>
                )}
                {branch.contactNumber && (
                    <p className={styles.metaRow}>
                        <FaPhone className={styles.metaIcon} />
                        {branch.contactNumber}
                    </p>
                )}
                <p className={styles.metaRow}>
                    <FaUserTie className={styles.metaIcon} />
                    {managerName}
                </p>
            </div>

            {!readOnly && (
                <div className={styles.cardActions}>
                    <button className={styles.editBtn} onClick={onEdit}>
                        <FaEdit /> Edit
                    </button>
                    <button
                        className={`${styles.toggleBtn} ${branch.isActive ? styles.toggleDeactivate : styles.toggleActivate}`}
                        onClick={onToggle}
                    >
                        <FaPowerOff />
                        {branch.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                </div>
            )}
        </div>
    );
}
