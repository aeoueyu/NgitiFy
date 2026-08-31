const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const addStaffForms = [
    'AddDentist.js',
    'AddSecretary.js',
    'AddBranchManager.js',
    'AddOwner.js',
];

const readForm = (fileName) => fs.readFileSync(
    path.join(repositoryRoot, 'ngitify-web', 'src', 'pages', 'admin', fileName),
    'utf8'
);

test('add-staff forms reveal validation only after interaction or submit', () => {
    for (const fileName of addStaffForms) {
        const source = readForm(fileName);

        assert.match(source, /const touchedFieldsRef = useRef\(\{\}\)/, fileName);
        assert.match(source, /const hasSubmittedRef = useRef\(false\)/, fileName);
        assert.match(source, /revealAll \|\| touchedFieldsRef\.current\[key\]/, fileName);
        assert.match(source, /onFocusCapture=\{handleFormFocusCapture\}/, fileName);
        assert.match(source, /onBlurCapture=\{handleFormBlurCapture\}/, fileName);
        assert.match(source, /hasSubmittedRef\.current = true/, fileName);
        assert.match(source, /syncFormErrors\(\{ revealAll: true \}\)/, fileName);
    }
});

test('add-staff live validation keeps non-validation and duplicate-email errors intact', () => {
    for (const fileName of addStaffForms) {
        const source = readForm(fileName);

        assert.match(source, /NON_VALIDATION_ERROR_KEYS\.includes\(key\)/, fileName);
        assert.match(source, /key === 'email' && hasDuplicateEmailError\(value\)/, fileName);
    }
});
