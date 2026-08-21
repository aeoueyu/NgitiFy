const PATIENT_SELF_EDITABLE_FIELDS = Object.freeze([
    'name',
    'contactNumber',
    'birthdate',
    'gender',
    'homePhone',
    'workPhone',
    'occupation',
    'civilStatus',
    'nationality',
    'religion',
    'emergencyContact',
    'guardian',
    'homeAddress',
    'currentAddress',
    'permanentAddress',
    'profileImage',
]);

const PATIENT_SELF_EDITABLE_FIELD_SET = new Set(PATIENT_SELF_EDITABLE_FIELDS);
const PATIENT_SELF_EDITABLE_NESTED_FIELDS = Object.freeze({
    name: new Set(['first', 'middle', 'last']),
    emergencyContact: new Set(['name', 'relationship', 'contactNumber']),
    guardian: new Set(['name', 'relationship', 'contactNumber', 'occupation']),
    homeAddress: new Set(['country', 'region', 'province', 'city', 'barangay', 'houseNumber', 'street']),
    currentAddress: new Set(['country', 'region', 'province', 'city', 'barangay', 'houseNumber', 'street']),
    permanentAddress: new Set(['country', 'region', 'province', 'city', 'barangay', 'houseNumber', 'street']),
});

const getDisallowedPatientProfileFields = (payload) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return ['requestBody'];
    }

    const disallowedFields = Object.keys(payload).filter((field) => !PATIENT_SELF_EDITABLE_FIELD_SET.has(field));

    Object.entries(PATIENT_SELF_EDITABLE_NESTED_FIELDS).forEach(([parent, allowedFields]) => {
        const value = payload[parent];
        if (!value || typeof value !== 'object' || Array.isArray(value)) return;
        Object.keys(value).forEach((field) => {
            if (!allowedFields.has(field)) disallowedFields.push(`${parent}.${field}`);
        });
    });

    return disallowedFields;
};

module.exports = {
    PATIENT_SELF_EDITABLE_FIELDS,
    getDisallowedPatientProfileFields,
};
