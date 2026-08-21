import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FaFileMedical, FaNotesMedical, FaTooth, FaXRay } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import {
    formatAddress,
    formatDateDisplay,
} from '../../utils/patientPortal';
import { getHomeAddress } from '../../utils/addressHelpers';
import { PatientEmptyState, PatientPageFrame, PatientSectionHeader } from '../../components/patient/PatientFrame';
import DentalPinStyleOdontogram from '../../components/dentist/odontogram/DentalPinStyleOdontogram';
import styles from '../../styles/patient/PatientPortal.module.css';

const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const ALL_TOOTH_NUMBERS = [...UPPER_RIGHT, ...UPPER_LEFT, ...LOWER_LEFT, ...LOWER_RIGHT];

const STATUS_META = {
    healthy: { label: 'Healthy', fill: '#ffffff', stroke: '#cbd5e1', accent: '#64748b', badgeBg: '#f8fafc', badgeText: '#475569' },
    filled: { label: 'Filled', fill: '#dff3ff', stroke: '#0ea5e9', accent: '#0284c7', badgeBg: '#e0f2fe', badgeText: '#0369a1' },
    decayed: { label: 'Caries / Decayed', fill: '#fee2e2', stroke: '#ef4444', accent: '#b91c1c', badgeBg: '#fee2e2', badgeText: '#b91c1c' },
    crown: { label: 'Crown', fill: '#fef3c7', stroke: '#f59e0b', accent: '#b45309', badgeBg: '#fef3c7', badgeText: '#92400e' },
    implant: { label: 'Implant', fill: '#ede9fe', stroke: '#8b5cf6', accent: '#6d28d9', badgeBg: '#ede9fe', badgeText: '#6d28d9' },
    bridge: { label: 'Bridge', fill: '#ffedd5', stroke: '#f97316', accent: '#c2410c', badgeBg: '#ffedd5', badgeText: '#9a3412' },
    'extraction-site': { label: 'Extraction Site', fill: '#e2e8f0', stroke: '#64748b', accent: '#334155', badgeBg: '#e2e8f0', badgeText: '#334155' },
    missing: { label: 'Missing', fill: '#e5e7eb', stroke: '#94a3b8', accent: '#475569', badgeBg: '#e5e7eb', badgeText: '#475569' },
    mobility: { label: 'Mobility', fill: '#fce7f3', stroke: '#ec4899', accent: '#be185d', badgeBg: '#fce7f3', badgeText: '#be185d' },
    fractured: { label: 'Fractured', fill: '#ffedd5', stroke: '#fb923c', accent: '#c2410c', badgeBg: '#ffedd5', badgeText: '#c2410c' },
    'root-canal': { label: 'Root Canal', fill: '#fae8ff', stroke: '#a855f7', accent: '#7e22ce', badgeBg: '#fae8ff', badgeText: '#7e22ce' },
    'under-observation': { label: 'Under Observation', fill: '#ccfbf1', stroke: '#14b8a6', accent: '#0f766e', badgeBg: '#ccfbf1', badgeText: '#0f766e' },
    unknown: { label: 'Recorded Finding', fill: '#eef2ff', stroke: '#818cf8', accent: '#4f46e5', badgeBg: '#eef2ff', badgeText: '#4338ca' },
};

Object.values(STATUS_META).forEach((meta) => {
    meta.background = meta.badgeBg;
    meta.color = meta.badgeText;
    meta.border = meta.stroke;
});

const STAGE_META = {
    existing: { label: 'Existing', accent: '#475569', badgeBg: '#f8fafc' },
    planned: { label: 'Planned', accent: '#f59e0b', badgeBg: '#fff7ed' },
    completed: { label: 'Completed', accent: '#16a34a', badgeBg: '#dcfce7' },
};

