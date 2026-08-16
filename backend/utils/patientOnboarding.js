const PATIENT_ONBOARDING_VERSION = 1;

const EDUCATION_INTEREST_IDS = Object.freeze([
    'better-brushing-routine',
    'consistent-flossing',
    'gum-care',
    'tooth-sensitivity',
    'oral-health-symptoms',
    'appointment-reminders',
    'recommended-visits',
    'preventive-dental-care',
]);

const BRUSHING_ROUTINE_IDS = Object.freeze([
    '',
    'twice-daily',
    'once-daily',
    'varies',
    'prefer-not-to-say',
]);

const FLOSSING_ROUTINE_IDS = Object.freeze([
    '',
    'most-days',
    'sometimes',
    'rarely',
    'prefer-not-to-say',
]);

const EXPERIENCE_PREFERENCE_KEYS = Object.freeze([
    'oralHealthManagement',
    'dentalHealthEducation',
    'visitRecommendations',
    'appointmentUpdates',
]);

const ONBOARDING_MAX_STEP = 8;

const createInitialPatientOnboardingState = () => ({
    version: PATIENT_ONBOARDING_VERSION,
    completed: false,
    completedAt: null,
    currentStep: 0,
    preferredName: '',
    educationInterests: [],
    oralCareRoutine: {
        brushing: '',
        flossing: '',
    },
    experiencePreferences: {
        oralHealthManagement: true,
        dentalHealthEducation: true,
        visitRecommendations: true,
        appointmentUpdates: true,
    },
    startedAt: null,
    updatedAt: new Date(),
});

const getOnboardingValue = (
    onboarding,
    key,
    fallback
) => {
    if (
        onboarding
        && onboarding[key] !== undefined
        && onboarding[key] !== null
    ) {
        return onboarding[key];
    }

    return fallback;
};

const serializePatientOnboarding = (
    onboarding
) => {
    /*
     * Legacy Patients created before onboarding do not
     * have this nested object. They must not suddenly
     * become blocked by a newly introduced first-time flow.
     */
    if (
        !onboarding
        || Number(onboarding.version || 0) <= 0
    ) {
        return {
            version: null,
            required: false,
            legacyBypass: true,
            completed: true,
            completedAt: null,
            currentStep: 0,
            preferredName: '',
            educationInterests: [],
            oralCareRoutine: {
                brushing: '',
                flossing: '',
            },
            experiencePreferences: {
                oralHealthManagement: true,
                dentalHealthEducation: true,
                visitRecommendations: true,
                appointmentUpdates: true,
            },
            startedAt: null,
            updatedAt: null,
        };
    }

    const completed =
        onboarding.completed === true;

    return {
        version:
            Number(
                onboarding.version
                || PATIENT_ONBOARDING_VERSION
            ),

        required:
            !completed,

        legacyBypass:
            false,

        completed,

        completedAt:
            onboarding.completedAt
            || null,

        currentStep:
            Number(
                onboarding.currentStep
                || 0
            ),

        preferredName:
            String(
                onboarding.preferredName
                || ''
            ),

        educationInterests:
            Array.isArray(
                onboarding.educationInterests
            )
                ? [
                    ...onboarding
                        .educationInterests,
                ]
                : [],

        oralCareRoutine: {
            brushing:
                String(
                    onboarding
                        .oralCareRoutine
                        ?.brushing
                    || ''
                ),

            flossing:
                String(
                    onboarding
                        .oralCareRoutine
                        ?.flossing
                    || ''
                ),
        },

        experiencePreferences: {
            oralHealthManagement:
                getOnboardingValue(
                    onboarding
                        .experiencePreferences,
                    'oralHealthManagement',
                    true
                ),

            dentalHealthEducation:
                getOnboardingValue(
                    onboarding
                        .experiencePreferences,
                    'dentalHealthEducation',
                    true
                ),

            visitRecommendations:
                getOnboardingValue(
                    onboarding
                        .experiencePreferences,
                    'visitRecommendations',
                    true
                ),

            appointmentUpdates:
                getOnboardingValue(
                    onboarding
                        .experiencePreferences,
                    'appointmentUpdates',
                    true
                ),
        },

        startedAt:
            onboarding.startedAt
            || null,

        updatedAt:
            onboarding.updatedAt
            || null,
    };
};

const normalizePreferredName = (
    value
) => {
    const normalized =
        String(
            value
            ?? ''
        ).trim();

    if (
        normalized.length > 60
    ) {
        throw Object.assign(
            new Error(
                'Preferred name must be 60 characters or fewer.'
            ),
            {
                statusCode: 400,
            }
        );
    }

    return normalized;
};

const normalizeEducationInterests = (
    value
) => {
    if (!Array.isArray(value)) {
        throw Object.assign(
            new Error(
                'Education interests must be an array.'
            ),
            {
                statusCode: 400,
            }
        );
    }

    const normalized =
        [
            ...new Set(
                value.map(
                    (item) =>
                        String(
                            item
                            || ''
                        ).trim()
                )
            ),
        ]
            .filter(Boolean);

    const invalid =
        normalized.find(
            (item) =>
                !EDUCATION_INTEREST_IDS
                    .includes(item)
        );

    if (invalid) {
        throw Object.assign(
            new Error(
                `Unsupported onboarding interest: ${invalid}`
            ),
            {
                statusCode: 400,
            }
        );
    }

    return normalized;
};

