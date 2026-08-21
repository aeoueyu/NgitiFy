const buildFrequencyRows = ({ logs = [], field, labels = {} }) => {
    const counts = {};
    logs.forEach((log) => {
        const uniqueItems = new Set(Array.isArray(log?.[field]) ? log[field] : []);
        uniqueItems.forEach((itemId) => {
            if (field === 'symptoms' && itemId === 'no-symptoms') return;
            counts[itemId] = (counts[itemId] || 0) + 1;
        });
    });
    return Object.entries(counts).map(([id, count]) => ({
        id, label: labels[id] || id, count,
    })).sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
};

const buildTrendChartData = (logs = [], period = 7, now = new Date()) => {
    const cutoff = new Date(now);
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - Math.max(1, period) + 1);
    return logs
        .filter((log) => {
            const date = new Date(log?.logDateKey || log?.date || log?.createdAt);
            return !Number.isNaN(date.getTime()) && date >= cutoff && date <= now;
        })
        .sort((left, right) => new Date(left.logDateKey || left.date) - new Date(right.logDateKey || right.date))
        .map((log) => ({
            date: log.logDateKey || log.date,
            dailyCareCount: Array.isArray(log.dailyCare) ? new Set(log.dailyCare).size : 0,
            symptomCount: Array.isArray(log.symptoms) ? log.symptoms.filter((id) => id !== 'no-symptoms').length : 0,
            riskFactorCount: Array.isArray(log.riskFactors) ? new Set(log.riskFactors).size : 0,
        }));
};

const getRecentCheckIns = (logs = [], limit = 3) => [...logs]
    .sort((left, right) => new Date(right.logDateKey || right.date || 0) - new Date(left.logDateKey || left.date || 0))
    .slice(0, limit);

module.exports = { buildFrequencyRows, buildTrendChartData, getRecentCheckIns };
