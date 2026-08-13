const assert = require('node:assert/strict');
const test = require('node:test');

const {
    buildOralHealthPayloadFromPatient,
    normalizeDailyOralHealthLogInput,
    normalizeOralHealthFactors,
} = require('../utils/oralHealth');

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
        symptoms: ['sensitivity', 'sensitivity', 'bad-breath'],
        dailyCare: ['brushing', 'flossing'],
        notes: 'Cold drink sensitivity.',
    });

    assert.equal(normalized.logDateKey, '2026-08-13');
    assert.deepEqual(normalized.symptoms, ['sensitivity', 'bad-breath']);
    assert.deepEqual(normalized.dailyCare, ['brushing', 'flossing']);
    assert.equal(normalized.notes, 'Cold drink sensitivity.');
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
            { logDateKey: '2026-08-13', symptoms: ['sensitivity'], dailyCare: ['brushing', 'flossing'] },
            { logDateKey: '2026-08-12', symptoms: ['bleeding-gums'], dailyCare: ['brushing'] },
        ],
    });

    assert.equal(payload.summary.recentLogCount, 2);
    assert.equal(payload.summary.sensitivityDays, 1);
    assert.equal(payload.summary.flossingDays, 1);
    assert.ok(payload.education.length >= 1);
});
