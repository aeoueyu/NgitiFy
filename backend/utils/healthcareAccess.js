const ACCOUNT_SECRET_FIELDS = Object.freeze([
    'password',
    'activationToken',
    'activationTokenExpires',
    'temporaryPasswordExpires',
    'resetPasswordOtp',
    'resetPasswordExpires',
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
);

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
    getRestrictedClinicalUpdateFields,
    isPatientPublishedRadiograph,
    isSameId,
    sanitizeUserForActor,
};
