const { isPatientPublishedRadiograph } = require('./healthcareAccess');

const MAX_RECENT_ORAL_HEALTH_LOGS = 7;
const MAX_CONTEXTUAL_EDUCATION_ARTICLES = 3;

const toPlainObject = (value) => {
    if (!value) return {};

    if (typeof value.toObject === 'function') {
        return value.toObject();
    }

    return value;
};

const sanitizeStringArray = (value = []) => (
    Array.isArray(value)
        ? value
            .map((item) => String(item || '').trim())
            .filter(Boolean)
        : []
);

const buildPatientAiVisitRecommendationContext = (prediction = null) => {
    if (!prediction || typeof prediction !== 'object') {
        return {
            available: false,
            hasVisitWindow: false,
            label: 'Insufficient Data',
            recommendationBasis: 'insufficient-data',
            recommendationReason:
                'No supported Recommended Visit Window is currently available.',
            explanationItems: [
                'The AI must not invent or calculate a visit interval on its own.',
            ],
            sourceLabels: ['Insufficient Data'],
            contactClinicSooner: false,
            contactClinicReason: '',
            plannedCareSource: '',
        };
    }

    return {
        available: true,
        hasVisitWindow: Boolean(prediction.hasVisitWindow),
        label: String(prediction.label || '').trim(),
        recommendationBasis: String(
            prediction.recommendationBasis || ''
        ).trim(),
        recommendationReason: String(
            prediction.recommendationReason || ''
        ).trim(),
        recommendedDateKey: String(
            prediction.recommendedDateKey || ''
        ).trim(),
        recommendedDateLabel: String(
            prediction.recommendedDateLabel || ''
        ).trim(),
        windowStartKey: String(
            prediction.windowStartKey || ''
        ).trim(),
        windowEndKey: String(
            prediction.windowEndKey || ''
        ).trim(),
        windowLabel: String(
            prediction.windowLabel || ''
        ).trim(),
        lastVisitDate: prediction.lastVisitDate || null,
        lastProcedure: String(
            prediction.lastProcedure || ''
        ).trim(),
        intervalLabel: String(
            prediction.intervalLabel || ''
        ).trim(),
        sourceLabels: sanitizeStringArray(prediction.sourceLabels),
        explanationItems: sanitizeStringArray(
            prediction.explanationItems
        ),
        contactClinicSooner: Boolean(
            prediction.contactClinicSooner
        ),
        contactClinicReason: String(
            prediction.contactClinicReason || ''
        ).trim(),
        plannedCareSource: String(
            prediction.plannedCareSource || ''
        ).trim(),
        isFollowUpRecommendation: Boolean(
            prediction.isFollowUpRecommendation
        ),
    };
};

const buildPatientAiRecentOralHealthLogs = (logs = []) => (
    (Array.isArray(logs) ? logs : [])
        .map(toPlainObject)
        .filter((log) => log && log.logDateKey)
        .sort(
            (left, right) =>
                String(right.logDateKey).localeCompare(
                    String(left.logDateKey)
                )
        )
        .slice(0, MAX_RECENT_ORAL_HEALTH_LOGS)
        .map((log) => ({
            logDateKey: String(log.logDateKey || '').trim(),
            symptoms: sanitizeStringArray(log.symptoms),
            dailyCare: sanitizeStringArray(log.dailyCare),
            riskFactors: sanitizeStringArray(log.riskFactors),
        }))
);

const buildPatientAiEducationContext = ({
    contextualEducation = [],
} = {}) => (
    (Array.isArray(contextualEducation)
        ? contextualEducation
        : []
    )
        .slice(0, MAX_CONTEXTUAL_EDUCATION_ARTICLES)
        .map((article) => ({
            id: String(article?.id || '').trim(),
            title: String(article?.title || '').trim(),
            category: String(article?.category || '').trim(),
            summary: String(article?.summary || '').trim(),
            action: String(article?.action || '').trim(),
        }))
        .filter((article) => article.id && article.title)
);

