const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const readFile = (relativePath) => fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');

test('owner-dentists receive one owner sidebar with a My Patient destination', () => {
    const sidebar = readFile('ngitify-web/src/components/sidebar/Sidebar.js');
    const app = readFile('ngitify-web/src/App.js');

    assert.match(sidebar, /navItem\('\/owner\/my-patients',[\s\S]*'My Patients'\)/);
    assert.match(sidebar, /isDentistUser && !isOwner/);
    assert.match(app, /path="\/owner\/my-patients"[\s\S]*ManagePatients patientScope="my-patients" dentistExperience/);
});

test('My Patient is limited to directly assigned or completed-treatment patients', () => {
    const server = readFile('backend/server.js');
    const listRouteStart = server.indexOf("app.get('/api/patients'");
    const listRouteEnd = server.indexOf("app.post('/api/patients/duplicate-check'", listRouteStart);
    const listRoute = server.slice(listRouteStart, listRouteEnd);

    assert.match(listRoute, /patientScope === 'my-patients'/);
    assert.match(listRoute, /hasDentistClinicalAccess\(req\.user\)/);
    assert.match(listRoute, /assignedDentistId: req\.user\.id/);
    assert.match(listRoute, /status: 'completed'/);
});

test('regular dentist patient directory excludes unrelated and incomplete appointment patients', () => {
    const server = readFile('backend/server.js');
    const listRouteStart = server.indexOf("app.get('/api/patients'");
    const listRouteEnd = server.indexOf("app.post('/api/patients/duplicate-check'", listRouteStart);
    const listRoute = server.slice(listRouteStart, listRouteEnd);
    const regularDentistScope = listRoute.slice(listRoute.indexOf("req.user.role === 'dentist'"));

    assert.match(regularDentistScope, /assignedDentistId: req\.user\.id/);
    assert.match(regularDentistScope, /status: 'completed'/);
    assert.doesNotMatch(regularDentistScope, /assignedDentistName/);
});

test('dentist EMR access fallback requires a completed treatment', () => {
    const server = readFile('backend/server.js');
    const accessStart = server.indexOf('const dentistCanAccessPatient');
    const accessEnd = server.indexOf('const dentistCanAddTreatmentLogForPatient', accessStart);
    const accessHelper = server.slice(accessStart, accessEnd);

    assert.match(accessHelper, /assignedDentistId: dentistId/);
    assert.match(accessHelper, /status: 'completed'/);
});

test('owner-dentists reuse the dentist Manage Patients UI and EMR flow', () => {
    const app = readFile('ngitify-web/src/App.js');
    const directory = readFile('ngitify-web/src/pages/admin/ManagePatients.js');

    assert.match(app, /path="\/owner\/my-patients"[\s\S]*ManagePatients patientScope="my-patients" dentistExperience/);
    assert.match(app, /path="\/owner\/my-patients\/:patientId\/emr"[\s\S]*DentistPatientEMR/);
    assert.match(directory, /scope=\$\{encodeURIComponent\(patientScope\)\}/);
    assert.match(directory, /usesDentistExperience = isDentist \|\| dentistExperience/);
    assert.match(directory, /navigate\(`\/owner\/my-patients\/\$\{id\}\/emr`\)/);
});

test('owner-dentists reuse the dentist Schedule Management UI with a server-enforced personal scope', () => {
    const app = readFile('ngitify-web/src/App.js');
    const sidebar = readFile('ngitify-web/src/components/sidebar/Sidebar.js');
    const schedule = readFile('ngitify-web/src/pages/shared/SchedulePage.js');
    const server = readFile('backend/server.js');

    assert.match(sidebar, /navItem\('\/owner\/my-schedule',[\s\S]*'My Schedule'\)/);
    assert.match(app, /path="\/owner\/my-schedule"[\s\S]*SchedulePage scheduleScope="my-schedule" dentistExperience/);
    assert.match(schedule, /appointmentParams\.set\('scope', scheduleScope\)/);
    assert.match(schedule, /scope=my-patients/);
    assert.match(schedule, /canCreateSchedule = !isDentist/);
    assert.match(schedule, /\/owner\/my-patients\/\$\{patientId\}\/emr/);
    assert.match(server, /scheduleScope === 'my-schedule'[\s\S]*hasDentistClinicalAccess\(req\.user\)[\s\S]*query\.dentist = req\.user\.id/);
});
