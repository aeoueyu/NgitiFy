const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const readFile = (relativePath) => fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');

test('male patient history hides pregnancy, nursing, and birth-control fields across record views', () => {
    const staffEmr = readFile('ngitify-web/src/pages/admin/PatientEMR.js');
    const patientSummary = readFile('ngitify-web/src/pages/admin/ViewPatient.js');
    const mobileRecords = readFile('ngitify-mobile/src/screens/patient/MedicalRecordsScreen.js');

    assert.match(staffEmr, /isMalePatient = String\(patient\?\.gender \|\| patient\?\.sex/);
    assert.match(staffEmr, /!isMalePatient && \([\s\S]*Are You Pregnant\?[\s\S]*Are You Nursing\?[\s\S]*Are You Taking Birth Control Pills\?/);
    assert.match(patientSummary, /!isMalePatient && \([\s\S]*Pregnant\?[\s\S]*Nursing\?[\s\S]*Taking Birth Control Pills\?/);
    assert.match(mobileRecords, /!isMalePatient && \([\s\S]*Are You Pregnant\?[\s\S]*Are You Nursing\?[\s\S]*Taking Birth Control Pills\?/);
});

test('male patient EMR editing does not require or submit hidden pregnancy fields', () => {
    const staffEmr = readFile('ngitify-web/src/pages/admin/PatientEMR.js');

    assert.match(staffEmr, /!isMalePatient \? \['isPregnant', 'isNursing', 'takingBirthControl'\] : \[\]/);
    assert.match(staffEmr, /!isMalePatient \? \{[\s\S]*isPregnant:[\s\S]*isNursing:[\s\S]*takingBirthControl:[\s\S]*\} : \{\}/);
});
