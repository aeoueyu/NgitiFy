import React, { useContext, useState, useCallback, useRef, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, ScrollView,
    ActivityIndicator, FlatList, Animated
} from 'react-native';
import Svg, { Circle, Line, Path, Polygon } from 'react-native-svg';
import { AuthContext } from '../../context/AuthContext';
import { logActivity } from '../../utils/logActivity';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Header, Screen } from '../../components/mobile/MobileUI';
import { mobileTheme } from '../../theme/mobileTheme';

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
    { key: 'odontogram', label: 'Odontogram' },
    { key: 'radiograph', label: 'X-Rays' },
    { key: 'medical',    label: 'Medical History' },
];

// FDI tooth notation — 4 quadrants, upper then lower
const UPPER_RIGHT = [18,17,16,15,14,13,12,11]; // displayed right→left
const UPPER_LEFT  = [21,22,23,24,25,26,27,28];
const LOWER_LEFT  = [31,32,33,34,35,36,37,38];
const LOWER_RIGHT = [48,47,46,45,44,43,42,41]; // displayed right→left

const SURFACE_CODES = ['M', 'D', 'O', 'B', 'L'];
const SURFACE_LABELS = {
    M: 'Mesial',
    D: 'Distal',
    O: 'Occlusal / Incisal',
    B: 'Buccal / Labial',
    L: 'Lingual / Palatal',
};

const SURFACE_POSITIONS = {
    top: '24,14 48,14 42,28 30,28',
    left: '14,24 30,28 26,46 14,38',
    center: '30,28 42,28 46,42 36,50 26,42',
    right: '48,14 58,24 58,38 46,42 42,28',
    bottom: '26,42 36,50 46,42 48,56 24,56',
};

