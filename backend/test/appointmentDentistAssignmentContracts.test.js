const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const readFile = (relativePath) => fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');

const extractRoute = (source, marker) => {
    const start = source.indexOf(marker);
    assert.notEqual(start, -1, `Expected route marker: ${marker}`);
    const nextRoute = source.indexOf('\napp.', start + marker.length);
    return nextRoute === -1 ? source.slice(start) : source.slice(start, nextRoute);
};

test('patient mobile bookings use the patient current dentist and ignore client dentist ids', () => {
    const serverSource = readFile('backend/server.js');
    const route = extractRoute(serverSource, "app.post('/api/appointments/request'");

    assert.match(route, /assignedDentistId/);
    assert.match(route, /resolveAssignableDentist\(patientUser\.assignedDentistId, resolvedBranch\)/);
    assert.match(route, /dentist:\s*defaultDentist\?\._id\s*\|\|\s*null/);
    assert.doesNotMatch(route, /req\.body\.dentistId/);
});

test('confirmation and check-in require a dentist assignment', () => {
    const serverSource = readFile('backend/server.js');
    const route = extractRoute(serverSource, "app.put(['/api/surgeries/:id/status', '/api/appointments/:id/status']");

    assert.match(route, /\['confirmed', 'in-clinic'\]\.includes\(status\)/);
    assert.match(route, /DENTIST_ASSIGNMENT_REQUIRED/);
    assert.match(route, /resolveAssignableDentist\(dentistId, currentSurgery\.branch\)/);
});

test('schedule shortcuts open dentist reassignment instead of advancing an unassigned appointment', () => {
    const scheduleSource = readFile('ngitify-web/src/pages/shared/SchedulePage.js');

    assert.match(scheduleSource, /const requestQuickStatusUpdate = \(entry, status\) =>/);
    assert.match(scheduleSource, /openEditModal\(entry, 'reassign'\)/);
    assert.match(scheduleSource, /requestQuickStatusUpdate\(entry, 'confirmed'\)/);
    assert.match(scheduleSource, /requestQuickStatusUpdate\(entry, 'in-clinic'\)/);
});

test('staff reassignment synchronizes the patient dentist used by directory and clinical access', () => {
    const serverSource = readFile('backend/server.js');
    const updateRoute = extractRoute(serverSource, "app.put(['/api/surgeries/:id', '/api/appointments/:id']");

    assert.match(updateRoute, /syncPatientAssignedDentist/);
    assert.match(serverSource, /assignedDentistId:\s*dentist\._id/);
    assert.match(serverSource, /assignedDentistName:\s*getDentistAssignmentName\(dentist\)/);
    assert.match(serverSource, /dentistCanAccessPatient/);
});
