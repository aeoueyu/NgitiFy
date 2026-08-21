const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
    PATIENT_SELF_EDITABLE_FIELDS,
    getDisallowedPatientProfileFields,
} = require('../utils/patientProfilePermissions');

test('patient profile self-edit allowlist contains contact and demographic fields only', () => {
    assert.deepEqual(PATIENT_SELF_EDITABLE_FIELDS, [
        'name', 'contactNumber', 'birthdate', 'gender', 'homePhone', 'workPhone',
        'occupation', 'civilStatus', 'nationality', 'religion', 'emergencyContact',
        'guardian', 'homeAddress', 'currentAddress', 'permanentAddress', 'profileImage',
    ]);
});

test('patient profile self-edit rejects clinical and unknown fields', () => {
    const fields = getDisallowedPatientProfileFields({
        name: { first: 'Ana' },
        medicalHistory: { allergies: [] },
        dentalHistory: { chiefComplaint: 'Pain' },
        bloodType: 'O+',
        treatmentLogs: [],
        odontogram: {},
        radiographs: [],
        clinicalNotes: 'changed',
    });

    assert.deepEqual(fields, [
        'medicalHistory', 'dentalHistory', 'bloodType', 'treatmentLogs',
        'odontogram', 'radiographs', 'clinicalNotes',
    ]);
});

test('patient profile self-edit rejects unknown nested fields', () => {
    assert.deepEqual(getDisallowedPatientProfileFields({
        name: { first: 'Ana', diagnosis: 'not allowed' },
        emergencyContact: { name: 'Alex', clinicalNotes: 'not allowed' },
        homeAddress: { city: 'Manila', treatmentPlan: 'not allowed' },
    }), ['name.diagnosis', 'emergencyContact.clinicalNotes', 'homeAddress.treatmentPlan']);
});

test('patient profile self-edit accepts the complete documented allowlist', () => {
    const payload = Object.fromEntries(PATIENT_SELF_EDITABLE_FIELDS.map((field) => [field, {}]));
    assert.deepEqual(getDisallowedPatientProfileFields(payload), []);
});

test('API contract enforces patient filtering while registration still owns clinical intake', () => {
    const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    const selfUpdateStart = serverSource.indexOf("app.put('/api/user/update-profile/:id'");
    const selfUpdateEnd = serverSource.indexOf("app.post('/api/user/request-email-change'", selfUpdateStart);
    const selfUpdateRoute = serverSource.slice(selfUpdateStart, selfUpdateEnd);
    const registrationStart = serverSource.indexOf("app.post('/api/pre-register/:token'");
    const registrationEnd = serverSource.indexOf("app.post(['/api/admin/appointments", registrationStart);
    const registrationRoute = serverSource.slice(registrationStart, registrationEnd);

    assert.match(selfUpdateRoute, /req\.user\.role === 'patient'/);
    assert.match(selfUpdateRoute, /getDisallowedPatientProfileFields\(req\.body\)/);
    assert.match(registrationRoute, /guestMedicalHistory/);
    assert.match(registrationRoute, /guestDentalHistory/);
    assert.match(registrationRoute, /consentAcknowledgement/);
    const treatmentRouteStart = serverSource.indexOf("app.get('/api/my/treatment-logs'");
    const treatmentRouteEnd = serverSource.indexOf("app.get('/api/my/visit-prediction'", treatmentRouteStart);
    const treatmentRoute = serverSource.slice(treatmentRouteStart, treatmentRouteEnd);
    assert.match(treatmentRoute, /buildPatientTreatmentLogPayload/);
    assert.doesNotMatch(treatmentRoute, /buildTreatmentLogPayload\(entry\)/);
});
