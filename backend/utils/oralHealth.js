const {
    EDUCATION_LIBRARY,
    buildContextualDentalHealthEducation,
} = require('./dentalHealthEducation');

const addDays = (value, days) => {
    const date = new Date(value);
    date.setDate(date.getDate() + days);
    return date;
};

const CLINIC_TIME_ZONE = 'Asia/Manila';

const toDateKeyInTimeZone = (value = new Date(), timeZone = CLINIC_TIME_ZONE) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).formatToParts(date).map((part) => [part.type, part.value])
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
};

const toDateKey = (value = new Date()) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseDateKey = (value) => {
    const normalized = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null;
    const [year, month, day] = normalized.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    if (
        Number.isNaN(date.getTime())
        || date.getUTCFullYear() !== year
        || date.getUTCMonth() !== month - 1
        || date.getUTCDate() !== day
    ) {
        return null;
    }
    return date;
};

const ORAL_HEALTH_FACTOR_OPTIONS = Object.freeze([
    { id: 'braces', label: 'Braces / Aligners' },
    { id: 'smoking', label: 'Smoking / Vaping' },
    { id: 'dry-mouth', label: 'Dry Mouth' },
    { id: 'sugary-drinks', label: 'Frequent Sugary Drinks' },
    { id: 'sensitivity', label: 'Tooth Sensitivity' },
    { id: 'bleeding-gums', label: 'Bleeding Gums' },
    { id: 'recent-extraction', label: 'Recent Extraction' },
    { id: 'none', label: 'None of These' },
]);

const ORAL_HEALTH_LOG_GROUPS = Object.freeze([
    {
        id: 'symptoms',
        title: 'Symptoms',
        items: [
            { id: 'no-symptoms', label: 'No Symptoms' },
            { id: 'toothache', label: 'Toothache', detailFields: ['severity', 'duration'] },
            { id: 'bleeding-gums', label: 'Bleeding Gums' },
            { id: 'swelling', label: 'Swelling', detailFields: ['severity', 'duration'] },
            { id: 'bad-breath', label: 'Bad Breath' },
            { id: 'sensitivity', label: 'Sensitivity' },
            { id: 'jaw-pain', label: 'Jaw Pain', detailFields: ['severity', 'duration'] },
            { id: 'mouth-sore', label: 'Mouth Sore', detailFields: ['severity', 'duration'] },
        ],
    },
    {
        id: 'dailyCare',
        title: 'Oral Care Habits',
        items: [
            { id: 'brushed-am', label: 'Brushed AM' },
            { id: 'brushed-pm', label: 'Brushed PM' },
            { id: 'flossed', label: 'Flossed' },
            { id: 'mouthwash', label: 'Mouthwash' },
        ],
    },
    {
        id: 'riskFactors',
        title: 'Other / Risk Factors',
        items: [
            { id: 'smoked', label: 'Smoked' },
            { id: 'vaped', label: 'Vaped' },
            { id: 'sugary-drinks', label: 'Sugary Drinks' },
            { id: 'missed-brushing', label: 'Missed Brushing' },
        ],
    },
]);

const ORAL_HEALTH_SYMPTOM_DETAIL_CONFIG = Object.freeze({
    severity: {
        label: 'Severity',
        options: [
            { id: 'mild', label: 'Mild' },
            { id: 'moderate', label: 'Moderate' },
            { id: 'severe', label: 'Severe' },
        ],
    },
    duration: {
        label: 'Duration',
        maxLength: 80,
    },
});

const LEGACY_LOG_ID_ALIASES = Object.freeze({
    'mouth-sores': 'mouth-sore',
    brushing: 'brushed-am',
    flossing: 'flossed',
    'sugar-intake': 'sugary-drinks',
    'smoking-vaping': 'smoked',
});

const APPROVED_VISIT_WINDOW_ESCALATION_RULES = Object.freeze([
    {
        id: 'latest-log-swelling',
        label: 'Approved Safety Rule',
        sourceLabel: 'Recent Oral Health Management Logs',
        symptomIds: ['swelling'],
        explanation: 'The latest Patient Log includes swelling.',
        action: 'Contact the clinic sooner and mention the logged swelling.',
    },
    {
        id: 'latest-log-severe-context',
        label: 'Approved Safety Rule',
        sourceLabel: 'Recent Oral Health Management Logs',
        detailSeverity: 'severe',
        explanation: 'The latest Patient Log includes a symptom marked severe by the patient.',
        action: 'Contact the clinic sooner and share the symptom details with the clinic.',
    },
]);

