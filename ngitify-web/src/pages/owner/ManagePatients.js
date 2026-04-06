import React, { useState, useEffect, useCallback } from 'react';
import styles from '../../styles/owner/ManagePatients.module.css'; 
import { FaSearch, FaUserPlus, FaEdit, FaEye, FaToggleOn, FaToggleOff } from 'react-icons/fa';
import { usePermissions } from '../../hooks/usePermissions'; 
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api'; 
import UserAvatar from '../../components/common/UserAvatar'; 

import UserTabs from './UserTabs'; 
import AddPatient from './AddPatient'; 
import EditPatient from './EditPatient';
import PatientProfile from './PatientProfile'; 

export default function ManagePatients() {
    const { user } = useAuth();
    const { canReadPatients, canEditPatients } = usePermissions(); 
    
    // Search & Filter States
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [verifiedFilter, setVerifiedFilter] = useState('All');
    
    const [patientsList, setPatientsList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false); 
    const [selectedPatientId, setSelectedPatientId] = useState(null);

    const isOwner = user?.role === 'owner' || user?.role === 'co-owner';

    const fetchPatients = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await authFetch('/users?role=patient');

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
                        }

                        return {
                            id: p._id,
                            name: parsedName,
                            email: p.email || 'N/A',
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
        if (canReadPatients) fetchPatients();
    }, [fetchPatients, canReadPatients]);

    const filteredPatients = patientsList.filter(patient => {
        const matchesSearch = patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              patient.email.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'All' || patient.status === statusFilter;
        const matchesVerified = verifiedFilter === 'All' || 
                                (verifiedFilter === 'Verified' && patient.isVerified) || 
                                (verifiedFilter === 'Unverified' && !patient.isVerified);

        return matchesSearch && matchesStatus && matchesVerified;
    });

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
            const res = await authFetch(`/user/toggle-status/${patient.id}`, {
                method: 'PUT',
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
        } catch (error) { console.error("Error toggling status:", error); alert("Cannot connect to server."); }
    };

    const handleEditClick = (id) => { setIsViewModalOpen(false); setSelectedPatientId(id); setIsEditModalOpen(true); };
    const handleViewClick = (id) => { setIsEditModalOpen(false); setSelectedPatientId(id); setIsViewModalOpen(true); };
    const handleCloseEditModal = () => { setIsEditModalOpen(false); setSelectedPatientId(null); };
    const handleCloseViewModal = () => { setIsViewModalOpen(false); setSelectedPatientId(null); };

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
                <div className={styles.searchFilterGroup}>
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
                    
                    <select 
                        className={styles.filterSelect}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="All">All Statuses</option>
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                    </select>

                    <div className={styles.pillGroup}>
                        <button className={`${styles.filterPill} ${verifiedFilter === 'All' ? styles.activePill : ''}`} onClick={() => setVerifiedFilter('All')}>All</button>
                        <button className={`${styles.filterPill} ${verifiedFilter === 'Verified' ? styles.activePill : ''}`} onClick={() => setVerifiedFilter('Verified')}>Verified</button>
                        <button className={`${styles.filterPill} ${verifiedFilter === 'Unverified' ? styles.activePill : ''}`} onClick={() => setVerifiedFilter('Unverified')}>Unverified</button>
                    </div>
                </div>
                
                {canEditPatients && (
                    <button className={styles.addBtn} onClick={() => setIsAddModalOpen(true)}>
                        <FaUserPlus className={styles.btnIcon} /> Add New Patient
                    </button>
                )}
            </div>

            {isOwner && <UserTabs activeTab="patients" />}

            <div className={styles.tableContainer} style={{ marginTop: !isOwner ? '20px' : '0' }}>
                <table className={styles.userTable}>
                    <thead>
                        <tr>
                            <th style={{ width: '60px', textAlign: 'center' }}>Pic</th>
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
                                    <td style={{ textAlign: 'center' }}>
                                        <UserAvatar user={{ name: patient.name, profileImage: patient.profileImage }} size={40} />
                                    </td>
                                    <td>
                                        <span className={styles.fwBold}>{patient.name}</span>
                                        {!patient.isVerified && <span style={{fontSize: '11px', color: '#ef4444', display: 'block', fontWeight: '500', marginTop: '2px'}}>Unverified Email</span>}
                                    </td>
                                    <td>{patient.email}</td>
                                    <td>
                                        <span className={`${styles.statusDot} ${patient.status === 'Active' ? styles.activeDot : styles.inactiveDot}`}></span>
                                        <span style={{ fontWeight: '500', color: patient.status === 'Active' ? '#15803d' : '#b91c1c' }}>{patient.status}</span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button className={styles.iconBtn} onClick={() => handleViewClick(patient.id)} title="View Full EMR Profile"><FaEye /></button>
                                        {canEditPatients && (
                                            <>
                                                <button className={styles.iconBtn} onClick={() => handleEditClick(patient.id)} title="Edit Quick Details"><FaEdit /></button>
                                                <button 
                                                    className={`${styles.iconBtn}`} 
                                                    onClick={() => handleToggleStatus(patient)}
                                                    title={patient.status === 'Active' ? "Deactivate Account" : "Activate Account"}
                                                    style={{ color: patient.status === 'Inactive' ? '#22c55e' : '#94a3b8', fontSize: '20px' }}
                                                >
                                                    {patient.status === 'Active' ? <FaToggleOn /> : <FaToggleOff />}
                                                </button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan="5" style={{textAlign: 'center', padding: '30px', color: '#64748b'}}>No patients found matching your filters.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isAddModalOpen && <AddPatient onClose={() => setIsAddModalOpen(false)} onSuccess={fetchPatients} />}
            {isViewModalOpen && selectedPatientId && (
                <PatientProfile
                    patientId={selectedPatientId}
                    onClose={handleCloseViewModal}
                    onEdit={() => { setIsViewModalOpen(false); setIsEditModalOpen(true); }}
                />
            )}
            {isEditModalOpen && selectedPatientId && <EditPatient patientId={selectedPatientId} onClose={handleCloseEditModal} onSuccess={fetchPatients} />}
        </div>
    );
}