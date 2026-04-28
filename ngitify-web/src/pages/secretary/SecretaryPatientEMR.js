import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from '../../styles/dentist/PatientEMR.module.css'; // reuse dentist EMR styles

import { useToast } from '../../context/ToastContext';
import { formatDateLong, formatDateShort } from '../../utils/dateUtils';
import { regions, provinces, cities } from '../../utils/addressData';
import UserAvatar from '../../components/common/UserAvatar';
import { authFetch } from '../../utils/api';

import {
    FaArrowLeft, FaMapMarkerAlt, FaEnvelope, FaPhoneAlt,
    FaNotesMedical, FaSearch, FaHospitalUser,
    FaTooth, FaChevronDown, FaChevronUp,
    FaCalendarAlt, FaIdCard,
    FaChild, FaVenusMars, FaBirthdayCake, FaLock,
    FaFileMedical, FaXRay
} from 'react-icons/fa';

import Odontogram from '../dentist/Odontogram';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatAddressDisplay = (addr, regionsData, provincesData, citiesData) => {
    if (!addr) return '—';
    const rName = regionsData.find(r => r.code === addr.region)?.name || addr.region || '';
    const pName = provincesData[addr.region]?.find(p => p.code === addr.province)?.name || addr.province || '';
    const cName = citiesData[addr.province]?.find(c => c.code === addr.city)?.name || addr.city || '';
    const parts = [addr.houseNumber, addr.street, addr.barangay, cName, pName, rName].filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
};

const toCSV = (val) => Array.isArray(val) ? val.join(', ') : (val || '');

