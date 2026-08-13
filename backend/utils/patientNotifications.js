const {
    buildContextualDentalHealthEducation,
    evaluateApprovedVisitWindowEscalation,
    normalizeSavedLogForPayload,
} = require('./oralHealth');

const DEFAULT_ORAL_HEALTH_REMINDER_TIME = '20:00';

const normalizeTime = (
    value,
    fallback = DEFAULT_ORAL_HEALTH_REMINDER_TIME
) => {
    const normalized = String(value || '').trim();

    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(normalized)) {
        return fallback;
    }

    return normalized;
};

const normalizeLogs = (logs = []) => (
    (Array.isArray(logs) ? logs : [])
        .map(normalizeSavedLogForPayload)
        .filter((log) => log?.logDateKey)
        .sort(
            (left, right) =>
                String(right.logDateKey).localeCompare(
                    String(left.logDateKey)
                )
        )
);

const hasOralHealthLogForDate = (
    logs = [],
    dateKey = ''
) => (
    normalizeLogs(logs)
        .some(
            (log) =>
                String(log.logDateKey || '') ===
                String(dateKey || '')
        )
);

const hasReachedReminderTime = ({
    currentTime = '',
    reminderTime = DEFAULT_ORAL_HEALTH_REMINDER_TIME,
} = {}) => {
    const current =
        normalizeTime(currentTime, '00:00');

    const reminder =
        normalizeTime(reminderTime);

    return current >= reminder;
};

const buildDailyOralHealthReminderDecision = ({
    enabled = true,
    logs = [],
    todayKey = '',
    currentTime = '',
    reminderTime = DEFAULT_ORAL_HEALTH_REMINDER_TIME,
} = {}) => {
    if (!enabled) {
        return {
            shouldNotify: false,
            reason: 'disabled',
        };
    }

    if (!todayKey) {
        return {
            shouldNotify: false,
            reason: 'missing-date',
        };
    }

    if (
        !hasReachedReminderTime({
            currentTime,
            reminderTime,
        })
    ) {
        return {
            shouldNotify: false,
            reason: 'before-reminder-time',
        };
    }

    if (
        hasOralHealthLogForDate(
            logs,
            todayKey
        )
    ) {
        return {
            shouldNotify: false,
            reason: 'already-logged',
        };
    }

    return {
        shouldNotify: true,
        type: 'ORAL_HEALTH_DAILY_REMINDER',
        title: 'Daily Oral Health Management Reminder',
        message:
            'You have not saved today’s Oral Health Management entry yet. Record today’s information when convenient.',
        dedupeKey:
            `oral-health-daily:${todayKey}`,
    };
};

const buildSymptomFollowUpReminderDecision = ({
    enabled = true,
    logs = [],
    todayKey = '',
} = {}) => {
    if (!enabled) {
        return {
            shouldNotify: false,
            reason: 'disabled',
        };
    }

    const escalation =
        evaluateApprovedVisitWindowEscalation(
            logs
        );

    if (!escalation) {
        return {
            shouldNotify: false,
            reason: 'no-approved-rule',
        };
    }

    const sourceDate =
        String(
            escalation.latestLogDateKey || ''
        ).trim();

    if (
        !sourceDate
        || !todayKey
        || todayKey <= sourceDate
    ) {
        return {
            shouldNotify: false,
            reason: 'same-day-or-invalid-date',
        };
    }

    return {
        shouldNotify: true,
        type: 'ORAL_HEALTH_SYMPTOM_FOLLOW_UP',
        title: 'Oral Health Management Follow-Up',
        message:
            `${escalation.action} This reminder is based only on the approved NgitiFy safety rule for information you recorded on ${sourceDate}. It does not diagnose dental disease.`,
        dedupeKey:
            `oral-health-follow-up:${escalation.ruleId}:${sourceDate}`,
        ruleId: escalation.ruleId,
        sourceDateKey: sourceDate,
    };
};

const getMondayWeekKey = (
    dateKey = ''
) => {
    if (
        !/^\d{4}-\d{2}-\d{2}$/.test(
            String(dateKey || '')
        )
    ) {
        return '';
    }

    const date =
        new Date(`${dateKey}T12:00:00`);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return '';
    }

    const day =
        date.getDay();

    const daysFromMonday =
        day === 0
            ? 6
            : day - 1;

    date.setDate(
        date.getDate()
        - daysFromMonday
    );

    const year =
        date.getFullYear();

    const month =
        String(
            date.getMonth() + 1
        ).padStart(2, '0');

    const dayOfMonth =
        String(
            date.getDate()
        ).padStart(2, '0');

    return `${year}-${month}-${dayOfMonth}`;
};

const buildDentalHealthEducationTipDecision = ({
    enabled = true,
    logs = [],
    todayKey = '',
} = {}) => {
    if (!enabled) {
        return {
            shouldNotify: false,
            reason: 'disabled',
        };
    }

    const education =
        buildContextualDentalHealthEducation(
            logs,
            1
        );

    if (!education.length) {
        return {
            shouldNotify: false,
            reason: 'no-contextual-education',
        };
    }

    const article =
        education[0];

    const weekKey =
        getMondayWeekKey(todayKey);

    if (!weekKey) {
        return {
            shouldNotify: false,
            reason: 'invalid-date',
        };
    }

    return {
        shouldNotify: true,
        type: 'DENTAL_HEALTH_TIP',
        title:
            article.title
            || 'Dental Health Education',
        message:
            article.summary
            || 'Review your Dental Health Education topics in Oral Health Management.',
        dedupeKey:
            `dental-health-tip:${weekKey}:${article.id}`,
        articleId:
            article.id,
    };
};

module.exports = {
    DEFAULT_ORAL_HEALTH_REMINDER_TIME,
    buildDailyOralHealthReminderDecision,
    buildDentalHealthEducationTipDecision,
    buildSymptomFollowUpReminderDecision,
    getMondayWeekKey,
    hasOralHealthLogForDate,
    hasReachedReminderTime,
    normalizeTime,
};