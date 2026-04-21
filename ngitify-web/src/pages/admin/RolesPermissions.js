import React, { useState, useEffect, useCallback } from 'react';
import { FaShieldAlt, FaSave, FaSearch, FaUserShield, FaLock } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import styles from '../../styles/admin/RolesPermissions.module.css';

const MODULES = [
    { key: 'appointments',   label: 'Appointments' },
    { key: 'patients',       label: 'Patients / EMR' },
    { key: 'inventory',      label: 'Inventory' },
    { key: 'userManagement', label: 'User Management' },
    { key: 'auditTrail',     label: 'Audit Trail' },
    { key: 'queue',          label: 'Queue Management' },
    { key: 'systemConfig',   label: 'System Config' },
];

const ALL_ROLES = [
    { key: 'co-administrator', label: 'Co-Admin' },
    { key: 'branch-manager',   label: 'Branch Manager' },
    { key: 'dentist',          label: 'Dentist' },
    { key: 'secretary',        label: 'Secretary' },
];

const ACCESS_OPTIONS = [
    { value: 'full_access', label: 'Full Access', color: '#27ae60' },
    { value: 'read_only',   label: 'Read Only',   color: '#2980b9' },
    { value: 'no_access',   label: 'No Access',   color: '#95a5a6' },
];

