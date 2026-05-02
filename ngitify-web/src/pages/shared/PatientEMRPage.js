import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaFileMedical, FaSearch } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import PatientEMR from '../admin/PatientEMR';
import wideTable from '../../styles/wideTable.module.css';
import styles from '../../styles/shared/PatientEMRPage.module.css';

const normalizePatientName = (patient) => {
    if (patient.name?.first) return `${patient.name.first} ${patient.name.last || ''}`.trim();
    if (patient.firstName) return `${patient.firstName} ${patient.lastName || ''}`.trim();
    if (typeof patient.name === 'string') return patient.name;
    return 'Unknown Patient';
};

const truncate = (value, limit = 40) => {
    if (!value) return '-';
    return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
};

const formatDateLabel = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

const getLatestTreatmentLog = (patient) => {
    const logs = Array.isArray(patient.treatmentLogs) ? [...patient.treatmentLogs] : [];
    if (!logs.length) return null;
    return logs.sort((left, right) => new Date(right.date) - new Date(left.date))[0];
};

const getStatusClass = (status) => {
    switch ((status || '').toLowerCase()) {
        case 'completed':
            return wideTable.statusBlue;
        case 'follow-up':
        case 'pending':
        case 'ongoing':
            return wideTable.statusAmber;
        default:
            return wideTable.statusGray;
    }
};

export default function PatientEMRPage() {
    const { addToast } = useToast();
    const { user } = useAuth();

    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPatientId, setSelectedPatientId] = useState('');

    const fetchPatients = useCallback(async () => {
        setLoading(true);
        try {
            const response = await authFetch('/patients?limit=200');
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.message || 'Failed to load patient records.');
            }

            const items = Array.isArray(payload) ? payload : (payload.patients || []);
            const mapped = items.map((patient) => {
                const latestLog = getLatestTreatmentLog(patient);
                return {
                    id: patient._id || patient.id,
                    patientId: patient._id || patient.id,
                    patientName: normalizePatientName(patient),
                    lastVisit: latestLog?.date || patient.updatedAt || patient.createdAt,
                    dentistName: latestLog?.dentistName || latestLog?.dentist || 'Unassigned',
                    chiefComplaint: latestLog?.procedure || patient.dentalHistory?.chiefComplaint || '',
                    treatmentStatus: latestLog?.status || 'Follow-up',
                };
            });
            mapped.sort((left, right) => left.patientName.localeCompare(right.patientName));
            setPatients(mapped);
        } catch (error) {
            addToast(error.message || 'Could not load the EMR directory.', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        fetchPatients();
    }, [fetchPatients]);

    const filteredPatients = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return patients;
        return patients.filter((patient) => (
            [
                patient.patientId,
                patient.patientName,
                patient.dentistName,
                patient.chiefComplaint,
                patient.treatmentStatus,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(query)
        ));
    }, [patients, searchQuery]);

    return (
        <>
            <div className={styles.page}>
                <div className={styles.headerCard}>
                    <div>
                        <h1 className={styles.pageTitle}>Patient EMR</h1>
                        <p className={styles.pageSubtitle}>
                            Table-based EMR access aligned with the clinic’s management pages.
                        </p>
                    </div>

                    <label className={styles.searchBox}>
                        <FaSearch className={styles.searchIcon} />
                        <input
                            type="search"
                            className={styles.searchInput}
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                            placeholder="Search by patient name, ID, dentist, or complaint"
                        />
                    </label>
                </div>

                <div className={styles.tableCard}>
                    {loading ? (
                        <div className={styles.stateBlock}>Loading patient records...</div>
                    ) : filteredPatients.length === 0 ? (
                        <div className={styles.stateBlock}>
                            <FaFileMedical className={styles.emptyIcon} />
                            No patient records match the current search.
                        </div>
                    ) : (
                        <div className={wideTable.tableWrapper}>
                            <table className={wideTable.table}>
                                <thead>
                                    <tr>
                                        <th>Patient ID</th>
                                        <th>Patient Name</th>
                                        <th>Date of Last Visit</th>
                                        <th>Dentist</th>
                                        <th>Chief Complaint</th>
                                        <th>Treatment Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPatients.map((patient) => (
                                        <tr key={patient.id}>
                                            <td>{patient.patientId}</td>
                                            <td className={wideTable.wrapCell}>
                                                <button
                                                    type="button"
                                                    className={styles.linkButton}
                                                    onClick={() => setSelectedPatientId(patient.patientId)}
                                                >
                                                    {patient.patientName}
                                                </button>
                                            </td>
                                            <td>{formatDateLabel(patient.lastVisit)}</td>
                                            <td>{patient.dentistName}</td>
                                            <td className={wideTable.wrapCell}>{truncate(patient.chiefComplaint)}</td>
                                            <td>
                                                <span className={`${wideTable.statusBadge} ${getStatusClass(patient.treatmentStatus)}`}>
                                                    {patient.treatmentStatus}
                                                </span>
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className={styles.viewButton}
                                                    onClick={() => setSelectedPatientId(patient.patientId)}
                                                >
                                                    View EMR
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {selectedPatientId && (
                <PatientEMR
                    patientId={selectedPatientId}
                    onClose={() => setSelectedPatientId('')}
                    roleOverride={user?.role || 'administrator'}
                />
            )}
        </>
    );
}
