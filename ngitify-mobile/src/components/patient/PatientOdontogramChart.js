import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { mobileTheme } from '../../theme/mobileTheme';

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
    },
    planned: {
        key: 'planned',
        label: 'Planned',
        accent: '#f97316',
        badgeBg: '#fff7ed',
        badgeText: '#9a3412',
        border: '#fdba74',
    },
    completed: {
        key: 'completed',
        label: 'Completed',
        accent: '#16a34a',
        badgeBg: '#ecfdf5',
        badgeText: '#166534',
        border: '#86efac',
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

const LEGEND_KEYS = [
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
];

const WHOLE_TOOTH_STATUSES = new Set(['crown', 'implant', 'bridge', 'extraction-site', 'missing', 'mobility', 'root-canal']);

const STAGE_FILTER_OPTIONS = [
    { key: 'all', label: 'All' },
    ...FINDING_STAGE_ORDER.map((stageKey) => ({
        key: stageKey,
        label: FINDING_STAGE_META[stageKey].label,
    })),
];

const FACE_DIAGRAM_GEOMETRY = {
    incisor: {
        outline: 'M23 7 C25 5 31 5 33 7 L36 12 C38 15 38 20 37 25 L35 36 C34 41 31 48 28 53 C25 48 22 41 21 36 L19 25 C18 20 18 15 20 12 Z',
        surfaces: {
            M: 'M20 13 C21 11 23 10 24 10 C24 19 24 38 23 45 C21 43 20 37 19 31 C18 25 18 17 20 13 Z',
            C: 'M24 10 C26 9 30 9 32 10 C32 20 32 37 31 45 C30 41 29 35 28 29 C28 21 28 15 24 10 Z',
            D: 'M32 10 C33 10 36 12 37 13 C38 17 38 25 37 31 C36 37 35 43 33 45 C32 37 32 19 32 10 Z',
            O: 'M24 7 C26 6 30 6 32 7 C31 10 31 12 31 14 C28 13 26 13 24 14 C24 11 23 9 24 7 Z',
        },
        rootPaths: ['M28 52 C27 60 26 67 28 72'],
    },
    canine: {
        outline: 'M25 7 L28 5 L31 7 L35 14 C37 17 37 22 36 27 L33 39 C32 43 30 49 28 55 C26 49 24 43 23 39 L20 27 C19 22 19 17 21 14 Z',
        surfaces: {
            M: 'M21 14 C23 11 25 10 26 10 C26 19 26 38 25 46 C23 43 21 37 20 30 C19 24 19 17 21 14 Z',
            C: 'M26 10 C27 9 29 8 30 9 C31 18 31 37 30 46 C29 41 28 35 28 28 C28 20 28 14 26 10 Z',
            D: 'M30 9 C32 10 34 12 36 14 C37 17 37 24 36 30 C35 37 33 43 31 46 C30 37 30 18 30 9 Z',
            O: 'M25 7 C26 6 30 6 31 7 C31 10 31 12 31 14 C29 14 27 14 25 14 C25 11 24 9 25 7 Z',
        },
        rootPaths: ['M28 54 C28 62 27 70 28 74'],
    },
    premolar: {
        outline: 'M19 9 C22 6 34 6 37 9 L40 16 C41 20 41 25 39 30 L36 40 C34 46 31 52 28 56 C25 52 22 46 20 40 L17 30 C15 25 15 20 16 16 Z',
        surfaces: {
            M: 'M17 15 C20 12 22 11 23 11 C23 20 23 39 22 46 C20 43 18 37 17 30 C16 24 16 18 17 15 Z',
            C: 'M23 11 C26 10 30 10 33 11 C33 20 33 38 32 46 C31 41 30 35 28 29 C28 21 28 15 23 11 Z',
            D: 'M33 11 C35 11 38 13 40 15 C41 18 41 24 40 30 C39 37 37 43 35 46 C34 38 34 20 33 11 Z',
            O: 'M23 9 C25 8 31 8 33 9 C32 12 32 15 32 17 C29 16 27 16 24 17 C24 14 23 11 23 9 Z',
        },
        rootPaths: ['M24 55 C23 61 22 67 23 71', 'M32 55 C33 61 34 67 33 71'],
    },
    molar: {
        outline: 'M16 11 C20 7 36 7 40 11 L44 18 C46 22 46 28 44 33 L40 42 C38 48 34 54 28 58 C22 54 18 48 16 42 L12 33 C10 28 10 22 12 18 Z',
        surfaces: {
            M: 'M12 18 C15 15 18 14 21 14 C21 24 21 40 20 47 C17 43 15 37 13 31 C12 26 12 21 12 18 Z',
            C: 'M21 14 C24 13 32 13 35 14 C36 23 36 40 35 47 C33 42 31 36 28 30 C28 24 28 19 21 14 Z',
            D: 'M35 14 C38 14 41 16 44 18 C44 21 44 26 43 31 C41 37 39 43 36 47 C35 40 35 24 35 14 Z',
            O: 'M21 11 C24 10 32 10 35 11 C34 14 34 16 34 19 C31 18 29 18 28 18 C26 18 24 18 21 19 C21 16 20 13 21 11 Z',
        },
        rootPaths: ['M23 57 C20 63 18 69 19 73', 'M33 57 C36 63 38 69 37 73'],
    },
};

const TOP_DIAGRAM_GEOMETRY = {
    incisor: {
        outline: 'M18 13 C21 8 35 8 38 13 C40 17 40 27 38 31 C35 35 21 35 18 31 C16 27 16 17 18 13 Z',
        surfaces: {
            M: 'M18 16 C21 15 23 16 24 18 L24 28 C22 27 20 27 18 27 C16 24 16 19 18 16 Z',
            D: 'M32 18 C33 16 35 15 38 16 C40 19 40 24 38 27 C36 27 34 27 32 28 L32 18 Z',
            O: 'M24 18 C26 17 30 17 32 18 L32 28 C29 28 27 28 24 28 Z',
            B: 'M21 12 C24 11 32 11 35 12 C34 14 33 16 32 18 C29 17 27 17 24 18 C23 15 22 13 21 12 Z',
            L: 'M24 28 C27 28 29 28 32 28 C34 30 35 32 35 34 C32 34 24 34 21 34 C22 32 23 30 24 28 Z',
        },
    },
    canine: {
        outline: 'M26 8 L30 8 L37 16 L34 31 L22 31 L19 16 Z',
        surfaces: {
            M: 'M20 16 C22 14 24 15 25 18 L25 28 C22 27 20 26 20 24 C19 21 19 18 20 16 Z',
            D: 'M31 18 C33 15 35 15 36 16 C36 19 36 24 35 27 C33 28 32 28 31 28 L31 18 Z',
            O: 'M25 18 C27 17 29 17 31 18 L31 28 C29 28 27 28 25 28 Z',
            B: 'M24 11 C26 10 30 10 32 11 C32 13 31 16 31 18 C28 17 27 17 25 18 C25 15 24 13 24 11 Z',
            L: 'M25 28 C27 28 29 28 31 28 C32 30 32 31 32 31 C29 31 25 31 24 31 C24 30 24 29 25 28 Z',
        },
    },
    premolar: {
        outline: 'M17 14 C20 9 36 9 39 14 C41 18 40 29 36 33 C32 37 24 37 20 33 C16 29 15 18 17 14 Z',
        surfaces: {
            M: 'M17 18 C20 16 22 17 24 20 L23 30 C20 28 18 27 17 27 C16 24 16 21 17 18 Z',
            D: 'M32 20 C35 17 37 17 39 18 C39 22 39 26 39 27 C36 29 34 30 33 30 L32 20 Z',
            O: 'M24 20 C27 19 29 19 32 20 L33 30 C31 33 30 33 28 33 C26 33 25 32 23 30 Z',
            B: 'M22 13 C25 12 31 12 34 13 C33 16 32 18 32 20 C29 19 27 19 24 20 C23 17 22 15 22 13 Z',
            L: 'M23 30 C26 31 28 32 33 30 C34 32 34 34 34 35 C30 35 26 35 22 35 C22 33 22 31 23 30 Z',
        },
    },
    molar: {
        outline: 'M12 13 C15 8 41 8 44 13 C47 17 47 30 44 34 C41 38 15 38 12 34 C9 30 9 17 12 13 Z',
        surfaces: {
            M: 'M12 18 C15 15 18 15 21 20 L20 30 C17 29 14 28 12 27 C11 24 11 21 12 18 Z',
            D: 'M35 20 C38 16 41 16 44 18 C44 22 44 26 44 27 C41 29 38 30 36 30 L35 20 Z',
            O: 'M21 20 C24 19 30 19 35 20 L36 30 C34 34 31 34 28 34 C25 34 22 33 20 30 Z',
            B: 'M18 12 C22 11 34 11 38 12 C37 14 36 17 35 20 C31 19 25 19 21 20 C20 17 19 14 18 12 Z',
            L: 'M20 30 C23 31 25 33 28 34 C31 33 33 31 36 30 C37 32 38 34 38 36 C33 36 23 36 18 36 C18 34 19 32 20 30 Z',
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

const getHighlightedSurfaces = (statusKey, surfaces) => {
    if (statusKey === 'healthy') return new Set();
    if (WHOLE_TOOTH_STATUSES.has(statusKey)) return new Set(SURFACE_CODES);
    if (surfaces.length > 0) return new Set(surfaces);
    return new Set(SURFACE_CODES);
};

const faceCenterSurface = (viewType) => (viewType === 'front' ? 'B' : 'L');

function FaceView({ toothNumber, viewType, statusKey, surfaces, stageKey, sizeStyle }) {
    const familyGeometry = FACE_DIAGRAM_GEOMETRY[getToothFamily(toothNumber)];
    const meta = getStatusMeta(statusKey);
    const stageMeta = getStageMeta(stageKey);
    const activeSurfaces = getHighlightedSurfaces(statusKey, surfaces);
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

    return (
        <Svg viewBox="0 0 56 76" style={sizeStyle}>
            <Path
                d={familyGeometry.outline}
                fill="#fffdf8"
                stroke={outlineStroke}
                strokeWidth={1.6}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={statusKey === 'mobility' ? '3 2' : stageKey === 'planned' ? '2.4 1.8' : undefined}
            />
            <Path d={familyGeometry.surfaces.M} fill={regionFill('M')} stroke={regionStroke('M')} strokeWidth={1.05} />
            <Path d={familyGeometry.surfaces.C} fill={regionFill(centerSurface)} stroke={regionStroke(centerSurface)} strokeWidth={1.05} />
            <Path d={familyGeometry.surfaces.D} fill={regionFill('D')} stroke={regionStroke('D')} strokeWidth={1.05} />
            <Path d={familyGeometry.surfaces.O} fill={regionFill('O')} stroke={regionStroke('O')} strokeWidth={0.95} />
            <Path d="M24 18 C26 17 30 17 32 18" fill="none" stroke="#d8e1ea" strokeWidth={0.9} strokeLinecap="round" />
            <Path d="M28 18 C28 26 28 35 28 52" fill="none" stroke="#d8e1ea" strokeWidth={0.9} strokeLinecap="round" />
            <Path d="M23 27 C25 28 26 30 27 35" fill="none" stroke="#e1e8ef" strokeWidth={0.8} strokeLinecap="round" />
            <Path d="M33 27 C31 28 30 30 29 35" fill="none" stroke="#e1e8ef" strokeWidth={0.8} strokeLinecap="round" />
            {familyGeometry.rootPaths.map((rootPath, index) => (
                <Path
                    key={`${toothNumber}-${viewType}-root-${index}`}
                    d={rootPath}
                    fill="none"
                    stroke={stageKey === 'completed' ? stageMeta.accent : outlineStroke}
                    strokeWidth={1.65}
                    strokeLinecap="round"
                    strokeDasharray={stageKey === 'planned' ? '2.6 1.6' : undefined}
                />
            ))}
            {statusKey === 'missing' || statusKey === 'extraction-site' ? (
                <G stroke={meta.accent} strokeWidth={2.2} strokeLinecap="round" opacity={0.85}>
                    <Line x1="14" y1="10" x2="42" y2="43" />
                    <Line x1="42" y1="10" x2="14" y2="43" />
                </G>
            ) : null}
            {statusKey === 'bridge' ? (
                <Path d="M13 25 H43" fill="none" stroke={meta.accent} strokeWidth={3} strokeLinecap="round" opacity={0.86} />
            ) : null}
            {statusKey === 'implant' ? (
                <G fill="none" stroke={meta.accent} strokeWidth={2.1} strokeLinecap="round">
                    <Path d="M28 27 V54" />
                    <Path d="M23 33 H33" />
                    <Path d="M24 39 H32" />
                    <Path d="M24 45 H32" />
                </G>
            ) : null}
            {statusKey === 'root-canal' ? (
                <G fill="none" stroke={meta.accent} strokeWidth={2.1} strokeLinecap="round">
                    <Path d="M28 16 V58" />
                    <Path d="M24 22 H32" />
                </G>
            ) : null}
            {statusKey === 'fractured' ? (
                <Path d="M22 12 L32 20 L26 28 L34 38" fill="none" stroke={meta.accent} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
            ) : null}
            {statusKey === 'under-observation' ? (
                <Ellipse cx="28" cy="25" rx="12" ry="15" fill="none" stroke={meta.accent} strokeWidth={1.9} strokeDasharray="3 3" />
            ) : null}
            {statusKey === 'crown' ? (
                <Path d="M18 11 H38" fill="none" stroke={meta.accent} strokeWidth={1.9} strokeLinecap="round" opacity={0.7} />
            ) : null}
            {stageKey === 'planned' ? (
                <G>
                    <Circle cx="45" cy="10" r="4.7" fill="#ffffff" stroke={stageMeta.accent} strokeWidth={1.8} />
                    <Circle cx="45" cy="10" r="1.8" fill={stageMeta.accent} />
                </G>
            ) : null}
            {stageKey === 'completed' ? (
                <G>
                    <Circle cx="45" cy="10" r="5.1" fill={stageMeta.badgeBg} stroke={stageMeta.accent} strokeWidth={1.5} />
                    <Path d="M42 10 L44 12 L48 8" fill="none" stroke={stageMeta.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </G>
            ) : null}
        </Svg>
    );
}

function TopView({ toothNumber, statusKey, surfaces, stageKey, sizeStyle }) {
    const familyGeometry = TOP_DIAGRAM_GEOMETRY[getToothFamily(toothNumber)];
    const meta = getStatusMeta(statusKey);
    const stageMeta = getStageMeta(stageKey);
    const activeSurfaces = getHighlightedSurfaces(statusKey, surfaces);
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

    return (
        <Svg viewBox="0 0 56 44" style={sizeStyle}>
            <Path
                d={familyGeometry.outline}
                fill="#fffdf8"
                stroke={outlineStroke}
                strokeWidth={1.6}
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={statusKey === 'mobility' ? '3 2' : stageKey === 'planned' ? '2.4 1.8' : undefined}
            />
            <Path d={familyGeometry.surfaces.M} fill={regionFill('M')} stroke={regionStroke('M')} strokeWidth={1.05} />
            <Path d={familyGeometry.surfaces.D} fill={regionFill('D')} stroke={regionStroke('D')} strokeWidth={1.05} />
            <Path d={familyGeometry.surfaces.O} fill={regionFill('O')} stroke={regionStroke('O')} strokeWidth={1.05} />
            <Path d={familyGeometry.surfaces.B} fill={regionFill(buccalSurface)} stroke={regionStroke(buccalSurface)} strokeWidth={1.05} />
            <Path d={familyGeometry.surfaces.L} fill={regionFill(lingualSurface)} stroke={regionStroke(lingualSurface)} strokeWidth={1.05} />
            <Path d="M24 18 C26 17 30 17 32 18" fill="none" stroke="#d8e1ea" strokeWidth={0.9} strokeLinecap="round" />
            <Path d="M28 18 C28 22 28 26 28 28" fill="none" stroke="#d8e1ea" strokeWidth={0.9} strokeLinecap="round" />
            <Path d="M23 23 C25 22 26 21 28 21 C30 21 31 22 33 23" fill="none" stroke="#e1e8ef" strokeWidth={0.8} strokeLinecap="round" />
            {statusKey === 'missing' || statusKey === 'extraction-site' ? (
                <G stroke={meta.accent} strokeWidth={2.1} strokeLinecap="round" opacity={0.84}>
                    <Line x1="13" y1="11" x2="43" y2="34" />
                    <Line x1="43" y1="11" x2="13" y2="34" />
                </G>
            ) : null}
            {statusKey === 'bridge' ? (
                <Path d="M12 23 H44" fill="none" stroke={meta.accent} strokeWidth={2.8} strokeLinecap="round" opacity={0.86} />
            ) : null}
            {statusKey === 'implant' ? (
                <G fill="none" stroke={meta.accent} strokeWidth={1.9}>
                    <Circle cx="28" cy="23" r="8" />
                    <Path d="M28 15 V31" />
                    <Path d="M20 23 H36" />
                </G>
            ) : null}
            {statusKey === 'root-canal' ? (
                <Circle cx="28" cy="23" r="7" fill="none" stroke={meta.accent} strokeWidth={2.1} />
            ) : null}
            {statusKey === 'fractured' ? (
                <Path d="M22 12 L32 20 L26 26 L36 33" fill="none" stroke={meta.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            ) : null}
            {statusKey === 'under-observation' ? (
                <Ellipse cx="28" cy="23" rx="13" ry="11" fill="none" stroke={meta.accent} strokeWidth={1.9} strokeDasharray="3 3" />
            ) : null}
            {stageKey === 'planned' ? (
                <G>
                    <Circle cx="45" cy="10" r="4.7" fill="#ffffff" stroke={stageMeta.accent} strokeWidth={1.8} />
                    <Circle cx="45" cy="10" r="1.8" fill={stageMeta.accent} />
                </G>
            ) : null}
            {stageKey === 'completed' ? (
                <G>
                    <Circle cx="45" cy="10" r="5.1" fill={stageMeta.badgeBg} stroke={stageMeta.accent} strokeWidth={1.5} />
                    <Path d="M42 10 L44 12 L48 8" fill="none" stroke={stageMeta.accent} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </G>
            ) : null}
        </Svg>
    );
}

const getWebsiteToothTransform = (toothNumber) => {
    const quadrant = Math.floor(toothNumber / 10);
    const transforms = [];

    if (quadrant === 2 || quadrant === 3) {
        transforms.push({ scaleX: -1 });
    }

    if (isUpperTooth(toothNumber)) {
        transforms.push({ scaleY: -1 });
    }

    return transforms;
};

function WebsiteToothCell({ toothNumber, toothData, selected, onSelectTooth }) {
    const upper = isUpperTooth(toothNumber);
    const meta = getStatusMeta(toothData.status);
    const lateralStyle = [
        styles.websiteLateralView,
        { transform: getWebsiteToothTransform(toothNumber) },
    ];
    const toothTitle = `Tooth ${toothNumber} - ${toothData.statusLabel}`;

    const lateralView = (
        <FaceView
            toothNumber={toothNumber}
            viewType="front"
            statusKey={toothData.status}
            surfaces={toothData.surfaces}
            stageKey={toothData.stage}
            sizeStyle={lateralStyle}
        />
    );
    const topView = (
        <TopView
            toothNumber={toothNumber}
            statusKey={toothData.status}
            surfaces={toothData.surfaces}
            stageKey={toothData.stage}
            sizeStyle={styles.websiteOcclusalView}
        />
    );
    const number = (
        <Text
            style={[
                styles.websiteToothNumber,
                { color: toothData.status === 'healthy' ? '#334155' : meta.accent },
            ]}
        >
            {toothNumber}
        </Text>
    );

    return (
        <TouchableOpacity
            style={[
                styles.websiteToothCell,
                toothData.status !== 'healthy' && styles.websiteToothAffected,
                selected && styles.websiteToothSelected,
                (toothNumber === 18 || toothNumber === 48) && styles.websiteDistalStart,
            ]}
            activeOpacity={0.82}
            onPress={() => onSelectTooth(toothNumber)}
            accessibilityRole="button"
            accessibilityLabel={toothTitle}
        >
            {upper ? (
                <>
                    {lateralView}
                    {topView}
                    {number}
                </>
            ) : (
                <>
                    {number}
                    {topView}
                    {lateralView}
                </>
            )}
        </TouchableOpacity>
    );
}

function WebsiteQuadrant({ teeth, getDisplayToothData, selectedTooth, onSelectTooth }) {
    return (
        <View style={styles.websiteQuadrant}>
            {teeth.map((toothNumber) => (
                <WebsiteToothCell
                    key={toothNumber}
                    toothNumber={toothNumber}
                    toothData={getDisplayToothData(toothNumber)}
                    selected={selectedTooth === toothNumber}
                    onSelectTooth={onSelectTooth}
                />
            ))}
        </View>
    );
}

function WebsiteArchRow({ leftLabel, rightLabel, leftTeeth, rightTeeth, getDisplayToothData, selectedTooth, onSelectTooth }) {
    return (
        <View style={styles.websiteArchRow}>
            <Text style={[styles.websiteArchLabel, styles.websiteArchLabelLeft]}>{leftLabel}</Text>
            <WebsiteQuadrant
                teeth={leftTeeth}
                getDisplayToothData={getDisplayToothData}
                selectedTooth={selectedTooth}
                onSelectTooth={onSelectTooth}
            />
            <View style={styles.websiteMidline} />
            <WebsiteQuadrant
                teeth={rightTeeth}
                getDisplayToothData={getDisplayToothData}
                selectedTooth={selectedTooth}
                onSelectTooth={onSelectTooth}
            />
            <Text style={styles.websiteArchLabel}>{rightLabel}</Text>
        </View>
    );
}

function WebsiteOdontogram({ getDisplayToothData, selectedTooth, onSelectTooth }) {
    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            contentContainerStyle={styles.websiteChartScroll}
        >
            <View style={styles.websiteChart}>
                <WebsiteArchRow
                    leftLabel="Upper right"
                    rightLabel="Upper left"
                    leftTeeth={UPPER_RIGHT}
                    rightTeeth={UPPER_LEFT}
                    getDisplayToothData={getDisplayToothData}
                    selectedTooth={selectedTooth}
                    onSelectTooth={onSelectTooth}
                />
                <View style={styles.websiteCenterBand}>
                    <View style={styles.websiteCenterLine} />
                    <Text style={styles.websiteCenterLabel}>FDI</Text>
                    <View style={styles.websiteCenterLine} />
                </View>
                <WebsiteArchRow
                    leftLabel="Lower right"
                    rightLabel="Lower left"
                    leftTeeth={LOWER_RIGHT}
                    rightTeeth={LOWER_LEFT}
                    getDisplayToothData={getDisplayToothData}
                    selectedTooth={selectedTooth}
                    onSelectTooth={onSelectTooth}
                />
                <Text style={styles.websiteCredit}>
                    Odontogram visual structure adapted with attribution to DentalPin.
                </Text>
            </View>
        </ScrollView>
    );
}

const buildSurfaceSummary = (surfaces) => {
    if (!surfaces?.length) return 'Whole tooth or no specific surface recorded.';
    return surfaces.map((surfaceCode) => `${surfaceCode} - ${SURFACE_LABELS[surfaceCode] || surfaceCode}`).join(', ');
};

export default function PatientOdontogramChart({ data }) {
    const [selectedTooth, setSelectedTooth] = useState(null);
    const [findingStageFilter, setFindingStageFilter] = useState('all');

    const hasData = Object.keys(data || {}).length > 0;
    const getToothData = (toothNumber) => normalizeToothData(data?.[String(toothNumber)]);
    const getDisplayToothData = (toothNumber) => buildDisplayToothData(getToothData(toothNumber), findingStageFilter);

    const countForFilter = (filterKey) => {
        let count = 0;
        [...UPPER_RIGHT, ...UPPER_LEFT, ...LOWER_RIGHT, ...LOWER_LEFT].forEach((toothNumber) => {
            const toothData = buildDisplayToothData(getToothData(toothNumber), filterKey);
            if (toothData.status !== 'healthy') count += 1;
        });
        return count;
    };

    const selectedToothData = selectedTooth ? getToothData(selectedTooth) : null;
    const selectedDisplayTooth = selectedToothData ? buildDisplayToothData(selectedToothData, findingStageFilter) : null;
    const selectedStatusMeta = selectedDisplayTooth ? getStatusMeta(selectedDisplayTooth.status) : null;
    const selectedFindings = selectedToothData?.findings?.length
        ? FINDING_STAGE_ORDER
            .map((stageKey) => getFindingForStage(selectedToothData.findings, stageKey))
            .filter(Boolean)
        : [];

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.screenContent}>
            <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.chartEyebrow}>Odontogram</Text>
                        <Text style={styles.chartTitle}>Clinical 2D Odontogram</Text>
                        <Text style={styles.chartSubtitle}>
                            Adult FDI chart with clinic-style tooth silhouettes. Tap a tooth to view its saved condition.
                        </Text>
                    </View>
                    <View style={styles.modeChipRow}>
                        <View style={styles.modeChip}>
                            <Text style={styles.modeChipText}>Permanent dentition</Text>
                        </View>
                        <View style={styles.modeChip}>
                            <Text style={styles.modeChipText}>Read only</Text>
                        </View>
                    </View>
                </View>

                {!hasData ? (
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyText}>
                            No tooth conditions recorded yet. Your dentist will update this after an examination.
                        </Text>
                    </View>
                ) : null}

                <View style={styles.filterRow}>
                    <Text style={styles.filterLabel}>View findings</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
                        {STAGE_FILTER_OPTIONS.map((option) => {
                            const isActive = findingStageFilter === option.key;
                            return (
                                <TouchableOpacity
                                    key={option.key}
                                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                                    activeOpacity={0.82}
                                    onPress={() => setFindingStageFilter(option.key)}
                                >
                                    <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{option.label}</Text>
                                    {option.key !== 'all' ? (
                                        <View style={[styles.filterCount, isActive && styles.filterCountActive]}>
                                            <Text style={[styles.filterCountText, isActive && styles.filterCountTextActive]}>{countForFilter(option.key)}</Text>
                                        </View>
                                    ) : null}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                <View style={styles.websiteChartShell}>
                    <WebsiteOdontogram
                        getDisplayToothData={getDisplayToothData}
                        selectedTooth={selectedTooth}
                        onSelectTooth={setSelectedTooth}
                    />
                </View>

                {selectedTooth && selectedDisplayTooth && selectedStatusMeta ? (
                    <View style={[styles.selectedCard, { backgroundColor: selectedStatusMeta.badgeBg, borderColor: selectedStatusMeta.stroke }]}>
                        <Text style={styles.selectedEyebrow}>Selected Tooth</Text>
                        <Text style={[styles.selectedTitle, { color: selectedStatusMeta.badgeText }]}>
                            Tooth {selectedTooth} - {selectedDisplayTooth.statusLabel}
                        </Text>
                        <Text style={styles.selectedBody}>
                            {buildSurfaceSummary(selectedDisplayTooth.surfaces)}
                        </Text>

                        {selectedFindings.length ? (
                            <View style={styles.findingList}>
                                {selectedFindings.map((finding) => {
                                    const stageMeta = getStageMeta(finding.stage);
                                    const meta = getStatusMeta(finding.status);
                                    return (
                                        <View key={finding.id} style={styles.findingCard}>
                                            <View style={styles.findingHeader}>
                                                <View style={[styles.stageBadge, { backgroundColor: stageMeta.badgeBg, borderColor: stageMeta.border }]}>
                                                    <View style={[styles.stageDot, { backgroundColor: stageMeta.accent }]} />
                                                    <Text style={[styles.stageBadgeText, { color: stageMeta.badgeText }]}>{stageMeta.label}</Text>
                                                </View>
                                                <Text style={[styles.findingStatus, { color: meta.accent }]}>{finding.statusLabel}</Text>
                                            </View>
                                            <Text style={styles.findingBody}>{buildSurfaceSummary(finding.surfaces)}</Text>
                                            {finding.note ? <Text style={styles.findingNote}>{finding.note}</Text> : null}
                                        </View>
                                    );
                                })}
                            </View>
                        ) : (
                            <Text style={styles.findingBody}>No staged findings were recorded for this tooth.</Text>
                        )}
                    </View>
                ) : (
                    <View style={styles.placeholderCard}>
                        <Text style={styles.placeholderText}>Tap any tooth to view its current, planned, or completed findings.</Text>
                    </View>
                )}
            </View>

            <View style={styles.legendSection}>
                <Text style={styles.legendSectionTitle}>Surfaces</Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.surfaceKeyList}
                >
                    {SURFACE_CODES.map((surfaceCode) => (
                        <View key={surfaceCode} style={styles.surfaceKeyItem}>
                            <View style={styles.surfaceKeyBubble}>
                                <Text style={styles.surfaceKeyBubbleText}>{surfaceCode}</Text>
                            </View>
                            <Text style={styles.surfaceKeyText}>{SURFACE_LABELS[surfaceCode]}</Text>
                        </View>
                    ))}
                </ScrollView>

                <Text style={styles.legendSectionTitle}>Stages</Text>
                <View style={styles.stageLegendRow}>
                    {FINDING_STAGE_ORDER.map((stageKey) => {
                        const stageMeta = getStageMeta(stageKey);
                        return (
                            <View
                                key={`legend-stage-${stageKey}`}
                                style={[styles.stageBadge, { backgroundColor: stageMeta.badgeBg, borderColor: stageMeta.border }]}
                            >
                                <View style={[styles.stageDot, { backgroundColor: stageMeta.accent }]} />
                                <Text style={[styles.stageBadgeText, { color: stageMeta.badgeText }]}>{stageMeta.label}</Text>
                            </View>
                        );
                    })}
                </View>

                <Text style={styles.legendSectionTitle}>Conditions</Text>
                <View style={styles.legendGrid}>
                    {LEGEND_KEYS.map((key) => {
                        const meta = STATUS_META[key];
                        return (
                            <View key={key} style={styles.legendCard}>
                                <View style={[styles.legendSwatch, { backgroundColor: meta.fill, borderColor: meta.stroke }]} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.legendName}>{meta.label}</Text>
                                    <Text style={styles.legendDescription}>{meta.description}</Text>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </View>

            <View style={styles.readOnlyBanner}>
                <Ionicons name="lock-closed-outline" size={14} color="#1565c0" style={{ marginRight: 8 }} />
                <Text style={styles.readOnlyText}>View-only. Dentist updates will appear here after the mobile screen refreshes.</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    screenContent: {
        padding: 16,
        paddingBottom: 140,
    },
    chartCard: {
        backgroundColor: '#ffffff',
        borderRadius: 22,
        padding: 16,
        borderWidth: 1,
        borderColor: mobileTheme.colors.border,
        marginBottom: 16,
        ...mobileTheme.shadows.soft,
    },
    chartHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginBottom: 16,
    },
    chartEyebrow: {
        fontSize: 11,
        fontWeight: '800',
        color: mobileTheme.colors.primary,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 4,
    },
    chartTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: mobileTheme.colors.text,
        marginBottom: 4,
    },
    chartSubtitle: {
        fontSize: 12,
        lineHeight: 18,
        color: mobileTheme.colors.textSoft,
    },
    modeChipRow: {
        gap: 8,
        alignItems: 'flex-end',
    },
    modeChip: {
        backgroundColor: mobileTheme.colors.surfaceAlt,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: mobileTheme.colors.border,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },
    modeChipText: {
        fontSize: 10,
        fontWeight: '700',
        color: mobileTheme.colors.textMuted,
    },
    emptyBox: {
        backgroundColor: mobileTheme.colors.surfaceAlt,
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
    },
    emptyText: {
        fontSize: 13,
        lineHeight: 19,
        color: mobileTheme.colors.textSoft,
        textAlign: 'center',
    },
    filterRow: {
        marginBottom: 14,
    },
    filterLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: '#64748b',
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    filterChipRow: {
        gap: 8,
        paddingRight: 8,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: mobileTheme.colors.border,
        borderRadius: 999,
        backgroundColor: '#ffffff',
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    filterChipActive: {
        backgroundColor: mobileTheme.colors.primarySoft,
        borderColor: '#9bd4f5',
    },
    filterChipText: {
        fontSize: 11,
        fontWeight: '700',
        color: mobileTheme.colors.textMuted,
    },
    filterChipTextActive: {
        color: mobileTheme.colors.primaryDark,
    },
    filterCount: {
        minWidth: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: mobileTheme.colors.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    filterCountActive: {
        backgroundColor: '#ffffff',
    },
    filterCountText: {
        fontSize: 10,
        fontWeight: '800',
        color: mobileTheme.colors.textMuted,
    },
    filterCountTextActive: {
        color: mobileTheme.colors.primaryDark,
    },
    websiteChartShell: {
        overflow: 'hidden',
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 18,
        backgroundColor: '#fcfdff',
    },
    websiteChartScroll: {
        paddingHorizontal: 14,
        paddingTop: 20,
        paddingBottom: 12,
    },
    websiteChart: {
        minWidth: 880,
    },
    websiteArchRow: {
        minHeight: 130,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    websiteArchLabel: {
        width: 66,
        paddingLeft: 8,
        color: '#27364a',
        fontSize: 11,
        lineHeight: 14,
        fontWeight: '700',
    },
    websiteArchLabelLeft: {
        paddingLeft: 0,
        paddingRight: 8,
        textAlign: 'right',
    },
    websiteQuadrant: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    websiteMidline: {
        width: 14,
        height: 126,
    },
    websiteToothCell: {
        width: 43,
        height: 126,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: 'transparent',
        borderRadius: 6,
        backgroundColor: 'transparent',
    },
    websiteToothAffected: {
        backgroundColor: 'rgba(248,250,252,0.72)',
    },
    websiteToothSelected: {
        borderColor: 'rgba(14,165,233,0.42)',
        backgroundColor: 'rgba(240,249,255,0.9)',
    },
    websiteDistalStart: {
        marginRight: 6,
    },
    websiteLateralView: {
        width: 38,
        height: 78,
    },
    websiteOcclusalView: {
        width: 32,
        height: 28,
    },
    websiteToothNumber: {
        height: 14,
        color: '#334155',
        fontSize: 10,
        lineHeight: 13,
        fontWeight: '800',
        textAlign: 'center',
    },
    websiteCenterBand: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        marginHorizontal: 74,
        marginVertical: 4,
    },
    websiteCenterLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#dbe4ee',
    },
    websiteCenterLabel: {
        color: '#64748b',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    websiteCredit: {
        marginTop: 12,
        color: '#94a3b8',
        fontSize: 9,
        fontWeight: '600',
        textAlign: 'center',
    },
    archCard: {
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#fcfdff',
        padding: 12,
        marginBottom: 14,
    },
    archHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    archTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: mobileTheme.colors.text,
    },
    archSubtitle: {
        fontSize: 11,
        color: mobileTheme.colors.textSoft,
        marginTop: 2,
    },
    archNotation: {
        fontSize: 10,
        fontWeight: '800',
        color: mobileTheme.colors.primary,
        backgroundColor: '#eff6ff',
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 5,
    },
    archScrollContent: {
        paddingRight: 8,
    },
    archGrid: {
        minWidth: 720,
    },
    numberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    numberRowBottom: {
        marginTop: 8,
        marginBottom: 0,
    },
    rowLabelSpacer: {
        width: 34,
    },
    rowTrack: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        flex: 1,
    },
    teethHalf: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 4,
    },
    midlineDivider: {
        width: 2,
        borderRadius: 999,
        backgroundColor: '#dbe6ef',
        alignSelf: 'stretch',
        marginHorizontal: 8,
    },
    toothNumberTag: {
        width: 38,
        textAlign: 'center',
        fontSize: 10,
        fontWeight: '800',
    },
    viewRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    viewLabel: {
        width: 34,
        fontSize: 10,
        fontWeight: '800',
        color: '#64748b',
        textAlign: 'center',
    },
    viewCellButton: {
        width: 38,
        alignItems: 'center',
        borderRadius: 10,
        paddingVertical: 4,
        paddingHorizontal: 1,
    },
    viewCellButtonSelected: {
        backgroundColor: 'rgba(1,83,139,0.08)',
    },
    miniViewFace: {
        width: 28,
        height: 38,
    },
    miniViewTop: {
        width: 28,
        height: 22,
        marginTop: 8,
        marginBottom: 8,
    },
    toothStatusCaption: {
        marginTop: 2,
        width: 34,
        textAlign: 'center',
        fontSize: 8,
        fontWeight: '700',
    },
    selectedCard: {
        marginTop: 4,
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
    },
    selectedEyebrow: {
        fontSize: 11,
        fontWeight: '800',
        color: '#64748b',
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    selectedTitle: {
        fontSize: 15,
        fontWeight: '800',
        marginBottom: 6,
    },
    selectedBody: {
        fontSize: 12,
        lineHeight: 18,
        color: mobileTheme.colors.textMuted,
    },
    findingList: {
        marginTop: 12,
        gap: 10,
    },
    findingCard: {
        backgroundColor: 'rgba(255,255,255,0.78)',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(148,163,184,0.18)',
    },
    findingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8,
        marginBottom: 6,
    },
    stageBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 9,
        paddingVertical: 5,
    },
    stageDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
    },
    stageBadgeText: {
        fontSize: 10,
        fontWeight: '800',
    },
    findingStatus: {
        fontSize: 12,
        fontWeight: '800',
        flex: 1,
        textAlign: 'right',
    },
    findingBody: {
        fontSize: 12,
        lineHeight: 18,
        color: mobileTheme.colors.textMuted,
    },
    findingNote: {
        marginTop: 6,
        fontSize: 12,
        lineHeight: 18,
        color: mobileTheme.colors.text,
    },
    placeholderCard: {
        marginTop: 4,
        backgroundColor: mobileTheme.colors.surfaceAlt,
        borderRadius: 16,
        padding: 14,
    },
    placeholderText: {
        fontSize: 12,
        lineHeight: 18,
        color: mobileTheme.colors.textSoft,
        textAlign: 'center',
    },
    legendSection: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: mobileTheme.colors.border,
        marginBottom: 16,
        ...mobileTheme.shadows.soft,
    },
    legendSectionTitle: {
        color: '#0f3450',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.7,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    stageLegendRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 14,
    },
    surfaceKeyList: {
        flexDirection: 'row',
        backgroundColor: mobileTheme.colors.surfaceAlt,
        borderRadius: 14,
        padding: 12,
        gap: 8,
        marginBottom: 14,
    },
    surfaceKeyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minWidth: 132,
        paddingRight: 8,
    },
    surfaceKeyBubble: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(1,83,139,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    surfaceKeyBubbleText: {
        fontSize: 10,
        fontWeight: '800',
        color: mobileTheme.colors.primary,
    },
    surfaceKeyText: {
        fontSize: 11,
        color: mobileTheme.colors.textMuted,
    },
    legendGrid: {
        gap: 10,
    },
    legendCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: '#f8fafc',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    legendSwatch: {
        width: 18,
        height: 18,
        borderRadius: 6,
        borderWidth: 1,
        marginTop: 1,
    },
    legendName: {
        fontSize: 12,
        fontWeight: '800',
        color: mobileTheme.colors.text,
        marginBottom: 2,
    },
    legendDescription: {
        fontSize: 11,
        lineHeight: 16,
        color: mobileTheme.colors.textSoft,
    },
    readOnlyBanner: {
        backgroundColor: mobileTheme.colors.primarySoft,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
    },
    readOnlyText: {
        flex: 1,
        fontSize: 12,
        color: mobileTheme.colors.primaryDark,
        lineHeight: 18,
    },
});
