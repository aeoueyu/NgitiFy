const addDays = (value, days) => {
    const date = new Date(value);
    date.setDate(date.getDate() + days);
    return date;
};

const formatShortDate = (value) => value.toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
});

const buildWindowLabel = (start, end) => `${formatShortDate(start)} - ${formatShortDate(end)}`;

const resolveDateFromPrediction = (dateKey, isoValue, fallback) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(dateKey || '').trim())) {
        const fromKey = new Date(`${dateKey}T12:00:00`);
        if (!Number.isNaN(fromKey.getTime())) return fromKey;
    }

    const fromIso = isoValue ? new Date(isoValue) : null;
    if (fromIso && !Number.isNaN(fromIso.getTime())) return fromIso;

    return fallback;
};

const getLabelMap = (groups = []) => {
    const labels = {};
    groups.forEach((group) => {
        (group.items || []).forEach((item) => {
            labels[item.id] = item.label;
        });
    });
    return labels;
};

export const getStaticOralCarePreview = (prediction = null, oralHealth = null) => {
    const today = new Date();
    const fallbackStart = addDays(today, 10);
    const fallbackEnd = addDays(today, 24);
    const fallbackRecommended = addDays(today, 17);
    const hasVisitWindow = prediction?.hasVisitWindow !== false && Boolean(
        prediction?.windowLabel
        || prediction?.windowStartKey
        || prediction?.windowStart
        || prediction?.recommendedDateKey
        || prediction?.recommendedDate
    );

    const windowStart = resolveDateFromPrediction(
        prediction?.windowStartKey,
        prediction?.windowStart,
        fallbackStart
    );
    const windowEnd = resolveDateFromPrediction(
        prediction?.windowEndKey,
        prediction?.windowEnd,
        fallbackEnd
    );
    const recommendedDate = resolveDateFromPrediction(
        prediction?.recommendedDateKey,
        prediction?.recommendedDate,
        fallbackRecommended
    );

    const windowLabel = hasVisitWindow
        ? (prediction?.windowLabel || buildWindowLabel(windowStart, windowEnd))
        : 'Insufficient clinic history';
    const statusLabel = prediction?.label === 'Window Open'
        ? 'Window Open Now'
        : prediction?.label || (hasVisitWindow ? 'Window Opens Soon' : 'Insufficient Data');
    const whyThisShowing = prediction?.recommendationReason
        || (hasVisitWindow
            ? 'Preview data based on preventive timing, mild sensitivity activity, and at-home care consistency.'
            : 'No dentist-suggested next visit or supported clinic treatment history is available, so NgitiFy cannot calculate a visit window yet.');
    const suggestedNextAction = prediction?.contactClinicSooner
        ? prediction.contactClinicReason
        : prediction?.label === 'Overdue'
        ? 'Book your next preventive visit this week and mention any gum bleeding or sensitivity.'
        : hasVisitWindow
            ? 'Plan a cleaning or check-up within this window and keep tracking daily care habits.'
            : 'Ask the clinic to confirm your next recommended visit timing.';

    const latestLog = oralHealth?.logs?.[0] || null;
    const summary = oralHealth?.summary || {};
    const storedGroups = Array.isArray(oralHealth?.logGroups) ? oralHealth.logGroups : null;
    const defaultLogGroups = [
        {
            id: 'symptoms',
            title: 'Symptoms',
            items: [
                { id: 'no-symptoms', label: 'No Symptoms', selected: false },
                { id: 'toothache', label: 'Toothache', selected: false, detailFields: ['severity', 'duration'] },
                { id: 'bleeding-gums', label: 'Bleeding Gums', selected: true },
                { id: 'swelling', label: 'Swelling', selected: false, detailFields: ['severity', 'duration'] },
                { id: 'bad-breath', label: 'Bad Breath', selected: true },
                { id: 'sensitivity', label: 'Sensitivity', selected: true },
                { id: 'jaw-pain', label: 'Jaw Pain', selected: false, detailFields: ['severity', 'duration'] },
                { id: 'mouth-sore', label: 'Mouth Sore', selected: false, detailFields: ['severity', 'duration'] },
            ],
        },
        {
            id: 'dailyCare',
            title: 'Oral Care Habits',
            items: [
                { id: 'brushed-am', label: 'Brushed AM', selected: true },
                { id: 'brushed-pm', label: 'Brushed PM', selected: false },
                { id: 'flossed', label: 'Flossed', selected: false },
                { id: 'mouthwash', label: 'Mouthwash', selected: true },
            ],
        },
        {
            id: 'riskFactors',
            title: 'Other / Risk Factors',
            items: [
                { id: 'smoked', label: 'Smoked', selected: false },
                { id: 'vaped', label: 'Vaped', selected: false },
                { id: 'sugary-drinks', label: 'Sugary Drinks', selected: true },
                { id: 'missed-brushing', label: 'Missed Brushing', selected: false },
            ],
        },
    ];
    const defaultEducationArticles = [
        {
            id: 'gum-bleeding',
            title: 'Bleeding gums are a signal, not a brushing failure',
            category: 'Gum Health',
            summary: 'Gentle cleaning, consistent flossing, and a timely check-up help the clinic spot inflammation early.',
            action: 'Mention any repeated bleeding at your next visit.',
            relatedLogIds: ['bleeding-gums'],
        },
        {
            id: 'sensitivity-triggers',
            title: 'Track sensitivity by trigger',
            category: 'Tooth Sensitivity',
            summary: 'Cold, sweet, brushing, and biting sensitivity can point to different clinical causes.',
            action: 'Log the trigger and which tooth area you notice.',
            relatedLogIds: ['sensitivity'],
        },
        {
            id: 'brushing-routine',
            title: 'Make brushing easier to repeat',
            category: 'Home Care',
            summary: 'A consistent morning and evening brushing routine helps remove daily plaque before it hardens.',
            action: 'Use the daily log to notice which brushing time is easiest to miss.',
            relatedLogIds: ['brushed-am', 'brushed-pm', 'missed-brushing'],
        },
        {
            id: 'interdental-cleaning',
            title: 'Interdental cleaning supports the spaces brushing misses',
            category: 'Home Care',
            summary: 'Floss or another interdental cleaner can help clean tight spaces between teeth where a toothbrush may not reach.',
            action: 'Ask the clinic which interdental tool fits your teeth and gums best.',
            relatedLogIds: ['flossed', 'bleeding-gums'],
        },
        {
            id: 'preventive-window',
            title: 'Preventive windows work better than exact prediction dates',
            category: 'Preventive Care',
            summary: 'A visit window combines treatment history, symptoms, and habits without pretending to diagnose at home.',
            action: 'Book within the recommended window when possible.',
            relatedLogIds: ['toothache', 'swelling', 'jaw-pain', 'mouth-sore'],
        },
    ];
    const labelMap = getLabelMap(storedGroups || defaultLogGroups);
    const selectedSymptoms = latestLog?.symptoms || [];
    const selectedCare = latestLog?.dailyCare || [];
    const selectedRiskFactors = latestLog?.riskFactors || [];

    return {
        windowStart,
        windowEnd,
        recommendedDate,
        isPreviewOnly: !prediction && !oralHealth,
        hero: {
            eyebrow: prediction ? 'Live Window + Preview UI' : 'Preview Mode',
            title: 'Recommended Visit Window',
            headline: hasVisitWindow
                ? `Your next recommended clinic window is ${windowLabel}.`
                : 'No visit window is available yet.',
            statusLabel,
            windowLabel,
            whyThisShowing,
            suggestedNextAction,
            recommendedDateLabel: hasVisitWindow ? formatShortDate(recommendedDate) : 'Not available',
            sourceLabels: prediction?.sourceLabels || (hasVisitWindow ? ['Preview Mode'] : ['Insufficient Data']),
            explanationItems: prediction?.explanationItems || [whyThisShowing],
            contactClinicSooner: Boolean(prediction?.contactClinicSooner),
            previewHint: oralHealth
                ? 'Your quick logs and factors are saved to your patient account.'
                : 'This screen is a front-end preview using static watch signals, factors, and logs.',
        },
        summaryChips: [
            prediction?.lastProcedure || 'Last cleaning 5 months ago',
            summary.sensitivityDays ? `Sensitivity ${summary.sensitivityDays} of 7 days` : 'Sensitivity watch active',
            Number.isFinite(summary.flossingDays) ? `Flossing ${summary.flossingDays} of 7 days` : 'Flossing 3 of 7 days',
        ],
        watchSignals: [
            {
                id: 'gum-watch',
                icon: 'water-outline',
                iconColor: '#01538b',
                tone: 'info',
                title: 'Gum Health Watch',
                summary: summary.bleedingDays
                    ? `Bleeding gums were logged ${summary.bleedingDays} time${summary.bleedingDays === 1 ? '' : 's'} recently.`
                    : 'Bleeding gums were logged several times this week.',
                action: 'Use gentle brushing and floss carefully, then mention it during your next cleaning.',
            },
            {
                id: 'sensitivity',
                icon: 'snow-outline',
                iconColor: '#149fc5',
                tone: 'secondary',
                title: 'Sensitivity Trend',
                summary: summary.sensitivityDays
                    ? `Sensitivity appears in ${summary.sensitivityDays} recent log${summary.sensitivityDays === 1 ? '' : 's'}.`
                    : 'Cold sensitivity appears to be rising compared with your recent logs.',
                action: 'Track hot and cold triggers so the clinic can review the pattern with you.',
            },
            {
                id: 'home-care',
                icon: 'checkmark-done-outline',
                iconColor: '#01538b',
                tone: 'primary',
                title: 'At-Home Care Focus',
                summary: Number.isFinite(summary.flossingDays)
                    ? `Flossing is recorded ${summary.flossingDays} of the last 7 logged days.`
                    : 'Floss consistency looks low for this week.',
                action: 'Aim for five flossing days before the end of the week.',
            },
        ],
        factors: oralHealth?.factors || [
            { id: 'braces', label: 'Braces / Aligners', active: true },
            { id: 'smoking', label: 'Smoking / Vaping', active: false },
            { id: 'dry-mouth', label: 'Dry Mouth', active: true },
            { id: 'sugary-drinks', label: 'Frequent Sugary Drinks', active: false },
            { id: 'sensitivity', label: 'Tooth Sensitivity', active: true },
            { id: 'bleeding-gums', label: 'Bleeding Gums', active: true },
            { id: 'recent-extraction', label: 'Recent Extraction', active: false },
            { id: 'none', label: 'None of These', active: false },
        ],
        logGroups: (storedGroups || defaultLogGroups).map((group) => ({
            ...group,
            items: (group.items || []).map((item) => ({
                ...item,
                selected: group.id === 'symptoms'
                    ? selectedSymptoms.includes(item.id)
                    : group.id === 'riskFactors'
                        ? selectedRiskFactors.includes(item.id)
                        : selectedCare.includes(item.id),
                label: item.label || labelMap[item.id] || item.id,
            })),
        })),
        carePlan: {
            title: 'Suggested Next Action',
            body: suggestedNextAction,
            checklist: [
                'Book a preventive cleaning or check-up in the suggested window.',
                'Keep logging sensitivity and bleeding for the next 7 days.',
                'Focus on nightly flossing before your visit.',
            ],
        },
        education: {
            title: 'Dental Health Education',
            body: oralHealth?.education?.[0]?.summary
                || 'Dental care is more helpful as a visit window plus watch signals and habit coaching, not as a precise disease prediction date.',
            articles: oralHealth?.education || defaultEducationArticles,
            contextualArticles: oralHealth?.contextualEducation || [],
        },
    };
};
