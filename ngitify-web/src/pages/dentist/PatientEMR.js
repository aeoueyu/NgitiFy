import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from '../../styles/dentist/PatientEMR.module.css';

// CRITICAL RULE IMPORTS
import { useToast } from '../../context/ToastContext';
import { formatDateLong, formatDateShort } from '../../utils/dateUtils';
import UserAvatar from '../../components/common/UserAvatar';

import { 
    FaUserMd, FaPhoneAlt, FaEnvelope, FaArrowLeft, FaCog,
    FaSyringe, FaNotesMedical, FaSearch, FaPlus, FaHospitalUser,
    FaTooth, FaChevronDown, FaChevronUp, FaTimes,
    FaUpload, FaMagic, FaRobot, FaCalendarAlt // Task 3.3 New Icons
} from 'react-icons/fa';
import Odontogram from './Odontogram';

// --- MOCK DATA ---
const MOCK_PATIENT = {
    id: 'PT-2023-0842',
    name: 'Eleanor Vance',
    age: 34,
    gender: 'Female',
    dob: '1989-10-15',
    primaryBranch: 'Marikina',
    email: 'eleanor.vance@example.com',
    phone: '+63 917 555 0123',
    profileImage: null, 
    address: '142 Birch St., Marikina Heights, Marikina City',
    occupation: 'Architect',
    emergencyContact: { name: 'Luke Crain', relation: 'Husband', phone: '+63 918 444 9876' }
};

const INITIAL_MEDICAL_HISTORY = {
    lastExam: '2023-10-12',
    bloodType: 'O+',
    allergies: 'Penicillin, Latex', 
    conditions: 'Asthma, Mild Hypertension',
    medications: 'Albuterol Inhaler (PRN)',
    notes: 'Patient experiences slight anxiety during extractions. Proceed with gentle care.'
};

const INITIAL_LOGS = [
    { id: 1, rawDate: new Date('2024-01-15'), branch: 'Marikina', doctor: 'Dr. Sarah Smith', tooth: '45', procedure: 'Composite Filling', category: 'Restoration', notes: 'Removed decay and placed composite filling on occlusal surface. Good patient cooperation. No complications observed.' },
    { id: 2, rawDate: new Date('2023-10-12'), branch: 'Marikina', doctor: 'Dr. Michael Cruz', tooth: 'All', procedure: 'Prophylaxis & Exam', category: 'Prophylaxis', notes: 'Routine cleaning. Plaque buildup on lower anteriors. Recommended better flossing routine and scheduled 6-month recall.' },
    { id: 3, rawDate: new Date('2022-03-05'), branch: 'Rizal', doctor: 'Dr. Emily Chen', tooth: '26', procedure: 'Porcelain Crown', category: 'Restoration', notes: 'Cemented permanent porcelain crown using glass ionomer cement. Margins sealed perfectly. Bite adjusted and polished.' },
    { id: 4, rawDate: new Date('2021-12-10'), branch: 'Marikina', doctor: 'Dr. Sarah Smith', tooth: '18, 28, 38, 48', procedure: 'Wisdom Tooth Extraction', category: 'Extraction', notes: 'Surgical extraction of all 4 third molars under local anesthesia. Hemostasis achieved. Prescribed Amoxicillin and Mefenamic Acid.' },
];

const MOCK_RADIOGRAPHS = [
    { id: 1, rawDate: new Date('2023-10-12'), type: 'Panoramic X-Ray', url: 'https://placehold.co/800x400/e2e8f0/475569?text=Panoramic+X-Ray' },
    { id: 2, rawDate: new Date('2021-12-10'), type: 'Periapical - Tooth 48', url: 'https://placehold.co/400x500/e2e8f0/475569?text=Periapical+48' },
    { id: 3, rawDate: new Date('2021-12-10'), type: 'Periapical - Tooth 38', url: 'https://placehold.co/400x500/e2e8f0/475569?text=Periapical+38' },
    { id: 4, rawDate: new Date('2020-05-02'), type: 'Bitewing - Right', url: 'https://placehold.co/500x400/e2e8f0/475569?text=Bitewing+Right' },
];

