import React from 'react';
import styles from '../../../styles/dentist/Odontogram.module.css';

const SURFACE_CODES = ['M', 'D', 'O', 'B', 'L'];
const SURFACE_SELECTABLE_STATUSES = new Set(['filled', 'decayed', 'fractured', 'under-observation']);
const WHOLE_TOOTH_STATUSES = new Set(['crown', 'implant', 'bridge', 'extraction-site', 'missing', 'mobility', 'root-canal']);

const FACE_GEOMETRY = {
    incisor: {
        outline: 'M22 8 C24 6 32 6 34 8 L38 14 C39 16 39 20 38 24 L35 36 C34 41 31 47 28 52 C25 47 22 41 21 36 L18 24 C17 20 17 16 18 14 Z',
        cervical: 'M20 35 C24 38 32 38 36 35',
        grooves: ['M25 14 C24 23 24 33 25 43', 'M31 14 C32 23 32 33 31 43'],
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
        cervical: 'M22 36 C25 39 31 39 34 36',
        grooves: ['M28 9 C27 20 27 34 28 48'],
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
        cervical: 'M19 38 C24 42 32 42 37 38',
        grooves: ['M24 14 C23 24 23 36 24 48', 'M32 14 C33 24 33 36 32 48', 'M22 28 C26 30 30 30 34 28'],
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
        cervical: 'M15 40 C21 45 35 45 41 40',
        grooves: ['M21 16 C20 27 20 38 21 49', 'M35 16 C36 27 36 38 35 49', 'M18 28 C24 31 32 31 38 28'],
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
        grooves: ['M24 18 L32 28', 'M32 18 L24 28'],
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
        grooves: ['M25 18 L31 28', 'M31 18 L25 28'],
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
        grooves: ['M24 20 C27 23 29 27 28 33', 'M32 20 C29 23 27 27 28 33', 'M23 26 H33'],
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
        grooves: ['M21 20 C25 23 27 27 28 34', 'M35 20 C31 23 29 27 28 34', 'M20 30 C25 28 31 28 36 30', 'M28 13 V34'],
        surfaces: {
            M: '12,18 21,20 20,30 12,27',
            D: '35,20 44,18 44,27 36,30',
            O: '21,20 35,20 36,30 28,34 20,30',
            B: '18,12 38,12 35,20 21,20',
            L: '20,30 28,34 36,30 38,36 18,36',
        },
    },
};

const SURFACE_LABEL_POINTS = {
    face: {
        M: { x: 20.8, y: 27.5 },
        D: { x: 35.2, y: 27.5 },
        O: { x: 28, y: 12.5 },
        B: { x: 28, y: 29 },
        L: { x: 28, y: 29 },
    },
    top: {
        M: { x: 18, y: 24 },
        D: { x: 38, y: 24 },
        O: { x: 28, y: 25 },
        B: { x: 28, y: 16 },
        L: { x: 28, y: 34 },
    },
};

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

const getHighlightedSurfaces = (statusKey, surfaces) => {
    if (statusKey === 'healthy') return new Set();
    if (WHOLE_TOOTH_STATUSES.has(statusKey)) return new Set(SURFACE_CODES);
    if (surfaces.length > 0) return new Set(surfaces);
    return new Set(SURFACE_CODES);
};

const supportsSurfaceSelection = (statusKey) => SURFACE_SELECTABLE_STATUSES.has(statusKey);
const faceCenterSurface = (viewType) => (viewType === 'front' ? 'B' : 'L');

const shouldShowSurfaceLabel = (surfaceCode, activeSurfaces, editorMode) => (
    editorMode || activeSurfaces.has(surfaceCode)
);

