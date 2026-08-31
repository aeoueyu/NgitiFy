const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
    canPatientCancelAppointment,
    canPatientRescheduleAppointment,
    canApproveRadiographSummary,
    canReadPatientClinicalRecord,
    canReadPatientDentalImaging,
    canWritePatientClinicalRecord,
    getDisallowedStaffAccountUpdateFields,
    getRestrictedClinicalUpdateFields,
    hasDentistClinicalAccess,
    isPatientPublishedRadiograph,
    sanitizeUserForActor,
} = require('../utils/healthcareAccess');
const User = require('../models/User');

const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

test('all staff roles can read clinical records, patients remain self-only, and writes require dentist qualification', () => {
    assert.equal(canReadPatientClinicalRecord({ actorRole: 'patient', actorId: 'p1', patientId: 'p1' }), true);
    assert.equal(canReadPatientClinicalRecord({ actorRole: 'patient', actorId: 'p1', patientId: 'p2' }), false);
    for (const actorRole of ['administrator', 'owner', 'co-owner', 'branch-manager', 'secretary', 'dentist']) {
        assert.equal(canReadPatientClinicalRecord({ actorRole, actorId: `${actorRole}-1`, patientId: 'p1' }), true);
    }
    assert.equal(canReadPatientClinicalRecord({ actorRole: 'unknown', actorId: 'u1', patientId: 'p1' }), false);
    assert.equal(canWritePatientClinicalRecord('dentist'), true);
    assert.equal(canWritePatientClinicalRecord({ role: 'owner', isDentist: true }), true);
    assert.equal(canWritePatientClinicalRecord('administrator'), false);
    assert.equal(canWritePatientClinicalRecord('owner'), false);
    assert.equal(canWritePatientClinicalRecord({ role: 'owner', isDentist: false }), false);
    assert.equal(canWritePatientClinicalRecord('branch-manager'), false);
    assert.equal(canWritePatientClinicalRecord('secretary'), false);
    assert.equal(canWritePatientClinicalRecord('patient'), false);
});

test('dentist clinical access includes qualified owner-dentists only', () => {
    assert.equal(hasDentistClinicalAccess({ role: 'dentist' }), true);
    assert.equal(hasDentistClinicalAccess({ role: 'owner', isDentist: true }), true);
    assert.equal(hasDentistClinicalAccess({ role: 'owner', isDentist: false }), false);
    assert.equal(hasDentistClinicalAccess({ role: 'administrator', isDentist: true }), false);
});

test('all staff roles can view odontograms and radiographs while patients remain self-only', () => {
    for (const actorRole of ['administrator', 'owner', 'co-owner', 'branch-manager', 'secretary', 'dentist']) {
        assert.equal(
            canReadPatientDentalImaging({ actorRole, actorId: `${actorRole}-1`, patientId: 'patient-1' }),
            true
        );
    }
    assert.equal(canReadPatientDentalImaging({ actorRole: 'patient', actorId: 'patient-1', patientId: 'patient-1' }), true);
    assert.equal(canReadPatientDentalImaging({ actorRole: 'patient', actorId: 'patient-1', patientId: 'patient-2' }), false);
    assert.equal(canReadPatientDentalImaging({ actorRole: 'unknown', actorId: 'u1', patientId: 'patient-1' }), false);
});

test('treatment, odontogram, and radiograph read routes use shared staff read permissions', () => {
    const treatmentRouteStart = serverSource.indexOf("app.get('/api/patients/:id/treatment-logs'");
    const treatmentRouteEnd = serverSource.indexOf('\napp.', treatmentRouteStart + 1);
    const treatmentRoute = serverSource.slice(treatmentRouteStart, treatmentRouteEnd);
    assert.notEqual(treatmentRouteStart, -1);
    assert.match(treatmentRoute, /canReadPatientClinicalRecord/);

    for (const routeMarker of [
        "app.get('/api/patients/:id/odontogram'",
        "app.get('/api/patients/:id/odontogram-logs'",
        "app.get('/api/patients/:id/radiographs'",
    ]) {
        const routeStart = serverSource.indexOf(routeMarker);
        const nextRoute = serverSource.indexOf('\napp.', routeStart + routeMarker.length);
        const route = serverSource.slice(routeStart, nextRoute);

        assert.notEqual(routeStart, -1, `Missing route: ${routeMarker}`);
        assert.match(route, /canReadPatientDentalImaging/);
    }

    const patientEmr = fs.readFileSync(
        path.join(__dirname, '..', '..', 'ngitify-web', 'src', 'pages', 'admin', 'PatientEMR.js'),
        'utf8'
    );
    assert.match(patientEmr, /const canEditOdontogram = effectiveRole === 'dentist'/);
    assert.match(patientEmr, /const isReadOnly = forceReadOnly \|\| effectiveRole !== 'dentist'/);
    assert.match(patientEmr, /const canManageTreatmentLog = effectiveRole === 'dentist'/);
    assert.match(patientEmr, /const canAddTreatmentLog = !forceReadOnly && hasDentistTreatmentAccess/);
    assert.match(patientEmr, /const canUploadRadiograph = effectiveRole === 'dentist'/);
    assert.match(patientEmr, /const canDeleteRadiograph = effectiveRole === 'dentist'/);
});

