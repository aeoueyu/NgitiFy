const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const readFile = (relativePath) => fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');

test('owner-dentists receive one owner sidebar with a My Patient destination', () => {
    const sidebar = readFile('ngitify-web/src/components/sidebar/Sidebar.js');
    const app = readFile('ngitify-web/src/App.js');

    assert.match(sidebar, /navItem\('\/owner\/my-patients',[\s\S]*'My Patient'\)/);
    assert.match(sidebar, /isDentistUser && !isOwner/);
    assert.match(app, /path="\/owner\/my-patients"[\s\S]*patientScope="my-patients"/);
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

test('owner-dentists can open My Patient records with treatment-log controls', () => {
    const directory = readFile('ngitify-web/src/pages/shared/PatientEMRPage.js');

    assert.match(directory, /user\?\.role === 'owner' && user\?\.isDentist === true/);
    assert.match(directory, /scope=my-patients/);
    assert.match(directory, /forceReadOnly=\{emrMode === 'view'\}/);
});
