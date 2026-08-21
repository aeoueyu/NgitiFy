const ACCOUNT_SECRET_FIELDS = Object.freeze([
    'password',
    'activationToken',
    'activationTokenExpires',
    'lastEmailChangeRequestedAt',
    'isPasswordChanged',
    'temporaryPasswordExpires',
    'resetPasswordOtp',
    'resetPasswordExpires',
    '__v',
]);

const RESTRICTED_CLINICAL_FIELDS = Object.freeze([
    'height',
    'weight',
    'bloodType',
    'medicalHistory',
    'dentalHistory',
    'physician',
    'reasonForConsultation',
    'clinicalNotes',
    'dentistFindings',
    'treatmentLogs',
    'odontogram',
    'odontogramLogs',
    'radiographs',
    'oralHealthFactors',
    'oralHealthLogs',
]);

const ACCOUNT_SECRET_PROJECTION = ACCOUNT_SECRET_FIELDS
    .map((field) => `-${field}`)
    .join(' ');

const COMMON_STAFF_ACCOUNT_UPDATE_FIELDS = Object.freeze([
    'name',
    'email',
    'contactNumber',
    'birthdate',
    'gender',
    'profileImage',
    'homeAddress',
    'currentAddress',
    'permanentAddress',
]);

const STAFF_ACCOUNT_UPDATE_FIELDS_BY_TARGET_ROLE = Object.freeze({
    owner: Object.freeze([
        ...COMMON_STAFF_ACCOUNT_UPDATE_FIELDS,
        'isDentist',
        'licenseNumber',
        'specialization',
        'assignedBranch',
        'assignedBranches',
    ]),
    'branch-manager': Object.freeze([
        ...COMMON_STAFF_ACCOUNT_UPDATE_FIELDS,
        'assignedBranch',
        'assignedBranches',
    ]),
    dentist: Object.freeze([
        ...COMMON_STAFF_ACCOUNT_UPDATE_FIELDS,
        'licenseNumber',
        'specialization',
        'permissions',
        'assignedBranch',
        'assignedBranches',
    ]),
    secretary: Object.freeze([
        ...COMMON_STAFF_ACCOUNT_UPDATE_FIELDS,
        'permissions',
        'assignedBranch',
        'assignedBranches',
    ]),
});

const toPlainObject = (value) => {
    if (!value) return value;
    return typeof value.toObject === 'function' ? value.toObject() : { ...value };
};

const isSameId = (left, right) => (
    Boolean(left && right) && String(left) === String(right)
);

const canReadPatientClinicalRecord = ({ actorRole, actorId, patientId }) => (
    actorRole === 'dentist'
    || (actorRole === 'patient' && isSameId(actorId, patientId))
);

const canWritePatientClinicalRecord = (actorRole) => actorRole === 'dentist';

const getRestrictedClinicalUpdateFields = (payload = {}) => (
    RESTRICTED_CLINICAL_FIELDS.filter((field) => payload[field] !== undefined)
);

const getAllowedStaffAccountUpdateFields = (targetRole) => (
    STAFF_ACCOUNT_UPDATE_FIELDS_BY_TARGET_ROLE[targetRole] || []
);

const getDisallowedStaffAccountUpdateFields = ({ targetRole, payload = {} }) => {
    const allowedFields = new Set(getAllowedStaffAccountUpdateFields(targetRole));
    return Object.keys(payload).filter((field) => !allowedFields.has(field));
};

const pickAllowedStaffAccountUpdateFields = ({ targetRole, payload = {} }) => {
    const allowedFields = new Set(getAllowedStaffAccountUpdateFields(targetRole));
    return Object.fromEntries(
        Object.entries(payload).filter(([field]) => allowedFields.has(field))
    );
};

const sanitizeUserForActor = (value, actor = {}) => {
    const result = toPlainObject(value);
    if (!result) return result;

    ACCOUNT_SECRET_FIELDS.forEach((field) => delete result[field]);

    if (
        result.role === 'patient'
        && !canReadPatientClinicalRecord({
            actorRole: actor.role,
            actorId: actor.id,
            patientId: result._id,
        })
    ) {
        RESTRICTED_CLINICAL_FIELDS.forEach((field) => delete result[field]);
    }

    return result;
};

const isPatientPublishedRadiograph = (radiograph = {}) => (
    radiograph?.reviewSummary?.status === 'approved'
    && Boolean(String(radiograph?.reviewSummary?.approvedText || '').trim())
    && Boolean(radiograph?.reviewSummary?.approvedAt)
    && Boolean(radiograph?.reviewSummary?.approvedBy)
);

const canApproveRadiographSummary = (radiograph = {}) => {
    const detections = radiograph?.analysis?.detections || [];
    const suggestionsResolved = detections.length > 0
        && detections.every((detection) => ['confirmed', 'corrected', 'ignored'].includes(detection.status))
        && radiograph?.analysis?.verificationState === 'verified';
    const manuallyReviewed = Boolean(
        radiograph?.manualReview?.reviewedAt
        && radiograph?.manualReview?.reviewedBy
    );

    return suggestionsResolved || manuallyReviewed;
};

const canPatientRescheduleAppointment = (appointment = {}) => (
    ['pending', 'confirmed'].includes(String(appointment.status || '').toLowerCase())
    && appointment.isArchived !== true
);

const canPatientCancelAppointment = (appointment = {}) => (
    ['pending', 'confirmed'].includes(String(appointment.status || '').toLowerCase())
    && appointment.isArchived !== true
);

module.exports = {
    ACCOUNT_SECRET_FIELDS,
    ACCOUNT_SECRET_PROJECTION,
    RESTRICTED_CLINICAL_FIELDS,
    canPatientCancelAppointment,
    canPatientRescheduleAppointment,
    canReadPatientClinicalRecord,
    canWritePatientClinicalRecord,
    canApproveRadiographSummary,
    getAllowedStaffAccountUpdateFields,
    getDisallowedStaffAccountUpdateFields,
    getRestrictedClinicalUpdateFields,
    isPatientPublishedRadiograph,
    isSameId,
    pickAllowedStaffAccountUpdateFields,
    sanitizeUserForActor,
};
