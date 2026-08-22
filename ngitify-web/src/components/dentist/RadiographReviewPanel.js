import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FaArrowLeft, FaCompress, FaHandPaper, FaMagic, FaMinus, FaPlus, FaRobot, FaTrash } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import styles from './RadiographReviewPanel.module.css';

const FDI_TEETH = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28,48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38].map(String);
const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Date not recorded';
const formatMetric = (value) => Number.isFinite(Number(value)) ? Number(value).toFixed(1) : '—';
const reviewStatusLabel = (status) => ({ approved: 'Dentist Verified', draft: 'Draft Review' }[status] || 'Review Pending');
const reviewStatusTone = (status) => ({ approved: 'reviewStatusApproved', draft: 'reviewStatusDraft' }[status] || 'reviewStatusPending');
const getSummaryEditorText = (reviewSummary = {}) => {
    if (String(reviewSummary.revisionDraft || '').trim()) return reviewSummary.revisionDraft;
    if (reviewSummary.status === 'approved') return reviewSummary.approvedText || '';
    return reviewSummary.draft || '';
};
const validateFindingFields = (value = {}) => {
    const errors = {};
    const findingType = String(value.findingType || '').trim();
    const note = String(value.note || '');
    if (!findingType) errors.findingType = 'Required';
    else if (findingType.length > 160) errors.findingType = 'Must be 160 characters or fewer';
    if (note.length > 2000) errors.note = 'Must be 2000 characters or fewer';
    return errors;
};

export const toNormalizedImagePoint = ({ clientX, clientY }, rect) => ({
    type: 'point',
    x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
    y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
    width: 0,
    height: 0,
});