export const getClinicalToothRows = (toothNumber) => (
    isUpperTooth(toothNumber) ? ['front', 'top', 'back'] : ['back', 'top', 'front']
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
    statusMeta,
    surfaces,
    stageKey,
    stageMeta,
    editorMode = false,
    onToggleSurface,
    svgClassName,
}) {
    const familyGeometry = FACE_GEOMETRY[getToothFamily(toothNumber)];
    const activeSurfaces = getHighlightedSurfaces(statusKey, surfaces);
    const canToggle = editorMode && supportsSurfaceSelection(statusKey);
    const centerSurface = faceCenterSurface(viewType);
    const baseStroke = '#d4dde7';
    const outlineStroke = statusKey === 'healthy' ? '#b8c5d1' : statusMeta.stroke;
    const centerLabelPoint = SURFACE_LABEL_POINTS.face[centerSurface];

    const regionFill = (surfaceCode) => {
        if (!activeSurfaces.has(surfaceCode)) return '#ffffff';
        if (stageKey === 'planned' && statusKey !== 'healthy') return '#fffef8';
        return statusMeta.fill;
    };

    const regionStroke = (surfaceCode) => {
        if (!activeSurfaces.has(surfaceCode)) return baseStroke;
        if (stageKey === 'completed') return stageMeta.accent;
        return statusMeta.stroke;
    };

    const renderOverlay = () => {
        if (statusKey === 'missing' || statusKey === 'extraction-site') {
            return (
                <g stroke={statusMeta.accent} strokeWidth="2.2" strokeLinecap="round" opacity="0.85">
                    <line x1="14" y1="10" x2="42" y2="43" />
                    <line x1="42" y1="10" x2="14" y2="43" />
                </g>
            );
        }

        if (statusKey === 'bridge') {
            return <path d="M13 25 H43" fill="none" stroke={statusMeta.accent} strokeWidth="3" strokeLinecap="round" opacity="0.86" />;
        }

        if (statusKey === 'implant') {
            return (
                <g fill="none" stroke={statusMeta.accent} strokeWidth="2.1" strokeLinecap="round">
                    <path d="M28 27 V54" />
                    <path d="M23 33 H33" />
                    <path d="M24 39 H32" />
                    <path d="M24 45 H32" />
                </g>
            );
        }

        if (statusKey === 'root-canal') {
            return (
                <g fill="none" stroke={statusMeta.accent} strokeWidth="2.1" strokeLinecap="round">
                    <path d="M28 16 V58" />
                    <path d="M24 22 H32" />
                </g>
            );
        }

        if (statusKey === 'fractured') {
            return <path d="M22 12 L32 20 L26 28 L34 38" fill="none" stroke={statusMeta.accent} strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />;
        }

        if (statusKey === 'under-observation') {
            return <ellipse cx="28" cy="25" rx="12" ry="15" fill="none" stroke={statusMeta.accent} strokeWidth="1.9" strokeDasharray="3 3" />;
        }

        if (statusKey === 'crown') {
            return <path d="M18 11 H38" fill="none" stroke={statusMeta.accent} strokeWidth="1.9" strokeLinecap="round" opacity="0.7" />;
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
                fill="#fbfdff"
                stroke={outlineStroke}
                strokeWidth="1.7"
                strokeLinejoin="round"
                strokeDasharray={statusKey === 'mobility' ? '3 2' : stageKey === 'planned' ? '2.6 1.6' : undefined}
            />

            <SurfaceButton surfaceCode="M" isActive={activeSurfaces.has('M')} onToggle={onToggleSurface} editorMode={canToggle} regionClassName={styles.surfaceRegion}>
                <polygon points={familyGeometry.surfaces.M} fill={regionFill('M')} stroke={regionStroke('M')} strokeWidth="1.1" />
                {shouldShowSurfaceLabel('M', activeSurfaces, editorMode) && (
                    <text className={styles.surfaceSvgLabel} x={SURFACE_LABEL_POINTS.face.M.x} y={SURFACE_LABEL_POINTS.face.M.y}>M</text>
                )}
            </SurfaceButton>

            <SurfaceButton surfaceCode={centerSurface} isActive={activeSurfaces.has(centerSurface)} onToggle={onToggleSurface} editorMode={canToggle} regionClassName={styles.surfaceRegion}>
                <polygon points={familyGeometry.surfaces.C} fill={regionFill(centerSurface)} stroke={regionStroke(centerSurface)} strokeWidth="1.1" />
                {shouldShowSurfaceLabel(centerSurface, activeSurfaces, editorMode) && (
                    <text className={styles.surfaceSvgLabel} x={centerLabelPoint.x} y={centerLabelPoint.y}>{centerSurface}</text>
                )}
            </SurfaceButton>

            <SurfaceButton surfaceCode="D" isActive={activeSurfaces.has('D')} onToggle={onToggleSurface} editorMode={canToggle} regionClassName={styles.surfaceRegion}>
                <polygon points={familyGeometry.surfaces.D} fill={regionFill('D')} stroke={regionStroke('D')} strokeWidth="1.1" />
                {shouldShowSurfaceLabel('D', activeSurfaces, editorMode) && (
                    <text className={styles.surfaceSvgLabel} x={SURFACE_LABEL_POINTS.face.D.x} y={SURFACE_LABEL_POINTS.face.D.y}>D</text>
                )}
            </SurfaceButton>

            <SurfaceButton surfaceCode="O" isActive={activeSurfaces.has('O')} onToggle={onToggleSurface} editorMode={canToggle} regionClassName={styles.surfaceRegion}>
                <polygon points={familyGeometry.surfaces.O} fill={regionFill('O')} stroke={regionStroke('O')} strokeWidth="1.05" />
                {shouldShowSurfaceLabel('O', activeSurfaces, editorMode) && (
                    <text className={styles.surfaceSvgLabel} x={SURFACE_LABEL_POINTS.face.O.x} y={SURFACE_LABEL_POINTS.face.O.y}>O</text>
                )}
            </SurfaceButton>

            <path d={familyGeometry.cervical} fill="none" stroke="#9fb0c1" strokeWidth="0.9" strokeLinecap="round" strokeDasharray="2 2" opacity="0.66" />

            {familyGeometry.grooves.map((groovePath, index) => (
                <path key={`${toothNumber}-${viewType}-groove-${index}`} d={groovePath} fill="none" stroke="#9fb0c1" strokeWidth="0.72" strokeLinecap="round" opacity="0.58" />
            ))}

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
    statusMeta,
    surfaces,
    stageKey,
    stageMeta,
    editorMode = false,
    onToggleSurface,
    svgClassName,
}) {
    const familyGeometry = TOP_GEOMETRY[getToothFamily(toothNumber)];
    const activeSurfaces = getHighlightedSurfaces(statusKey, surfaces);
    const canToggle = editorMode && supportsSurfaceSelection(statusKey);
    const outlineStroke = statusKey === 'healthy' ? '#b8c5d1' : statusMeta.stroke;
    const baseStroke = '#d4dde7';
    const upperTooth = isUpperTooth(toothNumber);
    const buccalSurface = upperTooth ? 'B' : 'L';
    const lingualSurface = upperTooth ? 'L' : 'B';

    const regionFill = (surfaceCode) => {
        if (!activeSurfaces.has(surfaceCode)) return '#ffffff';
        if (stageKey === 'planned' && statusKey !== 'healthy') return '#fffef8';
        return statusMeta.fill;
    };

    const regionStroke = (surfaceCode) => {
        if (!activeSurfaces.has(surfaceCode)) return baseStroke;
        if (stageKey === 'completed') return stageMeta.accent;
        return statusMeta.stroke;
    };

    const renderOverlay = () => {
        if (statusKey === 'missing' || statusKey === 'extraction-site') {
            return (
                <g stroke={statusMeta.accent} strokeWidth="2.1" strokeLinecap="round" opacity="0.84">
                    <line x1="13" y1="11" x2="43" y2="34" />
                    <line x1="43" y1="11" x2="13" y2="34" />
                </g>
            );
        }

        if (statusKey === 'bridge') {
            return <path d="M12 23 H44" fill="none" stroke={statusMeta.accent} strokeWidth="2.8" strokeLinecap="round" opacity="0.86" />;
        }

        if (statusKey === 'implant') {
            return (
                <g fill="none" stroke={statusMeta.accent} strokeWidth="1.9">
                    <circle cx="28" cy="23" r="8" />
                    <path d="M28 15 V31" />
                    <path d="M20 23 H36" />
                </g>
            );
        }

        if (statusKey === 'root-canal') {
            return <circle cx="28" cy="23" r="7" fill="none" stroke={statusMeta.accent} strokeWidth="2.1" />;
        }

        if (statusKey === 'fractured') {
            return <path d="M22 12 L32 20 L26 26 L36 33" fill="none" stroke={statusMeta.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />;
        }

        if (statusKey === 'under-observation') {
            return <ellipse cx="28" cy="23" rx="13" ry="11" fill="none" stroke={statusMeta.accent} strokeWidth="1.9" strokeDasharray="3 3" />;
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
                fill="#fbfdff"
                stroke={outlineStroke}
                strokeWidth="1.7"
                strokeLinejoin="round"
                strokeDasharray={statusKey === 'mobility' ? '3 2' : stageKey === 'planned' ? '2.6 1.6' : undefined}
            />

            <SurfaceButton surfaceCode="M" isActive={activeSurfaces.has('M')} onToggle={onToggleSurface} editorMode={canToggle} regionClassName={styles.surfaceRegion}>
                <polygon points={familyGeometry.surfaces.M} fill={regionFill('M')} stroke={regionStroke('M')} strokeWidth="1.1" />
                {shouldShowSurfaceLabel('M', activeSurfaces, editorMode) && (
                    <text className={styles.surfaceSvgLabel} x={SURFACE_LABEL_POINTS.top.M.x} y={SURFACE_LABEL_POINTS.top.M.y}>M</text>
                )}
            </SurfaceButton>

            <SurfaceButton surfaceCode="D" isActive={activeSurfaces.has('D')} onToggle={onToggleSurface} editorMode={canToggle} regionClassName={styles.surfaceRegion}>
                <polygon points={familyGeometry.surfaces.D} fill={regionFill('D')} stroke={regionStroke('D')} strokeWidth="1.1" />
                {shouldShowSurfaceLabel('D', activeSurfaces, editorMode) && (
                    <text className={styles.surfaceSvgLabel} x={SURFACE_LABEL_POINTS.top.D.x} y={SURFACE_LABEL_POINTS.top.D.y}>D</text>
                )}
            </SurfaceButton>

            <SurfaceButton surfaceCode="O" isActive={activeSurfaces.has('O')} onToggle={onToggleSurface} editorMode={canToggle} regionClassName={styles.surfaceRegion}>
                <polygon points={familyGeometry.surfaces.O} fill={regionFill('O')} stroke={regionStroke('O')} strokeWidth="1.1" />
                {shouldShowSurfaceLabel('O', activeSurfaces, editorMode) && (
                    <text className={styles.surfaceSvgLabel} x={SURFACE_LABEL_POINTS.top.O.x} y={SURFACE_LABEL_POINTS.top.O.y}>O</text>
                )}
            </SurfaceButton>

            <SurfaceButton surfaceCode={buccalSurface} isActive={activeSurfaces.has(buccalSurface)} onToggle={onToggleSurface} editorMode={canToggle} regionClassName={styles.surfaceRegion}>
                <polygon points={familyGeometry.surfaces.B} fill={regionFill(buccalSurface)} stroke={regionStroke(buccalSurface)} strokeWidth="1.1" />
                {shouldShowSurfaceLabel(buccalSurface, activeSurfaces, editorMode) && (
                    <text className={styles.surfaceSvgLabel} x={SURFACE_LABEL_POINTS.top.B.x} y={SURFACE_LABEL_POINTS.top.B.y}>{buccalSurface}</text>
                )}
            </SurfaceButton>

            <SurfaceButton surfaceCode={lingualSurface} isActive={activeSurfaces.has(lingualSurface)} onToggle={onToggleSurface} editorMode={canToggle} regionClassName={styles.surfaceRegion}>
                <polygon points={familyGeometry.surfaces.L} fill={regionFill(lingualSurface)} stroke={regionStroke(lingualSurface)} strokeWidth="1.1" />
                {shouldShowSurfaceLabel(lingualSurface, activeSurfaces, editorMode) && (
                    <text className={styles.surfaceSvgLabel} x={SURFACE_LABEL_POINTS.top.L.x} y={SURFACE_LABEL_POINTS.top.L.y}>{lingualSurface}</text>
                )}
            </SurfaceButton>

            {familyGeometry.grooves.map((groovePath, index) => (
                <path key={`${toothNumber}-top-groove-${index}`} d={groovePath} fill="none" stroke="#8fa1b3" strokeWidth="0.78" strokeLinecap="round" opacity="0.62" />
            ))}

            {renderOverlay()}
            {renderStageMarker()}
        </svg>
    );
}

export default function ClinicalToothView({
    toothNumber,
    viewType,
    statusKey,
    statusMeta,
    surfaces,
    stageKey,
    stageMeta,
    editorMode = false,
    onToggleSurface,
    className,
}) {
    if (viewType === 'top') {
        return (
            <TopView
                toothNumber={toothNumber}
                statusKey={statusKey}
                statusMeta={statusMeta}
                surfaces={surfaces}
                stageKey={stageKey}
                stageMeta={stageMeta}
                editorMode={editorMode}
                onToggleSurface={onToggleSurface}
                svgClassName={className}
            />
        );
    }

    return (
        <FaceView
            toothNumber={toothNumber}
            viewType={viewType}
            statusKey={statusKey}
            statusMeta={statusMeta}
            surfaces={surfaces}
            stageKey={stageKey}
            stageMeta={stageMeta}
            editorMode={editorMode}
            onToggleSurface={onToggleSurface}
            svgClassName={className}
        />
    );
}
