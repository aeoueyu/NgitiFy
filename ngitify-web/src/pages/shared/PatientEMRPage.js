import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaEdit, FaEye, FaFileMedical, FaSearch } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import PatientEMR from '../admin/PatientEMR';
import tableStyles from '../../styles/wideTable.module.css';
import adminStyles from '../../styles/admin/ManagePatients.module.css';
import styles from '../../styles/shared/PatientEMRPage.module.css';

const normalizePatientName = (patient) => {
    if (patient.name?.first) return `${patient.name.first} ${patient.name.last || ''}`.trim();
    if (patient.firstName) return `${patient.firstName} ${patient.lastName || ''}`.trim();
    if (typeof patient.name === 'string') return patient.name;
    return 'Unknown Patient';
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

const getBranchLabel = (patient) => patient.assignedBranch || patient.assignedBranches?.[0] || '';

export default function PatientEMRPage({ patientScope = '' }) {
    const { addToast } = useToast();
    const { user } = useAuth();

    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [branchFilter, setBranchFilter] = useState('All');
    const [sortOrder, setSortOrder] = useState('a-z');
    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [emrMode, setEmrMode] = useState('view');

    const isMyPatientsView = patientScope === 'my-patients';
    const canEditEmr = user?.role === 'dentist'
        || (user?.role === 'owner' && user?.isDentist === true);

    const fetchPatients = useCallback(async () => {
        setLoading(true);
        try {
            const scopeQuery = isMyPatientsView ? '&scope=my-patients' : '';
            const response = await authFetch(`/patients?limit=200${scopeQuery}`);
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload.message || 'Failed to load patient records.');
            }

            const items = Array.isArray(payload) ? payload : (payload.patients || []);
            const mapped = items.map((patient) => {
                const latestLog = getLatestTreatmentLog(patient);
                const branch = getBranchLabel(patient);
                const lastVisit = latestLog?.date || patient.updatedAt || patient.createdAt || '';
                return {
                    id: patient._id || patient.id,
                    patientId: patient._id || patient.id,
                    patientName: normalizePatientName(patient),
                    branch,
                    lastVisit,
                    lastVisitTimestamp: lastVisit ? new Date(lastVisit).getTime() : 0,
                    dentistName: latestLog?.dentistName || latestLog?.dentist || 'Unassigned',
                };
            });

            setPatients(mapped);
        } catch (error) {
            addToast(error.message || 'Could not load the EMR directory.', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast, isMyPatientsView]);

    useEffect(() => {
        fetchPatients();
    }, [fetchPatients]);

    const branchOptions = useMemo(() => (
        [...new Set(
            patients
                .map((patient) => patient.branch)
                .filter(Boolean)
        )].sort((left, right) => left.localeCompare(right))
    ), [patients]);

    const filteredPatients = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();

        const matches = patients.filter((patient) => {
            const matchesSearch = !query || [
                patient.patientId,
                patient.patientName,
                patient.branch,
                patient.dentistName,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(query);

            const matchesBranch = branchFilter === 'All' || patient.branch === branchFilter;
            return matchesSearch && matchesBranch;
        });

        return [...matches].sort((left, right) => {
            switch (sortOrder) {
                case 'z-a':
                    return right.patientName.localeCompare(left.patientName);
                case 'latest-to-oldest':
                    return right.lastVisitTimestamp - left.lastVisitTimestamp;
                case 'oldest-to-latest':
                    return left.lastVisitTimestamp - right.lastVisitTimestamp;
                case 'a-z':
                default:
                    return left.patientName.localeCompare(right.patientName);
            }
        });
    }, [patients, searchQuery, branchFilter, sortOrder]);

    const openEmr = (patientId, mode) => {
        setSelectedPatientId(patientId);
        setEmrMode(mode);
    };

    const closeEmr = () => {
        setSelectedPatientId('');
        setEmrMode('view');
    };

    return (
        <>
            <div className={adminStyles.container}>
                <header className={adminStyles.header}>
                    <div>
                        <h1 className={adminStyles.title}>{isMyPatientsView ? 'My Patient' : 'Patient EMR'}</h1>
                        <p className={adminStyles.subtitle}>
                            {isMyPatientsView
                                ? 'View patients assigned to you or patients whose completed treatment you handled.'
                                : 'Review complete patient records and open the EMR in view or edit mode.'}
                        </p>
                    </div>
                </header>

                <div className={adminStyles.controlsRow}>
                    <div className={adminStyles.searchFilterGroup}>
                        <div className={adminStyles.searchWrapper}>
                            <FaSearch className={adminStyles.searchIcon} />
                            <input
                                type="search"
                                className={adminStyles.searchInput}
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Search by patient name, branch, ID, or dentist..."
                            />
                        </div>

                        <select
                            className={adminStyles.filterSelect}
                            value={branchFilter}
                            onChange={(event) => setBranchFilter(event.target.value)}
                        >
                            <option value="All">All Branches</option>
                            {branchOptions.map((branch) => (
                                <option key={branch} value={branch}>{branch}</option>
                            ))}
                        </select>

                        <select
                            className={adminStyles.filterSelect}
                            value={sortOrder}
                            onChange={(event) => setSortOrder(event.target.value)}
                        >
                            <option value="a-z">A-Z</option>
                            <option value="z-a">Z-A</option>
                            <option value="latest-to-oldest">Latest to Oldest Visit</option>
                            <option value="oldest-to-latest">Oldest to Latest Visit</option>
                        </select>
                    </div>
                </div>

                <div className={`${adminStyles.tableContainer} ${tableStyles.tableWrapper}`} style={{ marginTop: '20px' }}>
                    <table className={`${adminStyles.userTable} ${tableStyles.table}`}>
                        <thead>
                            <tr>
                                <th>Patient Name</th>
                                <th style={{ width: '170px' }}>Last Visit</th>
                                <th>Dentist</th>
                                <th style={{ width: canEditEmr ? '132px' : '72px', textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                                        Loading patient records...
                                    </td>
                                </tr>
                            ) : filteredPatients.length > 0 ? (
                                filteredPatients.map((patient) => (
                                    <tr key={patient.id}>
                                        <td className={tableStyles.wrapCell}>
                                            <div className={styles.patientCell}>
                                                <strong>{patient.patientName}</strong>
                                                <span>{patient.branch || 'No branch'}</span>
                                            </div>
                                        </td>
                                        <td>{formatDateLabel(patient.lastVisit)}</td>
                                        <td>{patient.dentistName}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <div className={`${tableStyles.iconActions} ${adminStyles.actionRow}`}>
                                                <button
                                                    type="button"
                                                    className={`${adminStyles.actionIconButton} ${tableStyles.iconAction} ${adminStyles.viewIconButton}`}
                                                    onClick={() => openEmr(patient.patientId, 'view')}
                                                    title="View EMR"
                                                    aria-label="View EMR"
                                                >
                                                    <FaEye />
                                                </button>
                                                {canEditEmr && (
                                                    <button
                                                        type="button"
                                                        className={`${adminStyles.actionIconButton} ${tableStyles.iconAction} ${adminStyles.editIconButton}`}
                                                        onClick={() => openEmr(patient.patientId, 'edit')}
                                                        title="Edit EMR"
                                                        aria-label="Edit EMR"
                                                    >
                                                        <FaEdit />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                                        <div className={styles.emptyState}>
                                            <FaFileMedical className={styles.emptyIcon} />
                                            {isMyPatientsView ? 'No patients assigned to or treated by you yet' : 'No results found'}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedPatientId && (
                <PatientEMR
                    patientId={selectedPatientId}
                    onClose={closeEmr}
                    roleOverride={user?.role || 'administrator'}
                    forceReadOnly={emrMode === 'view'}
                />
            )}
        </>
    );
}
