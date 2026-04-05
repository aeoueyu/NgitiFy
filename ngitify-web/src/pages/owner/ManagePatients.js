import React, { useState, useEffect, useCallback } from 'react';
import styles from '../../styles/owner/ManagePatients.module.css'; 
import { FaSearch, FaUserPlus, FaEdit, FaEye, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import { usePermissions } from '../../hooks/usePermissions'; 
import { useAuth } from '../../hooks/useAuth';

import UserTabs from './UserTabs'; 
import AddPatient from './AddPatient'; 
import EditPatient from './EditPatient';
import PatientProfile from './PatientProfile'; // NEW: Import the Modal Profile

export default function ManagePatients() {
    const { user } = useAuth();
    const { canReadPatients, canEditPatients } = usePermissions(); 
    
    const [searchQuery, setSearchQuery] = useState('');
    const [patientsList, setPatientsList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Modal States
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false); // Restored state
    const [selectedPatientId, setSelectedPatientId] = useState(null);

    const isOwner = user?.role === 'owner' || user?.role === 'co-owner';

    const fetchPatients = useCallback(async () => {
        try {
            setIsLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:5000/api/users?role=patient', {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                
                const mappedPatients = data
                    .filter(u => u.role === 'patient')
                    .map(p => {
                        let parsedName = 'Unknown Patient';
                        if (typeof p.name === 'object' && p.name !== null) {
                            parsedName = `${p.name.first || ''} ${p.name.last || ''}`.trim();
                        } else if (p.firstName) {
                            parsedName = `${p.firstName} ${p.lastName || ''}`.trim();
                        } else if (typeof p.name === 'string') {
                            parsedName = p.name;
                        } else if (p.email) {
                            parsedName = p.email;
                        }

                        let dobFormatted = 'N/A';
                        if (p.dateOfBirth || p.dob) {
                            const d = new Date(p.dateOfBirth || p.dob);
                            if (!isNaN(d)) {
                                dobFormatted = d.toLocaleDateString('en-US', { 
                                    year: 'numeric', month: 'short', day: 'numeric' 
                                });
                            }
                        }

                        return {
                            id: p._id,
                            name: parsedName,
                            contact: p.contactNumber || p.phoneNumber || p.contact || 'N/A',
                            email: p.email || 'N/A',
                            dob: dobFormatted,
                            status: p.status === 'active' ? 'Active' : 'Inactive',
                            isVerified: p.isVerified,
                            profileImage: p.profileImage
                        };
                    });
                    
                setPatientsList(mappedPatients);
            }
        } catch (error) {
            console.error("Failed to fetch patients:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (canReadPatients) {
            fetchPatients();
        }
    }, [fetchPatients, canReadPatients]);

    const filteredPatients = patientsList.filter(patient => 
        patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        patient.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleToggleStatus = async (patient) => {
        const newStatus = patient.status === 'Active' ? 'inactive' : 'active';
        
        if (newStatus === 'active' && !patient.isVerified) {
            alert(`Cannot activate ${patient.name}. Their email is not yet verified.`);
            return;
        }

        const confirmMsg = newStatus === 'active' 
            ? `Are you sure you want to ACTIVATE patient account for: ${patient.name}?` 
            : `Are you sure you want to DEACTIVATE patient account for: ${patient.name}?`;
            
        if (!window.confirm(confirmMsg)) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:5000/api/user/toggle-status/${patient.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (res.ok) {
                setPatientsList(prevList => prevList.map(p => 
                    p.id === patient.id ? { ...p, status: newStatus === 'active' ? 'Active' : 'Inactive' } : p
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

    const handleEditClick = (id) => {
        setIsViewModalOpen(false);
        setSelectedPatientId(id);
        setIsEditModalOpen(true);
    };

    // UPDATED: Spawns the full EMR modal overlay
    const handleViewClick = (id) => {
        setIsEditModalOpen(false);
        setSelectedPatientId(id);
        setIsViewModalOpen(true);
    };

    const handleCloseEditModal = () => {
        setIsEditModalOpen(false);
        setSelectedPatientId(null);
    };

    const handleCloseViewModal = () => {
        setIsViewModalOpen(false);
        setSelectedPatientId(null);
    };

    // --- HARD STOP: PAGE PROTECTION ---
    if (!canReadPatients) {
        return (
            <div className={styles.container}>
                <div style={{ textAlign: 'center', padding: '100px', color: '#dc3545', fontWeight: 'bold', fontSize: '18px' }}>
                    Access Denied. You do not have permission to view the Patients module.
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Manage Patients</h1>
                <p className={styles.subtitle}>View, filter, and manage clinic patient records.</p>
            </header>

            <div className={styles.controlsRow}>
                <div className={styles.searchWrapper}>
                    <FaSearch className={styles.searchIcon} />
                    <input 
                        type="text" 
                        placeholder="Search patients by name or email..." 
                        className={styles.searchInput} 
                        value={searchQuery} 
                        onChange={(e) => setSearchQuery(e.target.value)} 
                    />
                </div>
                
                {/* PROTECTED: ADD BUTTON */}
                {canEditPatients && (
                    <button className={styles.addBtn} onClick={() => setIsAddModalOpen(true)}>
                        <FaUserPlus className={styles.btnIcon} /> Add New Patient
                    </button>
                )}
            </div>

            {/* Conditionally render UserTabs for Owners/Co-owners only */}
            {isOwner && <UserTabs activeTab="patients" />}

            <div className={styles.tableContainer} style={{ marginTop: !isOwner ? '20px' : '0' }}>
                <table className={styles.userTable}>
                    <thead>
                        <tr>
                            <th style={{ width: '70px' }}></th>
                            <th>Patient Name</th>
                            <th>Email Address</th>
                            <th style={{ width: '180px' }}>Account Status</th>
                            <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="5" style={{textAlign: 'center', padding: '30px', color: '#64748b'}}>Loading records...</td></tr>
                        ) : filteredPatients.length > 0 ? (
                            filteredPatients.map((patient) => (
                                <tr key={patient.id} style={{ opacity: patient.status === 'Inactive' ? 0.6 : 1 }}>
                                    <td>
                                        {patient.profileImage ? (
                                            <img
                                                src={patient.profileImage}
                                                alt={patient.name}
                                                style={{
                                                    width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover'
                                                }}
                                            />
                                        ) : (
                                            <div style={{ 
                                                width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#01538b', 
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white', fontSize: '14px' 
                                            }}>
                                                {(() => { const p = patient.name.trim().split(/\s+/); return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); })()}
                                            </div>
                                        )}
                                    </td>
                                    <td className={styles.fwBold}>
                                        {patient.name}
                                        {!patient.isVerified && <span style={{fontSize: '11px', color: '#ff4d4d', display: 'block', fontWeight: 'normal'}}>Unverified Email</span>}
                                    </td>
                                    <td>{patient.email}</td>
                                    <td>
                                        <span className={`${styles.statusDot} ${patient.status === 'Active' ? styles.activeDot : styles.inactiveDot}`}></span>
                                        {patient.status}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        {/* VIEW IS ALWAYS ALLOWED IF canReadPatients IS TRUE */}
                                        <button className={styles.iconBtn} onClick={() => handleViewClick(patient.id)} title="View Full EMR Profile"><FaEye /></button>
                                        
                                        {/* PROTECTED: EDIT & DELETE BUTTONS */}
                                        {canEditPatients && (
                                            <>
                                                <button className={styles.iconBtn} onClick={() => handleEditClick(patient.id)} title="Edit Quick Details"><FaEdit /></button>
                                                <button 
                                                    className={`${styles.iconBtn}`} 
                                                    onClick={() => handleToggleStatus(patient)}
                                                    title={patient.status === 'Active' ? "Deactivate Account" : "Activate Account"}
                                                    style={{ color: patient.status === 'Inactive' ? '#22c55e' : '#64748b', fontSize: '20px' }}
                                                >
                                                    {patient.status === 'Active' ? <FaToggleOn /> : <FaToggleOff />}
                                                </button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan="5" style={{textAlign: 'center', padding: '30px', color: '#64748b'}}>No patients found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isAddModalOpen && (
                <AddPatient onClose={() => setIsAddModalOpen(false)} onSuccess={fetchPatients} />
            )}

            {/* NEW: Render the Patient Profile Modal */}
            {isViewModalOpen && selectedPatientId && (
                <PatientProfile
                    patientId={selectedPatientId}
                    onClose={handleCloseViewModal}
                    onEdit={() => {
                        setIsViewModalOpen(false);
                        setIsEditModalOpen(true);
                    }}
                />
            )}

            {isEditModalOpen && selectedPatientId && (
                <EditPatient 
                    patientId={selectedPatientId}
                    onClose={handleCloseEditModal} 
                    onSuccess={fetchPatients} 
                />
            )}
        </div>
    );
}