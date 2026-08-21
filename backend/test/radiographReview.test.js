const test = require('node:test');
const assert = require('node:assert/strict');
const {
    buildApprovedSummaryDraft,
    calculateEvaluationMetrics,
    classifyImageQuality,
    getConfidenceLevel,
    isValidFdiTooth,
    transitionDetection,
} = require('../utils/radiographReview');

test('FDI validation and documented confidence bands are deterministic', () => {
    assert.equal(isValidFdiTooth('46'), true);
    assert.equal(isValidFdiTooth('19'), false);
    assert.equal(getConfidenceLevel(0.9), 'high');
    assert.equal(getConfidenceLevel(0.7), 'medium');
    assert.equal(getConfidenceLevel(0.4), 'low');
});

test('quality classification explains measured issues', () => {
    assert.equal(classifyImageQuality({ brightness: 120, contrast: 50, sharpness: 100, clippedDarkRatio: 0, clippedBrightRatio: 0 }).label, 'Good');
    const result = classifyImageQuality({ brightness: 30, contrast: 20, sharpness: 10, clippedDarkRatio: 0.3, clippedBrightRatio: 0 });
    assert.equal(result.label, 'Needs Review');
    assert.ok(result.issues.some((item) => item.code === 'low-contrast'));
});

test('detection verification, correction, and ignore preserve prediction provenance', () => {
    const original = { predictedToothNumber: '47', confidence: 0.72, modelVersion: 'v1' };
    assert.equal(transitionDetection(original, 'confirm').status, 'confirmed');
    const corrected = transitionDetection(original, 'correct', '46');
    assert.equal(corrected.confirmedToothNumber, '46');
    assert.equal(corrected.predictedToothNumber, '47');
    assert.equal(transitionDetection(original, 'ignore').status, 'ignored');
    assert.throws(() => transitionDetection(original, 'correct', '47'), /different FDI/);
});

test('summary uses verified teeth and dentist annotations, never pending suggestions', () => {
    const draft = buildApprovedSummaryDraft({ radiograph: { label: 'Panoramic radiograph', date: '2026-08-21', analysis: { detections: [
        { predictedToothNumber: '47', status: 'pending' },
        { predictedToothNumber: '46', confirmedToothNumber: '46', status: 'confirmed' },
    ] }, annotations: [{ toothNumber: '46', findingType: 'Existing restoration', note: 'Dentist recorded.' }] } });
    assert.match(draft, /Dentist-verified teeth: 46/);
    assert.doesNotMatch(draft, /47/);
});

test('evaluation metrics distinguish numbering accuracy from confidence', () => {
    const metrics = calculateEvaluationMetrics([{ analysis: { status: 'ready', detections: [
        { predictedToothNumber: '46', confirmedToothNumber: '46', status: 'confirmed', confidence: 0.9 },
        { predictedToothNumber: '47', confirmedToothNumber: '46', status: 'corrected', confidence: 0.7 },
    ] } }]);
    assert.equal(metrics.numberingAccuracy, 0.5);
    assert.equal(metrics.correctionRate, 0.5);
    assert.equal(metrics.averageConfidence, 0.8);
});
