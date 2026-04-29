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
    if (isNaN(last.getTime())) return null;

    const nextVisit = new Date(last);
    nextVisit.setMonth(nextVisit.getMonth() + 6);

    const today    = new Date();
    const diffMs   = nextVisit - today;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return {
            label:    'Overdue',
            days:     Math.abs(diffDays),
            color:    '#d32f2f',
            bg:       '#ffebee',
            nextDate: nextVisit.toDateString(),
        };
    }

    if (diffDays <= 14) {
        return {
            label:    'Due Soon',
            days:     diffDays,
            color:    '#e65100',
            bg:       '#fff3e0',
            nextDate: nextVisit.toDateString(),
        };
    }

    return {
        label:    'On Track',
        days:     diffDays,
        color:    '#2e7d32',
        bg:       '#e8f5e9',
        nextDate: nextVisit.toDateString(),
    };
};