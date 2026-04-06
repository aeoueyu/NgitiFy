import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from '../../styles/owner/PatientProfile.module.css';
import BackIcon from '../../assets/icons/Back.svg';
import { formatDateLong } from '../../utils/dateUtils'; // NEW: Imported Date Utilities
import { 
    FaUserMd, FaPhoneAlt, FaEnvelope, FaMapMarkerAlt, 
    FaNotesMedical, FaSyringe, FaTooth, FaSearch, 
    FaChevronDown, FaChevronUp, FaHospitalUser,
    FaCalendarAlt, FaUpload, FaMagic, FaRobot, FaArrowLeft
} from 'react-icons/fa';

// --- MOCK PATIENT DATA ---
const MOCK_PATIENT = {
    id: 'PT-2023-0842',
    name: 'Eleanor Vance',
    age: 34,
    gender: 'Female',
    dob: '1989-10-15',
    primaryBranch: 'Marikina',
    email: 'eleanor.vance@example.com',
    phone: '+63 917 555 0123',
    address: '142 Birch St., Marikina Heights, Marikina City',
    occupation: 'Architect',
    emergencyContact: {
        name: 'Luke Crain',
        relation: 'Husband',
        phone: '+63 918 444 9876'
    }
};

const MOCK_MEDICAL_HISTORY = {
    lastExam: 'October 12, 2023',
    bloodType: 'O+',
    allergies: ['Penicillin', 'Latex'],
    conditions: ['Asthma', 'Mild Hypertension'],
    medications: ['Albuterol Inhaler (PRN)'],
    notes: 'Patient experiences slight anxiety during extractions. Proceed with gentle care.'
};

// FDI Tooth Numbering (Adults)
const UPPER_RIGHT = [18,17,16,15,14,13,12,11];
const UPPER_LEFT = [21,22,23,24,25,26,27,28];
const LOWER_RIGHT = [48,47,46,45,44,43,42,41];
const LOWER_LEFT = [31,32,33,34,35,36,37,38];

// --- INITIAL INTERACTIVE ODONTOGRAM DATA ---
const INITIAL_MOCK_CHART_DATA = {
    18: 'missing', 28: 'missing', 38: 'missing', 48: 'missing',
    16: 'filled', 26: 'crown', 
    45: 'decayed', 36: 'filled'
};

const MOCK_TREATMENT_LOGS = [
    { id: 1, dateStr: '2024-01-15', displayDate: 'Jan 15, 2024', branch: 'Marikina', doctor: 'Dr. Sarah Smith', tooth: '45', procedure: 'Composite Filling', category: 'Restoration', notes: 'Removed decay and placed composite filling on occlusal surface. Good patient cooperation. No complications observed.' },
    { id: 2, dateStr: '2023-10-12', displayDate: 'Oct 12, 2023', branch: 'Marikina', doctor: 'Dr. Michael Cruz', tooth: 'All', procedure: 'Prophylaxis & Exam', category: 'Prophylaxis', notes: 'Routine cleaning. Plaque buildup on lower anteriors. Recommended better flossing routine and scheduled 6-month recall.' },
    { id: 3, dateStr: '2022-03-05', displayDate: 'Mar 05, 2022', branch: 'Rizal', doctor: 'Dr. Emily Chen', tooth: '26', procedure: 'Porcelain Crown', category: 'Restoration', notes: 'Cemented permanent porcelain crown using glass ionomer cement. Margins sealed perfectly. Bite adjusted and polished.' },
    { id: 4, dateStr: '2021-12-10', displayDate: 'Dec 10, 2021', branch: 'Marikina', doctor: 'Dr. Sarah Smith', tooth: '18, 28, 38, 48', procedure: 'Wisdom Tooth Extraction', category: 'Extraction', notes: 'Surgical extraction of all 4 third molars under local anesthesia. Hemostasis achieved. Prescribed Amoxicillin and Mefenamic Acid.' },
];

