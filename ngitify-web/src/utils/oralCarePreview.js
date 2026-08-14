const formatShortDate = (value) => {
    if (!value) {
        return 'Not available';
    }

    const date =
        value instanceof Date
            ? value
            : new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return 'Not available';
    }

    return date.toLocaleDateString(
        'en-PH',
        {
            month: 'short',
            day: 'numeric',
        }
    );
};

const resolveDateFromPrediction = (
    dateKey,
    isoValue
) => {
    if (
        /^\d{4}-\d{2}-\d{2}$/.test(
            String(
                dateKey || ''
            ).trim()
        )
    ) {
        const date =
            new Date(
                `${dateKey}T12:00:00`
            );

        if (
            !Number.isNaN(
                date.getTime()
            )
        ) {
            return date;
        }
    }

    if (isoValue) {
        const date =
            new Date(isoValue);

        if (
            !Number.isNaN(
                date.getTime()
            )
        ) {
            return date;
        }
    }

    return null;
};

const getLabelMap = (
    groups = []
) => {
    const labels = {};

    (
        Array.isArray(groups)
            ? groups
            : []
    ).forEach((group) => {
        (
            Array.isArray(group?.items)
                ? group.items
                : []
        ).forEach((item) => {
            if (item?.id) {
                labels[item.id] =
                    item.label
                    || item.id;
            }
        });
    });

    return labels;
};

const normalizeGroups = (
    groups = [],
    latestLog = null
) => {
    const source =
        Array.isArray(groups)
            ? groups
            : [];

    const labelMap =
        getLabelMap(source);

    const selectedSymptoms =
        Array.isArray(
            latestLog?.symptoms
        )
            ? latestLog.symptoms
            : [];

    const selectedCare =
        Array.isArray(
            latestLog?.dailyCare
        )
            ? latestLog.dailyCare
            : [];

    const selectedRiskFactors =
        Array.isArray(
            latestLog?.riskFactors
        )
            ? latestLog.riskFactors
            : [];

    return source.map((group) => ({
        ...group,
        items: (
            Array.isArray(group?.items)
                ? group.items
                : []
        ).map((item) => ({
            ...item,
            selected:
                group.id === 'symptoms'
                    ? selectedSymptoms
                        .includes(item.id)
                    : group.id
                        === 'riskFactors'
                        ? selectedRiskFactors
                            .includes(
                                item.id
                            )
                        : selectedCare
                            .includes(
                                item.id
                            ),
            label:
                item.label
                || labelMap[item.id]
                || item.id,
        })),
    }));
};

const buildWatchSignals = (
    summary = {}
) => {
    const signals = [];

    if (
        Number(
            summary.bleedingDays
        ) > 0
    ) {
        signals.push({
            id: 'gum-watch',
            icon: 'water-outline',
            iconColor: '#01538b',
            tone: 'info',
            title: 'Gum Health Watch',
            summary:
                `Bleeding gums were recorded in ${summary.bleedingDays} recent log${Number(summary.bleedingDays) === 1 ? '' : 's'}.`,
            action:
                'Continue recording changes and review persistent or worsening concerns with the clinic.',
        });
    }

    if (
        Number(
            summary.sensitivityDays
        ) > 0
    ) {
        signals.push({
            id: 'sensitivity',
            icon: 'snow-outline',
            iconColor: '#149fc5',
            tone: 'secondary',
            title: 'Sensitivity Trend',
            summary:
                `Sensitivity was recorded in ${summary.sensitivityDays} recent log${Number(summary.sensitivityDays) === 1 ? '' : 's'}.`,
            action:
                'Continue recording triggers so your dentist can review the pattern.',
        });
    }

    if (
        Number.isFinite(
            Number(
                summary.flossingDays
            )
        )
    ) {
        signals.push({
            id: 'home-care',
            icon:
                'checkmark-done-outline',
            iconColor: '#01538b',
            tone: 'primary',
            title:
                'At-Home Care Record',
            summary:
                `Flossing is recorded on ${Number(summary.flossingDays)} recent logged day${Number(summary.flossingDays) === 1 ? '' : 's'}.`,
            action:
                'Use your Daily Oral Health Log to continue tracking your routine.',
        });
    }

    return signals;
};

