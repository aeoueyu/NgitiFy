const assert =
    require('node:assert/strict');

const test =
    require('node:test');

const {
    DEFAULT_ORAL_HEALTH_REMINDER_TIME,
    buildDailyOralHealthReminderDecision,
    buildDentalHealthEducationTipDecision,
    buildSymptomFollowUpReminderDecision,
    getMondayWeekKey,
    hasOralHealthLogForDate,
    hasReachedReminderTime,
    normalizeTime,
} = require('../utils/patientNotifications');

test('normalizes configured Oral Health Management reminder time', () => {
    assert.equal(
        normalizeTime('19:30'),
        '19:30'
    );

    assert.equal(
        normalizeTime('99:99'),
        DEFAULT_ORAL_HEALTH_REMINDER_TIME
    );
});

test('detects whether configured reminder time has been reached', () => {
    assert.equal(
        hasReachedReminderTime({
            currentTime: '19:59',
            reminderTime: '20:00',
        }),
        false
    );

    assert.equal(
        hasReachedReminderTime({
            currentTime: '20:00',
            reminderTime: '20:00',
        }),
        true
    );

    assert.equal(
        hasReachedReminderTime({
            currentTime: '21:15',
            reminderTime: '20:00',
        }),
        true
    );
});

test('detects an existing same-date Oral Health Management log', () => {
    assert.equal(
        hasOralHealthLogForDate(
            [
                {
                    logDateKey:
                        '2026-08-14',
                    symptoms: [],
                    dailyCare: [
                        'brushed-am',
                    ],
                    riskFactors: [],
                },
            ],
            '2026-08-14'
        ),
        true
    );
});

test('generates a Daily Oral Health Management reminder when today is not logged', () => {
    const decision =
        buildDailyOralHealthReminderDecision({
            enabled: true,
            logs: [],
            todayKey:
                '2026-08-14',
            currentTime:
                '20:00',
            reminderTime:
                '20:00',
        });

    assert.equal(
        decision.shouldNotify,
        true
    );

    assert.equal(
        decision.type,
        'ORAL_HEALTH_DAILY_REMINDER'
    );

    assert.equal(
        decision.dedupeKey,
        'oral-health-daily:2026-08-14'
    );
});

test('does not generate a missing-log reminder before configured time', () => {
    const decision =
        buildDailyOralHealthReminderDecision({
            enabled: true,
            logs: [],
            todayKey:
                '2026-08-14',
            currentTime:
                '19:59',
            reminderTime:
                '20:00',
        });

    assert.equal(
        decision.shouldNotify,
        false
    );

    assert.equal(
        decision.reason,
        'before-reminder-time'
    );
});

test('does not generate a Daily Oral Health Management reminder when today is already logged', () => {
    const decision =
        buildDailyOralHealthReminderDecision({
            enabled: true,
            logs: [
                {
                    logDateKey:
                        '2026-08-14',
                    symptoms: [
                        'no-symptoms',
                    ],
                    dailyCare: [
                        'brushed-am',
                    ],
                    riskFactors: [],
                },
            ],
            todayKey:
                '2026-08-14',
            currentTime:
                '20:30',
            reminderTime:
                '20:00',
        });

    assert.equal(
        decision.shouldNotify,
        false
    );

    assert.equal(
        decision.reason,
        'already-logged'
    );
});

test('does not generate Daily Oral Health Management reminder when disabled', () => {
    const decision =
        buildDailyOralHealthReminderDecision({
            enabled: false,
            logs: [],
            todayKey:
                '2026-08-14',
            currentTime:
                '21:00',
        });

    assert.equal(
        decision.shouldNotify,
        false
    );

    assert.equal(
        decision.reason,
        'disabled'
    );
});

