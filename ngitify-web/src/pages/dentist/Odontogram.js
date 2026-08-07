import React, { useEffect, useState } from 'react';
import styles from '../../styles/dentist/Odontogram.module.css';
import { useToast } from '../../context/ToastContext';
import { authFetch } from '../../utils/api';
import DentalPinStyleOdontogram, { DentalPinToothPreview } from '../../components/dentist/odontogram/DentalPinStyleOdontogram';

const UPPER_RIGHT = [18, 17, 16, 15, 14, 13, 12, 11];
const UPPER_LEFT = [21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_RIGHT = [48, 47, 46, 45, 44, 43, 42, 41];
const LOWER_LEFT = [31, 32, 33, 34, 35, 36, 37, 38];

const SURFACE_CODES = ['M', 'D', 'O', 'B', 'L'];
const SURFACE_LABELS = {
    M: 'Mesial',
    D: 'Distal',
    O: 'Occlusal / Incisal',
    B: 'Buccal / Labial',
    L: 'Lingual / Palatal',
};

const STATUS_META = {
    healthy: {
        key: 'healthy',
        label: 'Healthy',
        fill: '#ffffff',
        stroke: '#cbd5e1',
        accent: '#64748b',
        badgeBg: '#f8fafc',
        badgeText: '#475569',
        description: 'No finding recorded.',
    },
    filled: {
        key: 'filled',
        label: 'Filled',
        fill: '#dff3ff',
        stroke: '#0ea5e9',
        accent: '#0284c7',
        badgeBg: '#e0f2fe',
        badgeText: '#0369a1',
        description: 'Restoration on the selected surface or surfaces.',
    },
    decayed: {
        key: 'decayed',
        label: 'Caries / Decayed',
        fill: '#fee2e2',
        stroke: '#ef4444',
        accent: '#b91c1c',
        badgeBg: '#fee2e2',
        badgeText: '#b91c1c',
        description: 'Active caries on the selected surface or surfaces.',
    },
    crown: {
        key: 'crown',
        label: 'Crown',
        fill: '#fef3c7',
        stroke: '#f59e0b',
        accent: '#b45309',
        badgeBg: '#fef3c7',
        badgeText: '#92400e',
        description: 'Full crown coverage.',
    },
    implant: {
        key: 'implant',
        label: 'Implant',
        fill: '#ede9fe',
        stroke: '#8b5cf6',
        accent: '#6d28d9',
        badgeBg: '#ede9fe',
        badgeText: '#6d28d9',
        description: 'Implant-restored position.',
    },
    bridge: {
        key: 'bridge',
        label: 'Bridge Pontic',
        fill: '#ffedd5',
        stroke: '#f97316',
        accent: '#c2410c',
        badgeBg: '#ffedd5',
        badgeText: '#9a3412',
        description: 'Bridge or pontic notation.',
    },
    'extraction-site': {
        key: 'extraction-site',
        label: 'Extraction Site',
        fill: '#e2e8f0',
        stroke: '#64748b',
        accent: '#334155',
        badgeBg: '#e2e8f0',
        badgeText: '#334155',
        description: 'Extraction site or healed socket.',
    },
    missing: {
        key: 'missing',
        label: 'Missing',
        fill: '#e5e7eb',
        stroke: '#94a3b8',
        accent: '#475569',
        badgeBg: '#e5e7eb',
        badgeText: '#475569',
        description: 'Tooth missing from the arch.',
    },
    mobility: {
        key: 'mobility',
        label: 'Mobility',
        fill: '#fce7f3',
        stroke: '#ec4899',
        accent: '#be185d',
        badgeBg: '#fce7f3',
        badgeText: '#be185d',
        description: 'Mobility noted.',
    },
    fractured: {
        key: 'fractured',
        label: 'Fractured',
        fill: '#ffedd5',
        stroke: '#fb923c',
        accent: '#c2410c',
        badgeBg: '#ffedd5',
        badgeText: '#c2410c',
        description: 'Fracture on the selected surface or surfaces.',
    },
    'root-canal': {
        key: 'root-canal',
        label: 'Root Canal',
        fill: '#fae8ff',
        stroke: '#a855f7',
        accent: '#7e22ce',
        badgeBg: '#fae8ff',
        badgeText: '#7e22ce',
        description: 'Endodontically treated tooth.',
    },
    'under-observation': {
        key: 'under-observation',
        label: 'Under Observation',
        fill: '#ccfbf1',
        stroke: '#14b8a6',
        accent: '#0f766e',
        badgeBg: '#ccfbf1',
        badgeText: '#0f766e',
        description: 'Monitored finding on the selected surface or surfaces.',
    },
    unknown: {
        key: 'unknown',
        label: 'Recorded Finding',
        fill: '#eef2ff',
        stroke: '#818cf8',
        accent: '#4f46e5',
        badgeBg: '#eef2ff',
        badgeText: '#4338ca',
        description: 'Compatibility entry from older records.',
    },
};

const STATUS_ALIASES = {
    '': 'healthy',
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

const FINDING_STAGE_META = {
    existing: {
        key: 'existing',
        label: 'Existing',
        accent: '#64748b',
        badgeBg: '#f8fafc',
        badgeText: '#334155',
        border: '#cbd5e1',
        description: 'Current clinical finding',
    },
    planned: {
        key: 'planned',
        label: 'Planned',
        accent: '#f97316',
        badgeBg: '#fff7ed',
        badgeText: '#9a3412',
        border: '#fdba74',
        description: 'Planned treatment or notation',
    },
    completed: {
        key: 'completed',
        label: 'Completed',
        accent: '#16a34a',
        badgeBg: '#ecfdf5',
        badgeText: '#166534',
        border: '#86efac',
        description: 'Completed treatment',
    },
};

const FINDING_STAGE_ORDER = ['existing', 'planned', 'completed'];
const FINDING_STAGE_ALIASES = {
    '': 'existing',
    existing: 'existing',
    current: 'existing',
    planned: 'planned',
    proposed: 'planned',
    completed: 'completed',
    done: 'completed',
};

const EMPTY_STAGE_LABELS = {
    planned: 'No planned entry',
    completed: 'No completed entry',
};

const CONDITION_OPTIONS = [
    'healthy',
    'filled',
    'decayed',
    'crown',
    'implant',
    'bridge',
    'extraction-site',
    'missing',
    'mobility',
    'fractured',
    'root-canal',
    'under-observation',
].map((key) => STATUS_META[key]);

const STAGE_FILTER_OPTIONS = [
    { key: 'all', label: 'All' },
    ...FINDING_STAGE_ORDER.map((stageKey) => ({
        key: stageKey,
        label: FINDING_STAGE_META[stageKey].label,
    })),
];

const SURFACE_SELECTABLE_STATUSES = new Set(['filled', 'decayed', 'fractured', 'under-observation']);

const ALL_TOOTH_NUMBERS = [...UPPER_RIGHT, ...UPPER_LEFT, ...LOWER_LEFT, ...LOWER_RIGHT];

const normalizeStatusKey = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return STATUS_ALIASES[normalized] || normalized.replace(/\s+/g, '-');
};

const normalizeStageKey = (value) => {
    const normalized = String(value || '').trim().toLowerCase();
    return FINDING_STAGE_ALIASES[normalized] || 'existing';
};

const sanitizeSurfaces = (surfaces) => {
    if (!Array.isArray(surfaces)) return [];
    const normalized = new Set(
        surfaces
            .map((surface) => String(surface || '').trim().toUpperCase())
            .filter((surface) => SURFACE_CODES.includes(surface))
    );
    return SURFACE_CODES.filter((surface) => normalized.has(surface));
};

const getStatusMeta = (statusKey) => STATUS_META[statusKey] || STATUS_META.unknown;
const getStageMeta = (stageKey) => FINDING_STAGE_META[stageKey] || FINDING_STAGE_META.existing;
const isEmptyStageFinding = (finding) => (
    finding
    && finding.stage !== 'existing'
    && finding.status === 'healthy'
    && (!Array.isArray(finding.surfaces) || finding.surfaces.length === 0)
    && !finding.note
);
const getFindingDisplayLabel = (finding) => (
    isEmptyStageFinding(finding)
        ? EMPTY_STAGE_LABELS[finding.stage] || 'No entry'
        : getStatusMeta(finding?.status).label
);
const getEmptyStageDescription = (stageKey) => {
    if (stageKey === 'planned') return 'No planned treatment recorded for this tooth.';
    if (stageKey === 'completed') return 'No completed treatment recorded for this tooth.';
    return 'No finding recorded for this stage.';
};

const buildHealthyFinding = (stage = 'existing') => ({
    id: `healthy-${stage}`,
    status: 'healthy',
    statusLabel: stage === 'existing' ? STATUS_META.healthy.label : EMPTY_STAGE_LABELS[stage] || STATUS_META.healthy.label,
    surfaces: [],
    stage,
    note: '',
});

const normalizeFinding = (raw, fallbackStage = 'existing') => {
    if (!raw) return buildHealthyFinding(fallbackStage);

    const rawStatus = typeof raw === 'string' ? raw : raw.status;
    const status = normalizeStatusKey(rawStatus);
    const stage = normalizeStageKey(typeof raw === 'string' ? fallbackStage : raw.stage || fallbackStage);
    const surfaces = sanitizeSurfaces(typeof raw === 'string' ? [] : raw.surfaces);
    const meta = getStatusMeta(status);

    return {
        id: typeof raw === 'object' && raw !== null && raw.id
            ? String(raw.id)
            : `finding-${stage}-${status}-${surfaces.join('') || 'all'}`,
        status: status || 'healthy',
        statusLabel: meta.key === 'unknown' && rawStatus ? String(rawStatus) : meta.label,
        surfaces,
        stage,
        note: typeof raw === 'object' && raw !== null && raw.note ? String(raw.note) : '',
    };
};

const getFindingForStage = (findings, stageKey) => (
    [...findings].reverse().find((finding) => finding.stage === stageKey) || null
);

const pickPreferredFinding = (findings, activeFindingId) => {
    if (!Array.isArray(findings) || findings.length === 0) return null;
    const activeFinding = findings.find((finding) => finding.id === activeFindingId);
    if (activeFinding) return activeFinding;
    for (const stageKey of FINDING_STAGE_ORDER) {
        const stagedFinding = getFindingForStage(findings, stageKey);
        if (stagedFinding) return stagedFinding;
    }
    return findings[findings.length - 1] || null;
};

const normalizeToothData = (raw) => {
    if (!raw) {
        return {
            ...buildHealthyFinding(),
            findings: [],
            activeFindingId: null,
        };
    }

    let findings = [];

    if (typeof raw === 'string') {
        const finding = normalizeFinding({ status: raw, stage: 'existing', surfaces: [] }, 'existing');
        findings = finding.status === 'healthy' ? [] : [finding];
    } else if (Array.isArray(raw.findings) && raw.findings.length > 0) {
        findings = raw.findings
            .map((finding) => normalizeFinding(finding, finding?.stage || raw.stage || 'existing'))
            .filter((finding) => finding.status !== 'healthy');
    } else if (raw.status || Array.isArray(raw.surfaces) || raw.stage) {
        const finding = normalizeFinding(raw, raw.stage || 'existing');
        findings = finding.status === 'healthy' ? [] : [finding];
    }

    const activeFinding = pickPreferredFinding(findings, raw.activeFindingId);
    if (!activeFinding) {
        return {
            ...buildHealthyFinding(),
            findings,
            activeFindingId: null,
        };
    }

    return {
        ...activeFinding,
        findings,
        activeFindingId: activeFinding.id,
    };
};

const buildDisplayToothData = (toothData, stageFilter) => {
    if (stageFilter === 'all') {
        const activeFinding = pickPreferredFinding(toothData.findings, toothData.activeFindingId);
        return activeFinding
            ? { ...activeFinding, findings: toothData.findings, activeFindingId: toothData.activeFindingId }
            : { ...buildHealthyFinding(), findings: toothData.findings, activeFindingId: toothData.activeFindingId };
    }

    const stagedFinding = getFindingForStage(toothData.findings, stageFilter);
    return stagedFinding
        ? { ...stagedFinding, findings: toothData.findings, activeFindingId: toothData.activeFindingId }
        : { ...buildHealthyFinding(stageFilter), findings: toothData.findings, activeFindingId: toothData.activeFindingId };
};

const supportsSurfaceSelection = (statusKey) => SURFACE_SELECTABLE_STATUSES.has(statusKey);

const getFindingNotePlaceholder = (statusKey, stageKey) => {
    if (stageKey === 'planned') {
        if (statusKey === 'decayed') return 'Example: Extraction planned for next week pending patient confirmation.';
        if (statusKey === 'fractured') return 'Example: Crown build-up planned after radiograph review.';
        if (statusKey === 'mobility') return 'Example: Periodontal reassessment in 2 weeks before final treatment.';
        return 'Add the planned procedure, expected timing, or patient preference for this tooth.';
    }

    if (stageKey === 'completed') {
        return 'Add the completed procedure details, outcome, or important aftercare note.';
    }

    return 'Add a short clinical note about the current finding, severity, or follow-up need.';
};

const getWorkflowSuggestion = (statusKey, stageKey) => {
    if (statusKey === 'decayed') {
        if (stageKey === 'planned') return 'Common next steps: restoration if restorable, root canal if pulpal involvement, extraction if non-restorable.';
        if (stageKey === 'completed') return 'Completed updates usually end as filled, root-canal, crown, extraction-site, or missing depending on the final treatment.';
        return 'Use the existing stage for the current diagnosis, then document the chosen treatment under planned or completed.';
    }

    if (statusKey === 'fractured') {
        return 'Typical pathway: assess depth first, then plan restoration, crown, root canal, or extraction based on restorability.';
    }

    if (statusKey === 'mobility') {
        return 'Typical pathway: record the current mobility, then plan periodontal treatment, splinting, or extraction if prognosis is poor.';
    }

    if (statusKey === 'missing' || statusKey === 'extraction-site') {
        return 'After extraction or tooth loss, the next planned stage is often healing review, prosthesis, bridge, or implant evaluation.';
    }

    if (statusKey === 'under-observation') {
        return 'Observation entries work best when the note explains what will trigger treatment or re-evaluation.';
    }

    return 'Use existing for the current condition, planned for the intended procedure, and completed once the actual treatment is finished.';
};

const buildDraftMapFromToothData = (toothData) => Object.fromEntries(
    FINDING_STAGE_ORDER.map((stageKey) => {
        const existingFinding = getFindingForStage(toothData.findings, stageKey);
        return [stageKey, existingFinding ? { ...existingFinding } : buildHealthyFinding(stageKey)];
    })
);

export default function Odontogram({ patientId, readOnly = false, documentMode = false, onOdontogramSaved }) {
    const { addToast } = useToast();

    const [chartData, setChartData] = useState({});
    const [selectedTooth, setSelectedTooth] = useState(null);
    const [draftByStage, setDraftByStage] = useState(() => buildDraftMapFromToothData(normalizeToothData(null)));
    const [tempStage, setTempStage] = useState('existing');
    const [isSaving, setIsSaving] = useState(false);
    const [findingStageFilter, setFindingStageFilter] = useState('all');

    useEffect(() => {
        let isActive = true;

        const fetchOdontogram = async () => {
            if (!patientId) {
                if (isActive) setChartData({});
                return;
            }

            try {
                const res = await authFetch(`/patients/${patientId}/odontogram`);
                if (!res.ok) {
                    throw new Error((await res.json()).message || 'Failed to load dental chart.');
                }

                const data = await res.json();
                if (isActive) setChartData(data || {});
            } catch (error) {
                console.error('Error fetching odontogram:', error);
                if (isActive) addToast(error.message || 'Could not load the odontogram.', 'error');
            }
        };

        fetchOdontogram();

        return () => {
            isActive = false;
        };
    }, [patientId, addToast]);

    const getToothData = (toothNumber) => normalizeToothData(chartData[String(toothNumber)]);
    const getDisplayToothData = (toothNumber) => buildDisplayToothData(getToothData(toothNumber), findingStageFilter);

    const countForFilter = (filterKey) => {
        let count = 0;
        ALL_TOOTH_NUMBERS.forEach((toothNumber) => {
            const toothData = buildDisplayToothData(getToothData(toothNumber), filterKey);
            if (toothData.status !== 'healthy') count += 1;
        });
        return count;
    };

    const closeToothModal = () => {
        setSelectedTooth(null);
    };

    const openToothModal = (toothNumber) => {
        if (readOnly) return;

        const toothData = getToothData(toothNumber);
        const preferredFinding = buildDisplayToothData(toothData, findingStageFilter);

        setSelectedTooth(toothNumber);
        setDraftByStage(buildDraftMapFromToothData(toothData));
        setTempStage(preferredFinding.stage || 'existing');
    };

    const updateCurrentDraft = (updater) => {
        setDraftByStage((previous) => {
            const currentDraft = previous[tempStage] || buildHealthyFinding(tempStage);
            const nextDraft = updater(currentDraft);
            return {
                ...previous,
                [tempStage]: nextDraft,
            };
        });
    };

    const updateCurrentNote = (value) => {
        updateCurrentDraft((draft) => ({
            ...draft,
            note: value,
        }));
    };

    const setStatus = (nextStatus) => {
        updateCurrentDraft((currentDraft) => {
            const nextDraft = {
                ...currentDraft,
                status: nextStatus,
                statusLabel: getStatusMeta(nextStatus).label,
            };

            if (!supportsSurfaceSelection(nextStatus)) {
                nextDraft.surfaces = [];
            }

            return nextDraft;
        });
    };

    const toggleSurface = (surfaceCode) => {
        const currentDraft = draftByStage[tempStage] || buildHealthyFinding(tempStage);
        if (!supportsSurfaceSelection(currentDraft.status)) return;

        updateCurrentDraft((draft) => ({
            ...draft,
            surfaces: draft.surfaces.includes(surfaceCode)
                ? draft.surfaces.filter((surface) => surface !== surfaceCode)
                : [...draft.surfaces, surfaceCode],
        }));
    };

    const handleSaveStatus = async () => {
        if (!patientId || !selectedTooth) {
            addToast('No patient selected. Cannot save the dental chart.', 'error');
            return;
        }

        const normalizedFindings = FINDING_STAGE_ORDER
            .map((stageKey) => normalizeFinding({
                ...(draftByStage[stageKey] || buildHealthyFinding(stageKey)),
                stage: stageKey,
            }, stageKey))
            .filter((finding) => finding.status !== 'healthy')
            .map((finding) => ({
                ...finding,
                surfaces: supportsSurfaceSelection(finding.status) ? sanitizeSurfaces(finding.surfaces) : [],
            }));

        const activeFinding = normalizedFindings.find((finding) => finding.stage === tempStage)
            || pickPreferredFinding(normalizedFindings, null);

        const payloadEntry = activeFinding ? {
            status: activeFinding.status,
            surfaces: activeFinding.surfaces,
            stage: activeFinding.stage,
            activeFindingId: activeFinding.id,
            findings: normalizedFindings,
        } : {
            status: 'healthy',
            surfaces: [],
            stage: 'existing',
            activeFindingId: null,
            findings: [],
        };

        setIsSaving(true);
        try {
            const payload = {
                [selectedTooth]: payloadEntry,
            };

            const res = await authFetch(`/patients/${patientId}/odontogram`, {
                method: 'PUT',
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                throw new Error((await res.json()).message || 'Failed to save the dental chart.');
            }

            setChartData((previous) => ({
                ...previous,
                [selectedTooth]: payloadEntry,
            }));

            if (typeof onOdontogramSaved === 'function') {
                onOdontogramSaved();
            }

            addToast(`Tooth ${selectedTooth} updated successfully.`, 'success');
            closeToothModal();
        } catch (error) {
            addToast(error.message || 'Failed to save the odontogram.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const currentDraft = draftByStage[tempStage] || buildHealthyFinding(tempStage);
    const selectedStatusMeta = getStatusMeta(currentDraft.status);
    const selectedDisplayLabel = getFindingDisplayLabel(currentDraft);
    const selectedStageMeta = getStageMeta(tempStage);

    return (
        <div className={`${styles.odontogramWrapper} ${readOnly ? styles.readOnlyChart : ''} ${documentMode ? styles.documentMode : ''}`.trim()}>
            <div className={styles.chartShell}>
                <div className={styles.chartHeader}>
                    <div>
                        <p className={styles.chartEyebrow}>Odontogram</p>
                        <h3 className={styles.chartTitle}>Clinical 2D Odontogram</h3>
                        <p className={styles.chartSubtitle}>
                            Adult FDI chart with clinic-style tooth silhouettes. Select a tooth to record exact surfaces, stages, and notes.
                        </p>
                    </div>
                    <div className={styles.modeChipRow}>
                        <span className={styles.modeChip}>Permanent dentition</span>
                        <span className={styles.modeChip}>{readOnly ? 'Read only' : 'Editable'}</span>
                    </div>
                </div>

                <div className={styles.chartBody}>
                    <section className={styles.chartFilterPanel}>
                        <h4 className={styles.sidePanelTitle}>View findings</h4>
                        <div className={styles.stageFilterGroup}>
                            {STAGE_FILTER_OPTIONS.map((option) => {
                                const isActive = findingStageFilter === option.key;
                                return (
                                    <button
                                        key={option.key}
                                        type="button"
                                        className={`${styles.filterChip} ${isActive ? styles.filterChipActive : ''}`.trim()}
                                        onClick={() => setFindingStageFilter(option.key)}
                                    >
                                        <span>{option.label}</span>
                                        {option.key !== 'all' && <span className={styles.filterChipCount}>{countForFilter(option.key)}</span>}
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <div className={styles.biomathChartShell}>
                        <DentalPinStyleOdontogram
                            getDisplayToothData={getDisplayToothData}
                            getStatusMeta={getStatusMeta}
                            readOnly={readOnly}
                            onSelect={openToothModal}
                        />
                    </div>

                    <aside className={styles.chartSidePanel}>
                        <section className={styles.sidePanelSection}>
                            <h4 className={styles.sidePanelTitle}>Surfaces</h4>
                            <div className={styles.legendSurfaceMap}>
                                {SURFACE_CODES.map((surfaceCode) => (
                                    <div key={surfaceCode} className={styles.surfaceKeyCard}>
                                        <span className={styles.surfaceKeyBadge}>{surfaceCode}</span>
                                        <span className={styles.surfaceKeyText}>{SURFACE_LABELS[surfaceCode]}</span>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className={styles.sidePanelSection}>
                            <h4 className={styles.sidePanelTitle}>Stages</h4>
                            <div className={styles.stageLegendRow}>
                                {FINDING_STAGE_ORDER.map((stageKey) => {
                                    const stageMeta = getStageMeta(stageKey);
                                    return (
                                        <span
                                            key={`legend-stage-${stageKey}`}
                                            className={styles.stageLegendBadge}
                                            style={{
                                                backgroundColor: stageMeta.badgeBg,
                                                color: stageMeta.badgeText,
                                                borderColor: stageMeta.border,
                                            }}
                                        >
                                            <span className={styles.stageLegendDot} style={{ backgroundColor: stageMeta.accent }}></span>
                                            {stageMeta.label}
                                        </span>
                                    );
                                })}
                            </div>
                        </section>

                        <section className={styles.sidePanelSection}>
                            <h4 className={styles.sidePanelTitle}>Conditions</h4>
                            <div className={styles.chartLegend}>
                                {CONDITION_OPTIONS.map((condition) => (
                                    <div key={condition.key} className={styles.legendCard}>
                                        <span
                                            className={styles.legendSwatch}
                                            style={{ backgroundColor: condition.fill, borderColor: condition.stroke }}
                                        ></span>
                                        <div className={styles.legendCopy}>
                                            <strong>{condition.label}</strong>
                                            <span>{condition.description}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </aside>
                </div>
            </div>

            {!readOnly && selectedTooth && (
                <div className={styles.modalOverlay}>
                    <div className={styles.overlayBackground} onClick={closeToothModal}></div>

                    <div className={styles.miniModalCard}>
                        <div className={styles.modalHeader}>
                            <div>
                                <p className={styles.modalEyebrow}>Tooth {selectedTooth}</p>
                                <h3 className={styles.modalTitle}>Update odontogram entry</h3>
                                <p className={styles.modalSubtitle}>
                                    Edit separate existing, planned, and completed findings while keeping the same tooth diagram used on the main chart.
                                </p>
                            </div>
                            <button type="button" className={styles.modalCloseBtn} onClick={closeToothModal} aria-label="Close modal">
                                x
                            </button>
                        </div>

                        <div className={styles.modalLayout}>
                            <div className={styles.previewPanel}>
                                <span
                                    className={styles.previewStatus}
                                    style={{
                                        backgroundColor: selectedStatusMeta.badgeBg,
                                        color: selectedStatusMeta.badgeText,
                                        borderColor: selectedStatusMeta.stroke,
                                    }}
                                >
                                    {selectedDisplayLabel}
                                </span>

                                <span
                                    className={styles.previewStageBadge}
                                    style={{
                                        backgroundColor: selectedStageMeta.badgeBg,
                                        color: selectedStageMeta.badgeText,
                                        borderColor: selectedStageMeta.border,
                                    }}
                                >
                                    {selectedStageMeta.label}
                                </span>

                                <div className={styles.previewStack}>
                                    <div className={styles.previewToothFrame}>
                                        <DentalPinToothPreview
                                            toothNumber={selectedTooth}
                                            toothData={{
                                                ...currentDraft,
                                                stage: tempStage,
                                                statusLabel: selectedDisplayLabel,
                                            }}
                                            statusMeta={selectedStatusMeta}
                                        />
                                    </div>
                                </div>

                                <div className={styles.previewSummary}>
                                    <div>
                                        <span className={styles.previewSummaryLabel}>Finding</span>
                                        <strong>{selectedDisplayLabel}</strong>
                                    </div>
                                    <div>
                                        <span className={styles.previewSummaryLabel}>Surface selection</span>
                                        <strong>{currentDraft.surfaces.length > 0 ? currentDraft.surfaces.join(', ') : 'Whole tooth / none selected'}</strong>
                                    </div>
                                </div>

                                <p className={styles.previewHint}>
                                    Use the surface buttons on the right for localized findings. The preview matches the main odontogram tooth diagram.
                                </p>
                            </div>

                            <div className={styles.editorPanel}>
                                <div className={styles.findingStageList}>
                                    {FINDING_STAGE_ORDER.map((stageKey) => {
                                        const draft = draftByStage[stageKey] || buildHealthyFinding(stageKey);
                                        const stageMeta = getStageMeta(stageKey);
                                        const draftStatusMeta = getStatusMeta(draft.status);
                                        const draftDisplayLabel = getFindingDisplayLabel(draft);
                                        const isActive = tempStage === stageKey;
                                        return (
                                            <button
                                                key={`stage-draft-${stageKey}`}
                                                type="button"
                                                className={`${styles.findingStageCard} ${isActive ? styles.findingStageCardActive : ''}`.trim()}
                                                onClick={() => setTempStage(stageKey)}
                                            >
                                                <span
                                                    className={styles.findingStagePill}
                                                    style={{
                                                        backgroundColor: stageMeta.badgeBg,
                                                        color: stageMeta.badgeText,
                                                        borderColor: stageMeta.border,
                                                    }}
                                                >
                                                    {stageMeta.label}
                                                </span>
                                                <strong style={{ color: draftStatusMeta.badgeText }}>{draftDisplayLabel}</strong>
                                                <span>{draft.status === 'healthy' ? getEmptyStageDescription(stageKey) : stageMeta.description}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className={styles.statusOptionsGrid}>
                                    {CONDITION_OPTIONS.map((condition) => {
                                        const isActive = currentDraft.status === condition.key;
                                        return (
                                            <button
                                                key={condition.key}
                                                type="button"
                                                className={`${styles.statusBtn} ${isActive ? styles.statusBtnActive : ''}`.trim()}
                                                style={{
                                                    backgroundColor: isActive ? condition.fill : '#ffffff',
                                                    borderColor: isActive ? condition.stroke : '#d7e1ea',
                                                    color: isActive ? condition.badgeText : '#334155',
                                                }}
                                                onClick={() => setStatus(condition.key)}
                                            >
                                                <span className={styles.statusBtnLabel}>{condition.label}</span>
                                                <span className={styles.statusBtnDescription}>{condition.description}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className={styles.surfaceSection}>
                                    <div className={styles.surfaceSectionHeader}>
                                        <div>
                                            <p className={styles.surfaceSectionEyebrow}>Surface Mapping</p>
                                            <h4 className={styles.surfaceSectionTitle}>Affected surfaces</h4>
                                        </div>
                                        <span className={styles.surfaceSectionNote}>
                                            {supportsSurfaceSelection(currentDraft.status) ? 'Localized finding' : 'Whole tooth finding'}
                                        </span>
                                    </div>

                                    <div className={styles.surfaceCross} aria-label="Affected tooth surfaces">
                                        <div className={styles.surfaceCrossSpacer}></div>
                                        <button
                                            type="button"
                                            className={`${styles.surfaceBtn} ${styles.surfaceCrossBtn} ${currentDraft.surfaces.includes('B') ? styles.surfaceBtnActive : ''}`.trim()}
                                            onClick={() => toggleSurface('B')}
                                            disabled={!supportsSurfaceSelection(currentDraft.status)}
                                        >
                                            <span className={styles.surfaceKey}>B</span>
                                            <span className={styles.surfaceLabel}>{SURFACE_LABELS.B}</span>
                                        </button>
                                        <div className={styles.surfaceCrossSpacer}></div>

                                        <button
                                            type="button"
                                            className={`${styles.surfaceBtn} ${styles.surfaceCrossBtn} ${currentDraft.surfaces.includes('M') ? styles.surfaceBtnActive : ''}`.trim()}
                                            onClick={() => toggleSurface('M')}
                                            disabled={!supportsSurfaceSelection(currentDraft.status)}
                                        >
                                            <span className={styles.surfaceKey}>M</span>
                                            <span className={styles.surfaceLabel}>{SURFACE_LABELS.M}</span>
                                        </button>
                                        <button
                                            type="button"
                                            className={`${styles.surfaceBtn} ${styles.surfaceCrossBtn} ${styles.surfaceCrossCenter} ${currentDraft.surfaces.includes('O') ? styles.surfaceBtnActive : ''}`.trim()}
                                            onClick={() => toggleSurface('O')}
                                            disabled={!supportsSurfaceSelection(currentDraft.status)}
                                        >
                                            <span className={styles.surfaceKey}>O</span>
                                            <span className={styles.surfaceLabel}>{SURFACE_LABELS.O}</span>
                                        </button>
                                        <button
                                            type="button"
                                            className={`${styles.surfaceBtn} ${styles.surfaceCrossBtn} ${currentDraft.surfaces.includes('D') ? styles.surfaceBtnActive : ''}`.trim()}
                                            onClick={() => toggleSurface('D')}
                                            disabled={!supportsSurfaceSelection(currentDraft.status)}
                                        >
                                            <span className={styles.surfaceKey}>D</span>
                                            <span className={styles.surfaceLabel}>{SURFACE_LABELS.D}</span>
                                        </button>

                                        <div className={styles.surfaceCrossSpacer}></div>
                                        <button
                                            type="button"
                                            className={`${styles.surfaceBtn} ${styles.surfaceCrossBtn} ${currentDraft.surfaces.includes('L') ? styles.surfaceBtnActive : ''}`.trim()}
                                            onClick={() => toggleSurface('L')}
                                            disabled={!supportsSurfaceSelection(currentDraft.status)}
                                        >
                                            <span className={styles.surfaceKey}>L</span>
                                            <span className={styles.surfaceLabel}>{SURFACE_LABELS.L}</span>
                                        </button>
                                        <div className={styles.surfaceCrossSpacer}></div>
                                    </div>
                                </div>

                                <div className={styles.noteSection}>
                                    <div className={styles.surfaceSectionHeader}>
                                        <div>
                                            <p className={styles.surfaceSectionEyebrow}>Clinical Note</p>
                                            <h4 className={styles.surfaceSectionTitle}>Stage note</h4>
                                        </div>
                                        <span className={styles.surfaceSectionNote}>
                                            Saved to odontogram history
                                        </span>
                                    </div>
                                    <textarea
                                        className={styles.noteTextarea}
                                        value={currentDraft.note || ''}
                                        onChange={(event) => updateCurrentNote(event.target.value)}
                                        placeholder={getFindingNotePlaceholder(currentDraft.status, tempStage)}
                                        rows={4}
                                    />
                                    <p className={styles.workflowHint}>
                                        {getWorkflowSuggestion(currentDraft.status, tempStage)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className={styles.modalButtonGroup}>
                            <button type="button" className={styles.cancelBtn} onClick={closeToothModal} disabled={isSaving}>
                                Cancel
                            </button>
                            <button type="button" className={styles.submitBtn} onClick={handleSaveStatus} disabled={isSaving}>
                                {isSaving ? 'Saving...' : 'Save tooth update'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

