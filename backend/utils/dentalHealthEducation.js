const DENTAL_HEALTH_EDUCATION_DISCLAIMER =
    'Dental Health Education is educational information only. It does not diagnose dental disease or replace an evaluation by a dentist. Persistent, worsening, or concerning symptoms may be worth discussing with the clinic.';

const DENTAL_HEALTH_EDUCATION_CATEGORIES = Object.freeze([
    {
        id: 'brushing',
        label: 'Brushing',
    },
    {
        id: 'flossing',
        label: 'Flossing',
    },
    {
        id: 'gum-care',
        label: 'Gum Care',
    },
    {
        id: 'tooth-sensitivity',
        label: 'Tooth Sensitivity',
    },
    {
        id: 'toothache',
        label: 'Toothache',
    },
    {
        id: 'preventive-care',
        label: 'Preventive Care',
    },
    {
        id: 'diet-oral-health',
        label: 'Diet and Oral Health',
    },
    {
        id: 'smoking-vaping',
        label: 'Smoking/Vaping and Oral Health',
    },
    {
        id: 'dental-visits',
        label: 'Dental Visits',
    },
]);

const EDUCATION_LIBRARY = Object.freeze([
    {
        id: 'brushing-routine',
        title: 'Build a brushing routine you can repeat',
        categoryId: 'brushing',
        category: 'Brushing',
        summary:
            'A consistent morning and evening brushing routine can make daily oral care easier to remember.',
        body:
            'Use a repeatable time and place for brushing, such as after getting ready in the morning and before going to bed. If you miss a brushing session, return to your normal routine at the next opportunity instead of treating the missed session as a diagnosis or emergency.',
        action:
            'Use your Daily Oral Health Log to notice which brushing time is easiest to miss.',
        relatedLogIds: ['brushed-am', 'brushed-pm', 'missed-brushing'],
        keywords: ['brushing', 'routine', 'missed brushing', 'morning', 'evening'],
    },
    {
        id: 'interdental-cleaning',
        title: 'Cleaning between teeth',
        categoryId: 'flossing',
        category: 'Flossing',
        summary:
            'Floss or another appropriate interdental cleaner can help clean spaces that a toothbrush may not reach easily.',
        body:
            'Interdental cleaning is part of routine oral hygiene. Use gentle technique and avoid forcing floss or another cleaning tool into the gums. Different patients may benefit from different interdental tools, so your dental clinic can help you choose an option that suits your teeth and gums.',
        action:
            'Ask the clinic which interdental cleaning method is appropriate for you if you are unsure.',
        relatedLogIds: ['flossed', 'bleeding-gums'],
        keywords: ['floss', 'flossing', 'interdental', 'between teeth'],
    },
    {
        id: 'gum-bleeding',
        title: 'Understanding bleeding gums',
        categoryId: 'gum-care',
        category: 'Gum Care',
        summary:
            'Bleeding while brushing or flossing is useful information to record and discuss if it continues.',
        body:
            'Use gentle brushing and interdental cleaning rather than scrubbing harder when you notice bleeding. A Daily Oral Health Log can help you remember when the bleeding occurred and whether it continued across several days. The log itself cannot identify the cause.',
        action:
            'If bleeding continues, returns frequently, or concerns you, consider discussing it with your dentist.',
        relatedLogIds: ['bleeding-gums'],
        keywords: ['gums', 'bleeding gums', 'gum care'],
    },
    {
        id: 'sensitivity-triggers',
        title: 'Understanding tooth sensitivity',
        categoryId: 'tooth-sensitivity',
        category: 'Tooth Sensitivity',
        summary:
            'Recording when sensitivity happens can give your dentist more useful context if the symptom continues.',
        body:
            'Sensitivity may be noticed with cold, heat, sweet foods, brushing, or biting. Instead of trying to diagnose the cause yourself, record what you noticed, when it occurred, and whether it continued. Continue gentle oral care unless your dentist has given you different instructions.',
        action:
            'Persistent or worsening sensitivity may be worth discussing with your dentist.',
        relatedLogIds: ['sensitivity'],
        keywords: ['sensitivity', 'sensitive teeth', 'cold', 'hot'],
    },
    {
        id: 'toothache-guidance',
        title: 'Recording a toothache for your dental visit',
        categoryId: 'toothache',
        category: 'Toothache',
        summary:
            'A toothache is a symptom to record, not something NgitiFy uses to diagnose a dental condition.',
        body:
            'When you record a toothache, note useful context such as when it started and how strong it feels. This information can help you explain the symptom to the dental clinic. NgitiFy does not determine the underlying cause from a toothache entry.',
        action:
            'Contact the clinic if the toothache continues, worsens, or you are concerned about it.',
        relatedLogIds: ['toothache'],
        keywords: ['toothache', 'tooth pain', 'pain'],
    },
    {
        id: 'preventive-window',
        title: 'Understanding your Recommended Visit Window',
        categoryId: 'preventive-care',
        category: 'Preventive Care',
        summary:
            'A Recommended Visit Window is planning guidance based on supported clinic information, not a diagnosis.',
        body:
            'NgitiFy displays visit timing separately from Dental Health Education. A dentist-recorded follow-up remains the primary planned-care source when one exists. Patient logs may provide additional context, but routine self-tracking does not postpone a dentist recommendation.',
        action:
            'Follow the clinic recommendation shown in NgitiFy and contact the clinic if you need clarification.',
        relatedLogIds: ['swelling', 'jaw-pain', 'mouth-sore'],
        keywords: ['preventive care', 'visit window', 'recommended visit'],
    },
    {
        id: 'sugar-exposure',
        title: 'Sugary drinks and everyday oral care',
        categoryId: 'diet-oral-health',
        category: 'Diet and Oral Health',
        summary:
            'Frequently recording sugary drinks can help you notice patterns in your own daily routine.',
        body:
            'The Daily Oral Health Log is designed to help you notice habits, including sugary drinks, without assigning a diagnosis or risk score. Use the record as a reminder to discuss diet and oral-health questions with your dental team when appropriate.',
        action:
            'Use your log to notice how often sugary drinks appear in your routine and ask your dentist for personalized guidance when needed.',
        relatedLogIds: ['sugary-drinks'],
        keywords: ['sugar', 'sugary drinks', 'diet', 'drinks'],
    },
    {
        id: 'smoking-vaping-oral-health',
        title: 'Smoking, vaping, and oral-health conversations',
        categoryId: 'smoking-vaping',
        category: 'Smoking/Vaping and Oral Health',
        summary:
            'Smoking or vaping entries can be useful information to share with your dental team as part of your health history.',
        body:
            'NgitiFy records smoking or vaping only as patient-provided context. It does not use that entry to diagnose a condition. If you have questions about how smoking or vaping relates to your oral health, your dentist can provide guidance based on your individual health history.',
        action:
            'Consider discussing smoking or vaping with your dental team if you want oral-health guidance specific to you.',
        relatedLogIds: ['smoked', 'vaped'],
        keywords: ['smoking', 'vaping', 'smoke', 'vape'],
    },
    {
        id: 'dental-visit-preparation',
        title: 'Prepare useful information for a dental visit',
        categoryId: 'dental-visits',
        category: 'Dental Visits',
        summary:
            'Your saved Oral Health Management history can help you remember what you want to discuss during a clinic visit.',
        body:
            'Before an appointment, review recent symptoms, daily-care entries, and notes that you personally recorded. These entries are patient-provided information rather than a diagnosis. Your dentist can decide which details are clinically relevant during the visit.',
        action:
            'Review recent logs before your appointment and mention persistent or worsening symptoms to your dentist.',
        relatedLogIds: [
            'toothache',
            'bleeding-gums',
            'swelling',
            'bad-breath',
            'sensitivity',
            'jaw-pain',
            'mouth-sore',
        ],
        keywords: ['dental visit', 'appointment', 'dentist', 'prepare'],
    },
]);

