import React, { useState, useEffect } from 'react';
import styles from '../../styles/admin/PatientProfile.module.css';
import BackIcon from '../../assets/icons/Back.svg';
import { formatDateLong } from '../../utils/dateUtils';
import { 
    FaUserMd, FaPhoneAlt, FaEnvelope, FaMapMarkerAlt, 
    FaNotesMedical, FaSyringe, FaTooth, FaSearch, 
    FaChevronDown, FaChevronUp, FaHospitalUser,
    FaCalendarAlt, FaUpload, FaMagic, FaRobot, FaArrowLeft,
    FaVenusMars, FaBirthdayCake, FaIdCard, FaChild
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

const formatAddressFull = (addr) => {
    if (!addr) return '—';
    return [addr.houseNumber, addr.street, addr.barangay, addr.city, addr.province, addr.region]
        .filter(Boolean).join(', ') || '—';
};

export default function PatientProfile({ patientId, onClose, onEdit }) {
    const { addToast } = useToast();
    // Updated tab order: overview, medical (Medical History & Alerts), logs, odontogram, radiographs
    const [activeTab, setActiveTab] = useState('overview');

    const [patient, setPatient] = useState(null);
    const [treatmentLogs, setTreatmentLogs] = useState([]);
    const [radiographs, setRadiographs] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    const [chartData, setChartData] = useState({});
    const [selectedTooth, setSelectedTooth] = useState(null);
    const [tempToothStatus, setTempToothStatus] = useState('');
    const [isSavingTooth, setIsSavingTooth] = useState(false);

    const [logsSearchQuery, setLogsSearchQuery] = useState('');
    const [logsDateFrom, setLogsDateFrom] = useState('');
    const [logsDateTo, setLogsDateTo] = useState('');
    const [logsCategory, setLogsCategory] = useState('All');
    const [expandedLogs, setExpandedLogs] = useState({});

    const [selectedRadiograph, setSelectedRadiograph] = useState(null);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [isEnhanced, setIsEnhanced] = useState(false);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploadForm, setUploadForm] = useState({ label: '', date: '', notes: '' });
    const [uploadPreview, setUploadPreview] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

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

                if (logsRes.ok) setTreatmentLogs(await logsRes.json());
                if (odontogramRes.ok) setChartData((await odontogramRes.json()) || {});
                if (radiographsRes.ok) setRadiographs(await radiographsRes.json());

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

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) { addToast('Image must be under 3MB.', 'error'); return; }
        const reader = new FileReader();
        reader.onloadend = () => setUploadPreview(reader.result);
        reader.readAsDataURL(file);
    };

    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        if (!uploadForm.label || !uploadForm.date) { addToast('Label and date are required.', 'error'); return; }
        if (!uploadPreview) { addToast('Please select an image file.', 'error'); return; }
        setIsUploading(true);
        try {
            const res = await authFetch(`/patients/${patientId}/radiographs`, {
                method: 'POST',
                body: JSON.stringify({ label: uploadForm.label, date: uploadForm.date, url: uploadPreview, notes: uploadForm.notes }),
            });
            if (!res.ok) throw new Error((await res.json()).message || 'Upload failed.');
            const saved = await res.json();
            setRadiographs(prev => [{ ...saved, id: saved._id || saved.id, rawDate: new Date(saved.date || uploadForm.date), type: saved.label || uploadForm.label, url: saved.url || uploadPreview }, ...prev]);
            setIsUploadModalOpen(false);
            setUploadForm({ label: '', date: '', notes: '' });
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
        setTimeout(() => { setIsEnhancing(false); setIsEnhanced(true); }, 1500);
    };

    const closeImageModal = () => {
        setSelectedRadiograph(null);
        setIsEnhancing(false);
        setIsEnhanced(false);
    };

    // ─── Derived values ────────────────────────────────────────────────────────
    const fullName = patient
        ? `${patient.name?.first || ''}${patient.name?.middle ? ' ' + patient.name.middle : ''} ${patient.name?.last || ''}`.trim()
        : '';
    const age = calculateAge(patient?.birthdate);
    const primaryBranch = patient?.assignedBranches?.[0] || 'Main';

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

    // ─── OVERVIEW TAB: Complete Patient Info + Both Addresses ──────────────────
    const renderOverview = () => {
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
                <div className={styles.sectionHeaderRow}>
                    <h3 className={styles.sectionTitle} style={{ marginBottom: 0 }}>Personal Information</h3>
                    <button className={styles.editProfileBtn} onClick={onEdit}>Edit Profile</button>
                </div>

                <div className={styles.infoGrid}>
                    {infoItem('Full Name', fullName)}
                    {infoItem('Gender', patient.gender, <FaVenusMars />)}
                    {infoItem('Date of Birth',
                        patient.birthdate
                            ? `${formatDateLong(patient.birthdate)} (${age} years old)`
                            : '—',
                        <FaBirthdayCake />
                    )}
                    {infoItem('Email Address', patient.email, <FaEnvelope />)}
                    {infoItem('Contact Number', patient.contactNumber || '—', <FaPhoneAlt />)}
                    {infoItem('Patient ID', patient._id, <FaIdCard />)}
                    {infoItem('Occupation', patient.occupation)}
                    {infoItem('Civil Status', patient.civilStatus)}
                    {infoItem('Blood Type', patient.bloodType || patient.medicalHistory?.bloodType)}
                    {infoItem('Work Phone', patient.workPhone)}
                    {infoItem('Referred By', patient.referredBy)}
                </div>

                {patient.guardian && (
                    <>
                        <h3 className={styles.sectionTitle} style={{ marginTop: '28px' }}>Guardian Information</h3>
                        <div className={styles.infoGrid} style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            {infoItem('Guardian Name', patient.guardian.name, <FaChild />)}
                            {infoItem('Relationship', patient.guardian.relationship)}
                            {infoItem('Guardian Contact', patient.guardian.contactNumber, <FaPhoneAlt />)}
                            {infoItem('Guardian Occupation', patient.guardian.occupation)}
                        </div>
                    </>
                )}

                {(patient.emergencyContact?.name || patient.emergencyContact?.contactNumber) && (
                    <>
                        <h3 className={styles.sectionTitle} style={{ marginTop: '28px' }}>Emergency Contact</h3>
                        <div className={styles.infoGrid} style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            {infoItem('Contact Name', patient.emergencyContact?.name)}
                            {infoItem('Relationship', patient.emergencyContact?.relationship)}
                            {infoItem('Contact Number', patient.emergencyContact?.contactNumber, <FaPhoneAlt />)}
                        </div>
                    </>
                )}

                <h3 className={styles.sectionTitle} style={{ marginTop: '28px' }}>Current Address</h3>
                <div className={styles.infoGrid}>
                    {infoItem('House No.', patient.currentAddress?.houseNumber)}
                    {infoItem('Street', patient.currentAddress?.street)}
                    {infoItem('Barangay', patient.currentAddress?.barangay)}
                    {infoItem('City / Municipality', patient.currentAddress?.city)}
                    {infoItem('Province', patient.currentAddress?.province)}
                    {infoItem('Region', patient.currentAddress?.region)}
                </div>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Full Current Address</span>
                    <p className={styles.infoValue}>
                        <FaMapMarkerAlt style={{ color: '#94a3b8', marginRight: '6px' }} />
                        {formatAddressFull(patient.currentAddress)}
                    </p>
                </div>

                <h3 className={styles.sectionTitle} style={{ marginTop: '28px' }}>Permanent Address</h3>
                <div className={styles.infoGrid}>
                    {infoItem('House No.', patient.permanentAddress?.houseNumber)}
                    {infoItem('Street', patient.permanentAddress?.street)}
                    {infoItem('Barangay', patient.permanentAddress?.barangay)}
                    {infoItem('City / Municipality', patient.permanentAddress?.city)}
                    {infoItem('Province', patient.permanentAddress?.province)}
                    {infoItem('Region', patient.permanentAddress?.region)}
                </div>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Full Permanent Address</span>
                    <p className={styles.infoValue}>
                        <FaMapMarkerAlt style={{ color: '#94a3b8', marginRight: '6px' }} />
                        {formatAddressFull(patient.permanentAddress)}
                    </p>
                </div>

                {(patient.consentAcknowledgement?.acknowledged || patient.consentAcknowledgement?.signerName) && (
                    <>
                        <h3 className={styles.sectionTitle} style={{ marginTop: '28px' }}>Digital Consent</h3>
                        <div className={styles.infoGrid} style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            {infoItem('Consent Recorded', patient.consentAcknowledgement?.acknowledged === true ? 'Yes' : patient.consentAcknowledgement?.acknowledged === false ? 'No' : '—')}
                            {infoItem('Signer Name', patient.consentAcknowledgement?.signerName)}
                            {infoItem('Signer Role', patient.consentAcknowledgement?.signerRole)}
                            {infoItem('Date Signed', patient.consentAcknowledgement?.signedAt ? formatDateLong(patient.consentAcknowledgement.signedAt) : '—')}
                        </div>
                    </>
                )}
            </div>
        );
    };

    // ─── MEDICAL HISTORY & ALERTS TAB ─────────────────────────────────────────
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
                    <span className={styles.infoLabel}>Blood Type</span>
                    <p className={styles.infoValue}>{patient.bloodType || patient.medicalHistory?.bloodType || '—'}</p>
                </div>

                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Last Physical / Dental Exam</span>
                    <p className={styles.infoValue}>
                        {patient.dentalHistory?.lastExamDate ? formatDateLong(patient.dentalHistory.lastExamDate) : '—'}
                    </p>
                </div>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Blood Pressure</span>
                    <p className={styles.infoValue}>{patient.medicalHistory?.bloodPressure || '—'}</p>
                </div>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Bleeding Time</span>
                    <p className={styles.infoValue}>{patient.medicalHistory?.bleedingTime || '—'}</p>
                </div>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>In Good Health?</span>
                    <p className={styles.infoValue}>{patient.medicalHistory?.inGoodHealth === true ? 'Yes' : patient.medicalHistory?.inGoodHealth === false ? 'No' : '—'}</p>
                </div>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Uses Tobacco?</span>
                    <p className={styles.infoValue}>{patient.medicalHistory?.usesTobacco === true ? 'Yes' : patient.medicalHistory?.usesTobacco === false ? 'No' : '—'}</p>
                </div>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Uses Alcohol / Drugs?</span>
                    <p className={styles.infoValue}>{patient.medicalHistory?.usesAlcoholOrDrugs === true ? 'Yes' : patient.medicalHistory?.usesAlcoholOrDrugs === false ? 'No' : '—'}</p>
                </div>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Pregnant?</span>
                    <p className={styles.infoValue}>{patient.medicalHistory?.isPregnant === true ? 'Yes' : patient.medicalHistory?.isPregnant === false ? 'No' : 'â€”'}</p>
                </div>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Nursing?</span>
                    <p className={styles.infoValue}>{patient.medicalHistory?.isNursing === true ? 'Yes' : patient.medicalHistory?.isNursing === false ? 'No' : 'â€”'}</p>
                </div>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Taking Birth Control Pills?</span>
                    <p className={styles.infoValue}>{patient.medicalHistory?.takingBirthControl === true ? 'Yes' : patient.medicalHistory?.takingBirthControl === false ? 'No' : 'â€”'}</p>
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

    // ─── TREATMENT LOGS TAB ────────────────────────────────────────────────────
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
                        
                        <select className={styles.filterSelect} value={logsCategory} onChange={(e) => setLogsCategory(e.target.value)}>
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

    // ─── DENTAL CHART TAB ──────────────────────────────────────────────────────
    const renderOdontogram = () => {
        const renderToothRow = (teethArray) => (
            <div className={styles.toothQuad}>
                {teethArray.map(num => (
                    <div key={num} className={`${styles.tooth} ${styles[getToothStatus(num)]}`} title={`Tooth ${num} - ${getToothStatus(num).toUpperCase()}`}>
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

    // ─── RADIOGRAPHS TAB ───────────────────────────────────────────────────────
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
                                <h3 className={styles.sectionTitle} style={{ margin: 0, borderLeft: 'none', paddingLeft: 0 }}>{selectedRadiograph.label || selectedRadiograph.type}</h3>
                                <p className={styles.radioDate}><FaCalendarAlt style={{color: '#94a3b8'}}/> {selectedRadiograph.date ? formatDateLong(selectedRadiograph.date) : '—'}</p>
                            </div>
                        </div>
                        <div className={styles.largeRadiographWrapper}>
                            <img src={selectedRadiograph.url} alt={selectedRadiograph.label || selectedRadiograph.type} className={`${styles.largeRadiograph} ${isEnhanced ? styles.enhancedImage : ''}`} />
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
                    <button className={styles.uploadBtn} onClick={() => setIsUploadModalOpen(true)}>
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
                    <div className={styles.emptyState}>No radiographs or imaging records found for this patient.</div>
                )}
            </div>
        );
    };

    const renderUploadModal = () => (
        isUploadModalOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
                <div style={{ background: 'white', borderRadius: '16px', padding: '40px', width: '90%', maxWidth: '480px', boxShadow: '0 15px 40px rgba(0,0,0,0.2)', fontFamily: "'Lexend Deca', sans-serif" }}>
                    <h3 style={{ color: '#01538b', fontSize: '20px', fontWeight: '800', margin: '0 0 20px 0', borderLeft: '4px solid #2dccf6', paddingLeft: '12px' }}>Upload Radiograph</h3>
                    <form onSubmit={handleUploadSubmit}>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Label / Type <span style={{ color: 'red' }}>*</span></label>
                            <input type="text" placeholder="e.g. Panoramic, Periapical" value={uploadForm.label} onChange={(e) => setUploadForm(p => ({ ...p, label: e.target.value }))} required style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontFamily: "'Lexend Deca'", fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Date Taken <span style={{ color: 'red' }}>*</span></label>
                            <input type="date" value={uploadForm.date} onChange={(e) => setUploadForm(p => ({ ...p, date: e.target.value }))} required style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontFamily: "'Lexend Deca'", fontSize: '14px', boxSizing: 'border-box', outline: 'none' }} />
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Image File <span style={{ color: 'red' }}>*</span></label>
                            <input type="file" accept="image/*" onChange={handleFileSelect} style={{ fontSize: '13px', fontFamily: "'Lexend Deca'" }} />
                            {uploadPreview && <img src={uploadPreview} alt="Preview" style={{ marginTop: '10px', width: '100%', maxHeight: '140px', objectFit: 'contain', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f1f5f9' }} />}
                        </div>
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Notes (Optional)</label>
                            <textarea placeholder="Any clinical notes about this image..." value={uploadForm.notes} onChange={(e) => setUploadForm(p => ({ ...p, notes: e.target.value }))} rows={3} style={{ width: '100%', padding: '12px 16px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontFamily: "'Lexend Deca'", fontSize: '14px', boxSizing: 'border-box', outline: 'none', resize: 'vertical' }} />
                        </div>
                        <div className={styles.modalButtonGroup}>
                            <button type="button" className={styles.cancelBtn} onClick={() => { setIsUploadModalOpen(false); setUploadPreview(null); setUploadForm({ label: '', date: '', notes: '' }); }} disabled={isUploading}>Cancel</button>
                            <button type="submit" className={styles.submitBtn} disabled={isUploading}>{isUploading ? 'Uploading...' : 'Upload'}</button>
                        </div>
                    </form>
                </div>
            </div>
        )
    );

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

                {/* Updated tab structure */}
                <div className={styles.tabContainer}>
                    <button className={`${styles.tabBtn} ${activeTab === 'overview' ? styles.active : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
                    <button className={`${styles.tabBtn} ${activeTab === 'medical' ? styles.active : ''}`} onClick={() => setActiveTab('medical')}>Medical History & Alerts</button>
                    <button className={`${styles.tabBtn} ${activeTab === 'logs' ? styles.active : ''}`} onClick={() => setActiveTab('logs')}>Treatment Logs</button>
                    <button className={`${styles.tabBtn} ${activeTab === 'odontogram' ? styles.active : ''}`} onClick={() => setActiveTab('odontogram')}>Dental Chart</button>
                    <button className={`${styles.tabBtn} ${activeTab === 'radiographs' ? styles.active : ''}`} onClick={() => setActiveTab('radiographs')}>Radiographs</button>
                </div>

                <div className={styles.tabContentArea}>
                    {activeTab === 'overview'    && renderOverview()}
                    {activeTab === 'medical'     && renderMedicalHistory()}
                    {activeTab === 'logs'        && renderTreatmentLogs()}
                    {activeTab === 'odontogram'  && renderOdontogram()}
                    {activeTab === 'radiographs' && renderRadiographs()}
                </div>
            </div>

            {renderUploadModal()}

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