const uniqueAllowedIds = (values, allowedIds, fieldName) => {
    if (!Array.isArray(values)) {
        const error = new Error(`${fieldName} must be an array.`);
        error.statusCode = 400;
        throw error;
    }

    const normalized = [];
    values.forEach((value) => {
        const id = String(value || '').trim();
        if (!id) return;
        if (!allowedIds.has(id)) {
            const error = new Error(`Invalid ${fieldName} value: ${id}.`);
            error.statusCode = 400;
            throw error;
        }
        if (!normalized.includes(id)) normalized.push(id);
    });
    return normalized;
};

const normalizeAllowedIds = (values, allowedIds, fieldName) => (
    uniqueAllowedIds(
        Array.isArray(values)
            ? values.map((value) => LEGACY_LOG_ID_ALIASES[String(value || '').trim()] || value)
            : values,
        allowedIds,
        fieldName
    )
);

const normalizeOralHealthFactors = (input = [], existing = []) => {
    const activeIds = Array.isArray(input)
        ? input.map((item) => String(typeof item === 'string' ? item : item?.id || '').trim()).filter(Boolean)
        : [];
    const allowedIds = new Set(ORAL_HEALTH_FACTOR_OPTIONS.map((item) => item.id));
    const normalizedIds = uniqueAllowedIds(activeIds, allowedIds, 'oral health factor');
    const selectedIds = new Set(normalizedIds.includes('none') ? ['none'] : normalizedIds.filter((id) => id !== 'none'));
    const existingMap = new Map((Array.isArray(existing) ? existing : []).map((item) => [String(item.id), item]));

    return ORAL_HEALTH_FACTOR_OPTIONS.map((option) => {
        const previous = existingMap.get(option.id);
        return {
            id: option.id,
            label: option.label,
            active: selectedIds.has(option.id),
            recordedAt: selectedIds.has(option.id)
                ? (previous?.active ? previous.recordedAt || new Date() : new Date())
                : previous?.recordedAt || null,
        };
    });
};

const normalizeDailyOralHealthLogInput = (body = {}, { now = new Date() } = {}) => {
    const requestedDateKey = String(body.logDate || toDateKeyInTimeZone(now)).trim();
    const logDate = parseDateKey(requestedDateKey);
    if (!logDate) {
        const error = new Error('Log date must be a valid YYYY-MM-DD date.');
        error.statusCode = 400;
        throw error;
    }

    const clinicTodayKey = toDateKeyInTimeZone(now);
    if (requestedDateKey > clinicTodayKey) {
        const error = new Error('Daily oral health logs cannot be dated in the future.');
        error.statusCode = 400;
        throw error;
    }

    const symptomIds = new Set(ORAL_HEALTH_LOG_GROUPS.find((group) => group.id === 'symptoms').items.map((item) => item.id));
    const careIds = new Set(ORAL_HEALTH_LOG_GROUPS.find((group) => group.id === 'dailyCare').items.map((item) => item.id));
    const riskIds = new Set(ORAL_HEALTH_LOG_GROUPS.find((group) => group.id === 'riskFactors').items.map((item) => item.id));
    const symptoms = normalizeAllowedIds(body.symptoms || [], symptomIds, 'symptom');
    const dailyCare = normalizeAllowedIds(body.dailyCare || body.care || [], careIds, 'daily care');
    const riskFactors = normalizeAllowedIds(body.riskFactors || [], riskIds, 'risk factor');
    const notes = String(body.notes || '').trim().slice(0, 500);

    if (symptoms.includes('no-symptoms') && symptoms.length > 1) {
        const error = new Error('No Symptoms cannot be combined with other symptom selections.');
        error.statusCode = 400;
        throw error;
    }

    if (!symptoms.length && !dailyCare.length && !riskFactors.length && !notes) {
        const error = new Error('Select at least one symptom, care item, risk factor, or note before saving.');
        error.statusCode = 400;
        throw error;
    }

    const symptomDetails = {};
    const incomingDetails = body.symptomDetails && typeof body.symptomDetails === 'object' ? body.symptomDetails : {};
    const detailAllowedSymptoms = new Map(
        ORAL_HEALTH_LOG_GROUPS
            .find((group) => group.id === 'symptoms')
            .items
            .filter((item) => Array.isArray(item.detailFields) && item.detailFields.length)
            .map((item) => [item.id, item.detailFields])
    );

    symptoms.forEach((symptomId) => {
        const detailFields = detailAllowedSymptoms.get(symptomId);
        if (!detailFields) return;

        const incoming = incomingDetails[symptomId] || {};
        const normalizedDetails = {};

        if (detailFields.includes('severity') && incoming.severity) {
            const allowedSeverity = new Set(ORAL_HEALTH_SYMPTOM_DETAIL_CONFIG.severity.options.map((item) => item.id));
            const severity = String(incoming.severity || '').trim();
            if (!allowedSeverity.has(severity)) {
                const error = new Error(`Invalid symptom severity value for ${symptomId}.`);
                error.statusCode = 400;
                throw error;
            }
            normalizedDetails.severity = severity;
        }

        if (detailFields.includes('duration') && incoming.duration) {
            normalizedDetails.duration = String(incoming.duration || '')
                .trim()
                .slice(0, ORAL_HEALTH_SYMPTOM_DETAIL_CONFIG.duration.maxLength);
        }

        if (normalizedDetails.severity || normalizedDetails.duration) {
            symptomDetails[symptomId] = normalizedDetails;
        }
    });

    return {
        logDate,
        logDateKey: requestedDateKey,
        symptoms,
        dailyCare,
        riskFactors,
        symptomDetails,
        notes,
    };
};

