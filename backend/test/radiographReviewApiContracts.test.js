const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildPatientAiRadiographContext } = require('../utils/patientAi');

const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

test('radiograph review mutation endpoints are authenticated and dentist scoped', () => {
    for (const route of ['/analyze', '/detections/:detectionId', '/annotations', '/generate-summary', '/approve-summary']) {
        assert.ok(serverSource.includes(route));
    }
    assert.match(serverSource, /const requireDentistRadiograph/);
    assert.match(serverSource, /req\.user\.role !== 'dentist'/);
    assert.match(serverSource, /dentistCanAccessPatient\(req\.user\.id, patient\._id\)/);
});

test('patient radiograph serialization omits raw analysis and unapproved summary drafts', () => {
    const serializer = serverSource.slice(serverSource.indexOf('const buildPatientRadiographPayload'), serverSource.indexOf('const buildNonInterpretiveRadiographPayload'));
    assert.doesNotMatch(serializer, /analysis:/);
    assert.match(serializer, /status === 'approved'/);
    assert.doesNotMatch(serializer, /draft:/);
});

test('patient AI receives only approved radiograph records', () => {
    const records = buildPatientAiRadiographContext([
        { _id: 'approved', label: 'Panoramic', reviewSummary: { status: 'approved', approvedText: 'Dentist approved.' }, annotations: [{ toothNumber: '46', findingType: 'Existing restoration' }] },
        { _id: 'draft', label: 'Periapical', reviewSummary: { status: 'draft', draft: 'Not approved.' }, analysis: { detections: [{ predictedToothNumber: '47' }] } },
    ]);
    assert.equal(records.length, 1);
    assert.equal(records[0].approvedSummary, 'Dentist approved.');
    assert.equal(JSON.stringify(records).includes('predictedToothNumber'), false);
});

test('evaluation export uses pseudonymous ids and excludes direct patient identifiers', () => {
    const evaluationRoute = serverSource.slice(serverSource.indexOf("app.get('/api/radiograph-review/evaluation'"), serverSource.indexOf("const createStaffAiRouter", serverSource.indexOf("app.get('/api/radiograph-review/evaluation'")));
    assert.match(evaluationRoute, /createHmac\('sha256'/);
    assert.doesNotMatch(evaluationRoute, /patient\.name|patient\.email|contactNumber|address/);
});
