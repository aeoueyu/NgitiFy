const assert = require('node:assert/strict');
const test = require('node:test');

const {
    MAX_CONTEXTUAL_EDUCATION_ARTICLES,
    MAX_RECENT_ORAL_HEALTH_LOGS,
    buildPatientAiCareContext,
    buildPatientAiEducationContext,
    buildPatientAiOralHealthContext,
    buildPatientAiRecentOralHealthLogs,
    buildPatientAiVisitRecommendationContext,
    mergePatientAiLiveContext,
} = require('../utils/patientAi');

test('builds AI visit explanation context from an existing system recommendation', () => {
    const context =
        buildPatientAiVisitRecommendationContext({
            label: 'Recommended',
            hasVisitWindow: true,
            recommendationBasis:
                'dentist-recommendation',
            recommendationReason:
                'Dentist follow-up is recorded.',
            recommendedDateKey:
                '2026-09-01',
            recommendedDateLabel:
                'September 1, 2026',
            windowStartKey:
                '2026-08-25',
            windowEndKey:
                '2026-09-08',
            windowLabel:
                'August 25 – September 8, 2026',
            sourceLabels: [
                'Dentist Recommendation',
            ],
            explanationItems: [
                'Dentist-suggested next visit recorded.',
            ],
            plannedCareSource:
                'Dentist Recommendation',
            isFollowUpRecommendation: true,
        });

    assert.equal(context.available, true);
    assert.equal(
        context.hasVisitWindow,
        true
    );
    assert.equal(
        context.recommendedDateKey,
        '2026-09-01'
    );
    assert.equal(
        context.plannedCareSource,
        'Dentist Recommendation'
    );
});

test('does not invent a visit window when no system recommendation exists', () => {
    const context =
        buildPatientAiVisitRecommendationContext(
            null
        );

    assert.equal(context.available, false);
    assert.equal(
        context.hasVisitWindow,
        false
    );
    assert.equal(
        context.recommendationBasis,
        'insufficient-data'
    );
    assert.match(
        context.recommendationReason,
        /no supported recommended visit window/i
    );
    assert.match(
        context.explanationItems.join(' '),
        /must not invent or calculate/i
    );
});

test('limits AI Oral Health Management context to recent structured logs', () => {
    const logs = [];

    for (let index = 1; index <= 12; index += 1) {
        logs.push({
            logDateKey:
                `2026-08-${String(index).padStart(
                    2,
                    '0'
                )}`,
            symptoms:
                index === 12
                    ? ['sensitivity']
                    : [],
            dailyCare: ['brushed-am'],
            riskFactors: [],
            notes:
                'Private free-text note that should not be copied.',
        });
    }

    const result =
        buildPatientAiRecentOralHealthLogs(
            logs
        );

    assert.equal(
        result.length,
        MAX_RECENT_ORAL_HEALTH_LOGS
    );

    assert.equal(
        result[0].logDateKey,
        '2026-08-12'
    );

    assert.deepEqual(
        result[0].symptoms,
        ['sensitivity']
    );

    assert.equal(
        Object.prototype.hasOwnProperty.call(
            result[0],
            'notes'
        ),
        false
    );
});

test('uses the existing Oral Health Management summary without diagnosing', () => {
    const context =
        buildPatientAiOralHealthContext({
            summary: {
                recentLogCount: 4,
                lastLogDateKey:
                    '2026-08-14',
                flossingDays: 3,
                brushingDays: 4,
                bleedingDays: 1,
                sensitivityDays: 2,
            },
            logs: [
                {
                    logDateKey:
                        '2026-08-14',
                    symptoms: [
                        'sensitivity',
                    ],
                    dailyCare: [
                        'brushed-am',
                        'flossed',
                    ],
                    riskFactors: [],
                },
            ],
        });

    assert.equal(
        context.summary.recentLogCount,
        4
    );

    assert.equal(
        context.summary.sensitivityDays,
        2
    );

    assert.equal(
        context.recentLogs[0].logDateKey,
        '2026-08-14'
    );
});