const getNormalizedLogSelections = (log = {}) => [
    ...(Array.isArray(log.symptoms) ? log.symptoms : []),
    ...(Array.isArray(log.dailyCare) ? log.dailyCare : []),
    ...(Array.isArray(log.riskFactors) ? log.riskFactors : []),
]
    .map((value) => String(value || '').trim())
    .filter((value) => value && value !== 'no-symptoms');

const getDentalHealthEducationLibrary = ({
    categoryId = '',
    query = '',
} = {}) => {
    const normalizedCategoryId = String(categoryId || '').trim().toLowerCase();
    const normalizedQuery = String(query || '').trim().toLowerCase();

    return EDUCATION_LIBRARY.filter((article) => {
        if (
            normalizedCategoryId
            && article.categoryId.toLowerCase() !== normalizedCategoryId
        ) {
            return false;
        }

        if (!normalizedQuery) {
            return true;
        }

        const searchableText = [
            article.title,
            article.category,
            article.summary,
            article.body,
            article.action,
            ...(article.keywords || []),
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

        return searchableText.includes(normalizedQuery);
    });
};

const getDentalHealthEducationArticleById = (articleId = '') => {
    const normalizedId = String(articleId || '').trim();

    if (!normalizedId) {
        return null;
    }

    return EDUCATION_LIBRARY.find((article) => article.id === normalizedId) || null;
};

const buildContextualDentalHealthEducation = (logs = [], limit = 3) => {
    const normalizedLimit = Number.isFinite(Number(limit))
        ? Math.max(0, Math.floor(Number(limit)))
        : 3;

    if (!normalizedLimit) {
        return [];
    }

    const recentLogs = [...(Array.isArray(logs) ? logs : [])]
        .filter((log) => log && log.logDateKey)
        .sort(
            (left, right) =>
                String(right.logDateKey || '').localeCompare(
                    String(left.logDateKey || '')
                )
        )
        .slice(0, 7);

    if (!recentLogs.length) {
        return [];
    }

    const selectionScores = new Map();

    recentLogs.forEach((log, index) => {
        const recencyScore = Math.max(1, 7 - index);

        getNormalizedLogSelections(log).forEach((selectionId) => {
            selectionScores.set(
                selectionId,
                (selectionScores.get(selectionId) || 0) + recencyScore
            );
        });
    });

    return EDUCATION_LIBRARY
        .map((article, libraryIndex) => {
            const contextualScore = (article.relatedLogIds || []).reduce(
                (total, relatedLogId) =>
                    total + (selectionScores.get(relatedLogId) || 0),
                0
            );

            return {
                article,
                contextualScore,
                libraryIndex,
            };
        })
        .filter((entry) => entry.contextualScore > 0)
        .sort(
            (left, right) =>
                right.contextualScore - left.contextualScore
                || left.libraryIndex - right.libraryIndex
        )
        .slice(0, normalizedLimit)
        .map((entry) => entry.article);
};

const buildDentalHealthEducationPayload = ({
    logs = [],
    categoryId = '',
    query = '',
    contextualLimit = 3,
} = {}) => ({
    title: 'Dental Health Education',
    disclaimer: DENTAL_HEALTH_EDUCATION_DISCLAIMER,
    categories: DENTAL_HEALTH_EDUCATION_CATEGORIES,
    articles: getDentalHealthEducationLibrary({
        categoryId,
        query,
    }),
    contextualEducation: buildContextualDentalHealthEducation(
        logs,
        contextualLimit
    ),
});

module.exports = {
    DENTAL_HEALTH_EDUCATION_CATEGORIES,
    DENTAL_HEALTH_EDUCATION_DISCLAIMER,
    EDUCATION_LIBRARY,
    buildContextualDentalHealthEducation,
    buildDentalHealthEducationPayload,
    getDentalHealthEducationArticleById,
    getDentalHealthEducationLibrary,
};