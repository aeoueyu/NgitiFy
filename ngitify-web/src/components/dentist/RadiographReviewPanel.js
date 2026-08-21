import React, { useMemo, useState } from 'react';
import { FaArrowLeft, FaCheck, FaCompress, FaEye, FaEyeSlash, FaMagic, FaMinus, FaPlus, FaRobot, FaTrash } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import styles from './RadiographReviewPanel.module.css';

const FDI_TEETH = [18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28,48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38].map(String);
const formatDate = (value) => value ? new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'Date not recorded';
const statusLabel = (status) => ({ pending: 'Needs verification', confirmed: 'Dentist verified', corrected: 'Corrected', ignored: 'Ignored' }[status] || 'Needs verification');

export default function RadiographReviewPanel({ patientId, radiograph, radiographs = [], treatmentLogs = [], onChange, onClose, onEnhance, onDelete }) {
    const [activeTab, setActiveTab] = useState('quality');
    const [view, setView] = useState('original');
    const [zoom, setZoom] = useState(1);
    const [showAi, setShowAi] = useState(true);
    const [displayAdjustments, setDisplayAdjustments] = useState({ brightness: 100, contrast: 100 });
    const [busy, setBusy] = useState('');
    const [selectedDetectionId, setSelectedDetectionId] = useState('');
    const [correction, setCorrection] = useState('');
    const [compareId, setCompareId] = useState('');
    const [annotationMode, setAnnotationMode] = useState(false);
    const [geometry, setGeometry] = useState(null);
    const [finding, setFinding] = useState({ toothNumber: '', findingType: '', note: '', linkToOdontogram: true, treatmentLogId: '' });
    const [summaryText, setSummaryText] = useState(radiograph.reviewSummary?.draft || radiograph.reviewSummary?.approvedText || '');
    const [evaluation, setEvaluation] = useState(null);
    const [message, setMessage] = useState('');

    const analysis = radiograph.analysis || { status: 'not-analyzed', detections: [] };
    const detections = analysis.detections || [];
    const previousOptions = useMemo(() => radiographs.filter((item) => item.id !== radiograph.id && new Date(item.date || item.rawDate) < new Date(radiograph.date || radiograph.rawDate)).sort((a, b) => new Date(b.date || b.rawDate) - new Date(a.date || a.rawDate)), [radiographs, radiograph]);
    const comparison = previousOptions.find((item) => item.id === compareId);
    const imageUrl = view === 'enhanced' && radiograph.enhancedUrl ? radiograph.enhancedUrl : radiograph.url;

    const request = async (endpoint, options = {}) => {
        setBusy(endpoint);
        setMessage('');
        try {
            const response = await authFetch(endpoint, options);
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'The request could not be completed.');
            if (data.radiograph) {
                onChange(data.radiograph);
                setSummaryText(data.radiograph.reviewSummary?.draft || data.radiograph.reviewSummary?.approvedText || '');
            }
            setMessage(data.message || 'Saved.');
            return data;
        } catch (error) {
            setMessage(error.message);
            return null;
        } finally {
            setBusy('');
        }
    };

    const analyze = () => request(`/patients/${patientId}/radiographs/${radiograph.id}/analyze`, { method: 'POST' });
    const updateDetection = (item, action) => request(`/patients/${patientId}/radiographs/${radiograph.id}/detections/${item._id || item.id}`, { method: 'PATCH', body: JSON.stringify({ action, confirmedToothNumber: action === 'correct' ? correction : item.predictedToothNumber }) });
    const generateSummary = () => request(`/patients/${patientId}/radiographs/${radiograph.id}/generate-summary`, { method: 'POST' });
    const approveSummary = () => request(`/patients/${patientId}/radiographs/${radiograph.id}/approve-summary`, { method: 'POST', body: JSON.stringify({ text: summaryText }) });
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
        } catch (error) {
            setMessage(error.message);
        } finally {
            setBusy('');
        }
    };

    const selectDetection = (item) => {
        setSelectedDetectionId(String(item._id || item.id));
        setCorrection(item.confirmedToothNumber || item.predictedToothNumber || '');
        setFinding((current) => ({ ...current, toothNumber: item.confirmedToothNumber || item.predictedToothNumber || '' }));
        setGeometry(item.geometry || null);
    };

    const placeAnnotation = (event) => {
        if (!annotationMode) return;
        const rect = event.currentTarget.getBoundingClientRect();
        setGeometry({ type: 'point', x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height, width: 0, height: 0 });
        setActiveTab('findings');
        setAnnotationMode(false);
    };

    const saveFinding = async () => {
        if (!geometry) return setMessage('Select an AI region or use Add annotation and click the image first.');
        const result = await request(`/patients/${patientId}/radiographs/${radiograph.id}/annotations`, { method: 'POST', body: JSON.stringify({ ...finding, geometry }) });
        if (result) setFinding({ toothNumber: '', findingType: '', note: '', linkToOdontogram: true, treatmentLogId: '' });
    };

    const renderImage = (source, alt) => (
        <div className={styles.canvas} onClick={placeAnnotation} data-annotation-mode={annotationMode}>
            <div className={styles.zoomLayer} style={{ transform: `scale(${zoom})` }}>
                <img src={source} alt={alt} draggable="false" style={{ filter: `brightness(${displayAdjustments.brightness}%) contrast(${displayAdjustments.contrast}%)` }} />
                {showAi && source === imageUrl && detections.filter((item) => item.status !== 'ignored' && item.confidenceLevel !== 'low').map((item) => (
                    <button key={item._id || item.id} type="button" className={`${styles.detectionBox} ${styles[item.status || 'pending']}`} style={{ left: `${item.geometry.x * 100}%`, top: `${item.geometry.y * 100}%`, width: `${item.geometry.width * 100}%`, height: `${item.geometry.height * 100}%` }} onClick={(event) => { event.stopPropagation(); selectDetection(item); }} aria-label={`AI suggestion tooth ${item.predictedToothNumber}, ${statusLabel(item.status)}`}>
                        <span>{item.confirmedToothNumber || item.predictedToothNumber}</span>
                    </button>
                ))}
                {geometry?.type === 'point' ? <span className={styles.pointMarker} style={{ left: `${geometry.x * 100}%`, top: `${geometry.y * 100}%` }} aria-label="New annotation point" /> : null}
            </div>
        </div>
    );

    return (
        <section className={styles.review} aria-label="AI-Assisted Radiograph Review">
            <header className={styles.topBar}>
                <button type="button" className={styles.linkButton} onClick={onClose}><FaArrowLeft /> Gallery</button>
                <div><h2>AI-Assisted Radiograph Review</h2><p>{radiograph.type || radiograph.label} · {formatDate(radiograph.date || radiograph.rawDate)}</p></div>
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
                        <button type="button" onClick={() => setShowAi((value) => !value)}>{showAi ? <FaEye /> : <FaEyeSlash />} Show AI</button>
                        <button type="button" onClick={() => setAnnotationMode(true)}>Add annotation</button>
                        <select value={compareId} onChange={(event) => setCompareId(event.target.value)} aria-label="Compare with previous radiograph">
                            <option value="">Compare with previous</option>
                            {previousOptions.map((item) => <option key={item.id} value={item.id}>{formatDate(item.date || item.rawDate)} · {item.type}</option>)}
                        </select>
                    </div>
                    {comparison ? <div className={styles.comparison}><div><strong>Current · {formatDate(radiograph.date || radiograph.rawDate)}</strong>{renderImage(imageUrl, 'Current radiograph')}</div><div><strong>Previous · {formatDate(comparison.date || comparison.rawDate)}</strong>{renderImage(comparison.url, 'Previous radiograph')}</div></div> : renderImage(imageUrl, radiograph.type || 'Radiograph')}
                    <div className={styles.enhanceRow}>
                        <div><strong>Improve Image Visibility</strong><small>Adjust the view without changing the original.</small></div>
                        <label>Brightness <input type="range" min="50" max="150" value={displayAdjustments.brightness} onChange={(event) => setDisplayAdjustments({ ...displayAdjustments, brightness: Number(event.target.value) })} /></label>
                        <label>Contrast <input type="range" min="50" max="180" value={displayAdjustments.contrast} onChange={(event) => setDisplayAdjustments({ ...displayAdjustments, contrast: Number(event.target.value) })} /></label>
                        <button type="button" onClick={() => setDisplayAdjustments({ brightness: 100, contrast: 100 })}>Reset</button>
                        <button type="button" onClick={() => onEnhance('basic')} disabled={busy || !radiograph.url}><FaMagic /> Auto Improve</button>
                    </div>
                    <p className={styles.disclaimer}>AI suggestions are for review support only. Confirm findings using your clinical judgment.</p>
                </main>

                <aside className={styles.panel}>
                    <nav>{['quality', 'teeth', 'findings', 'history'].map((tab) => <button key={tab} type="button" className={activeTab === tab ? styles.activeTab : ''} onClick={() => setActiveTab(tab)}>{tab[0].toUpperCase() + tab.slice(1)}</button>)}</nav>
                    {message ? <p className={styles.message} role="status">{message}</p> : null}
                    {activeTab === 'quality' ? <div className={styles.section}>
                        <div className={styles.statusRow}><span>Image Quality</span><strong>{analysis.qualityAssessment?.label || (analysis.status === 'failed' ? 'Unavailable' : 'Not analyzed')}</strong></div>
                        {(analysis.qualityAssessment?.issues || []).map((issue) => <article key={issue.code}><strong>{issue.label}</strong><p>{issue.suggestion}</p></article>)}
                        <button type="button" className={styles.primary} onClick={analyze} disabled={Boolean(busy)}><FaRobot /> {busy.includes('/analyze') ? 'Analyzing…' : analysis.status === 'ready' ? 'Run analysis again' : 'Analyze radiograph'}</button>
                        {analysis.limitations ? <small>{analysis.limitations}</small> : null}
                    </div> : null}
                    {activeTab === 'teeth' ? <div className={styles.section}>
                        <p>{detections.filter((item) => item.status === 'pending').length} suggestion(s) need review.</p>
                        {detections.map((item) => <article key={item._id || item.id} className={selectedDetectionId === String(item._id || item.id) ? styles.selectedCard : ''}>
                            <button type="button" className={styles.detectionTitle} onClick={() => selectDetection(item)}>AI suggestion: Tooth {item.predictedToothNumber}</button>
                            <small>{statusLabel(item.status)} · {item.confidenceLevel} confidence ({Math.round(item.confidence * 100)}%)</small>
                            {item.status === 'pending' ? <div className={styles.actions}><button type="button" onClick={() => updateDetection(item, 'confirm')}><FaCheck /> Confirm</button><select value={selectedDetectionId === String(item._id || item.id) ? correction : item.predictedToothNumber} onFocus={() => selectDetection(item)} onChange={(event) => setCorrection(event.target.value)}>{FDI_TEETH.map((tooth) => <option key={tooth}>{tooth}</option>)}</select><button type="button" onClick={() => updateDetection(item, 'correct')}>Correct</button><button type="button" onClick={() => updateDetection(item, 'ignore')}>Ignore</button></div> : null}
                        </article>)}
                        {detections.some((item) => item.confidenceLevel === 'low') ? <small>Low-confidence suggestions are listed here but hidden from the overlay by default.</small> : null}
                    </div> : null}
                    {activeTab === 'findings' ? <div className={styles.section}>
                        <label>FDI tooth<select value={finding.toothNumber} onChange={(event) => setFinding({ ...finding, toothNumber: event.target.value })}><option value="">Area only</option>{FDI_TEETH.map((tooth) => <option key={tooth}>{tooth}</option>)}</select></label>
                        <label>Finding recorded by dentist<input value={finding.findingType} onChange={(event) => setFinding({ ...finding, findingType: event.target.value })} placeholder="Use an existing clinical term" /></label>
                        <label>Clinical note<textarea value={finding.note} onChange={(event) => setFinding({ ...finding, note: event.target.value })} rows="3" /></label>
                        <label className={styles.checkbox}><input type="checkbox" checked={finding.linkToOdontogram} onChange={(event) => setFinding({ ...finding, linkToOdontogram: event.target.checked })} /> Link reference to odontogram</label>
                        <label>Related treatment<select value={finding.treatmentLogId} onChange={(event) => setFinding({ ...finding, treatmentLogId: event.target.value })}><option value="">None</option>{treatmentLogs.map((item) => <option key={item.id} value={item.id}>{item.procedure} · {formatDate(item.date || item.rawDate)}</option>)}</select></label>
                        <button type="button" className={styles.primary} onClick={saveFinding} disabled={Boolean(busy)}>Save dentist finding</button>
                        {(radiograph.annotations || []).map((item) => <article key={item._id || item.id}><strong>{item.toothNumber ? `Tooth ${item.toothNumber}` : 'Marked area'} · Dentist recorded</strong><p>{item.findingType}{item.note ? ` — ${item.note}` : ''}</p>{item.linkToOdontogram ? <small>Linked to odontogram reference</small> : null}</article>)}
                    </div> : null}
                    {activeTab === 'history' ? <div className={styles.section}>
                        <h3>Review summary</h3><button type="button" onClick={generateSummary} disabled={Boolean(busy)}>Generate summary</button>
                        {summaryText || radiograph.reviewSummary?.draft ? <><textarea rows="8" value={summaryText} onChange={(event) => setSummaryText(event.target.value)} /><button type="button" className={styles.primary} onClick={approveSummary} disabled={Boolean(busy)}>Approve summary</button><small>AI-assisted summary, saved only after dentist approval.</small></> : null}
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
