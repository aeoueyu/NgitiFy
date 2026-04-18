// ngitify-web/src/pages/admin/PatientProfile.js

import React, { useState, useEffect } from 'react';
import styles from '../../styles/admin/PatientProfile.module.css';
import BackIcon from '../../assets/icons/Back.svg';
import { formatDateLong } from '../../utils/dateUtils';
import { 
    FaUserMd, FaPhoneAlt, FaEnvelope, FaMapMarkerAlt, 
    FaNotesMedical, FaSyringe, FaTooth, FaSearch, 
    FaChevronDown, FaChevronUp, FaHospitalUser,
    FaCalendarAlt, FaUpload, FaMagic, FaRobot, FaArrowLeft
} from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';

// FDI Tooth Numbering (Adults)
const UPPER_RIGHT = [18,17,16,15,14,13,12,11];
const UPPER_LEFT  = [21,22,23,24,25,26,27,28];
const LOWER_RIGHT = [48,47,46,45,44,43,42,41];
const LOWER_LEFT  = [31,32,33,34,35,36,37,38];

const calculateAge = (birthdate) => {
    if (!birthdate) return '—';
    const today = new Date();
    const birth = new Date(birthdate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
};

const formatAddress = (addr) => {
    if (!addr) return '—';
    return [addr.houseNumber, addr.street, addr.barangay, addr.city, addr.province]
        .filter(Boolean).join(', ');
};

export default function PatientProfile({ patientId, onClose, onEdit }) {
    const { addToast } = useToast();
    const [activeTab, setActiveTab] = useState('overview');

    // --- DATA STATES ---
    const [patient, setPatient] = useState(null);
    const [treatmentLogs, setTreatmentLogs] = useState([]);
    const [radiographs, setRadiographs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- ODONTOGRAM STATE ---
    const [chartData, setChartData] = useState({});
    const [selectedTooth, setSelectedTooth] = useState(null);
    const [tempToothStatus, setTempToothStatus] = useState('');
    const [isSavingTooth, setIsSavingTooth] = useState(false);

    // --- TREATMENT LOG FILTER STATES ---
    const [logsSearchQuery, setLogsSearchQuery] = useState('');
    const [logsDateFrom, setLogsDateFrom] = useState('');
    const [logsDateTo, setLogsDateTo] = useState('');
    const [logsCategory, setLogsCategory] = useState('All');
    const [expandedLogs, setExpandedLogs] = useState({});

    // --- RADIOGRAPH VIEWER STATES ---
    const [selectedRadiograph, setSelectedRadiograph] = useState(null);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [isEnhanced, setIsEnhanced] = useState(false);

    // --- FETCH ALL PATIENT DATA ON MOUNT ---
    useEffect(() => {
        if (!patientId) return;
        const fetchAll = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const [patientRes, logsRes, odontogramRes, radiographsRes] = await Promise.all([
                    authFetch(`/patients/${patientId}`),
                    authFetch(`/patients/${patientId}/treatment-logs`),
                    authFetch(`/patients/${patientId}/odontogram`),
                    authFetch(`/patients/${patientId}/radiographs`),
                ]);

                if (!patientRes.ok) throw new Error('Failed to load patient data.');
                const patientData = await patientRes.json();
                setPatient(patientData);

                if (logsRes.ok) {
                    const logsData = await logsRes.json();
                    setTreatmentLogs(logsData);
                }

                if (odontogramRes.ok) {
                    const odontogramData = await odontogramRes.json();
                    setChartData(odontogramData || {});
                }

                if (radiographsRes.ok) {
                    const radiographsData = await radiographsRes.json();
                    setRadiographs(radiographsData);
                }

            } catch (err) {
                setError(err.message || 'Could not load patient profile.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchAll();
    }, [patientId]);

    const getInitials = (name) => {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
    };

    // --- ODONTOGRAM LOGIC ---
    const getToothStatus = (toothNum) => chartData[toothNum] || 'healthy';

    const openToothModal = (num) => {
        setSelectedTooth(num);
        setTempToothStatus(getToothStatus(num));
    };

    const handleSaveToothStatus = async () => {
        if (!selectedTooth) return;
        const updatedChart = { ...chartData, [selectedTooth]: tempToothStatus };
        setChartData(updatedChart);
        setSelectedTooth(null);

        setIsSavingTooth(true);
        try {
            const res = await authFetch(`/patients/${patientId}/odontogram`, {
                method: 'PUT',
                body: JSON.stringify({ [selectedTooth]: tempToothStatus }),
            });
            if (!res.ok) addToast('Tooth status updated locally but failed to save to server.', 'error');
        } catch {
            addToast('Could not connect to server to save tooth status.', 'error');
        } finally {
            setIsSavingTooth(false);
        }
    };

    const toggleLogExpand = (id, e) => {
        if (e) e.stopPropagation();
        setExpandedLogs(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const openRadiograph = (img) => {
        setSelectedRadiograph(img);
        setIsEnhancing(false);
        setIsEnhanced(false);
    };

    const handleAIEnhance = () => {
        if (isEnhanced) { setIsEnhanced(false); return; }
        setIsEnhancing(true);
        setTimeout(() => { setIsEnhancing(false); setIsEnhanced(true); }, 1500);
    };

    const closeImageModal = () => {
        setSelectedRadiograph(null);
        setIsEnhancing(false);
        setIsEnhanced(false);
    };

    // --- DERIVED DISPLAY VALUES ---
    const fullName = patient
        ? `${patient.name?.first || ''} ${patient.name?.middle ? patient.name.middle + ' ' : ''}${patient.name?.last || ''}`.trim()
        : '';
    const age = calculateAge(patient?.birthdate);
    const address = formatAddress(patient?.currentAddress);
    const primaryBranch = patient?.assignedBranches?.[0] || 'Main';

    // --- LOADING / ERROR STATES ---
    if (isLoading) {
        return (
            <div className={styles.mainOverlay}>
                <div className={styles.overlayBackground} onClick={onClose}></div>
                <div className={styles.formCard} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
                    <p style={{ color: '#01538b', fontWeight: 600 }}>Loading patient profile...</p>
                </div>
            </div>
        );
    }

    if (error || !patient) {
        return (
            <div className={styles.mainOverlay}>
                <div className={styles.overlayBackground} onClick={onClose}></div>
                <div className={styles.formCard} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '16px' }}>
                    <p style={{ color: '#ef4444', fontWeight: 600 }}>{error || 'Patient not found.'}</p>
                    <button className={styles.cancelBtn} onClick={onClose}>Close</button>
                </div>
            </div>
        );
    }

    // --- RENDER HELPERS FOR TABS ---

    const renderOverview = () => (
        <div className={styles.contentCard}>
            <div className={styles.sectionHeaderRow}>
                <h3 className={styles.sectionTitle} style={{ marginBottom: 0 }}>Patient Overview</h3>
                <button className={styles.editProfileBtn} onClick={onEdit}>Edit Profile</button>
            </div>
            
            <div className={styles.infoGrid}>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Full Address</span>
                    <p className={styles.infoValue}><FaMapMarkerAlt style={{color: '#94a3b8', marginRight: '6px'}}/>{address}</p>
                </div>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Date of Birth</span>
                    <p className={styles.infoValue}>{patient.birthdate ? formatDateLong(patient.birthdate) : '—'}</p>
                </div>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Occupation</span>
                    <p className={styles.infoValue}>{patient.occupation || '—'}</p>
                </div>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Blood Type</span>
                    <p className={styles.infoValue}>{patient.bloodType || '—'}</p>
                </div>
            </div>

            <h3 className={styles.sectionTitle}>Emergency Contact</h3>
            <div className={styles.infoGrid} style={{ marginBottom: 0, backgroundColor: '#f8fafc', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Contact Name</span>
                    <p className={styles.infoValue}>{patient.emergencyContact?.name || '—'}</p>
                </div>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Relationship</span>
                    <p className={styles.infoValue}>{patient.emergencyContact?.relationship || '—'}</p>
                </div>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Phone Number</span>
                    <p className={styles.infoValue}>{patient.emergencyContact?.contactNumber || '—'}</p>
                </div>
            </div>
        </div>
    );

    const renderMedicalHistory = () => (
        <div className={styles.contentCard}>
            <h3 className={styles.sectionTitle}>Medical History & Alerts</h3>
            
            <div className={styles.infoGrid}>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel} style={{ color: '#ef4444' }}><FaSyringe style={{marginRight: '6px'}}/> Allergies (Red Flags)</span>
                    {patient.medicalHistory?.allergies?.length > 0 ? (
                        <div className={styles.tagList}>
                            {patient.medicalHistory.allergies.map(a => <span key={a} className={`${styles.tag} ${styles.warning}`}>{a}</span>)}
                        </div>
                    ) : <p className={styles.infoValue}>No known allergies.</p>}
                </div>

                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}><FaNotesMedical style={{marginRight: '6px'}}/> Pre-existing Conditions</span>
                    {patient.medicalHistory?.conditions?.length > 0 ? (
                        <div className={styles.tagList}>
                            {patient.medicalHistory.conditions.map(c => <span key={c} className={styles.tag}>{c}</span>)}
                        </div>
                    ) : <p className={styles.infoValue}>None reported.</p>}
                </div>
            </div>

            <div className={styles.infoGrid}>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Current Medications</span>
                    {patient.medicalHistory?.medications?.length > 0 ? (
                        <ul style={{ margin: '5px 0 0 15px', color: '#334155', fontWeight: '600', fontSize: '15px' }}>
                            {patient.medicalHistory.medications.map(m => <li key={m} style={{marginBottom: '5px'}}>{m}</li>)}
                        </ul>
                    ) : <p className={styles.infoValue}>None reported.</p>}
                </div>
                
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Last Physical / Dental Exam</span>
                    <p className={styles.infoValue}>
                        {patient.dentalHistory?.lastExamDate ? formatDateLong(patient.dentalHistory.lastExamDate) : '—'}
                    </p>
                </div>
            </div>

            <div className={styles.infoBlock} style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '30px' }}>
                <span className={styles.infoLabel}>Clinical Notes & Remarks</span>
                <p className={styles.infoValue} style={{ fontWeight: '500', color: '#475569', fontStyle: 'italic' }}>
                    {patient.medicalHistory?.notes ? `"${patient.medicalHistory.notes}"` : 'No clinical notes on record.'}
                </p>
            </div>
        </div>
    );

    const renderOdontogram = () => {
        const renderToothRow = (teethArray) => (
            <div className={styles.toothQuad}>
                {teethArray.map(num => (
                    <div 
                        key={num} 
                        className={`${styles.tooth} ${styles[getToothStatus(num)]}`} 
                        title={`Tooth ${num} - ${getToothStatus(num).toUpperCase()}`}
                    >
                        <span className={styles.toothNum}>{num}</span>
                        <div className={styles.toothBox} onClick={() => openToothModal(num)}></div>
                    </div>
                ))}
            </div>
        );

        return (
            <div className={styles.contentCard}>
                <h3 className={styles.sectionTitle}>Interactive Dental Chart</h3>
                
                <div className={styles.odontogramContainer}>
                    <div className={styles.jawArch}>
                        <h4 className={styles.archTitle}>Maxillary (Upper)</h4>
                        <div className={styles.teethRow}>
                            {renderToothRow(UPPER_RIGHT)}
                            <div className={styles.archDivider}></div>
                            {renderToothRow(UPPER_LEFT)}
                        </div>
                    </div>

                    <div className={styles.jawArch}>
                        <h4 className={styles.archTitle}>Mandibular (Lower)</h4>
                        <div className={styles.teethRow}>
                            {renderToothRow(LOWER_RIGHT)}
                            <div className={styles.archDivider}></div>
                            {renderToothRow(LOWER_LEFT)}
                        </div>
                    </div>

                    <div className={styles.chartLegend}>
                        <div className={styles.legendItem}><div className={styles.legendColor} style={{ backgroundColor: 'white', borderColor: '#cbd5e1' }}></div> Healthy</div>
                        <div className={styles.legendItem}><div className={styles.legendColor} style={{ backgroundColor: '#e0f2fe', borderColor: '#38bdf8' }}></div> Filled</div>
                        <div className={styles.legendItem}><div className={styles.legendColor} style={{ backgroundColor: '#fef2f2', borderColor: '#f87171' }}></div> Decayed</div>
                        <div className={styles.legendItem}><div className={styles.legendColor} style={{ backgroundColor: '#fef9c3', borderColor: '#facc15' }}></div> Crown</div>
                        <div className={styles.legendItem}><div className={styles.legendColor} style={{ backgroundColor: '#f1f5f9', borderColor: '#94a3b8' }}></div> Missing</div>
                    </div>
                </div>
            </div>
        );
    };

    const renderTreatmentLogs = () => {
        const filteredLogs = treatmentLogs.filter(log => {
            const searchLower = logsSearchQuery.toLowerCase();
            const matchesSearch = log.procedure?.toLowerCase().includes(searchLower) || log.notes?.toLowerCase().includes(searchLower);
            const matchesCategory = logsCategory === 'All' || log.category === logsCategory;
            
            let matchesDate = true;
            const logDateStr = log.date ? new Date(log.date).toISOString().split('T')[0] : '';
            if (logsDateFrom) matchesDate = matchesDate && logDateStr >= logsDateFrom;
            if (logsDateTo)   matchesDate = matchesDate && logDateStr <= logsDateTo;

            return matchesSearch && matchesCategory && matchesDate;
        });

        return (
            <div className={styles.contentCard}>
                <h3 className={styles.sectionTitle}>Treatment & Activity Timeline</h3>

                <div className={styles.controlsRow}>
                    <div className={styles.searchFilterGroup}>
                        <div className={styles.searchWrapper}>
                            <FaSearch className={styles.searchIcon} />
                            <input 
                                type="text" 
                                placeholder="Search procedures or notes..." 
                                className={styles.searchInput} 
                                value={logsSearchQuery} 
                                onChange={(e) => setLogsSearchQuery(e.target.value)} 
                            />
                        </div>
                        
                        <select 
                            className={styles.filterSelect} 
                            value={logsCategory}
                            onChange={(e) => setLogsCategory(e.target.value)}
                        >
                            <option value="All">All Procedures</option>
                            <option value="Prophylaxis">Prophylaxis</option>
                            <option value="Restoration">Restoration</option>
                            <option value="Extraction">Extraction</option>
                            <option value="Orthodontics">Orthodontics</option>
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
                            const logId = log._id || log.id;
                            const isExpanded = !!expandedLogs[logId];
                            const displayDate = log.date ? formatDateLong(log.date) : '—';

                            return (
                                <div key={logId} className={styles.timelineItem}>
                                    <div className={styles.timelineDot}></div>
                                    
                                    <div className={styles.timelineCard}>
                                        <div className={styles.timelineHeader} onClick={(e) => toggleLogExpand(logId, e)}>
                                            <div className={styles.timelineMain}>
                                                <h4 className={styles.timelineDate}>{displayDate}</h4>
                                                <p className={styles.timelineProcedure}>{log.procedure}</p>
                                                
                                                <div className={styles.timelineMeta}>
                                                    <span className={styles.metaTag} title="Attending Dentist">
                                                        <FaUserMd className={styles.metaIcon} style={{color: '#94a3b8'}}/> {log.dentistName || '—'}
                                                    </span>
                                                    <span className={styles.metaTag} title="Branch">
                                                        <FaHospitalUser className={styles.metaIcon} style={{color: '#94a3b8'}}/> {log.branch || '—'}
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
                                                            <FaTooth style={{ color: '#01538b', marginRight: '6px' }}/> 
                                                            {log.tooth || '—'}
                                                        </p>
                                                    </div>
                                                    <div className={styles.detailBlock}>
                                                        <span className={styles.detailLabel}>Clinical Notes & Remarks</span>
                                                        <p className={styles.detailValue}>{log.notes || 'No notes recorded.'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className={styles.emptyState}>
                            {treatmentLogs.length === 0 ? 'No treatment records found for this patient.' : 'No treatment logs match the current filters.'}
                        </div>
                    )}
                </div>
            </div>
        );
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
                                    {selectedRadiograph.label || selectedRadiograph.type}
                                </h3>
                                <p className={styles.radioDate}><FaCalendarAlt style={{color: '#94a3b8'}}/> {selectedRadiograph.date ? formatDateLong(selectedRadiograph.date) : '—'}</p>
                            </div>
                        </div>

                        <div className={styles.largeRadiographWrapper}>
                            <img 
                                src={selectedRadiograph.url} 
                                alt={selectedRadiograph.label || selectedRadiograph.type} 
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
                    <button className={styles.uploadBtn} onClick={() => alert('Upload functionality coming soon!')}>
                        <FaUpload /> Upload Radiograph
                    </button>
                </div>

                {radiographs.length > 0 ? (
                    <div className={styles.radiographGrid}>
                        {radiographs.map(img => (
                            <div key={img._id} className={styles.radioCard} onClick={() => openRadiograph(img)}>
                                <div className={styles.radioThumbnailWrapper}>
                                    <img src={img.url} alt={img.label} className={styles.radioThumbnail} />
                                </div>
                                <div className={styles.radioMeta}>
                                    <h4 className={styles.radioType}>{img.label}</h4>
                                    <span className={styles.radioDate}><FaCalendarAlt style={{color: '#94a3b8'}}/> {img.date ? formatDateLong(img.date) : '—'}</span>
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

    return (
        <div className={styles.mainOverlay}>
            <div className={styles.overlayBackground} onClick={onClose}></div>
            
            <div className={styles.formCard}>
                <div className={styles.headerWrapper}>
                    <button className={styles.backIconButton} onClick={onClose} type="button">
                        <img src={BackIcon} alt="Back" />
                    </button>
                    <div className={styles.header}>
                        <h2 className={styles.title}>Patient <span style={{color: '#2dccf6'}}>Profile</span></h2>
                        <p className={styles.subtitle}>Comprehensive Electronic Medical Record (EMR)</p>
                    </div>
                </div>

                <div className={styles.profileHeaderCard}>
                    <div className={styles.avatar}>{getInitials(fullName)}</div>
                    <div className={styles.patientMainInfo}>
                        <div className={styles.nameRow}>
                            <h2 className={styles.patientName}>{fullName}</h2>
                            <span className={`${styles.branchBadge} ${primaryBranch === 'Rizal' ? styles.rizal : ''}`}>
                                {primaryBranch} Branch
                            </span>
                            <span className={styles.patientId}>ID: {patient._id}</span>
                        </div>
                        
                        <div className={styles.metaRow}>
                            <span className={styles.metaItem}><FaUserMd className={styles.metaIcon} /> {patient.gender || '—'}, {age} y/o</span>
                            <span className={styles.metaItem}><FaPhoneAlt className={styles.metaIcon} /> {patient.contactNumber || '—'}</span>
                            <span className={styles.metaItem}><FaEnvelope className={styles.metaIcon} /> {patient.email}</span>
                        </div>
                    </div>
                </div>

                <div className={styles.tabContainer}>
                    <button className={`${styles.tabBtn} ${activeTab === 'overview' ? styles.active : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
                    <button className={`${styles.tabBtn} ${activeTab === 'medical' ? styles.active : ''}`} onClick={() => setActiveTab('medical')}>Medical History</button>
                    <button className={`${styles.tabBtn} ${activeTab === 'odontogram' ? styles.active : ''}`} onClick={() => setActiveTab('odontogram')}>Dental Chart</button>
                    <button className={`${styles.tabBtn} ${activeTab === 'logs' ? styles.active : ''}`} onClick={() => setActiveTab('logs')}>Treatment Logs</button>
                    <button className={`${styles.tabBtn} ${activeTab === 'radiographs' ? styles.active : ''}`} onClick={() => setActiveTab('radiographs')}>Radiographs</button>
                </div>

                <div className={styles.tabContentArea}>
                    {activeTab === 'overview'    && renderOverview()}
                    {activeTab === 'medical'     && renderMedicalHistory()}
                    {activeTab === 'odontogram'  && renderOdontogram()}
                    {activeTab === 'logs'        && renderTreatmentLogs()}
                    {activeTab === 'radiographs' && renderRadiographs()}
                </div>
            </div>

            {/* INTERACTIVE TOOTH ACTION MODAL */}
            {selectedTooth && (
                <div className={styles.mainOverlay} style={{ zIndex: 1005 }}>
                    <div className={styles.overlayBackground} onClick={() => setSelectedTooth(null)}></div>
                    <div className={styles.miniModalCard}>
                        <h3 className={styles.title} style={{fontSize: '22px'}}>Update Tooth #{selectedTooth}</h3>
                        <p className={styles.subtitle} style={{marginBottom: '20px'}}>Select the current status for this tooth.</p>

                        <div className={styles.statusOptionsGrid}>
                            <button className={`${styles.statusBtn} ${tempToothStatus === 'healthy'  ? styles.activeHealthy  : ''}`} onClick={() => setTempToothStatus('healthy')}>Healthy</button>
                            <button className={`${styles.statusBtn} ${tempToothStatus === 'filled'   ? styles.activeFilled   : ''}`} onClick={() => setTempToothStatus('filled')}>Filled</button>
                            <button className={`${styles.statusBtn} ${tempToothStatus === 'decayed'  ? styles.activeDecayed  : ''}`} onClick={() => setTempToothStatus('decayed')}>Decayed</button>
                            <button className={`${styles.statusBtn} ${tempToothStatus === 'crown'    ? styles.activeCrown    : ''}`} onClick={() => setTempToothStatus('crown')}>Crown</button>
                            <button className={`${styles.statusBtn} ${tempToothStatus === 'missing'  ? styles.activeMissing  : ''}`} style={{ gridColumn: 'span 2' }} onClick={() => setTempToothStatus('missing')}>Missing / Extracted</button>
                        </div>

                        <div className={styles.modalButtonGroup}>
                            <button className={styles.cancelBtn} style={{flex: 1}} onClick={() => setSelectedTooth(null)} disabled={isSavingTooth}>Cancel</button>
                            <button className={styles.submitBtn} style={{flex: 1}} onClick={handleSaveToothStatus} disabled={isSavingTooth}>
                                {isSavingTooth ? 'Saving...' : 'Save Update'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}