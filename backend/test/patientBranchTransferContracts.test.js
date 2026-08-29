const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const readFile = (relativePath) => fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');

const extractRoute = (source, marker) => {
    const start = source.indexOf(marker);
    assert.notEqual(start, -1, `Missing route: ${marker}`);
    const end = source.indexOf('\napp.', start + marker.length);
    return source.slice(start, end === -1 ? undefined : end);
};

test('inactive patient accounts are blocked by both branch transfer endpoints', () => {
    const server = readFile('backend/server.js');

    assert.match(server, /const isPatientAccountActive = \(patient\)/);
    assert.match(server, /status assignedBranch assignedBranches/);
    for (const marker of [
        "app.get('/api/patients/:id/branch-transfer-preview'",
        "app.put('/api/patients/:id/transfer-branch'",
    ]) {
        const route = extractRoute(server, marker);
        assert.match(route, /if \(!isPatientAccountActive\(patient\)\)/);
        assert.match(route, /INACTIVE_PATIENT_TRANSFER_MESSAGE/);
        assert.match(route, /res\.status\(409\)/);
    }
});

test('staff UI disables branch transfer for inactive patients', () => {
    const managePatients = readFile('ngitify-web/src/pages/admin/ManagePatients.js');

    assert.match(managePatients, /const isBranchTransferDisabled = statusKey !== 'active'/);
    assert.match(managePatients, /disabled=\{isBranchTransferDisabled\}/);
    assert.match(managePatients, /Activate account before transferring branches/);
    assert.match(managePatients, /getPatientLifecycleKey\(patient\) !== 'active'/);
});

test('old-branch EMR access explains that the patient was transferred', () => {
    const server = readFile('backend/server.js');
    const patientEmr = readFile('ngitify-web/src/pages/admin/PatientEMR.js');
    const patientRoute = extractRoute(server, "app.get('/api/patients/:id'");

    assert.match(patientRoute, /PATIENT_TRANSFERRED_TO_ANOTHER_BRANCH/);
    assert.match(patientRoute, /PATIENT_TRANSFERRED_BRANCH_MESSAGE/);
    assert.match(server, /This patient has already been transferred to another branch/);
    assert.match(patientEmr, /setPatientLoadError\(message\)/);
    assert.match(patientEmr, /patientLoadError \|\| 'Patient record not found\.'/);
});