export default function RadiographReviewPanel({ patientId, radiograph, radiographs = [], treatmentLogs = [], onChange, onClose, onEnhance, onDelete }) {
    const [activeTab, setActiveTab] = useState('quality');
    const [view, setView] = useState('original');
    const [compareEnhancement, setCompareEnhancement] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [grabMode, setGrabMode] = useState(false);
    const [isDraggingImage, setIsDraggingImage] = useState(false);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [displayAdjustments, setDisplayAdjustments] = useState({ brightness: 100, contrast: 100 });
    const [busy, setBusy] = useState('');
    const [compareId, setCompareId] = useState('');
    const [annotationMode, setAnnotationMode] = useState(false);
    const [geometry, setGeometry] = useState(null);
    const [finding, setFinding] = useState({ toothNumber: '', findingType: '', note: '', linkToOdontogram: true, treatmentLogId: '' });
    const [findingErrors, setFindingErrors] = useState({});
    const [editingFindingId, setEditingFindingId] = useState('');
    const [editingFinding, setEditingFinding] = useState(null);
    const [editingFindingErrors, setEditingFindingErrors] = useState({});
    const [showArchivedFindings, setShowArchivedFindings] = useState(false);
    const [deletingFindingId, setDeletingFindingId] = useState('');
    const [deletionReason, setDeletionReason] = useState('');
    const [summaryText, setSummaryText] = useState(getSummaryEditorText(radiograph.reviewSummary));
    const [manualReviewConfirmed, setManualReviewConfirmed] = useState(Boolean(radiograph.manualReview?.reviewedAt));
    const [summaryReviewError, setSummaryReviewError] = useState('');
    const [message, setMessage] = useState('');
    const [messageTone, setMessageTone] = useState('info');
    const [isImproving, setIsImproving] = useState(false);
    const improveInFlightRef = useRef(false);
    const dragStateRef = useRef(null);

    const analysis = radiograph.analysis || { status: 'not-analyzed', detections: [] };
    const previousOptions = useMemo(() => radiographs.filter((item) => item.id !== radiograph.id && new Date(item.date || item.rawDate) < new Date(radiograph.date || radiograph.rawDate)).sort((a, b) => new Date(b.date || b.rawDate) - new Date(a.date || a.rawDate)), [radiographs, radiograph]);
    const comparison = previousOptions.find((item) => item.id === compareId);
    const imageUrl = view === 'enhanced' && radiograph.enhancedUrl ? radiograph.enhancedUrl : radiograph.url;
    const qualityLabel = analysis.qualityAssessment?.label || (analysis.status === 'failed' ? 'Unavailable' : 'Not analyzed');
    const qualityTone = analysis.status === 'failed' ? 'statusError' : analysis.qualityAssessment?.label ? 'statusSuccess' : 'statusNeutral';
    const enhancementVariant = radiograph.enhancementVariants?.basic || {};
    const enhancementMetadata = enhancementVariant.metadata || null;
    const enhancementFeedback = enhancementVariant.feedback || {};
    const reviewSummary = radiograph.reviewSummary || {};
    const hasApprovedSummary = reviewSummary.status === 'approved' && Boolean(String(reviewSummary.approvedText || '').trim());
    const hasRevisionDraft = hasApprovedSummary && Boolean(String(reviewSummary.revisionDraft || '').trim());
    const hasInitialDraft = reviewSummary.status === 'draft' && Boolean(String(reviewSummary.draft || '').trim());
    const isEditingSummary = hasInitialDraft || hasRevisionDraft;
    const summaryNeedsRevision = hasApprovedSummary && Boolean(reviewSummary.findingsChangedAt);
    const activeFindings = (radiograph.annotations || []).filter((item) => !['archived', 'deleted'].includes(String(item.status || 'active')));
    const archivedFindings = (radiograph.annotations || []).filter((item) => item.status === 'archived');

    useEffect(() => {
        if (!message) return undefined;
        const timeoutId = window.setTimeout(() => setMessage(''), 4500);
        return () => window.clearTimeout(timeoutId);
    }, [message]);

    const request = async (endpoint, options = {}) => {
        setBusy(endpoint);
        setMessage('');
        setMessageTone('info');
        try {
            const response = await authFetch(endpoint, options);
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'The request could not be completed.');
            if (data.radiograph) {
                onChange(data.radiograph);
                setSummaryText(getSummaryEditorText(data.radiograph.reviewSummary));
            }
            setMessage(data.message || 'Saved.');
            setMessageTone('success');
            return data;
        } catch (error) {
            setMessage(error.message);
            setMessageTone('error');
            return null;
        } finally {
            setBusy('');
        }
    };

    const analyze = () => request(`/patients/${patientId}/radiographs/${radiograph.id}/analyze`, { method: 'POST' });
    const generateSummary = () => request(`/patients/${patientId}/radiographs/${radiograph.id}/generate-summary`, { method: 'POST' });
    const cancelSummaryRevision = () => request(`/patients/${patientId}/radiographs/${radiograph.id}/cancel-summary-revision`, { method: 'POST' });
    const approveSummary = () => {
        if (!manualReviewConfirmed) {
            setSummaryReviewError('Please confirm that you manually reviewed this radiograph image before approving the summary.');
            return null;
        }
        setSummaryReviewError('');
        return request(`/patients/${patientId}/radiographs/${radiograph.id}/approve-summary`, { method: 'POST', body: JSON.stringify({ text: summaryText, manualReviewConfirmed }) });
    };
    const submitEnhancementFeedback = (rating) => request(
        `/patients/${patientId}/radiographs/${radiograph.id}/enhancement-feedback`,
        { method: 'POST', body: JSON.stringify({ engine: 'basic', rating }) }
    );

    const placeAnnotation = (event) => {
        if (!annotationMode) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        setGeometry(toNormalizedImagePoint(event, rect));
        setFindingErrors((current) => ({ ...current, geometry: '' }));
        setActiveTab('findings');
        setAnnotationMode(false);
    };

    const updateFindingField = (field, value) => {
        setFinding((current) => ({ ...current, [field]: value }));
        if (findingErrors[field]) setFindingErrors((current) => ({ ...current, [field]: '' }));
    };

    const updateEditingFindingField = (field, value) => {
        setEditingFinding((current) => ({ ...current, [field]: value }));
        if (editingFindingErrors[field]) setEditingFindingErrors((current) => ({ ...current, [field]: '' }));
    };

    const saveFinding = async () => {
        const errors = { ...validateFindingFields(finding), ...(!geometry ? { geometry: 'Required' } : {}) };
        setFindingErrors(errors);
        if (Object.keys(errors).length) {
            if (!geometry) setAnnotationMode(true);
            return;
        }
        const result = await request(`/patients/${patientId}/radiographs/${radiograph.id}/annotations`, { method: 'POST', body: JSON.stringify({ ...finding, geometry }) });
        if (result) {
            setFinding({ toothNumber: '', findingType: '', note: '', linkToOdontogram: true, treatmentLogId: '' });
            setFindingErrors({});
            setGeometry(null);
        }
    };

    const startEditingFinding = (item) => {
        setEditingFindingId(String(item._id || item.id));
        setEditingFinding({
            toothNumber: item.toothNumber || '',
            findingType: item.findingType || '',
            note: item.note || '',
            linkToOdontogram: Boolean(item.linkToOdontogram),
            treatmentLogId: item.treatmentLogId || '',
        });
        setEditingFindingErrors({});
        setDeletingFindingId('');
        setDeletionReason('');
    };

    const cancelEditingFinding = () => {
        setEditingFindingId('');
        setEditingFinding(null);
        setEditingFindingErrors({});
    };

    const saveEditedFinding = async () => {
        if (!editingFindingId || !editingFinding) return;
        const errors = validateFindingFields(editingFinding);
        setEditingFindingErrors(errors);
        if (Object.keys(errors).length) return;
        const result = await request(`/patients/${patientId}/radiographs/${radiograph.id}/annotations/${editingFindingId}`, { method: 'PATCH', body: JSON.stringify(editingFinding) });
        if (result) cancelEditingFinding();
    };

    const archiveFinding = (item) => request(`/patients/${patientId}/radiographs/${radiograph.id}/annotations/${item._id || item.id}/archive`, { method: 'POST', body: JSON.stringify({ reason: 'Archived from Radiograph Review.' }) });
    const restoreFinding = (item) => request(`/patients/${patientId}/radiographs/${radiograph.id}/annotations/${item._id || item.id}/restore`, { method: 'POST', body: JSON.stringify({ reason: 'Restored from Radiograph Review.' }) });

    const confirmDeleteFinding = async () => {
        if (!deletingFindingId) return;
        if (!deletionReason.trim()) {
            setMessageTone('error');
            setMessage('Enter a reason before deleting this clinical finding.');
            return;
        }
        const result = await request(`/patients/${patientId}/radiographs/${radiograph.id}/annotations/${deletingFindingId}`, { method: 'DELETE', body: JSON.stringify({ reason: deletionReason }) });
        if (result) {
            setDeletingFindingId('');
            setDeletionReason('');
            if (editingFindingId === deletingFindingId) cancelEditingFinding();
        }
    };

    const improveImage = async () => {
        if (improveInFlightRef.current || !radiograph.url) return;
        improveInFlightRef.current = true;
        setIsImproving(true);
        setMessage('');
        setMessageTone('info');
        try {
            const succeeded = await onEnhance?.('basic');
            if (succeeded === false) {
                setMessageTone('error');
                setMessage('Auto Improve could not be completed. Please try again.');
            } else {
                setView('enhanced');
                setCompareEnhancement(false);
            }
        } catch (error) {
            setMessageTone('error');
            setMessage(error?.message || 'Auto Improve could not be completed. Please try again.');
        } finally {
            improveInFlightRef.current = false;
            setIsImproving(false);
        }
    };

    const toggleGrabMode = () => {
        setGrabMode((enabled) => {
            const next = !enabled;
            if (next) setAnnotationMode(false);
            return next;
        });
    };

    const resetImageView = () => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
        setIsDraggingImage(false);
        dragStateRef.current = null;
    };

    const startImageDrag = (event) => {
        if (!grabMode || event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        dragStateRef.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, panX: pan.x, panY: pan.y };
        setIsDraggingImage(true);
    };

    const moveImageDrag = (event) => {
        const drag = dragStateRef.current;
        if (!grabMode || !drag || drag.pointerId !== event.pointerId) return;
        event.preventDefault();
        setPan({ x: drag.panX + event.clientX - drag.clientX, y: drag.panY + event.clientY - drag.clientY });
    };

    const endImageDrag = (event) => {
        const drag = dragStateRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        dragStateRef.current = null;
        setIsDraggingImage(false);
    };

    const moveImageWithKeyboard = (event) => {
        if (!grabMode) return;
        const step = event.shiftKey ? 50 : 20;
        const movement = {
            ArrowLeft: { x: -step, y: 0 },
            ArrowRight: { x: step, y: 0 },
            ArrowUp: { x: 0, y: -step },
            ArrowDown: { x: 0, y: step },
        }[event.key];
        if (!movement) return;
        event.preventDefault();
        setPan((current) => ({ x: current.x + movement.x, y: current.y + movement.y }));
    };

    const annotationLabel = (item) => {
        const location = item.toothNumber ? `Tooth ${item.toothNumber}` : 'Marked area';
        const detail = item.findingType || item.note || 'Dentist-recorded annotation';
        return `${location}: ${detail}`;
    };

    const renderImage = (source, alt, interactive = true) => (
        <div
            className={styles.canvas}
            data-annotation-mode={interactive && annotationMode}
            data-location-invalid={interactive && Boolean(findingErrors.geometry)}
            data-grab-mode={grabMode}
            data-dragging={isDraggingImage}
            onPointerDown={startImageDrag}
            onPointerMove={moveImageDrag}
            onPointerUp={endImageDrag}
            onPointerCancel={endImageDrag}
            onKeyDown={moveImageWithKeyboard}
            tabIndex={grabMode ? 0 : undefined}
            aria-label={`${alt} viewer${grabMode ? ', grab tool active' : ''}`}
        >
            <div className={styles.zoomLayer} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, '--inverse-zoom': 1 / zoom }}>
                <img
                    src={source}
                    alt={alt}
                    draggable="false"
                    onClick={interactive ? placeAnnotation : undefined}
                    style={{ filter: `brightness(${displayAdjustments.brightness}%) contrast(${displayAdjustments.contrast}%)` }}
                />
                {interactive ? activeFindings.filter((item) => item.geometry?.type === 'point').map((item) => (
                    <button type="button" key={item._id || item.id} className={styles.savedPointMarker} style={{ left: `${item.geometry.x * 100}%`, top: `${item.geometry.y * 100}%` }} aria-label={annotationLabel(item)} onPointerDown={(event) => event.stopPropagation()}>
                        <span className={styles.annotationTooltip} role="tooltip">
                            <strong>{item.toothNumber ? `Tooth ${item.toothNumber}` : 'Marked area'}</strong>
                            {item.findingType ? <span>{item.findingType}</span> : null}
                            {item.note ? <span>{item.note}</span> : null}
                            {item.linkToOdontogram ? <small>Linked to odontogram</small> : null}
                        </span>
                    </button>
                )) : null}
                {interactive && geometry?.type === 'point' ? <span className={styles.pointMarker} style={{ left: `${geometry.x * 100}%`, top: `${geometry.y * 100}%` }} aria-label="New annotation point" /> : null}
            </div>
        </div>
    );

    return (
        <section className={styles.review} aria-label="Radiograph Review">
            <header className={styles.topBar}>
                <button type="button" className={styles.linkButton} onClick={onClose}><FaArrowLeft /> Gallery</button>
                <div className={styles.titleBlock}><h2>Radiograph Review</h2><div className={styles.metaBadges}><span>{radiograph.type || radiograph.label}</span><span>{formatDate(radiograph.date || radiograph.rawDate)}</span><span className={`${styles.reviewStatus} ${styles[reviewStatusTone(radiograph.reviewSummary?.status)]}`}>{reviewStatusLabel(radiograph.reviewSummary?.status)}</span></div></div>
                <div className={styles.topActions}>
                    <button type="button" onClick={() => { setView('original'); setCompareEnhancement(false); }} aria-pressed={view === 'original' && !compareEnhancement}>Original</button>
                    <button type="button" onClick={() => { setView('enhanced'); setCompareEnhancement(false); }} disabled={!radiograph.enhancedUrl} aria-pressed={view === 'enhanced' && !compareEnhancement}>Enhanced</button>
                    {onDelete ? <button type="button" className={styles.danger} onClick={onDelete} aria-label="Delete radiograph"><FaTrash /></button> : null}
                </div>
            </header>

            <div className={styles.workspace}>
                <main className={styles.viewerColumn}>
                    <div className={styles.toolbar}>
                        <button type="button" onClick={() => setZoom((value) => Math.min(3, value + 0.25))} aria-label="Zoom in"><FaPlus /></button>
                        <button type="button" onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))} aria-label="Zoom out"><FaMinus /></button>
                        <button type="button" onClick={resetImageView}><FaCompress /> Fit</button>
                        <button type="button" onClick={toggleGrabMode} aria-pressed={grabMode}><FaHandPaper /> Grab</button>
                        <button type="button" onClick={() => { setAnnotationMode(true); setGrabMode(false); }}>Add annotation</button>
                        {radiograph.enhancedUrl ? <button type="button" onClick={() => { setCompareEnhancement((value) => !value); setCompareId(''); }} aria-pressed={compareEnhancement}>Compare original / enhanced</button> : null}
                        <select className={styles.pillSelect} value={compareId} onChange={(event) => setCompareId(event.target.value)} aria-label="Compare with previous radiograph">
                            <option value="">Compare with previous</option>
                            {previousOptions.map((item) => <option key={item.id} value={item.id}>{formatDate(item.date || item.rawDate)} · {item.type}</option>)}
                        </select>
                    </div>
                    {comparison ? <div className={styles.comparison}><div><strong>Current · {formatDate(radiograph.date || radiograph.rawDate)}</strong>{renderImage(imageUrl, 'Current radiograph')}</div><div><strong>Previous · {formatDate(comparison.date || comparison.rawDate)}</strong>{renderImage(comparison.url, 'Previous radiograph', false)}</div></div> : compareEnhancement && radiograph.enhancedUrl ? <div className={styles.comparison}><div><strong>Original</strong>{renderImage(radiograph.url, 'Original radiograph')}</div><div><strong>Enhanced</strong>{renderImage(radiograph.enhancedUrl, 'Enhanced radiograph', false)}</div></div> : renderImage(imageUrl, radiograph.type || 'Radiograph')}
                    <div className={styles.enhanceRow}>
                        <div><strong>Improve Image Visibility</strong><small>Adjust the view without changing the original.</small></div>
                        <label>Brightness <input type="range" min="50" max="150" value={displayAdjustments.brightness} onChange={(event) => setDisplayAdjustments({ ...displayAdjustments, brightness: Number(event.target.value) })} /></label>
                        <label>Contrast <input type="range" min="50" max="180" value={displayAdjustments.contrast} onChange={(event) => setDisplayAdjustments({ ...displayAdjustments, contrast: Number(event.target.value) })} /></label>
                        <button type="button" onClick={() => setDisplayAdjustments({ brightness: 100, contrast: 100 })}>Reset</button>
                        <button type="button" onClick={improveImage} disabled={isImproving || !radiograph.url} aria-busy={isImproving}>{isImproving ? <span className={styles.spinner} aria-hidden="true" /> : <FaMagic />} {isImproving ? 'Improving...' : 'Auto Improve'}</button>
                    </div>
                    {radiograph.enhancedUrl ? <section className={styles.enhancementDetails} aria-label="Enhancement details">
                        <div className={styles.enhancementDetailsHeading}><div><strong>Enhancement details</strong><small>{enhancementMetadata?.profile || radiograph.type || 'Radiograph'} profile · original preserved</small></div><span>{enhancementMetadata?.version || enhancementVariant.label || 'Saved enhancement'}</span></div>
                        {Array.isArray(enhancementMetadata?.transformations) && enhancementMetadata.transformations.length ? <div className={styles.transformationList}>{enhancementMetadata.transformations.map((item) => <span key={item}>{item}</span>)}</div> : <p className={styles.enhancementLegacyNote}>This enhancement predates detailed processing metadata. The original image remains available.</p>}
                        {enhancementMetadata?.before && enhancementMetadata?.after ? <div className={styles.metricGrid}>
                            <div><span>Brightness</span><strong>{formatMetric(enhancementMetadata.before.brightness)} → {formatMetric(enhancementMetadata.after.brightness)}</strong></div>
                            <div><span>Contrast</span><strong>{formatMetric(enhancementMetadata.before.contrast)} → {formatMetric(enhancementMetadata.after.contrast)}</strong></div>
                            <div><span>Sharpness</span><strong>{formatMetric(enhancementMetadata.before.sharpness)} → {formatMetric(enhancementMetadata.after.sharpness)}</strong></div>
                            <div><span>Source</span><strong>{enhancementMetadata.sourceDimensions?.width || '—'} × {enhancementMetadata.sourceDimensions?.height || '—'} · {enhancementMetadata.sourceBitDepth || '—'}-bit</strong></div>
                        </div> : null}
                        {(enhancementMetadata?.warnings || []).map((warning) => <p key={warning} className={styles.enhancementWarning}>{warning}</p>)}
                        <div className={styles.feedbackRow}><span>Was this enhancement useful?</span><div>
                            {[['useful', 'Useful'], ['not-useful', 'Not useful'], ['artifact', 'Introduced artifact']].map(([rating, label]) => <button type="button" key={rating} className={enhancementFeedback.rating === rating ? styles.feedbackActive : ''} aria-pressed={enhancementFeedback.rating === rating} disabled={Boolean(busy)} onClick={() => submitEnhancementFeedback(rating)}>{label}</button>)}
                        </div></div>
                    </section> : null}
                    <div className={styles.workflow} aria-label="Radiograph review workflow"><span>Radiograph Image</span><b>↓</b><span>Quality Review</span><b>↓</b><span>Dentist Finding</span><b>↓</b><span>Clinical Record</span><b>↓</b><span>Patient Explanation</span></div>
                </main>

                <aside className={styles.panel}>
                    <nav>{['quality', 'findings', 'history'].map((tab) => <button key={tab} type="button" className={activeTab === tab ? styles.activeTab : ''} onClick={() => setActiveTab(tab)}>{tab === 'history' ? 'Summary' : tab[0].toUpperCase() + tab.slice(1)}</button>)}</nav>
                    {message ? <p className={`${styles.message} ${styles[`${messageTone}Message`]}`} role="status"><span>{message}</span></p> : null}
                    {activeTab === 'quality' ? <div className={styles.section}>
                        <div className={styles.statusRow}><span>Image Quality</span><strong className={`${styles.statusBadge} ${styles[qualityTone]}`}>{qualityLabel}</strong></div>
                        {(analysis.qualityAssessment?.issues || []).map((issue) => <article key={issue.code}><strong>{issue.label}</strong><p>{issue.suggestion}</p></article>)}
                        <button type="button" className={styles.primary} onClick={analyze} disabled={Boolean(busy)}><FaRobot /> {busy.includes('/analyze') ? 'Analyzing…' : analysis.status === 'ready' ? 'Run analysis again' : 'Analyze radiograph'}</button>
                        {analysis.limitations ? <small>{analysis.limitations}</small> : null}
                    </div> : null}
                    {activeTab === 'findings' ? <div className={styles.section}>
                        <div className={`${styles.annotationRequirement} ${findingErrors.geometry ? styles.invalidContainer : ''}`}><span>Annotation location <b className={styles.requiredMark} aria-hidden="true">*</b></span><strong>{geometry ? 'Selected' : findingErrors.geometry || 'Select on image'}</strong></div>
                        <label>Finding recorded by dentist <b className={styles.requiredMark} aria-hidden="true">*</b><input aria-label="Finding recorded by dentist" value={finding.findingType} onChange={(event) => updateFindingField('findingType', event.target.value)} placeholder="Use an existing clinical term" required aria-invalid={Boolean(findingErrors.findingType)} aria-describedby={findingErrors.findingType ? 'finding-type-error' : undefined} />{findingErrors.findingType ? <span id="finding-type-error" className={styles.fieldError} role="alert">{findingErrors.findingType}</span> : null}</label>
                        <label>Clinical note<textarea value={finding.note} onChange={(event) => updateFindingField('note', event.target.value)} rows="3" aria-invalid={Boolean(findingErrors.note)} aria-describedby={findingErrors.note ? 'finding-note-error' : undefined} />{findingErrors.note ? <span id="finding-note-error" className={styles.fieldError} role="alert">{findingErrors.note}</span> : null}</label>
                        <label className={styles.pillField}><span>FDI Tooth:</span><select aria-label="FDI Tooth" value={finding.toothNumber} onChange={(event) => updateFindingField('toothNumber', event.target.value)}><option value="">Area only</option>{FDI_TEETH.map((tooth) => <option key={tooth}>{tooth}</option>)}</select></label>
                        <label className={`${styles.checkbox} ${styles.checkboxPill}`}><input type="checkbox" checked={finding.linkToOdontogram} onChange={(event) => updateFindingField('linkToOdontogram', event.target.checked)} /> Link reference to odontogram</label>
                        <label className={styles.pillField}><span>Related Treatment:</span><select aria-label="Related Treatment" value={finding.treatmentLogId} onChange={(event) => updateFindingField('treatmentLogId', event.target.value)}><option value="">None</option>{treatmentLogs.map((item) => <option key={item.id} value={item.id}>{item.procedure} · {formatDate(item.date || item.rawDate)}</option>)}</select></label>
                        <button type="button" className={styles.primary} onClick={saveFinding} disabled={Boolean(busy)}>Save dentist finding</button>
                        <div className={styles.findingListHeading}><h3>Active findings</h3><span className={styles.infoBadge}>{activeFindings.length}</span></div>
                        {!activeFindings.length ? <p className={styles.emptyFindingState}>No active dentist findings recorded.</p> : null}
                        {activeFindings.map((item) => {
                            const itemId = String(item._id || item.id);
                            const itemLabel = item.toothNumber ? `Tooth ${item.toothNumber}` : 'marked area';
                            return <article key={itemId} className={styles.findingCard}>
                                {editingFindingId === itemId && editingFinding ? <div className={styles.findingEditForm}>
                                    <div className={styles.findingHeading}><strong>Edit {itemLabel}</strong><span className={styles.draftBadge}>Editing</span></div>
                                    <label className={styles.pillField}><span>FDI Tooth:</span><select aria-label="Edit FDI Tooth" value={editingFinding.toothNumber} onChange={(event) => updateEditingFindingField('toothNumber', event.target.value)}><option value="">Area only</option>{FDI_TEETH.map((tooth) => <option key={tooth}>{tooth}</option>)}</select></label>
                                    <label>Finding recorded by dentist <b className={styles.requiredMark} aria-hidden="true">*</b><input aria-label="Edit finding" value={editingFinding.findingType} onChange={(event) => updateEditingFindingField('findingType', event.target.value)} required aria-invalid={Boolean(editingFindingErrors.findingType)} aria-describedby={editingFindingErrors.findingType ? `edit-finding-type-error-${itemId}` : undefined} />{editingFindingErrors.findingType ? <span id={`edit-finding-type-error-${itemId}`} className={styles.fieldError} role="alert">{editingFindingErrors.findingType}</span> : null}</label>
                                    <label>Clinical note<textarea aria-label="Edit clinical note" value={editingFinding.note} onChange={(event) => updateEditingFindingField('note', event.target.value)} rows="3" aria-invalid={Boolean(editingFindingErrors.note)} aria-describedby={editingFindingErrors.note ? `edit-finding-note-error-${itemId}` : undefined} />{editingFindingErrors.note ? <span id={`edit-finding-note-error-${itemId}`} className={styles.fieldError} role="alert">{editingFindingErrors.note}</span> : null}</label>
                                    <label className={`${styles.checkbox} ${styles.checkboxPill}`}><input type="checkbox" checked={editingFinding.linkToOdontogram} onChange={(event) => updateEditingFindingField('linkToOdontogram', event.target.checked)} /> Link reference to odontogram</label>
                                    <label className={styles.pillField}><span>Related Treatment:</span><select aria-label="Edit Related Treatment" value={editingFinding.treatmentLogId} onChange={(event) => updateEditingFindingField('treatmentLogId', event.target.value)}><option value="">None</option>{treatmentLogs.map((log) => <option key={log.id} value={log.id}>{log.procedure} · {formatDate(log.date || log.rawDate)}</option>)}</select></label>
                                    <div className={styles.findingActions}><button type="button" onClick={cancelEditingFinding}>Cancel</button><button type="button" className={styles.primary} onClick={saveEditedFinding} disabled={Boolean(busy)}>Save changes</button></div>
                                </div> : <>
                                    <div className={styles.findingHeading}><strong>{item.toothNumber ? `Tooth ${item.toothNumber}` : 'Marked area'}</strong><span className={styles.verifiedBadge}>Dentist Recorded</span></div>
                                    <p>{item.findingType}{item.note ? ` — ${item.note}` : ''}</p>
                                    {item.linkToOdontogram ? <small className={styles.infoBadge}>Linked to odontogram</small> : null}
                                    <div className={styles.findingActions}><button type="button" aria-label={`Edit ${itemLabel}`} onClick={() => startEditingFinding(item)}>Edit</button><button type="button" aria-label={`Archive ${itemLabel}`} onClick={() => archiveFinding(item)} disabled={Boolean(busy)}>Archive</button><button type="button" className={styles.deleteFindingAction} aria-label={`Delete ${itemLabel}`} onClick={() => { setDeletingFindingId(itemId); setDeletionReason(''); cancelEditingFinding(); }}>Delete</button></div>
                                </>}
                                {deletingFindingId === itemId ? <div className={styles.deleteFindingConfirm} role="group" aria-label={`Delete ${itemLabel} confirmation`}><strong>Delete this clinical finding?</strong><small>It will be removed from active use, but its audit history will be preserved.</small><label>Reason<select aria-label="Deletion reason" required value={deletionReason} onChange={(event) => setDeletionReason(event.target.value)}><option value="">Select a reason</option><option>Duplicate</option><option>Added to wrong radiograph</option><option>Incorrect placement</option><option>Entered by mistake</option><option>Other clinical correction</option></select></label><div className={styles.findingActions}><button type="button" onClick={() => { setDeletingFindingId(''); setDeletionReason(''); }}>Cancel</button><button type="button" className={styles.confirmDeleteFinding} onClick={confirmDeleteFinding} disabled={Boolean(busy)}>Delete finding</button></div></div> : null}
                            </article>;
                        })}
                        {archivedFindings.length ? <button type="button" className={styles.archivedToggle} aria-expanded={showArchivedFindings} onClick={() => setShowArchivedFindings((shown) => !shown)}>{showArchivedFindings ? 'Hide' : 'Show'} archived findings ({archivedFindings.length})</button> : null}
                        {showArchivedFindings ? archivedFindings.map((item) => {
                            const itemId = String(item._id || item.id);
                            const itemLabel = item.toothNumber ? `Tooth ${item.toothNumber}` : 'marked area';
                            return <article key={itemId} className={`${styles.findingCard} ${styles.archivedFinding}`}><div className={styles.findingHeading}><strong>{item.toothNumber ? `Tooth ${item.toothNumber}` : 'Marked area'}</strong><span className={styles.archivedBadge}>Archived</span></div><p>{item.findingType}{item.note ? ` — ${item.note}` : ''}</p><div className={styles.findingActions}><button type="button" aria-label={`Restore ${itemLabel}`} onClick={() => restoreFinding(item)} disabled={Boolean(busy)}>Restore</button><button type="button" className={styles.deleteFindingAction} aria-label={`Delete archived ${itemLabel}`} onClick={() => { setDeletingFindingId(itemId); setDeletionReason(''); }}>Delete</button></div>{deletingFindingId === itemId ? <div className={styles.deleteFindingConfirm} role="group" aria-label={`Delete archived ${itemLabel} confirmation`}><strong>Delete this archived clinical finding?</strong><small>The audit history will remain preserved.</small><label>Reason<select aria-label="Deletion reason" required value={deletionReason} onChange={(event) => setDeletionReason(event.target.value)}><option value="">Select a reason</option><option>Duplicate</option><option>Added to wrong radiograph</option><option>Incorrect placement</option><option>Entered by mistake</option><option>Other clinical correction</option></select></label><div className={styles.findingActions}><button type="button" onClick={() => { setDeletingFindingId(''); setDeletionReason(''); }}>Cancel</button><button type="button" className={styles.confirmDeleteFinding} onClick={confirmDeleteFinding} disabled={Boolean(busy)}>Delete finding</button></div></div> : null}</article>;
                        }) : null}
                    </div> : null}
                    {activeTab === 'history' ? <div className={`${styles.section} ${styles.summarySection}`}>
                        <h3>Review summary</h3>
                        <p className={styles.sectionHelper}>Create a draft from dentist-recorded findings and linked clinical records, then review it before approval.</p>
                        {summaryNeedsRevision ? <div className={styles.summaryUpdateWarning} role="status"><strong>Summary update needed</strong><span>Dentist findings changed after this summary was approved. The approved patient-facing version remains unchanged until a revision is approved.</span></div> : null}
                        {!hasInitialDraft && !hasRevisionDraft ? <button type="button" className={styles.secondaryAction} onClick={generateSummary} disabled={Boolean(busy)}><FaRobot /> {busy.includes('/generate-summary') ? (hasApprovedSummary ? 'Preparing revision...' : 'Generating...') : (hasApprovedSummary ? 'Revise summary' : 'Generate summary')}</button> : null}
                        {hasApprovedSummary && !hasRevisionDraft ? <>
                            <div className={styles.approvedSummaryHeading}><span className={styles.approvedBadge}>Approved</span><small>{reviewSummary.approvedAt ? `Approved ${formatDate(reviewSummary.approvedAt)}` : 'Dentist-approved clinical record'}</small></div>
                            <textarea className={`${styles.summaryTextarea} ${styles.approvedSummaryText}`} rows="8" value={reviewSummary.approvedText} readOnly aria-label="Approved review summary" />
                            <small>This approved version is available in the patient record. Choose Revise summary to prepare a replacement draft.</small>
                        </> : null}
                        {isEditingSummary ? <>
                            {hasRevisionDraft ? <div className={styles.revisionNotice}><span className={styles.draftBadge}>Revision Draft</span><small>The currently approved summary remains unchanged until this revision is approved.</small></div> : null}
                            <textarea className={styles.summaryTextarea} rows="8" value={summaryText} onChange={(event) => setSummaryText(event.target.value)} placeholder="Generated review summary will appear here." disabled={busy.includes('/approve-summary')} aria-label={hasRevisionDraft ? 'Review summary revision draft' : 'Review summary draft'} />
                            <div className={styles.requiredReviewField}><label className={styles.checkbox}><input type="checkbox" required checked={manualReviewConfirmed} aria-invalid={Boolean(summaryReviewError)} aria-describedby={summaryReviewError ? 'manual-review-error' : undefined} onChange={(event) => { setManualReviewConfirmed(event.target.checked); if (event.target.checked) setSummaryReviewError(''); }} /> <span>I manually reviewed this radiograph image <b className={styles.requiredMark} aria-hidden="true">*</b></span></label>{summaryReviewError ? <p id="manual-review-error" className={styles.inlineValidation} role="alert">{summaryReviewError}</p> : null}</div>
                            <div className={styles.summaryActions}>
                                {hasRevisionDraft ? <button type="button" className={styles.cancelRevision} onClick={cancelSummaryRevision} disabled={Boolean(busy)}>{busy.includes('/cancel-summary-revision') ? 'Cancelling...' : 'Cancel revision'}</button> : null}
                                <button type="button" className={styles.primary} onClick={approveSummary} disabled={Boolean(busy)}>{busy.includes('/approve-summary') ? 'Approving...' : hasRevisionDraft ? 'Approve revision' : 'Approve summary'}</button>
                            </div>
                            <small>The draft is not shared with the patient until the dentist approves it.</small>
                        </> : null}
                        <h3>Previous radiographs</h3>{previousOptions.map((item) => <button type="button" key={item.id} className={styles.historyItem} onClick={() => setCompareId(item.id)}>{formatDate(item.date || item.rawDate)} · {item.type}</button>)}
                        <h3>Related treatments</h3>{treatmentLogs.filter((log) => activeFindings.some((item) => String(item.treatmentLogId || '') === String(log.id))).map((log) => <p key={log.id}>{log.procedure} · {formatDate(log.date || log.rawDate)}</p>)}
                        {radiograph.visitId ? <p><strong>Linked visit:</strong> {String(radiograph.visitId)}</p> : null}
                    </div> : null}
                </aside>
            </div>
        </section>
    );
}
