import React, { lazy, Suspense, useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from '../../styles/admin/ManagePatients.module.css';
import tblStyles from '../../styles/wideTable.module.css';
import modalStyles from '../../components/common/LifecycleActionModal.module.css';
import { FaSearch, FaUserPlus, FaEdit, FaEye, FaToggleOn, FaToggleOff, FaDownload, FaFilePdf, FaArchive, FaUndo, FaExchangeAlt, FaShieldAlt, FaSyncAlt } from 'react-icons/fa';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';
import { downloadCsvFile } from '../../utils/exportHelpers';

import LifecycleActionModal from '../../components/common/LifecycleActionModal';
import ResendEmailButton from '../../components/common/ResendEmailButton';
import PrintReportPreviewModal from '../../components/common/PrintReportPreviewModal';
import RowsPerPageInput from '../../components/common/RowsPerPageInput';
import { useToast } from '../../context/ToastContext';
import {
    getAccessRecoveryLabel,
    getAccountLifecycleKey as getPatientLifecycleKey,
    getAccountLifecycleLabel as getPatientLifecycleLabel,
    hasExpiredTemporaryPassword,
    matchesAccountLifecycleFilter as matchesPatientLifecycleFilter,
    shouldShowAccessRecovery,
} from '../../utils/accountStatus';

const AddPatient = lazy(() => import('./AddPatient'));
const EditPatient = lazy(() => import('./EditPatient'));

const hasPendingPreRegistration = (patient = {}) => Boolean(patient.pendingPreRegistration?.appointmentId);

const getPatientRecoveryLabel = (patient = {}) => (
    hasPendingPreRegistration(patient)
        ? 'Resend Pre-registration Link'
        : (!patient?.isVerified && !hasExpiredTemporaryPassword(patient) ? 'Resend Activation Link' : getAccessRecoveryLabel(patient))
);

export default function ManagePatients({ patientScope = '', dentistExperience = false, title = 'Manage Patients' }) {
    const { user } = useAuth();
    const { canReadPatients, canEditPatients } = usePermissions();

    const location = useLocation();
    const navigate = useNavigate();

    const { addToast } = useToast();

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState(
        user?.role === 'dentist' || dentistExperience ? 'all' : 'active'
    );
    const [branchFilter, setBranchFilter] = useState('All');
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [page, setPage] = useState(1);

    const [patientsList, setPatientsList] = useState([]);
    const [branchOptions, setBranchOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedPatientId, setSelectedPatientId] = useState(null);
    const [printPreviewConfig, setPrintPreviewConfig] = useState(null);
    const [branchTransferState, setBranchTransferState] = useState({
        patient: null,
        preview: null,
        loading: false,
        error: '',
        targetBranch: '',
        reason: '',
        submitting: false,
    });

    const [lifecycleConfig, setLifecycleConfig] = useState(null);

    const isSecretary = user?.role === 'secretary';
    const isDentist = user?.role === 'dentist';
    const usesDentistExperience = isDentist || dentistExperience;
    const isBranchManager = user?.role === 'branch-manager';
    const isBranchScopedList = isSecretary || isBranchManager;
    const canTransferPatientBranch = canEditPatients && !usesDentistExperience && ['administrator', 'owner', 'branch-manager', 'secretary'].includes(user?.role);

    useEffect(() => {
        if (location.state?.openAddModal && canEditPatients) {
            setIsAddModalOpen(true);
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location, navigate, canEditPatients]);

    const fetchBranches = useCallback(async () => {
        try {
            const res = await authFetch('/branches?context=patient-transfer');
            if (res.ok) {
                const data = await res.json();
                setBranchOptions(data.map((branch) => branch.name));
            }
        } catch (error) {
            console.error('Failed to fetch branches:', error);
        }
    }, []);

    const fetchPatients = useCallback(async ({ silent = false } = {}) => {
        try {
            if (!silent) setIsLoading(true);
            const scopeQuery = patientScope ? `&scope=${encodeURIComponent(patientScope)}` : '';
            const response = await authFetch(`/patients?includeArchived=true&limit=500&view=management${scopeQuery}`);

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
                        isArchived: Boolean(patient.isArchived),
                        isVerified: patient.isVerified,
                        isPasswordChanged: patient.isPasswordChanged === true,
                        temporaryPasswordExpires: patient.temporaryPasswordExpires || null,
                        assignedBranch: patient.assignedBranch || patient.assignedBranches?.[0] || '',
                        pendingPreRegistration: patient.pendingPreRegistration || null,
                    };
                });

                setPatientsList(mappedPatients);
            }
        } catch (error) {
            console.error('Failed to fetch patients:', error);
        } finally {
            if (!silent) setIsLoading(false);
        }
    }, [patientScope]);

    useEffect(() => {
        if (canReadPatients) {
            fetchPatients();
            fetchBranches();
        }
    }, [fetchPatients, fetchBranches, canReadPatients]);

    useEffect(() => {
        if (!canReadPatients) return undefined;

        const refreshData = () => {
            fetchPatients({ silent: true });
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
        const matchesStatus = matchesPatientLifecycleFilter(patient, statusFilter);
        const matchesBranch = branchFilter === 'All' || patient.assignedBranch === branchFilter;
        return matchesSearch && matchesStatus && matchesBranch;
    });
    const totalPages = Math.max(1, Math.ceil(filteredPatients.length / rowsPerPage));
    const paginatedPatients = filteredPatients.slice((page - 1) * rowsPerPage, page * rowsPerPage);

    useEffect(() => {
        setPage(1);
    }, [searchQuery, statusFilter, branchFilter, rowsPerPage]);

    useEffect(() => {
        setPage((current) => Math.min(current, totalPages));
    }, [totalPages]);

    const handleRowsPerPageChange = (event) => {
        const nextValue = Number(event.target.value);
        if (Number.isNaN(nextValue)) return;
        setRowsPerPage(Math.max(1, nextValue));
    };

    const statusFilterLabel = {
        active: 'Active',
        needsActivation: 'Needs Activation',
        inactive: 'Inactive',
        archived: 'Archived',
        all: 'All',
    }[statusFilter] || 'All';

    const handleToggleStatus = (patient) => {
        if (patient.isArchived) {
            addToast(`Restore ${patient.name} from archive before changing activation status.`, 'error');
            return;
        }

        const newStatus = patient.rawStatus === 'active' ? 'inactive' : 'active';

        if (newStatus === 'active' && !patient.isVerified) {
            addToast(`Cannot activate ${patient.name}. Their email is not yet verified.`, 'error');
            return;
        }
        if (newStatus === 'active' && hasExpiredTemporaryPassword(patient)) {
            addToast(`Temporary password expired for ${patient.name}. Use Reissue Access Email instead.`, 'error');
            return;
        }

        setLifecycleConfig({
            scope: 'patient',
            entityType: 'patient',
            targetId: patient.id,
            action: newStatus === 'active' ? 'activate' : 'deactivate',
            title: newStatus === 'active' ? 'Activate Account' : 'Deactivate Account',
            message: newStatus === 'active'
                ? `Are you sure you want to ACTIVATE patient account for: ${patient.name}?`
                : `Are you sure you want to DEACTIVATE patient account for: ${patient.name}?`,
            confirmText: newStatus === 'active' ? 'Yes, Activate' : 'Yes, Deactivate',
            isDestructive: newStatus !== 'active',
            subjectName: patient.name,
            onConfirm: ({ reason }) => executeToggleStatus(patient.id, newStatus, patient.name, reason),
        });
    };

    const executeToggleStatus = async (id, newStatus, name, reason = '') => {
        try {
            const res = await authFetch(`/patient/toggle-status/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ status: newStatus, reason }),
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
            setLifecycleConfig(null);
        }
    };

    const handleArchiveToggle = (patient) => {
        const nextArchivedState = !patient.isArchived;
        setLifecycleConfig({
            scope: 'patient',
            entityType: 'patient',
            targetId: patient.id,
            action: nextArchivedState ? 'archive' : 'restore',
            title: nextArchivedState ? 'Archive Patient' : 'Restore Patient',
            message: nextArchivedState
                ? `Archive ${patient.name}? This will remove the patient from normal patient lists and lock the record for read-only history.`
                : `Restore ${patient.name} from archive? The record will return as inactive until someone activates the account again.`,
            confirmText: nextArchivedState ? 'Yes, Archive' : 'Yes, Restore',
            isDestructive: nextArchivedState,
            subjectName: patient.name,
            onConfirm: ({ reason }) => executeArchiveToggle(patient.id, nextArchivedState, patient.name, reason),
        });
    };

    const executeArchiveToggle = async (id, nextArchivedState, name, reason = '') => {
        try {
            const res = await authFetch(`/patient/archive/${id}`, {
                method: 'PUT',
                body: JSON.stringify({ isArchived: nextArchivedState, reason }),
            });

            if (res.ok) {
                setPatientsList((prevList) => prevList.map((patient) => (
                    patient.id === id
                        ? {
                            ...patient,
                            isArchived: nextArchivedState,
                            rawStatus: 'inactive',
                        }
                        : patient
                )));
                addToast(
                    nextArchivedState
                        ? `${name} has been archived successfully.`
                        : `${name} has been restored from archive. Activate the account separately if needed.`,
                    'success'
                );
            } else {
                const data = await res.json();
                addToast(data.message || 'Failed to update archive status.', 'error');
            }
        } catch (error) {
            console.error('Error archiving patient:', error);
            addToast('Cannot connect to server.', 'error');
        } finally {
            setLifecycleConfig(null);
        }
    };

    const handleRecoverAccess = async (patient) => {
        if (patient.isArchived) {
            addToast(`Restore ${patient.name} from archive before reissuing access.`, 'error');
            return null;
        }
        try {
            const isPendingActivation = !patient.isVerified && !hasExpiredTemporaryPassword(patient);
            const endpoint = hasPendingPreRegistration(patient)
                ? `/admin/appointments/${patient.pendingPreRegistration.appointmentId}/resend-pre-register`
                : isPendingActivation
                    ? `/patient/resend-activation/${patient.id}`
                    : `/patient/reissue-access/${patient.id}`;
            const res = await authFetch(endpoint, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                const updatedAccount = {
                    status: data.account?.status || patient.rawStatus,
                    rawStatus: data.account?.status || patient.rawStatus,
                    isVerified: data.account?.isVerified ?? patient.isVerified,
                    isPasswordChanged: data.account?.isPasswordChanged ?? patient.isPasswordChanged,
                    temporaryPasswordExpires: data.account?.temporaryPasswordExpires || patient.temporaryPasswordExpires,
                    pendingPreRegistration: hasPendingPreRegistration(patient) ? patient.pendingPreRegistration : null,
                };
                setPatientsList((prevList) => prevList.map((entry) => (
                    entry.id === patient.id ? { ...entry, ...updatedAccount } : entry
                )));
                addToast(data.message || `${getPatientRecoveryLabel(patient)} sent to ${patient.email}.`, 'success');
                return updatedAccount;
            }
            addToast(data.message || 'Failed to send access email.', 'error');
        } catch {
            addToast('Cannot connect to server.', 'error');
        }
        return null;
    };

    const handleEditClick = (id) => {
        if (isDentist) {
            navigate(`/dentist/patients/${id}/emr`);
            return;
        }
        setSelectedPatientId(id);
        setIsEditModalOpen(true);
    };

    const handleViewClick = (id) => {
        openPatientRecord(id);
    };

    useEffect(() => {
        if (!branchTransferState.patient?.id) return undefined;

        let cancelled = false;
        const loadPreview = async () => {
            setBranchTransferState((prev) => ({
                ...prev,
                loading: true,
                error: '',
            }));

            try {
                const query = branchTransferState.targetBranch
                    ? `?targetBranch=${encodeURIComponent(branchTransferState.targetBranch)}`
                    : '';
                const res = await authFetch(`/patients/${branchTransferState.patient.id}/branch-transfer-preview${query}`);
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                    if (!cancelled) {
                        setBranchTransferState((prev) => ({
                            ...prev,
                            preview: null,
                            loading: false,
                            error: data.message || 'Failed to load branch transfer preview.',
                        }));
                    }
                    return;
                }

                if (!cancelled) {
                    setBranchTransferState((prev) => ({
                        ...prev,
                        preview: data,
                        loading: false,
                        error: '',
                    }));
                }
            } catch (error) {
                console.error('Failed to load patient branch transfer preview:', error);
                if (!cancelled) {
                    setBranchTransferState((prev) => ({
                        ...prev,
                        preview: null,
                        loading: false,
                        error: 'Network error loading branch transfer preview.',
                    }));
                }
            }
        };

        loadPreview();
        return () => {
            cancelled = true;
        };
    }, [branchTransferState.patient?.id, branchTransferState.targetBranch]);

    const openBranchTransferModal = (patient) => {
        if (getPatientLifecycleKey(patient) !== 'active') {
            addToast('Activate this patient account before transferring branches.', 'error');
            return;
        }
        setBranchTransferState({
            patient,
            preview: null,
            loading: true,
            error: '',
            targetBranch: '',
            reason: '',
            submitting: false,
        });
    };

    const closeBranchTransferModal = () => {
        setBranchTransferState({
            patient: null,
            preview: null,
            loading: false,
            error: '',
            targetBranch: '',
            reason: '',
            submitting: false,
        });
    };

    const handleSubmitBranchTransfer = async () => {
        const patient = branchTransferState.patient;
        if (!patient) return;

        if (getPatientLifecycleKey(patient) !== 'active') {
            addToast('Activate this patient account before transferring branches.', 'error');
            closeBranchTransferModal();
            return;
        }

        if (!branchTransferState.targetBranch) {
            addToast('Please select the target branch.', 'error');
            return;
        }
        if (!branchTransferState.reason.trim()) {
            addToast('Please provide a transfer reason.', 'error');
            return;
        }

        setBranchTransferState((prev) => ({ ...prev, submitting: true }));
        try {
            const res = await authFetch(`/patients/${patient.id}/transfer-branch`, {
                method: 'PUT',
                body: JSON.stringify({
                    targetBranch: branchTransferState.targetBranch,
                    reason: branchTransferState.reason.trim(),
                }),
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                setBranchTransferState((prev) => ({
                    ...prev,
                    submitting: false,
                    preview: data.impact || prev.preview,
                    error: data.message || 'Failed to transfer patient branch.',
                }));
                addToast(data.message || 'Failed to transfer patient branch.', 'error');
                return;
            }

            setPatientsList((prevList) => prevList.map((entry) => (
                entry.id === patient.id
                    ? {
                        ...entry,
                        assignedBranch: data.patient?.assignedBranch || branchTransferState.targetBranch,
                    }
                    : entry
            )));
            addToast(data.message || `Transferred ${patient.name} to ${branchTransferState.targetBranch}.`, 'success');
            closeBranchTransferModal();
        } catch (error) {
            console.error('Error transferring patient branch:', error);
            setBranchTransferState((prev) => ({ ...prev, submitting: false, error: 'Cannot connect to server.' }));
            addToast('Cannot connect to server.', 'error');
        }
    };

    const openPatientRecord = (id) => {
        if (!id) return;

        if (dentistExperience && user?.role === 'owner') {
            navigate(`/owner/my-patients/${id}/emr`);
            return;
        }
        if (user?.role === 'administrator') navigate(`/admin/patients/${id}/emr`);
        else if (user?.role === 'owner') navigate(`/owner/patients/${id}/emr`);
        else if (user?.role === 'branch-manager') navigate(`/branch-manager/patients/${id}/emr`);
        else if (user?.role === 'secretary') navigate(`/secretary/patients/${id}/emr`);
        else if (user?.role === 'dentist') navigate(`/dentist/patients/${id}/emr`);
    };

    const handleCloseEditModal = () => { setIsEditModalOpen(false); setSelectedPatientId(null); };

    const exportRows = filteredPatients.map((patient) => {
        const computedStatus = getPatientLifecycleLabel(patient);
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
        setPrintPreviewConfig({
            title: 'Patient List Report',
            subtitle: 'Dentime Dental Clinic - NgitiFy',
            summaryItems: [
                { label: 'Visible Patients', value: filteredPatients.length },
                { label: 'Status Filter', value: statusFilterLabel },
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
                    <h1 className={styles.title}>{title}</h1>
                    <p className={styles.subtitle}>{usesDentistExperience ? 'View your assigned patients and open their EMR records.' : 'View, filter, and manage clinic patient records.'}</p>
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
                    {canEditPatients && !usesDentistExperience && (
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
                        <button className={`${styles.filterPill} ${statusFilter === 'active' ? styles.activePill : ''}`} onClick={() => setStatusFilter('active')}>Active</button>
                        <button className={`${styles.filterPill} ${statusFilter === 'needsActivation' ? styles.activePill : ''}`} onClick={() => setStatusFilter('needsActivation')}>Needs Activation</button>
                        <button className={`${styles.filterPill} ${statusFilter === 'inactive' ? styles.activePill : ''}`} onClick={() => setStatusFilter('inactive')}>Inactive</button>
                        <button className={`${styles.filterPill} ${statusFilter === 'archived' ? styles.activePill : ''}`} onClick={() => setStatusFilter('archived')}>Archived</button>
                        <button className={`${styles.filterPill} ${statusFilter === 'all' ? styles.activePill : ''}`} onClick={() => setStatusFilter('all')}>All</button>
                    </div>

                    {!isBranchScopedList && !usesDentistExperience && (
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
                    {isBranchScopedList && user?.assignedBranch && (
                        <div
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                minHeight: '46px',
                                padding: '0 18px',
                                borderRadius: '999px',
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                color: '#01538b',
                                fontSize: '13px',
                                fontWeight: 700,
                            }}
                        >
                            Branch locked to {user.assignedBranch}
                        </div>
                    )}
                </div>
            </div>

            <div className={`${styles.tableContainer} ${tblStyles.tableWrapper}`} style={{ marginTop: '20px' }}>
                <table className={`${styles.userTable} ${tblStyles.table}`}>
                    <thead>
                        <tr>
                            <th style={{ width: '34%' }}>Name</th>
                            <th>Email Address</th>
                            <th style={{ width: '110px' }}>Status</th>
                            <th style={{ width: '208px', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Loading records...</td></tr>
                        ) : paginatedPatients.length > 0 ? (
                            paginatedPatients.map((patient) => {
                                const statusKey = getPatientLifecycleKey(patient);
                                const computedStatus = getPatientLifecycleLabel(patient);
                                const isArchivedRecord = statusKey === 'archived';
                                const isBranchTransferDisabled = statusKey !== 'active';
                                return (
                                <tr key={patient.id} style={{
                                    opacity: ['inactive', 'needsActivation', 'archived'].includes(statusKey) ? 0.6 : 1,
                                    backgroundColor: ['inactive', 'needsActivation', 'archived'].includes(statusKey) ? '#f1f5f9' : undefined,
                                }}>
                                    <td className={tblStyles.wrapCell}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span className={styles.fwBold}>{patient.name}</span>
                                            <span style={{ color: '#6b7f92', fontSize: '12px' }}>{patient.assignedBranch || 'No branch'}</span>
                                        </div>
                                        {isArchivedRecord ? (
                                            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: '600', marginTop: '2px' }}>Archived record</span>
                                        ) : hasPendingPreRegistration(patient) ? (
                                            <span style={{ fontSize: '11px', color: '#b45309', display: 'block', fontWeight: '600', marginTop: '2px' }}>Pre-registration not completed</span>
                                        ) : hasExpiredTemporaryPassword(patient) ? (
                                            <span style={{ fontSize: '11px', color: '#b45309', display: 'block', fontWeight: '600', marginTop: '2px' }}>Temporary password expired</span>
                                        ) : (
                                            !patient.isVerified && <span style={{ fontSize: '11px', color: '#ef4444', display: 'block', fontWeight: '500', marginTop: '2px' }}>Unverified Email</span>
                                        )}
                                    </td>
                                    <td className={tblStyles.wrapCell} style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'initial' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span>{patient.email}</span>
                                            {(hasPendingPreRegistration(patient) || shouldShowAccessRecovery(patient)) && !isArchivedRecord && (
                                                <ResendEmailButton
                                                    cooldownKey={`patient:${patient.id}`}
                                                    onResend={() => handleRecoverAccess(patient)}
                                                    label={getPatientRecoveryLabel(patient)}
                                                    style={{ color: '#01538b', fontSize: '12px', fontWeight: 600, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                                                />
                                            )}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`${tblStyles.statusBadge} ${statusKey === 'active' ? tblStyles.statusGreen : statusKey === 'needsActivation' ? tblStyles.statusAmber : statusKey === 'archived' ? tblStyles.statusGray : tblStyles.statusRed}`}>
                                            {computedStatus}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <div className={`${tblStyles.iconActions} ${styles.actionRow}`}>
                                            <button type="button" className={`${styles.actionIconButton} ${tblStyles.iconAction} ${styles.viewIconButton}`} onClick={() => handleViewClick(patient.id)} title="View Patient EMR"><FaEye /></button>
                                            {canEditPatients && !usesDentistExperience && (
                                                <>
                                                    <button
                                                        type="button"
                                                        className={`${styles.actionIconButton} ${tblStyles.iconAction} ${styles.editIconButton}`}
                                                        onClick={() => handleEditClick(patient.id)}
                                                        title={isArchivedRecord ? 'Archived records are read-only' : 'Edit Quick Details'}
                                                        disabled={isArchivedRecord}
                                                    >
                                                        <FaEdit />
                                                    </button>
                                                    {!isDentist && (
                                                        <>
                                                            {canTransferPatientBranch && (
                                                                <button
                                                                    type="button"
                                                                    className={`${styles.actionIconButton} ${tblStyles.iconAction} ${styles.transferIconButton}`}
                                                                    onClick={() => openBranchTransferModal(patient)}
                                                                    title={isArchivedRecord
                                                                        ? 'Restore before transferring branches'
                                                                        : isBranchTransferDisabled
                                                                            ? 'Activate account before transferring branches'
                                                                            : 'Transfer Branch'}
                                                                    disabled={isBranchTransferDisabled}
                                                                >
                                                                    <FaExchangeAlt />
                                                                </button>
                                                            )}
                                                            <button
                                                                type="button"
                                                                className={`${styles.actionIconButton} ${tblStyles.iconAction} ${statusKey !== 'active' ? styles.activateIconButton : styles.deactivateIconButton}`}
                                                                onClick={() => handleToggleStatus({ ...patient, status: computedStatus })}
                                                                title={isArchivedRecord ? 'Restore before changing activation status' : statusKey === 'active' ? 'Deactivate Account' : 'Activate Account'}
                                                                disabled={isArchivedRecord}
                                                            >
                                                                {statusKey === 'active' ? <FaToggleOn /> : <FaToggleOff />}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className={`${styles.actionIconButton} ${tblStyles.iconAction} ${isArchivedRecord ? styles.activateIconButton : styles.warningIconButton}`}
                                                                onClick={() => handleArchiveToggle(patient)}
                                                                title={isArchivedRecord ? 'Restore Patient' : 'Archive Patient'}
                                                            >
                                                                {isArchivedRecord ? <FaUndo /> : <FaArchive />}
                                                            </button>
                                                        </>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                            })
                        ) : (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No results found</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {!isLoading && filteredPatients.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginTop: '16px', flexWrap: 'wrap' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '14px' }}>
                        Rows per page
                        <RowsPerPageInput
                            min="1"
                            value={rowsPerPage}
                            onChange={handleRowsPerPageChange}
                            className={styles.filterSelect}
                            style={{ width: '90px' }}
                        />
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#475569', fontSize: '14px' }}>
                        <span>Showing {(page - 1) * rowsPerPage + 1} to {Math.min(page * rowsPerPage, filteredPatients.length)} of {filteredPatients.length}</span>
                        <button type="button" className={styles.addBtn} style={{ padding: '10px 14px' }} onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>Previous</button>
                        <button type="button" className={styles.addBtn} style={{ padding: '10px 14px' }} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>Next</button>
                    </div>
                </div>
            )}

            <Suspense fallback={null}>
                {isAddModalOpen && <AddPatient onClose={() => setIsAddModalOpen(false)} onSuccess={fetchPatients} />}
                {isEditModalOpen && selectedPatientId && <EditPatient patientId={selectedPatientId} onClose={handleCloseEditModal} onSuccess={fetchPatients} />}
            </Suspense>

            {branchTransferState.patient && (
                <div className={modalStyles.modalOverlay} onClick={closeBranchTransferModal}>
                    <div className={modalStyles.modalCard} onClick={(event) => event.stopPropagation()}>
                        <div className={modalStyles.header}>
                            <div className={modalStyles.iconShell}>
                                {branchTransferState.preview?.blockers?.length ? <FaShieldAlt /> : <FaExchangeAlt />}
                            </div>
                            <div>
                                <h3 className={modalStyles.modalTitle}>Transfer Patient Branch</h3>
                                <p className={modalStyles.modalMessage}>
                                    Review the branch impact for {branchTransferState.patient.name} before moving them to a different clinic branch.
                                </p>
                            </div>
                        </div>

                        <div className={modalStyles.section}>
                            <h4 className={modalStyles.sectionTitle}>Transfer Details</h4>
                            <label className={modalStyles.label}>
                                Target Branch
                                <select
                                    className={modalStyles.selectField}
                                    value={branchTransferState.targetBranch}
                                    onChange={(event) => setBranchTransferState((prev) => ({ ...prev, targetBranch: event.target.value }))}
                                    disabled={branchTransferState.submitting}
                                >
                                    <option value="">Select a target branch</option>
                                    {branchOptions
                                        .filter((branch) => branch !== (branchTransferState.preview?.currentBranch || branchTransferState.patient.assignedBranch))
                                        .map((branch) => (
                                            <option key={branch} value={branch}>{branch}</option>
                                        ))}
                                </select>
                            </label>
                            <label className={modalStyles.label}>
                                Transfer Reason
                                <textarea
                                    className={modalStyles.textareaField}
                                    value={branchTransferState.reason}
                                    onChange={(event) => setBranchTransferState((prev) => ({ ...prev, reason: event.target.value }))}
                                    placeholder="Explain why this patient is being transferred to another branch."
                                    disabled={branchTransferState.submitting}
                                />
                            </label>
                        </div>

                        <div className={modalStyles.section}>
                            <h4 className={modalStyles.sectionTitle}>Impact Preview</h4>
                            {branchTransferState.loading ? (
                                <div className={modalStyles.loadingBox}>
                                    <FaSyncAlt className={modalStyles.spinning} />
                                    <span>Loading branch transfer impact...</span>
                                </div>
                            ) : branchTransferState.error ? (
                                <div className={modalStyles.errorBox}>{branchTransferState.error}</div>
                            ) : (
                                <>
                                    {Array.isArray(branchTransferState.preview?.blockers) && branchTransferState.preview.blockers.length > 0 && (
                                        <div className={modalStyles.blockerBox}>
                                            <strong>Transfer blocked</strong>
                                            <ul className={modalStyles.messageList}>
                                                {branchTransferState.preview.blockers.map((entry) => (
                                                    <li key={entry}>{entry}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {Array.isArray(branchTransferState.preview?.warnings) && branchTransferState.preview.warnings.length > 0 && (
                                        <div className={modalStyles.warningBox}>
                                            <strong>Review carefully</strong>
                                            <ul className={modalStyles.messageList}>
                                                {branchTransferState.preview.warnings.map((entry) => (
                                                    <li key={entry}>{entry}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {Array.isArray(branchTransferState.preview?.impactItems) && branchTransferState.preview.impactItems.length > 0 ? (
                                        <div className={modalStyles.impactGrid}>
                                            {branchTransferState.preview.impactItems.map((item) => (
                                                <div key={item.key} className={modalStyles.impactCard}>
                                                    <span className={modalStyles.impactLabel}>{item.label}</span>
                                                    {item.valueType === 'list' ? (
                                                        <div className={modalStyles.tagList}>
                                                            {item.value.map((entry) => (
                                                                <span key={`${item.key}-${entry}`} className={modalStyles.tag}>
                                                                    {entry}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <strong className={modalStyles.impactValue}>{item.value}</strong>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className={modalStyles.clearBox}>
                                            No linked branch impact was found for this patient.
                                        </div>
                                    )}
                                </>
                            )}
                        </div>

                        <div className={modalStyles.modalButtonGroup}>
                            <button className={modalStyles.cancelBtn} onClick={closeBranchTransferModal} disabled={branchTransferState.submitting}>
                                Cancel
                            </button>
                            <button
                                className={modalStyles.primaryBtn}
                                onClick={handleSubmitBranchTransfer}
                                disabled={
                                    branchTransferState.loading
                                    || branchTransferState.submitting
                                    || !branchTransferState.targetBranch
                                    || !branchTransferState.reason.trim()
                                    || Boolean(branchTransferState.error)
                                    || (branchTransferState.preview?.blockers?.length > 0)
                                }
                            >
                                {branchTransferState.submitting ? 'Transferring...' : 'Confirm Transfer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <LifecycleActionModal
                isOpen={!!lifecycleConfig}
                scope={lifecycleConfig?.scope}
                entityType={lifecycleConfig?.entityType}
                targetId={lifecycleConfig?.targetId}
                action={lifecycleConfig?.action}
                title={lifecycleConfig?.title}
                message={lifecycleConfig?.message}
                subjectName={lifecycleConfig?.subjectName}
                confirmText={lifecycleConfig?.confirmText}
                isDestructive={lifecycleConfig?.isDestructive}
                onConfirm={lifecycleConfig?.onConfirm}
                onCancel={() => setLifecycleConfig(null)}
            />
            <PrintReportPreviewModal
                isOpen={Boolean(printPreviewConfig)}
                reportConfig={printPreviewConfig}
                onClose={() => setPrintPreviewConfig(null)}
            />
        </div>
    );
}
