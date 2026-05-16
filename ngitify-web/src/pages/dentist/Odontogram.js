import React, { useEffect, useState } from 'react';
import styles from '../../styles/dentist/Odontogram.module.css';
import { useToast } from '../../context/ToastContext';
import { authFetch } from '../../utils/api';

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
const WHOLE_TOOTH_STATUSES = new Set(['crown', 'implant', 'bridge', 'extraction-site', 'missing', 'mobility', 'root-canal']);

const ARCH_LAYOUTS = [
    {
        id: 'upper',
        title: 'Maxillary Arch',
        subtitle: 'Adult permanent dentition',
        rows: ['front', 'top', 'back'],
        quadrants: [UPPER_RIGHT, UPPER_LEFT],
        numberPosition: 'top',
    },
    {
        id: 'lower',
        title: 'Mandibular Arch',
        subtitle: 'Adult permanent dentition',
        rows: ['back', 'top', 'front'],
        quadrants: [LOWER_RIGHT, LOWER_LEFT],
        numberPosition: 'bottom',
    },
];

const VIEW_LABELS = {
    front: 'FRONT',
    top: 'TOP',
    back: 'BACK',
};

const FACE_GEOMETRY = {
    incisor: {
        outline: 'M22 8 C24 6 32 6 34 8 L38 14 C39 16 39 20 38 24 L35 36 C34 41 31 47 28 52 C25 47 22 41 21 36 L18 24 C17 20 17 16 18 14 Z',
        surfaces: {
            M: '18,14 24,11 24,45 20,36',
            C: '24,11 32,11 33,45 23,45',
            D: '32,11 38,14 36,36 33,45',
            O: '23,8 33,8 31,14 25,14',
        },
        rootPaths: ['M28 52 C27 60 26 67 28 72'],
    },
    canine: {
        outline: 'M24 8 L28 5 L32 8 L36 15 C37 18 37 22 36 26 L33 38 C32 42 30 48 28 54 C26 48 24 42 23 38 L20 26 C19 22 19 18 20 15 Z',
        surfaces: {
            M: '20,15 25,12 25,46 21,36',
            C: '25,12 31,8 33,46 24,46',
            D: '31,8 36,15 35,36 33,46',
            O: '24,9 32,9 30,15 26,15',
        },
        rootPaths: ['M28 54 C28 62 27 70 28 74'],
    },
    premolar: {
        outline: 'M19 10 C22 7 34 7 37 10 L40 16 C41 19 41 24 39 29 L36 39 C34 45 31 51 28 55 C25 51 22 45 20 39 L17 29 C15 24 15 19 16 16 Z',
        surfaces: {
            M: '17,16 23,12 23,46 19,38',
            C: '23,12 33,12 34,46 22,46',
            D: '33,12 40,16 37,38 34,46',
            O: '22,10 34,10 31,17 25,17',
        },
        rootPaths: ['M24 55 C23 61 22 67 23 71', 'M32 55 C33 61 34 67 33 71'],
    },
    molar: {
        outline: 'M16 12 C20 8 36 8 40 12 L44 19 C46 22 46 28 44 33 L40 42 C38 48 34 53 28 57 C22 53 18 48 16 42 L12 33 C10 28 10 22 12 19 Z',
        surfaces: {
            M: '12,19 21,15 21,47 15,37',
            C: '21,15 35,15 36,47 20,47',
            D: '35,15 44,19 41,37 36,47',
            O: '20,12 36,12 32,19 24,19',
        },
        rootPaths: ['M23 57 C20 63 18 69 19 73', 'M33 57 C36 63 38 69 37 73'],
    },
};

