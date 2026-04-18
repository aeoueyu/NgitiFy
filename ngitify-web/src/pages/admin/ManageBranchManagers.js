import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import styles from '../../styles/admin/ManageDentists.module.css'; // reuse same layout styles

const ManageBranchManagers = () => {
    const { authFetch } = useAuth();
    const navigate = useNavigate();
    const [managers, setManagers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState('');

    const fetchManagers = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const res = await authFetch('/users?role=branch-manager');
            if (res.ok) {
                const data = await res.json();
                setManagers(data);
            } else {
                setError('Failed to load branch managers.');
            }
        } catch (e) {
            setError('Network error. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, [authFetch]);

    useEffect(() => { fetchManagers(); }, [fetchManagers]);

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Remove ${name} as Branch Manager?`)) return;
        try {
            const res = await authFetch(`/users/${id}`, { method: 'DELETE' });
            if (res.ok) {
                fetchManagers();
            } else {
                setError('Failed to delete branch manager.');
            }
        } catch (e) {
            setError('Network error during delete.');
        }
    };

    const filtered = managers.filter(m => {
        const fullName = `${m.name?.first ?? ''} ${m.name?.last ?? ''}`.toLowerCase();
        return fullName.includes(searchTerm.toLowerCase()) ||
               (m.email ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    });

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2 className={styles.title}>Branch Managers</h2>
                <button
                    className={styles.addButton}
                    onClick={() => navigate('/admin/add-branch-manager')}
                >
                    + Add Branch Manager
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
                <div className={styles.loadingText}>Loading branch managers...</div>
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
                                    <td colSpan={6} className={styles.noData}>
                                        No branch managers found.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(m => (
                                    <tr key={m._id}>
                                        <td>{m.name?.first} {m.name?.last}</td>
                                        <td>{m.email}</td>
                                        <td>{m.phone || '—'}</td>
                                        <td>
                                            {m.assignedBranches?.length > 0
                                                ? m.assignedBranches.join(', ')
                                                : '—'}
                                        </td>
                                        <td>
                                            <span className={
                                                m.isActive
                                                    ? styles.badgeActive
                                                    : styles.badgeInactive
                                            }>
                                                {m.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className={styles.actionsCell}>
                                            <button
                                                className={styles.editBtn}
                                                onClick={() => navigate(`/admin/edit-branch-manager/${m._id}`)}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                className={styles.deleteBtn}
                                                onClick={() => handleDelete(m._id, `${m.name?.first} ${m.name?.last}`)}
                                            >
                                                Delete
                                            </button>
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

export default ManageBranchManagers;