test('uses approved swelling rule for symptom follow-up reminder', () => {
    const decision =
        buildSymptomFollowUpReminderDecision({
            enabled: true,
            todayKey:
                '2026-08-14',
            logs: [
                {
                    logDateKey:
                        '2026-08-13',
                    symptoms: [
                        'swelling',
                    ],
                    dailyCare: [],
                    riskFactors: [],
                    symptomDetails: {},
                },
            ],
        });

    assert.equal(
        decision.shouldNotify,
        true
    );

    assert.equal(
        decision.type,
        'ORAL_HEALTH_SYMPTOM_FOLLOW_UP'
    );

    assert.equal(
        decision.ruleId,
        'latest-log-swelling'
    );

    assert.match(
        decision.message,
        /does not diagnose dental disease/i
    );
});

test('uses approved severe-context rule for symptom follow-up reminder', () => {
    const decision =
        buildSymptomFollowUpReminderDecision({
            enabled: true,
            todayKey:
                '2026-08-14',
            logs: [
                {
                    logDateKey:
                        '2026-08-13',
                    symptoms: [
                        'toothache',
                    ],
                    dailyCare: [],
                    riskFactors: [],
                    symptomDetails: {
                        toothache: {
                            severity:
                                'severe',
                        },
                    },
                },
            ],
        });

    assert.equal(
        decision.shouldNotify,
        true
    );

    assert.equal(
        decision.ruleId,
        'latest-log-severe-context'
    );
});

test('does not invent symptom follow-up rules for non-escalation logs', () => {
    const decision =
        buildSymptomFollowUpReminderDecision({
            enabled: true,
            todayKey:
                '2026-08-14',
            logs: [
                {
                    logDateKey:
                        '2026-08-13',
                    symptoms: [
                        'sensitivity',
                    ],
                    dailyCare: [
                        'brushed-am',
                    ],
                    riskFactors: [],
                    symptomDetails: {},
                },
            ],
        });

    assert.equal(
        decision.shouldNotify,
        false
    );

    assert.equal(
        decision.reason,
        'no-approved-rule'
    );
});

test('does not send symptom follow-up on the same day as the source log', () => {
    const decision =
        buildSymptomFollowUpReminderDecision({
            enabled: true,
            todayKey:
                '2026-08-14',
            logs: [
                {
                    logDateKey:
                        '2026-08-14',
                    symptoms: [
                        'swelling',
                    ],
                    dailyCare: [],
                    riskFactors: [],
                },
            ],
        });

    assert.equal(
        decision.shouldNotify,
        false
    );

    assert.equal(
        decision.reason,
        'same-day-or-invalid-date'
    );
});

test('builds a stable weekly Dental Health Education reminder key', () => {
    assert.equal(
        getMondayWeekKey(
            '2026-08-14'
        ),
        '2026-08-10'
    );

    assert.equal(
        getMondayWeekKey(
            '2026-08-16'
        ),
        '2026-08-10'
    );
});

test('builds Dental Health Education notification from approved contextual education', () => {
    const decision =
        buildDentalHealthEducationTipDecision({
            enabled: true,
            todayKey:
                '2026-08-14',
            logs: [
                {
                    logDateKey:
                        '2026-08-14',
                    symptoms: [
                        'sensitivity',
                    ],
                    dailyCare: [],
                    riskFactors: [],
                },
            ],
        });

    assert.equal(
        decision.shouldNotify,
        true
    );

    assert.equal(
        decision.type,
        'DENTAL_HEALTH_TIP'
    );

    assert.equal(
        decision.articleId,
        'sensitivity-triggers'
    );

    assert.match(
        decision.dedupeKey,
        /^dental-health-tip:2026-08-10:/
    );
});

test('does not generate Dental Health Education notification without related context', () => {
    const decision =
        buildDentalHealthEducationTipDecision({
            enabled: true,
            todayKey:
                '2026-08-14',
            logs: [
                {
                    logDateKey:
                        '2026-08-14',
                    symptoms: [
                        'no-symptoms',
                    ],
                    dailyCare: [],
                    riskFactors: [],
                },
            ],
        });

    assert.equal(
        decision.shouldNotify,
        false
    );

    assert.equal(
        decision.reason,
        'no-contextual-education'
    );
});