export const getStaticOralCarePreview = (
    prediction = null,
    oralHealth = null
) => {
    const hasVisitWindow =
        prediction
            ?.hasVisitWindow
        !== false
        && Boolean(
            prediction?.windowLabel
            || prediction
                ?.windowStartKey
            || prediction
                ?.windowStart
            || prediction
                ?.recommendedDateKey
            || prediction
                ?.recommendedDate
        );

    const windowStart =
        resolveDateFromPrediction(
            prediction
                ?.windowStartKey,
            prediction
                ?.windowStart
        );

    const windowEnd =
        resolveDateFromPrediction(
            prediction
                ?.windowEndKey,
            prediction
                ?.windowEnd
        );

    const recommendedDate =
        resolveDateFromPrediction(
            prediction
                ?.recommendedDateKey,
            prediction
                ?.recommendedDate
        );

    const windowLabel =
        hasVisitWindow
            ? (
                prediction
                    ?.windowLabel
                || (
                    windowStart
                    && windowEnd
                        ? `${formatShortDate(windowStart)} - ${formatShortDate(windowEnd)}`
                        : 'Available'
                )
            )
            : 'Insufficient clinic history';

    const statusLabel =
        prediction?.label
        || (
            hasVisitWindow
                ? 'Recommended Visit Window Available'
                : 'Insufficient Data'
        );

    const recommendationReason =
        prediction
            ?.recommendationReason
        || (
            hasVisitWindow
                ? 'This Recommended Visit Window comes from NgitiFy’s deterministic backend recommendation.'
                : 'No dentist-suggested next visit or supported clinic treatment history is currently available, so NgitiFy cannot calculate a Recommended Visit Window.'
        );

    const suggestedNextAction =
        prediction
            ?.contactClinicSooner
            ? (
                prediction
                    .contactClinicReason
                || 'Contact the clinic sooner based on the current System Recommendation.'
            )
            : hasVisitWindow
                ? 'Follow the current System Recommendation and contact the clinic if you need help scheduling within the Recommended Visit Window.'
                : 'Ask the clinic to confirm your next recommended visit timing.';

    const logs =
        Array.isArray(
            oralHealth?.logs
        )
            ? oralHealth.logs
            : [];

    const latestLog =
        logs[0] || null;

    const summary =
        oralHealth?.summary
        && typeof oralHealth.summary
            === 'object'
            ? oralHealth.summary
            : {};

    const storedGroups =
        Array.isArray(
            oralHealth?.logGroups
        )
            ? oralHealth.logGroups
            : [];

    const factors =
        Array.isArray(
            oralHealth?.factors
        )
            ? oralHealth.factors
            : [];

    const education =
        Array.isArray(
            oralHealth?.education
        )
            ? oralHealth.education
            : [];

    const contextualEducation =
        Array.isArray(
            oralHealth
                ?.contextualEducation
        )
            ? oralHealth
                .contextualEducation
            : [];

    const summaryChips = [];

    if (
        prediction
            ?.lastProcedure
    ) {
        summaryChips.push(
            prediction.lastProcedure
        );
    }

    if (
        Number(
            summary.sensitivityDays
        ) > 0
    ) {
        summaryChips.push(
            `Sensitivity ${summary.sensitivityDays} recent logged day${Number(summary.sensitivityDays) === 1 ? '' : 's'}`
        );
    }

    if (
        Number.isFinite(
            Number(
                summary.flossingDays
            )
        )
    ) {
        summaryChips.push(
            `Flossing ${Number(summary.flossingDays)} recent logged day${Number(summary.flossingDays) === 1 ? '' : 's'}`
        );
    }

    return {
        windowStart,
        windowEnd,
        recommendedDate,

        isPreviewOnly: false,

        hero: {
            eyebrow:
                'System Recommendation',

            title:
                'Recommended Visit Window',

            headline:
                hasVisitWindow
                    ? `Your current Recommended Visit Window is ${windowLabel}.`
                    : 'No Recommended Visit Window is available yet.',

            statusLabel,

            windowLabel,

            whyThisShowing:
                recommendationReason,

            suggestedNextAction,

            recommendedDateLabel:
                hasVisitWindow
                && recommendedDate
                    ? formatShortDate(
                        recommendedDate
                    )
                    : 'Not available',

            sourceLabels:
                Array.isArray(
                    prediction
                        ?.sourceLabels
                )
                    ? prediction
                        .sourceLabels
                    : [],

            explanationItems:
                Array.isArray(
                    prediction
                        ?.explanationItems
                )
                && prediction
                    .explanationItems
                    .length
                    ? prediction
                        .explanationItems
                    : [
                        recommendationReason,
                    ],

            contactClinicSooner:
                Boolean(
                    prediction
                        ?.contactClinicSooner
                ),

            previewHint:
                oralHealth
                    ? 'Oral Health Management information shown here is loaded from your patient account.'
                    : 'Oral Health Management information is currently unavailable.',
        },

        summaryChips,

        watchSignals:
            buildWatchSignals(
                summary
            ),

        factors,

        logGroups:
            normalizeGroups(
                storedGroups,
                latestLog
            ),

        carePlan: {
            title:
                'Suggested Next Action',

            body:
                suggestedNextAction,

            checklist:
                hasVisitWindow
                    ? [
                        'Review the current Recommended Visit Window.',
                        'Continue recording relevant information in your Daily Oral Health Log.',
                        'Contact the clinic if symptoms persist, worsen, or concern you.',
                    ]
                    : [
                        'Continue using Oral Health Management for your recorded information.',
                        'Ask the clinic to confirm your next recommended visit timing.',
                    ],
        },

        education: {
            title:
                'Dental Health Education',

            body:
                contextualEducation[0]
                    ?.summary
                || education[0]
                    ?.summary
                || 'Browse the approved Dental Health Education library for oral-health information.',

            articles:
                education,

            contextualArticles:
                contextualEducation,
        },
    };
};