export default function RolesPermissions() {
    const { addToast } = useToast();
    const { user } = useAuth();
    const isCoAdmin = user?.role === 'co-administrator';
    // ✅ Owner can edit the matrix but cannot use Grant Admin Access
    const isOwner   = user?.role === 'owner';
    const ROLES = ALL_ROLES;

    const [matrix, setMatrix]       = useState({});
    const [original, setOriginal]   = useState({});
    const [loading, setLoading]     = useState(true);
    const [saving, setSaving]       = useState(null);

    const [users, setUsers]             = useState([]);
    const [userSearch, setUserSearch]   = useState('');
    const [grantLoading, setGrantLoading] = useState(null);

    const fetchPermissions = useCallback(async () => {
        try {
            const res = await authFetch('/role-permissions');
            if (res.ok) {
                const data = await res.json();
                const built = {};
                data.forEach(doc => { built[doc.role] = { ...doc.permissions }; });
                setMatrix(built);
                setOriginal(JSON.parse(JSON.stringify(built)));
            }
        } catch (err) {
            addToast('Failed to load role permissions.', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    const fetchUsers = useCallback(async () => {
        try {
            const res = await authFetch('/users?role=dentist,secretary,branch-manager,co-administrator');
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch (err) { /* silent */ }
    }, []);

    useEffect(() => {
        fetchPermissions();
        // Only admins use the Grant Admin section — skip fetching users for owner/co-admin
        if (!isCoAdmin && !isOwner) fetchUsers();
    }, [fetchPermissions, fetchUsers, isCoAdmin, isOwner]);

    const handleChange = (role, module, value) => {
        // ✅ Co-admins are view-only — block edits at the handler level
        if (isCoAdmin) return;
        setMatrix(prev => ({
            ...prev,
            [role]: { ...prev[role], [module]: value }
        }));
    };

    const handleSave = async (role) => {
        setSaving(role);
        try {
            const res = await authFetch(`/role-permissions/${role}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ permissions: matrix[role] })
            });
            if (res.ok) {
                setOriginal(prev => ({
                    ...prev,
                    [role]: { ...matrix[role] }
                }));
                addToast(`Permissions saved for ${ROLES.find(r => r.key === role)?.label}.`, 'success');
            } else {
                const err = await res.json();
                addToast(err.message || 'Failed to save.', 'error');
            }
        } catch (err) {
            addToast('Network error. Please try again.', 'error');
        } finally {
            setSaving(null);
        }
    };

    const isDirty = (role) => {
        return JSON.stringify(matrix[role]) !== JSON.stringify(original[role]);
    };

    const handleGrantAdmin = async (userId, currentValue) => {
        setGrantLoading(userId);
        try {
            const res = await authFetch(`/users/${userId}/grant-admin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isAdminAccess: !currentValue })
            });
            if (res.ok) {
                setUsers(prev => prev.map(u =>
                    u._id === userId ? { ...u, isAdminAccess: !currentValue } : u
                ));
                addToast(`Admin access ${!currentValue ? 'granted' : 'revoked'} successfully.`, 'success');
            } else {
                const err = await res.json();
                addToast(err.message || 'Failed.', 'error');
            }
        } catch (err) {
            addToast('Network error.', 'error');
        } finally {
            setGrantLoading(null);
        }
    };

    const filteredUsers = users.filter(u => {
        const name = `${u.name?.first || ''} ${u.name?.last || ''}`.toLowerCase();
        const email = (u.email || '').toLowerCase();
        const q = userSearch.toLowerCase();
        return name.includes(q) || email.includes(q);
    });

    const getAccessColor = (value) =>
        ACCESS_OPTIONS.find(o => o.value === value)?.color || '#95a5a6';

    if (loading) {
        return <div className={styles.container}><p className={styles.loading}>Loading permissions...</p></div>;
    }

    return (
        <div className={styles.container}>
            {/* Page Header */}
            <div className={styles.pageHeader}>
                <FaShieldAlt className={styles.headerIcon} />
                <div>
                    <h1 className={styles.pageTitle}>Roles & Permissions</h1>
                    <p className={styles.pageSubtitle}>
                        Configure what each role can access across the system.
                    </p>
                </div>
            </div>

            {/* ✅ Read-only banner for co-admin */}
            {isCoAdmin && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    borderRadius: '10px',
                    padding: '12px 18px',
                    marginBottom: '20px',
                    color: '#1e40af',
                    fontSize: '14px',
                    fontWeight: '500',
                }}>
                    <FaLock style={{ flexShrink: 0 }} />
                    <span>
                        You have <strong>view-only access</strong> to the permissions matrix.
                        Only the Administrator can modify role permissions.
                    </span>
                </div>
            )}

            {/* ── Permissions Matrix ── */}
            <div className={styles.card}>
                <h2 className={styles.sectionTitle}>Role Permission Matrix</h2>
                <p className={styles.sectionNote}>
                    Administrators always have full access and cannot be restricted.
                    Changes apply to all users of that role unless individually overridden.
                </p>

                <div className={styles.tableWrapper}>
                    <table className={styles.matrix}>
                        <thead>
                            <tr>
                                <th className={styles.moduleHeader}>Module</th>
                                {ROLES.map(role => (
                                    <th key={role.key} className={styles.roleHeader}>
                                        <div className={styles.roleHeaderContent}>
                                            <span>{role.label}</span>
                                            {/* ✅ Show Save button for admin AND owner (not co-admin) */}
                                            {!isCoAdmin && isDirty(role.key) && (
                                                <button
                                                    className={styles.saveBtn}
                                                    onClick={() => handleSave(role.key)}
                                                    disabled={saving === role.key}
                                                >
                                                    <FaSave />
                                                    {saving === role.key ? 'Saving...' : 'Save'}
                                                </button>
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {MODULES.map((mod, i) => (
                                <tr key={mod.key} className={i % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                                    <td className={styles.moduleCell}>{mod.label}</td>
                                    {ROLES.map(role => {
                                        const currentVal = matrix[role.key]?.[mod.key] || 'no_access';
                                        return (
                                            <td key={role.key} className={styles.accessCell}>
                                                <select
                                                    className={styles.accessSelect}
                                                    value={currentVal}
                                                    onChange={e => handleChange(role.key, mod.key, e.target.value)}
                                                    style={{
                                                        borderColor: getAccessColor(currentVal),
                                                        opacity: isCoAdmin ? 0.75 : 1,
                                                        cursor: isCoAdmin ? 'not-allowed' : 'pointer',
                                                        pointerEvents: isCoAdmin ? 'none' : 'auto',
                                                    }}
                                                    disabled={isCoAdmin}
                                                >
                                                    {ACCESS_OPTIONS.map(opt => (
                                                        <option key={opt.value} value={opt.value}>
                                                            {opt.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className={styles.legend}>
                    {ACCESS_OPTIONS.map(opt => (
                        <span key={opt.value} className={styles.legendItem}>
                            <span className={styles.legendDot} style={{ background: opt.color }} />
                            {opt.label}
                        </span>
                    ))}
                </div>
            </div>

            {/* ── Grant Admin Access — admin only, hidden for owner and co-admin ── */}
            {!isCoAdmin && !isOwner && (
                <div className={styles.card}>
                    <div className={styles.grantHeader}>
                        <FaUserShield className={styles.grantIcon} />
                        <div>
                            <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Grant Admin Access</h2>
                            <p className={styles.sectionNote} style={{ margin: '4px 0 0' }}>
                                Toggle full admin access for individual staff members, overriding their role's default permissions.
                            </p>
                        </div>
                    </div>

                    {/* Search */}
                    <div className={styles.searchBar}>
                        <FaSearch className={styles.searchIcon} />
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={userSearch}
                            onChange={e => setUserSearch(e.target.value)}
                            className={styles.searchInput}
                        />
                    </div>

                    <div className={styles.userList}>
                        {filteredUsers.length === 0 ? (
                            <p className={styles.emptyState}>No staff members found.</p>
                        ) : (
                            filteredUsers.map(u => (
                                <div key={u._id} className={styles.userRow}>
                                    <div className={styles.userAvatar}>
                                        {(u.name?.first?.[0] || '?').toUpperCase()}
                                    </div>
                                    <div className={styles.userDetails}>
                                        <span className={styles.userName}>
                                            {u.name?.first} {u.name?.last}
                                        </span>
                                        <span className={styles.userEmail}>{u.email}</span>
                                    </div>
                                    <span className={styles.roleTag}>{u.role}</span>
                                    <label className={styles.toggleWrapper}>
                                        <input
                                            type="checkbox"
                                            className={styles.toggleInput}
                                            checked={!!u.isAdminAccess}
                                            onChange={() => handleGrantAdmin(u._id, !!u.isAdminAccess)}
                                            disabled={grantLoading === u._id}
                                        />
                                        <span className={styles.toggleSlider} />
                                    </label>
                                    <span className={`${styles.accessLabel} ${u.isAdminAccess ? styles.accessOn : styles.accessOff}`}>
                                        {u.isAdminAccess ? 'Admin Access' : 'Default'}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}