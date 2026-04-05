import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/dentist/DentistAppointments.module.css';
import { 
    FaClock, FaFileMedical, FaSearch, FaCalendarAlt,
    FaBoxOpen, FaTrash, FaPlus
} from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';

// Import the existing EMR Patient Profile component
import PatientProfile from '../owner/PatientProfile';

// --- MOCK CLINICAL DATA ---
const MOCK_SCHEDULE = [
    { id: 1, patientId: 'PT-2023-0842', time: '09:00 AM', duration: '60 Min', patientName: 'Eleanor Vance', procedure: 'Root Canal Therapy', status: 'In Clinic', rawDate: new Date() },
    { id: 2, patientId: 'PT-2024-1105', time: '10:30 AM', duration: '30 Min', patientName: 'Marcus Chen', procedure: 'Routine Prophylaxis', status: 'Confirmed', rawDate: new Date() },
    { id: 3, patientId: 'PT-2023-0199', time: '11:15 AM', duration: '45 Min', patientName: 'Sophia Reyes', procedure: 'Composite Filling', status: 'Confirmed', rawDate: new Date() },
    { id: 4, patientId: 'PT-2022-0441', time: '01:00 PM', duration: '60 Min', patientName: 'James Wilson', procedure: 'Tooth Extraction', status: 'Completed', rawDate: new Date(new Date().setDate(new Date().getDate() - 1)) },
    { id: 5, patientId: 'PT-2021-0911', time: '09:00 AM', duration: '60 Min', patientName: 'David Lee', procedure: 'Braces Adjustment', status: 'Confirmed', rawDate: new Date(new Date().setDate(new Date().getDate() + 1)) },
    { id: 6, patientId: 'PT-2023-0222', time: '11:00 AM', duration: '45 Min', patientName: 'Maria Santos', procedure: 'Crown Fitting', status: 'Confirmed', rawDate: new Date(new Date().setDate(new Date().getDate() + 1)) },
];

const MOCK_INVENTORY = [
    { id: 'inv1', name: 'Lidocaine 2% Carpule', unit: 'pcs', stock: 150 },
    { id: 'inv2', name: 'Composite Resin (A2)', unit: 'grams', stock: 45 },
    { id: 'inv3', name: 'Disposable Latex Gloves', unit: 'pairs', stock: 300 },
    { id: 'inv4', name: 'Sterile Gauze Pads', unit: 'packs', stock: 200 },
    { id: 'inv5', name: 'Prophylaxis Paste', unit: 'cups', stock: 80 },
    { id: 'inv6', name: 'Suture Silk 3-0', unit: 'pcs', stock: 25 },
];

