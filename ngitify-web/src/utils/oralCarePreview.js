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

export const getStaticOralCarePreview = (prediction = null) => {
    const today = new Date();
    const fallbackStart = addDays(today, 10);
    const fallbackEnd = addDays(today, 24);
    const fallbackRecommended = addDays(today, 17);

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

    const windowLabel = prediction?.windowLabel || buildWindowLabel(windowStart, windowEnd);
    const statusLabel = prediction?.label === 'Window Open'
        ? 'Window Open Now'
        : prediction?.label || 'Window Opens Soon';
    const whyThisShowing = prediction?.recommendationReason
        || 'Preview data based on preventive timing, mild sensitivity activity, and at-home care consistency.';
    const suggestedNextAction = prediction?.label === 'Overdue'
        ? 'Book your next preventive visit this week and mention any gum bleeding or sensitivity.'
        : 'Plan a cleaning or check-up within this window and keep tracking daily care habits.';

    return {
        windowStart,
        windowEnd,
        recommendedDate,
        isPreviewOnly: !prediction,
        hero: {
            eyebrow: prediction ? 'Live Window + Preview UI' : 'Preview Mode',
            title: 'Preventive Care Window',
            headline: prediction
                ? `Your next recommended clinic window is ${windowLabel}.`
                : `Your next cleaning window opens ${windowLabel}.`,
            statusLabel,
            windowLabel,
            whyThisShowing,
            suggestedNextAction,
            recommendedDateLabel: formatShortDate(recommendedDate),
            previewHint: 'This screen is a front-end preview using static watch signals, factors, and logs.',
        },
        summaryChips: [
            prediction?.lastProcedure || 'Last cleaning 5 months ago',
            'Sensitivity watch active',
            'Flossing 3 of 7 days',
        ],
        watchSignals: [
            {
                id: 'gum-watch',
                icon: 'water-outline',
                iconColor: '#01538b',
                tone: 'info',
                title: 'Gum Health Watch',
                summary: 'Bleeding gums were logged several times this week.',
                action: 'Use gentle brushing and floss carefully, then mention it during your next cleaning.',
            },
            {
                id: 'sensitivity',
                icon: 'snow-outline',
                iconColor: '#149fc5',
                tone: 'secondary',
                title: 'Sensitivity Trend',
                summary: 'Cold sensitivity appears to be rising compared with your recent logs.',
                action: 'Track hot and cold triggers so the clinic can review the pattern with you.',
            },
            {
                id: 'home-care',
                icon: 'checkmark-done-outline',
                iconColor: '#01538b',
                tone: 'primary',
                title: 'At-Home Care Focus',
                summary: 'Floss consistency looks low for this week.',
                action: 'Aim for five flossing days before the end of the week.',
            },
        ],
        factors: [
            { id: 'braces', label: 'Braces / Aligners', active: true },
            { id: 'smoking', label: 'Smoking / Vaping', active: false },
            { id: 'dry-mouth', label: 'Dry Mouth', active: true },
            { id: 'sugary-drinks', label: 'Frequent Sugary Drinks', active: false },
            { id: 'sensitivity', label: 'Tooth Sensitivity', active: true },
            { id: 'bleeding-gums', label: 'Bleeding Gums', active: true },
            { id: 'recent-extraction', label: 'Recent Extraction', active: false },
            { id: 'none', label: 'None of These', active: false },
        ],
        logGroups: [
            {
                id: 'symptoms',
                title: 'Symptoms',
                items: [
                    { id: 'bleeding-gums', label: 'Bleeding Gums', selected: true },
                    { id: 'sensitivity', label: 'Sensitivity', selected: true },
                    { id: 'jaw-pain', label: 'Jaw Pain', selected: false },
                    { id: 'mouth-sores', label: 'Mouth Sores', selected: false },
                    { id: 'bad-breath', label: 'Bad Breath', selected: true },
                ],
            },
            {
                id: 'daily-care',
                title: 'Daily Care',
                items: [
                    { id: 'brushing', label: 'Brushing', selected: true },
                    { id: 'flossing', label: 'Flossing', selected: false },
                    { id: 'mouthwash', label: 'Mouthwash', selected: true },
                    { id: 'sugar-intake', label: 'Sugar Intake', selected: true },
                    { id: 'smoking-vaping', label: 'Smoking / Vaping', selected: false },
                ],
            },
        ],
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
            title: 'Why this works better for dental care',
            body: 'Dental care is more helpful as a visit window plus watch signals and habit coaching, not as a precise disease prediction date.',
        },
    };
};

