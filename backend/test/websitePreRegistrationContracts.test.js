const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

const extractRoute = (startMarker, endMarker) => {
    const start = serverSource.indexOf(startMarker);
    const end = serverSource.indexOf(endMarker, start + startMarker.length);
    assert.notEqual(start, -1, `Missing route marker: ${startMarker}`);
    assert.notEqual(end, -1, `Missing route end marker: ${endMarker}`);
    return serverSource.slice(start, end);
};

test('new website guests receive a pre-registration link as soon as the request is saved', () => {
    const route = extractRoute(
        "app.post('/api/public/appointments/request'",
        '// APPOINTMENT BOOKING REQUEST (from patient mobile app)'
    );

    assert.match(route, /if \(!matchedPatient\) \{\s*Object\.assign\(newSurgery, buildGuestPreRegistrationFields\(\)\);/);
    assert.match(route, /await sendPreRegistrationEmail\(\{[\s\S]*token: newSurgery\.preRegistrationToken,[\s\S]*status: newSurgery\.status/);
    assert.match(route, /preRegistrationEmailSent: !matchedPatient/);
    assert.match(route, /bookingDevice,/);
});

test('mobile website booking context is returned only after pre-registration and initial password setup', () => {
    assert.match(serverSource, /bookingDevice: 'mobile',[\s\S]*preRegistrationCompleted: true/);
    assert.match(serverSource, /shouldSuggestMobileAppAfterActivation\(account, requiresPasswordSetup\)/);
    assert.match(serverSource, /suggestMobileApp,/);
});

test('pending website pre-registration creates and links the inactive patient account', () => {
    const route = extractRoute(
        "app.post('/api/pre-register/:token'",
        "app.post(['/api/admin/appointments"
    );

    assert.match(route, /provisionGuestPatientAccountForAppointment\(\{/);
    assert.match(route, /surgery\.patient = linkedPatient\._id/);
    assert.match(route, /await sendPatientActivationLink\(linkedPatient/);
});

test('appointment confirmation does not duplicate an already-active pre-registration link', () => {
    const route = extractRoute(
        "app.put(['/api/surgeries/:id/status', '/api/appointments/:id/status']",
        "app.get('/api/pre-register/:token'"
    );

    assert.match(route, /const hadActivePreRegistrationLink = isPreRegistrationTokenStillActive\(currentSurgery\)/);
    assert.match(route, /guestProvisioning\.requiresPreRegistration && updatedSurgery\.preRegistrationToken && !hadActivePreRegistrationLink/);
});