export default function DentistAppointments() {
    const { user, logout } = useAuth();
    const navigate = useNavigate(); 
    
    const [dentistProfile, setDentistProfile] = useState(null);

    // Header & Global Modal States
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false); 
    
    // EMR Modal States
    const [isEMRModalOpen, setIsEMRModalOpen] = useState(false);
    const [selectedPatientId, setSelectedPatientId] = useState(null);

    // --- FILTER STATES ---
    const [searchQuery, setSearchQuery] = useState('');
    const [procedureFilter, setProcedureFilter] = useState('All');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Material Logger Modal States
    const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
    const [selectedAptForMaterial, setSelectedAptForMaterial] = useState(null);
    const [usedMaterials, setUsedMaterials] = useState([{ itemId: '', quantity: 1 }]);

    // Extract JWT & Fetch Profile
    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) return;

                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const payload = JSON.parse(atob(base64));
                const userId = payload.userId || payload.id || payload._id;

                const response = await fetch(`http://localhost:5000/api/user/${userId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const profileData = await response.json();
                    setDentistProfile(profileData);
                }
            } catch (error) {
                console.error("Error fetching dentist profile:", error);
            }
        };

        fetchProfile();
    }, []);

    // --- FILTER LOGIC ---
    const displayedAppointments = MOCK_SCHEDULE.filter(apt => {
        const searchLower = searchQuery.toLowerCase();
        const matchesSearch = apt.patientName.toLowerCase().includes(searchLower) || 
                              apt.procedure.toLowerCase().includes(searchLower);
        
        const matchesProcedure = procedureFilter === 'All' || apt.procedure === procedureFilter;
        
        let matchesDate = true;
        if (startDate) {
            matchesDate = matchesDate && new Date(apt.rawDate) >= new Date(startDate);
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999); // Include the whole end day
            matchesDate = matchesDate && new Date(apt.rawDate) <= end;
        }

        return matchesSearch && matchesProcedure && matchesDate;
    });

    // --- RENDER HELPERS ---
    const getStatusClass = (status) => {
        switch (status) {
            case 'Confirmed': return styles['status-pending'];
            case 'In Clinic': return styles['status-in-clinic'];
            case 'Completed': return styles['status-done'];
            default: return '';
        }
    };

    const handleLogoutClick = () => {
        setIsProfileOpen(false);
        setShowLogoutModal(true);
    };

    const handleProfileNavigation = () => {
        setIsProfileOpen(false);
        navigate('/owner/profile'); 
    };

    const handleViewEMR = (patientId) => {
        setSelectedPatientId(patientId);
        setIsEMRModalOpen(true);
    };

    // --- MATERIAL LOGGER HANDLERS ---
    const handleOpenMaterialLog = (apt) => {
        setSelectedAptForMaterial(apt);
        setUsedMaterials([{ itemId: '', quantity: 1 }]);
        setIsMaterialModalOpen(true);
    };

    const handleAddMaterialRow = () => {
        setUsedMaterials(prev => [...prev, { itemId: '', quantity: 1 }]);
    };

    const handleRemoveMaterialRow = (index) => {
        setUsedMaterials(prev => prev.filter((_, i) => i !== index));
    };

    const handleMaterialChange = (index, field, value) => {
        setUsedMaterials(prev => {
            const updated = [...prev];
            updated[index][field] = value;
            return updated;
        });
    };

    const handleSaveMaterials = (e) => {
        e.preventDefault();
        alert(`Successfully logged ${usedMaterials.length} items for ${selectedAptForMaterial.patientName}. Inventory stock will be deducted.`);
        setIsMaterialModalOpen(false);
        setSelectedAptForMaterial(null);
    };

    return (
        <>
            <main className={styles['main-content']}>
                {/* HEADER */}
                <header className={styles['header']}>
                    <div className={styles['header-left']}>
                        <h1 className={styles['title']}>Clinical Appointments</h1>
                        <p className={styles['subtitle']}>Manage your patient schedule, access EMRs, and log materials.</p>
                    </div>
                    <div className={styles['header-right']}>
                        <div className={styles['user-info']}>
                            <span className={styles['user-name']}>Hello, Dr. {dentistProfile?.name?.first || user?.name?.first || 'Dentist'}!</span>
                            <span className={styles['user-role']}>
                                {dentistProfile?.role || user?.role === 'dentist' ? 'Dentist' : 'Staff'}
                            </span>
                        </div>
                        <div className={styles['profile-wrapper']} onClick={() => setIsProfileOpen(!isProfileOpen)}>
                            {dentistProfile?.profileImage || user?.profileImage ? (
                                <img src={dentistProfile?.profileImage || user?.profileImage} alt="Profile" className={styles['profile-pic']} />
                            ) : (
                                <div className={styles['profile-pic']} style={{
                                    backgroundColor: '#01538b', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', fontWeight: 'bold', color: 'white', fontSize: '16px',
                                    borderRadius: '50%'
                                }}>
                                    {(() => {
                                        const first = dentistProfile?.name?.first || user?.name?.first || 'S';
                                        const last = dentistProfile?.name?.last || user?.name?.last || 'D';
                                        return (first.charAt(0) + last.charAt(0)).toUpperCase();
                                    })()}
                                </div>
                            )}
                            {isProfileOpen && (
                                <div className={styles['profile-dropdown']}>
                                    <div className={styles['profile-dropdown-item']} onClick={handleProfileNavigation}>My Profile</div>
                                    <div className={styles['profile-dropdown-item']} onClick={() => navigate('/owner/settings')}>Settings</div>
                                    <div className={`${styles['profile-dropdown-item']} ${styles['logout']}`} onClick={handleLogoutClick}>Logout</div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* --- NEW FILTER CONTROLS --- */}
                <div className={styles.controlsRow}>
                    <div className={styles.searchFilterGroup}>
                        <div className={styles.searchWrapper}>
                            <FaSearch className={styles.searchIcon} />
                            <input 
                                type="text" 
                                placeholder="Search patient name or procedure..." 
                                className={styles.searchInput} 
                                value={searchQuery} 
                                onChange={(e) => setSearchQuery(e.target.value)} 
                            />
                        </div>
                        
                        <select 
                            className={styles.filterSelect} 
                            value={procedureFilter}
                            onChange={(e) => setProcedureFilter(e.target.value)}
                        >
                            <option value="All">All Procedures</option>
                            <option value="Root Canal Therapy">Root Canal Therapy</option>
                            <option value="Routine Prophylaxis">Routine Prophylaxis</option>
                            <option value="Composite Filling">Composite Filling</option>
                            <option value="Tooth Extraction">Tooth Extraction</option>
                            <option value="Braces Adjustment">Braces Adjustment</option>
                            <option value="Crown Fitting">Crown Fitting</option>
                        </select>

                        <div className={styles.dateFilterWrapper}>
                            <FaCalendarAlt style={{ color: '#94a3b8' }} />
                            <input 
                                type="date" 
                                className={styles.dateInput} 
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                title="From Date"
                            />
                            <span className={styles.dateSeparator}>-</span>
                            <input 
                                type="date" 
                                className={styles.dateInput} 
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                title="To Date"
                            />
                        </div>
                    </div>
                </div>

                {/* FULL WIDTH SCHEDULE LIST */}
                <div className={styles['listContainer']}>
                    {displayedAppointments.length > 0 ? (
                        displayedAppointments.map((apt) => (
                            <div key={apt.id} className={styles['appointment-item']}>
                                
                                <div className={styles['time-block']}>
                                    <p className={styles['time-text']}>{apt.rawDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                    <p className={styles['stat-desc']}>
                                        <FaClock style={{ fontSize: '10px' }}/> {apt.time} • {apt.duration}
                                    </p>
                                </div>
                                
                                <div className={styles['patient-block']}>
                                    <p className={styles['patient-name']}>{apt.patientName}</p>
                                    <p className={styles['treatment-type']}>{apt.procedure}</p>
                                </div>

                                <div className={styles['action-block']}>
                                    <span className={`${styles['status-badge']} ${getStatusClass(apt.status)}`}>
                                        {apt.status}
                                    </span>
                                    
                                    <button className={styles['emr-btn']} onClick={() => handleViewEMR(apt.patientId)}>
                                        <FaFileMedical /> View EMR
                                    </button>

                                    {/* CONDITIONAL RENDER: Log Materials Button */}
                                    {apt.status === 'Completed' && (
                                        <button className={styles['logMaterialsBtn']} onClick={() => handleOpenMaterialLog(apt)}>
                                            <FaBoxOpen /> Log Materials
                                        </button>
                                    )}
                                </div>

                            </div>
                        ))
                    ) : (
                        <div className={styles['empty-state']}>
                            <p>No appointments match your current filters.</p>
                        </div>
                    )}
                </div>
            </main>

            {/* EMR MODAL INJECTION */}
            {isEMRModalOpen && selectedPatientId && (
                <PatientProfile
                    patientId={selectedPatientId}
                    onClose={() => setIsEMRModalOpen(false)}
                    onEdit={() => alert("Edit Profile action placeholder")}
                />
            )}

            {/* POST-TREATMENT MATERIAL LOGGER MODAL (THEME FIXED) */}
            {isMaterialModalOpen && selectedAptForMaterial && (
                <div className={styles.modalOverlay}>
                    <div className={styles.materialModalCard}>
                        <div className={styles.materialHeaderInfo}>
                            <h2 className={styles.modalTitle} style={{ color: '#01538b', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <FaBoxOpen /> Log Materials Used
                            </h2>
                            <p className={styles.materialPatientName}>{selectedAptForMaterial.patientName}</p>
                            <p className={styles.materialProcedure}>{selectedAptForMaterial.procedure} • {selectedAptForMaterial.rawDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                        </div>

                        <form onSubmit={handleSaveMaterials}>
                            <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '5px', marginBottom: '15px' }}>
                                {usedMaterials.map((row, idx) => (
                                    <div key={idx} className={styles.materialRow}>
                                        <select 
                                            className={styles.materialSelect}
                                            required
                                            value={row.itemId}
                                            onChange={(e) => handleMaterialChange(idx, 'itemId', e.target.value)}
                                        >
                                            <option value="" disabled hidden>Select item from inventory...</option>
                                            {MOCK_INVENTORY.map(item => (
                                                <option key={item.id} value={item.id}>
                                                    {item.name} ({item.stock} {item.unit} available)
                                                </option>
                                            ))}
                                        </select>
                                        
                                        <input 
                                            type="number" 
                                            min="1" 
                                            placeholder="Qty"
                                            className={styles.qtyInput}
                                            required
                                            value={row.quantity}
                                            onChange={(e) => handleMaterialChange(idx, 'quantity', e.target.value)}
                                        />

                                        <button 
                                            type="button" 
                                            className={styles.removeBtn}
                                            onClick={() => handleRemoveMaterialRow(idx)}
                                            disabled={usedMaterials.length === 1}
                                            style={{ opacity: usedMaterials.length === 1 ? 0.5 : 1, cursor: usedMaterials.length === 1 ? 'not-allowed' : 'pointer' }}
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <button type="button" className={styles.addMaterialRowBtn} onClick={handleAddMaterialRow}>
                                <FaPlus style={{ marginRight: '6px' }}/> Add Another Item
                            </button>

                            <div className={styles.modalButtonGroup} style={{ justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
                                <button type="button" className={styles.cancelBtn} onClick={() => setIsMaterialModalOpen(false)}>Cancel</button>
                                <button type="submit" className={styles.saveMaterialBtn}>Save & Deduct Stock</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* LOGOUT CONFIRMATION MODAL */}
            {showLogoutModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard}>
                        <h3 className={styles.modalTitle}>Confirm Logout</h3>
                        <p className={styles.modalMessage}>Are you sure you want to end your session and logout of the system?</p>
                        <div className={styles.modalButtonGroup}>
                            <button className={styles.cancelBtn} onClick={() => setShowLogoutModal(false)}>Cancel</button>
                            <button className={styles.confirmBtn} onClick={logout}>Yes, Logout</button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}