test('uses contextual Dental Health Education rather than generating a separate library', () => {
    const context =
        buildPatientAiEducationContext({
            contextualEducation: [
                {
                    id:
                        'sensitivity-triggers',
                    title:
                        'Understanding tooth sensitivity',
                    category:
                        'Tooth Sensitivity',
                    summary:
                        'Educational sensitivity information.',
                    body:
                        'Long article body.',
                    action:
                        'Persistent symptoms may be worth discussing with your dentist.',
                },
            ],
        });

    assert.equal(context.length, 1);

    assert.equal(
        context[0].id,
        'sensitivity-triggers'
    );

    assert.equal(
        Object.prototype.hasOwnProperty.call(
            context[0],
            'body'
        ),
        false
    );
});

test('limits contextual Dental Health Education sent to AI', () => {
    const contextualEducation =
        Array.from(
            { length: 10 },
            (_, index) => ({
                id: `article-${index + 1}`,
                title:
                    `Article ${index + 1}`,
                category: 'Education',
                summary: 'Summary',
                action: 'Action',
            })
        );

    const context =
        buildPatientAiEducationContext({
            contextualEducation,
        });

    assert.equal(
        context.length,
        MAX_CONTEXTUAL_EDUCATION_ARTICLES
    );
});

test('builds a complete AI care context with explicit authority boundaries', () => {
    const context =
        buildPatientAiCareContext({
            prediction: {
                label: 'Recommended',
                hasVisitWindow: true,
                recommendationBasis:
                    'dentist-recommendation',
                recommendationReason:
                    'Dentist follow-up is recorded.',
                plannedCareSource:
                    'Dentist Recommendation',
            },
            oralHealthPayload: {
                summary: {
                    recentLogCount: 1,
                    lastLogDateKey:
                        '2026-08-14',
                },
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
                contextualEducation: [
                    {
                        id:
                            'sensitivity-triggers',
                        title:
                            'Understanding tooth sensitivity',
                        category:
                            'Tooth Sensitivity',
                        summary:
                            'Educational information.',
                        action:
                            'Discuss persistent symptoms with your dentist.',
                    },
                ],
            },
        });

    assert.match(
        context.contextPolicy
            .recommendationAuthority,
        /system recommendation is authoritative/i
    );

    assert.match(
        context.contextPolicy
            .recommendationAuthority,
        /must not calculate, change, postpone, or override/i
    );

    assert.equal(
        context.systemRecommendation
            .plannedCareSource,
        'Dentist Recommendation'
    );

    assert.equal(
        context.oralHealthManagement
            .recentLogs.length,
        1
    );

    assert.equal(
        context.dentalHealthEducation[0].id,
        'sensitivity-triggers'
    );
});

test('client-supplied context is discarded from patient AI context', () => {
    const liveContext = {
        patientSession: {
            patientName: 'Real Patient',
        },
        careContext: {
            systemRecommendation: {
                label: 'Recommended',
            },
        },
    };

    const merged =
        mergePatientAiLiveContext({
            liveContext,
            assistantContext: {
                patientSession: {
                    patientName:
                        'Different Patient',
                },
                careContext: {
                    systemRecommendation: {
                        label:
                            'AI says wait one year',
                    },
                },
                clientUiState: {
                    source: 'web',
                },
            },
        });

    assert.equal(
        merged.patientSession.patientName,
        'Real Patient'
    );

    assert.equal(
        merged.careContext
            .systemRecommendation.label,
        'Recommended'
    );

    assert.equal(merged.clientSuppliedContext, undefined);
});

test('primitive client context is discarded from trusted live context', () => {
    const merged =
        mergePatientAiLiveContext({
            liveContext: {
                patientSession: {
                    patientName:
                        'Real Patient',
                },
            },
            assistantContext:
                'untrusted client value',
        });

    assert.equal(
        merged.patientSession.patientName,
        'Real Patient'
    );

    assert.equal(merged.clientSuppliedContext, undefined);
});

test('AI care context remains available independently of an external AI provider', () => {
    const context =
        buildPatientAiCareContext({
            prediction: {
                label:
                    'Insufficient Data',
                hasVisitWindow: false,
                recommendationBasis:
                    'insufficient-data',
                recommendationReason:
                    'No supported interval is available.',
            },
            oralHealthPayload: {
                summary: {
                    recentLogCount: 0,
                },
                logs: [],
                contextualEducation: [],
            },
        });

    assert.equal(
        context.systemRecommendation
            .hasVisitWindow,
        false
    );

    assert.ok(
        context.oralHealthManagement
    );

    assert.ok(
        context.dentalHealthEducation
    );
});
