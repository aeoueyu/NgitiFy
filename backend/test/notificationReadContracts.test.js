const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const Notification = require('../models/Notification');

const repositoryRoot = path.resolve(__dirname, '..', '..');
const readFile = (relativePath) => fs.readFileSync(
    path.join(repositoryRoot, relativePath),
    'utf8'
);

test('role-wide notifications store read state per user', () => {
    const readBy = Notification.schema.path('readBy');

    assert.ok(readBy, 'Notification.readBy must exist');
    assert.equal(readBy.instance, 'Array');
    assert.equal(readBy.getEmbeddedSchemaType().instance, 'ObjectId');
});

test('staff notification audience does not leak direct alerts to role peers', () => {
    const server = readFile('backend/server.js');

    assert.match(server, /\{ recipientId: user\.id \}/);
    assert.match(server, /\{ recipientRole: normalizedRole, recipientId: null \}/);
    assert.match(server, /notificationHasDirectRecipient/);
    assert.match(server, /serializeNotificationForUser/);
    assert.match(server, /\$addToSet: \{ readBy: req\.user\.id \}/);
});

test('web and mobile notification actions persist read state', () => {
    const sharedWeb = readFile('ngitify-web/src/components/shared/NotificationsCenter.js');
    const mobile = readFile('ngitify-mobile/src/screens/patient/NotificationsScreen.js');

    assert.match(sharedWeb, /openNotification[\s\S]*markAsRead\(notification\._id\)/);
    assert.match(sharedWeb, /notifications\/read-all/);
    assert.match(sharedWeb, /ngitify-notifications-updated/);
    assert.match(mobile, /notifications\/\$\{item\._id\}\/read/);
    assert.match(mobile, /if \(!response\.ok\)/);
    assert.match(mobile, /notifications\/read-all/);
});
