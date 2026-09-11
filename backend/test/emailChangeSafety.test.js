const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');
const serverSource = fs.readFileSync(path.join(backendRoot, 'server.js'), 'utf8');
const userModelSource = fs.readFileSync(path.join(backendRoot, 'models', 'User.js'), 'utf8');
const accessSource = fs.readFileSync(path.join(backendRoot, 'utils', 'healthcareAccess.js'), 'utf8');

const routeSource = (startMarker, endMarker) => {
    const start = serverSource.indexOf(startMarker);
    assert.notEqual(start, -1, `Missing route marker: ${startMarker}`);
    const end = serverSource.indexOf(endMarker, start);
    assert.notEqual(end, -1, `Missing route end marker: ${endMarker}`);
    return serverSource.slice(start, end);
};

test('email change requests keep the current login identity and account state intact', () => {
    const source = routeSource(
        "app.post('/api/user/request-email-change'",
        "app.post('/api/verify-current-password'"
    );

    assert.match(source, /user\.pendingEmail = normalizedNewEmail/);
    assert.doesNotMatch(source, /user\.email = normalizedNewEmail/);
    assert.doesNotMatch(source, /user\.status = ['"]inactive['"]/);
    assert.doesNotMatch(source, /user\.isVerified = false/);
});

test('provider rejection rolls back the pending request and returns a gateway error', () => {
    const source = routeSource(
        "app.post('/api/user/request-email-change'",
        "app.post('/api/verify-current-password'"
    );

    assert.match(source, /await sendActivationEmail/);
    assert.match(source, /\$unset:\s*{[\s\S]*pendingEmail:/);
    assert.match(source, /res\.status\(502\)/);
    assert.match(serverSource, /result\?\.error \|\| !result\?\.data\?\.id/);
});

test('verification atomically promotes pending email without reactivating the account', () => {
    const source = routeSource(
        "app.post('/api/activate-account'",
        'const getFrontendBaseUrl'
    );

    const emailChangeBranch = source.slice(source.indexOf('if (isEmailChange)'));
    assert.match(emailChangeBranch, /account\.email = pendingEmail/);
    assert.match(emailChangeBranch, /account\.pendingEmail = undefined/);
    assert.match(emailChangeBranch, /account\.lastEmailChangeRequestedAt = new Date\(\)/);
    assert.doesNotMatch(
        emailChangeBranch.slice(0, emailChangeBranch.indexOf('const requiresPasswordSetup')),
        /account\.status = ['"]active['"]|account\.isVerified = true/
    );
});

test('pending email is reserved and verification secrets are never serialized', () => {
    assert.match(userModelSource, /userSchema\.index\(\{ pendingEmail: 1 \}, \{ unique: true, sparse: true \}\)/);
    assert.match(accessSource, /'pendingEmailChangeToken'/);
    assert.match(accessSource, /'pendingEmailChangeTokenExpires'/);
    assert.match(accessSource, /'pendingEmailMessageId'/);
});

test('authenticated resend and cancel routes and signed delivery webhook are present', () => {
    assert.match(serverSource, /app\.post\('\/api\/user\/resend-email-change', verifyToken, otpLimiter/);
    assert.match(serverSource, /app\.delete\('\/api\/user\/pending-email-change', verifyToken/);
    assert.match(serverSource, /resend\.webhooks\.verify/);
    assert.match(serverSource, /RESEND_WEBHOOK_SECRET/);
    assert.match(serverSource, /'email\.delivered': 'delivered'/);
});

test('authenticated users can manage email changes for their own account regardless of role', () => {
    const requestSource = routeSource(
        "app.post('/api/user/request-email-change'",
        "app.post('/api/verify-current-password'"
    );
    const resendSource = routeSource(
        "app.post('/api/user/resend-email-change'",
        "app.delete('/api/user/pending-email-change'"
    );
    const cancelSource = routeSource(
        "app.delete('/api/user/pending-email-change'",
        "app.patch('/api/patients/:id/treatment-logs/:logId/notes'"
    );

    for (const source of [requestSource, resendSource, cancelSource]) {
        assert.match(source, /User\.findById\(req\.user\.id\)/);
        assert.doesNotMatch(source, /req\.user\.role !== ['"]administrator['"]/);
        assert.doesNotMatch(source, /Only administrators can/);
    }
});

test('all web roles share the profile email-change controls', () => {
    const appSource = fs.readFileSync(path.resolve(backendRoot, '..', 'ngitify-web', 'src', 'App.js'), 'utf8');
    const sharedProfileSource = fs.readFileSync(path.resolve(backendRoot, '..', 'ngitify-web', 'src', 'pages', 'admin', 'AdminProfile.js'), 'utf8');
    const patientProfileSource = fs.readFileSync(path.resolve(backendRoot, '..', 'ngitify-web', 'src', 'pages', 'patient', 'PatientProfile.js'), 'utf8');

    for (const role of ['admin', 'owner', 'branch-manager', 'dentist', 'secretary']) {
        assert.match(appSource, new RegExp(`path="/${role}/profile"[\\s\\S]{0,80}element={<AdminProfile`));
    }
    assert.match(appSource, /path="\/patient\/profile" element={<ProfilePage/);
    assert.match(patientProfileSource, /export \{ default \} from '\.\.\/admin\/AdminProfile'/);
    assert.match(sharedProfileSource, /handlePendingEmailAction\('resend'\)/);
    assert.match(sharedProfileSource, /handlePendingEmailAction\('cancel'\)/);
});
