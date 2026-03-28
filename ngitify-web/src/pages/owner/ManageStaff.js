import React, { useState } from 'react';
import styles from '../../styles/owner/ManageStaff.module.css';
import { FaSearch, FaUserPlus, FaEdit, FaTrash } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom'; // I-import ang useNavigate

export default function ManageStaff() {
    const navigate = useNavigate(); // I-initialize ang navigate
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('Dentist');

    const [usersList, setUsersList] = useState([
        { id: 1, name: 'Dr. Aeiou Garcia', role: 'Dentist', contact: '0912-345-6789', status: 'Active' },
        { id: 3, name: 'Maria Clara', role: 'Secretary', contact: '0911-111-2222', status: 'Active' },
        { id: 5, name: 'Juan Dela Cruz', role: 'Patient', contact: '0933-444-5555', status: 'Active' },
    ]);

    const filteredUsers = usersList.filter(user => 
        user.role === activeTab && user.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Function para pumunta sa tamang Add Page depende sa active tab
    const handleAddNew = () => {
        if (activeTab === 'Dentist') navigate('/owner/add-dentist');
        else if (activeTab === 'Secretary') navigate('/owner/add-secretary');
        else if (activeTab === 'Patient') navigate('/owner/add-patient');
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
                    <input type="text" placeholder={`Search ${activeTab.toLowerCase()}...`} className={styles.searchInput} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>
                
                {/* DITO NAGBAGO: Tatawagin na niya ang handleAddNew para lumipat ng page */}
                <button className={styles.addBtn} onClick={handleAddNew}>
                    <FaUserPlus className={styles.btnIcon} /> Add New {activeTab}
                </button>
            </div>

            <div className={styles.tableContainer}>
                <table className={styles.userTable}>
                    <thead><tr><th>Name</th><th>Role</th><th>Contact</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                        {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                            <tr key={user.id}>
                                <td className={styles.fwBold}>{user.name}</td>
                                <td><span className={`${styles.roleBadge} ${styles[user.role.toLowerCase()]}`}>{user.role}</span></td>
                                <td>{user.contact}</td>
                                <td><span className={`${styles.statusDot} ${styles.activeDot}`}></span>{user.status}</td>
                                <td><button className={styles.iconBtn}><FaEdit /></button><button className={`${styles.iconBtn} ${styles.deleteBtn}`}><FaTrash /></button></td>
                            </tr>
                        )) : <tr><td colSpan="5" style={{textAlign: 'center', padding: '30px', color: '#64748b'}}>No records found.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}