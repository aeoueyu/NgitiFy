const SIX_MONTHS = 6;

const getPredictionStatus = (nextVisit) => {
    const today = new Date();
    const diffMs = nextVisit - today;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return {
            label: 'Overdue',
            days: Math.abs(diffDays),
            color: '#d32f2f',
            bg: '#ffebee',
            nextDate: nextVisit.toDateString(),
        };
    }

    if (diffDays <= 14) {
        return {
            label: 'Due Soon',
            days: diffDays,
            color: '#e65100',
            bg: '#fff3e0',
            nextDate: nextVisit.toDateString(),
        };
    }

    return {
        label: 'On Track',
        days: diffDays,
        color: '#2e7d32',
        bg: '#e8f5e9',
        nextDate: nextVisit.toDateString(),
    };
};

const toValidDatedLogs = (logs = []) =>
    (Array.isArray(logs) ? logs : [])
        .filter((log) => log?.date && !Number.isNaN(new Date(log.date).getTime()))
        .sort((a, b) => new Date(b.date) - new Date(a.date));

/**
 * Calculates the recommended next dental visit based on the last visit date.
 * Standard recommendation: checkup every 6 months.
 *
 * @param {string | Date | null} lastVisitDate
 * @returns {{ label: string, days: number, color: string, bg: string, nextDate: string } | null}
 *   Returns null when no valid date is supplied.
 */
export const getVisitPrediction = (lastVisitDate) => {
    if (!lastVisitDate) return null;

    const last = new Date(lastVisitDate);
    if (Number.isNaN(last.getTime())) return null;

    const nextVisit = new Date(last);
    nextVisit.setMonth(nextVisit.getMonth() + SIX_MONTHS);

    return getPredictionStatus(nextVisit);
};

/**
 * Builds a prediction object from treatment history rather than a single date.
 *
 * @param {Array} treatmentLogs
 * @returns {{
 *   label: string,
 *   days: number,
 *   color: string,
 *   bg: string,
 *   nextDate: string,
 *   historyCount: number,
 *   lastVisitDate: string,
 *   lastProcedure: string | null,
 *   recentProcedures: Array<{ id: string, date: string, procedure: string }>
 * } | null}
 */
export const getVisitPredictionFromHistory = (treatmentLogs = []) => {
    const validLogs = toValidDatedLogs(treatmentLogs);
    if (!validLogs.length) return null;

    const latest = validLogs[0];
    const prediction = getVisitPrediction(latest.date);
    if (!prediction) return null;

    return {
        ...prediction,
        historyCount: validLogs.length,
        lastVisitDate: latest.date,
        lastProcedure: latest.procedure || null,
        recentProcedures: validLogs.slice(0, 5).map((log, index) => ({
            id: log._id || `${log.date}-${log.procedure || 'procedure'}-${index}`,
            date: log.date,
            procedure: log.procedure || 'Treatment recorded',
        })),
    };
};
