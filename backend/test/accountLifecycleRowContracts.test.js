const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const managementPages = [
    'ManagePatients.js',
    'ManageOwners.js',
    'ManageBranchManagers.js',
    'ManageDentists.js',
    'ManageSecretaries.js',
];

test('all patient and staff tables mute non-active lifecycle rows', () => {
    for (const fileName of managementPages) {
        const source = fs.readFileSync(
            path.join(repositoryRoot, 'ngitify-web', 'src', 'pages', 'admin', fileName),
            'utf8'
        );

        assert.match(
            source,
            /\['inactive', 'needsActivation', 'archived'\]\.includes\(statusKey\) \? 0\.6 : 1/,
            `${fileName} must mute inactive, needs-activation, and archived rows`
        );
        assert.match(
            source,
            /backgroundColor: \['inactive', 'needsActivation', 'archived'\]\.includes\(statusKey\) \? '#f1f5f9' : undefined/,
            `${fileName} must apply the shared gray row background`
        );
    }
});
