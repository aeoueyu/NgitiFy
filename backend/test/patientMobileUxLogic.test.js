const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { classifyPatientAppointments, getInitialPastVisits } = require(path.join('..', '..', 'ngitify-mobile', 'src', 'utils', 'patientVisitHistory'));
const { buildTrendChartData, buildFrequencyRows, getRecentCheckIns } = require(path.join('..', '..', 'ngitify-mobile', 'src', 'utils', 'oralCareTrends'));

test('appointments are classified and history is newest first', () => {
    const result = classifyPatientAppointments([
        { id: 'old', status: 'completed', date: '2026-01-01' },
        { id: 'new', status: 'cancelled', date: '2026-08-20' },
        { id: 'next', status: 'confirmed', date: '2026-08-30' },
    ]);
    assert.deepEqual(result.past.map((item) => item.id), ['new', 'old']);
    assert.deepEqual(result.upcoming.map((item) => item.id), ['next']);
});

test('initial past visit list is limited without losing full-history source', () => {
    const appointments = Array.from({ length: 10 }, (_, index) => ({ status: 'completed', date: `2026-08-${String(index + 1).padStart(2, '0')}` }));
    assert.equal(getInitialPastVisits(appointments).length, 4);
    assert.equal(classifyPatientAppointments(appointments).past.length, 10);
});

test('trend chart transformation covers 7 and 30 day windows', () => {
    const now = new Date('2026-08-21T12:00:00Z');
    const logs = [
        { logDateKey: '2026-08-20', dailyCare: ['am', 'pm'], symptoms: ['no-symptoms'] },
        { logDateKey: '2026-08-10', dailyCare: ['am'], symptoms: ['sensitivity'], riskFactors: ['sugar'] },
    ];
    assert.equal(buildTrendChartData(logs, 7, now).length, 1);
    assert.equal(buildTrendChartData(logs, 30, now).length, 2);
});

test('trend chart handles no logs, a single log, and missing optional fields', () => {
    const now = new Date('2026-08-21T12:00:00Z');
    assert.deepEqual(buildTrendChartData([], 7, now), []);
    assert.deepEqual(buildTrendChartData([{ logDateKey: '2026-08-21' }], 7, now)[0], {
        date: '2026-08-21', dailyCareCount: 0, symptomCount: 0, riskFactorCount: 0,
    });
});

test('frequency graph values use actual unique log counts', () => {
    const rows = buildFrequencyRows({ logs: [{ dailyCare: ['am', 'am'] }, { dailyCare: ['am', 'pm'] }], field: 'dailyCare', labels: { am: 'Morning', pm: 'Evening' } });
    assert.deepEqual(rows, [{ id: 'am', label: 'Morning', count: 2 }, { id: 'pm', label: 'Evening', count: 1 }]);
});

test('recent check-ins are newest first and initially limited to three', () => {
    const logs = ['01', '05', '03', '04'].map((day) => ({ logDateKey: `2026-08-${day}` }));
    assert.deepEqual(getRecentCheckIns(logs).map((log) => log.logDateKey), ['2026-08-05', '2026-08-04', '2026-08-03']);
});

test('mobile Records exposes the four required read-only EMR tabs in order', () => {
    const fs = require('node:fs');
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'ngitify-mobile', 'src', 'screens', 'patient', 'MedicalRecordsScreen.js'), 'utf8');
    const tabBlock = source.slice(source.indexOf('const TABS = ['), source.indexOf('];', source.indexOf('const TABS = [')) + 2);

    assert.ok(tabBlock.indexOf("label: 'Medical & Dental History'") < tabBlock.indexOf("label: 'Treatment History'"));
    assert.ok(tabBlock.indexOf("label: 'Treatment History'") < tabBlock.indexOf("label: 'Odontogram'"));
    assert.ok(tabBlock.indexOf("label: 'Odontogram'") < tabBlock.indexOf("label: 'Radiograph Images'"));
    assert.match(source, /: 'medical';/);
    assert.match(source, /\/api\/my\/treatment-logs/);
    assert.match(source, /logs\.slice\(0, 4\)/);
    assert.match(source, /<FlatList/);
    assert.match(source, /Need to correct something\? Please contact the clinic\./);
});

test('patient profile editors do not submit or render protected clinical history', () => {
    const fs = require('node:fs');
    const webSource = fs.readFileSync(path.join(__dirname, '..', '..', 'ngitify-web', 'src', 'pages', 'patient', 'PatientEditProfile.js'), 'utf8');
    const mobileSource = fs.readFileSync(path.join(__dirname, '..', '..', 'ngitify-mobile', 'src', 'screens', 'shared', 'EditProfileScreen.js'), 'utf8');

    for (const source of [webSource, mobileSource]) {
        assert.doesNotMatch(source, /medicalHistory\s*:/);
        assert.doesNotMatch(source, /dentalHistory\s*:/);
        assert.doesNotMatch(source, /bloodType\s*:/);
    }
});