const MOCK_RADIOGRAPHS = [
    { id: 1, date: 'Oct 12, 2023', type: 'Panoramic X-Ray', url: 'https://placehold.co/800x400/e2e8f0/475569?text=Panoramic+X-Ray' },
    { id: 2, date: 'Dec 10, 2021', type: 'Periapical - Tooth 48', url: 'https://placehold.co/400x500/e2e8f0/475569?text=Periapical+48' },
    { id: 3, date: 'Dec 10, 2021', type: 'Periapical - Tooth 38', url: 'https://placehold.co/400x500/e2e8f0/475569?text=Periapical+38' },
    { id: 4, date: 'May 02, 2020', type: 'Bitewing - Right', url: 'https://placehold.co/500x400/e2e8f0/475569?text=Bitewing+Right' },
];

export default function PatientProfile({ patientId, onClose, onEdit }) {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');

    // --- INTERACTIVE ODONTOGRAM STATES ---
    const [chartData, setChartData] = useState(INITIAL_MOCK_CHART_DATA);
    const [selectedTooth, setSelectedTooth] = useState(null);
    const [tempToothStatus, setTempToothStatus] = useState('');

    // Treatment Logs States
    const [logsSearchQuery, setLogsSearchQuery] = useState('');
    const [logsDateFrom, setLogsDateFrom] = useState('');
    const [logsDateTo, setLogsDateTo] = useState('');
    const [logsCategory, setLogsCategory] = useState('All');
    const [expandedLogs, setExpandedLogs] = useState({});

    // AI Radiograph Enhancer States
    const [selectedRadiograph, setSelectedRadiograph] = useState(null);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [isEnhanced, setIsEnhanced] = useState(false);

    const getInitials = (name) => {
        const parts = name.trim().split(/\s+/);
        return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
    };

    // --- ODONTOGRAM LOGIC ---
    const getToothStatus = (toothNum) => chartData[toothNum] || 'healthy';

    const openToothModal = (num) => {
        setSelectedTooth(num);
        setTempToothStatus(getToothStatus(num));
    };

    const handleSaveToothStatus = () => {
        if (selectedTooth) {
            setChartData(prev => ({ ...prev, [selectedTooth]: tempToothStatus }));
        }
        setSelectedTooth(null);
    };

    const toggleLogExpand = (id, e) => {
        if (e) e.stopPropagation();
        setExpandedLogs(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // AI Enhancer Logic
    const openRadiograph = (img) => {
        setSelectedRadiograph(img);
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
        }, 1500);
    };

    const closeImageModal = () => {
        setSelectedRadiograph(null);
        setIsEnhancing(false);
        setIsEnhanced(false);
    };

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
                    <p className={styles.infoValue}><FaMapMarkerAlt style={{color: '#94a3b8', marginRight: '6px'}}/> {MOCK_PATIENT.address}</p>
                </div>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Date of Birth</span>
                    {/* TASK 1.2 UPDATE: Using centralized dateUtils */}
                    <p className={styles.infoValue}>{formatDateLong(MOCK_PATIENT.dob)}</p>
                </div>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Occupation</span>
                    <p className={styles.infoValue}>{MOCK_PATIENT.occupation}</p>
                </div>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Blood Type</span>
                    <p className={styles.infoValue}>{MOCK_MEDICAL_HISTORY.bloodType}</p>
                </div>
            </div>

            <h3 className={styles.sectionTitle}>Emergency Contact</h3>
            <div className={styles.infoGrid} style={{ marginBottom: 0, backgroundColor: '#f8fafc', padding: '25px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Contact Name</span>
                    <p className={styles.infoValue}>{MOCK_PATIENT.emergencyContact.name}</p>
                </div>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Relationship</span>
                    <p className={styles.infoValue}>{MOCK_PATIENT.emergencyContact.relation}</p>
                </div>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Phone Number</span>
                    <p className={styles.infoValue}>{MOCK_PATIENT.emergencyContact.phone}</p>
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
                    {MOCK_MEDICAL_HISTORY.allergies.length > 0 ? (
                        <div className={styles.tagList}>
                            {MOCK_MEDICAL_HISTORY.allergies.map(a => <span key={a} className={`${styles.tag} ${styles.warning}`}>{a}</span>)}
                        </div>
                    ) : <p className={styles.infoValue}>No known allergies.</p>}
                </div>

                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}><FaNotesMedical style={{marginRight: '6px'}}/> Pre-existing Conditions</span>
                    {MOCK_MEDICAL_HISTORY.conditions.length > 0 ? (
                        <div className={styles.tagList}>
                            {MOCK_MEDICAL_HISTORY.conditions.map(c => <span key={c} className={styles.tag}>{c}</span>)}
                        </div>
                    ) : <p className={styles.infoValue}>None reported.</p>}
                </div>
            </div>

            <div className={styles.infoGrid}>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Current Medications</span>
                    {MOCK_MEDICAL_HISTORY.medications.length > 0 ? (
                        <ul style={{ margin: '5px 0 0 15px', color: '#334155', fontWeight: '600', fontSize: '15px' }}>
                            {MOCK_MEDICAL_HISTORY.medications.map(m => <li key={m} style={{marginBottom: '5px'}}>{m}</li>)}
                        </ul>
                    ) : <p className={styles.infoValue}>None reported.</p>}
                </div>
                
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Last Physical / Dental Exam</span>
                    <p className={styles.infoValue}>{MOCK_MEDICAL_HISTORY.lastExam}</p>
                </div>
            </div>

            <div className={styles.infoBlock} style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '30px' }}>
                <span className={styles.infoLabel}>Clinical Notes & Remarks</span>
                <p className={styles.infoValue} style={{ fontWeight: '500', color: '#475569', fontStyle: 'italic' }}>
                    "{MOCK_MEDICAL_HISTORY.notes}"
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
                        {/* Interactive Click Handler added to ToothBox */}
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
        const filteredLogs = MOCK_TREATMENT_LOGS.filter(log => {
            const searchLower = logsSearchQuery.toLowerCase();
            const matchesSearch = log.procedure.toLowerCase().includes(searchLower) || log.notes.toLowerCase().includes(searchLower);
            const matchesCategory = logsCategory === 'All' || log.category === logsCategory;
            
            let matchesDate = true;
            if (logsDateFrom) {
                matchesDate = matchesDate && new Date(log.dateStr) >= new Date(logsDateFrom);
            }
            if (logsDateTo) {
                matchesDate = matchesDate && new Date(log.dateStr) <= new Date(logsDateTo);
            }

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
                            <input 
                                type="date" 
                                className={styles.dateInput} 
                                value={logsDateFrom}
                                onChange={(e) => setLogsDateFrom(e.target.value)}
                                title="From Date"
                            />
                            <span className={styles.dateSeparator}>-</span>
                            <input 
                                type="date" 
                                className={styles.dateInput} 
                                value={logsDateTo}
                                onChange={(e) => setLogsDateTo(e.target.value)}
                                title="To Date"
                            />
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
                                                <h4 className={styles.timelineDate}>{log.displayDate}</h4>
                                                <p className={styles.timelineProcedure}>{log.procedure}</p>
                                                
                                                <div className={styles.timelineMeta}>
                                                    <span className={styles.metaTag} title="Attending Dentist">
                                                        <FaUserMd className={styles.metaIcon} style={{color: '#94a3b8'}}/> {log.doctor}
                                                    </span>
                                                    <span className={styles.metaTag} title="Branch">
                                                        <FaHospitalUser className={styles.metaIcon} style={{color: '#94a3b8'}}/> {log.branch} Branch
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
                                                            {log.tooth}
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
                        <div className={styles.emptyState}>
                            No treatment logs match the current filters.
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
                                    {selectedRadiograph.type}
                                </h3>
                                <p className={styles.radioDate}><FaCalendarAlt style={{color: '#94a3b8'}}/> {selectedRadiograph.date}</p>
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
                    <button className={styles.uploadBtn} onClick={() => alert('Upload functionality coming soon!')}>
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
                                    <span className={styles.radioDate}><FaCalendarAlt style={{color: '#94a3b8'}}/> {img.date}</span>
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
                    <div className={styles.avatar}>{getInitials(MOCK_PATIENT.name)}</div>
                    <div className={styles.patientMainInfo}>
                        <div className={styles.nameRow}>
                            <h2 className={styles.patientName}>{MOCK_PATIENT.name}</h2>
                            <span className={`${styles.branchBadge} ${MOCK_PATIENT.primaryBranch === 'Rizal' ? styles.rizal : ''}`}>
                                {MOCK_PATIENT.primaryBranch} Branch
                            </span>
                            <span className={styles.patientId}>ID: {MOCK_PATIENT.id}</span>
                        </div>
                        
                        <div className={styles.metaRow}>
                            <span className={styles.metaItem}><FaUserMd className={styles.metaIcon} /> {MOCK_PATIENT.gender}, {MOCK_PATIENT.age} y/o</span>
                            <span className={styles.metaItem}><FaPhoneAlt className={styles.metaIcon} /> {MOCK_PATIENT.phone}</span>
                            <span className={styles.metaItem}><FaEnvelope className={styles.metaIcon} /> {MOCK_PATIENT.email}</span>
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
                    {activeTab === 'overview' && renderOverview()}
                    {activeTab === 'medical' && renderMedicalHistory()}
                    {activeTab === 'odontogram' && renderOdontogram()}
                    {activeTab === 'logs' && renderTreatmentLogs()}
                    {activeTab === 'radiographs' && renderRadiographs()}
                </div>
            </div>

            {/* --- INTERACTIVE TOOTH ACTION MODAL --- */}
            {selectedTooth && (
                <div className={styles.mainOverlay} style={{ zIndex: 1005 }}>
                    <div className={styles.overlayBackground} onClick={() => setSelectedTooth(null)}></div>
                    <div className={styles.miniModalCard}>
                        <h3 className={styles.title} style={{fontSize: '22px'}}>Update Tooth #{selectedTooth}</h3>
                        <p className={styles.subtitle} style={{marginBottom: '20px'}}>Select the current status for this tooth.</p>

                        <div className={styles.statusOptionsGrid}>
                            <button 
                                className={`${styles.statusBtn} ${tempToothStatus === 'healthy' ? styles.activeHealthy : ''}`} 
                                onClick={() => setTempToothStatus('healthy')}
                            >
                                Healthy
                            </button>
                            <button 
                                className={`${styles.statusBtn} ${tempToothStatus === 'filled' ? styles.activeFilled : ''}`} 
                                onClick={() => setTempToothStatus('filled')}
                            >
                                Filled
                            </button>
                            <button 
                                className={`${styles.statusBtn} ${tempToothStatus === 'decayed' ? styles.activeDecayed : ''}`} 
                                onClick={() => setTempToothStatus('decayed')}
                            >
                                Decayed
                            </button>
                            <button 
                                className={`${styles.statusBtn} ${tempToothStatus === 'crown' ? styles.activeCrown : ''}`} 
                                onClick={() => setTempToothStatus('crown')}
                            >
                                Crown
                            </button>
                            <button 
                                className={`${styles.statusBtn} ${tempToothStatus === 'missing' ? styles.activeMissing : ''}`} 
                                style={{ gridColumn: 'span 2' }} 
                                onClick={() => setTempToothStatus('missing')}
                            >
                                Missing / Extracted
                            </button>
                        </div>

                        <div className={styles.modalButtonGroup}>
                            <button className={styles.cancelBtn} style={{flex: 1}} onClick={() => setSelectedTooth(null)}>Cancel</button>
                            <button className={styles.submitBtn} style={{flex: 1}} onClick={handleSaveToothStatus}>Save Update</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}