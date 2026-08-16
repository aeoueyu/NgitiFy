const assert =
    require(
        'node:assert/strict'
    );

const test =
    require(
        'node:test'
    );

const {
    PATIENT_ONBOARDING_VERSION,
    createInitialPatientOnboardingState,
    serializePatientOnboarding,
    normalizePatientOnboardingUpdate,
} =
    require(
        '../utils/patientOnboarding'
    );

test(
    'creates incomplete onboarding state for newly created Patients',
    () => {
        const state =
            createInitialPatientOnboardingState();

        assert.equal(
            state.version,
            PATIENT_ONBOARDING_VERSION
        );

        assert.equal(
            state.completed,
            false
        );

        assert.equal(
            state.currentStep,
            0
        );

        assert.deepEqual(
            state.educationInterests,
            []
        );

        assert.equal(
            state
                .oralCareRoutine
                .brushing,
            ''
        );

        assert.equal(
            state
                .oralCareRoutine
                .flossing,
            ''
        );
    }
);

test(
    'legacy Patients without onboarding state safely bypass first-time onboarding',
    () => {
        const result =
            serializePatientOnboarding(
                undefined
            );

        assert.equal(
            result.required,
            false
        );

        assert.equal(
            result.completed,
            true
        );

        assert.equal(
            result.legacyBypass,
            true
        );

        assert.equal(
            result.version,
            null
        );
    }
);

test(
    'new incomplete onboarding state requires onboarding',
    () => {
        const result =
            serializePatientOnboarding(
                createInitialPatientOnboardingState()
            );

        assert.equal(
            result.required,
            true
        );

        assert.equal(
            result.completed,
            false
        );

        assert.equal(
            result.legacyBypass,
            false
        );
    }
);

test(
    'completed onboarding no longer requires first-time flow',
    () => {
        const state =
            createInitialPatientOnboardingState();

        state.completed =
            true;

        state.completedAt =
            new Date(
                '2026-08-16T12:00:00.000Z'
            );

        const result =
            serializePatientOnboarding(
                state
            );

        assert.equal(
            result.required,
            false
        );

        assert.equal(
            result.completed,
            true
        );

        assert.equal(
            result.legacyBypass,
            false
        );
    }
);

test(
    'normalizes optional preferred name without changing legal name',
    () => {
        const result =
            normalizePatientOnboardingUpdate({
                input: {
                    preferredName:
                        '  Mia  ',
                },

                existing:
                    createInitialPatientOnboardingState(),
            });

        assert.equal(
            result.preferredName,
            'Mia'
        );
    }
);

test(
    'rejects an excessively long preferred name',
    () => {
        assert.throws(
            () =>
                normalizePatientOnboardingUpdate({
                    input: {
                        preferredName:
                            'a'.repeat(
                                61
                            ),
                    },

                    existing:
                        createInitialPatientOnboardingState(),
                }),

            /60 characters or fewer/
        );
    }
);

test(
    'accepts approved education interests as personalization only',
    () => {
        const result =
            normalizePatientOnboardingUpdate({
                input: {
                    educationInterests: [
                        'tooth-sensitivity',
                        'gum-care',
                        'tooth-sensitivity',
                    ],
                },

                existing:
                    createInitialPatientOnboardingState(),
            });

        assert.deepEqual(
            result.educationInterests,
            [
                'tooth-sensitivity',
                'gum-care',
            ]
        );

        assert.equal(
            Object.prototype
                .hasOwnProperty
                .call(
                    result,
                    'symptoms'
                ),
            false
        );

        assert.equal(
            Object.prototype
                .hasOwnProperty
                .call(
                    result,
                    'oralHealthLogs'
                ),
            false
        );
    }
);

test(
    'rejects unsupported onboarding interests',
    () => {
        assert.throws(
            () =>
                normalizePatientOnboardingUpdate({
                    input: {
                        educationInterests: [
                            'diagnosed-gum-disease',
                        ],
                    },

                    existing:
                        createInitialPatientOnboardingState(),
                }),

            /Unsupported onboarding interest/
        );
    }
);

test(
    'normalizes lightweight oral-care routine preferences',
    () => {
        const result =
            normalizePatientOnboardingUpdate({
                input: {
                    oralCareRoutine: {
                        brushing:
                            'twice-daily',

                        flossing:
                            'sometimes',
                    },
                },

                existing:
                    createInitialPatientOnboardingState(),
            });

        assert.deepEqual(
            result.oralCareRoutine,
            {
                brushing:
                    'twice-daily',

                flossing:
                    'sometimes',
            }
        );
    }
);

test(
    'rejects unsupported oral-care routine values',
    () => {
        assert.throws(
            () =>
                normalizePatientOnboardingUpdate({
                    input: {
                        oralCareRoutine: {
                            brushing:
                                'perfect-score',
                        },
                    },

                    existing:
                        createInitialPatientOnboardingState(),
                }),

            /Unsupported brushing routine onboarding value/
        );
    }
);

test(
    'normalizes experience preferences without disabling core records',
    () => {
        const result =
            normalizePatientOnboardingUpdate({
                input: {
                    experiencePreferences: {
                        oralHealthManagement:
                            false,

                        dentalHealthEducation:
                            true,
                    },
                },

                existing:
                    createInitialPatientOnboardingState(),
            });

        assert.deepEqual(
            result
                .experiencePreferences,
            {
                oralHealthManagement:
                    false,

                dentalHealthEducation:
                    true,

                visitRecommendations:
                    true,

                appointmentUpdates:
                    true,
            }
        );

        assert.equal(
            Object.prototype
                .hasOwnProperty
                .call(
                    result,
                    'permissions'
                ),
            false
        );
    }
);

test(
    'accepts onboarding progress steps from zero through eight',
    () => {
        const result =
            normalizePatientOnboardingUpdate({
                input: {
                    currentStep: 6,
                },

                existing:
                    createInitialPatientOnboardingState(),
            });

        assert.equal(
            result.currentStep,
            6
        );
    }
);

test(
    'rejects onboarding progress outside the supported range',
    () => {
        assert.throws(
            () =>
                normalizePatientOnboardingUpdate({
                    input: {
                        currentStep:
                            9,
                    },

                    existing:
                        createInitialPatientOnboardingState(),
                }),

            /integer from 0 to 8/
        );
    }
);