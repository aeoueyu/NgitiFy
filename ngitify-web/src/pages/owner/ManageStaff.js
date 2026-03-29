import React, { useState, useEffect } from 'react';
import styles from '../../styles/owner/ManageStaff.module.css';
import { FaSearch, FaUserPlus, FaEdit, FaTrash, FaCheckCircle } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

export default function ManageStaff() {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('Dentist');
    const [usersList, setUsersList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch Users on Component Mount
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                setIsLoading(true);
                const token = localStorage.getItem('token');
                const response = await fetch('http://localhost:5000/api/users', {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    // Map backend data to match your UI's expected format
                    const mappedUsers = data.map(u => ({
                        id: u._id,
                        name: u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : (u.name || u.email), // Fallback
                        role: u.role ? u.role.charAt(0).toUpperCase() + u.role.slice(1) : 'Unknown', // Capitalize for UI
                        rawRole: u.role || 'unknown', // Keep raw role for precise filtering
                        contact: u.contactNumber || u.phoneNumber || 'N/A',
                        status: u.status === 'active' ? 'Active' : 'Inactive',
                        isVerified: u.isVerified
                    }));
                    setUsersList(mappedUsers);
                }
            } catch (error) {
                console.error("Failed to fetch users:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUsers();
    }, []);

    // Filter by Active Tab and Search Query
    const filteredUsers = usersList.filter(user => 
        String(user.rawRole || '').toLowerCase() === String(activeTab || '').toLowerCase() && 
        String(user.name || '').toLowerCase().includes(String(searchQuery || '').toLowerCase())
    );

    // Route to the respective Add Pages
    const handleAddNew = () => {
        if (activeTab === 'Dentist') navigate('/owner/add-dentist');
        else if (activeTab === 'Secretary') navigate('/owner/add-secretary');
        else if (activeTab === 'Patient') navigate('/owner/add-patient');
    };

    // Soft Delete / Toggle Status Implementation
    const handleToggleStatus = async (user) => {
        const newStatus = user.status === 'Active' ? 'inactive' : 'active';
        
        // Backend Security Check: Prevent activating unverified users
        if (newStatus === 'active' && !user.isVerified) {
            alert(`Cannot activate ${user.name}. Their email is not yet verified.`);
            return;
        }

        const confirmMsg = newStatus === 'active' 
            ? `Are you sure you want to ACTIVATE ${user.name}?` 
            : `Are you sure you want to DEACTIVATE ${user.name}?`;
            
        if (!window.confirm(confirmMsg)) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:5000/api/user/toggle-status/${user.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            const data = await res.json();

            if (res.ok) {
                // Update local state to reflect change immediately without needing to refresh
                setUsersList(prevList => prevList.map(u => 
                    u.id === user.id ? { ...u, status: newStatus === 'active' ? 'Active' : 'Inactive' } : u
                ));
            } else {
                alert(data.message || "Failed to update status.");
            }
        } catch (error) {
            console.error("Error toggling status:", error);
            alert("Cannot connect to server.");
        }
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>User Management</h1>
                <p className={styles.subtitle}>View, filter, and manage clinic personnel and patients.</p>
            </header>

            <div className={styles.tabsContainer}>
                <button className={`${styles.tabButton} ${activeTab === 'Dentist' ? styles.activeTab : ''}`} onClick={() => setActiveTab('Dentist')}>Dentist Accounts</button>
                <button className={`${styles.tabButton} ${activeTab === 'Secretary' ? styles.activeTab : ''}`} onClick={() => setActiveTab('Secretary')}>Secretary Accounts</button>
                <button className={`${styles.tabButton} ${activeTab === 'Patient' ? styles.activeTab : ''}`} onClick={() => setActiveTab('Patient')}>Patient Accounts</button>
            </div>

            <div className={styles.controlsRow}>
                <div className={styles.searchWrapper}>
                    <FaSearch className={styles.searchIcon} />
                    <input 
                        type="text" 
                        placeholder={`Search ${activeTab.toLowerCase()}...`} 
                        className={styles.searchInput} 
                        value={searchQuery} 
                        onChange={(e) => setSearchQuery(e.target.value)} 
                    />
                </div>
                
                <button className={styles.addBtn} onClick={handleAddNew}>
                    <FaUserPlus className={styles.btnIcon} /> Add New {activeTab}
                </button>
            </div>

            <div className={styles.tableContainer}>
                <table className={styles.userTable}>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Contact</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="5" style={{textAlign: 'center', padding: '30px', color: '#64748b'}}>Loading records...</td></tr>
                        ) : filteredUsers.length > 0 ? (
                            filteredUsers.map((user) => (
                                <tr key={user.id} style={{ opacity: user.status === 'Inactive' ? 0.6 : 1 }}>
                                    <td className={styles.fwBold}>
                                        {user.name}
                                        {!user.isVerified && <span style={{fontSize: '11px', color: '#ff4d4d', display: 'block', fontWeight: 'normal'}}>Unverified</span>}
                                    </td>
                                    <td><span className={`${styles.roleBadge} ${styles[user.role.toLowerCase()]}`}>{user.role}</span></td>
                                    <td>{user.contact}</td>
                                    <td>
                                        <span className={`${styles.statusDot} ${user.status === 'Active' ? styles.activeDot : styles.inactiveDot}`}></span>
                                        {user.status}
                                    </td>
                                    <td>
                                        {/* Edit Button Setup (Route placeholder) */}
                                        <button 
                                            className={styles.iconBtn} 
                                            onClick={() => navigate(`/owner/edit-${user.rawRole}/${user.id}`)}
                                            title="Edit User"
                                        >
                                            <FaEdit />
                                        </button>
                                        
                                        {/* Toggle Status Button */}
                                        <button 
                                            className={`${styles.iconBtn} ${user.status === 'Active' ? styles.deleteBtn : styles.activeBtn}`} 
                                            onClick={() => handleToggleStatus(user)}
                                            title={user.status === 'Active' ? "Deactivate User" : "Activate User"}
                                            style={{ color: user.status === 'Inactive' ? 'green' : undefined }}
                                        >
                                            {user.status === 'Active' ? <FaTrash /> : <FaCheckCircle />}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan="5" style={{textAlign: 'center', padding: '30px', color: '#64748b'}}>No records found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}