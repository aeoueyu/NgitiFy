import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/secretary/SecretaryPatients.module.css';
import { FaSearch, FaUserPlus, FaEdit, FaEye, FaFileMedical } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import UserAvatar from '../../components/common/UserAvatar';
import ConfirmModal from '../../components/common/ConfirmModal';

export default function SecretaryPatients() {
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [patientsList, setPatientsList]   = useState([]);
    const [isLoading, setIsLoading]         = useState(true);
    const [searchQuery, setSearchQuery]     = useState('');
    const [statusFilter, setStatusFilter]   = useState('All');
    const [verifiedFilter, setVerifiedFilter] = useState('All');

    const [confirmConfig, setConfirmConfig] = useState(null);

    // ── Fetch branch-scoped patients ──────────────────────────────────────────
    const fetchPatients = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await authFetch('/patients');
            if (res.ok) {
                const data = await res.json();
                const raw = Array.isArray(data) ? data : (data.patients || []);
                setPatientsList(raw.map(p => {
                    let parsedName = 'Unknown Patient';
                    if (typeof p.name === 'object' && p.name !== null) {
                        parsedName = `${p.name.first || ''} ${p.name.last || ''}`.trim();
                    } else if (p.firstName) {
                        parsedName = `${p.firstName} ${p.lastName || ''}`.trim();
                    } else if (typeof p.name === 'string') {
                        parsedName = p.name;
                    }
                    return {
                        id:           p._id,
                        name:         parsedName || 'Unknown',
                        email:        p.email || 'N/A',
                        contact:      p.contactNumber || '—',
                        status:       p.status === 'active' ? 'Active' : 'Inactive',
                        isVerified:   p.isVerified,
                        profileImage: p.profileImage,
                        rawDate:      p.createdAt ? new Date(p.createdAt) : null,
                    };
                }));
            } else {
                addToast('Failed to load patients.', 'error');
            }
        } catch {
            addToast('Cannot connect to server.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [addToast]);

    useEffect(() => { fetchPatients(); }, [fetchPatients]);

    // ── Filter logic ──────────────────────────────────────────────────────────
    const filteredPatients = patientsList.filter(p => {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
            p.name.toLowerCase().includes(q) ||
            p.email.toLowerCase().includes(q) ||
            p.contact.toLowerCase().includes(q);
        const matchesStatus  = statusFilter  === 'All' || p.status === statusFilter;
        const matchesVerified =
            verifiedFilter === 'All' ||
            (verifiedFilter === 'Verified'   &&  p.isVerified) ||
            (verifiedFilter === 'Unverified' && !p.isVerified);
        return matchesSearch && matchesStatus && matchesVerified;
    });

    // ── Toggle active / inactive ──────────────────────────────────────────────
    const handleToggleStatus = (patient) => {
        const newStatus = patient.status === 'Active' ? 'inactive' : 'active';

        if (newStatus === 'active' && !patient.isVerified) {
            addToast(`Cannot activate ${patient.name}. Their email is not yet verified.`, 'error');
            return;
        }

        setConfirmConfig({
            title:       newStatus === 'active' ? 'Activate Account' : 'Deactivate Account',
            message:     newStatus === 'active'
                ? `Are you sure you want to ACTIVATE the account for ${patient.name}?`
                : `Are you sure you want to DEACTIVATE the account for ${patient.name}?`,
            confirmText: newStatus === 'active' ? 'Yes, Activate' : 'Yes, Deactivate',
            isDestructive: newStatus !== 'active',
            onConfirm:   () => executeToggle(patient.id, newStatus, patient.name),
        });
    };

    const executeToggle = async (id, newStatus, name) => {
        try {
            const res = await authFetch(`/patient/toggle-status/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) {
                setPatientsList(prev =>
                    prev.map(p => p.id === id
                        ? { ...p, status: newStatus === 'active' ? 'Active' : 'Inactive' }
                        : p
                    )
                );
                addToast(
                    `Successfully ${newStatus === 'active' ? 'activated' : 'deactivated'} ${name}'s account.`,
                    'success'
                );
            } else {
                const data = await res.json();
                addToast(data.message || 'Failed to update status.', 'error');
            }
        } catch {
            addToast('Cannot connect to server.', 'error');
        } finally {
            setConfirmConfig(null);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className={styles.container}>

            {/* HEADER */}
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Patients</h1>
                    <p className={styles.subtitle}>
                        Register and manage patients in your branch.
                    </p>
                </div>
                <button
                    className={styles.addBtn}
                    onClick={() => navigate('/secretary/patients/add')}
                >
                    <FaUserPlus /> Register New Patient
                </button>
            </header>

            {/* CONTROLS */}
            <div className={styles.controlsRow}>
                <div className={styles.searchWrapper}>
                    <FaSearch className={styles.searchIcon} />
                    <input
                        type="text"
                        placeholder="Search by name, email, or contact..."
                        className={styles.searchInput}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>

                <select
                    className={styles.filterSelect}
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                >
                    <option value="All">All Statuses</option>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                </select>

                <div className={styles.pillGroup}>
                    {['All', 'Verified', 'Unverified'].map(f => (
                        <button
                            key={f}
                            className={`${styles.filterPill} ${verifiedFilter === f ? styles.activePill : ''}`}
                            onClick={() => setVerifiedFilter(f)}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* TABLE */}
            <div className={styles.tableContainer}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th style={{ width: '56px', textAlign: 'center' }}>Pic</th>
                            <th>Patient Name</th>
                            <th>Email Address</th>
                            <th>Contact</th>
                            <th style={{ width: '160px' }}>Status</th>
                            <th style={{ width: '140px', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan="6" className={styles.emptyCell}>
                                    Loading patients…
                                </td>
                            </tr>
                        ) : filteredPatients.length > 0 ? (
                            filteredPatients.map(patient => (
                                <tr key={patient.id} style={{ opacity: patient.status === 'Inactive' ? 0.6 : 1 }}>
                                    <td style={{ textAlign: 'center' }}>
                                        <UserAvatar
                                            user={{ name: patient.name, profileImage: patient.profileImage }}
                                            size={38}
                                        />
                                    </td>
                                    <td>
                                        <span className={styles.patientName}>{patient.name}</span>
                                        {!patient.isVerified && (
                                            <span className={styles.unverifiedTag}>Unverified Email</span>
                                        )}
                                    </td>
                                    <td className={styles.muted}>{patient.email}</td>
                                    <td className={styles.muted}>{patient.contact}</td>
                                    <td>
                                        <span className={`${styles.statusDot} ${patient.status === 'Active' ? styles.dotActive : styles.dotInactive}`} />
                                        <span className={patient.status === 'Active' ? styles.statusActive : styles.statusInactive}>
                                            {patient.status}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <button
                                            className={styles.iconBtn}
                                            title="View Patient Profile"
                                            onClick={() => navigate(`/secretary/patients/${patient.id}`)}
                                        >
                                            <FaEye />
                                        </button>
                                        <button
                                            className={styles.iconBtn}
                                            title="View EMR"
                                            onClick={() => navigate(`/secretary/patients/${patient.id}/emr`)}
                                        >
                                            <FaFileMedical />
                                        </button>
                                        <button
                                            className={styles.iconBtn}
                                            title="Edit Patient Info"
                                            onClick={() => navigate(`/secretary/patients/${patient.id}/edit`)}
                                        >
                                            <FaEdit />
                                        </button>
                                        <button
                                            className={`${styles.iconBtn} ${styles.toggleBtn}`}
                                            title={patient.status === 'Active' ? 'Deactivate' : 'Activate'}
                                            style={{ color: patient.status === 'Active' ? '#94a3b8' : '#22c55e' }}
                                            onClick={() => handleToggleStatus(patient)}
                                        >
                                            {patient.status === 'Active' ? '●' : '○'}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="6" className={styles.emptyCell}>
                                    No patients found matching your filters.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <ConfirmModal
                isOpen={!!confirmConfig}
                title={confirmConfig?.title}
                message={confirmConfig?.message}
                confirmText={confirmConfig?.confirmText}
                isDestructive={confirmConfig?.isDestructive}
                onConfirm={confirmConfig?.onConfirm}
                onCancel={() => setConfirmConfig(null)}
            />
        </div>
    );
}