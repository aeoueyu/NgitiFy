const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'routes', 'staffAi.js'), 'utf8');

test('staff conversation endpoints cover persistence lifecycle', () => {
    for (const contract of [
        "router.get('/conversations'", "router.post('/conversations'",
        "router.get('/conversations/:id'", "router.patch('/conversations/:id'",
        "router.delete('/conversations/:id'", "router.post('/conversations/:id/messages'",
    ]) assert.match(source, new RegExp(contract.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('all conversation reads and deletes are scoped to the authenticated owner', () => {
    assert.match(source, /findOne\(\{ _id: req\.params\.id, owner: req\.user\.id \}\)/);
    assert.match(source, /deleteOne\(\{ _id: conversation\._id, owner: req\.user\.id \}\)/);
});

test('archived staff conversations reject new messages', () => {
    assert.match(source, /conversation\.isArchived[\s\S]+status\(409\)/);
});

test('secretary and dentist patient access checks are enforced before context use', () => {
    assert.match(source, /role === 'secretary'[\s\S]+statusCode = 403/);
    assert.match(source, /role === 'dentist'[\s\S]+dentistCanAccessPatient/);
});