test('treatment logs require dentist access and an assigned or completed-treatment relationship', () => {
    const routeStart = serverSource.indexOf("app.post('/api/patients/:id/treatment-logs'");
    const routeEnd = serverSource.indexOf('\napp.', routeStart + 1);
    const route = serverSource.slice(routeStart, routeEnd);
    const accessHelperStart = serverSource.indexOf('const dentistCanAddTreatmentLogForPatient');
    const accessHelperEnd = serverSource.indexOf('\n};', accessHelperStart) + 3;
    const accessHelper = serverSource.slice(accessHelperStart, accessHelperEnd);

    assert.notEqual(routeStart, -1);
    assert.match(route, /hasDentistClinicalAccess\(req\.user\)/);
    assert.match(route, /dentistCanAddTreatmentLogForPatient\(req\.user\.id, patient\._id\)/);
    assert.match(accessHelper, /assignedDentistId: dentistId/);
    assert.match(accessHelper, /status: 'completed'/);
});

test('authorized staff viewers receive clinical fields but no account recovery secrets', () => {
    const sanitized = sanitizeUserForActor({
        _id: 'p1', role: 'patient', email: 'patient@example.test',
        password: 'hash', resetPasswordOtp: '123456', activationToken: 'secret',
        resetPasswordExpires: new Date(), activationTokenExpires: new Date(),
        temporaryPasswordExpires: new Date(), lastEmailChangeRequestedAt: new Date(),
        isPasswordChanged: true, __v: 7,
        medicalHistory: { notes: 'private' }, treatmentLogs: [{ notes: 'private' }],
        odontogram: { 11: { status: 'filled' } }, radiographs: [{ analysis: { confidence: 0.9 } }],
    }, { id: 's1', role: 'secretary' });
    assert.equal(sanitized.email, 'patient@example.test');
    for (const field of ['password', 'resetPasswordOtp', 'resetPasswordExpires', 'activationToken', 'activationTokenExpires', 'temporaryPasswordExpires', 'lastEmailChangeRequestedAt', 'isPasswordChanged', '__v']) {
        assert.equal(sanitized[field], undefined);
    }
    assert.deepEqual(sanitized.medicalHistory, { notes: 'private' });
    assert.deepEqual(sanitized.treatmentLogs, [{ notes: 'private' }]);
    assert.deepEqual(sanitized.odontogram, { 11: { status: 'filled' } });
    assert.deepEqual(sanitized.radiographs, [{ analysis: { confidence: 0.9 } }]);
});

test('User JSON serialization strips account secrets as a final response safeguard', () => {
    const serialized = new User({
        name: { first: 'Test', last: 'User' },
        email: 'user@example.test',
        password: 'hash',
        activationToken: 'activation-secret',
        resetPasswordOtp: '123456',
        role: 'secretary',
    }).toJSON();
    assert.equal(serialized.email, 'user@example.test');
    for (const field of ['password', 'activationToken', 'resetPasswordOtp']) {
        assert.equal(serialized[field], undefined);
    }
});

test('staff clinical read access covers the complete operational role matrix', () => {
    for (const actorRole of ['administrator', 'owner', 'co-owner', 'branch-manager', 'secretary', 'dentist']) {
        assert.equal(canReadPatientClinicalRecord({ actorRole, actorId: `${actorRole}-1`, patientId: 'patient-1' }), true);
    }
    assert.equal(canReadPatientClinicalRecord({ actorRole: 'patient', actorId: 'patient-1', patientId: 'patient-2' }), false);
    assert.equal(canReadPatientClinicalRecord({ actorRole: 'patient', actorId: 'patient-1', patientId: 'patient-1' }), true);
});

test('generic staff account field allowlists reject clinical and security fields for every target role', () => {
    for (const targetRole of ['owner', 'branch-manager', 'dentist', 'secretary']) {
        assert.deepEqual(
            getDisallowedStaffAccountUpdateFields({
                targetRole,
                payload: { name: {}, medicalHistory: {}, radiographs: [], password: 'replacement', role: 'administrator' },
            }),
            ['medicalHistory', 'radiographs', 'password', 'role']
        );
    }
    assert.deepEqual(
        getDisallowedStaffAccountUpdateFields({ targetRole: 'patient', payload: { name: {} } }),
        ['name']
    );
});

test('non-dentist patient updates identify protected clinical fields', () => {
    assert.deepEqual(getRestrictedClinicalUpdateFields({ name: {}, medicalHistory: {}, odontogram: {} }), ['medicalHistory', 'odontogram']);
});