const ODONTOGRAM_STATUS_META = {
    healthy:            { label: 'Healthy', fill: '#ffffff', stroke: '#cbd5e1', accent: '#64748b', badgeBg: '#f8fafc', badgeText: '#475569' },
    filled:             { label: 'Filled', fill: '#e0f2fe', stroke: '#0ea5e9', accent: '#0284c7', badgeBg: '#e0f2fe', badgeText: '#0369a1' },
    decayed:            { label: 'Caries / Decayed', fill: '#fee2e2', stroke: '#ef4444', accent: '#b91c1c', badgeBg: '#fee2e2', badgeText: '#b91c1c' },
    crown:              { label: 'Crown', fill: '#fef3c7', stroke: '#f59e0b', accent: '#b45309', badgeBg: '#fef3c7', badgeText: '#92400e' },
    implant:            { label: 'Implant', fill: '#ede9fe', stroke: '#8b5cf6', accent: '#6d28d9', badgeBg: '#ede9fe', badgeText: '#6d28d9' },
    bridge:             { label: 'Bridge Pontic', fill: '#ffedd5', stroke: '#f97316', accent: '#c2410c', badgeBg: '#ffedd5', badgeText: '#9a3412' },
    'extraction-site':  { label: 'Extraction Site', fill: '#e2e8f0', stroke: '#64748b', accent: '#334155', badgeBg: '#e2e8f0', badgeText: '#334155' },
    missing:            { label: 'Missing', fill: '#e5e7eb', stroke: '#94a3b8', accent: '#475569', badgeBg: '#e5e7eb', badgeText: '#475569' },
    mobility:           { label: 'Mobility', fill: '#fce7f3', stroke: '#ec4899', accent: '#be185d', badgeBg: '#fce7f3', badgeText: '#be185d' },
    fractured:          { label: 'Fractured', fill: '#ffedd5', stroke: '#fb923c', accent: '#c2410c', badgeBg: '#ffedd5', badgeText: '#c2410c' },
    'root-canal':       { label: 'Root Canal', fill: '#fae8ff', stroke: '#a855f7', accent: '#7e22ce', badgeBg: '#fae8ff', badgeText: '#7e22ce' },
    'under-observation':{ label: 'Under Observation', fill: '#ccfbf1', stroke: '#14b8a6', accent: '#0f766e', badgeBg: '#ccfbf1', badgeText: '#0f766e' },
    unknown:            { label: 'Recorded Finding', fill: '#eef2ff', stroke: '#818cf8', accent: '#4f46e5', badgeBg: '#eef2ff', badgeText: '#4338ca' },
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

const CATEGORY_ICONS = {
    Restoration:    { name: 'construct-outline',     lib: 'Ionicons' },
    Extraction:     { name: 'medical-outline',       lib: 'Ionicons' },
    Prophylaxis:    { name: 'sparkles-outline',      lib: 'Ionicons' },
    Orthodontics:   { name: 'git-merge-outline',     lib: 'Ionicons' },
    Endodontics:    { name: 'pulse-outline',         lib: 'Ionicons' },
    Prosthodontics: { name: 'diamond-outline',       lib: 'Ionicons' },
    'Oral Surgery': { name: 'cut-outline',           lib: 'Ionicons' },
    Consultation:   { name: 'chatbubble-outline',    lib: 'Ionicons' },
    Other:          { name: 'document-text-outline', lib: 'Ionicons' },
};

function CategoryIcon({ category, size = 14, color = '#555' }) {
    const cfg = CATEGORY_ICONS[category] || CATEGORY_ICONS.Other;
    return <Ionicons name={cfg.name} size={size} color={color} />;
}

const SURGERY_STATUS_COLORS = {
    completed:  { color: '#2e7d32', bg: '#e8f5e9' },
    confirmed:  { color: '#1565c0', bg: '#e3f2fd' },
    'in-clinic':{ color: '#6a1b9a', bg: '#f3e5f5' },
    pending:    { color: '#e65100', bg: '#fff3e0' },
    cancelled:  { color: '#757575', bg: '#eeeeee' },
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun',
                'Jul','Aug','Sep','Oct','Nov','Dec'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

const yesNoDisplay = (value) => (
    value === true ? 'Yes'
        : value === false ? 'No'
            : 'Not specified'
);

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({ iconComponent, title, sub }) {
    return (
        <View style={shared.emptyBox}>
            <View style={{ marginBottom: 12 }}>{iconComponent}</View>
            <Text style={shared.emptyTitle}>{title}</Text>
            {sub && <Text style={shared.emptySub}>{sub}</Text>}
        </View>
    );
}

function LoadingState() {
    return (
        <View style={shared.loadingBox}>
            <ActivityIndicator color="#01538b" size="large" />
            <Text style={shared.loadingText}>Loading records…</Text>
        </View>
    );
}

function ErrorState({ message, onRetry }) {
    return (
        <View style={shared.errorBox}>
            <Ionicons name="warning-outline" size={36} color="#e65100" style={{ marginBottom: 10 }} />
            <Text style={shared.errorText}>{message}</Text>
            <TouchableOpacity style={shared.retryBtn} onPress={onRetry}>
                <Text style={shared.retryText}>Retry</Text>
            </TouchableOpacity>
        </View>
    );
}

// ─── Tab: Treatment History ───────────────────────────────────────────────────

function TreatmentTab({ logs, loading, error, onRetry }) {
    const [expanded, setExpanded] = useState(null);

    if (loading) return <LoadingState />;
    if (error)   return <ErrorState message={error} onRetry={onRetry} />;
    if (!logs.length) return (
        <EmptyState
            iconComponent={<Ionicons name="document-text-outline" size={40} color="#bbb" />}
            title="No Treatment History Yet"
            sub="Your recorded treatments will appear here after your first visit."
        />
    );

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
            {logs.map((log) => {
                const isOpen = expanded === log._id;
                return (
                    <TouchableOpacity
                        key={log._id}
                        style={[styles.logCard, isOpen && styles.logCardOpen]}
                        onPress={() => setExpanded(isOpen ? null : log._id)}
                        activeOpacity={0.8}
                    >
                        <View style={styles.logHeader}>
                            <View style={styles.logDateBox}>
                                <Text style={styles.logMonth}>{MONTHS[new Date(log.date).getMonth()]}</Text>
                                <Text style={styles.logDay}>{new Date(log.date).getDate()}</Text>
                                <Text style={styles.logYear}>{new Date(log.date).getFullYear()}</Text>
                            </View>
                            <View style={styles.logMeta}>
                                <View style={styles.logTitleRow}>
                                    <CategoryIcon category={log.category} size={14} color="#555" style={{ marginRight: 6 }} />
                                    <Text style={styles.logProcedure} numberOfLines={isOpen ? 0 : 1}>
                                        {log.procedure}
                                    </Text>
                                </View>
                                <Text style={styles.logCategory}>{log.category || 'Other'}</Text>
                                {log.dentistName && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <MaterialCommunityIcons name="tooth-outline" size={13} color="#555" style={{ marginRight: 4 }} />
                                        <Text style={styles.logDentist}>Dr. {log.dentistName}</Text>
                                    </View>
                                )}
                                {log.tooth && (
                                    <Text style={styles.logTooth}>Tooth: {log.tooth}</Text>
                                )}
                            </View>
                            <Ionicons
                                name={isOpen ? 'chevron-up' : 'chevron-down'}
                                size={14}
                                color="#bbb"
                                style={{ paddingLeft: 8, paddingTop: 2 }}
                            />
                        </View>
                        {isOpen && log.branch ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12 }}>
                                <Ionicons name="location-outline" size={12} color="#aaa" style={{ marginRight: 4 }} />
                                <Text style={[styles.logBranch, { paddingHorizontal: 0, paddingBottom: 0 }]}>{log.branch}</Text>
                            </View>
                        ) : null}
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
    );
}

// ─── Tab: Odontogram ─────────────────────────────────────────────────────────

function OdontogramTab({ data, loading, error, onRetry }) {
    if (loading) return <LoadingState />;
    if (error)   return <ErrorState message={error} onRetry={onRetry} />;

    const hasData = Object.keys(data).length > 0;
    const normalizeToothData = (raw) => {
        if (!raw) return { status: '', surfaces: [] };
        if (typeof raw === 'string') return { status: raw, surfaces: [] };
        return {
            status: String(raw.status || ''),
            surfaces: Array.isArray(raw.surfaces) ? raw.surfaces.map((surface) => String(surface)) : [],
        };
    };

    const ToothCell = ({ num }) => {
        const toothData = normalizeToothData(data[String(num)]);
        const normalizedStatusKey = String(toothData.status || '').trim().toLowerCase();
        const statusLabel = toothData.status || '';
        const colors = normalizedStatusKey
            ? (STATUS_COLORS[normalizedStatusKey] || DEFAULT_STATUS_COLOR)
            : { bg: 'white', text: '#ccc' };
        const isMissing = ['missing', 'extracted', 'extraction-site'].includes(normalizedStatusKey);
        const surfaceSuffix = toothData.surfaces.length ? ` (${toothData.surfaces.join(', ')})` : '';

        return (
            <View style={[styles.toothCell, { backgroundColor: colors.bg, borderColor: colors.text + '55' }]}>
                <Text style={[styles.toothNum, { color: colors.text, textDecorationLine: isMissing ? 'line-through' : 'none' }]}>
                    {num}
                </Text>
                {statusLabel && !['healthy', 'normal'].includes(normalizedStatusKey) && (
                    <Text style={[styles.toothStatus, { color: colors.text }]} numberOfLines={1}>
                        {`${statusLabel}${surfaceSuffix}`.length > 12 ? `${statusLabel}${surfaceSuffix}`.slice(0, 11) + '…' : `${statusLabel}${surfaceSuffix}`}
                    </Text>
                )}
            </View>
        );
    };

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
            <View style={styles.odontogramCard}>
                <Text style={styles.odontogramTitle}>Odontogram</Text>
                <Text style={styles.odontogramSub}>FDI Notation  -  Read-only</Text>

                {!hasData && (
                    <View style={styles.odontogramEmpty}>
                        <Text style={styles.odontogramEmptyText}>
                            No tooth conditions recorded yet. Your dentist will update this after an examination.
                        </Text>
                    </View>
                )}

                {/* Upper jaw */}
                <Text style={styles.jawLabel}>Upper Jaw</Text>
                <View style={styles.jawRow}>
                    {UPPER_RIGHT.map(n => <ToothCell key={n} num={n} />)}
                    <View style={styles.midline} />
                    {UPPER_LEFT.map(n => <ToothCell key={n} num={n} />)}
                </View>

                <View style={styles.jawDivider} />

                {/* Lower jaw */}
                <View style={styles.jawRow}>
                    {LOWER_RIGHT.map(n => <ToothCell key={n} num={n} />)}
                    <View style={styles.midline} />
                    {LOWER_LEFT.map(n => <ToothCell key={n} num={n} />)}
                </View>
                <Text style={styles.jawLabel}>Lower Jaw</Text>
            </View>

            {/* Legend */}
            <Text style={styles.legendTitle}>Legend</Text>
            <View style={styles.legendGrid}>
                {Object.entries(STATUS_COLORS).map(([label, { bg, text }]) => (
                    <View key={label} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: bg, borderColor: text + '88' }]} />
                        <Text style={styles.legendLabel}>{label}</Text>
                    </View>
                ))}
            </View>

            <View style={styles.readOnlyBanner}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="lock-closed-outline" size={13} color="#1565c0" style={{ marginRight: 6 }} />
                    <Text style={styles.readOnlyText}>View-only. Only your dentist can update tooth conditions.</Text>
                </View>
            </View>
        </ScrollView>
    );
}

