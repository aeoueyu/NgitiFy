const FDI_TOOTH_REGEX = /^[1-4][1-8]$/;

const DEFAULT_CONFIDENCE_THRESHOLDS = Object.freeze({
    high: 0.85,
    medium: 0.6,
});

const clampConfidence = (value) => Math.max(0, Math.min(1, Number(value) || 0));

const isValidFdiTooth = (value) => FDI_TOOTH_REGEX.test(String(value || '').trim());

const getConfidenceLevel = (confidence, thresholds = DEFAULT_CONFIDENCE_THRESHOLDS) => {
    const score = clampConfidence(confidence);
    if (score >= Number(thresholds.high)) return 'high';
    if (score >= Number(thresholds.medium)) return 'medium';
    return 'low';
};

const classifyImageQuality = (metrics = {}) => {
    const brightness = Number(metrics.brightness);
    const contrast = Number(metrics.contrast);
    const sharpness = Number(metrics.sharpness);
    const clippedDark = Number(metrics.clippedDarkRatio);
    const clippedBright = Number(metrics.clippedBrightRatio);
    const issues = [];

    if (Number.isFinite(brightness) && brightness < 48) issues.push({ code: 'dark', label: 'Possible excessive darkness', suggestion: 'Increasing brightness may make details easier to inspect.' });
    if (Number.isFinite(brightness) && brightness > 207) issues.push({ code: 'bright', label: 'Possible excessive brightness', suggestion: 'Reducing brightness may make details easier to inspect.' });
    if (Number.isFinite(contrast) && contrast < 28) issues.push({ code: 'low-contrast', label: 'Low contrast', suggestion: 'Increasing contrast may make details easier to inspect.' });
    if (Number.isFinite(sharpness) && sharpness < 35) issues.push({ code: 'blur', label: 'Possible blur or limited sharpness', suggestion: 'Review the original at full resolution before recording findings.' });
    if ((Number.isFinite(clippedDark) && clippedDark > 0.18) || (Number.isFinite(clippedBright) && clippedBright > 0.18)) {
        issues.push({ code: 'clipping', label: 'Possible tonal clipping', suggestion: 'Some very light or dark image detail may not be visible.' });
    }

    return {
        state: issues.length === 0 ? 'good' : issues.length <= 2 ? 'fair' : 'needs-review',
        label: issues.length === 0 ? 'Good' : issues.length <= 2 ? 'Fair' : 'Needs Review',
        issues,
        metrics: {
            brightness: Number.isFinite(brightness) ? brightness : null,
            contrast: Number.isFinite(contrast) ? contrast : null,
            sharpness: Number.isFinite(sharpness) ? sharpness : null,
            clippedDarkRatio: Number.isFinite(clippedDark) ? clippedDark : null,
            clippedBrightRatio: Number.isFinite(clippedBright) ? clippedBright : null,
        },
    };
};

const transitionDetection = (detection, action, confirmedToothNumber = '') => {
    const normalizedAction = String(action || '').toLowerCase();
    if (!['confirm', 'correct', 'ignore'].includes(normalizedAction)) {
        throw new Error('Unsupported detection action.');
    }
    if (normalizedAction === 'ignore') {
        return { ...detection, status: 'ignored', confirmedToothNumber: '' };
    }
    const tooth = String(confirmedToothNumber || detection.predictedToothNumber || '').trim();
    if (!isValidFdiTooth(tooth)) throw new Error('A valid permanent FDI tooth number is required.');
    if (normalizedAction === 'confirm' && tooth !== String(detection.predictedToothNumber || '')) {
        throw new Error('Use correct when the confirmed tooth differs from the AI suggestion.');
    }
    if (normalizedAction === 'correct' && tooth === String(detection.predictedToothNumber || '')) {
        throw new Error('Choose a different FDI tooth number when correcting an AI suggestion.');
    }
    return { ...detection, status: normalizedAction === 'confirm' ? 'confirmed' : 'corrected', confirmedToothNumber: tooth };
};