// ─── Read-Only Notice Banner ───────────────────────────────────────────────────
function ReadOnlyBanner() {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: '#eff6ff', border: '1px solid #bfdbfe',
            borderRadius: '10px', padding: '12px 18px',
            marginBottom: '20px', color: '#1e40af',
            fontSize: '14px', fontWeight: '500',
        }}>
            <FaLock style={{ flexShrink: 0 }} />
            <span>
                You have <strong>read-only access</strong> to this patient's Electronic Medical Record.
                Clinical data cannot be modified from the Secretary Portal.
            </span>
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function SecretaryPatientEMR() {
    const { patientId } = useParams();
    const navigate = useNavigate();
    const { addToast } = useToast();

    const [activeTab, setActiveTab] = useState('overview');
    const [patient, setPatient] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Medical history (view-only)
    const [medicalHistory, setMedicalHistory] = useState({
        lastExam: '', bloodType: '', allergies: '',
        conditions: '', medications: '', notes: ''
    });

    // Treatment logs (view-only)
    const [logs, setLogs] = useState([]);
    const [logsSearch, setLogsSearch] = useState('');
    const [logsDateFrom, setLogsDateFrom] = useState('');
    const [logsDateTo, setLogsDateTo] = useState('');
    const [expandedLogs, setExpandedLogs] = useState({});

    // Radiographs (view-only, no download/delete)
    const [radiographs, setRadiographs] = useState([]);
    const [selectedRadiograph, setSelectedRadiograph] = useState(null);

    // ── Fetch patient data ────────────────────────────────────────────────────
    useEffect(() => {
        if (!patientId) return;

        const fetchAll = async () => {
            setIsLoading(true);
            try {
                const [patientRes, logsRes, radRes] = await Promise.all([
                    authFetch(`/patients/${patientId}`),
                    authFetch(`/patients/${patientId}/treatment-logs`),
                    authFetch(`/patients/${patientId}/radiographs`),
                ]);

                if (patientRes.ok) {
                    const data = await patientRes.json();
                    setPatient(data);
                    if (data.medicalHistory) {
                        setMedicalHistory({
                            allergies:   toCSV(data.medicalHistory.allergies),
                            conditions:  toCSV(data.medicalHistory.conditions),
                            medications: toCSV(data.medicalHistory.medications),
                            bloodType:   data.medicalHistory.bloodType || '',
                            notes:       data.medicalHistory.notes || '',
                            lastExam:    data.dentalHistory?.lastExamDate || data.medicalHistory.lastExam || '',
                        });
                    }
                } else {
                    addToast('Failed to load patient record.', 'error');
                }

                if (logsRes.ok) {
                    const logsData = await logsRes.json();
                    setLogs(
                        logsData
                            .map(log => ({ ...log, id: log._id || log.id, rawDate: new Date(log.date || log.rawDate) }))
                            .sort((a, b) => b.rawDate - a.rawDate)
                    );
                }

                if (radRes.ok) {
                    const radData = await radRes.json();
                    setRadiographs(
                        radData.map(r => ({
                            ...r,
                            id: r._id || r.id,
                            rawDate: new Date(r.date || r.uploadedAt || r.createdAt),
                            type: r.label || r.type || 'Radiograph',
                            url: r.url || r.imageUrl,
                        }))
                    );
                }

            } catch (e) {
                console.error('Error fetching patient EMR:', e);
                addToast('Could not connect to the server.', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        fetchAll();
    }, [patientId, addToast]);

    // ── Tab: Overview ─────────────────────────────────────────────────────────
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
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Full Current Address</span>
                    <p className={styles.infoValue}>
                        <FaMapMarkerAlt style={{ color: '#94a3b8', marginRight: '6px' }} />
                        {formatAddressDisplay(patient?.currentAddress, regions, provinces, cities)}
                    </p>
                </div>

                <h3 className={styles.sectionTitle} style={{ marginTop: '28px' }}>Permanent Address</h3>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Full Permanent Address</span>
                    <p className={styles.infoValue}>
                        <FaMapMarkerAlt style={{ color: '#94a3b8', marginRight: '6px' }} />
                        {formatAddressDisplay(patient?.permanentAddress, regions, provinces, cities)}
                    </p>
                </div>
            </div>
        );
    };

    // ── Tab: Medical History (view-only) ──────────────────────────────────────
    const renderMedicalHistory = () => {
        const field = (label, value) => (
            <div className={styles.infoBlock}>
                <span className={styles.infoLabel}>{label}</span>
                <p className={styles.infoValue}>{value || '—'}</p>
            </div>
        );

        return (
            <div className={styles.contentCard}>
                <h3 className={styles.sectionTitle}>
                    <FaNotesMedical style={{ marginRight: '8px', color: '#01538b' }} />
                    Medical &amp; Dental Background
                </h3>
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 14px', marginBottom: '20px', fontSize: '13px', color: '#92400e' }}>
                    <FaLock style={{ marginRight: '6px' }} />
                    This section is read-only. Only the attending dentist can modify clinical records.
                </div>
                <div className={styles.infoGrid}>
                    {field('Blood Type', medicalHistory.bloodType)}
                    {field('Last Dental Examination', medicalHistory.lastExam ? formatDateShort(new Date(medicalHistory.lastExam)) : '—')}
                    {field('Known Allergies', medicalHistory.allergies)}
                    {field('Pre-existing Conditions', medicalHistory.conditions)}
                    {field('Current Medications', medicalHistory.medications)}
                </div>
                {medicalHistory.notes && (
                    <div className={styles.infoBlock} style={{ marginTop: '16px' }}>
                        <span className={styles.infoLabel}>Clinical Notes</span>
                        <p className={styles.infoValue} style={{ whiteSpace: 'pre-wrap' }}>{medicalHistory.notes}</p>
                    </div>
                )}
                {!medicalHistory.allergies && !medicalHistory.conditions && !medicalHistory.medications && (
                    <p style={{ color: '#94a3b8', fontSize: '14px', marginTop: '12px' }}>No medical history on record.</p>
                )}
            </div>
        );
    };

    // ── Tab: Treatment Logs (view-only) ───────────────────────────────────────
    const filteredLogs = logs.filter(log => {
        const q = logsSearch.toLowerCase();
        const matchQ = !q ||
            (log.procedure || '').toLowerCase().includes(q) ||
            (log.notes || '').toLowerCase().includes(q);
        let matchDate = true;
        if (logsDateFrom) matchDate = matchDate && log.rawDate >= new Date(logsDateFrom);
        if (logsDateTo)   matchDate = matchDate && log.rawDate <= new Date(logsDateTo + 'T23:59:59');
        return matchQ && matchDate;
    });

    const toggleLog = (id) => setExpandedLogs(prev => ({ ...prev, [id]: !prev[id] }));

    const renderTreatmentLogs = () => (
        <div className={styles.contentCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 className={styles.sectionTitle} style={{ margin: 0 }}>
                    <FaHospitalUser style={{ marginRight: '8px', color: '#01538b' }} />
                    Treatment History
                </h3>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative' }}>
                        <FaSearch style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '13px' }} />
                        <input
                            type="text"
                            placeholder="Search logs..."
                            value={logsSearch}
                            onChange={e => setLogsSearch(e.target.value)}
                            style={{ paddingLeft: '30px', padding: '8px 12px 8px 30px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', outline: 'none' }}
                        />
                    </div>
                    <input type="date" value={logsDateFrom} onChange={e => setLogsDateFrom(e.target.value)}
                        style={{ padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none' }} />
                    <input type="date" value={logsDateTo} onChange={e => setLogsDateTo(e.target.value)}
                        style={{ padding: '8px 10px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none' }} />
                </div>
            </div>

            {filteredLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    <FaFileMedical style={{ fontSize: '32px', marginBottom: '10px', display: 'block', margin: '0 auto 10px' }} />
                    <p>No treatment records found.</p>
                </div>
            ) : (
                filteredLogs.map(log => (
                    <div key={log.id} style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px', marginBottom: '10px', overflow: 'hidden' }}>
                        <div
                            onClick={() => toggleLog(log.id)}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', background: '#f8fafc' }}
                        >
                            <div>
                                <p style={{ margin: 0, fontWeight: '700', color: '#1e293b', fontSize: '14px' }}>{log.procedure || 'Procedure'}</p>
                                <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>
                                    {formatDateShort(log.rawDate)}
                                    {log.tooth && ` · Tooth ${log.tooth}`}
                                    {log.dentistName && ` · Dr. ${log.dentistName}`}
                                </p>
                            </div>
                            {expandedLogs[log.id] ? <FaChevronUp style={{ color: '#94a3b8' }} /> : <FaChevronDown style={{ color: '#94a3b8' }} />}
                        </div>
                        {expandedLogs[log.id] && (
                            <div style={{ padding: '14px 16px', borderTop: '1px solid #e2e8f0' }}>
                                {log.notes && <p style={{ margin: 0, color: '#475569', fontSize: '14px', whiteSpace: 'pre-wrap' }}>{log.notes}</p>}
                                {!log.notes && <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>No notes recorded.</p>}
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
    );

    // ── Tab: Odontogram (read-only) ───────────────────────────────────────────
    const renderOdontogram = () => (
        <div className={styles.contentCard}>
            <h3 className={styles.sectionTitle}>
                <FaTooth style={{ marginRight: '8px', color: '#01538b' }} />
                Dental Chart (Odontogram)
            </h3>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#92400e' }}>
                <FaLock style={{ marginRight: '6px' }} />
                Odontogram is displayed in read-only mode. Tooth status changes can only be made by the attending dentist.
            </div>
            <Odontogram patientId={patientId} readOnly={true} />
        </div>
    );

    // ── Tab: Radiographs (view-only, no upload/delete) ────────────────────────
    const renderRadiographs = () => (
        <div className={styles.contentCard}>
            <h3 className={styles.sectionTitle}>
                <FaXRay style={{ marginRight: '8px', color: '#01538b' }} />
                Radiograph Images
            </h3>
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#92400e' }}>
                <FaLock style={{ marginRight: '6px' }} />
                Radiographs are viewable only. Upload, download, and delete actions are restricted to dental staff.
            </div>

            {radiographs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    <p>No radiograph images on file for this patient.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
                    {radiographs.map(rad => (
                        <div
                            key={rad.id}
                            style={{ border: '1.5px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.15s', background: '#fff' }}
                            onClick={() => setSelectedRadiograph(rad)}
                        >
                            <img
                                src={rad.url}
                                alt={rad.type}
                                style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block', background: '#0f172a' }}
                                onError={e => { e.target.style.background = '#1e293b'; e.target.alt = 'Image unavailable'; }}
                            />
                            <div style={{ padding: '10px 12px' }}>
                                <p style={{ margin: 0, fontWeight: '700', color: '#1e293b', fontSize: '13px' }}>{rad.type}</p>
                                <p style={{ margin: 0, fontSize: '11px', color: '#94a3b8' }}>{formatDateShort(rad.rawDate)}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Lightbox viewer */}
            {selectedRadiograph && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
                    onClick={() => setSelectedRadiograph(null)}
                >
                    <div onClick={e => e.stopPropagation()} style={{ background: '#0f172a', borderRadius: '12px', padding: '20px', maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto', textAlign: 'center' }}>
                        <p style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '12px', textAlign: 'center' }}>
                            View only — downloading is not permitted from the Secretary Portal.
                        </p>
                        <img src={selectedRadiograph.url} alt={selectedRadiograph.type} style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '8px' }} />
                        <p style={{ color: 'white', fontWeight: '700', marginTop: '12px' }}>{selectedRadiograph.type}</p>
                        <p style={{ color: '#94a3b8', fontSize: '13px', marginTop: '4px' }}>{formatDateShort(selectedRadiograph.rawDate)}</p>
                        <button onClick={() => setSelectedRadiograph(null)} style={{ marginTop: '12px', background: '#334155', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>Close</button>
                    </div>
                </div>
            )}
        </div>
    );

    // ── Render ────────────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#01538b' }}>
                Loading patient record…
            </div>
        );
    }

    if (!patient) {
        return (
            <div style={{ textAlign: 'center', padding: '60px', color: '#ef4444' }}>
                Patient record not found or access denied.
            </div>
        );
    }

    const patientFullName = patient?.name?.first
        ? `${patient.name.first}${patient.name.middle ? ' ' + patient.name.middle : ''} ${patient.name.last}`
        : (typeof patient?.name === 'string' ? patient.name : 'Unknown Patient');

    const TABS = [
        { key: 'overview',     label: 'Overview',          icon: <FaIdCard /> },
        { key: 'medical',      label: 'Medical History',   icon: <FaNotesMedical /> },
        { key: 'treatments',   label: 'Treatment Logs',    icon: <FaCalendarAlt /> },
        { key: 'odontogram',   label: 'Odontogram',        icon: <FaTooth /> },
        { key: 'radiographs',  label: 'Radiographs',       icon: <FaXRay /> },
    ];

    return (
        <div className={styles.emrPage}>
            {/* ── Back + Patient Header ── */}
            <div className={styles.emrHeader}>
                <button className={styles.backBtn} onClick={() => navigate(-1)}>
                    <FaArrowLeft /> Back
                </button>

                <div className={styles.patientHeaderCard}>
                    <UserAvatar user={{ name: patientFullName, profileImage: patient?.profileImage }} size={64} />
                    <div className={styles.patientHeaderInfo}>
                        <h1 className={styles.patientName}>{patientFullName}</h1>
                        <p className={styles.patientMeta}>
                            Patient EMR
                            <span style={{ margin: '0 8px', color: '#cbd5e1' }}>·</span>
                            <span style={{ color: '#f59e0b', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <FaLock style={{ fontSize: '11px' }} /> Read-Only Access
                            </span>
                        </p>
                    </div>
                </div>
            </div>

            <ReadOnlyBanner />

            {/* ── Tabs ── */}
            <div className={styles.tabsContainer}>
                {TABS.map(tab => (
                    <button
                        key={tab.key}
                        className={`${styles.tabBtn} ${activeTab === tab.key ? styles.activeTab : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Tab Content ── */}
            <div className={styles.tabContent}>
                {activeTab === 'overview'    && renderOverview()}
                {activeTab === 'medical'     && renderMedicalHistory()}
                {activeTab === 'treatments'  && renderTreatmentLogs()}
                {activeTab === 'odontogram'  && renderOdontogram()}
                {activeTab === 'radiographs' && renderRadiographs()}
            </div>
        </div>
    );
}