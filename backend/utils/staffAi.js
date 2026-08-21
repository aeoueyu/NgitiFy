const STAFF_AI_ROLES = Object.freeze([
    'administrator', 'owner', 'branch-manager', 'dentist', 'secretary',
]);

const ROLE_WORKFLOWS = Object.freeze({
    administrator: {
        label: 'Administrator',
        modules: ['Dashboard', 'Schedule', 'Patients', 'Staff', 'Branches', 'Inventory', 'Notifications', 'Activity Logs', 'System Configuration'],
        guidance: 'May review system-wide operations, users, branches, inventory, notifications, and audit activity.',
    },
    owner: {
        label: 'Owner',
        modules: ['Dashboard', 'Schedule', 'Patients', 'Staff', 'Branches', 'Inventory', 'Notifications', 'Activity Logs'],
        guidance: 'May review clinic and branch operations available to the owner account.',
    },
    'branch-manager': {
        label: 'Branch Manager',
        modules: ['Dashboard', 'Schedule', 'Patients', 'Staff', 'Inventory', 'Reports', 'Notifications'],
        guidance: 'May review and manage operations only for the assigned branch.',
    },
    dentist: {
        label: 'Dentist',
        modules: ['Dashboard', 'Schedule', 'Patients', 'Electronic Medical Record (EMR)', 'AI-Assisted Radiograph Review', 'Odontogram', 'Material Usage', 'Notifications'],
        guidance: 'May review assigned appointments and authorized patient records, verify AI tooth suggestions, annotate radiographs, and approve summaries. Clinical judgment remains required.',
    },
    secretary: {
        label: 'Secretary',
        modules: ['Dashboard', 'Schedule', 'Patients', 'Queue', 'Notifications'],
        guidance: 'May manage front-desk workflows and operational details, but not protected clinical records.',
    },
});

const ROLE_SUGGESTIONS = Object.freeze({
    administrator: ['What should I review today?', 'Summarize appointments and low-stock items', 'How do I add a staff account?', 'Where can I review activity logs?'],
    owner: ['Which branches need attention today?', 'Summarize appointment activity', 'Show important inventory concerns', 'How do I review branch activity?'],
    'branch-manager': ['Summarize today in my branch', 'What appointments need attention?', 'What is low in stock?', 'How do I handle a walk-in?'],
    dentist: ['Summarize my schedule today', 'How do I verify AI tooth suggestions?', 'Which teeth did I verify for this radiograph?', 'Show treatment history linked to this radiograph.'],
    secretary: ['What bookings need attention today?', 'How do I reschedule an appointment?', 'How do I register a new patient?', 'How do I handle a walk-in?'],
});

const countByStatus = (items = []) => items.reduce((counts, item) => {
    const status = String(item?.status || 'unknown').toLowerCase();
    counts[status] = (counts[status] || 0) + 1;
    return counts;
}, {});

const isDateInRange = (value, start, end) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    return (!start || date >= new Date(start)) && (!end || date <= new Date(end));
};

const summarizeAppointments = (items = [], { start, end } = {}) => {
    const filtered = items.filter((item) => isDateInRange(item?.date, start, end));
    return { total: filtered.length, statusBreakdown: countByStatus(filtered) };
};

const summarizeInventory = (items = []) => {
    const lowStockItems = items.filter((item) => {
        const quantity = Number(item?.quantity ?? item?.currentStock ?? 0);
        const threshold = Number(item?.reorderLevel ?? item?.threshold ?? 0);
        return quantity <= threshold;
    });
    return {
        totalItems: items.length,
        lowStockCount: lowStockItems.length,
        lowStockItems: lowStockItems.slice(0, 20).map((item) => ({
            name: item.itemName || item.name || 'Item',
            quantity: Number(item.quantity ?? item.currentStock ?? 0),
            reorderLevel: Number(item.reorderLevel ?? item.threshold ?? 0),
            unit: item.unit || '',
            branch: item.branch || '',
        })),
    };
};

const summarizeRadiographRecords = (radiographs = [], treatmentLogs = []) => {
    const treatmentsById = new Map((treatmentLogs || []).map((item) => [String(item._id || item.id), item]));
    const records = (radiographs || []).slice().sort((left, right) => new Date(right.date || 0) - new Date(left.date || 0)).slice(0, 10).map((radiograph) => {
        const verifiedTeeth = [...new Set((radiograph.analysis?.detections || [])
            .filter((item) => ['confirmed', 'corrected'].includes(item.status))
            .map((item) => String(item.confirmedToothNumber || '').trim()).filter(Boolean))];
        const dentistFindings = (radiograph.annotations || []).map((item) => ({
            toothNumber: String(item.toothNumber || '').trim(),
            findingType: String(item.findingType || '').trim(),
            note: String(item.note || '').trim(),
        })).filter((item) => item.findingType || item.note);
        const relatedTreatments = [...new Set((radiograph.annotations || []).map((item) => String(item.treatmentLogId || '')).filter(Boolean))]
            .map((id) => treatmentsById.get(id)).filter(Boolean).map((item) => ({ id: String(item._id || item.id), procedure: item.procedure || '', tooth: item.tooth || '', date: item.date || null }));
        return {
            radiographId: String(radiograph._id || radiograph.id || ''),
            type: radiograph.label || 'Radiograph',
            date: radiograph.date || null,
            reviewStatus: radiograph.analysis?.verificationState || radiograph.analysis?.status || 'not-analyzed',
            verifiedTeeth,
            dentistFindings,
            relatedTreatments,
            approvedSummary: radiograph.reviewSummary?.status === 'approved' ? radiograph.reviewSummary.approvedText || '' : '',
            previousRadiographAvailable: false,
        };
    });
    records.forEach((record, index) => { record.previousRadiographAvailable = index < records.length - 1; });
    return { total: (radiographs || []).length, records, policy: 'Verified teeth and dentist-authored records only. Pending AI suggestions are excluded.' };
};

const wantsOperationalContext = (messages = []) => {
    const text = messages.map((message) => message?.content || '').join(' ').toLowerCase();
    return {
        appointments: /appointment|schedule|booking|queue|today|report|activity/.test(text),
        inventory: /inventory|stock|material|suppl|report|attention/.test(text),
        patient: /patient|record|history|x-ray|tooth chart|odontogram|treatment/.test(text),
    };
};

const buildStaffSystemContext = ({ role, branch = '', currentModule = '', currentRoute = '', aggregates = {} }) => {
    const workflow = ROLE_WORKFLOWS[role];
    if (!workflow) return null;
    return {
        authenticatedRole: role,
        roleLabel: workflow.label,
        permissions: workflow.guidance,
        availableModules: workflow.modules,
        assignedBranch: branch || null,
        currentModule: String(currentModule || '').slice(0, 80),
        currentRoute: String(currentRoute || '').slice(0, 160),
        readOnly: true,
        safetyRules: role === 'secretary'
            ? ['Do not expose clinical records or treatment details.']
            : role === 'dentist'
                ? ['Only summarize records for a patient whose access was verified.', 'Do not invent diagnoses, prescriptions, or treatment plans.']
                : ['Only use the authorized aggregate data supplied by the server.'],
        aggregates,
    };
};

module.exports = {
    STAFF_AI_ROLES,
    ROLE_WORKFLOWS,
    ROLE_SUGGESTIONS,
    buildStaffSystemContext,
    countByStatus,
    isDateInRange,
    summarizeAppointments,
    summarizeInventory,
    summarizeRadiographRecords,
    wantsOperationalContext,
};