const STATUS_ALIASES = {
    healthy: 'healthy',
    normal: 'healthy',
    sound: 'healthy',
    filled: 'filled',
    filling: 'filled',
    decayed: 'decayed',
    caries: 'decayed',
    crown: 'crown',
    crowned: 'crown',
    implant: 'implant',
    bridge: 'bridge',
    pontic: 'bridge',
    missing: 'missing',
    extracted: 'missing',
    'extraction site': 'extraction-site',
    'extraction-site': 'extraction-site',
    mobility: 'mobility',
    fracture: 'fractured',
    fractured: 'fractured',
    'root canal': 'root-canal',
    'root-canal': 'root-canal',
    'under observation': 'under-observation',
    'under-observation': 'under-observation',
};

const normalizeOdontogramEntry = (rawEntry) => {
    if (!rawEntry) {
        return { statusKey: 'healthy', label: STATUS_META.healthy.label, surfaces: [] };
    }

    if (typeof rawEntry === 'string') {
        const statusKey = STATUS_ALIASES[String(rawEntry).trim().toLowerCase()] || 'healthy';
        return { statusKey, label: STATUS_META[statusKey]?.label || rawEntry, surfaces: [] };
    }

    const findings = Array.isArray(rawEntry.findings) ? rawEntry.findings : [];
    const activeFinding = findings[0] || rawEntry;
    const rawStatus = String(activeFinding.status || rawEntry.status || '').trim().toLowerCase();
    const statusKey = STATUS_ALIASES[rawStatus] || rawStatus || 'healthy';
    const surfaces = Array.isArray(activeFinding.surfaces)
        ? activeFinding.surfaces.map((surface) => String(surface).trim().toUpperCase()).filter(Boolean)
        : [];
    const rawStage = String(activeFinding.stage || rawEntry.stage || '').trim().toLowerCase();
    const stageKey = STAGE_META[rawStage] ? rawStage : 'existing';
    return {
        statusKey: STATUS_META[statusKey] ? statusKey : 'unknown',
        label: STATUS_META[statusKey]?.label || rawStatus || STATUS_META.healthy.label,
        surfaces,
        stageKey,
    };
};

