import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from '../../styles/admin/ManagePatients.module.css';
import tblStyles from '../../styles/wideTable.module.css';
import { FaSearch, FaUserPlus, FaEdit, FaEye, FaToggleOn, FaToggleOff, FaDownload, FaFilePdf } from 'react-icons/fa';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';
import { downloadCsvFile, openPrintReport } from '../../utils/exportHelpers';

import AddPatient from './AddPatient';
import EditPatient from './EditPatient';
import PatientProfile from './PatientProfile';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useToast } from '../../context/ToastContext';

export default function ManagePatients() {
    const { user } = useAuth();
    const { canReadPatients, canEditPatients } = usePermissions();

    const location = useLocation();
    const navigate = useNavigate();

    const { addToast } = useToast();

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('Active');
    const [branchFilter, setBranchFilter] = useState('All');

    const [patientsList, setPatientsList] = useState([]);
    const [branchOptions, setBranchOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedPatientId, setSelectedPatientId] = useState(null);

    const [confirmConfig, setConfirmConfig] = useState(null);

    const isSecretary = user?.role === 'secretary';
    const isDentist = user?.role === 'dentist';

    useEffect(() => {
        if (location.state?.openAddModal && canEditPatients) {
            setIsAddModalOpen(true);
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location, navigate, canEditPatients]);

    const fetchBranches = useCallback(async () => {
        try {
            const res = await authFetch('/branches');
            if (res.ok) {
                const data = await res.json();
                setBranchOptions(data.map((branch) => branch.name));
            }
        } catch (error) {
            console.error('Failed to fetch branches:', error);
        }
    }, []);

    const fetchPatients = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await authFetch('/patients');

            if (response.ok) {
                const data = await response.json();
                const rawList = Array.isArray(data) ? data : (data.patients || []);
                const mappedPatients = rawList.map((patient) => {
                    let parsedName = 'Unknown Patient';
                    if (typeof patient.name === 'object' && patient.name !== null) {
                        parsedName = `${patient.name.first || ''} ${patient.name.last || ''}`.trim();
                    } else if (patient.firstName) {
                        parsedName = `${patient.firstName} ${patient.lastName || ''}`.trim();
                    } else if (typeof patient.name === 'string') {
                        parsedName = patient.name;
                    }

                    return {
                        id: patient._id,
                        name: parsedName || 'Unknown',
                        email: patient.email || 'N/A',
                        rawStatus: patient.status || 'inactive',
                        isVerified: patient.isVerified,
                        profileImage: patient.profileImage,
                        assignedBranch: patient.assignedBranch || patient.assignedBranches?.[0] || '',
                    };
                });

                setPatientsList(mappedPatients);
            }
        } catch (error) {
            console.error('Failed to fetch patients:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (canReadPatients) {
            fetchPatients();
            fetchBranches();
        }
    }, [fetchPatients, fetchBranches, canReadPatients]);

    useEffect(() => {
        if (!canReadPatients) return undefined;

        const refreshData = () => {
            fetchPatients();
            fetchBranches();
        };

        const intervalId = window.setInterval(refreshData, 30000);
        const handleFocus = () => refreshData();
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') refreshData();
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [canReadPatients, fetchBranches, fetchPatients]);

    const filteredPatients = patientsList.filter((patient) => {
        const matchesSearch = patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            patient.email.toLowerCase().includes(searchQuery.toLowerCase());
        const computedStatus = (!patient.isVerified || patient.rawStatus !== 'active') ? 'Inactive' : 'Active';
        const matchesStatus = statusFilter === 'All' || computedStatus === statusFilter;
        const matchesBranch = branchFilter === 'All' || patient.assignedBranch === branchFilter;
        return matchesSearch && matchesStatus && matchesBranch;
    });

    const handleToggleStatus = (patient) => {
        const newStatus = patient.status === 'Active' ? 'inactive' : 'active';

        if (newStatus === 'active' && !patient.isVerified) {
            addToast(`Cannot activate ${patient.name}. Their email is not yet verified.`, 'error');
            return;
        }

        setConfirmConfig({
            title: newStatus === 'active' ? 'Activate Account' : 'Deactivate Account',
            message: newStatus === 'active'
                ? `Are you sure you want to ACTIVATE patient account for: ${patient.name}?`
                : `Are you sure you want to DEACTIVATE patient account for: ${patient.name}?`,
            confirmText: newStatus === 'active' ? 'Yes, Activate' : 'Yes, Deactivate',
            isDestructive: newStatus !== 'active',
            onConfirm: () => executeToggleStatus(patient.id, newStatus, patient.name),
            onCancel: () => setConfirmConfig(null),
        });
    };

    const executeToggleStatus = async (id, newStatus, name) => {
        try {
            const res = await authFetch(`/patient/toggle-status/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus }),
            });

            if (res.ok) {
                setPatientsList((prevList) => prevList.map((patient) => (
                    patient.id === id ? { ...patient, rawStatus: newStatus } : patient
                )));
                addToast(`Successfully ${newStatus === 'active' ? 'activated' : 'deactivated'} ${name}'s account.`, 'success');
            } else {
                const data = await res.json();
                addToast(data.message || 'Failed to update status.', 'error');
            }
        } catch (error) {
            console.error('Error toggling status:', error);
            addToast('Cannot connect to server.', 'error');
        } finally {
            setConfirmConfig(null);
        }
    };

    const handleResendActivation = async (patient) => {
        try {
            const res = await authFetch(`/patient/resend-activation/${patient.id}`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) addToast(`Activation email resent to ${patient.email}.`, 'success');
            else addToast(data.message || 'Failed to resend activation email.', 'error');
        } catch {
            addToast('Cannot connect to server.', 'error');
        }
    };

    const handleEditClick = (id) => {
        if (isDentist) {
            navigate(`/dentist/patients/${id}/emr`);
            return;
        }
        setIsViewModalOpen(false);
        setSelectedPatientId(id);
        setIsEditModalOpen(true);
    };

    const handleViewClick = (id) => {
        setIsEditModalOpen(false);
        setSelectedPatientId(id);
        setIsViewModalOpen(true);
    };

    const handleCloseEditModal = () => { setIsEditModalOpen(false); setSelectedPatientId(null); };
    const handleCloseViewModal = () => { setIsViewModalOpen(false); setSelectedPatientId(null); };

    const exportRows = filteredPatients.map((patient) => {
        const computedStatus = (!patient.isVerified || patient.rawStatus !== 'active') ? 'Inactive' : 'Active';
        return [
            patient.name,
            patient.email,
            patient.assignedBranch || 'No branch assigned',
            computedStatus,
            patient.isVerified ? 'Verified' : 'Unverified',
        ];
    });

    const handleExportCsv = () => {
        downloadCsvFile(
            `patients_${new Date().toISOString().slice(0, 10)}.csv`,
            ['Name', 'Email Address', 'Assigned Branch', 'Status', 'Verification'],
            exportRows,
        );
    };

    const handleExportPdf = () => {
        openPrintReport({
            title: 'Patient List Report',
            subtitle: 'Dentime Dental Clinic - NgitiFy',
            summaryItems: [
                { label: 'Visible Patients', value: filteredPatients.length },
                { label: 'Status Filter', value: statusFilter },
                { label: 'Branch Filter', value: branchFilter },
            ],
            sections: [
                {
                    title: 'Patients',
                    headers: ['Name', 'Email Address', 'Assigned Branch', 'Status', 'Verification'],
                    rows: exportRows,
                },
            ],
        });
    };

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
            <header className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 className={styles.title}>Manage Patients</h1>
                    <p className={styles.subtitle}>{isDentist ? 'View your assigned patients and open their EMR records.' : 'View, filter, and manage clinic patient records.'}</p>
                </div>
                <div className={styles.headerActions}>
                    <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={handleExportCsv}
                        disabled={filteredPatients.length === 0}
                    >
                        <FaDownload /> Export CSV
                    </button>
                    <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={handleExportPdf}
                        disabled={filteredPatients.length === 0}
                    >
                        <FaFilePdf /> Export PDF
                    </button>
                    {canEditPatients && !isDentist && (
                        <button
                            className={styles.addBtn}
                            onClick={() => setIsAddModalOpen(true)}
                        >
                            <FaUserPlus className={styles.btnIcon} /> Add New Patient
                        </button>
                    )}
                </div>
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
                            onChange={(event) => setSearchQuery(event.target.value)}
                        />
                    </div>

                    <div className={styles.pillGroup}>
                        <button className={`${styles.filterPill} ${statusFilter === 'Active' ? styles.activePill : ''}`} onClick={() => setStatusFilter('Active')}>Active</button>
                        <button className={`${styles.filterPill} ${statusFilter === 'Inactive' ? styles.activePill : ''}`} onClick={() => setStatusFilter('Inactive')}>Inactive</button>
                        <button className={`${styles.filterPill} ${statusFilter === 'All' ? styles.activePill : ''}`} onClick={() => setStatusFilter('All')}>All</button>
                    </div>

                    {!isSecretary && !isDentist && (
                        <select
                            className={styles.filterSelect}
                            value={branchFilter}
                            onChange={(event) => setBranchFilter(event.target.value)}
                        >
                            <option value="All">All Branches</option>
                            {branchOptions.map((branch) => (
                                <option key={branch} value={branch}>{branch}</option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            <div className={`${styles.tableContainer} ${tblStyles.tableWrapper}`} style={{ marginTop: '20px' }}>
                <table className={`${styles.userTable} ${tblStyles.table}`}>
                    <thead>
                        <tr>
                            <th style={{ width: '34%' }}>Name</th>
                            <th style={{ width: '36%' }}>Email Address</th>
                            <th style={{ width: '110px' }}>Status</th>
                            <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Loading records...</td></tr>
                        ) : filteredPatients.length > 0 ? (
                            filteredPatients.map((patient) => {
                                const computedStatus = (!patient.isVerified || patient.rawStatus !== 'active') ? 'Inactive' : 'Active';
                                return (
                                <tr key={patient.id} style={{ opacity: computedStatus === 'Inactive' ? 0.6 : 1 }}>
                                    <td className={tblStyles.wrapCell}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span className={styles.fwBold}>{patient.name}</span>
                                            <span style={{ color: '#6b7f92', fontSize: '12px' }}>{patient.assignedBranch || 'No branch'}</span>
                                        </div>
                                        {!patient.isVerified && <span style={{ fontSize: '11px', color: '#ef4444', display: 'block', fontWeight: '500', marginTop: '2px' }}>Unverified Email</span>}
                                    </td>
                                    <td className={tblStyles.wrapCell} style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'initial' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span>{patient.email}</span>
                                            {!patient.isVerified && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleResendActivation(patient)}
                                                    style={{ color: '#01538b', fontSize: '12px', fontWeight: 600, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                                                >
                                                    Resend Activation Link to email
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`${tblStyles.statusBadge} ${computedStatus === 'Active' ? tblStyles.statusGreen : tblStyles.statusRed}`}>
                                            {computedStatus}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div className={`${tblStyles.iconActions} ${styles.actionRow}`}>
                                            <button type="button" className={`${styles.actionIconButton} ${tblStyles.iconAction} ${styles.viewIconButton}`} onClick={() => handleViewClick(patient.id)} title="View Full EMR Profile"><FaEye /></button>
                                            {(canEditPatients || isDentist) && (
                                                <>
                                                    <button type="button" className={`${styles.actionIconButton} ${tblStyles.iconAction} ${styles.editIconButton}`} onClick={() => handleEditClick(patient.id)} title={isDentist ? 'Open Patient EMR' : 'Edit Quick Details'}><FaEdit /></button>
                                                    {!isDentist && (
                                                        <button
                                                            type="button"
                                                            className={`${styles.actionIconButton} ${tblStyles.iconAction} ${computedStatus === 'Inactive' ? styles.activateIconButton : styles.deactivateIconButton}`}
                                                            onClick={() => handleToggleStatus({ ...patient, status: computedStatus })}
                                                            title={computedStatus === 'Active' ? 'Deactivate Account' : 'Activate Account'}
                                                        >
                                                            {computedStatus === 'Active' ? <FaToggleOn /> : <FaToggleOff />}
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                            })
                        ) : (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No patients found matching your filters.</td></tr>
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
