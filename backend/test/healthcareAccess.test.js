const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
    canPatientCancelAppointment,
    canPatientRescheduleAppointment,
    canReadPatientClinicalRecord,
    canWritePatientClinicalRecord,
    getRestrictedClinicalUpdateFields,
    isPatientPublishedRadiograph,
    sanitizeUserForActor,
} = require('../utils/healthcareAccess');

const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

test('patient clinical access is self-only and clinical writes are dentist-only', () => {
    assert.equal(canReadPatientClinicalRecord({ actorRole: 'patient', actorId: 'p1', patientId: 'p1' }), true);
    assert.equal(canReadPatientClinicalRecord({ actorRole: 'patient', actorId: 'p1', patientId: 'p2' }), false);
    assert.equal(canReadPatientClinicalRecord({ actorRole: 'secretary', actorId: 's1', patientId: 'p1' }), false);
    assert.equal(canReadPatientClinicalRecord({ actorRole: 'owner', actorId: 'o1', patientId: 'p1' }), false);
    assert.equal(canWritePatientClinicalRecord('dentist'), true);
    assert.equal(canWritePatientClinicalRecord('administrator'), false);
});

test('operational viewers receive no clinical fields or account recovery secrets', () => {
    const sanitized = sanitizeUserForActor({
        _id: 'p1', role: 'patient', email: 'patient@example.test',
        password: 'hash', resetPasswordOtp: '123456', activationToken: 'secret',
        medicalHistory: { notes: 'private' }, treatmentLogs: [{ notes: 'private' }],
        odontogram: { 11: { status: 'filled' } }, radiographs: [{ analysis: { confidence: 0.9 } }],
    }, { id: 's1', role: 'secretary' });
    assert.equal(sanitized.email, 'patient@example.test');
    for (const field of ['password', 'resetPasswordOtp', 'activationToken', 'medicalHistory', 'treatmentLogs', 'odontogram', 'radiographs']) {
        assert.equal(sanitized[field], undefined);
    }
});

test('non-dentist patient updates identify protected clinical fields', () => {
    assert.deepEqual(getRestrictedClinicalUpdateFields({ name: {}, medicalHistory: {}, odontogram: {} }), ['medicalHistory', 'odontogram']);
});

test('patients only receive published radiographs with approved summaries', () => {
    assert.equal(isPatientPublishedRadiograph({ reviewSummary: { status: 'approved', approvedText: 'Dentist confirmed.' } }), true);
    assert.equal(isPatientPublishedRadiograph({ reviewSummary: { status: 'approved', approvedText: '' } }), false);
    assert.equal(isPatientPublishedRadiograph({ reviewSummary: { status: 'draft', draft: 'AI suggestion' } }), false);
});

test('patient appointment actions are limited to active pending or confirmed records', () => {
    assert.equal(canPatientCancelAppointment({ status: 'confirmed' }), true);
    assert.equal(canPatientRescheduleAppointment({ status: 'pending' }), true);
    assert.equal(canPatientCancelAppointment({ status: 'completed' }), false);
    assert.equal(canPatientRescheduleAppointment({ status: 'cancelled' }), false);
});

test('server contracts enforce ownership, role gates, trusted AI context, and publication filtering', () => {
    assert.match(serverSource, /Patients can only view their own appointments/);
    assert.match(serverSource, /Patients can only cancel their own appointments/);
    assert.match(serverSource, /Patients can only reschedule their own appointments/);
    assert.match(serverSource, /Clinical records may only be changed by an assigned dentist/);
    assert.match(serverSource, /Only dentists can update the odontogram/);
    assert.match(serverSource, /Only dentists can upload radiograph images/);
    assert.match(serverSource, /filter\(\(entry\) => isPatientPublishedRadiograph\(entry\)\)/);
    const patientChat = serverSource.slice(serverSource.indexOf('const handlePatientAiChat'), serverSource.indexOf("app.post('/api/ai/chat"));
    assert.doesNotMatch(patientChat, /const \{ messages, assistantContext \}/);
    assert.match(patientChat, /assistantContext: null/);
    const usersRoute = serverSource.slice(serverSource.indexOf("app.get('/api/users'"), serverSource.indexOf("app.get('/api/patients'"));
    assert.match(usersRoute, /if \(role === 'patient'\)/);
    assert.match(usersRoute, /Use the assigned-patient directory/);
});

test('web and mobile patient labels use the thesis terminology with plain-language helpers', () => {
    const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', '..', ...parts), 'utf8');
    const webRecords = read('ngitify-web', 'src', 'pages', 'patient', 'PatientMedicalRecords.js');
    const mobileRecords = read('ngitify-mobile', 'src', 'screens', 'patient', 'MedicalRecordsScreen.js');
    const mobileDashboard = read('ngitify-mobile', 'src', 'screens', 'patient', 'PatientDashboard.js');

    assert.match(webRecords, /Electronic Medical Record \(EMR\)/);
    assert.match(webRecords, /Odontogram · Your tooth chart/);
    assert.match(webRecords, /Radiograph Images · Your dental X-rays/);
    assert.match(webRecords, /Medical and Dental History/);
    assert.match(mobileRecords, /label: 'Radiograph Images'/);
    assert.match(mobileDashboard, /Electronic Medical Record/);
});