export default function PatientMedicalRecords() {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'odontogram');
    const [profile, setProfile] = useState(null);
    const [odontogram, setOdontogram] = useState({});
    const [radiographs, setRadiographs] = useState([]);
    const [treatmentLogs, setTreatmentLogs] = useState([]);
    const [selectedRadiograph, setSelectedRadiograph] = useState(null);
    const [selectedTooth, setSelectedTooth] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchRecords = useCallback(async () => {
        const userId = user?.userId || user?.id || user?._id;
        if (!userId) return;
        try {
            setError('');
            const [profileResponse, odontogramResponse, radiographResponse, treatmentResponse] = await Promise.allSettled([
                authFetch(`/user/${userId}`),
                authFetch('/my/odontogram'),
                authFetch('/my/radiographs'),
                authFetch('/my/treatment-logs'),
            ]);

            if (profileResponse.status === 'fulfilled' && profileResponse.value.ok) {
                setProfile(await profileResponse.value.json());
            }

            if (odontogramResponse.status === 'fulfilled' && odontogramResponse.value.ok) {
                setOdontogram(await odontogramResponse.value.json());
            }

            if (radiographResponse.status === 'fulfilled' && radiographResponse.value.ok) {
                const payload = await radiographResponse.value.json();
                setRadiographs(Array.isArray(payload) ? payload : []);
            }

            if (treatmentResponse.status === 'fulfilled' && treatmentResponse.value.ok) {
                const payload = await treatmentResponse.value.json();
                setTreatmentLogs(Array.isArray(payload) ? payload : []);
            }
        } catch {
            setError('Could not load your medical records. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [user?.id, user?._id, user?.userId]);

    useEffect(() => {
        fetchRecords();
    }, [fetchRecords]);

    useEffect(() => {
        setSearchParams((current) => {
            const next = new URLSearchParams(current);
            next.set('tab', activeTab);
            return next;
        }, { replace: true });
    }, [activeTab, setSearchParams]);

    const medicalRows = useMemo(() => ([
        ['Full Name', profile?.name?.first ? `${profile.name.first} ${profile.name.last || ''}`.trim() : (profile?.name || 'Not specified')],
        ['Birthdate', formatDateDisplay(profile?.birthdate, { month: 'long' })],
        ['Gender', profile?.gender || 'Not specified'],
        ['Blood Type', profile?.bloodType || profile?.medicalHistory?.bloodType || 'Not specified'],
        ['Phone Number', profile?.contactNumber || 'Not specified'],
        ['Occupation', profile?.occupation || 'Not specified'],
        ['Address', formatAddress(getHomeAddress(profile))],
        ['Emergency Contact', profile?.emergencyContact?.name || 'Not specified'],
        ['Emergency Number', profile?.emergencyContact?.contactNumber || 'Not specified'],
        ['Allergies', profile?.medicalHistory?.allergies?.join(', ') || 'Not specified'],
        ['Medical Conditions', profile?.medicalHistory?.conditions?.join(', ') || 'Not specified'],
        ['Current Medications', profile?.medicalHistory?.medications?.join(', ') || 'Not specified'],
    ]), [profile]);

    const selectedToothEntry = useMemo(() => {
        if (!selectedTooth) return null;
        return normalizeOdontogramEntry(odontogram?.[String(selectedTooth)]);
    }, [odontogram, selectedTooth]);

    const selectedToothMeta = selectedToothEntry
        ? (STATUS_META[selectedToothEntry.statusKey] || STATUS_META.healthy)
        : null;

    const getPatientToothData = useCallback((toothNumber) => {
        const entry = normalizeOdontogramEntry(odontogram?.[String(toothNumber)]);
        return {
            status: entry.statusKey,
            statusLabel: entry.label,
            surfaces: entry.surfaces,
            stage: entry.stageKey || 'existing',
        };
    }, [odontogram]);

    const getPatientStatusMeta = useCallback((statusKey) => STATUS_META[statusKey] || STATUS_META.unknown, []);

    return (
        <PatientPageFrame
            title="Electronic Medical Record (EMR)"
            subtitle="Your Medical and Dental History, Treatment History, tooth chart, and dental X-rays."
        >
            <div className={styles.tabs} role="tablist" aria-label="Medical records sections">
                {[
                    { key: 'odontogram', label: 'Odontogram · Your tooth chart' },
                    { key: 'radiographs', label: 'Radiograph Images · Your dental X-rays' },
                    { key: 'medical', label: 'Medical and Dental History' },
                ].map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab.key}
                        className={`${styles.tabButton} ${activeTab === tab.key ? styles.tabButtonActive : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className={styles.loaderBox}>
                    <span className={styles.loaderText}>Loading your records...</span>
                </div>
            ) : error ? (
                <PatientEmptyState
                    icon={<FaFileMedical />}
                    title="Could not load records"
                    message={error}
                    action={(
                        <button type="button" className={styles.buttonSecondary} onClick={fetchRecords}>
                            Try Again
                        </button>
                    )}
                />
            ) : (
                <>
                    {activeTab === 'odontogram' ? (
                        <section className={styles.tabPanel}>
                            <PatientSectionHeader
                                eyebrow="Read-only"
                                title="Odontogram"
                                description="Tap a tooth to view its saved status. Only your dental team can update this chart."
                            />
                            {Object.keys(odontogram || {}).length ? (
                                <>
                                    {selectedTooth && selectedToothEntry && selectedToothMeta ? (
                                        <article
                                            className={styles.summaryCard}
                                            style={{
                                                marginBottom: '18px',
                                                background: selectedToothMeta.background,
                                                borderColor: selectedToothMeta.border,
                                            }}
                                        >
                                            <span className={styles.infoLabel}>Selected Tooth</span>
                                            <p className={styles.infoValue} style={{ color: selectedToothMeta.color, fontWeight: 800, marginBottom: '10px' }}>
                                                Tooth {selectedTooth} - {selectedToothEntry.label}
                                            </p>
                                            {selectedToothEntry.stageKey && selectedToothEntry.stageKey !== 'existing' ? (
                                                <>
                                                    <span className={styles.infoLabel}>Treatment Stage</span>
                                                    <p className={styles.infoValue}>
                                                        {STAGE_META[selectedToothEntry.stageKey]?.label || 'Existing'}
                                                    </p>
                                                </>
                                            ) : null}
                                            <span className={styles.infoLabel}>Recorded Surfaces</span>
                                            <p className={styles.infoValue}>
                                                {selectedToothEntry.surfaces.length
                                                    ? selectedToothEntry.surfaces.join(', ')
                                                    : 'Whole tooth or no specific surface recorded.'}
                                            </p>
                                        </article>
                                    ) : (
                                        <article className={styles.summaryCard} style={{ marginBottom: '18px' }}>
                                            <span className={styles.infoLabel}>Tooth Status Viewer</span>
                                            <p className={styles.infoValue}>Select any tooth below to view its recorded condition.</p>
                                        </article>
                                    )}
                                    <div className={styles.patientBiomathChartShell}>
                                        <DentalPinStyleOdontogram
                                            getDisplayToothData={getPatientToothData}
                                            getStatusMeta={getPatientStatusMeta}
                                            onSelect={setSelectedTooth}
                                        />
                                    </div>
                                </>
                            ) : (
                                <PatientEmptyState
                                    icon={<FaTooth />}
                                    title="No tooth chart yet"
                                    message="Your dentist will update your tooth chart after an examination or treatment."
                                />
                            )}
                        </section>
                    ) : null}

                    {activeTab === 'radiographs' ? (
                        <section className={styles.tabPanel}>
                            <PatientSectionHeader
                                eyebrow="Imaging"
                                title="Radiograph Images"
                                description="Open an image to view the X-ray, notes, and findings shared by your clinic."
                            />
                            {radiographs.length ? (
                                <div className={styles.cardGrid}>
                                    {radiographs.map((item, index) => (
                                        <button
                                            key={item._id || `${item.label}-${index}`}
                                            type="button"
                                            className={styles.toolCard}
                                            onClick={() => setSelectedRadiograph(item)}
                                            style={{ textAlign: 'left', border: 'none', cursor: 'pointer' }}
                                        >
                                            <span className={styles.toolIcon}><FaXRay /></span>
                                            <h3 className={styles.toolTitle}>{item.label || 'Dental X-ray'}</h3>
                                            <p className={styles.toolText}>
                                                {item.date ? `Taken on ${formatDateDisplay(item.date)}` : 'No date recorded yet.'}
                                            </p>
                                            <p className={styles.toolText}>{item.approvedSummary || 'Tap to review information approved by your dentist.'}</p>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <PatientEmptyState
                                    icon={<FaXRay />}
                                    title="No radiograph images yet"
                                    message="Dental X-rays shared by your clinic will appear here."
                                />
                            )}
                        </section>
                    ) : null}

                    {activeTab === 'medical' ? (
                        <section className={styles.tabPanel}>
                            <PatientSectionHeader
                                eyebrow="Patient History"
                                title="Medical history and profile snapshot"
                                description="The same patient information the clinic keeps on file for your visits."
                            />
                            <div className={styles.noticeBox} style={{ marginBottom: '18px' }} role="note">
                                <strong>This information is part of your dental record.</strong>{' '}
                                Clinical information is read-only after registration consent. Need to correct something? Please contact the clinic.
                            </div>
                            <div className={styles.cardGrid}>
                                <article className={styles.infoCard}>
                                    <h3 className={styles.sectionTitle} style={{ fontSize: '18px', marginBottom: '14px' }}>Medical Profile</h3>
                                    <div className={styles.timeline}>
                                        {medicalRows.map(([label, value]) => (
                                            <div key={label}>
                                                <span className={styles.infoLabel}>{label}</span>
                                                <p className={styles.infoValue}>{value}</p>
                                            </div>
                                        ))}
                                    </div>
                                </article>
                                <article className={styles.infoCard}>
                                    <h3 className={styles.sectionTitle} style={{ fontSize: '18px', marginBottom: '14px' }}>Recent Treatment History</h3>
                                    {treatmentLogs.length ? (
                                        <div className={styles.timeline}>
                                            {treatmentLogs.slice(0, 5).map((item) => (
                                                <div key={item._id} className={styles.timelineItem}>
                                                    <span className={styles.timelineDot} />
                                                    <div>
                                                        <h4 className={styles.timelineTitle}>{item.procedure || 'Treatment recorded'}</h4>
                                                        <p className={styles.timelineMeta}>{formatDateDisplay(item.date)} • {item.category || 'Other'}</p>
                                                        <p className={styles.timelineText}>{item.branch || 'Clinic visit recorded in Dentime.'}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <PatientEmptyState
                                            icon={<FaNotesMedical />}
                                            title="No treatment history yet"
                                            message="Once the clinic records treatments in your file, the latest items will appear here."
                                        />
                                    )}
                                </article>
                            </div>
                        </section>
                    ) : null}
                </>
            )}

            {selectedRadiograph ? (
                <div className={styles.modalOverlay}>
                    <div
                        className={styles.modalCard}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="radiograph-viewer-title"
                        aria-describedby="radiograph-viewer-description"
                    >
                        <div className={styles.modalHeader}>
                            <div>
                                <h3 id="radiograph-viewer-title" className={styles.modalTitle}>{selectedRadiograph.label || 'Dental X-ray'}</h3>
                                <p id="radiograph-viewer-description" className={styles.modalSubtitle}>
                                    {selectedRadiograph.date ? `Taken on ${formatDateDisplay(selectedRadiograph.date)}` : 'No X-ray date recorded.'}
                                    {selectedRadiograph.radiographNumber ? ` • X-ray No. ${selectedRadiograph.radiographNumber}` : ''}
                                </p>
                            </div>
                            <button type="button" className={styles.modalClose} onClick={() => setSelectedRadiograph(null)} aria-label="Close radiograph viewer">×</button>
                        </div>
                        {(selectedRadiograph.enhancedUrl || selectedRadiograph.url) ? (
                            <div
                                style={{
                                    borderRadius: '18px',
                                    overflow: 'hidden',
                                    background: '#111827',
                                    marginBottom: '18px',
                                    minHeight: '280px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <img
                                    src={selectedRadiograph.enhancedUrl || selectedRadiograph.url}
                                    alt={`${selectedRadiograph.label || 'Radiograph'}${selectedRadiograph.date ? ` taken on ${formatDateDisplay(selectedRadiograph.date)}` : ''}`}
                                    style={{ width: '100%', maxHeight: '65vh', objectFit: 'contain' }}
                                />
                            </div>
                        ) : (
                            <PatientEmptyState
                                icon={<FaXRay />}
                                title="Image not yet available"
                                message="The clinic has not uploaded the dental X-ray image yet."
                            />
                        )}
                        {selectedRadiograph.approvedSummary ? (
                            <article className={styles.summaryCard} style={{ marginBottom: '14px' }}>
                                <span className={styles.infoLabel}>Dentist-approved review summary</span>
                                <p className={styles.infoValue} style={{ whiteSpace: 'pre-line' }}>{selectedRadiograph.approvedSummary}</p>
                            </article>
                        ) : null}
                        {(selectedRadiograph.approvedFindings || []).length ? (
                            <article className={styles.summaryCard}>
                                <span className={styles.infoLabel}>Information recorded by your dentist</span>
                                {(selectedRadiograph.approvedFindings || []).map((item, index) => (
                                    <p key={`${item.toothNumber}-${index}`} className={styles.infoValue}>
                                        {item.toothNumber ? `Tooth ${item.toothNumber}: ` : ''}{item.findingType}{item.note ? ` — ${item.note}` : ''}
                                    </p>
                                ))}
                            </article>
                        ) : null}
                        <p className={styles.toolText}>{selectedRadiograph.disclaimer || 'This explanation is based on information recorded by your dental care team. It does not replace advice from your dentist.'}</p>
                    </div>
                </div>
            ) : null}
        </PatientPageFrame>
    );
}
