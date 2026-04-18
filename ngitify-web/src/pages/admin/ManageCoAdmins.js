import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from '../../styles/admin/ManageDentists.module.css';

const ManageCoAdmins = () => {
    const { authFetch } = useAuth();
    const navigate = useNavigate();
    const [coAdmins, setCoAdmins] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState('');

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
    }, [authFetch]);

    useEffect(() => { fetchCoAdmins(); }, [fetchCoAdmins]);

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
            <div className={styles.header}>
                <h2 className={styles.title}>Co-Administrators</h2>
                <button
                    className={styles.addButton}
                    onClick={() => navigate('/admin/add-co-admin')}
                >
                    + Add Co-Administrator
                </button>
            </div>

            <div className={styles.searchContainer}>
                <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Search by name or email..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            {error && <div className={styles.errorMessage}>{error}</div>}

            {isLoading ? (
                <div className={styles.loadingText}>Loading co-administrators...</div>
            ) : (
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Assigned Branches</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className={styles.noData}>No co-administrators found.</td>
                                </tr>
                            ) : (
                                filtered.map(u => (
                                    <tr key={u._id}>
                                        <td>{u.name?.first} {u.name?.last}</td>
                                        <td>{u.email}</td>
                                        <td>{u.phone || '—'}</td>
                                        <td>{u.assignedBranches?.length > 0 ? u.assignedBranches.join(', ') : '—'}</td>
                                        <td>
                                            <span className={u.isActive ? styles.badgeActive : styles.badgeInactive}>
                                                {u.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className={styles.actionsCell}>
                                            <button
                                                className={styles.editBtn}
                                                onClick={() => navigate(`/admin/edit-co-admin/${u._id}`)}
                                            >Edit</button>
                                            <button
                                                className={styles.deleteBtn}
                                                onClick={() => handleDelete(u._id, `${u.name?.first} ${u.name?.last}`)}
                                            >Delete</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default ManageCoAdmins;