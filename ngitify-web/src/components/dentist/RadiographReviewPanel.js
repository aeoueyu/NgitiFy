import React, { useMemo, useRef, useState } from 'react';
import { FaArrowLeft, FaCompress, FaMagic, FaMinus, FaPlus, FaRobot, FaTrash } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import styles from './RadiographReviewPanel.module.css';

const FDI_TEETH = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28,48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38].map(String);
const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Date not recorded';
const reviewStatusLabel = (status) => ({ approved: 'Dentist Verified', draft: 'Draft Review' }[status] || 'Review Pending');
const reviewStatusTone = (status) => ({ approved: 'reviewStatusApproved', draft: 'reviewStatusDraft' }[status] || 'reviewStatusPending');

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
    const [zoom, setZoom] = useState(1);
    const [displayAdjustments, setDisplayAdjustments] = useState({ brightness: 100, contrast: 100 });
    const [busy, setBusy] = useState('');
    const [compareId, setCompareId] = useState('');
    const [annotationMode, setAnnotationMode] = useState(false);
    const [geometry, setGeometry] = useState(null);
    const [finding, setFinding] = useState({ toothNumber: '', findingType: '', note: '', linkToOdontogram: true, treatmentLogId: '' });
    const [summaryText, setSummaryText] = useState(radiograph.reviewSummary?.draft || radiograph.reviewSummary?.approvedText || '');
    const [manualReviewConfirmed, setManualReviewConfirmed] = useState(Boolean(radiograph.manualReview?.reviewedAt));
    const [evaluation, setEvaluation] = useState(null);
    const [message, setMessage] = useState('');
    const [messageTone, setMessageTone] = useState('info');
    const [isImproving, setIsImproving] = useState(false);
    const improveInFlightRef = useRef(false);

    const analysis = radiograph.analysis || { status: 'not-analyzed', detections: [] };
    const previousOptions = useMemo(() => radiographs.filter((item) => item.id !== radiograph.id && new Date(item.date || item.rawDate) < new Date(radiograph.date || radiograph.rawDate)).sort((a, b) => new Date(b.date || b.rawDate) - new Date(a.date || a.rawDate)), [radiographs, radiograph]);
    const comparison = previousOptions.find((item) => item.id === compareId);
    const imageUrl = view === 'enhanced' && radiograph.enhancedUrl ? radiograph.enhancedUrl : radiograph.url;
    const qualityLabel = analysis.qualityAssessment?.label || (analysis.status === 'failed' ? 'Unavailable' : 'Not analyzed');
    const qualityTone = analysis.status === 'failed' ? 'statusError' : analysis.qualityAssessment?.label ? 'statusSuccess' : 'statusNeutral';

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
                setSummaryText(data.radiograph.reviewSummary?.draft || data.radiograph.reviewSummary?.approvedText || '');
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
    const approveSummary = () => request(`/patients/${patientId}/radiographs/${radiograph.id}/approve-summary`, { method: 'POST', body: JSON.stringify({ text: summaryText, manualReviewConfirmed }) });
    const loadEvaluation = async () => {
        const data = await request('/radiograph-review/evaluation');
        if (data) setEvaluation(data);
    };
    const downloadEvaluation = async () => {
        setBusy('evaluation-export');
        try {
            const response = await authFetch('/radiograph-review/evaluation?format=csv');
            if (!response.ok) throw new Error('Could not export evaluation data.');
            const url = URL.createObjectURL(await response.blob());
            const link = document.createElement('a');
            link.href = url;
            link.download = 'radiograph-evaluation.csv';
            link.click();
            URL.revokeObjectURL(url);
            setMessage('Anonymized evaluation export downloaded.');
            setMessageTone('success');
        } catch (error) {
            setMessage(error.message);
            setMessageTone('error');
        } finally {
            setBusy('');
        }
    };

    const placeAnnotation = (event) => {
        if (!annotationMode) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        setGeometry(toNormalizedImagePoint(event, rect));
        setActiveTab('findings');
        setAnnotationMode(false);
    };

    const saveFinding = async () => {
        if (!geometry) {
            setMessageTone('error');
            return setMessage('Use Add annotation, then click the radiograph where the finding belongs.');
        }
        const result = await request(`/patients/${patientId}/radiographs/${radiograph.id}/annotations`, { method: 'POST', body: JSON.stringify({ ...finding, geometry }) });
        if (result) {
            setFinding({ toothNumber: '', findingType: '', note: '', linkToOdontogram: true, treatmentLogId: '' });
            setGeometry(null);
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
            }
        } catch (error) {
            setMessageTone('error');
            setMessage(error?.message || 'Auto Improve could not be completed. Please try again.');
        } finally {
            improveInFlightRef.current = false;
            setIsImproving(false);
        }
    };

    const renderImage = (source, alt, interactive = true) => (
        <div className={styles.canvas} data-annotation-mode={interactive && annotationMode}>
            <div className={styles.zoomLayer} style={{ transform: `scale(${zoom})` }}>
                <img
                    src={source}
                    alt={alt}
                    draggable="false"
                    onClick={interactive ? placeAnnotation : undefined}
                    style={{ filter: `brightness(${displayAdjustments.brightness}%) contrast(${displayAdjustments.contrast}%)` }}
                />
                {interactive ? (radiograph.annotations || []).filter((item) => item.geometry?.type === 'point').map((item) => (
                    <span key={item._id || item.id} className={styles.savedPointMarker} style={{ left: `${item.geometry.x * 100}%`, top: `${item.geometry.y * 100}%` }} aria-label="Dentist annotation" />
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
                    <button type="button" onClick={() => setView('original')} aria-pressed={view === 'original'}>Original</button>
                    <button type="button" onClick={() => setView('enhanced')} disabled={!radiograph.enhancedUrl} aria-pressed={view === 'enhanced'}>Enhanced</button>
                    {onDelete ? <button type="button" className={styles.danger} onClick={onDelete} aria-label="Delete radiograph"><FaTrash /></button> : null}
                </div>
            </header>

            <div className={styles.workspace}>
                <main className={styles.viewerColumn}>
                    <div className={styles.toolbar}>
                        <button type="button" onClick={() => setZoom((value) => Math.min(3, value + 0.25))} aria-label="Zoom in"><FaPlus /></button>
                        <button type="button" onClick={() => setZoom((value) => Math.max(0.5, value - 0.25))} aria-label="Zoom out"><FaMinus /></button>
                        <button type="button" onClick={() => setZoom(1)}><FaCompress /> Fit</button>
                        <button type="button" onClick={() => setAnnotationMode(true)}>Add annotation</button>
                        <select className={styles.pillSelect} value={compareId} onChange={(event) => setCompareId(event.target.value)} aria-label="Compare with previous radiograph">
                            <option value="">Compare with previous</option>
                            {previousOptions.map((item) => <option key={item.id} value={item.id}>{formatDate(item.date || item.rawDate)} · {item.type}</option>)}
                        </select>
                    </div>
                    {comparison ? <div className={styles.comparison}><div><strong>Current · {formatDate(radiograph.date || radiograph.rawDate)}</strong>{renderImage(imageUrl, 'Current radiograph')}</div><div><strong>Previous · {formatDate(comparison.date || comparison.rawDate)}</strong>{renderImage(comparison.url, 'Previous radiograph', false)}</div></div> : renderImage(imageUrl, radiograph.type || 'Radiograph')}
                    <div className={styles.enhanceRow}>
                        <div><strong>Improve Image Visibility</strong><small>Adjust the view without changing the original.</small></div>
                        <label>Brightness <input type="range" min="50" max="150" value={displayAdjustments.brightness} onChange={(event) => setDisplayAdjustments({ ...displayAdjustments, brightness: Number(event.target.value) })} /></label>
                        <label>Contrast <input type="range" min="50" max="180" value={displayAdjustments.contrast} onChange={(event) => setDisplayAdjustments({ ...displayAdjustments, contrast: Number(event.target.value) })} /></label>
                        <button type="button" onClick={() => setDisplayAdjustments({ brightness: 100, contrast: 100 })}>Reset</button>
                        <button type="button" onClick={improveImage} disabled={isImproving || !radiograph.url} aria-busy={isImproving}>{isImproving ? <span className={styles.spinner} aria-hidden="true" /> : <FaMagic />} {isImproving ? 'Improving...' : 'Auto Improve'}</button>
                    </div>
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
                        <label className={styles.pillField}><span>FDI Tooth:</span><select aria-label="FDI Tooth" value={finding.toothNumber} onChange={(event) => setFinding({ ...finding, toothNumber: event.target.value })}><option value="">Area only</option>{FDI_TEETH.map((tooth) => <option key={tooth}>{tooth}</option>)}</select></label>
                        <label>Finding recorded by dentist<input value={finding.findingType} onChange={(event) => setFinding({ ...finding, findingType: event.target.value })} placeholder="Use an existing clinical term" /></label>
                        <label>Clinical note<textarea value={finding.note} onChange={(event) => setFinding({ ...finding, note: event.target.value })} rows="3" /></label>
                        <label className={`${styles.checkbox} ${styles.checkboxPill}`}><input type="checkbox" checked={finding.linkToOdontogram} onChange={(event) => setFinding({ ...finding, linkToOdontogram: event.target.checked })} /> Link reference to odontogram</label>
                        <label className={styles.pillField}><span>Related Treatment:</span><select aria-label="Related Treatment" value={finding.treatmentLogId} onChange={(event) => setFinding({ ...finding, treatmentLogId: event.target.value })}><option value="">None</option>{treatmentLogs.map((item) => <option key={item.id} value={item.id}>{item.procedure} · {formatDate(item.date || item.rawDate)}</option>)}</select></label>
                        <button type="button" className={styles.primary} onClick={saveFinding} disabled={Boolean(busy)}>Save dentist finding</button>
                        {(radiograph.annotations || []).map((item) => <article key={item._id || item.id}><div className={styles.findingHeading}><strong>{item.toothNumber ? `Tooth ${item.toothNumber}` : 'Marked area'}</strong><span className={styles.verifiedBadge}>Dentist Recorded</span></div><p>{item.findingType}{item.note ? ` — ${item.note}` : ''}</p>{item.linkToOdontogram ? <small className={styles.infoBadge}>Linked to odontogram</small> : null}</article>)}
                    </div> : null}
                    {activeTab === 'history' ? <div className={styles.section}>
                        <h3>Review summary</h3><button type="button" onClick={generateSummary} disabled={Boolean(busy)}>Generate summary</button>
                        {summaryText || radiograph.reviewSummary?.draft ? <><textarea rows="8" value={summaryText} onChange={(event) => setSummaryText(event.target.value)} /><label className={styles.checkbox}><input type="checkbox" checked={manualReviewConfirmed} onChange={(event) => setManualReviewConfirmed(event.target.checked)} /> I manually reviewed this radiograph image</label><button type="button" className={styles.primary} onClick={approveSummary} disabled={Boolean(busy)}>Approve summary</button><small>AI-assisted summary, saved only after AI suggestions are resolved or manual review is recorded, followed by dentist approval.</small></> : null}
                        <h3>Previous radiographs</h3>{previousOptions.map((item) => <button type="button" key={item.id} className={styles.historyItem} onClick={() => setCompareId(item.id)}>{formatDate(item.date || item.rawDate)} · {item.type}</button>)}
                        <h3>Related treatments</h3>{treatmentLogs.filter((log) => (radiograph.annotations || []).some((item) => String(item.treatmentLogId || '') === String(log.id))).map((log) => <p key={log.id}>{log.procedure} · {formatDate(log.date || log.rawDate)}</p>)}
                        {radiograph.visitId ? <p><strong>Linked visit:</strong> {String(radiograph.visitId)}</p> : null}
                        <h3>Model evaluation</h3>
                        <div className={styles.actions}><button type="button" onClick={loadEvaluation}>Load metrics</button><button type="button" onClick={downloadEvaluation}>Export anonymized CSV</button></div>
                        {evaluation ? <article><p>Radiographs reviewed: <strong>{evaluation.radiographsReviewed}</strong></p><p>Teeth verified: <strong>{evaluation.teethVerified}</strong></p><p>Numbering accuracy: <strong>{evaluation.numberingAccuracy == null ? 'Not yet evaluated' : `${(evaluation.numberingAccuracy * 100).toFixed(1)}%`}</strong></p><p>Dentist correction rate: <strong>{evaluation.correctionRate == null ? 'Not yet evaluated' : `${(evaluation.correctionRate * 100).toFixed(1)}%`}</strong></p><small>{evaluation.note}</small></article> : null}
                    </div> : null}
                </aside>
            </div>
        </section>
    );
}
