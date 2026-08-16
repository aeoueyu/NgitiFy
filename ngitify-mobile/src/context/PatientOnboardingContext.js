import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';

import {
    AuthContext,
} from './AuthContext';

const DEFAULT_EXPERIENCE_PREFERENCES = {
    oralHealthManagement: true,
    dentalHealthEducation: true,
    visitRecommendations: true,
    appointmentUpdates: true,
};

const buildInitialDraft = (
    firstName = ''
) => ({
    preferredName:
        firstName || '',

    educationInterests: [],

    oralCareRoutine: {
        brushing: '',
        flossing: '',
    },

    experiencePreferences: {
        ...DEFAULT_EXPERIENCE_PREFERENCES,
    },
});

export const PatientOnboardingContext =
    createContext(null);

export function PatientOnboardingProvider({
    children,
}) {
    const {
        userToken,
        userInfo,
        API_BASE_URL,
    } = useContext(
        AuthContext
    );

    const [
        draft,
        setDraft,
    ] = useState(
        () =>
            buildInitialDraft(
                userInfo?.firstName
                || ''
            )
    );

    const [
        onboardingState,
        setOnboardingState,
    ] = useState(null);

    const [
        hasLoadedOnboarding,
        setHasLoadedOnboarding,
    ] = useState(false);

    const [
        postOnboardingDestination,
        setPostOnboardingDestination,
    ] = useState(null);

    const [
        notificationPreferences,
        setNotificationPreferences,
    ] = useState(null);

    const [
        isLoading,
        setIsLoading,
    ] = useState(false);

    const [
        isSaving,
        setIsSaving,
    ] = useState(false);

    const [
        isCompleting,
        setIsCompleting,
    ] = useState(false);

    const [
        error,
        setError,
    ] = useState('');

    const registeredFirstName =
        userInfo?.firstName
        || '';

    const mergeOnboardingIntoDraft =
        useCallback(
            (
                onboarding
            ) => {
                setDraft(
                    (current) => ({
                        ...current,

                        preferredName:
                            onboarding
                                ?.preferredName
                            || current
                                .preferredName
                            || registeredFirstName
                            || '',

                        educationInterests:
                            Array.isArray(
                                onboarding
                                    ?.educationInterests
                            )
                                ? [
                                    ...onboarding
                                        .educationInterests,
                                ]
                                : current
                                    .educationInterests,

                        oralCareRoutine: {
                            brushing:
                                onboarding
                                    ?.oralCareRoutine
                                    ?.brushing
                                ?? current
                                    .oralCareRoutine
                                    .brushing,

                            flossing:
                                onboarding
                                    ?.oralCareRoutine
                                    ?.flossing
                                ?? current
                                    .oralCareRoutine
                                    .flossing,
                        },

                        experiencePreferences: {
                            ...current
                                .experiencePreferences,

                            ...(
                                onboarding
                                    ?.experiencePreferences
                                || {}
                            ),
                        },
                    })
                );
            },
            [
                registeredFirstName,
            ]
        );

    const loadOnboarding =
        useCallback(
            async () => {
                if (
                    !userToken
                    || !API_BASE_URL
                ) {
                    return null;
                }

                setIsLoading(true);
                setHasLoadedOnboarding(false);
                setError('');

                try {
                    const response =
                        await fetch(
                            `${API_BASE_URL}/api/my/onboarding`,
                            {
                                headers: {
                                    Authorization:
                                        `Bearer ${userToken}`,
                                },
                            }
                        );

                    const data =
                        await response
                            .json()
                            .catch(
                                () => ({})
                            );

                    if (
                        !response.ok
                    ) {
                        throw new Error(
                            data.message
                            || 'Unable to load onboarding information.'
                        );
                    }

                    const nextOnboarding =
                        data.onboarding
                        || null;

                    setOnboardingState(
                        nextOnboarding
                    );

                    setNotificationPreferences(
                        data
                            .notificationPreferences
                        || null
                    );

                    mergeOnboardingIntoDraft(
                        nextOnboarding
                    );

                    return data;
                } catch (loadError) {
                    const message =
                        loadError?.message
                        || 'Unable to load onboarding information.';

                    setError(
                        message
                    );

                    throw loadError;
                } finally {
                    setHasLoadedOnboarding(true);
                    setIsLoading(false);
                }
            },
            [
                API_BASE_URL,
                mergeOnboardingIntoDraft,
                userToken,
            ]
        );

    useEffect(
        () => {
            /*
             * Onboarding is backend-authoritative.
             *
             * Do not fetch it before the existing mandatory
             * app privacy-consent gate has completed.
             *
             * On logout, clear every account-specific onboarding
             * value so one Patient's draft cannot leak into the
             * next Patient session.
             */
            if (!userToken) {
                setOnboardingState(
                    null
                );

                setHasLoadedOnboarding(
                    false
                );

                setPostOnboardingDestination(
                    null
                );

                setNotificationPreferences(
                    null
                );

                setDraft(
                    buildInitialDraft(
                        ''
                    )
                );

                setError('');
                setIsLoading(false);
                setIsSaving(false);
                setIsCompleting(false);

                return;
            }

            if (
                !userInfo
                    ?.appConsentGiven
            ) {
                setOnboardingState(
                    null
                );

                setHasLoadedOnboarding(
                    false
                );

                setError('');
                setIsLoading(false);

                return;
            }

            loadOnboarding()
                .catch(
                    () => {
                        /*
                         * loadOnboarding already keeps the
                         * user-facing error. AppNavigator will
                         * provide Retry and temporary access
                         * rather than permanently blocking
                         * core Patient functionality.
                         */
                    }
                );
        },
        [
            loadOnboarding,
            userInfo
                ?.appConsentGiven,
            userToken,
        ]
    );

    useEffect(
        () => {
            if (
                !draft.preferredName
                && registeredFirstName
            ) {
                setDraft(
                    (current) => ({
                        ...current,

                        preferredName:
                            registeredFirstName,
                    })
                );
            }
        },
        [
            draft.preferredName,
            registeredFirstName,
        ]
    );

    const updateDraft =
        useCallback(
            (
                partial
            ) => {
                setDraft(
                    (current) => {
                        const next =
                            typeof partial
                            === 'function'
                                ? partial(
                                    current
                                )
                                : {
                                    ...current,
                                    ...partial,
                                };

                        return next;
                    }
                );

                setError('');
            },
            []
        );

    const setPreferredName =
        useCallback(
            (
                preferredName
            ) => {
                updateDraft(
                    (current) => ({
                        ...current,
                        preferredName,
                    })
                );
            },
            [
                updateDraft,
            ]
        );

    const toggleEducationInterest =
        useCallback(
            (
                interestId
            ) => {
                updateDraft(
                    (current) => {
                        const exists =
                            current
                                .educationInterests
                                .includes(
                                    interestId
                                );

                        return {
                            ...current,

                            educationInterests:
                                exists
                                    ? current
                                        .educationInterests
                                        .filter(
                                            (
                                                item
                                            ) =>
                                                item
                                                !== interestId
                                        )
                                    : [
                                        ...current
                                            .educationInterests,

                                        interestId,
                                    ],
                        };
                    }
                );
            },
            [
                updateDraft,
            ]
        );

    const setRoutineValue =
        useCallback(
            (
                key,
                value
            ) => {
                updateDraft(
                    (current) => ({
                        ...current,

                        oralCareRoutine: {
                            ...current
                                .oralCareRoutine,

                            [key]:
                                value,
                        },
                    })
                );
            },
            [
                updateDraft,
            ]
        );

    const saveProgress =
        useCallback(
            async ({
                currentStep,
                fields = {},
            }) => {
                if (
                    !userToken
                    || !API_BASE_URL
                ) {
                    throw new Error(
                        'Your session is unavailable. Please log in again.'
                    );
                }

                setIsSaving(true);
                setError('');

                try {
                    const response =
                        await fetch(
                            `${API_BASE_URL}/api/my/onboarding`,
                            {
                                method:
                                    'PATCH',

                                headers: {
                                    'Content-Type':
                                        'application/json',

                                    Authorization:
                                        `Bearer ${userToken}`,
                                },

                                body:
                                    JSON.stringify({
                                        currentStep,
                                        ...fields,
                                    }),
                            }
                        );

                    const data =
                        await response
                            .json()
                            .catch(
                                () => ({})
                            );

                    if (
                        !response.ok
                    ) {
                        throw new Error(
                            data.message
                            || 'Unable to save onboarding progress.'
                        );
                    }

                    setOnboardingState(
                        data.onboarding
                        || null
                    );

                    return data;
                } catch (saveError) {
                    const message =
                        saveError?.message
                        || 'Unable to save onboarding progress.';

                    setError(
                        message
                    );

                    throw saveError;
                } finally {
                    setIsSaving(false);
                }
            },
            [
                API_BASE_URL,
                userToken,
            ]
        );

    const saveNotificationPreferences =
        useCallback(
            async (
                preferences
            ) => {
                if (
                    !userToken
                    || !API_BASE_URL
                ) {
                    throw new Error(
                        'Your session is unavailable. Please log in again.'
                    );
                }

                const allowedKeys = [
                    'notifAppointments',
                    'notifVisitWindow',
                    'notifOralHealthDaily',
                    'notifSymptomFollowUp',
                    'notifHealthTips',
                ];

                const payload = {};

                allowedKeys.forEach(
                    (
                        key
                    ) => {
                        if (
                            typeof preferences?.[
                                key
                            ]
                            === 'boolean'
                        ) {
                            payload[key] =
                                preferences[key];
                        }
                    }
                );

                if (
                    Object.keys(
                        payload
                    ).length === 0
                ) {
                    throw new Error(
                        'No notification preferences were provided.'
                    );
                }

                setIsSaving(true);
                setError('');

                try {
                    const response =
                        await fetch(
                            `${API_BASE_URL}/api/my/settings`,
                            {
                                method:
                                    'PATCH',

                                headers: {
                                    'Content-Type':
                                        'application/json',

                                    Authorization:
                                        `Bearer ${userToken}`,
                                },

                                body:
                                    JSON.stringify(
                                        payload
                                    ),
                            }
                        );

                    const data =
                        await response
                            .json()
                            .catch(
                                () => ({})
                            );

                    if (
                        !response.ok
                    ) {
                        throw new Error(
                            data.message
                            || 'Unable to save notification preferences.'
                        );
                    }

                    const nextPreferences = {
                        notifAppointments:
                            data
                                .notifAppointments
                            ?? payload
                                .notifAppointments
                            ?? true,

                        notifVisitWindow:
                            data
                                .notifVisitWindow
                            ?? payload
                                .notifVisitWindow
                            ?? true,

                        notifOralHealthDaily:
                            data
                                .notifOralHealthDaily
                            ?? payload
                                .notifOralHealthDaily
                            ?? true,

                        notifSymptomFollowUp:
                            data
                                .notifSymptomFollowUp
                            ?? payload
                                .notifSymptomFollowUp
                            ?? true,

                        notifHealthTips:
                            data
                                .notifHealthTips
                            ?? payload
                                .notifHealthTips
                            ?? true,

                        educationConsent:
                            data
                                .educationConsent
                            ?? notificationPreferences
                                ?.educationConsent
                            ?? false,
                    };

                    setNotificationPreferences(
                        nextPreferences
                    );

                    return {
                        ...data,
                        notificationPreferences:
                            nextPreferences,
                    };
                } catch (
                    saveError
                ) {
                    const message =
                        saveError?.message
                        || 'Unable to save notification preferences.';

                    setError(
                        message
                    );

                    throw saveError;
                } finally {
                    setIsSaving(false);
                }
            },
            [
                API_BASE_URL,
                notificationPreferences,
                userToken,
            ]
        );

    const completeOnboarding =
        useCallback(
            async (
                destination =
                    'dashboard'
            ) => {
                if (
                    !userToken
                    || !API_BASE_URL
                ) {
                    throw new Error(
                        'Your session is unavailable. Please log in again.'
                    );
                }

                setPostOnboardingDestination(
                    destination
                );

                setIsCompleting(true);
                setError('');

                try {
                    const response =
                        await fetch(
                            `${API_BASE_URL}/api/my/onboarding/complete`,
                            {
                                method:
                                    'POST',

                                headers: {
                                    'Content-Type':
                                        'application/json',

                                    Authorization:
                                        `Bearer ${userToken}`,
                                },
                            }
                        );

                    const data =
                        await response
                            .json()
                            .catch(
                                () => ({})
                            );

                    if (
                        !response.ok
                    ) {
                        throw new Error(
                            data.message
                            || 'Unable to complete onboarding.'
                        );
                    }

                    setOnboardingState(
                        data.onboarding
                        || null
                    );

                    return data;
                } catch (
                    completionError
                ) {
                    const message =
                        completionError?.message
                        || 'Unable to complete onboarding.';

                    setPostOnboardingDestination(
                        null
                    );

                    setError(
                        message
                    );

                    throw completionError;
                } finally {
                    setIsCompleting(false);
                }
            },
            [
                API_BASE_URL,
                userToken,
            ]
        );

    const clearError =
        useCallback(
            () => {
                setError('');
            },
            []
        );

    const displayName =
        useMemo(
            () => {
                const preferred =
                    String(
                        draft
                            .preferredName
                        || ''
                    ).trim();

                if (preferred) {
                    return preferred;
                }

                return registeredFirstName
                    || '';
            },
            [
                draft.preferredName,
                registeredFirstName,
            ]
        );

    const value =
        useMemo(
            () => ({
                draft,
                onboardingState,
                hasLoadedOnboarding,
                postOnboardingDestination,
                notificationPreferences,

                registeredFirstName,
                displayName,

                isLoading,
                isSaving,
                isCompleting,
                error,

                loadOnboarding,
                updateDraft,
                setPreferredName,
                toggleEducationInterest,
                setRoutineValue,
                saveProgress,
                saveNotificationPreferences,
                completeOnboarding,
                clearError,
            }),
            [
                clearError,
                displayName,
                draft,
                completeOnboarding,
                error,
                isCompleting,
                isLoading,
                isSaving,
                hasLoadedOnboarding,
                loadOnboarding,
                notificationPreferences,
                onboardingState,
                postOnboardingDestination,
                registeredFirstName,
                saveNotificationPreferences,
                saveProgress,
                setPreferredName,
                setRoutineValue,
                toggleEducationInterest,
                updateDraft,
            ]
        );

    return (
        <PatientOnboardingContext.Provider
            value={value}
        >
            {children}
        </PatientOnboardingContext.Provider>
    );
}

export function usePatientOnboarding() {
    const context =
        useContext(
            PatientOnboardingContext
        );

    if (!context) {
        throw new Error(
            'usePatientOnboarding must be used inside PatientOnboardingProvider.'
        );
    }

    return context;
}