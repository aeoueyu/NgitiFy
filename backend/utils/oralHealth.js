const addDays = (value, days) => {
    const date = new Date(value);
    date.setDate(date.getDate() + days);
    return date;
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim())) return null;
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
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
            { id: 'bleeding-gums', label: 'Bleeding Gums' },
            { id: 'sensitivity', label: 'Sensitivity' },
            { id: 'jaw-pain', label: 'Jaw Pain' },
            { id: 'mouth-sores', label: 'Mouth Sores' },
            { id: 'bad-breath', label: 'Bad Breath' },
        ],
    },
    {
        id: 'dailyCare',
        title: 'Daily Care',
        items: [
            { id: 'brushing', label: 'Brushing' },
            { id: 'flossing', label: 'Flossing' },
            { id: 'mouthwash', label: 'Mouthwash' },
            { id: 'sugar-intake', label: 'Sugar Intake' },
            { id: 'smoking-vaping', label: 'Smoking / Vaping' },
        ],
    },
]);

const EDUCATION_LIBRARY = Object.freeze([
    {
        id: 'gum-bleeding',
        title: 'Bleeding gums are a signal, not a brushing failure',
        category: 'Gum Health',
        summary: 'Gentle cleaning, consistent flossing, and a timely check-up help the clinic spot inflammation early.',
        action: 'Mention any repeated bleeding at your next visit.',
    },
    {
        id: 'sensitivity-triggers',
        title: 'Track sensitivity by trigger',
        category: 'Tooth Sensitivity',
        summary: 'Cold, sweet, brushing, and biting sensitivity can point to different clinical causes.',
        action: 'Log the trigger and which tooth area you notice.',
    },
    {
        id: 'preventive-window',
        title: 'Preventive windows work better than exact prediction dates',
        category: 'Preventive Care',
        summary: 'A visit window combines treatment history, symptoms, and habits without pretending to diagnose at home.',
        action: 'Book within the recommended window when possible.',
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

const normalizeDailyOralHealthLogInput = (body = {}) => {
    const logDate = parseDateKey(body.logDate || toDateKey(new Date()));
    if (!logDate) {
        const error = new Error('Log date must be a valid YYYY-MM-DD date.');
        error.statusCode = 400;
        throw error;
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (logDate > today) {
        const error = new Error('Daily oral health logs cannot be dated in the future.');
        error.statusCode = 400;
        throw error;
    }

    const symptomIds = new Set(ORAL_HEALTH_LOG_GROUPS.find((group) => group.id === 'symptoms').items.map((item) => item.id));
    const careIds = new Set(ORAL_HEALTH_LOG_GROUPS.find((group) => group.id === 'dailyCare').items.map((item) => item.id));
    const symptoms = uniqueAllowedIds(body.symptoms || [], symptomIds, 'symptom');
    const dailyCare = uniqueAllowedIds(body.dailyCare || body.care || [], careIds, 'daily care');
    const notes = String(body.notes || '').trim().slice(0, 500);

    if (!symptoms.length && !dailyCare.length && !notes) {
        const error = new Error('Select at least one symptom, care item, or note before saving.');
        error.statusCode = 400;
        throw error;
    }

    return {
        logDate,
        logDateKey: toDateKey(logDate),
        symptoms,
        dailyCare,
        notes,
    };
};

const buildOralHealthSummary = (logs = []) => {
    const sorted = [...(Array.isArray(logs) ? logs : [])]
        .filter((log) => log?.logDateKey)
        .sort((left, right) => String(right.logDateKey).localeCompare(String(left.logDateKey)));
    const recent = sorted.slice(0, 7);
    const symptomCounts = new Map();
    const careCounts = new Map();

    recent.forEach((log) => {
        (log.symptoms || []).forEach((id) => symptomCounts.set(id, (symptomCounts.get(id) || 0) + 1));
        (log.dailyCare || []).forEach((id) => careCounts.set(id, (careCounts.get(id) || 0) + 1));
    });

    return {
        recentLogCount: recent.length,
        lastLogDateKey: sorted[0]?.logDateKey || '',
        flossingDays: careCounts.get('flossing') || 0,
        brushingDays: careCounts.get('brushing') || 0,
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
        .sort((left, right) => String(right.logDateKey || '').localeCompare(String(left.logDateKey || '')))
        .slice(0, 30);

    return {
        factors,
        logGroups: ORAL_HEALTH_LOG_GROUPS,
        logs,
        summary: buildOralHealthSummary(logs),
        education: EDUCATION_LIBRARY,
    };
};

module.exports = {
    EDUCATION_LIBRARY,
    ORAL_HEALTH_FACTOR_OPTIONS,
    ORAL_HEALTH_LOG_GROUPS,
    addDays,
    buildOralHealthPayloadFromPatient,
    buildOralHealthSummary,
    normalizeDailyOralHealthLogInput,
    normalizeOralHealthFactors,
    parseDateKey,
    toDateKey,
};
