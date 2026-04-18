import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEdit } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/ManageDentists.module.css';
import EditBranchManager from './EditBranchManager';

const ManageBranchManagers = () => {
    const navigate = useNavigate();
    const [managers, setManagers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState('');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedManagerId, setSelectedManagerId] = useState(null);

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
    }, []);

    useEffect(() => { fetchManagers(); }, [fetchManagers]);

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Remove ${name} as Branch Manager?`)) return;
        try {
            const res = await authFetch(`/users/${id}`, { method: 'DELETE' });
            if (res.ok) fetchManagers();
            else setError('Failed to delete branch manager.');
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
            <header className={styles.header}>
                <h1 className={styles.title}>Branch Managers</h1>
                <p className={styles.subtitle}>View and manage clinic branch managers.</p>
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
                <button className={styles.addBtn} onClick={() => navigate('/admin/add-branch-manager')}>
                    + Add Branch Manager
                </button>
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
                            <tr><td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No branch managers found.</td></tr>
                        ) : (
                            filtered.map(m => (
                                <tr key={m._id} style={{ opacity: m.status === 'inactive' ? 0.6 : 1 }}>
                                    <td>
                                        <span className={styles.fwBold}>
                                            {m.name?.first} {m.name?.last}
                                        </span>
                                        {!m.isVerified && (
                                            <span style={{ fontSize: '11px', color: '#ef4444', display: 'block', fontWeight: '500', marginTop: '2px' }}>
                                                Unverified Email
                                            </span>
                                        )}
                                    </td>
                                    <td>{m.email}</td>
                                    <td>
                                        {m.assignedBranches?.length > 0
                                            ? m.assignedBranches.join(', ')
                                            : <span style={{ color: '#94a3b8', fontSize: '13px' }}>Not assigned</span>
                                        }
                                    </td>
                                    <td>
                                        <span className={`${styles.statusDot} ${m.status === 'active' ? styles.activeDot : styles.inactiveDot}`}></span>
                                        <span style={{ fontWeight: '500', color: m.status === 'active' ? '#15803d' : '#b91c1c' }}>
                                            {m.status === 'active' ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button
                                            className={styles.iconBtn}
                                            onClick={() => { setSelectedManagerId(m._id); setIsEditModalOpen(true); }}
                                            title="Edit Branch Manager"
                                        >
                                            <FaEdit />
                                        </button>
                                        <button
                                            className={styles.iconBtn}
                                            onClick={() => handleDelete(m._id, `${m.name?.first} ${m.name?.last}`)}
                                            title="Remove Branch Manager"
                                            style={{ color: '#dc2626' }}
                                        >
                                            🗑
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            {isEditModalOpen && selectedManagerId && (
            <EditBranchManager
                managerId={selectedManagerId}
                onClose={() => { setIsEditModalOpen(false); setSelectedManagerId(null); }}
                onSuccess={fetchManagers}
            />
            )}
        </div>
    );
};

export default ManageBranchManagers;