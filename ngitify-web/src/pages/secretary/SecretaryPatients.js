import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from '../../styles/dentist/PatientEMR.module.css';

import { useToast } from '../../context/ToastContext';
import { formatDateLong, formatDateShort } from '../../utils/dateUtils';
import { regions, provinces, cities } from '../../utils/addressData';
import UserAvatar from '../../components/common/UserAvatar';
import { authFetch } from '../../utils/api';

import {
    FaArrowLeft, FaLock,
    FaUserMd, FaPhoneAlt, FaEnvelope, FaMapMarkerAlt,
    FaSyringe, FaNotesMedical,
    FaSearch, FaCalendarAlt,
    FaTooth, FaChevronDown, FaChevronUp,
    FaMagic, FaRobot,
    FaHospitalUser, FaIdCard,
    FaChild, FaVenusMars, FaBirthdayCake,
} from 'react-icons/fa';

// ── FDI tooth numbering ────────────────────────────────────────────────────────
const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const UPPER_LEFT  = [21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const LOWER_LEFT  = [31, 32, 33, 34, 35, 36, 37, 38];

// ── Helpers ────────────────────────────────────────────────────────────────────
const formatAddressDisplay = (addr) => {
    if (!addr) return '—';
    const rName = regions.find(r => r.code === addr.region)?.name || addr.region || '';
    const pName = provinces[addr.region]?.find(p => p.code === addr.province)?.name || addr.province || '';
    const cName = cities[addr.province]?.find(c => c.code === addr.city)?.name || addr.city || '';
    const parts = [addr.houseNumber, addr.street, addr.barangay, cName, pName, rName].filter(Boolean);
    return parts.length ? parts.join(', ') : '—';
};

const normalizeToothData = (raw) => {
    if (!raw) return { status: 'healthy', surfaces: [] };
    if (typeof raw === 'string') return { status: raw, surfaces: [] };
    return { status: raw.status || 'healthy', surfaces: Array.isArray(raw.surfaces) ? raw.surfaces : [] };
};

const toCSV = (val) => (Array.isArray(val) ? val.join(', ') : (val || ''));

// ── Main Component ─────────────────────────────────────────────────────────────
export default function SecretaryPatientEMR() {
    const { patientId } = useParams();
    const navigate      = useNavigate();
    const { addToast }  = useToast();

    // ── Core state ─────────────────────────────────────────────────────────────
    const [activeTab, setActiveTab]   = useState('overview');
    const [patient, setPatient]       = useState(null);
    const [isLoading, setIsLoading]   = useState(true);

    // ── Treatment logs state ───────────────────────────────────────────────────
    const [logs, setLogs]               = useState([]);
    const [logsSearch, setLogsSearch]   = useState('');
    const [logsDateFrom, setLogsDateFrom] = useState('');
    const [logsDateTo, setLogsDateTo]   = useState('');
    const [logsCategory, setLogsCategory] = useState('All');
    const [expandedLogs, setExpandedLogs] = useState({});

    // ── Odontogram state ───────────────────────────────────────────────────────
    const [chartData, setChartData] = useState({});

    // ── Radiograph state ───────────────────────────────────────────────────────
    const [radiographs, setRadiographs]         = useState([]);
    const [selectedRadiograph, setSelectedRadiograph] = useState(null);
    const [isEnhancing, setIsEnhancing]         = useState(false);
    const [isEnhanced, setIsEnhanced]           = useState(false);

    // ── Fetch all EMR data on mount ────────────────────────────────────────────
    const fetchEMR = useCallback(async () => {
        if (!patientId) return;
        setIsLoading(true);
        try {
            const [patRes, logsRes, odoRes, radRes] = await Promise.all([
                authFetch(`/patients/${patientId}`),
                authFetch(`/patients/${patientId}/treatment-logs`),
                authFetch(`/patients/${patientId}/odontogram`),
                authFetch(`/patients/${patientId}/radiographs`),
            ]);

            if (patRes.ok) {
                setPatient(await patRes.json());
            } else {
                addToast('Failed to load patient record.', 'error');
                navigate('/secretary/patients');
                return;
            }

            if (logsRes.ok) {
                const raw = await logsRes.json();
                const normalized = raw.map(log => ({
                    ...log,
                    id:      log._id || log.id,
                    rawDate: new Date(log.date || log.rawDate || log.createdAt),
                }));
                setLogs(normalized.sort((a, b) => b.rawDate - a.rawDate));
            }

            if (odoRes.ok) {
                setChartData((await odoRes.json()) || {});
            }

            if (radRes.ok) {
                const raw = await radRes.json();
                setRadiographs(raw.map(r => ({
                    ...r,
                    id:      r._id || r.id,
                    rawDate: new Date(r.date || r.uploadedAt || r.createdAt),
                    type:    r.label || r.type || 'Radiograph',
                    url:     r.url || r.imageUrl,
                })));
            }
        } catch (err) {
            console.error('EMR fetch error:', err);
            addToast('Could not connect to the server.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [patientId, navigate, addToast]);

    useEffect(() => { fetchEMR(); }, [fetchEMR]);

    // ── Derived values ─────────────────────────────────────────────────────────
    const patientAge = patient?.birthdate
        ? Math.floor((new Date() - new Date(patient.birthdate)) / 31_557_600_000)
        : null;

    const medHist = patient?.medicalHistory || {};
    const medDisplay = {
        allergies:   toCSV(medHist.allergies),
        conditions:  toCSV(medHist.conditions),
        medications: toCSV(medHist.medications),
        bloodType:   medHist.bloodType || '',
        notes:       medHist.notes     || '',
        lastExam:    patient?.dentalHistory?.lastExamDate || medHist.lastExam || '',
    };

    // ── Shared helpers ─────────────────────────────────────────────────────────
    const infoItem = (label, value, icon = null) => (
        <div className={styles.infoBlock}>
            <span className={styles.infoLabel}>{label}</span>
            <p className={styles.infoValue}>
                {icon && <span style={{ marginRight: '6px', color: '#94a3b8' }}>{icon}</span>}
                {value || '—'}
            </p>
        </div>
    );

    const renderTagList = (csvString, isWarning = false) => {
        if (!csvString?.trim()) return <p className={styles.infoValue}>None reported.</p>;
        const items = csvString.split(',').map(i => i.trim()).filter(Boolean);
        return (
            <div className={styles.tagList}>
                {items.map((item, i) => (
                    <span key={i} className={`${styles.tag} ${isWarning ? styles.warning : ''}`}>
                        {item}
                    </span>
                ))}
            </div>
        );
    };

    const renderBulletList = (csvString) => {
        if (!csvString?.trim()) return <p className={styles.infoValue}>None reported.</p>;
        const items = csvString.split(',').map(i => i.trim()).filter(Boolean);
        return (
            <ul style={{ margin: '5px 0 0 15px', color: '#334155', fontWeight: '600', fontSize: '14px' }}>
                {items.map((item, i) => <li key={i} style={{ marginBottom: '5px' }}>{item}</li>)}
            </ul>
        );
    };

    // ── Read-only banner ───────────────────────────────────────────────────────
    const ReadOnlyBanner = () => (
        <div style={{
            display:        'flex',
            alignItems:     'center',
            gap:            '8px',
            background:     '#eff6ff',
            border:         '1px solid #bfdbfe',
            borderRadius:   '8px',
            padding:        '10px 16px',
            marginBottom:   '20px',
            fontSize:       '13px',
            color:          '#1e40af',
            fontWeight:     '600',
            fontFamily:     "'Lexend Deca', sans-serif",
        }}>
            <FaLock style={{ flexShrink: 0 }} />
            View Only — You can review this EMR but cannot make any changes.
            All write operations on clinical records are restricted to the Dentist role.
        </div>
    );

    // ── Tab: Overview ──────────────────────────────────────────────────────────
    const renderOverview = () => (
        <div className={styles.contentCard}>
            <ReadOnlyBanner />

            <h3 className={styles.sectionTitle}>Personal Information</h3>
            <div className={styles.infoGrid}>
                {infoItem('Full Name',
                    patient?.name?.first
                        ? `${patient.name.first}${patient.name.middle ? ' ' + patient.name.middle : ''} ${patient.name.last}`
                        : (typeof patient?.name === 'string' ? patient.name : '—')
                )}
                {infoItem('Gender',        patient?.gender,        <FaVenusMars />)}
                {infoItem('Date of Birth',
                    patient?.birthdate
                        ? `${formatDateLong(patient.birthdate)}${patientAge !== null ? ` (${patientAge} years old)` : ''}`
                        : '—',
                    <FaBirthdayCake />
                )}
                {infoItem('Email Address', patient?.email,         <FaEnvelope />)}
                {infoItem('Contact Number', patient?.contactNumber || '—', <FaPhoneAlt />)}
                {infoItem('Patient ID',    patient?._id || patient?.id, <FaIdCard />)}
            </div>

            {patient?.guardian && (
                <>
                    <h3 className={styles.sectionTitle} style={{ marginTop: '28px' }}>
                        Guardian Information
                    </h3>
                    <div className={styles.infoGrid}>
                        {infoItem('Guardian Name',    patient.guardian.name,          <FaChild />)}
                        {infoItem('Relationship',     patient.guardian.relationship)}
                        {infoItem('Guardian Contact', patient.guardian.contactNumber, <FaPhoneAlt />)}
                    </div>
                </>
            )}

            <h3 className={styles.sectionTitle} style={{ marginTop: '28px' }}>Current Address</h3>
            <div className={styles.infoGrid}>
                {infoItem('House No.',         patient?.currentAddress?.houseNumber)}
                {infoItem('Street',            patient?.currentAddress?.street)}
                {infoItem('Barangay',          patient?.currentAddress?.barangay)}
                {infoItem('City / Municipality',
                    cities[patient?.currentAddress?.province]
                        ?.find(c => c.code === patient?.currentAddress?.city)?.name
                        || patient?.currentAddress?.city
                )}
                {infoItem('Province',
                    provinces[patient?.currentAddress?.region]
                        ?.find(p => p.code === patient?.currentAddress?.province)?.name
                        || patient?.currentAddress?.province
                )}
                {infoItem('Region',
                    regions.find(r => r.code === patient?.currentAddress?.region)?.name
                        || patient?.currentAddress?.region
                )}
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
                {infoItem('House No.',         patient?.permanentAddress?.houseNumber)}
                {infoItem('Street',            patient?.permanentAddress?.street)}
                {infoItem('Barangay',          patient?.permanentAddress?.barangay)}
                {infoItem('City / Municipality',
                    cities[patient?.permanentAddress?.province]
                        ?.find(c => c.code === patient?.permanentAddress?.city)?.name
                        || patient?.permanentAddress?.city
                )}
                {infoItem('Province',
                    provinces[patient?.permanentAddress?.region]
                        ?.find(p => p.code === patient?.permanentAddress?.province)?.name
                        || patient?.permanentAddress?.province
                )}
                {infoItem('Region',
                    regions.find(r => r.code === patient?.permanentAddress?.region)?.name
                        || patient?.permanentAddress?.region
                )}
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

    // ── Tab: Medical History (read-only — no edit button) ──────────────────────
    const renderMedicalHistory = () => (
        <div className={styles.contentCard}>
            <ReadOnlyBanner />

            <div className={styles.sectionHeaderRow}>
                <h3 className={styles.sectionTitle}>Medical History & Alerts</h3>
                {/* No "Edit Medical History" button — secretary is read-only */}
            </div>

            <div className={styles.infoGrid}>
                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel} style={{ color: '#ef4444' }}>
                        <FaSyringe style={{ marginRight: '6px' }} /> Allergies (Red Flags)
                    </span>
                    {renderTagList(medDisplay.allergies, true)}
                </div>

                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>
                        <FaNotesMedical style={{ marginRight: '6px' }} /> Pre-existing Conditions
                    </span>
                    {renderTagList(medDisplay.conditions)}
                </div>

                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Current Medications</span>
                    {renderBulletList(medDisplay.medications)}
                </div>

                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Blood Type</span>
                    <p className={styles.infoValue}>{medDisplay.bloodType || 'Not specified'}</p>
                </div>

                <div className={styles.infoBlock}>
                    <span className={styles.infoLabel}>Last Medical / Dental Exam</span>
                    <p className={styles.infoValue}>
                        {medDisplay.lastExam ? formatDateLong(medDisplay.lastExam) : 'Not specified'}
                    </p>
                </div>
            </div>

            {medDisplay.notes && (
                <div className={styles.infoBlock} style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '25px' }}>
                    <span className={styles.infoLabel}>Clinical Notes & Remarks</span>
                    <p className={styles.infoValue} style={{ color: '#475569', fontStyle: 'italic' }}>
                        "{medDisplay.notes}"
                    </p>
                </div>
            )}
        </div>
    );

    // ── Tab: Treatment Logs (read-only — no "Add Log" button) ─────────────────
    const toggleLog = (id) =>
        setExpandedLogs(prev => ({ ...prev, [id]: !prev[id] }));

    const filteredLogs = logs.filter(log => {
        const q = logsSearch.toLowerCase();
        const matchSearch =
            (log.procedure || '').toLowerCase().includes(q) ||
            (log.notes     || '').toLowerCase().includes(q);
        const matchCat  = logsCategory === 'All' || log.category === logsCategory;
        let matchDate   = true;
        if (logsDateFrom) matchDate = matchDate && log.rawDate >= new Date(logsDateFrom);
        if (logsDateTo) {
            const end = new Date(logsDateTo);
            end.setHours(23, 59, 59, 999);
            matchDate = matchDate && log.rawDate <= end;
        }
        return matchSearch && matchCat && matchDate;
    });

    const renderTreatmentLogs = () => (
        <div className={styles.contentCard}>
            <ReadOnlyBanner />

            <div className={styles.sectionHeaderRow} style={{ marginBottom: '20px' }}>
                <h3 className={styles.sectionTitle}>Treatment & Activity Timeline</h3>
                {/* No "Add Log" button — secretary is read-only */}
            </div>

            {/* Filters */}
            <div className={styles.controlsRow}>
                <div className={styles.searchFilterGroup}>
                    <div className={styles.searchWrapper}>
                        <FaSearch className={styles.searchIcon} />
                        <input
                            type="text"
                            placeholder="Search procedures or notes…"
                            className={styles.searchInput}
                            value={logsSearch}
                            onChange={e => setLogsSearch(e.target.value)}
                        />
                    </div>

                    <select
                        className={styles.filterSelect}
                        value={logsCategory}
                        onChange={e => setLogsCategory(e.target.value)}
                    >
                        <option value="All">All Categories</option>
                        <option value="Prophylaxis">Prophylaxis</option>
                        <option value="Restoration">Restoration</option>
                        <option value="Extraction">Extraction</option>
                        <option value="Orthodontics">Orthodontics</option>
                        <option value="General">General</option>
                    </select>

                    <div className={styles.dateFilterWrapper}>
                        <input
                            type="date"
                            className={styles.dateInput}
                            value={logsDateFrom}
                            onChange={e => setLogsDateFrom(e.target.value)}
                            title="From Date"
                        />
                        <span className={styles.dateSeparator}>-</span>
                        <input
                            type="date"
                            className={styles.dateInput}
                            value={logsDateTo}
                            onChange={e => setLogsDateTo(e.target.value)}
                            title="To Date"
                        />
                    </div>
                </div>
            </div>

            {/* Timeline */}
            <div className={styles.timeline}>
                {filteredLogs.length > 0 ? (
                    filteredLogs.map(log => {
                        const isExpanded = !!expandedLogs[log.id];
                        return (
                            <div key={log.id} className={styles.timelineItem}>
                                <div className={styles.timelineDot} />
                                <div className={styles.timelineCard}>
                                    <div
                                        className={styles.timelineHeader}
                                        onClick={() => toggleLog(log.id)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div className={styles.timelineMain}>
                                            <h4 className={styles.timelineDate}>
                                                {formatDateLong(log.rawDate.toISOString())}
                                            </h4>
                                            <p className={styles.timelineProcedure}>
                                                {log.procedure}
                                            </p>
                                            <div className={styles.timelineMeta}>
                                                <span className={styles.metaTag}>
                                                    <FaUserMd className={styles.metaIcon} />
                                                    {log.doctor || log.dentist || log.dentistName || 'N/A'}
                                                </span>
                                                <span className={styles.metaTag}>
                                                    <FaHospitalUser className={styles.metaIcon} />
                                                    {log.branch || '—'}
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
                                                    <span className={styles.detailLabel}>
                                                        Treated Tooth #
                                                    </span>
                                                    <p className={styles.detailValue}>
                                                        <FaTooth style={{ color: '#01538b', marginRight: '6px' }} />
                                                        {log.tooth || '—'}
                                                    </p>
                                                </div>
                                                <div className={styles.detailBlock}>
                                                    <span className={styles.detailLabel}>
                                                        Clinical Notes & Remarks
                                                    </span>
                                                    <p className={styles.detailValue}>
                                                        {log.notes || 'No notes recorded.'}
                                                    </p>
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
                        {logs.length === 0
                            ? 'No treatment records found for this patient.'
                            : 'No treatment logs match the current filters.'}
                    </div>
                )}
            </div>
        </div>
    );

    // ── Tab: Dental Chart (read-only odontogram — clicking teeth does nothing) ─
    const renderOdontogram = () => {
        const getToothData = (num) => normalizeToothData(chartData[num]);

        const renderToothRow = (teethArray, isUpper) =>
            teethArray.map(num => {
                const { status, surfaces } = getToothData(num);
                return (
                    <div
                        key={num}
                        className={`${styles.toothContainer || ''} ${styles[status] || ''}`}
                        title={`Tooth ${num} — ${status}${surfaces.length ? ` (${surfaces.join(', ')})` : ''}`}
                        style={{ cursor: 'default' }}      /* no pointer — read-only */
                    >
                        {isUpper && <span className={styles.toothNum}>{num}</span>}
                        <div className={styles.toothGraphic || styles.toothBox}>
                            <FaTooth className={styles.toothIcon} />
                        </div>
                        {!isUpper && <span className={styles.toothNum}>{num}</span>}
                        {surfaces.length > 0 && (
                            <div className={styles.surfaceRow}>
                                {surfaces.map(s => (
                                    <span key={s} className={styles.surfaceDot}>{s}</span>
                                ))}
                            </div>
                        )}
                    </div>
                );
            });

        return (
            <div className={styles.contentCard}>
                <ReadOnlyBanner />

                <div className={styles.sectionHeaderRow}>
                    <h3 className={styles.sectionTitle} style={{ marginBottom: 0 }}>
                        Interactive Dental Chart
                    </h3>
                    {/* No edit interaction for secretary */}
                </div>

                <div className={styles.odontogramWrapper || styles.odontogramContainer}>
                    {/* Upper Jaw */}
                    <div className={styles.jawSection || styles.jawArch}>
                        <h4 className={styles.jawTitle || styles.archTitle}>
                            Maxillary Arch (Upper)
                        </h4>
                        <div className={styles.arch || styles.teethRow}>
                            <div className={styles.quadrant}>{renderToothRow(UPPER_RIGHT, true)}</div>
                            <div className={styles.divider || styles.archDivider} />
                            <div className={styles.quadrant}>{renderToothRow(UPPER_LEFT, true)}</div>
                        </div>
                    </div>

                    {/* Lower Jaw */}
                    <div className={styles.jawSection || styles.jawArch}>
                        <h4 className={styles.jawTitle || styles.archTitle}>
                            Mandibular Arch (Lower)
                        </h4>
                        <div className={styles.arch || styles.teethRow}>
                            <div className={styles.quadrant}>{renderToothRow(LOWER_RIGHT, false)}</div>
                            <div className={styles.divider || styles.archDivider} />
                            <div className={styles.quadrant}>{renderToothRow(LOWER_LEFT, false)}</div>
                        </div>
                    </div>

                    {/* Legend */}
                    <div className={styles.chartLegend}>
                        <div className={styles.legendItem}><div className={`${styles.legendColor} ${styles.healthy}`} /> Healthy</div>
                        <div className={styles.legendItem}><div className={`${styles.legendColor} ${styles.filled}`} /> Filled</div>
                        <div className={styles.legendItem}><div className={`${styles.legendColor} ${styles.decayed}`} /> Caries</div>
                        <div className={styles.legendItem}><div className={`${styles.legendColor} ${styles.crown}`} /> Crown</div>
                        <div className={styles.legendItem}><div className={`${styles.legendColor} ${styles.implant}`} /> Implant</div>
                        <div className={styles.legendItem}><div className={`${styles.legendColor} ${styles.bridge}`} /> Bridge</div>
                        <div className={styles.legendItem}><div className={`${styles.legendColor} ${styles['extraction-site']}`} /> Extraction Site</div>
                        <div className={styles.legendItem}><div className={`${styles.legendColor} ${styles.missing}`} /> Missing</div>
                    </div>
                </div>
            </div>
        );
    };

    // ── Tab: Radiographs (view + AI enhance only — no upload, no delete) ────────
    const handleAIEnhance = () => {
        if (isEnhanced) { setIsEnhanced(false); return; }
        setIsEnhancing(true);
        setTimeout(() => {
            setIsEnhancing(false);
            setIsEnhanced(true);
            addToast('AI Enhancement applied.', 'success');
        }, 1500);
    };

    const openRadiograph = (img) => {
        setSelectedRadiograph(img);
        setIsEnhancing(false);
        setIsEnhanced(false);
    };

    const closeRadiograph = () => {
        setSelectedRadiograph(null);
        setIsEnhancing(false);
        setIsEnhanced(false);
    };

    const renderRadiographs = () => {
        // ── Lightbox / detail view ──────────────────────────────────────────
        if (selectedRadiograph) {
            return (
                <div className={styles.contentCard}>
                    <ReadOnlyBanner />

                    <div className={styles.imageViewerContainer}>
                        <div className={styles.imageViewerHeader}>
                            <button className={styles.backToGalleryBtn} onClick={closeRadiograph}>
                                <FaArrowLeft /> Back to Gallery
                            </button>
                            <div className={styles.imageViewerTitleBox}>
                                <h3 className={styles.sectionTitle} style={{ margin: 0, borderLeft: 'none', paddingLeft: 0 }}>
                                    {selectedRadiograph.type}
                                </h3>
                                <p className={styles.radioDate}>
                                    <FaCalendarAlt style={{ color: '#94a3b8' }} />
                                    {' '}{formatDateShort(selectedRadiograph.rawDate)}
                                </p>
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
                                    <span>AI is clarifying image…</span>
                                </div>
                            )}
                        </div>

                        {/* AI Enhance button is allowed — it's a client-side visual filter */}
                        <div className={styles.imageViewerControls}>
                            <button
                                className={styles.aiEnhanceBtn}
                                onClick={handleAIEnhance}
                                disabled={isEnhancing}
                            >
                                {isEnhancing
                                    ? 'Processing…'
                                    : isEnhanced
                                        ? <><FaMagic /> Revert to Original</>
                                        : <><FaMagic /> AI Enhance Clarity</>
                                }
                            </button>
                            {/* No download / delete buttons for secretary */}
                        </div>
                    </div>
                </div>
            );
        }

        // ── Gallery view ────────────────────────────────────────────────────
        return (
            <div className={styles.contentCard}>
                <ReadOnlyBanner />

                <div className={styles.sectionHeaderRow}>
                    <h3 className={styles.sectionTitle} style={{ marginBottom: 0 }}>
                        Dental Radiographs (X-Rays)
                    </h3>
                    {/* No "Upload Radiograph" button — secretary is read-only */}
                </div>

                {radiographs.length > 0 ? (
                    <div className={styles.radiographGrid}>
                        {radiographs.map(img => (
                            <div
                                key={img.id}
                                className={styles.radioCard}
                                onClick={() => openRadiograph(img)}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className={styles.radioThumbnailWrapper}>
                                    <img
                                        src={img.url}
                                        alt={img.type}
                                        className={styles.radioThumbnail}
                                    />
                                </div>
                                <div className={styles.radioMeta}>
                                    <h4 className={styles.radioType}>{img.type}</h4>
                                    <span className={styles.radioDate}>
                                        <FaCalendarAlt style={{ color: '#94a3b8' }} />
                                        {' '}{formatDateShort(img.rawDate)}
                                    </span>
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

    // ── Loading / not-found states ─────────────────────────────────────────────
    if (isLoading) {
        return (
            <main className={styles['main-content']}>
                <div style={{ textAlign: 'center', padding: '80px', color: '#01538b', fontWeight: 'bold' }}>
                    Loading Electronic Medical Record…
                </div>
            </main>
        );
    }

    if (!patient) {
        return (
            <main className={styles['main-content']}>
                <div style={{ textAlign: 'center', padding: '80px', color: '#ef4444', fontWeight: 'bold' }}>
                    Patient record not found.
                </div>
            </main>
        );
    }

    // ── Main render ────────────────────────────────────────────────────────────
    return (
        <main className={styles['main-content']}>

            {/* Page Header */}
            <div className={styles.headerWrapper}>
                <div className={styles.headerLeft}>
                    <button
                        className={styles.backIconButton}
                        onClick={() => navigate(`/secretary/patients/${patientId}`)}
                        title="Back to Patient Profile"
                    >
                        <FaArrowLeft />
                    </button>
                    <div className={styles.header}>
                        <h1 className={styles.title}>Electronic Medical Record</h1>
                        <p className={styles.subtitle}>
                            Comprehensive clinical profile and treatment history
                        </p>
                    </div>
                </div>
            </div>

            {/* Patient Profile Banner */}
            <div className={styles.profileHeaderCard}>
                <UserAvatar
                    user={{ name: patient.name, profileImage: patient.profileImage }}
                    size={90}
                    style={{ border: '3px solid #e0f2fe', boxShadow: '0 4px 10px rgba(1,83,139,0.1)' }}
                />
                <div className={styles.patientMainInfo}>
                    <div className={styles.nameRow}>
                        <h2 className={styles.patientName}>
                            {patient.name?.first
                                ? `${patient.name.first}${patient.name.middle ? ' ' + patient.name.middle : ''} ${patient.name.last}`
                                : (typeof patient.name === 'string' ? patient.name : 'Unknown')
                            }
                        </h2>
                        {patient.assignedBranches?.[0] && (
                            <span className={styles.branchBadge}>
                                {patient.assignedBranches[0]} Branch
                            </span>
                        )}
                        <span className={styles.patientId}>
                            ID: {patient._id || patient.id}
                        </span>
                    </div>
                    <div className={styles.metaRow}>
                        <span className={styles.metaItem}>
                            <FaUserMd className={styles.metaIcon} />
                            {patient.gender || '—'}
                            {patientAge !== null ? `, ${patientAge} y/o` : ''}
                            {patient.birthdate ? ` (DOB: ${formatDateShort(patient.birthdate)})` : ''}
                        </span>
                        <span className={styles.metaItem}>
                            <FaPhoneAlt className={styles.metaIcon} />
                            {patient.contactNumber || '—'}
                        </span>
                        <span className={styles.metaItem}>
                            <FaEnvelope className={styles.metaIcon} />
                            {patient.email || '—'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Tab Bar */}
            <div className={styles.tabContainer}>
                {[
                    { key: 'overview',       label: 'Overview'               },
                    { key: 'medicalHistory', label: 'Medical History & Alerts' },
                    { key: 'treatmentLogs',  label: 'Treatment Logs'          },
                    { key: 'odontogram',     label: 'Dental Chart'            },
                    { key: 'radiographs',    label: 'Radiographs'             },
                ].map(tab => (
                    <button
                        key={tab.key}
                        className={`${styles.tabBtn} ${activeTab === tab.key ? styles.active : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className={styles.tabContentArea}>
                {activeTab === 'overview'       && renderOverview()}
                {activeTab === 'medicalHistory' && renderMedicalHistory()}
                {activeTab === 'treatmentLogs'  && renderTreatmentLogs()}
                {activeTab === 'odontogram'     && renderOdontogram()}
                {activeTab === 'radiographs'    && renderRadiographs()}
            </div>
        </main>
    );
}