const buildApprovedSummaryDraft = ({ radiograph, treatmentLogs = [], previousRadiograph = null }) => {
    const analysis = radiograph?.analysis || {};
    const verified = (analysis.detections || []).filter((item) => ['confirmed', 'corrected'].includes(item.status));
    const teeth = [...new Set(verified.map((item) => item.confirmedToothNumber).filter(isValidFdiTooth))].sort();
    const findings = (radiograph?.annotations || []).filter((item) => item.findingType || item.note);
    const linkedTreatmentIds = new Set(findings.map((item) => String(item.treatmentLogId || '')).filter(Boolean));
    const relatedTreatments = treatmentLogs.filter((item) => linkedTreatmentIds.has(String(item._id || item.id)));
    const date = radiograph?.date ? new Date(radiograph.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : 'an unrecorded date';
    const sentences = [`${radiograph?.label || 'Radiograph'} reviewed on ${date}.`];
    if (teeth.length) sentences.push(`Dentist-verified teeth: ${teeth.join(', ')}.`);
    if (findings.length) sentences.push(`${findings.length} dentist-recorded finding${findings.length === 1 ? '' : 's'} included in this review.`);
    if (relatedTreatments.length) sentences.push(`${relatedTreatments.length} recorded treatment entr${relatedTreatments.length === 1 ? 'y is' : 'ies are'} linked.`);
    if (previousRadiograph?.date) {
        const previousDate = new Date(previousRadiograph.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
        sentences.push(`A previous radiograph from ${previousDate} is available for visual comparison.`);
    }
    if (!teeth.length && !findings.length) sentences.push('No dentist-confirmed tooth findings have been recorded yet.');
    return sentences.join('\n');
};

const calculateEvaluationMetrics = (radiographs = []) => {
    const analyses = radiographs.flatMap((item) => [
        ...(item?.analysisHistory || []),
        ...(item?.analysis ? [item.analysis] : []),
    ]).filter((analysis) => analysis?.status === 'ready');
    const detections = analyses.flatMap((analysis) => analysis?.detections || []);
    const reviewed = detections.filter((item) => ['confirmed', 'corrected'].includes(item.status));
    const correct = reviewed.filter((item) => item.status === 'confirmed' || String(item.predictedToothNumber) === String(item.confirmedToothNumber));
    const confidenceValues = detections.map((item) => Number(item.confidence)).filter(Number.isFinite);
    return {
        radiographsReviewed: radiographs.filter((item) => item?.analysis?.status === 'ready' || (item?.analysisHistory || []).some((analysis) => analysis?.status === 'ready')).length,
        teethDetected: detections.length,
        teethVerified: reviewed.length,
        correctAiNumbering: correct.length,
        dentistCorrections: reviewed.filter((item) => item.status === 'corrected').length,
        numberingAccuracy: reviewed.length ? correct.length / reviewed.length : null,
        correctionRate: reviewed.length ? reviewed.filter((item) => item.status === 'corrected').length / reviewed.length : null,
        averageConfidence: confidenceValues.length ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length : null,
        byModelVersion: [...new Set(analyses.map((analysis) => analysis.modelVersion).filter(Boolean))].map((modelVersion) => {
            const versionDetections = detections.filter((item) => String(item.modelVersion) === String(modelVersion));
            const versionReviewed = versionDetections.filter((item) => ['confirmed', 'corrected'].includes(item.status));
            const versionCorrect = versionReviewed.filter((item) => String(item.predictedToothNumber) === String(item.confirmedToothNumber));
            return {
                modelVersion,
                teethDetected: versionDetections.length,
                teethVerified: versionReviewed.length,
                numberingAccuracy: versionReviewed.length ? versionCorrect.length / versionReviewed.length : null,
                correctionRate: versionReviewed.length ? versionReviewed.filter((item) => item.status === 'corrected').length / versionReviewed.length : null,
            };
        }),
    };
};

module.exports = {
    DEFAULT_CONFIDENCE_THRESHOLDS,
    buildApprovedSummaryDraft,
    calculateEvaluationMetrics,
    classifyImageQuality,
    getConfidenceLevel,
    isValidFdiTooth,
    transitionDetection,
};
