const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { hasDentistClinicalAccess } = require('../utils/healthcareAccess');

const integritySource = fs.readFileSync(
    path.join(__dirname, '..', 'routes', 'integrity.js'),
    'utf8'
);

test('integrity assigned-dentist scan recognizes qualified owner-dentists', () => {
    assert.equal(hasDentistClinicalAccess({ role: 'dentist' }), true);
    assert.equal(hasDentistClinicalAccess({ role: 'owner', isDentist: true }), true);
    assert.equal(hasDentistClinicalAccess({ role: 'owner', isDentist: false }), false);

    const analyzerStart = integritySource.indexOf('const analyzeAssignedDentist');
    const analyzerEnd = integritySource.indexOf('const analyzeInventoryBatch', analyzerStart);
    const analyzer = integritySource.slice(analyzerStart, analyzerEnd);

    assert.match(analyzer, /!hasDentistClinicalAccess\(dentist\)/);
    assert.doesNotMatch(analyzer, /dentist\.role !== 'dentist'/);
});

test('integrity scan loads owner dentist qualification before offering auto-fix', () => {
    const scanStart = integritySource.indexOf('async function scanAssignedDentistMismatches');
    const scanEnd = integritySource.indexOf('async function collectAssignedDentistMismatches', scanStart);
    const scan = integritySource.slice(scanStart, scanEnd);

    assert.match(scan, /\.select\('_id name email role isDentist status isArchived'\)/);
});
