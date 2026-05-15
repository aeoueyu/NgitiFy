import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from '../../styles/admin/ManagePatients.module.css';
import tblStyles from '../../styles/wideTable.module.css';
import { FaSearch, FaUserPlus, FaEdit, FaEye, FaToggleOn, FaToggleOff, FaDownload, FaFilePdf, FaArchive, FaUndo } from 'react-icons/fa';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';
import { downloadCsvFile, openPrintReport } from '../../utils/exportHelpers';

import AddPatient from './AddPatient';
import EditPatient from './EditPatient';
import ViewPatient from './ViewPatient';
import LifecycleActionModal from '../../components/common/LifecycleActionModal';
import { useToast } from '../../context/ToastContext';
import {
    countAccountsByLifecycle,
    getAccessRecoveryLabel,
    getAccountLifecycleKey,
    getAccountLifecycleLabel,
    hasExpiredTemporaryPassword,
    matchesAccountLifecycleFilter,
    shouldShowAccessRecovery,
} from '../../utils/accountStatus';

export default function ManagePatients() {
    const { user } = useAuth();
    const { canReadPatients, canEditPatients } = usePermissions();

    const location = useLocation();
    const navigate = useNavigate();

    const { addToast } = useToast();

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('active');
    const [branchFilter, setBranchFilter] = useState('All');

    const [patientsList, setPatientsList] = useState([]);
    const [branchOptions, setBranchOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedPatientId, setSelectedPatientId] = useState(null);

    const [lifecycleConfig, setLifecycleConfig] = useState(null);

    const isSecretary = user?.role === 'secretary';
    const isDentist = user?.role === 'dentist';
    const isBranchManager = user?.role === 'branch-manager';
    const isBranchScopedList = isSecretary || isBranchManager;

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
            const response = await authFetch('/patients?includeArchived=true');

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
        const matchesStatus = matchesAccountLifecycleFilter(patient, statusFilter);
        const matchesBranch = branchFilter === 'All' || patient.assignedBranch === branchFilter;
        return matchesSearch && matchesStatus && matchesBranch;
    });

    const statusSummarySource = patientsList.filter((patient) => (
        branchFilter === 'All' || patient.assignedBranch === branchFilter
    ));

    const summaryCounts = {
        visible: filteredPatients.length,
        active: countAccountsByLifecycle(statusSummarySource, 'active'),
        needsActivation: countAccountsByLifecycle(statusSummarySource, 'needsActivation'),
        inactive: countAccountsByLifecycle(statusSummarySource, 'inactive'),
        archived: countAccountsByLifecycle(statusSummarySource, 'archived'),
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
            const res = await authFetch(`/patient/reissue-access/${patient.id}`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                const updatedAccount = {
                    status: data.account?.status || patient.rawStatus,
                    rawStatus: data.account?.status || patient.rawStatus,
                    isVerified: data.account?.isVerified ?? patient.isVerified,
                    isPasswordChanged: data.account?.isPasswordChanged ?? patient.isPasswordChanged,
                    temporaryPasswordExpires: data.account?.temporaryPasswordExpires || patient.temporaryPasswordExpires,
                };
                setPatientsList((prevList) => prevList.map((entry) => (
                    entry.id === patient.id ? { ...entry, ...updatedAccount } : entry
                )));
                addToast(data.message || `${getAccessRecoveryLabel(patient)} sent to ${patient.email}.`, 'success');
                return updatedAccount;
            }
            addToast(data.message || 'Failed to reissue access email.', 'error');
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
        setIsViewModalOpen(false);
        setSelectedPatientId(id);
        setIsEditModalOpen(true);
    };

    const handleViewClick = (id) => {
        setIsEditModalOpen(false);
        setSelectedPatientId(id);
        setIsViewModalOpen(true);
    };

    const openPatientRecord = (id) => {
        if (!id) return;

        if (user?.role === 'administrator') navigate(`/admin/patients/${id}/emr`);
        else if (user?.role === 'owner') navigate(`/owner/patients/${id}/emr`);
        else if (user?.role === 'branch-manager') navigate(`/branch-manager/patients/${id}/emr`);
        else if (user?.role === 'secretary') navigate(`/secretary/patients/${id}/emr`);
        else if (user?.role === 'dentist') navigate(`/dentist/patients/${id}/emr`);
    };

    const handleCloseEditModal = () => { setIsEditModalOpen(false); setSelectedPatientId(null); };
    const handleCloseViewModal = () => { setIsViewModalOpen(false); setSelectedPatientId(null); };

    const exportRows = filteredPatients.map((patient) => {
        const computedStatus = getAccountLifecycleLabel(patient);
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
                        <button className={`${styles.filterPill} ${statusFilter === 'active' ? styles.activePill : ''}`} onClick={() => setStatusFilter('active')}>Active</button>
                        <button className={`${styles.filterPill} ${statusFilter === 'needsActivation' ? styles.activePill : ''}`} onClick={() => setStatusFilter('needsActivation')}>Needs Activation</button>
                        <button className={`${styles.filterPill} ${statusFilter === 'inactive' ? styles.activePill : ''}`} onClick={() => setStatusFilter('inactive')}>Inactive</button>
                        <button className={`${styles.filterPill} ${statusFilter === 'archived' ? styles.activePill : ''}`} onClick={() => setStatusFilter('archived')}>Archived</button>
                        <button className={`${styles.filterPill} ${statusFilter === 'all' ? styles.activePill : ''}`} onClick={() => setStatusFilter('all')}>All</button>
                    </div>

                    {!isBranchScopedList && !isDentist && (
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

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
                <div style={{ padding: '12px 14px', borderRadius: '16px', background: '#f8fbff', border: '1px solid #dbe6f1', minWidth: '150px' }}>
                    <strong style={{ display: 'block', color: '#123e63', fontSize: '18px' }}>{summaryCounts.visible}</strong>
                    <span style={{ color: '#64748b', fontSize: '12px', fontWeight: 700 }}>Visible Patients</span>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: '16px', background: '#ecfdf5', border: '1px solid #bbf7d0', minWidth: '150px' }}>
                    <strong style={{ display: 'block', color: '#166534', fontSize: '18px' }}>{summaryCounts.active}</strong>
                    <span style={{ color: '#166534', fontSize: '12px', fontWeight: 700 }}>Active</span>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: '16px', background: '#fff7ed', border: '1px solid #fdba74', minWidth: '150px' }}>
                    <strong style={{ display: 'block', color: '#b45309', fontSize: '18px' }}>{summaryCounts.needsActivation}</strong>
                    <span style={{ color: '#b45309', fontSize: '12px', fontWeight: 700 }}>Needs Activation</span>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: '16px', background: '#fef2f2', border: '1px solid #fecaca', minWidth: '150px' }}>
                    <strong style={{ display: 'block', color: '#991b1b', fontSize: '18px' }}>{summaryCounts.inactive}</strong>
                    <span style={{ color: '#991b1b', fontSize: '12px', fontWeight: 700 }}>Inactive</span>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: '16px', background: '#f8fafc', border: '1px solid #cbd5e1', minWidth: '150px' }}>
                    <strong style={{ display: 'block', color: '#475569', fontSize: '18px' }}>{summaryCounts.archived}</strong>
                    <span style={{ color: '#475569', fontSize: '12px', fontWeight: 700 }}>Archived</span>
                </div>
            </div>

            <div className={`${styles.tableContainer} ${tblStyles.tableWrapper}`} style={{ marginTop: '20px' }}>
                <table className={`${styles.userTable} ${tblStyles.table}`}>
                    <thead>
                        <tr>
                            <th style={{ width: '34%' }}>Name</th>
                            <th style={{ width: '36%' }}>Email Address</th>
                            <th style={{ width: '110px' }}>Status</th>
                            <th style={{ width: '168px', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Loading records...</td></tr>
                        ) : filteredPatients.length > 0 ? (
                            filteredPatients.map((patient) => {
                                const statusKey = getAccountLifecycleKey(patient);
                                const computedStatus = getAccountLifecycleLabel(patient);
                                const isArchivedRecord = statusKey === 'archived';
                                return (
                                <tr key={patient.id} style={{ opacity: statusKey === 'inactive' || isArchivedRecord ? 0.6 : 1 }}>
                                    <td className={tblStyles.wrapCell}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span className={styles.fwBold}>{patient.name}</span>
                                            <span style={{ color: '#6b7f92', fontSize: '12px' }}>{patient.assignedBranch || 'No branch'}</span>
                                        </div>
                                        {isArchivedRecord ? (
                                            <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: '600', marginTop: '2px' }}>Archived record</span>
                                        ) : hasExpiredTemporaryPassword(patient) ? (
                                            <span style={{ fontSize: '11px', color: '#b45309', display: 'block', fontWeight: '600', marginTop: '2px' }}>Temporary password expired</span>
                                        ) : (
                                            !patient.isVerified && <span style={{ fontSize: '11px', color: '#ef4444', display: 'block', fontWeight: '500', marginTop: '2px' }}>Unverified Email</span>
                                        )}
                                    </td>
                                    <td className={tblStyles.wrapCell} style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'initial' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span>{patient.email}</span>
                                            {shouldShowAccessRecovery(patient) && !isArchivedRecord && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRecoverAccess(patient)}
                                                    style={{ color: '#01538b', fontSize: '12px', fontWeight: 600, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                                                >
                                                    {getAccessRecoveryLabel(patient)}
                                                </button>
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
                                            <button type="button" className={`${styles.actionIconButton} ${tblStyles.iconAction} ${styles.viewIconButton}`} onClick={() => handleViewClick(patient.id)} title="View Patient Summary"><FaEye /></button>
                                            {(canEditPatients || isDentist) && (
                                                <>
                                                    <button
                                                        type="button"
                                                        className={`${styles.actionIconButton} ${tblStyles.iconAction} ${styles.editIconButton}`}
                                                        onClick={() => handleEditClick(patient.id)}
                                                        title={isArchivedRecord ? 'Archived records are read-only' : (isDentist ? 'Open Patient EMR' : 'Edit Quick Details')}
                                                        disabled={isArchivedRecord}
                                                    >
                                                        <FaEdit />
                                                    </button>
                                                    {!isDentist && (
                                                        <>
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
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>No patients found matching your filters.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isAddModalOpen && <AddPatient onClose={() => setIsAddModalOpen(false)} onSuccess={fetchPatients} />}
            {isViewModalOpen && selectedPatientId && (
                <ViewPatient
                    patientId={selectedPatientId}
                    onClose={handleCloseViewModal}
                    onEdit={isDentist ? null : () => { setIsViewModalOpen(false); setIsEditModalOpen(true); }}
                    onOpenRecord={() => {
                        handleCloseViewModal();
                        openPatientRecord(selectedPatientId);
                    }}
                    onRecoverAccess={handleRecoverAccess}
                />
            )}
            {isEditModalOpen && selectedPatientId && <EditPatient patientId={selectedPatientId} onClose={handleCloseEditModal} onSuccess={fetchPatients} />}

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
        </div>
    );
}