const normalizeSavedLogForPayload = (log = {}) => {
    const symptomIds = new Set(ORAL_HEALTH_LOG_GROUPS.find((group) => group.id === 'symptoms').items.map((item) => item.id));
    const careIds = new Set(ORAL_HEALTH_LOG_GROUPS.find((group) => group.id === 'dailyCare').items.map((item) => item.id));
    const riskIds = new Set(ORAL_HEALTH_LOG_GROUPS.find((group) => group.id === 'riskFactors').items.map((item) => item.id));
    const rawDailyCare = Array.isArray(log.dailyCare) ? log.dailyCare : [];
    const rawRiskFactors = Array.isArray(log.riskFactors) ? log.riskFactors : [];

    const symptoms = (Array.isArray(log.symptoms) ? log.symptoms : [])
        .map((id) => LEGACY_LOG_ID_ALIASES[String(id || '').trim()] || String(id || '').trim())
        .filter((id, index, list) => symptomIds.has(id) && list.indexOf(id) === index);

    const dailyCare = rawDailyCare
        .map((id) => LEGACY_LOG_ID_ALIASES[String(id || '').trim()] || String(id || '').trim())
        .filter((id, index, list) => careIds.has(id) && list.indexOf(id) === index);

    const riskFactorsFromDailyCare = rawDailyCare
        .map((id) => LEGACY_LOG_ID_ALIASES[String(id || '').trim()] || String(id || '').trim())
        .filter((id) => riskIds.has(id));
    const riskFactors = [...rawRiskFactors, ...riskFactorsFromDailyCare]
        .map((id) => LEGACY_LOG_ID_ALIASES[String(id || '').trim()] || String(id || '').trim())
        .filter((id, index, list) => riskIds.has(id) && list.indexOf(id) === index);

    const symptomDetails = log.symptomDetails instanceof Map
        ? Object.fromEntries(log.symptomDetails)
        : (log.symptomDetails || {});

    return {
        ...(typeof log.toObject === 'function' ? log.toObject() : log),
        symptoms,
        dailyCare,
        riskFactors,
        symptomDetails,
    };
};

const getLogItemLabelMap = () => {
    const map = new Map();
    ORAL_HEALTH_LOG_GROUPS.forEach((group) => {
        group.items.forEach((item) => map.set(item.id, item.label));
    });
    return map;
};

const summarizeLogSelections = (log = {}) => {
    const labelMap = getLogItemLabelMap();
    const labels = [
        ...(log.symptoms || []).filter((id) => id !== 'no-symptoms'),
        ...(log.dailyCare || []),
        ...(log.riskFactors || []),
    ].map((id) => labelMap.get(id) || id);
    return labels.length ? labels.join(', ') : 'No symptoms selected';
};

