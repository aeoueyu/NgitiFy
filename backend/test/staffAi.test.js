const test = require('node:test');
const assert = require('node:assert/strict');
const {
    STAFF_AI_ROLES,
    ROLE_WORKFLOWS,
    buildStaffSystemContext,
    getManilaDayRange,
    summarizeAppointments,
    summarizeInventory,
    summarizeRadiographRecords,
    wantsTodayAppointments,
    wantsOperationalContext,
} = require('../utils/staffAi');

test('staff AI permits only supported staff roles', () => {
    assert.deepEqual(STAFF_AI_ROLES, ['administrator', 'owner', 'branch-manager', 'dentist', 'secretary']);
    assert.equal(STAFF_AI_ROLES.includes('patient'), false);
    assert.equal(STAFF_AI_ROLES.includes('unknown'), false);
});

test('role workflows keep secretary away from clinical modules', () => {
    assert.equal(ROLE_WORKFLOWS.secretary.modules.includes('Dental Records'), false);
    assert.match(buildStaffSystemContext({ role: 'secretary' }).safetyRules[0], /clinical records/i);
});

test('branch context comes from the authenticated server scope', () => {
    const context = buildStaffSystemContext({ role: 'branch-manager', branch: 'Makati', currentModule: 'Reports' });
    assert.equal(context.assignedBranch, 'Makati');
    assert.match(context.permissions, /assigned branch/i);
});

test('appointment summary filters dates and counts statuses', () => {
    const result = summarizeAppointments([
        { date: '2026-08-20', status: 'confirmed' },
        { date: '2026-08-21', status: 'completed' },
        { date: '2026-07-01', status: 'cancelled' },
    ], { start: '2026-08-01', end: '2026-08-31T23:59:59Z' });
    assert.deepEqual(result, { total: 2, statusBreakdown: { confirmed: 1, completed: 1 } });
});

test('appointment summary supports empty results', () => {
    assert.deepEqual(summarizeAppointments([]), { total: 0, statusBreakdown: {} });
});

test('today appointment requests use the Manila clinic day', () => {
    const range = getManilaDayRange('2026-08-21T20:00:00.000Z');
    assert.equal(range.dateKey, '2026-08-22');
    assert.equal(range.start.toISOString(), '2026-08-21T16:00:00.000Z');
    assert.equal(range.end.toISOString(), '2026-08-22T15:59:59.999Z');
    assert.equal(wantsTodayAppointments([{ role: 'user', content: 'Summarize my schedule today' }]), true);
});

test('today appointment intent does not leak from older conversation messages', () => {
    assert.equal(wantsTodayAppointments([
        { role: 'user', content: 'What appointments do I have today?' },
        { role: 'assistant', content: 'You have no appointments today.' },
        { role: 'user', content: 'Show my complete appointment history instead.' },
    ]), false);
});

test('inventory summary reports only items at or below their threshold', () => {
    const result = summarizeInventory([
        { itemName: 'Gloves', quantity: 5, reorderLevel: 5, unit: 'box', branch: 'A' },
        { itemName: 'Masks', quantity: 20, reorderLevel: 5, unit: 'box', branch: 'A' },
    ]);
    assert.equal(result.totalItems, 2);
    assert.equal(result.lowStockCount, 1);
    assert.equal(result.lowStockItems[0].name, 'Gloves');
});

test('staff radiograph context includes verified dentist records but not pending AI suggestions', () => {
    const result = summarizeRadiographRecords([{ _id: 'r1', label: 'Panoramic', analysis: { verificationState: 'requires-verification', detections: [
        { predictedToothNumber: '47', status: 'pending' },
        { predictedToothNumber: '46', confirmedToothNumber: '46', status: 'confirmed' },
    ] }, annotations: [{ toothNumber: '46', findingType: 'Existing restoration' }] }]);
    assert.deepEqual(result.records[0].verifiedTeeth, ['46']);
    assert.equal(JSON.stringify(result).includes('47'), false);
});

test('operational context detection does not request unrelated datasets', () => {
    assert.deepEqual(wantsOperationalContext([{ content: 'How do I change my password?' }]), {
        appointments: false, inventory: false, patient: false,
    });
    assert.equal(wantsOperationalContext([{ content: 'Summarize the inventory report' }]).inventory, true);
});
