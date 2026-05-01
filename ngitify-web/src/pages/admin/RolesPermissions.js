import React, { useState, useEffect, useCallback } from 'react';
import { FaSave, FaSearch, FaUserShield, FaLock } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import styles from '../../styles/admin/RolesPermissions.module.css';

const MODULES = [
    { key: 'appointments', label: 'Appointments' },
    { key: 'patients', label: 'Patients / EMR' },
    { key: 'inventory', label: 'Inventory' },
    { key: 'userManagement', label: 'User Management' },
    { key: 'auditTrail', label: 'Audit Trail' },
    { key: 'queue', label: 'Queue Management' },
    { key: 'systemConfig', label: 'System Config' },
];

const ALL_ROLES = [
    { key: 'co-administrator', label: 'Co-Admin' },
    { key: 'branch-manager', label: 'Branch Manager' },
    { key: 'dentist', label: 'Dentist' },
    { key: 'secretary', label: 'Secretary' },
];

const ACCESS_OPTIONS = [
    { value: 'full_access', label: 'Full Access', color: '#27ae60' },
    { value: 'read_only', label: 'Read Only', color: '#2980b9' },
    { value: 'no_access', label: 'No Access', color: '#95a5a6' },
];

export default function RolesPermissions() {
    const { addToast } = useToast();
    const { user } = useAuth();
    const isCoAdmin = user?.role === 'co-administrator';
    const isOwner = user?.role === 'owner';
    const ROLES = ALL_ROLES;

    const [matrix, setMatrix] = useState({});
    const [original, setOriginal] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(null);

    const [users, setUsers] = useState([]);
    const [userSearch, setUserSearch] = useState('');
    const [grantLoading, setGrantLoading] = useState(null);

    const fetchPermissions = useCallback(async () => {
        try {
            const res = await authFetch('/role-permissions');
            if (res.ok) {
                const data = await res.json();
                const built = {};
                data.forEach((doc) => {
                    built[doc.role] = { ...doc.permissions };
                });
                setMatrix(built);
                setOriginal(JSON.parse(JSON.stringify(built)));
            }
        } catch {
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
        } catch {
            // silent
        }
    }, []);

    useEffect(() => {
        fetchPermissions();
        if (!isCoAdmin && !isOwner) fetchUsers();
    }, [fetchPermissions, fetchUsers, isCoAdmin, isOwner]);

    const handleChange = (role, module, value) => {
        setMatrix((prev) => ({
            ...prev,
            [role]: { ...prev[role], [module]: value },
        }));
    };

    const handleSave = async (role) => {
        setSaving(role);
        try {
            const res = await authFetch(`/role-permissions/${role}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ permissions: matrix[role] }),
            });
            if (res.ok) {
                setOriginal((prev) => ({
                    ...prev,
                    [role]: { ...matrix[role] },
                }));
                addToast(`Permissions saved for ${ROLES.find((r) => r.key === role)?.label}.`, 'success');
            } else {
                const err = await res.json();
                addToast(err.message || 'Failed to save.', 'error');
            }
        } catch {
            addToast('Network error. Please try again.', 'error');
        } finally {
            setSaving(null);
        }
    };

    const isDirty = (role) => JSON.stringify(matrix[role]) !== JSON.stringify(original[role]);

    const handleGrantAdmin = async (userId, currentValue) => {
        setGrantLoading(userId);
        try {
            const res = await authFetch(`/users/${userId}/grant-admin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isAdminAccess: !currentValue }),
            });
            if (res.ok) {
                setUsers((prev) => prev.map((entry) =>
                    entry._id === userId ? { ...entry, isAdminAccess: !currentValue } : entry
                ));
                addToast(`Admin access ${!currentValue ? 'granted' : 'revoked'} successfully.`, 'success');
            } else {
                const err = await res.json();
                addToast(err.message || 'Failed.', 'error');
            }
        } catch {
            addToast('Network error.', 'error');
        } finally {
            setGrantLoading(null);
        }
    };

    const filteredUsers = users.filter((entry) => {
        const name = `${entry.name?.first || ''} ${entry.name?.last || ''}`.toLowerCase();
        const email = (entry.email || '').toLowerCase();
        const q = userSearch.toLowerCase();
        return name.includes(q) || email.includes(q);
    });

    const getAccessColor = (value) => ACCESS_OPTIONS.find((option) => option.value === value)?.color || '#95a5a6';

    if (loading) {
        return <div className={styles.container}><p className={styles.loading}>Loading permissions...</p></div>;
    }

    return (
        <div className={styles.container}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Roles & Permissions</h1>
                    <p className={styles.pageSubtitle}>
                        Configure what each role can access across the system.
                    </p>
                </div>
            </div>

            {isCoAdmin && (
                <div
                    style={{
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
                    }}
                >
                    <FaLock style={{ flexShrink: 0 }} />
                    <span>
                        You can manage the permission matrix like the Administrator, but
                        <strong> ownership transfer and administrator-only escalation still stay with the Administrator.</strong>
                    </span>
                </div>
            )}

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
                                {ROLES.map((role) => (
                                    <th key={role.key} className={styles.roleHeader}>
                                        <div className={styles.roleHeaderContent}>
                                            <span>{role.label}</span>
                                            {isDirty(role.key) && (
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
                            {MODULES.map((mod, index) => (
                                <tr key={mod.key} className={index % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                                    <td className={styles.moduleCell}>{mod.label}</td>
                                    {ROLES.map((role) => {
                                        const currentVal = matrix[role.key]?.[mod.key] || 'no_access';
                                        return (
                                            <td key={role.key} className={styles.accessCell}>
                                                <select
                                                    className={styles.accessSelect}
                                                    value={currentVal}
                                                    onChange={(e) => handleChange(role.key, mod.key, e.target.value)}
                                                    style={{
                                                        borderColor: getAccessColor(currentVal),
                                                        opacity: 1,
                                                        cursor: 'pointer',
                                                        pointerEvents: 'auto',
                                                    }}
                                                >
                                                    {ACCESS_OPTIONS.map((opt) => (
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
                    {ACCESS_OPTIONS.map((opt) => (
                        <span key={opt.value} className={styles.legendItem}>
                            <span className={styles.legendDot} style={{ background: opt.color }} />
                            {opt.label}
                        </span>
                    ))}
                </div>
            </div>

            {!isCoAdmin && !isOwner && (
                <div className={styles.card}>
                    <div className={styles.grantHeader}>
                        <FaUserShield className={styles.grantIcon} />
                        <div>
                            <h2 className={styles.sectionTitle} style={{ margin: 0 }}>Grant Admin Access</h2>
                            <p className={styles.sectionNote} style={{ margin: '4px 0 0' }}>
                                Toggle full admin access for individual staff members, overriding their role&apos;s default permissions.
                            </p>
                        </div>
                    </div>

                    <div className={styles.searchBar}>
                        <FaSearch className={styles.searchIcon} />
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={userSearch}
                            onChange={(e) => setUserSearch(e.target.value)}
                            className={styles.searchInput}
                        />
                    </div>

                    <div className={styles.userList}>
                        {filteredUsers.length === 0 ? (
                            <p className={styles.emptyState}>No staff members found.</p>
                        ) : (
                            filteredUsers.map((entry) => (
                                <div key={entry._id} className={styles.userRow}>
                                    <div className={styles.userAvatar}>
                                        {(entry.name?.first?.[0] || '?').toUpperCase()}
                                    </div>
                                    <div className={styles.userDetails}>
                                        <span className={styles.userName}>
                                            {entry.name?.first} {entry.name?.last}
                                        </span>
                                        <span className={styles.userEmail}>{entry.email}</span>
                                    </div>
                                    <span className={styles.roleTag}>{entry.role}</span>
                                    <label className={styles.toggleWrapper}>
                                        <input
                                            type="checkbox"
                                            className={styles.toggleInput}
                                            checked={!!entry.isAdminAccess}
                                            onChange={() => handleGrantAdmin(entry._id, !!entry.isAdminAccess)}
                                            disabled={grantLoading === entry._id}
                                        />
                                        <span className={styles.toggleSlider} />
                                    </label>
                                    <span className={`${styles.accessLabel} ${entry.isAdminAccess ? styles.accessOn : styles.accessOff}`}>
                                        {entry.isAdminAccess ? 'Admin Access' : 'Default'}
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