// ─── Tab: Radiographs ────────────────────────────────────────────────────────

function OdontogramSurfaceTab({ data, loading, error, onRetry }) {
    if (loading) return <LoadingState />;
    if (error)   return <ErrorState message={error} onRetry={onRetry} />;

    const [selectedTooth, setSelectedTooth] = useState(null);
    const hasData = Object.keys(data).length > 0;
    const normalizeStatusKey = (value) => {
        const normalized = String(value || '').trim().toLowerCase();
        return STATUS_ALIASES[normalized] || normalized.replace(/\s+/g, '-');
    };

    const getStatusMeta = (statusKey) => ODONTOGRAM_STATUS_META[statusKey] || ODONTOGRAM_STATUS_META.unknown;

    const sanitizeSurfaces = (surfaces) => {
        if (!Array.isArray(surfaces)) return [];
        const normalized = new Set(
            surfaces
                .map((surface) => String(surface || '').trim().toUpperCase())
                .filter((surface) => SURFACE_CODES.includes(surface))
        );
        return SURFACE_CODES.filter((surface) => normalized.has(surface));
    };

    const normalizeToothData = (raw) => {
        if (!raw) {
            return { status: 'healthy', statusLabel: ODONTOGRAM_STATUS_META.healthy.label, surfaces: [] };
        }

        const rawStatus = typeof raw === 'string' ? raw : raw.status;
        const statusKey = normalizeStatusKey(rawStatus);
        const meta = getStatusMeta(statusKey);

        return {
            status: statusKey || 'healthy',
            statusLabel: meta === ODONTOGRAM_STATUS_META.unknown && rawStatus ? String(rawStatus) : meta.label,
            surfaces: sanitizeSurfaces(typeof raw === 'string' ? [] : raw.surfaces),
        };
    };

    const getSurfacePositionMap = (toothNumber) => {
        const quadrant = Number(String(toothNumber)[0]);
        const isUpper = quadrant === 1 || quadrant === 2;
        const isRightQuadrant = quadrant === 1 || quadrant === 4;

        return {
            M: isRightQuadrant ? 'right' : 'left',
            D: isRightQuadrant ? 'left' : 'right',
            O: 'center',
            B: isUpper ? 'top' : 'bottom',
            L: isUpper ? 'bottom' : 'top',
        };
    };

    const getHighlightedSurfaces = (statusKey, surfaces) => {
        if (statusKey === 'healthy') return new Set();
        if (WHOLE_TOOTH_STATUSES.has(statusKey)) return new Set(SURFACE_CODES);
        if (surfaces.length > 0) return new Set(surfaces);
        return new Set(SURFACE_CODES);
    };

    const RootShape = ({ toothNumber, stroke }) => {
        const digit = toothNumber % 10;
        const isPosterior = digit >= 6 || digit === 8;

        if (isPosterior) {
            return (
                <>
                    <Path d="M26 56 C20 68 18 80 22 90" fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
                    <Path d="M46 56 C52 68 54 80 50 90" fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />
                </>
            );
        }

        return <Path d="M36 56 C36 68 34 80 36 92" fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round" />;
    };

    const StatusOverlay = ({ statusKey, accent, stroke }) => {
        if (statusKey === 'missing' || statusKey === 'extraction-site') {
            return (
                <>
                    <Line x1="18" y1="16" x2="56" y2="54" stroke={accent} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
                    <Line x1="56" y1="16" x2="18" y2="54" stroke={accent} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
                </>
            );
        }

        if (statusKey === 'implant') {
            return (
                <>
                    <Path d="M36 58 V88" fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" />
                    <Path d="M28 64 H44" fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" />
                    <Path d="M29 71 H43" fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" />
                    <Path d="M30 78 H42" fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" />
                    <Circle cx="36" cy="34" r="4.5" fill={accent} opacity="0.85" />
                </>
            );
        }

        if (statusKey === 'bridge') {
            return <Path d="M18 36 H54" fill="none" stroke={accent} strokeWidth="4" strokeLinecap="round" opacity="0.8" />;
        }

        if (statusKey === 'mobility') {
            return (
                <>
                    <Path d="M18 10 L24 14" fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M18 10 L24 6" fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M18 10 H54" fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" />
                    <Path d="M54 10 L48 14" fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M54 10 L48 6" fill="none" stroke={accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </>
            );
        }

        if (statusKey === 'fractured') {
            return <Path d="M28 14 L40 24 L32 36 L44 50" fill="none" stroke={accent} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />;
        }

        if (statusKey === 'root-canal') {
            return (
                <>
                    <Path d="M36 30 V90" fill="none" stroke={accent} strokeWidth="2.6" strokeLinecap="round" />
                    <Path d="M31 44 H41" fill="none" stroke={accent} strokeWidth="2.6" strokeLinecap="round" />
                </>
            );
        }

        if (statusKey === 'under-observation') {
            return <Circle cx="36" cy="34" r="19" fill="none" stroke={accent} strokeWidth="2.2" strokeDasharray="4 4" />;
        }

        if (statusKey === 'crown') {
            return <Path d="M18 18 L54 18 L54 52 L18 52 Z" fill="none" stroke={stroke} strokeWidth="3" />;
        }

        return null;
    };

    const ToothFigure = ({ num }) => {
        const toothData = normalizeToothData(data[String(num)]);
        const meta = getStatusMeta(toothData.status);
        const highlightedSurfaces = getHighlightedSurfaces(toothData.status, toothData.surfaces);
        const surfacePositions = getSurfacePositionMap(num);
        const isSelected = selectedTooth === num;

        return (
            <TouchableOpacity style={[styles.toothFigure, isSelected && styles.toothFigureSelected]} activeOpacity={0.82} onPress={() => setSelectedTooth(num)}>
                <Text style={styles.toothNum}>{num}</Text>
                <Svg width={42} height={58} viewBox="0 0 72 100" style={styles.toothSvg}>
                    <Path
                        d="M18 8 C24 2 48 2 54 8 L62 20 C64 22 64 28 62 34 L58 48 C56 56 48 62 36 62 C24 62 16 56 14 48 L10 34 C8 28 8 22 10 20 Z"
                        fill="#ffffff"
                        stroke={meta.stroke}
                        strokeWidth="2.4"
                        strokeLinejoin="round"
                        strokeDasharray={toothData.status === 'mobility' ? '4 3' : undefined}
                    />
                    {SURFACE_CODES.map((surfaceCode) => {
                        const isActive = highlightedSurfaces.has(surfaceCode);
                        return (
                            <Polygon
                                key={`${num}-${surfaceCode}`}
                                points={SURFACE_POSITIONS[surfacePositions[surfaceCode]]}
                                fill={isActive ? meta.fill : '#ffffff'}
                                stroke={isActive ? meta.stroke : '#d4dde7'}
                                strokeWidth="1.8"
                            />
                        );
                    })}
                    <RootShape toothNumber={num} stroke={meta.stroke} />
                    <StatusOverlay statusKey={toothData.status} accent={meta.accent} stroke={meta.stroke} />
                </Svg>
                <Text style={[styles.toothTapHint, isSelected && styles.toothTapHintSelected]}>
                    {isSelected ? 'Selected' : 'Tap'}
                </Text>
            </TouchableOpacity>
        );
    };

    const selectedToothData = selectedTooth ? normalizeToothData(data[String(selectedTooth)]) : null;
    const selectedToothMeta = selectedToothData ? getStatusMeta(selectedToothData.status) : null;
    const selectedSurfaceSummary = selectedToothData?.surfaces?.length
        ? selectedToothData.surfaces.map((surfaceCode) => `${surfaceCode} - ${SURFACE_LABELS[surfaceCode] || surfaceCode}`).join(', ')
        : 'Whole tooth or no specific surface recorded.';

    const JawRow = ({ teeth }) => (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.jawScroll}>
            <View style={styles.jawRow}>
                {teeth[0].map((num) => <ToothFigure key={num} num={num} />)}
                <View style={styles.midline} />
                {teeth[1].map((num) => <ToothFigure key={num} num={num} />)}
            </View>
        </ScrollView>
    );

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
            <View style={styles.odontogramCard}>
                <Text style={styles.odontogramTitle}>Odontogram</Text>
                <Text style={styles.odontogramSub}>Surface-based 2D odontogram � FDI notation � Tap a tooth to view its status</Text>

                {!hasData && (
                    <View style={styles.odontogramEmpty}>
                        <Text style={styles.odontogramEmptyText}>
                            No tooth conditions recorded yet. Your dentist will update this after an examination.
                        </Text>
                    </View>
                )}

                <Text style={styles.jawLabel}>Upper Jaw</Text>
                <JawRow teeth={[UPPER_RIGHT, UPPER_LEFT]} />

                <View style={styles.jawDivider} />

                <JawRow teeth={[LOWER_RIGHT, LOWER_LEFT]} />
                <Text style={styles.jawLabel}>Lower Jaw</Text>

                {selectedTooth && selectedToothData && selectedToothMeta ? (
                    <View style={[styles.selectedToothCard, { backgroundColor: selectedToothMeta.badgeBg, borderColor: selectedToothMeta.stroke }]}>
                        <Text style={styles.selectedToothEyebrow}>Selected Tooth</Text>
                        <Text style={[styles.selectedToothTitle, { color: selectedToothMeta.badgeText }]}>
                            Tooth {selectedTooth} - {selectedToothData.statusLabel}
                        </Text>
                        <Text style={styles.selectedToothBody}>{selectedSurfaceSummary}</Text>
                    </View>
                ) : (
                    <View style={styles.selectedToothPlaceholder}>
                        <Text style={styles.selectedToothPlaceholderText}>Tap any tooth above to view its recorded status and surfaces.</Text>
                    </View>
                )}
            </View>

            <Text style={styles.legendTitle}>Legend</Text>
            <View style={styles.legendGrid}>
                {LEGEND_KEYS.map((key) => {
                    const meta = ODONTOGRAM_STATUS_META[key];
                    return (
                        <View key={key} style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: meta.fill, borderColor: meta.stroke }]} />
                            <Text style={styles.legendLabel}>{meta.label}</Text>
                        </View>
                    );
                })}
            </View>

            <View style={styles.surfaceKeyList}>
                {SURFACE_CODES.map((surfaceCode) => (
                    <View key={surfaceCode} style={styles.surfaceKeyItem}>
                        <View style={styles.surfaceKeyBubble}>
                            <Text style={styles.surfaceKeyBubbleText}>{surfaceCode}</Text>
                        </View>
                        <Text style={styles.surfaceKeyItemText}>{SURFACE_LABELS[surfaceCode]}</Text>
                    </View>
                ))}
            </View>

            <View style={styles.readOnlyBanner}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="lock-closed-outline" size={13} color="#1565c0" style={{ marginRight: 6 }} />
                    <Text style={styles.readOnlyText}>View-only. Only your dentist can update tooth conditions.</Text>
                </View>
            </View>
        </ScrollView>
    );
}