test('owner-dentist clinical updates use live dentist qualification and patient relationship checks', () => {
    const routeStart = serverSource.indexOf("app.put('/api/patients/:id'");
    const routeEnd = serverSource.indexOf('\napp.', routeStart + 1);
    const route = serverSource.slice(routeStart, routeEnd);

    assert.match(route, /canWritePatientClinicalRecord\(req\.user\)/);
    assert.match(route, /dentistCanAccessPatient\(req\.user\.id, currentPatient\._id\)/);
    assert.doesNotMatch(route, /canWritePatientClinicalRecord\(req\.user\.role\)/);
});

test('patients only receive published radiographs with approved summaries', () => {
    assert.equal(isPatientPublishedRadiograph({ reviewSummary: { status: 'approved', approvedText: 'Dentist confirmed.', approvedAt: new Date(), approvedBy: 'd1' } }), true);
    assert.equal(isPatientPublishedRadiograph({ reviewSummary: { status: 'approved', approvedText: '' } }), false);
    assert.equal(isPatientPublishedRadiograph({ reviewSummary: { status: 'draft', draft: 'AI suggestion' } }), false);
    assert.equal(isPatientPublishedRadiograph({ reviewSummary: { status: 'approved', approvedText: 'Missing approval record.' } }), false);
});

test('radiograph approval requires resolved AI suggestions or recorded manual dentist review', () => {
    assert.equal(canApproveRadiographSummary({ analysis: { verificationState: 'requires-verification', detections: [{ status: 'pending' }] } }), false);
    assert.equal(canApproveRadiographSummary({ analysis: { verificationState: 'verified', detections: [{ status: 'confirmed' }, { status: 'ignored' }] } }), true);
    assert.equal(canApproveRadiographSummary({ analysis: { verificationState: 'requires-verification', detections: [] }, manualReview: { reviewedAt: new Date(), reviewedBy: 'd1' } }), true);
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
    assert.match(serverSource, /excludeAppointmentId/);
    assert.match(serverSource, /patient: req\.user\.id/);
    assert.match(serverSource, /Cancelled by patient\./);
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

    const genericUpdateRoute = serverSource.slice(serverSource.indexOf("app.put('/api/user/:id'"), serverSource.indexOf("app.put('/api/user/update-profile/:id'"));
    assert.match(genericUpdateRoute, /Patient accounts cannot be updated through the generic account route/);
    assert.match(genericUpdateRoute, /canManageStaffLifecycle/);
    assert.match(genericUpdateRoute, /getDisallowedStaffAccountUpdateFields/);
    assert.match(genericUpdateRoute, /pickAllowedStaffAccountUpdateFields/);
    assert.match(genericUpdateRoute, /sanitizeUserForActor\(updatedUser, req\.user\)/);
    assert.doesNotMatch(serverSource, /\.select\(['"]-password['"]\)/);
    assert.doesNotMatch(serverSource, /res\.json\(updatedUser\)|res\.json\(\{[^\n]*, user \}\)|res\.json\(\{[^\n]*, patient \}\)/);
    assert.doesNotMatch(serverSource, /Activation link: \$\{activationLink\}/);

    const profileUpdateRoute = serverSource.slice(serverSource.indexOf("app.put('/api/user/update-profile/:id'"), serverSource.indexOf("app.post('/api/user/request-email-change'"));
    assert.match(profileUpdateRoute, /Clinical records cannot be changed through a profile route/);
    assert.match(profileUpdateRoute, /getRestrictedClinicalUpdateFields\(req\.body\)/);
});

test('web and mobile patient labels use the thesis terminology with plain-language helpers', () => {
    const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', '..', ...parts), 'utf8');
    const webRecords = read('ngitify-web', 'src', 'pages', 'patient', 'PatientMedicalRecords.js');
    const mobileRecords = read('ngitify-mobile', 'src', 'screens', 'patient', 'MedicalRecordsScreen.js');
    const mobileDashboard = read('ngitify-mobile', 'src', 'screens', 'patient', 'PatientDashboard.js');
    const webNgitiBot = read('ngitify-web', 'src', 'pages', 'patient', 'PatientAiCompanion.js');
    const mobileNgitiBot = read('ngitify-mobile', 'src', 'screens', 'patient', 'AIPatientCareCompanionScreen.js');

    assert.match(webRecords, /Electronic Medical Record \(EMR\)/);
    assert.match(webRecords, /Odontogram · Your tooth chart/);
    assert.match(webRecords, /Radiograph Images · Your dental X-rays/);
    assert.match(webRecords, /Medical and Dental History/);
    assert.match(mobileRecords, /label: 'Radiograph Images'/);
    assert.match(mobileDashboard, /Electronic Medical Record/);
    for (const source of [webNgitiBot, mobileNgitiBot]) {
        assert.match(source, /NgitiBot/);
        assert.doesNotMatch(source, /AI Care Companion|NgitiFy AI|Care Companion/);
    }
});
