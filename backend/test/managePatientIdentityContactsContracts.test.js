const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const readFile = (relativePath) => fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');

test('Manage Patients edit modal exposes only identity and contact steps', () => {
    const editPatient = readFile('ngitify-web/src/pages/admin/EditPatient.js');
    const stepsStart = editPatient.indexOf('const EDIT_PATIENT_STEPS');
    const stepsEnd = editPatient.indexOf('const EDIT_PATIENT_SECTION_FIELDS', stepsStart);
    const steps = editPatient.slice(stepsStart, stepsEnd);

    assert.match(steps, /key: 'identity'/);
    assert.match(steps, /key: 'contacts'/);
    assert.doesNotMatch(steps, /key: 'medical'/);
    assert.doesNotMatch(steps, /key: 'consent'/);
    assert.match(editPatient, /type="submit"[\s\S]*Update Patient/);
});

test('Manage Patients edit request omits clinical and consent fields', () => {
    const editPatient = readFile('ngitify-web/src/pages/admin/EditPatient.js');
    const payloadStart = editPatient.indexOf('const finalData = {');
    const requestStart = editPatient.indexOf('const response = await authFetch', payloadStart);
    const payload = editPatient.slice(payloadStart, requestStart);

    assert.doesNotMatch(payload, /medicalHistory\s*:/);
    assert.doesNotMatch(payload, /dentalHistory\s*:/);
    assert.doesNotMatch(payload, /physician\s*:/);
    assert.doesNotMatch(payload, /consentAcknowledgement\s*:/);
    assert.doesNotMatch(payload, /dataPrivacyConsent\s*:/);
    assert.doesNotMatch(payload, /reasonForConsultation\s*:/);
    assert.doesNotMatch(payload, /referredBy\s*:/);
});

test('Secretary patient edit remains limited to identity and contacts', () => {
    const secretaryEdit = readFile('ngitify-web/src/pages/secretary/SecretaryEditPatient.js');
    const stepsStart = secretaryEdit.indexOf('const SECRETARY_PATIENT_STEPS');
    const stepsEnd = secretaryEdit.indexOf('const SECRETARY_PATIENT_SECTION_FIELDS', stepsStart);
    const steps = secretaryEdit.slice(stepsStart, stepsEnd);
    const payloadStart = secretaryEdit.indexOf('const payload = {');
    const requestStart = secretaryEdit.indexOf('const res = await authFetch', payloadStart);
    const payload = secretaryEdit.slice(payloadStart, requestStart);

    assert.match(steps, /key: 'identity'/);
    assert.match(steps, /key: 'contacts'/);
    assert.doesNotMatch(steps, /key: 'medical'/);
    assert.doesNotMatch(steps, /key: 'consent'/);
    assert.doesNotMatch(payload, /medicalHistory\s*:/);
    assert.doesNotMatch(payload, /dentalHistory\s*:/);
    assert.doesNotMatch(payload, /dataPrivacyConsent\s*:/);
});
