const assert = require('node:assert/strict');
const test = require('node:test');

const {
    buildExplainableVisitRecommendation,
    buildContextualDentalHealthEducation,
    buildOralHealthPayloadFromPatient,
    normalizeDailyOralHealthLogInput,
    normalizeOralHealthFactors,
} = require('../utils/oralHealth');
const OralHealthLog = require('../models/OralHealthLog');

test('normalizes oral health factors and treats none as exclusive', () => {
    const factors = normalizeOralHealthFactors(['sensitivity', 'none', 'braces']);
    const active = factors.filter((item) => item.active).map((item) => item.id);

    assert.deepEqual(active, ['none']);
});

test('rejects invalid oral health factors', () => {
    assert.throws(
        () => normalizeOralHealthFactors(['not-a-factor']),
        /Invalid oral health factor value/
    );
});

test('normalizes a daily oral health log payload', () => {
    const normalized = normalizeDailyOralHealthLogInput({
        logDate: '2026-08-13',
        symptoms: ['toothache', 'toothache', 'bad-breath'],
        dailyCare: ['brushed-am', 'flossed'],
        riskFactors: ['sugary-drinks'],
        symptomDetails: {
            toothache: { severity: 'mild', duration: 'Since this morning' },
        },
        notes: 'Cold drink sensitivity.',
    });

    assert.equal(normalized.logDateKey, '2026-08-13');
    assert.deepEqual(normalized.symptoms, ['toothache', 'bad-breath']);
    assert.deepEqual(normalized.dailyCare, ['brushed-am', 'flossed']);
    assert.deepEqual(normalized.riskFactors, ['sugary-drinks']);
    assert.deepEqual(normalized.symptomDetails.toothache, { severity: 'mild', duration: 'Since this morning' });
    assert.equal(normalized.notes, 'Cold drink sensitivity.');
});

test('rejects No Symptoms combined with actual symptoms', () => {
    assert.throws(
        () => normalizeDailyOralHealthLogInput({
            logDate: '2026-08-13',
            symptoms: ['no-symptoms', 'toothache'],
        }),
        /No Symptoms cannot be combined/
    );
});

test('requires at least one daily log signal', () => {
    assert.throws(
        () => normalizeDailyOralHealthLogInput({ logDate: '2026-08-13', symptoms: [], dailyCare: [], notes: '' }),
        /Select at least one symptom/
    );
});

test('builds oral health payload with summary and education library', () => {
    const payload = buildOralHealthPayloadFromPatient({
        oralHealthFactors: [{ id: 'sensitivity', label: 'Tooth Sensitivity', active: true }],
        oralHealthLogs: [
            { logDateKey: '2026-08-13', symptoms: ['sensitivity'], dailyCare: ['brushed-am', 'flossed'] },
            { logDateKey: '2026-08-12', symptoms: ['bleeding-gums'], dailyCare: ['brushed-pm'] },
        ],
    });

    assert.equal(payload.summary.recentLogCount, 2);
    assert.equal(payload.summary.sensitivityDays, 1);
    assert.equal(payload.summary.flossingDays, 1);
    assert.ok(payload.education.length >= 1);
});

test('declares one oral health log per patient per calendar date', () => {
    const indexes = OralHealthLog.schema.indexes();
    assert.ok(indexes.some(([fields, options]) => (
        fields.patient === 1
        && fields.logDateKey === 1
        && options.unique === true
    )));
});

test('adds explainable contact-clinic guidance for an approved oral health safety rule', () => {
    const prediction = buildExplainableVisitRecommendation({
        basePrediction: {
            label: 'On Track',
            recommendedDateLabel: 'September 8, 2026',
            windowLabel: 'September 1, 2026 - September 15, 2026',
            recommendationBasis: 'dentist-follow-up',
            recommendationReason: 'Based on the follow-up date recorded after your latest treatment.',
            intervalLabel: 'Clinic follow-up date',
            isFollowUpRecommendation: true,
            lastProcedure: 'Cleaning',
            lastVisitDate: '2026-08-01',
        },
        oralHealthLogs: [
            { logDateKey: '2026-08-13', symptoms: ['swelling'], dailyCare: ['brushed-am'] },
        ],
    });

    assert.equal(prediction.contactClinicSooner, true);
    assert.equal(prediction.label, 'Contact Clinic');
    assert.ok(prediction.sourceLabels.includes('Approved Safety Rule'));
    assert.ok(prediction.sourceLabels.includes('Dentist Recommendation'));
    assert.match(prediction.recommendationReason, /swelling/i);
    assert.equal(prediction.windowLabel, 'September 1, 2026 - September 15, 2026');
});

test('does not postpone a dentist recommendation from low-concern patient logs', () => {
    const prediction = buildExplainableVisitRecommendation({
        basePrediction: {
            label: 'Due Soon',
            recommendedDateLabel: 'September 8, 2026',
            windowLabel: 'September 1, 2026 - September 15, 2026',
            recommendationBasis: 'dentist-follow-up',
            recommendationReason: 'Based on the follow-up date recorded after your latest treatment.',
            intervalLabel: 'Clinic follow-up date',
            isFollowUpRecommendation: true,
            lastProcedure: 'Cleaning',
            lastVisitDate: '2026-08-01',
        },
        oralHealthLogs: [
            { logDateKey: '2026-08-13', symptoms: ['no-symptoms'], dailyCare: ['brushed-am', 'brushed-pm', 'flossed'] },
        ],
    });

    assert.equal(prediction.contactClinicSooner, false);
    assert.equal(prediction.label, 'Due Soon');
    assert.equal(prediction.recommendationBasis, 'dentist-follow-up');
    assert.equal(prediction.windowLabel, 'September 1, 2026 - September 15, 2026');
    assert.ok(prediction.explanationItems.some((item) => /do not postpone/i.test(item)));
});

test('does not invent a visit window when clinic history is insufficient', () => {
    const prediction = buildExplainableVisitRecommendation({
        basePrediction: null,
        oralHealthLogs: [
            { logDateKey: '2026-08-13', symptoms: ['no-symptoms'], dailyCare: ['brushed-am'] },
        ],
    });

    assert.equal(prediction.hasVisitWindow, false);
    assert.equal(prediction.recommendationBasis, 'insufficient-data');
    assert.ok(!prediction.windowLabel);
    assert.match(prediction.recommendationReason, /cannot calculate a visit window/i);
});

test('surfaces contextual Dental Health Education from approved log topics', () => {
    const education = buildContextualDentalHealthEducation([
        {
            logDateKey: '2026-08-13',
            symptoms: ['sensitivity'],
            dailyCare: [],
            riskFactors: ['missed-brushing'],
        },
    ]);

    const ids = education.map((article) => article.id);
    assert.ok(ids.includes('sensitivity-triggers'));
    assert.ok(ids.includes('brushing-routine'));
    assert.ok(education.every((article) => Array.isArray(article.relatedLogIds)));
});