const buildPatientAiRadiographContext = (radiographs = []) => (
    (Array.isArray(radiographs) ? radiographs : [])
        .map(toPlainObject)
        .filter(isPatientPublishedRadiograph)
        .sort((left, right) => new Date(right.date || 0) - new Date(left.date || 0))
        .slice(0, 5)
        .map((radiograph) => ({
            radiographId: String(radiograph._id || radiograph.id || ''),
            type: String(radiograph.label || 'Radiograph').trim(),
            date: radiograph.date || null,
            approvedSummary: String(radiograph.reviewSummary?.approvedText || '').trim(),
            dentistRecordedFindings: (radiograph.annotations || []).map(toPlainObject).filter((item) => !['archived', 'deleted'].includes(String(item.status || 'active')) && (item.findingType || item.note)).map((item) => ({
                toothNumber: String(item.toothNumber || '').trim(),
                findingType: String(item.findingType || '').trim(),
                note: String(item.note || '').trim(),
            })),
        }))
);

const buildPatientAiOralHealthContext = (
    oralHealthPayload = {}
) => {
    const payload =
        oralHealthPayload
        && typeof oralHealthPayload === 'object'
            ? oralHealthPayload
            : {};

    const summary =
        payload.summary
        && typeof payload.summary === 'object'
            ? payload.summary
            : {};

    return {
        summary: {
            recentLogCount: Number(
                summary.recentLogCount || 0
            ),
            lastLogDateKey: String(
                summary.lastLogDateKey || ''
            ).trim(),
            flossingDays: Number(
                summary.flossingDays || 0
            ),
            brushingDays: Number(
                summary.brushingDays || 0
            ),
            bleedingDays: Number(
                summary.bleedingDays || 0
            ),
            sensitivityDays: Number(
                summary.sensitivityDays || 0
            ),
        },
        recentLogs: buildPatientAiRecentOralHealthLogs(
            payload.logs
        ),
    };
};

const buildPatientAiCareContext = ({
    prediction = null,
    oralHealthPayload = {},
    radiographs = [],
} = {}) => {
    const approvedRadiographRecords =
        buildPatientAiRadiographContext(radiographs);

    return {
        contextPolicy: {
        recommendationAuthority:
            'The System Recommendation is authoritative. AI may explain it but must not calculate, change, postpone, or override it.',
        oralHealthAuthority:
            'Oral Health Management entries are patient-recorded context. They do not diagnose disease.',
        educationAuthority:
            'Dental Health Education is approved educational information and is not a diagnosis.',
        radiographAuthority:
            'Radiograph information is limited to dentist-approved summaries and dentist-recorded findings. Explain those records only; do not interpret the image or diagnose.',
        },
        systemRecommendation:
            buildPatientAiVisitRecommendationContext(prediction),
        oralHealthManagement:
            buildPatientAiOralHealthContext(oralHealthPayload),
        dentalHealthEducation:
            buildPatientAiEducationContext({
                contextualEducation:
                    oralHealthPayload?.contextualEducation,
            }),
        radiographAvailability: {
            available:
                approvedRadiographRecords.length > 0,
            unavailableMessage:
                'No approved radiograph explanation is available.',
        },
        approvedRadiographRecords,
    };
};

const getPatientAiRequiredShortcutReply = ({
    prompt = '',
    careContext = {},
} = {}) => {
    const normalizedPrompt = String(prompt)
        .trim()
        .toLowerCase();

    if (
        normalizedPrompt === 'explain my radiograph findings'
        && !careContext?.approvedRadiographRecords?.length
    ) {
        return String(
            careContext?.radiographAvailability?.unavailableMessage
            || 'No approved radiograph explanation is available.'
        ).trim();
    }

    return '';
};

const mergePatientAiLiveContext = ({
    liveContext = {},
} = {}) => {
    const trustedLiveContext =
        liveContext
        && typeof liveContext === 'object'
        && !Array.isArray(liveContext)
            ? liveContext
            : {};

    return trustedLiveContext;
};

module.exports = {
    MAX_CONTEXTUAL_EDUCATION_ARTICLES,
    MAX_RECENT_ORAL_HEALTH_LOGS,
    buildPatientAiCareContext,
    buildPatientAiEducationContext,
    buildPatientAiOralHealthContext,
    buildPatientAiRecentOralHealthLogs,
    buildPatientAiRadiographContext,
    buildPatientAiVisitRecommendationContext,
    getPatientAiRequiredShortcutReply,
    mergePatientAiLiveContext,
};
