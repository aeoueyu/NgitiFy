import React, { useState, useEffect, useCallback } from 'react';
import styles from '../../styles/owner/ManageDentists.module.css'; 
import { FaSearch, FaUserPlus, FaEdit, FaTrash, FaCheckCircle, FaToggleOn, FaToggleOff } from 'react-icons/fa';
// Removed useNavigate since we are using Modals for everything now!

import AddDentist from './AddDentist'; 
import EditDentist from './EditDentist'; // NEW: Import the Edit Modal

export default function ManageDentists() {
    const [searchQuery, setSearchQuery] = useState('');
    const [dentistsList, setDentistsList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Modal States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false); // NEW
    const [selectedDentistId, setSelectedDentistId] = useState(null); // NEW

    // Extracted fetch function
    const fetchDentists = useCallback(async () => {
        try {
            setIsLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:5000/api/users?role=dentist', {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                
                const mappedDentists = data
                    .filter(u => u.role === 'dentist')
                    .map(u => {
                        let parsedName = 'Unknown Dentist';
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
                    
                setDentistsList(mappedDentists);
            }
        } catch (error) {
            console.error("Failed to fetch dentists:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Initial Fetch
    useEffect(() => {
        fetchDentists();
    }, [fetchDentists]);

    // Filter by Search Query
    const filteredDentists = dentistsList.filter(dentist => 
        dentist.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleToggleStatus = async (dentist) => {
        const newStatus = dentist.status === 'Active' ? 'inactive' : 'active';
        
        if (newStatus === 'active' && !dentist.isVerified) {
            alert(`Cannot activate Dr. ${dentist.name}. Their email is not yet verified.`);
            return;
        }

        const confirmMsg = newStatus === 'active' 
            ? `Are you sure you want to ACTIVATE Dr. ${dentist.name}?` 
            : `Are you sure you want to DEACTIVATE Dr. ${dentist.name}?`;
            
        if (!window.confirm(confirmMsg)) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:5000/api/user/toggle-status/${dentist.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (res.ok) {
                setDentistsList(prevList => prevList.map(d => 
                    d.id === dentist.id ? { ...d, status: newStatus === 'active' ? 'Active' : 'Inactive' } : d
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
    const handleEditClick = (dentistId) => {
        setSelectedDentistId(dentistId);
        setIsEditModalOpen(true);
    };

    // NEW: Close Edit Modal Handler
    const handleCloseEditModal = () => {
        setIsEditModalOpen(false);
        setSelectedDentistId(null);
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Manage Dentists</h1>
                <p className={styles.subtitle}>View, filter, and manage clinic dental professionals.</p>
            </header>

            <div className={styles.controlsRow}>
                <div className={styles.searchWrapper}>
                    <FaSearch className={styles.searchIcon} />
                    <input 
                        type="text" 
                        placeholder="Search dentists by name..." 
                        className={styles.searchInput} 
                        value={searchQuery} 
                        onChange={(e) => setSearchQuery(e.target.value)} 
                    />
                </div>
                
                <button className={styles.addBtn} onClick={() => setIsAddModalOpen(true)}>
                    <FaUserPlus className={styles.btnIcon} /> Add New Dentist
                </button>
            </div>

            <div className={styles.tableContainer}>
                <table className={styles.userTable}>
                    <thead>
                        <tr>
                            <th style={{ width: '70px' }}></th>
                            <th>Dentist Name</th>
                            <th>Contact Number</th>
                            <th style={{ width: '180px' }}>Account Status</th>
                            <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="5" style={{textAlign: 'center', padding: '30px', color: '#64748b'}}>Loading records...</td></tr>
                        ) : filteredDentists.length > 0 ? (
                            filteredDentists.map((dentist) => (
                                <tr key={dentist.id} style={{ opacity: dentist.status === 'Inactive' ? 0.6 : 1 }}>
                                    <td>
                                        <div style={{ 
                                            width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#01538b', 
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white', fontSize: '14px' 
                                        }}>
                                            {dentist.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)}
                                        </div>
                                    </td>
                                    <td className={styles.fwBold}>
                                        Dr. {dentist.name}
                                        {!dentist.isVerified && <span style={{fontSize: '11px', color: '#ff4d4d', display: 'block', fontWeight: 'normal'}}>Unverified Email</span>}
                                    </td>
                                    <td>{dentist.contact}</td>
                                    <td>
                                        <span className={`${styles.statusDot} ${dentist.status === 'Active' ? styles.activeDot : styles.inactiveDot}`}></span>
                                        {dentist.status}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button className={styles.iconBtn} onClick={() => handleEditClick(dentist.id)} title="Edit Profile"><FaEdit /></button>
                                        <button 
                                            className={`${styles.iconBtn}`} 
                                            onClick={() => handleToggleStatus(dentist)}
                                            title={dentist.status === 'Active' ? "Deactivate Account" : "Activate Account"}
                                            style={{ color: dentist.status === 'Inactive' ? '#22c55e' : '#64748b', fontSize: '20px' }}
                                        >
                                            {dentist.status === 'Active' ? <FaToggleOn /> : <FaToggleOff />}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan="5" style={{textAlign: 'center', padding: '30px', color: '#64748b'}}>No dentists found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Conditionally Render the Add Modal */}
            {isAddModalOpen && (
                <AddDentist 
                    onClose={() => setIsAddModalOpen(false)} 
                    onSuccess={fetchDentists} 
                />
            )}

            {/* NEW: Conditionally Render the Edit Modal */}
            {isEditModalOpen && selectedDentistId && (
                <EditDentist 
                    dentistId={selectedDentistId}
                    onClose={handleCloseEditModal} 
                    onSuccess={fetchDentists} 
                />
            )}
        </div>
    );
}