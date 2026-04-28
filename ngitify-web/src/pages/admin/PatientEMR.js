import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from '../../styles/dentist/PatientEMR.module.css';

import { useToast } from '../../context/ToastContext';
import { formatDateLong, formatDateShort } from '../../utils/dateUtils';
import UserAvatar from '../../components/common/UserAvatar';

import { 
    FaUserMd, FaPhoneAlt, FaEnvelope, FaArrowLeft, FaMapMarkerAlt,
    FaSyringe, FaNotesMedical, FaSearch, FaPlus, FaHospitalUser,
    FaTooth, FaChevronDown, FaChevronUp, FaTimes,
    FaUpload, FaMagic, FaRobot, FaCalendarAlt, FaIdCard,
    FaChild, FaVenusMars, FaBirthdayCake
} from 'react-icons/fa';
import Odontogram from '../dentist/Odontogram';

const INITIAL_MEDICAL_HISTORY = {
    lastExam: '',
    bloodType: '',
    allergies: '',
    conditions: '',
    medications: '',
    notes: ''
};

const formatAddressDisplay = (addr) => {
    if (!addr) return '—';
    const parts = [addr.houseNumber, addr.street, addr.barangay, addr.city, addr.province, addr.region]
        .filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
};

export default function PatientEMR({ patientId: propPatientId, onClose }) {
    const urlParams = useParams();
    const activePatientId = propPatientId || urlParams.patientId;
    
    const navigate = useNavigate();
    const { addToast } = useToast();
    
    // Core States
    const [activeTab, setActiveTab] = useState('overview');
    const [patient, setPatient] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Tab: Medical History States
    const [medicalHistory, setMedicalHistory] = useState(INITIAL_MEDICAL_HISTORY);
    const [isEditingMedical, setIsEditingMedical] = useState(false);
    const [medicalForm, setMedicalForm] = useState(INITIAL_MEDICAL_HISTORY);
    const [isSavingMedical, setIsSavingMedical] = useState(false);

    // Tab: Treatment Logs States
    const [logs, setLogs] = useState([]);
    const [logsSearchQuery, setLogsSearchQuery] = useState('');
    const [logsDateFrom, setLogsDateFrom] = useState('');
    const [logsDateTo, setLogsDateTo] = useState('');
    const [logsCategory, setLogsCategory] = useState('All');
    const [expandedLogs, setExpandedLogs] = useState({});
    
    // Add Log Modal
    const [isAddLogOpen, setIsAddLogOpen] = useState(false);
    const [isSubmittingLog, setIsSubmittingLog] = useState(false);
    const [newLogForm, setNewLogForm] = useState({ date: '', procedure: '', category: 'General', tooth: '', notes: '', branchId: '' });

    // Tab: Radiograph States
    const [radiographs, setRadiographs] = useState([]);
    const [selectedRadiograph, setSelectedRadiograph] = useState(null);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [isEnhanced, setIsEnhanced] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadForm, setUploadForm] = useState({ label: '', date: '', notes: '' });
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadPreview, setUploadPreview] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    const [branches, setBranches] = useState([]);

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const { authFetch } = await import('../../utils/api');
                const res = await authFetch('/branches');
                if (res.ok) setBranches(await res.json());
            } catch (e) { console.error('Error fetching branches:', e); }
        };
        fetchBranches();
    }, []);

    useEffect(() => {
        if (!activePatientId) return;

        const fetchPatientData = async () => {
            setIsLoading(true);
            try {
                const { authFetch } = await import('../../utils/api');

                const patientRes = await authFetch(`/patients/${activePatientId}`);
                if (patientRes.ok) {
                    const patientData = await patientRes.json();
                    setPatient(patientData);
                    if (patientData.medicalHistory) {
                        const toCSV = (val) =>
                            Array.isArray(val) ? val.join(', ') : (val || '');

                        const normalizedHistory = {
                            allergies:   toCSV(patientData.medicalHistory.allergies),
                            conditions:  toCSV(patientData.medicalHistory.conditions),
                            medications: toCSV(patientData.medicalHistory.medications),
                            bloodType:   patientData.medicalHistory.bloodType || '',
                            notes:       patientData.medicalHistory.notes || '',
                            lastExam:    patientData.dentalHistory?.lastExamDate
                                            || patientData.medicalHistory.lastExam
                                            || '',
                        };
                        setMedicalHistory(normalizedHistory);
                        setMedicalForm(normalizedHistory);
                    }
                } else {
                    addToast('Failed to load patient record.', 'error');
                }

                const logsRes = await authFetch(`/patients/${activePatientId}/treatment-logs`);
                if (logsRes.ok) {
                    const logsData = await logsRes.json();
                    const normalized = logsData.map(log => ({
                        ...log,
                        id: log._id || log.id,
                        rawDate: new Date(log.date || log.rawDate),
                    }));
                    setLogs(normalized.sort((a, b) => b.rawDate - a.rawDate));
                }

                const radRes = await authFetch(`/patients/${activePatientId}/radiographs`);
                if (radRes.ok) {
                    const radData = await radRes.json();
                    const normalizedRads = radData.map(r => ({
                        ...r,
                        id: r._id || r.id,
                        rawDate: new Date(r.date || r.uploadedAt || r.createdAt),
                        type: r.label || r.type || 'Radiograph',
                        url: r.url || r.imageUrl,
                    }));
                    setRadiographs(normalizedRads);
                }

            } catch (e) {
                console.error('Error fetching patient data:', e);
                addToast('Could not connect to the server.', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        fetchPatientData();
    }, [activePatientId, addToast]);

    const handleBack = () => {
        if (onClose) onClose(); 
        else navigate(-1); 
    };

    // ─── OVERVIEW TAB: Patient Info ────────────────────────────────────────────
    const renderOverview = () => {
        const patientAge = patient?.birthdate
            ? Math.floor((new Date() - new Date(patient.birthdate)) / 31557600000)
            : null;

        const infoItem = (label, value, icon = null) => (
            <div className={styles.infoBlock}>
                <span className={styles.infoLabel}>{label}</span>
                <p className={styles.infoValue}>
                    {icon && <span style={{ marginRight: '6px', color: '#94a3b8' }}>{icon}</span>}
                    {value || '—'}
                </p>
            </div>
        );

        return (
            <div className={styles.contentCard}>
                <h3 className={styles.sectionTitle}>Personal Information</h3>
                <div className={styles.infoGrid}>
                    {infoItem('Full Name',
                        patient?.name?.first
                            ? `${patient.name.first}${patient.name.middle ? ' ' + patient.name.middle : ''} ${patient.name.last}`
                            : (typeof patient?.name === 'string' ? patient.name : '—')
                    )}
                    {infoItem('Gender', patient?.gender, <FaVenusMars />)}
                    {infoItem('Date of Birth',
                        patient?.birthdate
                            ? `${formatDateLong(patient.birthdate)}${patientAge !== null ? ` (${patientAge} years old)` : ''}` 
                            : '—',
                        <FaBirthdayCake />
                    )}
                    {infoItem('Email Address', patient?.email, <FaEnvelope />)}
                    {infoItem('Contact Number', patient?.contactNumber || '—', <FaPhoneAlt />)}
                    {infoItem('Patient ID', patient?._id || patient?.id, <FaIdCard />)}
                </div>

                {patient?.guardian && (
                    <>
                        <h3 className={styles.sectionTitle} style={{ marginTop: '28px' }}>Guardian Information</h3>
                        <div className={styles.infoGrid}>
                            {infoItem('Guardian Name', patient.guardian.name, <FaChild />)}
                            {infoItem('Relationship', patient.guardian.relationship)}
                            {infoItem('Guardian Contact', patient.guardian.contactNumber, <FaPhoneAlt />)}
                        </div>
                    </>
                )}

                <h3 className={styles.sectionTitle} style={{ marginTop: '28px' }}>Current Address</h3>
                <div className={styles.infoGrid}>
                    {infoItem('House No.', patient?.currentAddress?.houseNumber)}
                    {infoItem('Street', patient?.currentAddress?.street)}
                    {infoItem('Barangay', patient?.currentAddress?.barangay)}
                    {infoItem('City / Municipality', patient?.currentAddress?.city)}
                    {infoItem('Province', patient?.currentAddress?.province)}
                    {infoItem('Region', patient?.currentAddress?.region)}
                </div>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Full Current Address</span>
                    <p className={styles.infoValue}>
                        <FaMapMarkerAlt style={{ color: '#94a3b8', marginRight: '6px' }} />
                        {formatAddressDisplay(patient?.currentAddress)}
                    </p>
                </div>

                <h3 className={styles.sectionTitle} style={{ marginTop: '28px' }}>Permanent Address</h3>
                <div className={styles.infoGrid}>
                    {infoItem('House No.', patient?.permanentAddress?.houseNumber)}
                    {infoItem('Street', patient?.permanentAddress?.street)}
                    {infoItem('Barangay', patient?.permanentAddress?.barangay)}
                    {infoItem('City / Municipality', patient?.permanentAddress?.city)}
                    {infoItem('Province', patient?.permanentAddress?.province)}
                    {infoItem('Region', patient?.permanentAddress?.region)}
                </div>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Full Permanent Address</span>
                    <p className={styles.infoValue}>
                        <FaMapMarkerAlt style={{ color: '#94a3b8', marginRight: '6px' }} />
                        {formatAddressDisplay(patient?.permanentAddress)}
                    </p>
                </div>
            </div>
        );
    };

    // ─── MEDICAL HISTORY & ALERTS TAB ──────────────────────────────────────────
    const handleMedicalFormChange = (e) => {
        const { name, value } = e.target;
        setMedicalForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveMedical = async (e) => {
        e.preventDefault();
        setIsSavingMedical(true);
        try {
            const { authFetch } = await import('../../utils/api');
            const res = await authFetch(`/patients/${activePatientId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    medicalHistory: {
                        bloodType:   medicalForm.bloodType,
                        allergies:   medicalForm.allergies
                            ? medicalForm.allergies.split(',').map(s => s.trim()).filter(Boolean)
                            : [],
                        conditions:  medicalForm.conditions
                            ? medicalForm.conditions.split(',').map(s => s.trim()).filter(Boolean)
                            : [],
                        medications: medicalForm.medications
                            ? medicalForm.medications.split(',').map(s => s.trim()).filter(Boolean)
                            : [],
                        notes: medicalForm.notes,
                    },
                    dentalHistory: {
                        lastExamDate: medicalForm.lastExam || undefined,
                    },
                }),
            });
            if (!res.ok) throw new Error((await res.json()).message);
            setMedicalHistory(medicalForm);
            setIsEditingMedical(false);
            addToast('Medical history updated successfully.', 'success');
        } catch (err) {
            addToast(err.message || 'Failed to update medical history.', 'error');
        } finally {
            setIsSavingMedical(false);
        }
    };

    const handleCancelMedical = () => {
        setMedicalForm(medicalHistory);
        setIsEditingMedical(false);
    };

    const renderTags = (csvString, isWarning = false) => {
        if (!csvString || csvString.trim() === '') return <p className={styles.infoValue}>None reported.</p>;
        const items = csvString.split(',').map(i => i.trim()).filter(i => i !== '');
        return (
            <div className={styles.tagList}>
                {items.map((item, idx) => (
                    <span key={idx} className={`${styles.tag} ${isWarning ? styles.warning : ''}`}>{item}</span>
                ))}
            </div>
        );
    };

    const renderList = (csvString) => {
        if (!csvString || csvString.trim() === '') return <p className={styles.infoValue}>None reported.</p>;
        const items = csvString.split(',').map(i => i.trim()).filter(i => i !== '');
        return (
            <ul style={{ margin: '5px 0 0 15px', color: '#334155', fontWeight: '600', fontSize: '14px' }}>
                {items.map((item, idx) => <li key={idx} style={{marginBottom: '5px'}}>{item}</li>)}
            </ul>
        );
    };

    const renderMedicalHistory = () => (
        <div className={styles.contentCard}>
            <div className={styles.sectionHeaderRow}>
                <h3 className={styles.sectionTitle}>Medical History & Alerts</h3>
                {!isEditingMedical && (
                    <button className={styles.actionBtn} onClick={() => setIsEditingMedical(true)}>
                        Edit Medical History
                    </button>
                )}
            </div>

            {isEditingMedical ? (
                <form onSubmit={handleSaveMedical}>
                    <div className={styles.infoGrid} style={{ marginBottom: '20px' }}>
                        <div className={styles.formGroup}>
                            <label>Allergies (Comma separated)</label>
                            <input type="text" name="allergies" value={medicalForm.allergies} onChange={handleMedicalFormChange} className={styles.inputField} placeholder="e.g., Penicillin, Latex" />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Pre-existing Conditions</label>
                            <input type="text" name="conditions" value={medicalForm.conditions} onChange={handleMedicalFormChange} className={styles.inputField} placeholder="e.g., Asthma, Diabetes" />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Current Medications</label>
                            <input type="text" name="medications" value={medicalForm.medications} onChange={handleMedicalFormChange} className={styles.inputField} placeholder="e.g., Albuterol" />
                        </div>
                        <div className={styles.formGroup}>
                            <label>Blood Type</label>
                            <select name="bloodType" value={medicalForm.bloodType} onChange={handleMedicalFormChange} className={styles.inputField}>
                                <option value="">Select</option>
                                <option value="A+">A+</option><option value="A-">A-</option>
                                <option value="B+">B+</option><option value="B-">B-</option>
                                <option value="AB+">AB+</option><option value="AB-">AB-</option>
                                <option value="O+">O+</option><option value="O-">O-</option>
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <label>Last Medical/Dental Exam</label>
                            <input type="date" name="lastExam" value={medicalForm.lastExam} onChange={handleMedicalFormChange} className={styles.inputField} />
                        </div>
                    </div>
                    <div className={styles.formGroup}>
                        <label>Clinical Notes & Remarks</label>
                        <textarea name="notes" value={medicalForm.notes} onChange={handleMedicalFormChange} className={styles.textareaField} placeholder="Add any special instructions or warnings here..." />
                    </div>
                    
                    <div className={styles.formActions}>
                        <button type="button" className={styles.cancelBtn} onClick={handleCancelMedical} disabled={isSavingMedical}>Cancel</button>
                        <button type="submit" className={styles.saveBtn} disabled={isSavingMedical}>
                            {isSavingMedical ? 'Saving...' : 'Save Updates'}
                        </button>
                    </div>
                </form>
            ) : (
                <>
                    <div className={styles.infoGrid}>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel} style={{ color: '#ef4444' }}><FaSyringe style={{marginRight: '6px'}}/> Allergies (Red Flags)</span>
                            {renderTags(medicalHistory.allergies, true)}
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}><FaNotesMedical style={{marginRight: '6px'}}/> Pre-existing Conditions</span>
                            {renderTags(medicalHistory.conditions)}
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}>Current Medications</span>
                            {renderList(medicalHistory.medications)}
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}>Blood Type</span>
                            <p className={styles.infoValue}>{medicalHistory.bloodType || 'Not specified'}</p>
                        </div>
                        <div className={styles.infoBlock}>
                            <span className={styles.infoLabel}>Last Exam</span>
                            <p className={styles.infoValue}>{medicalHistory.lastExam ? formatDateLong(medicalHistory.lastExam) : 'Not specified'}</p>
                        </div>
                    </div>
                    {medicalHistory.notes && (
                        <div className={styles.infoBlock} style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '25px' }}>
                            <span className={styles.infoLabel}>Clinical Notes & Remarks</span>
                            <p className={styles.infoValue} style={{ color: '#475569', fontStyle: 'italic' }}>"{medicalHistory.notes}"</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );

    // ─── TREATMENT LOGS TAB ────────────────────────────────────────────────────
    const toggleLogExpand = (id, e) => {
        if (e) e.stopPropagation();
        setExpandedLogs(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleAddLogSubmit = async (e) => {
        e.preventDefault();
        setIsSubmittingLog(true);
        try {
            const { authFetch } = await import('../../utils/api');
            const res = await authFetch(`/patients/${activePatientId}/treatment-logs`, {
                method: 'POST',
                body: JSON.stringify({
                    date: newLogForm.date,
                    procedure: newLogForm.procedure,
                    category: newLogForm.category,
                    tooth: newLogForm.tooth || 'N/A',
                    notes: newLogForm.notes,
                    branch: newLogForm.branchId,
                }),
            });
            if (!res.ok) throw new Error((await res.json()).message || 'Failed to save log.');

            const saved = await res.json();
            const newLog = {
                ...saved,
                id: saved._id || saved.id,
                rawDate: new Date(saved.date || newLogForm.date),
            };
            setLogs(prev => [newLog, ...prev].sort((a, b) => b.rawDate - a.rawDate));
            setIsAddLogOpen(false);
            setNewLogForm({ date: '', procedure: '', category: 'General', tooth: '', notes: '', branchId: '' });
            addToast("Treatment log added successfully.", "success");
        } catch (err) {
            console.error('Add log error:', err);
            addToast(err.message || 'Failed to save treatment log.', 'error');
        } finally {
            setIsSubmittingLog(false);
        }
    };

    const filteredLogs = logs.filter(log => {
        const searchLower = logsSearchQuery.toLowerCase();
        const matchesSearch = (log.procedure || '').toLowerCase().includes(searchLower) || (log.notes || '').toLowerCase().includes(searchLower);
        const matchesCategory = logsCategory === 'All' || log.category === logsCategory;
        
        let matchesDate = true;
        if (logsDateFrom) matchesDate = matchesDate && log.rawDate >= new Date(logsDateFrom);
        if (logsDateTo) {
            const end = new Date(logsDateTo);
            end.setHours(23, 59, 59, 999);
            matchesDate = matchesDate && log.rawDate <= end;
        }
        return matchesSearch && matchesCategory && matchesDate;
    });

    const renderTreatmentLogs = () => (
        <div className={styles.contentCard}>
            <div className={styles.sectionHeaderRow} style={{ marginBottom: '20px' }}>
                <h3 className={styles.sectionTitle}>Treatment & Activity Timeline</h3>
                <button className={styles.actionBtn} onClick={() => setIsAddLogOpen(true)}>
                    <FaPlus /> Add Log
                </button>
            </div>

            <div className={styles.controlsRow}>
                <div className={styles.searchFilterGroup}>
                    <div className={styles.searchWrapper}>
                        <FaSearch className={styles.searchIcon} />
                        <input 
                            type="text" placeholder="Search procedures or notes..." 
                            className={styles.searchInput} value={logsSearchQuery} 
                            onChange={(e) => setLogsSearchQuery(e.target.value)} 
                        />
                    </div>
                    
                    <select className={styles.filterSelect} value={logsCategory} onChange={(e) => setLogsCategory(e.target.value)}>
                        <option value="All">All Categories</option>
                        <option value="Prophylaxis">Prophylaxis</option>
                        <option value="Restoration">Restoration</option>
                        <option value="Extraction">Extraction</option>
                        <option value="Orthodontics">Orthodontics</option>
                        <option value="General">General</option>
                    </select>

                    <div className={styles.dateFilterWrapper}>
                        <input type="date" className={styles.dateInput} value={logsDateFrom} onChange={(e) => setLogsDateFrom(e.target.value)} title="From Date" />
                        <span className={styles.dateSeparator}>-</span>
                        <input type="date" className={styles.dateInput} value={logsDateTo} onChange={(e) => setLogsDateTo(e.target.value)} title="To Date" />
                    </div>
                </div>
            </div>

            <div className={styles.timeline}>
                {filteredLogs.length > 0 ? (
                    filteredLogs.map(log => {
                        const isExpanded = !!expandedLogs[log.id];
                        return (
                            <div key={log.id} className={styles.timelineItem}>
                                <div className={styles.timelineDot}></div>
                                <div className={styles.timelineCard}>
                                    <div className={styles.timelineHeader} onClick={(e) => toggleLogExpand(log.id, e)}>
                                        <div className={styles.timelineMain}>
                                            <h4 className={styles.timelineDate}>{formatDateLong(log.rawDate.toISOString())}</h4>
                                            <p className={styles.timelineProcedure}>{log.procedure}</p>
                                            
                                            <div className={styles.timelineMeta}>
                                                <span className={styles.metaTag} title="Attending Dentist">
                                                    <FaUserMd className={styles.metaIcon}/> {log.doctor || log.dentist || 'N/A'}
                                                </span>
                                                <span className={styles.metaTag} title="Branch">
                                                    <FaHospitalUser className={styles.metaIcon}/> {log.branch} Branch
                                                </span>
                                            </div>
                                        </div>

                                        <button className={styles.expandBtn}>
                                            {isExpanded ? 'Hide Details' : 'View Details'}
                                            {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                                        </button>
                                    </div>

                                    {isExpanded && (
                                        <div className={styles.timelineDetails}>
                                            <div className={styles.detailGrid}>
                                                <div className={styles.detailBlock}>
                                                    <span className={styles.detailLabel}>Treated Tooth #</span>
                                                    <p className={styles.detailValue}>
                                                        <FaTooth style={{ color: '#01538b', marginRight: '6px' }}/> {log.tooth}
                                                    </p>
                                                </div>
                                                <div className={styles.detailBlock}>
                                                    <span className={styles.detailLabel}>Clinical Notes & Remarks</span>
                                                    <p className={styles.detailValue}>{log.notes}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className={styles.emptyState}>No treatment logs match the current filters.</div>
                )}
            </div>

            {isAddLogOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard} style={{ maxWidth: '500px' }}>
                        <h3 className={styles.modalTitle} style={{ textAlign: 'left', border: 'none', padding: 0, marginBottom: '20px' }}>Add Treatment Log</h3>
                        <form onSubmit={handleAddLogSubmit} style={{ textAlign: 'left' }}>
                            <div className={styles.formGroup}>
                                <label>Date of Procedure <span style={{color:'red'}}>*</span></label>
                                <input type="date" required className={styles.inputField} value={newLogForm.date} onChange={(e) => setNewLogForm({...newLogForm, date: e.target.value})} />
                            </div>
                            <div className={styles.formGrid} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                <div className={styles.formGroup}>
                                    <label>Procedure Name <span style={{color:'red'}}>*</span></label>
                                    <input type="text" required className={styles.inputField} value={newLogForm.procedure} onChange={(e) => setNewLogForm({...newLogForm, procedure: e.target.value})} placeholder="e.g. Extraction" />
                                </div>
                                <div className={styles.formGroup}>
                                    <label>Category <span style={{color:'red'}}>*</span></label>
                                    <select required className={styles.inputField} value={newLogForm.category} onChange={(e) => setNewLogForm({...newLogForm, category: e.target.value})}>
                                        <option value="General">General</option>
                                        <option value="Prophylaxis">Prophylaxis</option>
                                        <option value="Restoration">Restoration</option>
                                        <option value="Extraction">Extraction</option>
                                        <option value="Orthodontics">Orthodontics</option>
                                    </select>
                                </div>
                            </div>
                            <div className={styles.formGroup}>
                                <label>Tooth Number(s)</label>
                                <input type="text" className={styles.inputField} value={newLogForm.tooth} onChange={(e) => setNewLogForm({...newLogForm, tooth: e.target.value})} placeholder="e.g. 45, 46 or All" />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Clinical Notes <span style={{color:'red'}}>*</span></label>
                                <textarea required className={styles.textareaField} value={newLogForm.notes} onChange={(e) => setNewLogForm({...newLogForm, notes: e.target.value})} placeholder="Describe the procedure, patient condition, etc." />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Branch <span style={{color:'red'}}>*</span></label>
                                <select
                                    required
                                    className={styles.inputField}
                                    value={newLogForm.branchId}
                                    onChange={(e) => setNewLogForm({...newLogForm, branchId: e.target.value})}
                                >
                                    <option value="" disabled hidden>Select Branch</option>
                                    {branches.map(b => (
                                        <option key={b._id} value={b.name}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className={styles.modalButtonGroup}>
                                <button type="button" className={styles.cancelBtn} onClick={() => setIsAddLogOpen(false)} disabled={isSubmittingLog}>Cancel</button>
                                <button type="submit" className={styles.saveBtn} disabled={isSubmittingLog}>
                                    {isSubmittingLog ? 'Saving...' : 'Save Log'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );

    // ─── RADIOGRAPHS TAB ───────────────────────────────────────────────────────
    const openRadiograph = (img) => {
        setSelectedRadiograph(img);
        setIsEnhancing(false);
        setIsEnhanced(false);
    };

    const closeImageModal = () => {
        setSelectedRadiograph(null);
        setIsEnhancing(false);
        setIsEnhanced(false);
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) {
            addToast('Image must be under 3MB.', 'error');
            return;
        }
        setUploadFile(file);
        const reader = new FileReader();
        reader.onloadend = () => setUploadPreview(reader.result);
        reader.readAsDataURL(file);
    };

    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        if (!uploadForm.label || !uploadForm.date) {
            addToast('Label and date are required.', 'error');
            return;
        }
        if (!uploadPreview) {
            addToast('Please select an image file.', 'error');
            return;
        }
        setIsUploading(true);
        try {
            const { authFetch } = await import('../../utils/api');
            const res = await authFetch(`/patients/${activePatientId}/radiographs`, {
                method: 'POST',
                body: JSON.stringify({
                    label: uploadForm.label,
                    date: uploadForm.date,
                    url: uploadPreview,
                    notes: uploadForm.notes,
                }),
            });
            if (!res.ok) throw new Error((await res.json()).message || 'Upload failed.');
            const saved = await res.json();
            setRadiographs(prev => [{
                ...saved,
                id: saved._id || saved.id,
                rawDate: new Date(saved.date || uploadForm.date),
                type: saved.label || uploadForm.label,
                url: saved.url || uploadPreview,
            }, ...prev]);
            setIsUploadModalOpen(false);
            setUploadForm({ label: '', date: '', notes: '' });
            setUploadFile(null);
            setUploadPreview(null);
            addToast('Radiograph uploaded successfully.', 'success');
        } catch (err) {
            addToast(err.message || 'Failed to upload radiograph.', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    const handleAIEnhance = () => {
        if (isEnhanced) { setIsEnhanced(false); return; }
        setIsEnhancing(true);
        setTimeout(() => {
            setIsEnhancing(false);
            setIsEnhanced(true);
            addToast("AI Enhancement applied successfully.", "success");
        }, 1500);
    };

    const renderRadiographs = () => {
        if (selectedRadiograph) {
            return (
                <div className={styles.contentCard}>
                    <div className={styles.imageViewerContainer}>
                        <div className={styles.imageViewerHeader}>
                            <button className={styles.backToGalleryBtn} onClick={closeImageModal}>
                                <FaArrowLeft /> Back to Gallery
                            </button>
                            <div className={styles.imageViewerTitleBox}>
                                <h3 className={styles.sectionTitle} style={{ margin: 0, borderLeft: 'none', paddingLeft: 0 }}>
                                    {selectedRadiograph.type}
                                </h3>
                                <p className={styles.radioDate}><FaCalendarAlt style={{color: '#94a3b8'}}/> {formatDateShort(selectedRadiograph.rawDate)}</p>
                            </div>
                        </div>

                        <div className={styles.largeRadiographWrapper}>
                            <img 
                                src={selectedRadiograph.url} 
                                alt={selectedRadiograph.type} 
                                className={`${styles.largeRadiograph} ${isEnhanced ? styles.enhancedImage : ''}`}
                            />
                            {isEnhancing && (
                                <div className={styles.loadingOverlay}>
                                    <FaRobot className={styles.spinningIcon} />
                                    <span>AI is clarifying image...</span>
                                </div>
                            )}
                        </div>

                        <div className={styles.imageViewerControls}>
                            <button 
                                className={styles.aiEnhanceBtn} 
                                onClick={handleAIEnhance}
                                disabled={isEnhancing}
                            >
                                {isEnhancing ? (
                                    <>Processing...</>
                                ) : isEnhanced ? (
                                    <><FaMagic /> Revert to Original</>
                                ) : (
                                    <><FaMagic /> AI Enhance Clarity</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className={styles.contentCard}>
                <div className={styles.sectionHeaderRow}>
                    <h3 className={styles.sectionTitle} style={{ marginBottom: 0 }}>Dental Radiographs (X-Rays)</h3>
                    <button className={styles.uploadBtn} onClick={() => setIsUploadModalOpen(true)}>
                        <FaUpload /> Upload Radiograph
                    </button>
                </div>

                {radiographs.length > 0 ? (
                    <div className={styles.radiographGrid}>
                        {radiographs.map(img => (
                            <div key={img.id} className={styles.radioCard} onClick={() => openRadiograph(img)}>
                                <div className={styles.radioThumbnailWrapper}>
                                    <img src={img.url} alt={img.type} className={styles.radioThumbnail} />
                                </div>
                                <div className={styles.radioMeta}>
                                    <h4 className={styles.radioType}>{img.type}</h4>
                                    <span className={styles.radioDate}><FaCalendarAlt style={{color: '#94a3b8'}}/> {formatDateShort(img.rawDate)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={styles.emptyState}>
                        No radiographs or imaging records found for this patient.
                    </div>
                )}
            </div>
        );
    };

    const renderOdontogram = () => (
        <div className={styles.contentCard}>
            <div className={styles.sectionHeaderRow}>
                <h3 className={styles.sectionTitle} style={{ marginBottom: 0 }}>Interactive Dental Chart</h3>
            </div>
            <Odontogram patientId={activePatientId} /> 
        </div>
    );

    const renderUploadModal = () => (
        isUploadModalOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
                <div style={{ background: 'white', borderRadius: '16px', padding: '40px', width: '90%', maxWidth: '480px', boxShadow: '0 15px 40px rgba(0,0,0,0.2)', fontFamily: "'Lexend Deca', sans-serif" }}>
                    <h3 style={{ color: '#01538b', fontSize: '20px', fontWeight: '800', margin: '0 0 20px 0', borderLeft: '4px solid #2dccf6', paddingLeft: '12px' }}>Upload Radiograph</h3>
                    <form onSubmit={handleUploadSubmit}>
                        <div className={styles.formGroup} style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Label / Type <span style={{ color: 'red' }}>*</span></label>
                            <input type="text" className={styles.inputField} placeholder="e.g. Panoramic, Periapical, Bitewing" value={uploadForm.label} onChange={(e) => setUploadForm(p => ({ ...p, label: e.target.value }))} required />
                        </div>
                        <div className={styles.formGroup} style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Date Taken <span style={{ color: 'red' }}>*</span></label>
                            <input type="date" className={styles.inputField} value={uploadForm.date} onChange={(e) => setUploadForm(p => ({ ...p, date: e.target.value }))} required />
                        </div>
                        <div className={styles.formGroup} style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Image File <span style={{ color: 'red' }}>*</span></label>
                            <input type="file" accept="image/*" onChange={handleFileSelect} style={{ fontSize: '13px', fontFamily: "'Lexend Deca', sans-serif" }} />
                            {uploadPreview && (
                                <img src={uploadPreview} alt="Preview" style={{ marginTop: '10px', width: '100%', maxHeight: '140px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f1f5f9' }} />
                            )}
                        </div>
                        <div className={styles.formGroup} style={{ marginBottom: '24px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Notes (Optional)</label>
                            <textarea className={styles.textareaField} placeholder="Any clinical notes about this image..." value={uploadForm.notes} onChange={(e) => setUploadForm(p => ({ ...p, notes: e.target.value }))} rows={3} />
                        </div>
                        <div className={styles.modalButtonGroup}>
                            <button type="button" className={styles.cancelBtn} onClick={() => { setIsUploadModalOpen(false); setUploadPreview(null); setUploadFile(null); setUploadForm({ label: '', date: '', notes: '' }); }} disabled={isUploading}>Cancel</button>
                            <button type="submit" className={styles.saveBtn} disabled={isUploading}>
                                {isUploading ? 'Uploading...' : 'Upload'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )
    );

    // ─── LOADING STATE ─────────────────────────────────────────────────────────
    // FIX: Show loading INSIDE the modal when onClose is provided
    if (isLoading) {
        const loadingContent = (
            <div style={{ textAlign: 'center', padding: '60px 40px', color: '#01538b', fontWeight: 'bold' }}>
                Loading Electronic Medical Record...
            </div>
        );

        if (onClose) {
            return (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div className={styles.overlayBackground} onClick={onClose}></div>
                    <div className={styles.formCard} style={{ backgroundColor: '#f4f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {loadingContent}
                    </div>
                </div>
            );
        }
        return (
            <main className={styles['main-content']}>
                {loadingContent}
            </main>
        );
    }

    if (!patient) {
        const notFoundContent = (
            <div style={{ textAlign: 'center', padding: '100px', color: '#ef4444', fontWeight: 'bold' }}>Patient record not found.</div>
        );
        if (onClose) {
            return (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div className={styles.overlayBackground} onClick={onClose}></div>
                    <div className={styles.formCard} style={{ backgroundColor: '#f4f7fa' }}>{notFoundContent}</div>
                </div>
            );
        }
        return <main className={styles['main-content']}>{notFoundContent}</main>;
    }

    const patientAge = patient?.birthdate
        ? Math.floor((new Date() - new Date(patient.birthdate)) / 31557600000)
        : null;
    const patientPhone = patient?.contactNumber || 'N/A';

    const modalWrapperStyle = onClose ? {
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
    } : {};

    const innerContent = (
        <div className={onClose ? styles.formCard : ''} style={onClose ? { backgroundColor: '#f4f7fa' } : {}}>
            <div className={styles.headerWrapper}>
                <div className={styles.headerLeft}>
                    <button className={styles.backIconButton} onClick={handleBack} title="Back">
                        {onClose ? <FaTimes /> : <FaArrowLeft />}
                    </button>
                    <div className={styles.header}>
                        <h1 className={styles.title}>Electronic Medical Record</h1>
                        <p className={styles.subtitle}>Comprehensive clinical profile and treatment history</p>
                    </div>
                </div>
            </div>

            <div className={styles.profileHeaderCard}>
                <UserAvatar user={{ name: patient.name, profileImage: patient.profileImage }} size={90} style={{ border: '3px solid #e0f2fe', boxShadow: '0 4px 10px rgba(1,83,139,0.1)' }} />
                <div className={styles.patientMainInfo}>
                    <div className={styles.nameRow}>
                        <h2 className={styles.patientName}>
                            {patient.name?.first ? `${patient.name.first} ${patient.name.last}` : patient.name}
                        </h2>
                        {patient.assignedBranches?.[0] && (
                            <span className={styles.branchBadge}>{patient.assignedBranches[0]} Branch</span>
                        )}
                        <span className={styles.patientId}>ID: {patient._id || patient.id}</span>
                    </div>
                    <div className={styles.metaRow}>
                        <span className={styles.metaItem}>
                            <FaUserMd className={styles.metaIcon} />
                            {patient.gender}{patientAge ? `, ${patientAge} y/o` : ''}
                            {patient.birthdate ? ` (DOB: ${formatDateShort(patient.birthdate)})` : ''}
                        </span>
                        <span className={styles.metaItem}><FaPhoneAlt className={styles.metaIcon} /> {patientPhone}</span>
                        <span className={styles.metaItem}><FaEnvelope className={styles.metaIcon} /> {patient.email}</span>
                    </div>
                </div>
            </div>

            {/* Updated Tab Structure */}
            <div className={styles.tabContainer}>
                <button className={`${styles.tabBtn} ${activeTab === 'overview' ? styles.active : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
                <button className={`${styles.tabBtn} ${activeTab === 'medicalHistory' ? styles.active : ''}`} onClick={() => setActiveTab('medicalHistory')}>Medical History & Alerts</button>
                <button className={`${styles.tabBtn} ${activeTab === 'treatmentLogs' ? styles.active : ''}`} onClick={() => setActiveTab('treatmentLogs')}>Treatment Logs</button>
                <button className={`${styles.tabBtn} ${activeTab === 'odontogram' ? styles.active : ''}`} onClick={() => setActiveTab('odontogram')}>Dental Chart</button>
                <button className={`${styles.tabBtn} ${activeTab === 'radiographs' ? styles.active : ''}`} onClick={() => setActiveTab('radiographs')}>Radiographs</button>
            </div>

            <div className={styles.tabContentArea}>
                {activeTab === 'overview'       && renderOverview()}
                {activeTab === 'medicalHistory' && renderMedicalHistory()}
                {activeTab === 'treatmentLogs'  && renderTreatmentLogs()}
                {activeTab === 'odontogram'     && renderOdontogram()}
                {activeTab === 'radiographs'    && renderRadiographs()}
            </div>
        </div>
    );

    if (onClose) {
        return (
            <div style={modalWrapperStyle}>
                <div className={styles.overlayBackground} onClick={onClose}></div>
                {innerContent}
                {renderUploadModal()}
            </div>
        );
    }

    return <main className={styles['main-content']}>{innerContent}</main>;
}