const TOP_GEOMETRY = {
    incisor: {
        outline: 'M18 14 C21 9 35 9 38 14 C40 18 40 27 38 31 C35 35 21 35 18 31 C16 27 16 18 18 14 Z',
        surfaces: {
            M: '18,16 24,18 24,28 18,27',
            D: '32,18 38,16 38,27 32,28',
            O: '24,18 32,18 32,28 24,28',
            B: '21,12 35,12 32,18 24,18',
            L: '24,28 32,28 35,34 21,34',
        },
    },
    canine: {
        outline: 'M26 8 L30 8 L37 16 L34 31 L22 31 L19 16 Z',
        surfaces: {
            M: '20,16 25,18 25,28 21,27',
            D: '31,18 36,16 35,27 31,28',
            O: '25,18 31,18 31,28 25,28',
            B: '24,11 32,11 31,18 25,18',
            L: '25,28 31,28 32,31 24,31',
        },
    },
    premolar: {
        outline: 'M17 14 C20 9 36 9 39 14 C41 18 40 29 36 33 C32 37 24 37 20 33 C16 29 15 18 17 14 Z',
        surfaces: {
            M: '17,18 24,20 23,30 17,27',
            D: '32,20 39,18 39,27 33,30',
            O: '24,20 32,20 33,30 28,33 23,30',
            B: '22,13 34,13 32,20 24,20',
            L: '23,30 28,33 33,30 34,35 22,35',
        },
    },
    molar: {
        outline: 'M12 13 C15 8 41 8 44 13 C47 17 47 30 44 34 C41 38 15 38 12 34 C9 30 9 17 12 13 Z',
        surfaces: {
            M: '12,18 21,20 20,30 12,27',
            D: '35,20 44,18 44,27 36,30',
            O: '21,20 35,20 36,30 28,34 20,30',
            B: '18,12 38,12 35,20 21,20',
            L: '20,30 28,34 36,30 38,36 18,36',
        },
    },
};

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

const getToothFamily = (toothNumber) => {
    const digit = Number(String(toothNumber).slice(-1));
    if (digit <= 2) return 'incisor';
    if (digit === 3) return 'canine';
    if (digit === 4 || digit === 5) return 'premolar';
    return 'molar';
};

const isUpperTooth = (toothNumber) => {
    const quadrant = Number(String(toothNumber)[0]);
    return quadrant === 1 || quadrant === 2;
};

const buildHealthyFinding = (stage = 'existing') => ({
    id: `healthy-${stage}`,
    status: 'healthy',
    statusLabel: STATUS_META.healthy.label,
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

const getHighlightedSurfaces = (statusKey, surfaces) => {
    if (statusKey === 'healthy') return new Set();
    if (WHOLE_TOOTH_STATUSES.has(statusKey)) return new Set(SURFACE_CODES);
    if (surfaces.length > 0) return new Set(surfaces);
    return new Set(SURFACE_CODES);
};

const faceCenterSurface = (viewType) => (viewType === 'front' ? 'B' : 'L');

const viewRowsForTooth = (toothNumber) => (
    isUpperTooth(toothNumber) ? ['front', 'top', 'back'] : ['back', 'top', 'front']
);

const buildDraftMapFromToothData = (toothData) => Object.fromEntries(
    FINDING_STAGE_ORDER.map((stageKey) => {
        const existingFinding = getFindingForStage(toothData.findings, stageKey);
        return [stageKey, existingFinding ? { ...existingFinding } : buildHealthyFinding(stageKey)];
    })
);

function SurfaceButton({
    surfaceCode,
    isActive,
    onToggle,
    editorMode,
    regionClassName,
    children,
}) {
    const className = [
        regionClassName || '',
        isActive ? styles.surfaceRegionActive : '',
        editorMode ? styles.surfaceHitArea : '',
    ].filter(Boolean).join(' ');

    return (
        <g
            className={className}
            onClick={editorMode ? (event) => {
                event.stopPropagation();
                onToggle(surfaceCode);
            } : undefined}
            onKeyDown={editorMode ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    onToggle(surfaceCode);
                }
            } : undefined}
            role={editorMode ? 'button' : undefined}
            tabIndex={editorMode ? 0 : undefined}
        >
            {children}
        </g>
    );
}

