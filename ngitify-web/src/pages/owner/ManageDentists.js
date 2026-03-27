import React, { useState } from 'react';
import styles from '../../styles/owner/ManageStaff.module.css';
import { FaSearch, FaUserPlus, FaEdit, FaTrash } from 'react-icons/fa';

export default function ManageDentists() {
    // State para sa Search at Active Tab (Naka-default sa Dentist)
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('Dentist');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ name: '', role: 'Dentist', contact: '', status: 'Active' });

    // Dummy Data ng mga Users
    const [usersList, setUsersList] = useState([
        { id: 1, name: 'Dr. Aeiou Garcia', role: 'Dentist', contact: '0912-345-6789', status: 'Active' },
        { id: 2, name: 'Dr. Jose Rizal', role: 'Dentist', contact: '0998-765-4321', status: 'Active' },
        { id: 3, name: 'Maria Clara', role: 'Secretary', contact: '0911-111-2222', status: 'Active' },
        { id: 4, name: 'Andres Bonifacio', role: 'Secretary', contact: '0922-333-4444', status: 'On Leave' },
        { id: 5, name: 'Juan Dela Cruz', role: 'Patient', contact: '0933-444-5555', status: 'Active' },
    ]);

    // Filtering Logic: I-papakita lang ang users kung ano yung Active Tab
    const filteredUsers = usersList.filter(user => {
        const matchesTab = user.role === activeTab;
        const matchesSearch = user.name.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesTab && matchesSearch;
    });

    const handleAddUser = (e) => {
        e.preventDefault();
        if (!formData.name || !formData.contact) return;
        
        const newId = usersList.length + 1;
        // Papasok yung bagong user tapos automatic mapupunta kung anong tab ang pinili sa modal
        setUsersList([...usersList, { id: newId, ...formData }]);
        
        setIsModalOpen(false);
        setFormData({ name: '', role: 'Dentist', contact: '', status: 'Active' });
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>User Management</h1>
                <p className={styles.subtitle}>View, filter, and manage clinic personnel and patients.</p>
            </header>

            {/* =========================================
                MGA SUB-TABS (Dentist, Secretary, Patient)
                ========================================= */}
            <div className={styles.tabsContainer}>
                <button 
                    className={`${styles.tabButton} ${activeTab === 'Dentist' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('Dentist')}
                >
                    Dentist Accounts
                </button>
                <button 
                    className={`${styles.tabButton} ${activeTab === 'Secretary' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('Secretary')}
                >
                    Secretary Accounts
                </button>
                <button 
                    className={`${styles.tabButton} ${activeTab === 'Patient' ? styles.activeTab : ''}`}
                    onClick={() => setActiveTab('Patient')}
                >
                    Patient Accounts
                </button>
            </div>

            {/* CONTROLS */}
            <div className={styles.controlsRow}>
                <div className={styles.searchWrapper}>
                    <FaSearch className={styles.searchIcon} />
                    <input 
                        type="text" 
                        placeholder={`Search ${activeTab.toLowerCase()} name...`} 
                        className={styles.searchInput}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <button className={styles.addBtn} onClick={() => setIsModalOpen(true)}>
                    <FaUserPlus className={styles.btnIcon} /> Add New {activeTab}
                </button>
            </div>

            {/* TABLE AREA */}
            <div className={styles.tableContainer}>
                <table className={styles.userTable}>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Contact Number</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.length > 0 ? (
                            filteredUsers.map((user) => (
                                <tr key={user.id}>
                                    <td className={styles.fwBold}>{user.name}</td>
                                    <td>
                                        <span className={`${styles.roleBadge} ${styles[user.role.toLowerCase()]}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td>{user.contact}</td>
                                    <td>
                                        <span className={`${styles.statusDot} ${user.status === 'Active' ? styles.activeDot : styles.leaveDot}`}></span>
                                        {user.status}
                                    </td>
                                    <td>
                                        <button className={styles.iconBtn} title="Edit User"><FaEdit /></button>
                                        <button className={`${styles.iconBtn} ${styles.deleteBtn}`} title="Delete User"><FaTrash /></button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                                    No {activeTab} records found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAL (Pop-up Form) */}
            {isModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalBox}>
                        <div className={styles.modalHeader}>
                            {/* Dynamic title base sa tab */}
                            <h2 className={styles.modalTitle}>Add New {activeTab}</h2>
                        </div>
                        
                        <form onSubmit={handleAddUser}>
                            <div className={styles.formGroup}>
                                <label>Full Name</label>
                                <input 
                                    type="text" 
                                    className={styles.formInput} 
                                    placeholder="e.g. Juan Dela Cruz" 
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    required
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Role</label>
                                <select 
                                    className={styles.formInput}
                                    value={formData.role}
                                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                                >
                                    <option value="Dentist">Dentist</option>
                                    <option value="Secretary">Secretary</option>
                                    <option value="Patient">Patient</option>
                                </select>
                            </div>

                            <div className={styles.formGroup}>
                                <label>Contact Number</label>
                                <input 
                                    type="text" 
                                    className={styles.formInput} 
                                    placeholder="e.g. 0912-345-6789" 
                                    value={formData.contact}
                                    onChange={(e) => setFormData({...formData, contact: e.target.value})}
                                    required
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Status</label>
                                <select 
                                    className={styles.formInput}
                                    value={formData.status}
                                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                                >
                                    <option value="Active">Active</option>
                                    <option value="On Leave">On Leave</option>
                                </select>
                            </div>

                            <div className={styles.modalActions}>
                                <button type="button" className={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>Cancel</button>
                                <button type="submit" className={styles.saveBtn}>Save Account</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}