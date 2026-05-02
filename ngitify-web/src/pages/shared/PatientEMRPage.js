import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaFileMedical, FaSearch, FaUserInjured } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { formatDateShort } from '../../utils/dateUtils';
import UserAvatar from '../../components/common/UserAvatar';
import PatientEMR from '../admin/PatientEMR';
import styles from '../../styles/shared/PatientEMRPage.module.css';

const normalizePatientName = (patient) => {
    if (patient.name?.first) return `${patient.name.first} ${patient.name.last || ''}`.trim();
    if (patient.firstName) return `${patient.firstName} ${patient.lastName || ''}`.trim();
    if (typeof patient.name === 'string') return patient.name;
    return 'Unknown Patient';
};

const getAge = (birthdate) => {
    if (!birthdate) return null;
    const birth = new Date(birthdate);
    if (Number.isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age -= 1;
    }
    return age;
};

export default function PatientEMRPage() {
    const { addToast } = useToast();
    const { user } = useAuth();
    const [patients, setPatients] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const fetchPatients = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await authFetch('/patients?limit=200');
            if (!response.ok) throw new Error('Failed to load patients.');
            const payload = await response.json();
            const items = Array.isArray(payload) ? payload : (payload.patients || []);
            const mapped = items.map((patient) => ({
                id: patient._id,
                name: normalizePatientName(patient),
                profileImage: patient.profileImage || '',
                age: getAge(patient.birthdate || patient.dateOfBirth || patient.dob),
                lastVisit: patient.treatmentLogs?.[0]?.date || patient.updatedAt || patient.createdAt,
                status: patient.status || 'inactive',
                raw: patient,
            }));
            mapped.sort((left, right) => left.name.localeCompare(right.name));
            setPatients(mapped);
            if (!selectedPatientId && mapped.length > 0) {
                setSelectedPatientId(mapped[0].id);
            }
        } catch (error) {
            addToast(error.message || 'Could not load patients.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [addToast, selectedPatientId]);

    useEffect(() => {
        fetchPatients();
    }, [fetchPatients]);

    const filteredPatients = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return patients;
        return patients.filter((patient) => patient.name.toLowerCase().includes(query));
    }, [patients, searchQuery]);

    return (
        <div className={styles.page}>
            <aside className={styles.patientRail}>
                <div className={styles.railHeader}>
                    <div>
                        <h1 className={styles.pageTitle}>Patient EMR</h1>
                        <p className={styles.pageSubtitle}>Browse patients and open their records instantly.</p>
                    </div>
                    <span className={styles.countBadge}>
                        <FaUserInjured />
                        {patients.length}
                    </span>
                </div>

                <div className={styles.searchBox}>
                    <FaSearch className={styles.searchIcon} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search patients..."
                        className={styles.searchInput}
                    />
                </div>

                <div className={styles.patientList}>
                    {isLoading ? (
                        <div className={styles.emptyState}>Loading patient list...</div>
                    ) : filteredPatients.length > 0 ? (
                        filteredPatients.map((patient) => (
                            <button
                                key={patient.id}
                                type="button"
                                className={`${styles.patientCard} ${selectedPatientId === patient.id ? styles.patientCardActive : ''}`}
                                onClick={() => setSelectedPatientId(patient.id)}
                            >
                                <UserAvatar user={{ name: patient.name, profileImage: patient.profileImage }} size={44} />
                                <div className={styles.patientMeta}>
                                    <span className={styles.patientName}>{patient.name}</span>
                                    <span className={styles.patientSubtext}>
                                        {patient.age !== null ? `${patient.age} yrs` : 'Age unavailable'}
                                    </span>
                                    <span className={styles.patientSubtext}>
                                        Last visit: {patient.lastVisit ? formatDateShort(patient.lastVisit) : 'No record yet'}
                                    </span>
                                </div>
                            </button>
                        ))
                    ) : (
                        <div className={styles.emptyState}>
                            <FaFileMedical className={styles.emptyIcon} />
                            No patients match your search.
                        </div>
                    )}
                </div>
            </aside>

            <section className={styles.detailPanel}>
                {selectedPatientId ? (
                    <PatientEMR
                        patientId={selectedPatientId}
                        embedded
                        roleOverride={user?.role || 'administrator'}
                    />
                ) : (
                    <div className={styles.emptyDetail}>
                        <FaFileMedical className={styles.emptyIcon} />
                        Select a patient to view their EMR.
                    </div>
                )}
            </section>
        </div>
    );
}
