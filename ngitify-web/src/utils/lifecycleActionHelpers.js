const REASON_OPTIONS = {
    patient: {
        deactivate: [
            { value: 'portal-request', label: 'Patient requested portal access to be turned off' },
            { value: 'identity-review', label: 'Identity or account details are under review' },
            { value: 'duplicate-review', label: 'Possible duplicate patient record under review' },
            { value: 'billing-hold', label: 'Temporary admin hold before reactivation' },
            { value: 'other', label: 'Other' },
        ],
        archive: [
            { value: 'duplicate-merged', label: 'Duplicate patient record already merged elsewhere' },
            { value: 'mistaken-entry', label: 'Patient shell was created by mistake' },
            { value: 'requested-removal', label: 'Patient requested removal from active portal lists' },
            { value: 'long-term-inactive', label: 'Long-term inactive patient kept for record history only' },
            { value: 'other', label: 'Other' },
        ],
    },
    staff: {
        deactivate: [
            { value: 'temporary-leave', label: 'Temporary leave or access pause' },
            { value: 'assignment-change', label: 'Assignment or branch change in progress' },
            { value: 'compliance-review', label: 'Account is under compliance or identity review' },
            { value: 'pending-handover', label: 'Pending schedule or access handover' },
            { value: 'other', label: 'Other' },
        ],
        archive: [
            { value: 'resigned', label: 'Resigned from the clinic' },
            { value: 'transferred', label: 'Transferred to a different operating setup' },
            { value: 'duplicate-account', label: 'Duplicate staff account' },
            { value: 'mistaken-entry', label: 'Created by mistake and no longer operational' },
            { value: 'other', label: 'Other' },
        ],
    },
};

export const requiresLifecycleReason = (action = '') => ['deactivate', 'archive'].includes(String(action || '').trim().toLowerCase());

export const getLifecycleReasonOptions = ({ entityType = 'staff', action = 'archive' } = {}) => {
    const normalizedEntityType = entityType === 'patient' ? 'patient' : 'staff';
    const normalizedAction = String(action || '').trim().toLowerCase();
    return REASON_OPTIONS[normalizedEntityType]?.[normalizedAction] || [];
};

export const buildLifecycleReason = ({
    entityType = 'staff',
    action = 'archive',
    reasonCode = '',
    reasonNotes = '',
} = {}) => {
    const normalizedCode = String(reasonCode || '').trim();
    const normalizedNotes = String(reasonNotes || '').trim();

    if (!requiresLifecycleReason(action) || !normalizedCode) {
        return '';
    }

    if (normalizedCode === 'other') {
        return normalizedNotes ? `Other: ${normalizedNotes}` : 'Other';
    }

    const option = getLifecycleReasonOptions({ entityType, action }).find((entry) => entry.value === normalizedCode);
    const label = option?.label || normalizedCode;
    return normalizedNotes ? `${label}: ${normalizedNotes}` : label;
};

export const isLifecycleReasonValid = ({
    action = 'archive',
    reasonCode = '',
    reasonNotes = '',
} = {}) => {
    if (!requiresLifecycleReason(action)) return true;
    const normalizedCode = String(reasonCode || '').trim();
    if (!normalizedCode) return false;
    if (normalizedCode !== 'other') return true;
    return Boolean(String(reasonNotes || '').trim());
};
