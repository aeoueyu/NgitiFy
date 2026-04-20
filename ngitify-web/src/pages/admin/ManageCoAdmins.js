import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEdit, FaEnvelope } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/ManageDentists.module.css';
import EditCoAdmin from './EditCoAdmin';
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

    const isCoAdmin = currentUser?.role === 'co-administrator';

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
        } catch (e) {
            setError('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchCoAdmins(); }, [fetchCoAdmins]);

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

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Remove ${name} as Co-Administrator?`)) return;
        try {
            const res = await authFetch(`/users/${id}`, { method: 'DELETE' });
            if (res.ok) fetchCoAdmins();
            else setError('Failed to delete co-administrator.');
        } catch (e) {
            setError('Network error during delete.');
        }
    };

    const filtered = coAdmins.filter(u => {
        const fullName = `${u.name?.first ?? ''} ${u.name?.last ?? ''}`.toLowerCase();
        return fullName.includes(searchTerm.toLowerCase()) ||
               (u.email ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    });

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
                {/* Co-admins can view but cannot add new co-admins */}
                {!isCoAdmin && (
                    <button className={styles.addBtn} onClick={() => navigate('/admin/add-co-admin')}>
                        + Add Co-Administrator
                    </button>
                )}
            </div>

            {error && <div style={{ color: '#dc2626', padding: '10px', marginBottom: '10px' }}>{error}</div>}

            <div className={styles.tableContainer}>
                <table className={styles.userTable}>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email Address</th>
                            <th>Assigned Branches</th>
                            <th style={{ width: '180px' }}>Account Status</th>
                            <th style={{ width: '140px', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Loading records...</td></tr>
                        ) : filtered.length === 0 ? (
                            <tr><td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No co-administrators found.</td></tr>
                        ) : (
                            filtered.map(u => (
                                <tr key={u._id} style={{ opacity: u.status === 'inactive' ? 0.6 : 1 }}>
                                    <td>
                                        <span className={styles.fwBold}>
                                            {u.name?.first} {u.name?.last}
                                        </span>
                                        {!u.isVerified && (
                                            <span style={{ fontSize: '11px', color: '#ef4444', display: 'block', fontWeight: '500', marginTop: '2px' }}>
                                                Unverified Email
                                            </span>
                                        )}
                                    </td>
                                    <td>{u.email}</td>
                                    <td>
                                        {u.assignedBranches?.length > 0
                                            ? u.assignedBranches.join(', ')
                                            : <span style={{ color: '#94a3b8', fontSize: '13px' }}>Not assigned</span>
                                        }
                                    </td>
                                    <td>
                                        <span className={`${styles.statusDot} ${u.status === 'active' ? styles.activeDot : styles.inactiveDot}`}></span>
                                        <span style={{ fontWeight: '500', color: u.status === 'active' ? '#15803d' : '#b91c1c' }}>
                                            {u.status === 'active' ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button
                                            className={styles.iconBtn}
                                            onClick={() => { setSelectedCoAdminId(u._id); setIsEditModalOpen(true); }}
                                            title="Edit Co-Administrator"
                                        >
                                            <FaEdit />
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
                                        {/* Co-admins cannot delete other co-admin accounts */}
                                        {!isCoAdmin && (
                                            <button
                                                className={styles.iconBtn}
                                                onClick={() => handleDelete(u._id, `${u.name?.first} ${u.name?.last}`)}
                                                title="Remove Co-Administrator"
                                                style={{ color: '#dc2626' }}
                                            >
                                                🗑
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            {isEditModalOpen && selectedCoAdminId && (
            <EditCoAdmin
                coAdminId={selectedCoAdminId}
                onClose={() => { setIsEditModalOpen(false); setSelectedCoAdminId(null); }}
                onSuccess={fetchCoAdmins}
            />
            )}
        </div>
    );
};

export default ManageCoAdmins;