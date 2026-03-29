import React, { useState, useEffect, useCallback } from 'react';
import styles from '../../styles/owner/ManageSecretaries.module.css'; 
import { FaSearch, FaUserPlus, FaEdit, FaTrash, FaCheckCircle, FaToggleOn, FaToggleOff } from 'react-icons/fa';

import AddSecretary from './AddSecretary'; 
import EditSecretary from './EditSecretary'; // NEW: Import the Edit Modal

export default function ManageSecretaries() {
    const [searchQuery, setSearchQuery] = useState('');
    const [secretariesList, setSecretariesList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Modal States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false); // NEW
    const [selectedSecretaryId, setSelectedSecretaryId] = useState(null); // NEW

    const fetchSecretaries = useCallback(async () => {
        try {
            setIsLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:5000/api/users?role=secretary', {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                
                const mappedSecretaries = data
                    .filter(u => u.role === 'secretary')
                    .map(u => {
                        let parsedName = 'Unknown Secretary';
                        if (typeof u.name === 'object' && u.name !== null) {
                            parsedName = `${u.name.first || ''} ${u.name.last || ''}`.trim();
                        } else if (u.firstName) {
                            parsedName = `${u.firstName} ${u.lastName || ''}`.trim();
                        } else if (typeof u.name === 'string') {
                            parsedName = u.name;
                        } else if (u.email) {
                            parsedName = u.email;
                        }

                        return {
                            id: u._id,
                            name: parsedName,
                            contact: u.contactNumber || u.phoneNumber || 'N/A',
                            status: u.status === 'active' ? 'Active' : 'Inactive',
                            isVerified: u.isVerified
                        };
                    });
                    
                setSecretariesList(mappedSecretaries);
            }
        } catch (error) {
            console.error("Failed to fetch secretaries:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchSecretaries();
    }, [fetchSecretaries]);

    const filteredSecretaries = secretariesList.filter(secretary => 
        secretary.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleToggleStatus = async (secretary) => {
        const newStatus = secretary.status === 'Active' ? 'inactive' : 'active';
        
        if (newStatus === 'active' && !secretary.isVerified) {
            alert(`Cannot activate ${secretary.name}. Their email is not yet verified.`);
            return;
        }

        const confirmMsg = newStatus === 'active' 
            ? `Are you sure you want to ACTIVATE ${secretary.name}?` 
            : `Are you sure you want to DEACTIVATE ${secretary.name}?`;
            
        if (!window.confirm(confirmMsg)) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:5000/api/user/toggle-status/${secretary.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (res.ok) {
                setSecretariesList(prevList => prevList.map(s => 
                    s.id === secretary.id ? { ...s, status: newStatus === 'active' ? 'Active' : 'Inactive' } : s
                ));
            } else {
                const data = await res.json();
                alert(data.message || "Failed to update status.");
            }
        } catch (error) {
            console.error("Error toggling status:", error);
            alert("Cannot connect to server.");
        }
    };

    // NEW: Open Edit Modal Handler
    const handleEditClick = (id) => {
        setSelectedSecretaryId(id);
        setIsEditModalOpen(true);
    };

    // NEW: Close Edit Modal Handler
    const handleCloseEditModal = () => {
        setIsEditModalOpen(false);
        setSelectedSecretaryId(null);
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Manage Secretaries</h1>
                <p className={styles.subtitle}>View, filter, and manage clinic front desk personnel.</p>
            </header>

            <div className={styles.controlsRow}>
                <div className={styles.searchWrapper}>
                    <FaSearch className={styles.searchIcon} />
                    <input 
                        type="text" 
                        placeholder="Search secretaries by name..." 
                        className={styles.searchInput} 
                        value={searchQuery} 
                        onChange={(e) => setSearchQuery(e.target.value)} 
                    />
                </div>
                
                <button className={styles.addBtn} onClick={() => setIsAddModalOpen(true)}>
                    <FaUserPlus className={styles.btnIcon} /> Add New Secretary
                </button>
            </div>

            <div className={styles.tableContainer}>
                <table className={styles.userTable}>
                    <thead>
                        <tr>
                            <th style={{ width: '70px' }}></th>
                            <th>Secretary Name</th>
                            <th>Contact Number</th>
                            <th style={{ width: '180px' }}>Account Status</th>
                            <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="5" style={{textAlign: 'center', padding: '30px', color: '#64748b'}}>Loading records...</td></tr>
                        ) : filteredSecretaries.length > 0 ? (
                            filteredSecretaries.map((secretary) => (
                                <tr key={secretary.id} style={{ opacity: secretary.status === 'Inactive' ? 0.6 : 1 }}>
                                    <td>
                                        <div style={{ 
                                            width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#01538b', 
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white', fontSize: '14px' 
                                        }}>
                                            {/* Kukuha ng initials base sa secretary.name */}
                                            {secretary.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                                        </div>
                                    </td>
                                    <td className={styles.fwBold}>
                                        {secretary.name}
                                        {!secretary.isVerified && <span style={{fontSize: '11px', color: '#ff4d4d', display: 'block', fontWeight: 'normal'}}>Unverified Email</span>}
                                    </td>
                                    <td>{secretary.contact}</td>
                                    <td>
                                        <span className={`${styles.statusDot} ${secretary.status === 'Active' ? styles.activeDot : styles.inactiveDot}`}></span>
                                        {secretary.status}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button className={styles.iconBtn} onClick={() => handleEditClick(secretary.id)} title="Edit Profile"><FaEdit /></button>
                                        <button 
                                            className={`${styles.iconBtn}`} 
                                            onClick={() => handleToggleStatus(secretary)}
                                            title={secretary.status === 'Active' ? "Deactivate Account" : "Activate Account"}
                                            style={{ color: secretary.status === 'Inactive' ? '#22c55e' : '#64748b', fontSize: '20px' }}
                                        >
                                            {secretary.status === 'Active' ? <FaToggleOn /> : <FaToggleOff />}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan="5" style={{textAlign: 'center', padding: '30px', color: '#64748b'}}>No secretaries found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modals */}
            {isAddModalOpen && (
                <AddSecretary onClose={() => setIsAddModalOpen(false)} onSuccess={fetchSecretaries} />
            )}

            {isEditModalOpen && selectedSecretaryId && (
                <EditSecretary 
                    secretaryId={selectedSecretaryId}
                    onClose={handleCloseEditModal} 
                    onSuccess={fetchSecretaries} 
                />
            )}
        </div>
    );
}