const normalizeRoutineValue = ({
    value,
    allowed,
    label,
}) => {
    const normalized =
        String(
            value
            ?? ''
        ).trim();

    if (
        !allowed.includes(
            normalized
        )
    ) {
        throw Object.assign(
            new Error(
                `Unsupported ${label} onboarding value.`
            ),
            {
                statusCode: 400,
            }
        );
    }

    return normalized;
};

const normalizeExperiencePreferences = (
    value,
    existing = {}
) => {
    if (
        !value
        || typeof value !== 'object'
        || Array.isArray(value)
    ) {
        throw Object.assign(
            new Error(
                'Experience preferences must be an object.'
            ),
            {
                statusCode: 400,
            }
        );
    }

    const next = {
        oralHealthManagement:
            existing
                .oralHealthManagement
            ?? true,

        dentalHealthEducation:
            existing
                .dentalHealthEducation
            ?? true,

        visitRecommendations:
            existing
                .visitRecommendations
            ?? true,

        appointmentUpdates:
            existing
                .appointmentUpdates
            ?? true,
    };

    for (
        const key
        of EXPERIENCE_PREFERENCE_KEYS
    ) {
        if (
            value[key]
            === undefined
        ) {
            continue;
        }

        if (
            typeof value[key]
            !== 'boolean'
        ) {
            throw Object.assign(
                new Error(
                    `${key} must be true or false.`
                ),
                {
                    statusCode: 400,
                }
            );
        }

        next[key] =
            value[key];
    }

    return next;
};

const normalizeCurrentStep = (
    value
) => {
    const parsed =
        Number(value);

    if (
        !Number.isInteger(
            parsed
        )
        || parsed < 0
        || parsed
            > ONBOARDING_MAX_STEP
    ) {
        throw Object.assign(
            new Error(
                `Onboarding step must be an integer from 0 to ${ONBOARDING_MAX_STEP}.`
            ),
            {
                statusCode: 400,
            }
        );
    }

    return parsed;
};

const normalizePatientOnboardingUpdate = ({
    input = {},
    existing = {},
}) => {
    if (
        !input
        || typeof input !== 'object'
        || Array.isArray(input)
    ) {
        throw Object.assign(
            new Error(
                'Onboarding update must be an object.'
            ),
            {
                statusCode: 400,
            }
        );
    }

    const updates = {};

    if (
        input.preferredName
        !== undefined
    ) {
        updates.preferredName =
            normalizePreferredName(
                input.preferredName
            );
    }

    if (
        input.educationInterests
        !== undefined
    ) {
        updates.educationInterests =
            normalizeEducationInterests(
                input.educationInterests
            );
    }

    if (
        input.oralCareRoutine
        !== undefined
    ) {
        if (
            !input.oralCareRoutine
            || typeof input
                .oralCareRoutine
                !== 'object'
            || Array.isArray(
                input.oralCareRoutine
            )
        ) {
            throw Object.assign(
                new Error(
                    'Oral-care routine must be an object.'
                ),
                {
                    statusCode: 400,
                }
            );
        }

        updates.oralCareRoutine = {
            brushing:
                input
                    .oralCareRoutine
                    .brushing
                !== undefined
                    ? normalizeRoutineValue({
                        value:
                            input
                                .oralCareRoutine
                                .brushing,

                        allowed:
                            BRUSHING_ROUTINE_IDS,

                        label:
                            'brushing routine',
                    })
                    : String(
                        existing
                            .oralCareRoutine
                            ?.brushing
                        || ''
                    ),

            flossing:
                input
                    .oralCareRoutine
                    .flossing
                !== undefined
                    ? normalizeRoutineValue({
                        value:
                            input
                                .oralCareRoutine
                                .flossing,

                        allowed:
                            FLOSSING_ROUTINE_IDS,

                        label:
                            'flossing routine',
                    })
                    : String(
                        existing
                            .oralCareRoutine
                            ?.flossing
                        || ''
                    ),
        };
    }

    if (
        input.experiencePreferences
        !== undefined
    ) {
        updates.experiencePreferences =
            normalizeExperiencePreferences(
                input
                    .experiencePreferences,
                existing
                    .experiencePreferences
                || {}
            );
    }

    if (
        input.currentStep
        !== undefined
    ) {
        updates.currentStep =
            normalizeCurrentStep(
                input.currentStep
            );
    }

    return updates;
};

module.exports = {
    PATIENT_ONBOARDING_VERSION,
    EDUCATION_INTEREST_IDS,
    BRUSHING_ROUTINE_IDS,
    FLOSSING_ROUTINE_IDS,
    EXPERIENCE_PREFERENCE_KEYS,
    ONBOARDING_MAX_STEP,
    createInitialPatientOnboardingState,
    serializePatientOnboarding,
    normalizePatientOnboardingUpdate,
};