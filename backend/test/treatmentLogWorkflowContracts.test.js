const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const readRepositoryFile = (relativePath) => fs.readFileSync(
    path.join(__dirname, '..', '..', relativePath),
    'utf8'
);

test('appointment completion durably carries the next appointment into automatic treatment logs', () => {
    const appointmentModel = readRepositoryFile('backend/models/Appointment.js');
    const serverSource = readRepositoryFile('backend/server.js');

    assert.match(appointmentModel, /nextAppointment: \{ type: Date, default: null \}/);
    assert.match(serverSource, /updateFields\.nextAppointment = normalizedNextAppointment/);
    assert.match(serverSource, /nextAppointment: appointment\.nextAppointment \|\| null/);
    assert.match(serverSource, /nextAppointment: normalizedNextAppointment/);
});

test('dentists and owner-dentists can update only their own treatment-log notes', () => {
    const serverSource = readRepositoryFile('backend/server.js');
    const routeStart = serverSource.indexOf("app.patch('/api/patients/:id/treatment-logs/:logId/notes'");
    const routeEnd = serverSource.indexOf('\napp.', routeStart + 1);
    const route = serverSource.slice(routeStart, routeEnd);

    assert.notEqual(routeStart, -1);
    assert.match(route, /hasDentistClinicalAccess\(req\.user\)/);
    assert.match(route, /dentistCanAddTreatmentLogForPatient\(req\.user\.id, patient\._id\)/);
    assert.match(route, /isSameId\(treatmentLog\.dentistId, req\.user\.id\)/);
    assert.match(route, /UPDATE_TREATMENT_NOTES/);
});

test('staff and patient interfaces expose notes editing and next-appointment details', () => {
    const staffEmr = readRepositoryFile('ngitify-web/src/pages/admin/PatientEMR.js');
    const patientWebEmr = readRepositoryFile('ngitify-web/src/pages/patient/PatientMedicalRecords.js');
    const patientMobileEmr = readRepositoryFile('ngitify-mobile/src/screens/patient/MedicalRecordsScreen.js');

    assert.match(staffEmr, /Add Notes/);
    assert.match(staffEmr, /Save Notes/);
    assert.match(staffEmr, /treatment-logs\/\$\{notesLogTarget\.id\}\/notes/);
    assert.match(patientWebEmr, /Next appointment:/);
    assert.match(patientMobileEmr, /Next appointment:/);
});