export default function PatientEMR({ patientId: propPatientId, onClose }) {
    const urlParams = useParams();
    const activePatientId = propPatientId || urlParams.patientId;
    
    const navigate = useNavigate();
    const { addToast } = useToast();
    
    // Core States
    const [activeTab, setActiveTab] = useState('overview');
    const [patient, setPatient] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Tab 1: Medical History States
    const [medicalHistory, setMedicalHistory] = useState(INITIAL_MEDICAL_HISTORY);
    const [isEditingMedical, setIsEditingMedical] = useState(false);
    const [medicalForm, setMedicalForm] = useState(INITIAL_MEDICAL_HISTORY);
    const [isSavingMedical, setIsSavingMedical] = useState(false);

    // Tab 2: Treatment Logs States
    const [logs, setLogs] = useState(INITIAL_LOGS);
    const [logsSearchQuery, setLogsSearchQuery] = useState('');
    const [logsDateFrom, setLogsDateFrom] = useState('');
    const [logsDateTo, setLogsDateTo] = useState('');
    const [logsCategory, setLogsCategory] = useState('All');
    const [expandedLogs, setExpandedLogs] = useState({});
    
    // Add Log Modal
    const [isAddLogOpen, setIsAddLogOpen] = useState(false);
    const [newLogForm, setNewLogForm] = useState({ date: '', procedure: '', category: 'General', tooth: '', notes: '' });

    // Task 3.3: AI Radiograph States
    const [selectedRadiograph, setSelectedRadiograph] = useState(null);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [isEnhanced, setIsEnhanced] = useState(false);

    useEffect(() => {
        setTimeout(() => {
            setPatient(MOCK_PATIENT);
            setIsLoading(false);
        }, 500); 
    }, [activePatientId]);

    const handleBack = () => {
        if (onClose) onClose(); 
        else navigate(-1); 
    };

    // --- TAB 1 LOGIC (MEDICAL HISTORY) ---
    const handleMedicalFormChange = (e) => {
        const { name, value } = e.target;
        setMedicalForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveMedical = (e) => {
        e.preventDefault();
        setIsSavingMedical(true);
        setTimeout(() => {
            setMedicalHistory(medicalForm);
            setIsEditingMedical(false);
            setIsSavingMedical(false);
            addToast("Medical history updated successfully.", "success");
        }, 600);
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

    // --- TAB 2 LOGIC (TREATMENT LOGS) ---
    const toggleLogExpand = (id, e) => {
        if (e) e.stopPropagation();
        setExpandedLogs(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const handleAddLogSubmit = (e) => {
        e.preventDefault();
        const newLog = {
            id: Math.random().toString(),
            rawDate: new Date(newLogForm.date),
            branch: patient.primaryBranch,
            doctor: 'Dr. Logged In', 
            tooth: newLogForm.tooth || 'N/A',
            procedure: newLogForm.procedure,
            category: newLogForm.category,
            notes: newLogForm.notes
        };
        
        setLogs(prev => [newLog, ...prev].sort((a,b) => b.rawDate - a.rawDate));
        setIsAddLogOpen(false);
        setNewLogForm({ date: '', procedure: '', category: 'General', tooth: '', notes: '' });
        addToast("Treatment log added successfully.", "success");
    };

    const filteredLogs = logs.filter(log => {
        const searchLower = logsSearchQuery.toLowerCase();
        const matchesSearch = log.procedure.toLowerCase().includes(searchLower) || log.notes.toLowerCase().includes(searchLower);
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
                            <div className={styles.modalButtonGroup}>
                                <button type="button" className={styles.cancelBtn} onClick={() => setIsAddLogOpen(false)}>Cancel</button>
                                <button type="submit" className={styles.saveBtn}>Save Log</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );

    // --- TAB 4 LOGIC (RADIOGRAPHS & AI ENHANCE) ---
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
        if (isEnhanced) {
            setIsEnhanced(false);
            return;
        }
        setIsEnhancing(true);
        setTimeout(() => {
            setIsEnhancing(false);
            setIsEnhanced(true);
            addToast("AI Enhancement applied successfully.", "success");
        }, 1500); // 1.5 second simulated processing time
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
                    <button className={styles.uploadBtn} onClick={() => addToast('Upload functionality coming soon!', 'info')}>
                        <FaUpload /> Upload Radiograph
                    </button>
                </div>

                {MOCK_RADIOGRAPHS.length > 0 ? (
                    <div className={styles.radiographGrid}>
                        {MOCK_RADIOGRAPHS.map(img => (
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

    // --- TEMPORARY SHELL FOR TASK 4.1 ---
    const renderOdontogram = () => (
        <div className={styles.contentCard}>
            <div className={styles.sectionHeaderRow}>
                <h3 className={styles.sectionTitle} style={{ marginBottom: 0 }}>Interactive Dental Chart</h3>
            </div>
            {/* Pass the patientId so the chart fetches the right teeth */}
            <Odontogram patientId={patient?.id} /> 
        </div>
    );

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
                        <h2 className={styles.patientName}>{patient.name}</h2>
                        <span className={`${styles.branchBadge} ${patient.primaryBranch === 'Rizal' ? styles.rizal : ''}`}>{patient.primaryBranch} Branch</span>
                        <span className={styles.patientId}>ID: {patient.id}</span>
                    </div>
                    <div className={styles.metaRow}>
                        <span className={styles.metaItem}><FaUserMd className={styles.metaIcon} /> {patient.gender}, {patient.age} y/o (DOB: {formatDateShort(patient.dob)})</span>
                        <span className={styles.metaItem}><FaPhoneAlt className={styles.metaIcon} /> {patient.phone}</span>
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