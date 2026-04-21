import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from '../../styles/dentist/PatientEMR.module.css';

import { authFetch } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import { formatDateLong, formatDateShort } from '../../utils/dateUtils';
import UserAvatar from '../../components/common/UserAvatar';

import { 
    FaUserMd, FaPhoneAlt, FaEnvelope, FaArrowLeft, FaCog,
    FaSyringe, FaNotesMedical, FaSearch, FaPlus, FaHospitalUser,
    FaTooth, FaChevronDown, FaChevronUp, FaTimes,
    FaUpload, FaMagic, FaRobot, FaCalendarAlt
} from 'react-icons/fa';
import Odontogram from './Odontogram';

// Default empty medical history shape (matches DB schema)
const EMPTY_MEDICAL_HISTORY = {
    lastExam: '',
    bloodType: '',
    allergies: '',
    conditions: '',
    medications: '',
    notes: ''
};

export default function PatientEMR({ patientId: propPatientId, onClose }) {
    const urlParams = useParams();
    const activePatientId = propPatientId || urlParams.patientId;

    const navigate = useNavigate();
    const { user } = useAuth();
    const { addToast } = useToast();

    // Core States
    const [activeTab, setActiveTab] = useState('overview');
    const [patient, setPatient] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Tab 1: Medical History States
    const [medicalHistory, setMedicalHistory] = useState(EMPTY_MEDICAL_HISTORY);
    const [isEditingMedical, setIsEditingMedical] = useState(false);
    const [medicalForm, setMedicalForm] = useState(EMPTY_MEDICAL_HISTORY);
    const [isSavingMedical, setIsSavingMedical] = useState(false);

    // Tab 2: Treatment Logs States
    const [logs, setLogs] = useState([]);
    const [logsSearchQuery, setLogsSearchQuery] = useState('');
    const [logsDateFrom, setLogsDateFrom] = useState('');
    const [logsDateTo, setLogsDateTo] = useState('');
    const [logsCategory, setLogsCategory] = useState('All');
    const [expandedLogs, setExpandedLogs] = useState({});
    const [isSubmittingLog, setIsSubmittingLog] = useState(false);

    // Add Log Modal
    const [isAddLogOpen, setIsAddLogOpen] = useState(false);
    const [newLogForm, setNewLogForm] = useState({ date: '', procedure: '', category: 'General', tooth: '', notes: '', branchId: '' });

    // Tab 4: Radiograph States
    const [radiographs, setRadiographs] = useState([]);
    const [selectedRadiograph, setSelectedRadiograph] = useState(null);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [isEnhanced, setIsEnhanced] = useState(false);

    // Upload Radiograph Modal
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadForm, setUploadForm] = useState({ label: '', date: '', notes: '' });
    const [uploadFile, setUploadFile] = useState(null);
    const [uploadPreview, setUploadPreview] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    // Branch list for dropdowns
    const [branches, setBranches] = useState([]);

    // ─── Fetch branches for dropdown ────────────────────────────────────────────
    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const res = await authFetch('/branches');
                if (res.ok) setBranches(await res.json());
            } catch (e) { console.error('Error fetching branches:', e); }
        };
        fetchBranches();
    }, []);

    // ─── Fetch patient, treatment logs, radiographs from real API ───────────────
    useEffect(() => {
        if (!activePatientId) return;

        const fetchPatientData = async () => {
            setIsLoading(true);
            try {
                // 1. Patient profile
                const patientRes = await authFetch(`/patients/${activePatientId}`);
                if (patientRes.ok) {
                    const patientData = await patientRes.json();
                    setPatient(patientData);

                    // Populate medical history from patient record if available
                    if (patientData.medicalHistory) {
                        // DB stores allergies/conditions/medications as arrays;
                        // the UI form expects comma-separated strings — normalise here.
                        const mh = patientData.medicalHistory;
                        const normalised = {
                            lastExam: patientData.dentalHistory?.lastExamDate
                                ? new Date(patientData.dentalHistory.lastExamDate).toISOString().split('T')[0]
                                : '',
                            bloodType: mh.bloodType || '',
                            allergies: Array.isArray(mh.allergies)
                                ? mh.allergies.join(', ')
                                : (mh.allergies || ''),
                            conditions: Array.isArray(mh.conditions)
                                ? mh.conditions.join(', ')
                                : (mh.conditions || ''),
                            medications: Array.isArray(mh.medications)
                                ? mh.medications.join(', ')
                                : (mh.medications || ''),
                            notes: mh.notes || ''
                        };
                        setMedicalHistory(normalised);
                        setMedicalForm(normalised);
                    }
                } else {
                    addToast('Failed to load patient record.', 'error');
                }

                // 2. Treatment logs
                const logsRes = await authFetch(`/patients/${activePatientId}/treatment-logs`);
                if (logsRes.ok) {
                    const logsData = await logsRes.json();
                    const normalized = logsData.map(log => ({
                        ...log,
                        id: log._id || log.id,
                        rawDate: new Date(log.date || log.rawDate),
                        doctor: log.dentistName || 'Unknown Dentist',
                        branch: log.branch || '',
                    }));
                    setLogs(normalized.sort((a, b) => b.rawDate - a.rawDate));
                }

                // 3. Radiographs
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
                console.error('Error fetching patient EMR data:', e);
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

    // ─── TAB 1: MEDICAL HISTORY ──────────────────────────────────────────────────
    const handleMedicalFormChange = (e) => {
        const { name, value } = e.target;
        setMedicalForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveMedical = async (e) => {
        e.preventDefault();
        setIsSavingMedical(true);
        try {
            // Convert comma-separated strings back to arrays for the DB
            const payload = {
                medicalHistory: {
                    bloodType: medicalForm.bloodType,
                    allergies: medicalForm.allergies
                        ? medicalForm.allergies.split(',').map(s => s.trim()).filter(Boolean)
                        : [],
                    conditions: medicalForm.conditions
                        ? medicalForm.conditions.split(',').map(s => s.trim()).filter(Boolean)
                        : [],
                    medications: medicalForm.medications
                        ? medicalForm.medications.split(',').map(s => s.trim()).filter(Boolean)
                        : [],
                    notes: medicalForm.notes,
                },
                dentalHistory: {
                    lastExamDate: medicalForm.lastExam || undefined,
                }
            };

            const res = await authFetch(`/patients/${activePatientId}`, {
                method: 'PUT',
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error((await res.json()).message || 'Failed to save.');

            setMedicalHistory(medicalForm);
            setIsEditingMedical(false);
            addToast('Medical history updated successfully.', 'success');
        } catch (err) {
            console.error('Save medical history error:', err);
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

    const renderOverview = () => (
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

    // ─── TAB 2: TREATMENT LOGS ───────────────────────────────────────────────────
    const toggleLogExpand = (id, e) => {
        if (e) e.stopPropagation();
        setExpandedLogs(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // ✅ FIX Bug 23: POST to real API instead of only updating local state
    const handleAddLogSubmit = async (e) => {
        e.preventDefault();
        setIsSubmittingLog(true);
        try {
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
                doctor: saved.dentistName || `Dr. ${user?.name?.first || ''} ${user?.name?.last || ''}`.trim() || 'Unknown Dentist',
                branch: saved.branch || newLogForm.branchId,
            };

            setLogs(prev => [newLog, ...prev].sort((a, b) => b.rawDate - a.rawDate));
            setIsAddLogOpen(false);
            setNewLogForm({ date: '', procedure: '', category: 'General', tooth: '', notes: '', branchId: '' });
            addToast('Treatment log added successfully.', 'success');
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
                                                    <FaUserMd className={styles.metaIcon}/> {log.doctor}
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
                                                        <FaTooth style={{ color: '#01538b', marginRight: '6px' }}/> {log.tooth || 'N/A'}
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

            {/* ADD LOG MODAL */}
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
        if (!uploadFile && !uploadPreview) {
            addToast('Please select an image file.', 'error');
            return;
        }
        setIsUploading(true);
        try {
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
            const newRad = {
                ...saved,
                id: saved._id || saved.id,
                rawDate: new Date(saved.date || uploadForm.date),
                type: saved.label || uploadForm.label,
                url: saved.url || uploadPreview,
            };
            setRadiographs(prev => [newRad, ...prev]);
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

    // ─── TAB 4: RADIOGRAPHS ──────────────────────────────────────────────────────
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

    const handleAIEnhance = () => {
        if (isEnhanced) { setIsEnhanced(false); return; }
        setIsEnhancing(true);
        setTimeout(() => {
            setIsEnhancing(false);
            setIsEnhanced(true);
            addToast('AI Enhancement applied successfully.', 'success');
        }, 1500);
    };

    // ✅ FIX Bug 23: Use `radiographs` state from API instead of MOCK_RADIOGRAPHS
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
                            <button className={styles.aiEnhanceBtn} onClick={handleAIEnhance} disabled={isEnhancing}>
                                {isEnhancing ? <>Processing...</> : isEnhanced ? <><FaMagic /> Revert to Original</> : <><FaMagic /> AI Enhance Clarity</>}
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
                    <button className={styles.uploadBtn} disabled title="This feature is coming soon">
                        <FaUpload /> Upload Radiograph <span style={{ fontSize: '11px', fontWeight: '500', opacity: 0.7 }}>(Coming Soon)</span>
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

    // ─── ODONTOGRAM TAB ──────────────────────────────────────────────────────────
    const renderOdontogram = () => (
        <div className={styles.contentCard}>
            <div className={styles.sectionHeaderRow}>
                <h3 className={styles.sectionTitle} style={{ marginBottom: 0 }}>Interactive Dental Chart</h3>
            </div>
            {/* ✅ FIX Bug 36: Pass real patient._id so Odontogram fetches correct data */}
            <Odontogram patientId={patient?._id || patient?.id} />
        </div>
    );

    // ─── LOADING / NOT FOUND STATES ──────────────────────────────────────────────
    if (isLoading) {
        return (
            <main className={styles['main-content']}>
                <div style={{ textAlign: 'center', padding: '100px', color: '#01538b', fontWeight: 'bold' }}>Loading Electronic Medical Record...</div>
            </main>
        );
    }

    if (!patient) {
        return (
            <main className={styles['main-content']}>
                <div style={{ textAlign: 'center', padding: '100px', color: '#ef4444', fontWeight: 'bold' }}>Patient record not found.</div>
            </main>
        );
    }

    // ─── HELPER: compute age from birthdate ──────────────────────────────────────
    const getAge = (birthdate) => {
        if (!birthdate) return null;
        const today = new Date();
        const birth = new Date(birthdate);
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    };

    // ─── NORMALISE patient display fields from real DB schema ───────────────────
    const patientName = patient.name?.first
        ? `${patient.name.first}${patient.name.middle ? ' ' + patient.name.middle : ''} ${patient.name.last}`
        : (patient.name || 'Unknown Patient');
    const patientAge  = patient.age ?? getAge(patient.birthdate);
    const patientDOB  = patient.birthdate
        ? new Date(patient.birthdate).toISOString().split('T')[0]
        : 'N/A';
    const patientPhone  = patient.contactNumber || patient.phone || 'N/A';
    const patientBranch = patient.assignedBranches?.[0] || 'N/A';
    const patientId     = patient._id || patient.id;

    // ─── RENDER ──────────────────────────────────────────────────────────────────
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
                        <h2 className={styles.patientName}>{patientName}</h2>
                        <span className={`${styles.branchBadge} ${patientBranch === 'Rizal' ? styles.rizal : ''}`}>{patientBranch} Branch</span>
                        <span className={styles.patientId}>ID: {patientId}</span>
                    </div>
                    <div className={styles.metaRow}>
                        <span className={styles.metaItem}><FaUserMd className={styles.metaIcon} /> {patient.gender || 'N/A'}{patientAge !== null ? `, ${patientAge} y/o` : ''} (DOB: {formatDateShort(patientDOB)})</span>
                        <span className={styles.metaItem}><FaPhoneAlt className={styles.metaIcon} /> {patientPhone}</span>
                        <span className={styles.metaItem}><FaEnvelope className={styles.metaIcon} /> {patient.email}</span>
                    </div>
                </div>
            </div>

            <div className={styles.tabContainer}>
                <button className={`${styles.tabBtn} ${activeTab === 'overview' ? styles.active : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
                <button className={`${styles.tabBtn} ${activeTab === 'medical' ? styles.active : ''}`} onClick={() => setActiveTab('medical')}>Treatment Logs</button>
                <button className={`${styles.tabBtn} ${activeTab === 'odontogram' ? styles.active : ''}`} onClick={() => setActiveTab('odontogram')}>Dental Chart</button>
                <button className={`${styles.tabBtn} ${activeTab === 'radiographs' ? styles.active : ''}`} onClick={() => setActiveTab('radiographs')}>Radiographs</button>
            </div>

            <div className={styles.tabContentArea}>
                {activeTab === 'overview' && renderOverview()}
                {activeTab === 'medical' && renderTreatmentLogs()}
                {activeTab === 'odontogram' && renderOdontogram()}
                {activeTab === 'radiographs' && renderRadiographs()}
            </div>
        </div>
    );

    if (onClose) {
        return (
            <div style={modalWrapperStyle}>
                <div className={styles.overlayBackground} onClick={onClose}></div>
                {innerContent}
            </div>
        );
    }

    return <main className={styles['main-content']}>{innerContent}</main>;
}