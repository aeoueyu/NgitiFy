const assert =
    require('node:assert/strict');

const fs =
    require('node:fs');

const path =
    require('node:path');

const test =
    require('node:test');

const {
    buildExplainableVisitRecommendation,
} = require('../utils/oralHealth');

const OralHealthLog =
    require('../models/OralHealthLog');

const REPOSITORY_ROOT =
    path.resolve(
        __dirname,
        '..',
        '..'
    );

const readRepositoryFile = (
    relativePath
) => {
    return fs.readFileSync(
        path.join(
            REPOSITORY_ROOT,
            relativePath
        ),
        'utf8'
    );
};

const extractExpressRoute = (
    source,
    marker
) => {
    const start =
        source.indexOf(marker);

    assert.notEqual(
        start,
        -1,
        `Expected route marker: ${marker}`
    );

    const nextRoute =
        source.indexOf(
            '\napp.',
            start + marker.length
        );

    return nextRoute === -1
        ? source.slice(start)
        : source.slice(
            start,
            nextRoute
        );
};

test(
    'persists one logical Oral Health Management log per patient and calendar date',
    () => {
        const indexes =
            OralHealthLog
                .schema
                .indexes();

        assert.ok(
            indexes.some(
                ([
                    fields,
                    options,
                ]) => (
                    fields.patient === 1
                    && fields.logDateKey
                        === 1
                    && options.unique
                        === true
                )
            ),
            'OralHealthLog must enforce a unique patient + logDateKey index.'
        );

        const serverSource =
            readRepositoryFile(
                'backend/server.js'
            );

        const saveRoute =
            extractExpressRoute(
                serverSource,
                "app.post('/api/my/oral-health/logs'"
            );

        assert.match(
            saveRoute,
            /OralHealthLog\.exists\s*\(\s*\{\s*patient:\s*patient\._id,\s*logDateKey:\s*normalizedLog\.logDateKey/s
        );

        assert.match(
            saveRoute,
            /OralHealthLog\.findOneAndUpdate\s*\(\s*\{\s*patient:\s*patient\._id,\s*logDateKey:\s*normalizedLog\.logDateKey\s*\}/s
        );

        assert.match(
            saveRoute,
            /\$set:/,
            'Same-date persistence must update the existing logical record.'
        );
    }
);

test(
    'Oral Health Management ownership comes from the authenticated patient rather than client patient identifiers',
    () => {
        const serverSource =
            readRepositoryFile(
                'backend/server.js'
            );

        const routeMarkers = [
            "app.get('/api/my/oral-health'",
            "app.patch('/api/my/oral-health/factors'",
            "app.post('/api/my/oral-health/logs'",
        ];

        routeMarkers.forEach(
            (marker) => {
                const routeSource =
                    extractExpressRoute(
                        serverSource,
                        marker
                    );

                assert.match(
                    routeSource,
                    /verifyToken/
                );

                assert.match(
                    routeSource,
                    /req\.user\.role\s*!==\s*['"]patient['"]/
                );

                assert.match(
                    routeSource,
                    /User\.findById\s*\(\s*req\.user\.id\s*\)/
                );

                assert.doesNotMatch(
                    routeSource,
                    /req\.body\.(?:patientId|patient_id)/
                );

                assert.doesNotMatch(
                    routeSource,
                    /req\.query\.(?:patientId|patient_id)/
                );

                assert.doesNotMatch(
                    routeSource,
                    /req\.params\.(?:patientId|patient_id)/
                );
            }
        );
    }
);

test(
    'Web and Mobile use the same persisted Oral Health Management API family',
    () => {
        const webSource =
            readRepositoryFile(
                'ngitify-web/src/pages/patient/PatientOralCare.js'
            );

        const mobileSource =
            readRepositoryFile(
                'ngitify-mobile/src/screens/patient/OralCareInsightsScreen.js'
            );

        assert.match(
            webSource,
            /['"]\/my\/oral-health['"]/
        );

        assert.match(
            webSource,
            /['"]\/my\/oral-health\/logs['"]/
        );

        assert.match(
            webSource,
            /['"]\/my\/oral-health\/factors['"]/
        );

        assert.match(
            mobileSource,
            /\/api\/my\/oral-health/
        );

        assert.match(
            mobileSource,
            /\/api\/my\/oral-health\/logs/
        );

        assert.match(
            mobileSource,
            /\/api\/my\/oral-health\/factors/
        );

        assert.doesNotMatch(
            webSource,
            /web_daily_logs/i
        );

        assert.doesNotMatch(
            mobileSource,
            /mobile_daily_logs/i
        );
    }
);

test(
    'dentist recommendation remains the primary planned-care source without escalation',
    () => {
        const prediction =
            buildExplainableVisitRecommendation({
                basePrediction: {
                    label:
                        'Due Soon',

                    hasVisitWindow:
                        true,

                    recommendedDateKey:
                        '2026-09-08',

                    recommendedDateLabel:
                        'September 8, 2026',

                    windowStartKey:
                        '2026-09-01',

                    windowEndKey:
                        '2026-09-15',

                    windowLabel:
                        'September 1, 2026 - September 15, 2026',

                    recommendationBasis:
                        'dentist-follow-up',

                    recommendationReason:
                        'Based on the follow-up date recorded after your latest treatment.',

                    intervalLabel:
                        'Clinic follow-up date',

                    isFollowUpRecommendation:
                        true,

                    lastProcedure:
                        'Cleaning',

                    lastVisitDate:
                        '2026-08-01',
                },

                oralHealthLogs: [],
            });

        assert.equal(
            prediction.contactClinicSooner,
            false
        );

        assert.equal(
            prediction.recommendationBasis,
            'dentist-follow-up'
        );

        assert.equal(
            prediction.windowLabel,
            'September 1, 2026 - September 15, 2026'
        );

        assert.ok(
            prediction.sourceLabels
                .includes(
                    'Dentist Recommendation'
                )
        );
    }
);

test(
    'approved escalation can recommend earlier professional contact without replacing the dentist visit window',
    () => {
        const prediction =
            buildExplainableVisitRecommendation({
                basePrediction: {
                    label:
                        'On Track',

                    hasVisitWindow:
                        true,

                    recommendedDateKey:
                        '2026-09-08',

                    recommendedDateLabel:
                        'September 8, 2026',

                    windowStartKey:
                        '2026-09-01',

                    windowEndKey:
                        '2026-09-15',

                    windowLabel:
                        'September 1, 2026 - September 15, 2026',

                    recommendationBasis:
                        'dentist-follow-up',

                    recommendationReason:
                        'Dentist follow-up is recorded.',

                    intervalLabel:
                        'Clinic follow-up date',

                    isFollowUpRecommendation:
                        true,

                    lastProcedure:
                        'Cleaning',

                    lastVisitDate:
                        '2026-08-01',
                },

                oralHealthLogs: [
                    {
                        logDateKey:
                            '2026-08-14',

                        symptoms: [
                            'swelling',
                        ],

                        dailyCare: [
                            'brushed-am',
                        ],

                        riskFactors: [],
                    },
                ],
            });

        assert.equal(
            prediction.contactClinicSooner,
            true
        );

        assert.equal(
            prediction.label,
            'Contact Clinic'
        );

        assert.equal(
            prediction.windowLabel,
            'September 1, 2026 - September 15, 2026'
        );

        assert.ok(
            prediction.sourceLabels
                .includes(
                    'Approved Safety Rule'
                )
        );

        assert.ok(
            prediction.sourceLabels
                .includes(
                    'Dentist Recommendation'
                )
        );
    }
);

test(
    'My Appointments contains booking and the legacy patient booking route remains compatible',
    () => {
        const appSource =
            readRepositoryFile(
                'ngitify-web/src/App.js'
            );

        const appointmentsSource =
            readRepositoryFile(
                'ngitify-web/src/pages/patient/PatientAppointments.js'
            );

        assert.match(
            appSource,
            /path=["']\/patient\/appointments["']/
        );

        assert.match(
            appSource,
            /path=["']\/patient\/book["']/
        );

        assert.match(
            appSource,
            /to=["']\/patient\/appointments\?mode=book["']/
        );

        assert.match(
            appointmentsSource,
            /import\s+PatientBooking\s+from\s+['"]\.\/PatientBooking['"]/
        );

        assert.match(
            appointmentsSource,
            /['"]upcoming['"]/
        );

        assert.match(
            appointmentsSource,
            /['"]history['"]/
        );

        assert.match(
            appointmentsSource,
            /['"]book['"]/
        );

        assert.match(
            appointmentsSource,
            /<PatientBooking/
        );
    }
);

test(
    'patient sidebar exposes My Appointments without a separate Book Appointment destination',
    () => {
        const sidebarSource =
            readRepositoryFile(
                'ngitify-web/src/components/sidebar/Sidebar.js'
            );

        assert.match(
            sidebarSource,
            /My Appointments/
        );

        assert.doesNotMatch(
            sidebarSource,
            /['"]Book Appointment['"]/
        );

        assert.doesNotMatch(
            sidebarSource,
            /\/patient\/book/
        );
    }
);