function RadiographTab({ radiographs, loading, error, onRetry, navigation }) {
    if (loading) return <LoadingState />;
    if (error)   return <ErrorState message={error} onRetry={onRetry} />;
    if (!radiographs.length) return (
        <EmptyState
            iconComponent={<MaterialCommunityIcons name="bone" size={40} color="#bbb" />}
            title="No X-Rays On File"
            sub="Uploaded radiographs will appear here after your dentist scans them in."
        />
    );

    return (
        <FlatList
            data={radiographs}
            keyExtractor={item => item._id}
            contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
            numColumns={2}
            columnWrapperStyle={{ gap: 12 }}
            renderItem={({ item }) => (
                <TouchableOpacity
                    style={styles.xrayCard}
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate('PatientXRayView', { radiograph: item })}
                >
                    <View style={styles.xrayThumb}>
                        <MaterialCommunityIcons name="bone" size={36} color="#aaa" />
                        {item.url && (
                            <View style={styles.xrayAvailableDot} />
                        )}
                    </View>
                    <View style={styles.xrayInfo}>
                        <Text style={styles.xrayLabel} numberOfLines={2}>{item.label}</Text>
                        <Text style={styles.xrayDate}>{fmtDate(item.date)}</Text>
                        {item.radiographNumber ? (
                            <Text style={styles.xrayMeta} numberOfLines={1}>Radiograph No. {item.radiographNumber}</Text>
                        ) : null}
                        {item.findings ? (
                            <Text style={styles.xrayMeta} numberOfLines={2}>{item.findings}</Text>
                        ) : null}
                        {item.notes ? (
                            <Text style={styles.xrayNotes} numberOfLines={1}>{item.notes}</Text>
                        ) : null}
                        <Text style={styles.xrayTapHint}>Tap to view →</Text>
                    </View>
                </TouchableOpacity>
            )}
        />
    );
}