const getLatestOralHealthLog = (logs = []) => [...(Array.isArray(logs) ? logs.map(normalizeSavedLogForPayload) : [])]
    .filter((log) => log?.logDateKey)
    .sort((left, right) => String(right.logDateKey).localeCompare(String(left.logDateKey)))[0] || null;

const evaluateApprovedVisitWindowEscalation = (logs = []) => {
    const latestLog = getLatestOralHealthLog(logs);
    if (!latestLog) return null;

    const symptoms = new Set(latestLog.symptoms || []);
    const details = latestLog.symptomDetails || {};
    const matchedRule = APPROVED_VISIT_WINDOW_ESCALATION_RULES.find((rule) => {
        if (rule.symptomIds?.some((id) => symptoms.has(id))) return true;
        if (rule.detailSeverity) {
            return Object.values(details).some((detail) => detail?.severity === rule.detailSeverity);
        }
        return false;
    });

    if (!matchedRule) return null;

    return {
        ruleId: matchedRule.id,
        label: matchedRule.label,
        sourceLabel: matchedRule.sourceLabel,
        action: matchedRule.action,
        explanation: `${matchedRule.explanation} Recorded on ${latestLog.logDateKey}: ${summarizeLogSelections(latestLog)}.`,
        latestLogDateKey: latestLog.logDateKey,
    };
};

const buildExplainableVisitRecommendation = ({ basePrediction = null, oralHealthLogs = [] } = {}) => {
    const escalation = evaluateApprovedVisitWindowEscalation(oralHealthLogs);

    if (!basePrediction) {
        return {
            label: escalation ? 'Contact Clinic' : 'Insufficient Data',
            color: escalation ? '#01538b' : '#64748b',
            bg: escalation ? '#dceffc' : '#f8fafc',
            recommendationBasis: escalation ? 'approved-safety-rule' : 'insufficient-data',
            recommendationReason: escalation
                ? `${escalation.explanation} No planned visit window is available because there is not enough clinic-recorded visit history. This does not diagnose dental disease.`
                : 'No dentist-suggested next visit or supported clinic treatment history is available, so NgitiFy cannot calculate a visit window yet.',
            sourceLabels: escalation ? [escalation.label, escalation.sourceLabel] : ['Insufficient Data'],
            explanationItems: escalation
                ? [escalation.explanation, 'No planned-care interval was generated from insufficient clinic history.', 'This does not diagnose dental disease.']
                : ['No dentist-suggested next visit is recorded.', 'No supported clinic treatment history is available for routine timing.', 'No visit interval was invented.'],
            contactClinicSooner: Boolean(escalation),
            contactClinicReason: escalation?.action || '',
            escalationRuleId: escalation?.ruleId || '',
            hasVisitWindow: false,
        };
    }

    const sourceLabels = [];
    const explanationItems = [];

    if (escalation) {
        sourceLabels.push(escalation.label, escalation.sourceLabel);
        explanationItems.push(escalation.explanation);
    }

    if (basePrediction.isFollowUpRecommendation) {
        sourceLabels.push('Dentist Recommendation');
        explanationItems.push(`Dentist-suggested next visit recorded after the latest treatment: ${basePrediction.recommendedDateLabel}.`);
    } else {
        sourceLabels.push('Clinic Record', 'Routine / Default Information');
        explanationItems.push(`Most recent clinic treatment: ${basePrediction.lastProcedure || 'Treatment recorded'} on ${basePrediction.lastVisitDate}.`);
        explanationItems.push(`Routine timing source: ${basePrediction.intervalLabel}.`);
    }

    if (!escalation) {
        const latestLog = getLatestOralHealthLog(oralHealthLogs);
        if (latestLog) {
            sourceLabels.push('Recent Oral Health Management Logs');
            explanationItems.push(`Latest Patient Log on ${latestLog.logDateKey}: ${summarizeLogSelections(latestLog)}.`);
            explanationItems.push('No approved safety escalation rule changed the planned visit window.');
        }
    }

    explanationItems.push('Patient self-logs do not diagnose disease and do not postpone a dentist-recommended visit.');

    return {
        ...basePrediction,
        label: escalation ? 'Contact Clinic' : basePrediction.label,
        color: escalation ? '#01538b' : basePrediction.color,
        bg: escalation ? '#dceffc' : basePrediction.bg,
        recommendationBasis: escalation ? 'approved-safety-rule' : basePrediction.recommendationBasis,
        recommendationReason: escalation
            ? `${escalation.explanation} Contact the clinic sooner instead of waiting for a routine visit window.`
            : basePrediction.recommendationReason,
        sourceLabels: [...new Set(sourceLabels)],
        explanationItems,
        contactClinicSooner: Boolean(escalation),
        contactClinicReason: escalation?.action || '',
        escalationRuleId: escalation?.ruleId || '',
        // An urgent approved safety rule must not continue presenting a distant
        // routine window as though it were the recommended action.
        hasVisitWindow: !escalation,
        recommendedDate: escalation ? '' : basePrediction.recommendedDate,
        recommendedDateLabel: escalation ? '' : basePrediction.recommendedDateLabel,
        recommendedDateKey: escalation ? '' : basePrediction.recommendedDateKey,
        windowStart: escalation ? '' : basePrediction.windowStart,
        windowEnd: escalation ? '' : basePrediction.windowEnd,
        windowStartLabel: escalation ? '' : basePrediction.windowStartLabel,
        windowEndLabel: escalation ? '' : basePrediction.windowEndLabel,
        windowStartKey: escalation ? '' : basePrediction.windowStartKey,
        windowEndKey: escalation ? '' : basePrediction.windowEndKey,
        windowLabel: escalation ? '' : basePrediction.windowLabel,
        plannedCareSource: basePrediction.isFollowUpRecommendation ? 'Dentist Recommendation' : 'Routine / Default Information',
    };
};