function FaceView({
    toothNumber,
    viewType,
    statusKey,
    surfaces,
    stageKey,
    editorMode = false,
    onToggleSurface,
    svgClassName,
}) {
    const familyGeometry = FACE_GEOMETRY[getToothFamily(toothNumber)];
    const meta = getStatusMeta(statusKey);
    const stageMeta = getStageMeta(stageKey);
    const activeSurfaces = getHighlightedSurfaces(statusKey, surfaces);
    const canToggle = editorMode && supportsSurfaceSelection(statusKey);
    const centerSurface = faceCenterSurface(viewType);
    const baseStroke = '#d4dde7';
    const outlineStroke = statusKey === 'healthy' ? '#b8c5d1' : meta.stroke;

    const regionFill = (surfaceCode) => {
        if (!activeSurfaces.has(surfaceCode)) return '#ffffff';
        if (stageKey === 'planned' && statusKey !== 'healthy') return '#fffef8';
        return meta.fill;
    };

    const regionStroke = (surfaceCode) => {
        if (!activeSurfaces.has(surfaceCode)) return baseStroke;
        if (stageKey === 'completed') return stageMeta.accent;
        return meta.stroke;
    };

    const renderOverlay = () => {
        if (statusKey === 'missing' || statusKey === 'extraction-site') {
            return (
                <g stroke={meta.accent} strokeWidth="2.2" strokeLinecap="round" opacity="0.85">
                    <line x1="14" y1="10" x2="42" y2="43" />
                    <line x1="42" y1="10" x2="14" y2="43" />
                </g>
            );
        }

        if (statusKey === 'bridge') {
            return <path d="M13 25 H43" fill="none" stroke={meta.accent} strokeWidth="3" strokeLinecap="round" opacity="0.86" />;
        }

        if (statusKey === 'implant') {
            return (
                <g fill="none" stroke={meta.accent} strokeWidth="2.1" strokeLinecap="round">
                    <path d="M28 27 V54" />
                    <path d="M23 33 H33" />
                    <path d="M24 39 H32" />
                    <path d="M24 45 H32" />
                </g>
            );
        }

        if (statusKey === 'root-canal') {
            return (
                <g fill="none" stroke={meta.accent} strokeWidth="2.1" strokeLinecap="round">
                    <path d="M28 16 V58" />
                    <path d="M24 22 H32" />
                </g>
            );
        }

        if (statusKey === 'fractured') {
            return <path d="M22 12 L32 20 L26 28 L34 38" fill="none" stroke={meta.accent} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />;
        }

        if (statusKey === 'under-observation') {
            return <ellipse cx="28" cy="25" rx="12" ry="15" fill="none" stroke={meta.accent} strokeWidth="1.9" strokeDasharray="3 3" />;
        }

        if (statusKey === 'crown') {
            return <path d="M18 11 H38" fill="none" stroke={meta.accent} strokeWidth="1.9" strokeLinecap="round" opacity="0.7" />;
        }

        return null;
    };

    const renderStageMarker = () => {
        if (stageKey === 'existing') return null;
        if (stageKey === 'planned') {
            return (
                <g>
                    <circle cx="45" cy="10" r="4.7" fill="#ffffff" stroke={stageMeta.accent} strokeWidth="1.8" />
                    <circle cx="45" cy="10" r="1.8" fill={stageMeta.accent} />
                </g>
            );
        }
        if (stageKey === 'completed') {
            return (
                <g>
                    <circle cx="45" cy="10" r="5.1" fill={stageMeta.badgeBg} stroke={stageMeta.accent} strokeWidth="1.5" />
                    <path d="M42 10 L44 12 L48 8" fill="none" stroke={stageMeta.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </g>
            );
        }
        return null;
    };

    return (
        <svg viewBox="0 0 56 76" className={svgClassName} aria-hidden="true">
            <path
                d={familyGeometry.outline}
                fill="#ffffff"
                stroke={outlineStroke}
                strokeWidth="1.7"
                strokeLinejoin="round"
                strokeDasharray={statusKey === 'mobility' ? '3 2' : stageKey === 'planned' ? '2.6 1.6' : undefined}
            />

            <SurfaceButton
                surfaceCode="M"
                isActive={activeSurfaces.has('M')}
                onToggle={onToggleSurface}
                editorMode={canToggle}
                regionClassName={styles.surfaceRegion}
            >
                <polygon points={familyGeometry.surfaces.M} fill={regionFill('M')} stroke={regionStroke('M')} strokeWidth="1.1" />
            </SurfaceButton>

            <SurfaceButton
                surfaceCode={centerSurface}
                isActive={activeSurfaces.has(centerSurface)}
                onToggle={onToggleSurface}
                editorMode={canToggle}
                regionClassName={styles.surfaceRegion}
            >
                <polygon points={familyGeometry.surfaces.C} fill={regionFill(centerSurface)} stroke={regionStroke(centerSurface)} strokeWidth="1.1" />
            </SurfaceButton>

            <SurfaceButton
                surfaceCode="D"
                isActive={activeSurfaces.has('D')}
                onToggle={onToggleSurface}
                editorMode={canToggle}
                regionClassName={styles.surfaceRegion}
            >
                <polygon points={familyGeometry.surfaces.D} fill={regionFill('D')} stroke={regionStroke('D')} strokeWidth="1.1" />
            </SurfaceButton>

            <SurfaceButton
                surfaceCode="O"
                isActive={activeSurfaces.has('O')}
                onToggle={onToggleSurface}
                editorMode={canToggle}
                regionClassName={styles.surfaceRegion}
            >
                <polygon points={familyGeometry.surfaces.O} fill={regionFill('O')} stroke={regionStroke('O')} strokeWidth="1.05" />
            </SurfaceButton>

            {familyGeometry.rootPaths.map((rootPath, index) => (
                <path
                    key={`${toothNumber}-${viewType}-root-${index}`}
                    d={rootPath}
                    fill="none"
                    stroke={stageKey === 'completed' ? stageMeta.accent : outlineStroke}
                    strokeWidth="1.65"
                    strokeLinecap="round"
                    strokeDasharray={stageKey === 'planned' ? '2.6 1.6' : undefined}
                />
            ))}

            {renderOverlay()}
            {renderStageMarker()}
        </svg>
    );
}

function TopView({
    toothNumber,
    statusKey,
    surfaces,
    stageKey,
    editorMode = false,
    onToggleSurface,
    svgClassName,
}) {
    const familyGeometry = TOP_GEOMETRY[getToothFamily(toothNumber)];
    const meta = getStatusMeta(statusKey);
    const stageMeta = getStageMeta(stageKey);
    const activeSurfaces = getHighlightedSurfaces(statusKey, surfaces);
    const canToggle = editorMode && supportsSurfaceSelection(statusKey);
    const outlineStroke = statusKey === 'healthy' ? '#b8c5d1' : meta.stroke;
    const baseStroke = '#d4dde7';

    const upperTooth = isUpperTooth(toothNumber);
    const buccalSurface = upperTooth ? 'B' : 'L';
    const lingualSurface = upperTooth ? 'L' : 'B';

    const regionFill = (surfaceCode) => {
        if (!activeSurfaces.has(surfaceCode)) return '#ffffff';
        if (stageKey === 'planned' && statusKey !== 'healthy') return '#fffef8';
        return meta.fill;
    };

    const regionStroke = (surfaceCode) => {
        if (!activeSurfaces.has(surfaceCode)) return baseStroke;
        if (stageKey === 'completed') return stageMeta.accent;
        return meta.stroke;
    };

    const renderOverlay = () => {
        if (statusKey === 'missing' || statusKey === 'extraction-site') {
            return (
                <g stroke={meta.accent} strokeWidth="2.1" strokeLinecap="round" opacity="0.84">
                    <line x1="13" y1="11" x2="43" y2="34" />
                    <line x1="43" y1="11" x2="13" y2="34" />
                </g>
            );
        }

        if (statusKey === 'bridge') {
            return <path d="M12 23 H44" fill="none" stroke={meta.accent} strokeWidth="2.8" strokeLinecap="round" opacity="0.86" />;
        }

        if (statusKey === 'implant') {
            return (
                <g fill="none" stroke={meta.accent} strokeWidth="1.9">
                    <circle cx="28" cy="23" r="8" />
                    <path d="M28 15 V31" />
                    <path d="M20 23 H36" />
                </g>
            );
        }

        if (statusKey === 'root-canal') {
            return <circle cx="28" cy="23" r="7" fill="none" stroke={meta.accent} strokeWidth="2.1" />;
        }

        if (statusKey === 'fractured') {
            return <path d="M22 12 L32 20 L26 26 L36 33" fill="none" stroke={meta.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;
        }

        if (statusKey === 'under-observation') {
            return <ellipse cx="28" cy="23" rx="13" ry="11" fill="none" stroke={meta.accent} strokeWidth="1.9" strokeDasharray="3 3" />;
        }

        return null;
    };

    const renderStageMarker = () => {
        if (stageKey === 'existing') return null;
        if (stageKey === 'planned') {
            return (
                <g>
                    <circle cx="45" cy="10" r="4.7" fill="#ffffff" stroke={stageMeta.accent} strokeWidth="1.8" />
                    <circle cx="45" cy="10" r="1.8" fill={stageMeta.accent} />
                </g>
            );
        }
        if (stageKey === 'completed') {
            return (
                <g>
                    <circle cx="45" cy="10" r="5.1" fill={stageMeta.badgeBg} stroke={stageMeta.accent} strokeWidth="1.5" />
                    <path d="M42 10 L44 12 L48 8" fill="none" stroke={stageMeta.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </g>
            );
        }
        return null;
    };

    return (
        <svg viewBox="0 0 56 44" className={svgClassName} aria-hidden="true">
            <path
                d={familyGeometry.outline}
                fill="#ffffff"
                stroke={outlineStroke}
                strokeWidth="1.7"
                strokeLinejoin="round"
                strokeDasharray={statusKey === 'mobility' ? '3 2' : stageKey === 'planned' ? '2.6 1.6' : undefined}
            />

            <SurfaceButton
                surfaceCode="M"
                isActive={activeSurfaces.has('M')}
                onToggle={onToggleSurface}
                editorMode={canToggle}
                regionClassName={styles.surfaceRegion}
            >
                <polygon points={familyGeometry.surfaces.M} fill={regionFill('M')} stroke={regionStroke('M')} strokeWidth="1.1" />
            </SurfaceButton>

            <SurfaceButton
                surfaceCode="D"
                isActive={activeSurfaces.has('D')}
                onToggle={onToggleSurface}
                editorMode={canToggle}
                regionClassName={styles.surfaceRegion}
            >
                <polygon points={familyGeometry.surfaces.D} fill={regionFill('D')} stroke={regionStroke('D')} strokeWidth="1.1" />
            </SurfaceButton>

            <SurfaceButton
                surfaceCode="O"
                isActive={activeSurfaces.has('O')}
                onToggle={onToggleSurface}
                editorMode={canToggle}
                regionClassName={styles.surfaceRegion}
            >
                <polygon points={familyGeometry.surfaces.O} fill={regionFill('O')} stroke={regionStroke('O')} strokeWidth="1.1" />
            </SurfaceButton>

            <SurfaceButton
                surfaceCode={buccalSurface}
                isActive={activeSurfaces.has(buccalSurface)}
                onToggle={onToggleSurface}
                editorMode={canToggle}
                regionClassName={styles.surfaceRegion}
            >
                <polygon points={familyGeometry.surfaces.B} fill={regionFill(buccalSurface)} stroke={regionStroke(buccalSurface)} strokeWidth="1.1" />
            </SurfaceButton>

            <SurfaceButton
                surfaceCode={lingualSurface}
                isActive={activeSurfaces.has(lingualSurface)}
                onToggle={onToggleSurface}
                editorMode={canToggle}
                regionClassName={styles.surfaceRegion}
            >
                <polygon points={familyGeometry.surfaces.L} fill={regionFill(lingualSurface)} stroke={regionStroke(lingualSurface)} strokeWidth="1.1" />
            </SurfaceButton>

            {renderOverlay()}
            {renderStageMarker()}
        </svg>
    );
}

function MiniView({
    toothNumber,
    viewType,
    statusKey,
    surfaces,
    stageKey,
    editorMode = false,
    onToggleSurface,
    sizeClassName,
}) {
    if (viewType === 'top') {
        return (
            <TopView
                toothNumber={toothNumber}
                statusKey={statusKey}
                surfaces={surfaces}
                stageKey={stageKey}
                editorMode={editorMode}
                onToggleSurface={onToggleSurface}
                svgClassName={sizeClassName}
            />
        );
    }

    return (
        <FaceView
            toothNumber={toothNumber}
            viewType={viewType}
            statusKey={statusKey}
            surfaces={surfaces}
            stageKey={stageKey}
            editorMode={editorMode}
            onToggleSurface={onToggleSurface}
            svgClassName={sizeClassName}
        />
    );
}

function ArchNumberRow({ quadrants, getDisplayToothData, numberPosition }) {
    return (
        <div className={`${styles.numberRow} ${numberPosition === 'bottom' ? styles.numberRowBottom : ''}`.trim()}>
            <div className={styles.rowLabelSpacer}></div>
            <div className={styles.rowTrack}>
                <div className={styles.teethHalf}>
                    {quadrants[0].map((toothNumber) => {
                        const toothData = getDisplayToothData(toothNumber);
                        const meta = getStatusMeta(toothData.status);
                        return (
                            <span
                                key={`num-${toothNumber}`}
                                className={styles.toothNumberTag}
                                style={{ color: toothData.status === 'healthy' ? '#94a3b8' : meta.accent }}
                            >
                                {toothNumber}
                            </span>
                        );
                    })}
                </div>
                <div className={styles.midlineDivider}></div>
                <div className={styles.teethHalf}>
                    {quadrants[1].map((toothNumber) => {
                        const toothData = getDisplayToothData(toothNumber);
                        const meta = getStatusMeta(toothData.status);
                        return (
                            <span
                                key={`num-${toothNumber}`}
                                className={styles.toothNumberTag}
                                style={{ color: toothData.status === 'healthy' ? '#94a3b8' : meta.accent }}
                            >
                                {toothNumber}
                            </span>
                        );
                    })}
                </div>
            </div>
            <div className={styles.rowLabelSpacer}></div>
        </div>
    );
}

function ArchViewRow({
    label,
    viewType,
    quadrants,
    getDisplayToothData,
    readOnly,
    documentMode,
    onSelect,
}) {
    return (
        <div className={styles.viewRow}>
            <span className={styles.viewLabel}>{label}</span>
            <div className={styles.rowTrack}>
                <div className={styles.teethHalf}>
                    {quadrants[0].map((toothNumber) => {
                        const toothData = getDisplayToothData(toothNumber);
                        const stageMeta = getStageMeta(toothData.stage);
                        return (
                            <button
                                key={`${viewType}-${toothNumber}`}
                                type="button"
                                className={`${styles.viewCellButton} ${readOnly ? styles.viewCellButtonReadOnly : ''}`.trim()}
                                onClick={() => !readOnly && onSelect(toothNumber)}
                                title={`Tooth ${toothNumber} - ${toothData.statusLabel} (${stageMeta.label})${toothData.surfaces.length ? ` - ${toothData.surfaces.join(', ')}` : ''}`}
                                aria-label={`Open tooth ${toothNumber}`}
                            >
                                <MiniView
                                    toothNumber={toothNumber}
                                    viewType={viewType}
                                    statusKey={toothData.status}
                                    surfaces={toothData.surfaces}
                                    stageKey={toothData.stage}
                                    sizeClassName={`${styles.miniViewSvg} ${documentMode ? styles.miniViewSvgDocument : ''}`.trim()}
                                />
                            </button>
                        );
                    })}
                </div>
                <div className={styles.midlineDivider}></div>
                <div className={styles.teethHalf}>
                    {quadrants[1].map((toothNumber) => {
                        const toothData = getDisplayToothData(toothNumber);
                        const stageMeta = getStageMeta(toothData.stage);
                        return (
                            <button
                                key={`${viewType}-${toothNumber}`}
                                type="button"
                                className={`${styles.viewCellButton} ${readOnly ? styles.viewCellButtonReadOnly : ''}`.trim()}
                                onClick={() => !readOnly && onSelect(toothNumber)}
                                title={`Tooth ${toothNumber} - ${toothData.statusLabel} (${stageMeta.label})${toothData.surfaces.length ? ` - ${toothData.surfaces.join(', ')}` : ''}`}
                                aria-label={`Open tooth ${toothNumber}`}
                            >
                                <MiniView
                                    toothNumber={toothNumber}
                                    viewType={viewType}
                                    statusKey={toothData.status}
                                    surfaces={toothData.surfaces}
                                    stageKey={toothData.stage}
                                    sizeClassName={`${styles.miniViewSvg} ${documentMode ? styles.miniViewSvgDocument : ''}`.trim()}
                                />
                            </button>
                        );
                    })}
                </div>
            </div>
            <span className={styles.viewLabel}>{label}</span>
        </div>
    );
}

function ArchChart({
    layout,
    getDisplayToothData,
    readOnly,
    documentMode,
    onSelect,
}) {
    return (
        <section className={styles.archCard}>
            <div className={styles.archCardHeader}>
                <div>
                    <h4 className={styles.archCardTitle}>{layout.title}</h4>
                    <p className={styles.archCardSubtitle}>{layout.subtitle}</p>
                </div>
                <span className={styles.archNotation}>FDI notation</span>
            </div>

            <div className={styles.archGrid}>
                {layout.numberPosition === 'top' && (
                    <ArchNumberRow quadrants={layout.quadrants} getDisplayToothData={getDisplayToothData} numberPosition="top" />
                )}

                {layout.rows.map((viewType) => (
                    <ArchViewRow
                        key={`${layout.id}-${viewType}`}
                        label={VIEW_LABELS[viewType]}
                        viewType={viewType}
                        quadrants={layout.quadrants}
                        getDisplayToothData={getDisplayToothData}
                        readOnly={readOnly}
                        documentMode={documentMode}
                        onSelect={onSelect}
                    />
                ))}

                {layout.numberPosition === 'bottom' && (
                    <ArchNumberRow quadrants={layout.quadrants} getDisplayToothData={getDisplayToothData} numberPosition="bottom" />
                )}
            </div>
        </section>
    );
}

export default function Odontogram({ patientId, readOnly = false, documentMode = false }) {
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
        [...UPPER_RIGHT, ...UPPER_LEFT, ...LOWER_RIGHT, ...LOWER_LEFT].forEach((toothNumber) => {
            const toothData = buildDisplayToothData(getToothData(toothNumber), filterKey);
            if (toothData.status !== 'healthy') count += 1;
        });
        return count;
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

            addToast(`Tooth ${selectedTooth} updated successfully.`, 'success');
            setSelectedTooth(null);
        } catch (error) {
            addToast(error.message || 'Failed to save the odontogram.', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const currentDraft = draftByStage[tempStage] || buildHealthyFinding(tempStage);
    const selectedStatusMeta = getStatusMeta(currentDraft.status);
    const selectedStageMeta = getStageMeta(tempStage);
    const previewRows = selectedTooth ? viewRowsForTooth(selectedTooth) : [];

    return (
        <div className={`${styles.odontogramWrapper} ${readOnly ? styles.readOnlyChart : ''} ${documentMode ? styles.documentMode : ''}`.trim()}>
            <div className={styles.chartShell}>
                <div className={styles.chartHeader}>
                    <div>
                        <p className={styles.chartEyebrow}>Odontogram</p>
                        <h3 className={styles.chartTitle}>Clinical 2D Odontogram</h3>
                        <p className={styles.chartSubtitle}>
                            Adult FDI chart with separate front, top, and back views to match a software-style clinical odontogram.
                        </p>
                    </div>
                    <div className={styles.modeChipRow}>
                        <span className={styles.modeChip}>Permanent dentition</span>
                        <span className={styles.modeChip}>{readOnly ? 'Read only' : 'Editable'}</span>
                    </div>
                </div>

                <div className={styles.filterRow}>
                    <span className={styles.filterLabel}>View findings</span>
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
                </div>

                <div className={styles.archStack}>
                    {ARCH_LAYOUTS.map((layout) => (
                        <ArchChart
                            key={layout.id}
                            layout={layout}
                            getDisplayToothData={getDisplayToothData}
                            readOnly={readOnly}
                            documentMode={documentMode}
                            onSelect={openToothModal}
                        />
                    ))}
                </div>

                <div className={styles.legendSection}>
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

                    <div className={styles.legendSurfaceMap}>
                        {SURFACE_CODES.map((surfaceCode) => (
                            <div key={surfaceCode} className={styles.surfaceKeyCard}>
                                <span className={styles.surfaceKeyBadge}>{surfaceCode}</span>
                                <span className={styles.surfaceKeyText}>{SURFACE_LABELS[surfaceCode]}</span>
                            </div>
                        ))}
                    </div>

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
                </div>
            </div>

            {!readOnly && selectedTooth && (
                <div className={styles.modalOverlay}>
                    <div className={styles.overlayBackground} onClick={() => setSelectedTooth(null)}></div>

                    <div className={styles.miniModalCard}>
                        <div className={styles.modalHeader}>
                            <div>
                                <p className={styles.modalEyebrow}>Tooth {selectedTooth}</p>
                                <h3 className={styles.modalTitle}>Update odontogram entry</h3>
                                <p className={styles.modalSubtitle}>
                                    Edit separate existing, planned, and completed findings while keeping the same tooth diagram used on the main chart.
                                </p>
                            </div>
                            <button type="button" className={styles.modalCloseBtn} onClick={() => setSelectedTooth(null)} aria-label="Close modal">
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
                                    {selectedStatusMeta.label}
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
                                    {previewRows.map((viewType) => (
                                        <div key={`preview-${viewType}`} className={styles.previewRow}>
                                            <span className={styles.previewRowLabel}>{VIEW_LABELS[viewType]}</span>
                                            <MiniView
                                                toothNumber={selectedTooth}
                                                viewType={viewType}
                                                statusKey={currentDraft.status}
                                                surfaces={currentDraft.surfaces}
                                                stageKey={tempStage}
                                                editorMode
                                                onToggleSurface={toggleSurface}
                                                sizeClassName={styles.previewSvg}
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className={styles.previewSummary}>
                                    <div>
                                        <span className={styles.previewSummaryLabel}>Finding</span>
                                        <strong>{selectedStatusMeta.label}</strong>
                                    </div>
                                    <div>
                                        <span className={styles.previewSummaryLabel}>Surface selection</span>
                                        <strong>{currentDraft.surfaces.length > 0 ? currentDraft.surfaces.join(', ') : 'Whole tooth / none selected'}</strong>
                                    </div>
                                </div>

                                <p className={styles.previewHint}>
                                    Click the preview surfaces directly for localized findings, or use the surface buttons on the right.
                                </p>
                            </div>

                            <div className={styles.editorPanel}>
                                <div className={styles.findingStageList}>
                                    {FINDING_STAGE_ORDER.map((stageKey) => {
                                        const draft = draftByStage[stageKey] || buildHealthyFinding(stageKey);
                                        const stageMeta = getStageMeta(stageKey);
                                        const draftStatusMeta = getStatusMeta(draft.status);
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
                                                <strong style={{ color: draftStatusMeta.badgeText }}>{draftStatusMeta.label}</strong>
                                                <span>{draft.status === 'healthy' ? 'No finding recorded for this stage.' : stageMeta.description}</span>
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

                                    <div className={styles.surfaceGrid}>
                                        {SURFACE_CODES.map((surfaceCode) => (
                                            <button
                                                key={surfaceCode}
                                                type="button"
                                                className={`${styles.surfaceBtn} ${currentDraft.surfaces.includes(surfaceCode) ? styles.surfaceBtnActive : ''}`.trim()}
                                                onClick={() => toggleSurface(surfaceCode)}
                                                disabled={!supportsSurfaceSelection(currentDraft.status)}
                                            >
                                                <span className={styles.surfaceKey}>{surfaceCode}</span>
                                                <span className={styles.surfaceLabel}>{SURFACE_LABELS[surfaceCode]}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={styles.modalButtonGroup}>
                            <button type="button" className={styles.cancelBtn} onClick={() => setSelectedTooth(null)} disabled={isSaving}>
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