// ─── Tab: History ─────────────────────────────────────────────────────────────

function MedicalHistoryTab({ profile, loading, error, onRetry }) {
    if (loading) return <LoadingState />;
    if (error)   return <ErrorState message={error} onRetry={onRetry} />;
    if (!profile) return (
        <EmptyState
            iconComponent={<Ionicons name="document-text-outline" size={40} color="#bbb" />}
            title="No Medical History Yet"
            sub="Your patient intake details will appear here once the clinic has completed your record."
        />
    );

    const medicalHistory = profile.medicalHistory || {};
    const dentalHistory = profile.dentalHistory || {};
    const physician = profile.physician || {};
    const allergies = Array.isArray(medicalHistory.allergies) ? medicalHistory.allergies : [];
    const conditions = Array.isArray(medicalHistory.conditions) ? medicalHistory.conditions : [];
    const medications = Array.isArray(medicalHistory.medications) ? medicalHistory.medications : [];
    const pairedRows = [
        ['Reason for Consultation', profile.reasonForConsultation || dentalHistory.chiefComplaint || 'Not specified'],
        ['Last Dental Visit', dentalHistory.lastExamDate ? fmtDate(dentalHistory.lastExamDate) : 'Not specified'],
        ['Reaction or Complication After Dental Treatment?', yesNoDisplay(dentalHistory.hadTreatmentReaction), 'If Yes, Please Detail', dentalHistory.reactionDetails || 'Not specified'],
        ['Under Medical Treatment Now?', yesNoDisplay(medicalHistory.underMedicalTreatment), 'Condition Treated', medicalHistory.medicalTreatmentDetails || 'Not specified'],
        ['Serious Illness or Surgical Operation?', yesNoDisplay(medicalHistory.hadSeriousIllnessOrSurgery), 'Illness or Operation Details', medicalHistory.seriousIllnessOrSurgeryDetails || 'Not specified'],
    ];

    return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
            {(physician.name || physician.officeNumber) ? (
                <View style={styles.historySectionCard}>
                    <Text style={styles.historySectionTitle}>Attending Physician</Text>
                    <View style={styles.detailGrid}>
                        <View style={styles.detailCell}><Text style={styles.detailLabel}>Physician Name</Text><Text style={styles.detailValue}>{physician.name || 'Not specified'}</Text></View>
                        <View style={styles.detailCell}><Text style={styles.detailLabel}>Specialty</Text><Text style={styles.detailValue}>{physician.specialty || 'Not specified'}</Text></View>
                        <View style={styles.detailCell}><Text style={styles.detailLabel}>Office Address</Text><Text style={styles.detailValue}>{physician.officeAddress || 'Not specified'}</Text></View>
                        <View style={styles.detailCell}><Text style={styles.detailLabel}>Office Number</Text><Text style={styles.detailValue}>{physician.officeNumber || 'Not specified'}</Text></View>
                    </View>
                </View>
            ) : null}

            <View style={styles.historySectionCard}>
                <Text style={styles.historySectionTitle}>Medical and Dental History</Text>
                {pairedRows.map((row) => (
                    <View key={row[0]} style={styles.detailRowPair}>
                        <View style={styles.detailCell}>
                            <Text style={styles.detailLabel}>{row[0]}</Text>
                            <Text style={styles.detailValue}>{row[1]}</Text>
                        </View>
                        {row[2] ? (
                            <View style={styles.detailCell}>
                                <Text style={styles.detailLabel}>{row[2]}</Text>
                                <Text style={styles.detailValue}>{row[3]}</Text>
                            </View>
                        ) : null}
                    </View>
                ))}

                <View style={styles.detailGrid}>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Private or Confidential Information to Discuss in Private?</Text><Text style={styles.detailValue}>{yesNoDisplay(dentalHistory.hasConfidentialInfo)}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Are You in Good Health?</Text><Text style={styles.detailValue}>{yesNoDisplay(medicalHistory.inGoodHealth)}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Ever Been Hospitalized?</Text><Text style={styles.detailValue}>{yesNoDisplay(medicalHistory.hadHospitalization)}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Hospitalization Details</Text><Text style={styles.detailValue}>{medicalHistory.hospitalizationDetails || 'Not specified'}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Taking Prescription / Non-Prescription Medication?</Text><Text style={styles.detailValue}>{yesNoDisplay(medicalHistory.isTakingMedication)}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Medications</Text><Text style={styles.detailValue}>{medications.length ? medications.join(', ') : 'Not specified'}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Use Tobacco Products?</Text><Text style={styles.detailValue}>{yesNoDisplay(medicalHistory.usesTobacco)}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Use Alcohol, Cocaine, or Other Dangerous Drugs?</Text><Text style={styles.detailValue}>{yesNoDisplay(medicalHistory.usesAlcoholOrDrugs)}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Has Allergies?</Text><Text style={styles.detailValue}>{yesNoDisplay(medicalHistory.hasAllergies)}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Bleeding Time</Text><Text style={styles.detailValue}>{medicalHistory.bleedingTime || 'Not specified'}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Blood Pressure</Text><Text style={styles.detailValue}>{medicalHistory.bloodPressure || 'Not specified'}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Blood Type</Text><Text style={styles.detailValue}>{profile.bloodType || medicalHistory.bloodType || 'Not specified'}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Are You Pregnant?</Text><Text style={styles.detailValue}>{yesNoDisplay(medicalHistory.isPregnant)}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Are You Nursing?</Text><Text style={styles.detailValue}>{yesNoDisplay(medicalHistory.isNursing)}</Text></View>
                    <View style={styles.detailCell}><Text style={styles.detailLabel}>Taking Birth Control Pills?</Text><Text style={styles.detailValue}>{yesNoDisplay(medicalHistory.takingBirthControl)}</Text></View>
                </View>

                <View style={styles.detailChecklistSection}>
                    <Text style={styles.detailLabel}>Allergy Checklist</Text>
                    <View style={styles.checklistGrid}>
                        {allergies.length ? allergies.map((item) => (
                            <View key={item} style={styles.checklistItem}>
                                <Ionicons name="checkbox-outline" size={16} color="#01538b" />
                                <Text style={styles.checklistText}>{item}</Text>
                            </View>
                        )) : <Text style={styles.detailValue}>No allergies recorded.</Text>}
                    </View>
                </View>

                <View style={styles.detailChecklistSection}>
                    <Text style={styles.detailLabel}>Medical Conditions Checklist</Text>
                    <View style={styles.checklistGrid}>
                        {conditions.length ? conditions.map((item) => (
                            <View key={item} style={styles.checklistItem}>
                                <Ionicons name="checkbox-outline" size={16} color="#01538b" />
                                <Text style={styles.checklistText}>{item}</Text>
                            </View>
                        )) : <Text style={styles.detailValue}>No medical conditions recorded.</Text>}
                    </View>
                </View>
            </View>
        </ScrollView>
    );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MedicalRecordsScreen({ navigation }) {
    const { userToken, userId, API_BASE_URL } = useContext(AuthContext);

    const [activeTab, setActiveTab] = useState('odontogram');
    const underlineAnim = useRef(new Animated.Value(0)).current;

    // Per-tab state
    const [odontogramData, setOdontogramData] = useState({});
    const [radiographs,    setRadiographs]    = useState([]);
    const [profile,        setProfile]        = useState(null);

    const [loading, setLoading] = useState({ odontogram: false, radiograph: false, medical: false });
    const [errors,  setErrors]  = useState({ odontogram: '', radiograph: '', medical: '' });
    const [fetched, setFetched] = useState({ odontogram: false, radiograph: false, medical: false });

    const headers = { Authorization: `Bearer ${userToken}` };

    const setTabLoading = (tab, val) => setLoading(prev => ({ ...prev, [tab]: val }));
    const setTabError   = (tab, val) => setErrors(prev =>  ({ ...prev, [tab]: val }));
    const setTabFetched = (tab)      => setFetched(prev => ({ ...prev, [tab]: true }));

    // ── Fetchers ──────────────────────────────────────────────────────────────

    const fetchOdontogram = useCallback(async () => {
        setTabLoading('odontogram', true);
        setTabError('odontogram', '');
        try {
            const res = await fetch(`${API_BASE_URL}/api/my/odontogram`, { headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setOdontogramData(data && typeof data === 'object' ? data : {});
            setTabFetched('odontogram');
        } catch (e) {
            setTabError('odontogram', e.message || 'Could not load odontogram.');
        } finally {
            setTabLoading('odontogram', false);
        }
    }, [userToken, API_BASE_URL]);

    const fetchRadiographs = useCallback(async () => {
        setTabLoading('radiograph', true);
        setTabError('radiograph', '');
        try {
            const res = await fetch(`${API_BASE_URL}/api/my/radiographs`, { headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setRadiographs(Array.isArray(data) ? data : []);
            setTabFetched('radiograph');
        } catch (e) {
            setTabError('radiograph', e.message || 'Could not load radiographs.');
        } finally {
            setTabLoading('radiograph', false);
        }
    }, [userToken, API_BASE_URL]);

    const fetchMedicalHistory = useCallback(async () => {
        setTabLoading('medical', true);
        setTabError('medical', '');
        try {
            const res = await fetch(`${API_BASE_URL}/api/user/${userId}`, { headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setProfile(data || null);
            setTabFetched('medical');
        } catch (e) {
            setTabError('medical', e.message || 'Could not load your medical history.');
        } finally {
            setTabLoading('medical', false);
        }
    }, [userToken, userId, API_BASE_URL]);

    const FETCHERS = {
        odontogram: fetchOdontogram,
        radiograph: fetchRadiographs,
        medical:    fetchMedicalHistory,
    };

    // Fetch on first tab activation (lazy per tab)
    useEffect(() => {
        if (!fetched[activeTab]) {
            FETCHERS[activeTab]();
        }
        logActivity(
            'EMR_VIEWED',
            `Viewed Medical Records — ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} tab`,
            userToken, API_BASE_URL
        );
    }, [activeTab]);

    // Animate tab underline
    const TAB_INDEX = { odontogram: 0, radiograph: 1, medical: 2 };
    useEffect(() => {
        Animated.timing(underlineAnim, {
            toValue: TAB_INDEX[activeTab],
            duration: 200,
            useNativeDriver: false,
        }).start();
    }, [activeTab]);

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <Screen>
            <Header
                title="Records"
                subtitle="EMR, radiographs, and medical history"
            />

            <View style={styles.heroCard}>
                <View style={styles.heroIconBubble}>
                    <Ionicons name="document-text-outline" size={22} color="#ffffff" />
                </View>
                <View style={styles.heroCopy}>
                    <Text style={styles.heroTitle}>Your dental record hub</Text>
                    <Text style={styles.heroText}>
                        Switch between odontogram, x-rays, and medical history without leaving the same patient record space.
                    </Text>
                </View>
            </View>

            <View style={styles.tabBar}>
                {TABS.map((tab, idx) => (
                    <TouchableOpacity
                        key={tab.key}
                        style={[
                            styles.tabItem,
                            activeTab === tab.key && styles.tabItemActive,
                        ]}
                        onPress={() => setActiveTab(tab.key)}
                        activeOpacity={0.7}
                    >
                        <Text style={[
                            styles.tabLabel,
                            activeTab === tab.key && styles.tabLabelActive,
                        ]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Tab content */}
            <View style={{ flex: 1 }}>
                {activeTab === 'odontogram' && (
                    <OdontogramSurfaceTab
                        data={odontogramData}
                        loading={loading.odontogram}
                        error={errors.odontogram}
                        onRetry={fetchOdontogram}
                    />
                )}
                {activeTab === 'radiograph' && (
                    <RadiographTab
                        radiographs={radiographs}
                        loading={loading.radiograph}
                        error={errors.radiograph}
                        onRetry={fetchRadiographs}
                        navigation={navigation}
                    />
                )}
                {activeTab === 'medical' && (
                    <MedicalHistoryTab
                        profile={profile}
                        loading={loading.medical}
                        error={errors.medical}
                        onRetry={fetchMedicalHistory}
                    />
                )}
            </View>

        </Screen>
    );
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const shared = StyleSheet.create({
    emptyBox:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 40 },
    emptyTitle: { fontSize: 16, fontWeight: 'bold', color: mobileTheme.colors.text, marginBottom: 8, textAlign: 'center' },
    emptySub:   { fontSize: 13, color: mobileTheme.colors.textSoft, textAlign: 'center', lineHeight: 19 },
    loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 60 },
    loadingText:{ color: mobileTheme.colors.textSoft, marginTop: 12, fontSize: 14 },
    errorBox:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, marginTop: 40 },
    errorText:  { color: '#d32f2f', fontSize: 14, textAlign: 'center', marginBottom: 16 },
    retryBtn:   { backgroundColor: mobileTheme.colors.primary, paddingHorizontal: 24, paddingVertical: 11, borderRadius: 999 },
    retryText:  { color: 'white', fontWeight: 'bold', fontSize: 14 },
});

// ─── Screen styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container:   { flex: 1, backgroundColor: mobileTheme.colors.background },
    heroCard: {
        marginHorizontal: 18,
        marginBottom: 16,
        backgroundColor: mobileTheme.colors.primary,
        borderRadius: 24,
        padding: 18,
        flexDirection: 'row',
        alignItems: 'center',
    },
    heroIconBubble: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.18)',
        marginRight: 14,
    },
    heroCopy: {
        flex: 1,
    },
    heroTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#ffffff',
        marginBottom: 6,
    },
    heroText: {
        fontSize: 12,
        lineHeight: 18,
        color: 'rgba(255,255,255,0.86)',
    },

    // Tab bar
    tabBar: {
        flexDirection: 'row',
        marginHorizontal: 18,
        marginBottom: 10,
        backgroundColor: mobileTheme.colors.surface,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: mobileTheme.colors.border,
        padding: 6,
        ...mobileTheme.shadows.soft,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 11,
        borderRadius: 16,
    },
    tabItemActive: {
        backgroundColor: mobileTheme.colors.primarySoft,
    },
    tabLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: mobileTheme.colors.textSoft,
    },
    tabLabelActive:{
        color: mobileTheme.colors.primaryDark,
    },

    // Treatment log cards
    logCard:      { backgroundColor: 'white', borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: mobileTheme.colors.border, overflow: 'hidden', ...mobileTheme.shadows.soft },
    logCardOpen:  { borderColor: mobileTheme.colors.primary },
    logHeader:    { flexDirection: 'row', alignItems: 'flex-start', padding: 14 },
    logDateBox:   { alignItems: 'center', width: 48, marginRight: 12 },
    logMonth:     { fontSize: 10, fontWeight: 'bold', color: '#01538b', textTransform: 'uppercase' },
    logDay:       { fontSize: 22, fontWeight: 'bold', color: '#01538b', lineHeight: 24 },
    logYear:      { fontSize: 10, color: mobileTheme.colors.textSoft },
    logMeta:      { flex: 1 },
    logTitleRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
    logProcedure: { fontSize: 14, fontWeight: 'bold', color: mobileTheme.colors.text, flex: 1 },
    logCategory:  { fontSize: 11, color: mobileTheme.colors.textSoft, marginBottom: 2 },
    logDentist:   { fontSize: 12, color: mobileTheme.colors.textMuted },
    logTooth:     { fontSize: 11, color: mobileTheme.colors.textSoft, marginTop: 2 },
    logNotesBox:  { backgroundColor: mobileTheme.colors.surfaceAlt, padding: 14, borderTopWidth: 1, borderTopColor: mobileTheme.colors.border },
    logNotesLabel:{ fontSize: 11, fontWeight: 'bold', color: mobileTheme.colors.primary, marginBottom: 4 },
    logNotes:     { fontSize: 13, color: mobileTheme.colors.textMuted, lineHeight: 19 },

    // Odontogram
    odontogramCard:   { backgroundColor: 'white', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: mobileTheme.colors.border, ...mobileTheme.shadows.soft },
    odontogramTitle:  { fontSize: 16, fontWeight: 'bold', color: mobileTheme.colors.primary, marginBottom: 2 },
    odontogramSub:    { fontSize: 11, color: mobileTheme.colors.textSoft, marginBottom: 16 },
    odontogramEmpty:  { backgroundColor: mobileTheme.colors.surfaceAlt, padding: 16, borderRadius: 14, marginBottom: 12 },
    odontogramEmptyText: { fontSize: 13, color: mobileTheme.colors.textSoft, textAlign: 'center', lineHeight: 19 },
    jawLabel:     { fontSize: 11, fontWeight: '700', color: mobileTheme.colors.textSoft, textAlign: 'center', letterSpacing: 1, marginVertical: 8 },
    jawScroll:    { paddingHorizontal: 2 },
    jawRow:       { flexDirection: 'row', flexWrap: 'nowrap', justifyContent: 'center', alignItems: 'flex-start' },
    midline:      { width: 2, height: 74, backgroundColor: '#dbe6ef', marginHorizontal: 6, marginTop: 8, borderRadius: 999 },
    jawDivider:   { height: 1, backgroundColor: '#e0e7ef', marginVertical: 8 },
    toothFigure:  { width: 52, alignItems: 'center', marginHorizontal: 2, paddingVertical: 4, borderRadius: 14 },
    toothFigureSelected: { backgroundColor: 'rgba(1,83,139,0.08)' },
    toothSvg:     { marginBottom: 6 },
    toothNum:     { fontSize: 10, fontWeight: '800', color: mobileTheme.colors.textSoft, marginBottom: 4 },
    toothTapHint: { fontSize: 9, fontWeight: '800', color: mobileTheme.colors.textSoft, textTransform: 'uppercase' },
    toothTapHintSelected: { color: mobileTheme.colors.primaryDark },
    toothStatusPill: { minHeight: 28, minWidth: 40, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    toothStatusText: { fontSize: 8, fontWeight: '800', textAlign: 'center', lineHeight: 10 },
    toothSurfaceRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 4, marginTop: 5 },
    toothSurfaceBadge: { minWidth: 18, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(1,83,139,0.08)' },
    toothSurfaceBadgeText: { fontSize: 8, fontWeight: '800', color: mobileTheme.colors.primary, textAlign: 'center' },
    legendTitle:  { fontSize: 13, fontWeight: 'bold', color: mobileTheme.colors.text, marginBottom: 10 },
    legendGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    legendItem:   { flexDirection: 'row', alignItems: 'center' },
    legendDot:    { width: 14, height: 14, borderRadius: 4, borderWidth: 1, marginRight: 5 },
    legendLabel:  { fontSize: 11, color: mobileTheme.colors.textMuted },
    surfaceKeyList: { backgroundColor: mobileTheme.colors.surfaceAlt, borderRadius: 14, padding: 12, marginBottom: 16, gap: 8 },
    surfaceKeyItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    surfaceKeyBubble: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(1,83,139,0.08)', alignItems: 'center', justifyContent: 'center' },
    surfaceKeyBubbleText: { fontSize: 10, fontWeight: '800', color: mobileTheme.colors.primary },
    surfaceKeyItemText: { fontSize: 11, color: mobileTheme.colors.textMuted },
    selectedToothCard: { marginTop: 16, borderWidth: 1, borderRadius: 16, padding: 14 },
    selectedToothEyebrow: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: 6 },
    selectedToothTitle: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
    selectedToothBody: { fontSize: 12, lineHeight: 18, color: mobileTheme.colors.textMuted },
    selectedToothPlaceholder: { marginTop: 16, backgroundColor: mobileTheme.colors.surfaceAlt, borderRadius: 16, padding: 14 },
    selectedToothPlaceholderText: { fontSize: 12, lineHeight: 18, color: mobileTheme.colors.textSoft, textAlign: 'center' },
    readOnlyBanner: { backgroundColor: mobileTheme.colors.primarySoft, padding: 12, borderRadius: 14, alignItems: 'center' },
    readOnlyText:   { fontSize: 12, color: mobileTheme.colors.primaryDark },

    // Radiograph cards
    xrayCard:          { flex: 1, backgroundColor: 'white', borderRadius: 18, marginBottom: 12, borderWidth: 1, borderColor: mobileTheme.colors.border, overflow: 'hidden', ...mobileTheme.shadows.soft },
    xrayThumb:         { backgroundColor: '#1a1a2e', height: 90, alignItems: 'center', justifyContent: 'center' },
    xrayAvailableDot:  { position: 'absolute', top: 8, right: 8, width: 10, height: 10, borderRadius: 5, backgroundColor: '#4caf50' },
    xrayInfo:          { padding: 10 },
    xrayLabel:         { fontSize: 13, fontWeight: 'bold', color: mobileTheme.colors.text, marginBottom: 3 },
    xrayDate:          { fontSize: 11, color: mobileTheme.colors.textSoft, marginBottom: 2 },
    xrayMeta:          { fontSize: 11, color: '#64748b', marginBottom: 2 },
    xrayNotes:         { fontSize: 11, color: mobileTheme.colors.textSoft, marginBottom: 4 },
    xrayTapHint:       { fontSize: 10, color: mobileTheme.colors.primary, fontWeight: '700' },

    // History cards
    historyCard:       { backgroundColor: 'white', borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: mobileTheme.colors.border, flexDirection: 'row', gap: 12 },
    historyLeft:       { width: 72, alignItems: 'center' },
    historyDate:       { fontSize: 12, fontWeight: 'bold', color: '#01538b', textAlign: 'center' },
    historyRight:      { flex: 1 },
    historyProcedure:  { fontSize: 14, fontWeight: 'bold', color: mobileTheme.colors.text, marginBottom: 3 },
    historyStatusPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
    historyStatusText: { fontSize: 11, fontWeight: 'bold' },
    historySectionCard: { backgroundColor: 'white', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: mobileTheme.colors.border, ...mobileTheme.shadows.soft },
    historySectionTitle: { fontSize: 16, fontWeight: '800', color: mobileTheme.colors.primary, marginBottom: 14 },
    detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    detailRowPair: { flexDirection: 'row', gap: 12, marginBottom: 12 },
    detailCell: { flex: 1, minWidth: 140, backgroundColor: mobileTheme.colors.surfaceAlt, borderRadius: 14, padding: 12 },
    detailLabel: { fontSize: 11, fontWeight: '700', color: '#64748b', marginBottom: 6, textTransform: 'uppercase' },
    detailValue: { fontSize: 13, lineHeight: 18, color: mobileTheme.colors.textMuted },
    detailChecklistSection: { marginTop: 14 },
    checklistGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
    checklistItem: { width: '47%', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: mobileTheme.colors.surfaceAlt, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9 },
    checklistText: { flex: 1, fontSize: 12, color: mobileTheme.colors.textMuted },
});