const buildOralHealthSummary = (logs = []) => {
    const sorted = [...(Array.isArray(logs) ? logs.map(normalizeSavedLogForPayload) : [])]
        .filter((log) => log?.logDateKey)
        .sort((left, right) => String(right.logDateKey).localeCompare(String(left.logDateKey)));
    const recent = sorted.slice(0, 7);
    const symptomCounts = new Map();
    const careCounts = new Map();

    recent.forEach((log) => {
        (log.symptoms || []).forEach((id) => symptomCounts.set(id, (symptomCounts.get(id) || 0) + 1));
        (log.dailyCare || []).forEach((id) => careCounts.set(id, (careCounts.get(id) || 0) + 1));
        (log.riskFactors || []).forEach((id) => careCounts.set(id, (careCounts.get(id) || 0) + 1));
    });

    return {
        recentLogCount: recent.length,
        lastLogDateKey: sorted[0]?.logDateKey || '',
        flossingDays: careCounts.get('flossed') || 0,
        brushingDays: Math.max(careCounts.get('brushed-am') || 0, careCounts.get('brushed-pm') || 0),
        bleedingDays: symptomCounts.get('bleeding-gums') || 0,
        sensitivityDays: symptomCounts.get('sensitivity') || 0,
    };
};

const buildOralHealthPayloadFromPatient = (patient = {}) => {
    const factors = normalizeOralHealthFactors(
        (patient.oralHealthFactors || []).filter((item) => item.active).map((item) => item.id),
        patient.oralHealthFactors || []
    );
    const logs = [...(patient.oralHealthLogs || [])]
        .map(normalizeSavedLogForPayload)
        .sort((left, right) => String(right.logDateKey || '').localeCompare(String(left.logDateKey || '')))
        .slice(0, 30);

    return {
        factors,
        logGroups: ORAL_HEALTH_LOG_GROUPS,
        symptomDetailConfig: ORAL_HEALTH_SYMPTOM_DETAIL_CONFIG,
        logs,
        summary: buildOralHealthSummary(logs),
        education: EDUCATION_LIBRARY,
        contextualEducation: buildContextualDentalHealthEducation(logs),
    };
};

module.exports = {
    EDUCATION_LIBRARY,
    APPROVED_VISIT_WINDOW_ESCALATION_RULES,
    ORAL_HEALTH_FACTOR_OPTIONS,
    ORAL_HEALTH_LOG_GROUPS,
    ORAL_HEALTH_SYMPTOM_DETAIL_CONFIG,
    addDays,
    buildExplainableVisitRecommendation,
    buildContextualDentalHealthEducation,
    buildOralHealthPayloadFromPatient,
    buildOralHealthSummary,
    evaluateApprovedVisitWindowEscalation,
    normalizeDailyOralHealthLogInput,
    normalizeOralHealthFactors,
    normalizeSavedLogForPayload,
    parseDateKey,
    toDateKey,
};
