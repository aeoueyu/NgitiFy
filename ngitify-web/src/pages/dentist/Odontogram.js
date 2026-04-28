import React, { useState, useEffect } from 'react';
import styles from '../../styles/dentist/Odontogram.module.css';
import { FaTooth } from 'react-icons/fa';
import { useToast } from '../../context/ToastContext';
import { authFetch } from '../../utils/api';

// FDI Tooth Numbering
const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const UPPER_LEFT  = [21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const LOWER_LEFT  = [31, 32, 33, 34, 35, 36, 37, 38];

const SURFACES = [
    { key: 'M', label: 'Mesial' },
    { key: 'D', label: 'Distal' },
    { key: 'O', label: 'Occlusal / Incisal' },
    { key: 'B', label: 'Buccal' },
    { key: 'L', label: 'Lingual' },
];

const CONDITIONS = [
    { value: 'healthy',        label: 'Healthy',          activeClass: 'activeHealthy',       span: 1 },
    { value: 'filled',         label: 'Filled',           activeClass: 'activeFilled',        span: 1 },
    { value: 'decayed',        label: 'Caries / Decayed', activeClass: 'activeDecayed',       span: 1 },
    { value: 'crown',          label: 'Crown',            activeClass: 'activeCrown',         span: 1 },
    { value: 'implant',        label: 'Implant',          activeClass: 'activeImplant',       span: 1 },
    { value: 'bridge',         label: 'Bridge Pontic',    activeClass: 'activeBridge',        span: 1 },
    { value: 'extraction-site',label: 'Extraction Site',  activeClass: 'activeExtractionSite',span: 1 },
    { value: 'mobility',       label: 'Mobility',         activeClass: 'activeMobility',      span: 1 },
    { value: 'missing',        label: 'Missing',          activeClass: 'activeMissing',       span: 2 },
];

// ── Backward-compatible reader ────────────────────────────────────────────────
// Old data: chartData[num] = 'filled'  (string)
// New data: chartData[num] = { status: 'filled', surfaces: ['M','O'] }
const normalizeToothData = (raw) => {
    if (!raw) return { status: 'healthy', surfaces: [] };
    if (typeof raw === 'string') return { status: raw, surfaces: [] };
    return { status: raw.status || 'healthy', surfaces: Array.isArray(raw.surfaces) ? raw.surfaces : [] };
};

export default function Odontogram({ patientId }) {
    const { addToast } = useToast();

    const [chartData, setChartData] = useState({});
    const [selectedTooth, setSelectedTooth] = useState(null);
    const [tempStatus, setTempStatus] = useState('healthy');
    const [tempSurfaces, setTempSurfaces] = useState([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchOdontogram = async () => {
            if (!patientId) return;
            try {
                const res = await authFetch(`/patients/${patientId}/odontogram`);
                if (res.ok) setChartData(await res.json());
            } catch (e) {
                console.error('Error fetching odontogram:', e);
            }
        };
        fetchOdontogram();
    }, [patientId]);

    const getToothData = (num) => normalizeToothData(chartData[num]);

    const openToothModal = (num) => {
        const { status, surfaces } = getToothData(num);
        setSelectedTooth(num);
        setTempStatus(status);
        setTempSurfaces(surfaces);
    };

    const toggleSurface = (key) => {
        setTempSurfaces(prev =>
            prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
        );
    };

    const handleSaveStatus = async () => {
        if (!patientId) {
            addToast('No patient ID provided. Cannot save.', 'error');
            return;
        }
        setIsSaving(true);
        try {
            const payload = {
                [selectedTooth]: { status: tempStatus, surfaces: tempSurfaces },
            };
            const res = await authFetch(`/patients/${patientId}/odontogram`, {
                method: 'PUT',
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error((await res.json()).message || 'Failed to save.');

            setChartData(prev => ({ ...prev, [selectedTooth]: { status: tempStatus, surfaces: tempSurfaces } }));
            addToast(`Tooth #${selectedTooth} updated to ${tempStatus}.`, 'success');
            setSelectedTooth(null);
        } catch (e) {
            addToast(e.message || 'Failed to save tooth status.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const renderToothRow = (teethArray, isUpper) =>
        teethArray.map(num => {
            const { status, surfaces } = getToothData(num);
            return (
                <div
                    key={num}
                    className={`${styles.toothContainer} ${styles[status] || ''}`}
                    onClick={() => openToothModal(num)}
                    title={`Tooth ${num} — ${status}${surfaces.length ? ` (${surfaces.join(', ')})` : ''}`}
                >
                    {isUpper && <span className={styles.toothNum}>{num}</span>}
                    <div className={styles.toothGraphic}>
                        <FaTooth className={styles.toothIcon} />
                    </div>
                    {!isUpper && <span className={styles.toothNum}>{num}</span>}
                    {/* Surface indicators */}
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
        <div className={styles.odontogramWrapper}>
            {/* UPPER JAW */}
            <div className={styles.jawSection}>
                <h4 className={styles.jawTitle}>Maxillary Arch (Upper)</h4>
                <div className={styles.arch}>
                    <div className={styles.quadrant}>{renderToothRow(UPPER_RIGHT, true)}</div>
                    <div className={styles.divider}></div>
                    <div className={styles.quadrant}>{renderToothRow(UPPER_LEFT, true)}</div>
                </div>
            </div>

            {/* LOWER JAW */}
            <div className={styles.jawSection}>
                <h4 className={styles.jawTitle}>Mandibular Arch (Lower)</h4>
                <div className={styles.arch}>
                    <div className={styles.quadrant}>{renderToothRow(LOWER_RIGHT, false)}</div>
                    <div className={styles.divider}></div>
                    <div className={styles.quadrant}>{renderToothRow(LOWER_LEFT, false)}</div>
                </div>
            </div>

            {/* LEGEND */}
            <div className={styles.chartLegend}>
                <div className={styles.legendItem}><div className={`${styles.legendColor} ${styles.healthy}`}></div> Healthy</div>
                <div className={styles.legendItem}><div className={`${styles.legendColor} ${styles.filled}`}></div> Filled</div>
                <div className={styles.legendItem}><div className={`${styles.legendColor} ${styles.decayed}`}></div> Caries</div>
                <div className={styles.legendItem}><div className={`${styles.legendColor} ${styles.crown}`}></div> Crown</div>
                <div className={styles.legendItem}><div className={`${styles.legendColor} ${styles.implant}`}></div> Implant</div>
                <div className={styles.legendItem}><div className={`${styles.legendColor} ${styles.bridge}`}></div> Bridge</div>
                <div className={styles.legendItem}><div className={`${styles.legendColor} ${styles['extraction-site']}`}></div> Extraction Site</div>
                <div className={styles.legendItem}><div className={`${styles.legendColor} ${styles.mobility}`}></div> Mobility</div>
                <div className={styles.legendItem}><div className={`${styles.legendColor} ${styles.missing}`}></div> Missing</div>
            </div>

            {/* UPDATE TOOTH MODAL */}
            {selectedTooth && (
                <div className={styles.modalOverlay}>
                    <div className={styles.overlayBackground} onClick={() => setSelectedTooth(null)}></div>
                    <div className={styles.miniModalCard}>
                        <h3 className={styles.modalTitle}>Update Tooth #{selectedTooth}</h3>
                        <p className={styles.modalSubtitle}>Select the current clinical status.</p>

                        {/* CONDITION GRID */}
                        <div className={styles.statusOptionsGrid}>
                            {CONDITIONS.map(c => (
                                <button
                                    key={c.value}
                                    style={c.span === 2 ? { gridColumn: 'span 2' } : {}}
                                    className={`${styles.statusBtn} ${tempStatus === c.value ? styles[c.activeClass] : ''}`}
                                    onClick={() => setTempStatus(c.value)}
                                >
                                    {c.label}
                                </button>
                            ))}
                        </div>

                        {/* SURFACE ANNOTATION */}
                        <div className={styles.surfaceSection}>
                            <p className={styles.surfaceSectionTitle}>Affected Surfaces <span className={styles.surfaceOptional}>(optional)</span></p>
                            <div className={styles.surfaceGrid}>
                                {SURFACES.map(s => (
                                    <button
                                        key={s.key}
                                        className={`${styles.surfaceBtn} ${tempSurfaces.includes(s.key) ? styles.surfaceBtnActive : ''}`}
                                        onClick={() => toggleSurface(s.key)}
                                        type="button"
                                    >
                                        <span className={styles.surfaceKey}>{s.key}</span>
                                        <span className={styles.surfaceLabel}>{s.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className={styles.modalButtonGroup}>
                            <button className={styles.cancelBtn} onClick={() => setSelectedTooth(null)} disabled={isSaving}>
                                Cancel
                            </button>
                            <button className={styles.submitBtn} onClick={handleSaveStatus} disabled={isSaving}>
                                {isSaving ? 'Saving...' : 'Save Update'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}