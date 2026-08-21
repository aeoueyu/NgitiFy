const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', '..', ...parts), 'utf8');

test('mobile patient shell exposes a global accessible AI overlay launcher', () => {
    const source = read('ngitify-mobile', 'src', 'navigation', 'AppNavigator.js');
    assert.match(source, /accessibilityLabel="Open NgitiFy AI"/);
    assert.match(source, /<Modal visible=\{aiOpen\} transparent/);
    assert.match(source, /height: '92%'/);
});

test('mobile AI has an X close action and partial history drawer', () => {
    const source = read('ngitify-mobile', 'src', 'screens', 'patient', 'AIPatientCareCompanionScreen.js');
    assert.match(source, /accessibilityLabel="Close AI chat"/);
    assert.match(source, /name="close"/);
    assert.match(source, /width: '82%'/);
    assert.match(source, /style=\{styles\.historyBackdrop\}/);
});

test('mobile patient dashboard no longer presents AI as a Care Tools destination', () => {
    const source = read('ngitify-mobile', 'src', 'screens', 'patient', 'PatientDashboard.js');
    assert.doesNotMatch(source, /label="AI Companion"/);
    assert.match(source, /label="Electronic Medical Record"/);
});

test('web staff AI supports history lifecycle and accessible close', () => {
    const source = read('ngitify-web', 'src', 'components', 'common', 'AIChatAssistant.js');
    for (const text of ['New chat', 'Pinned', 'Archived', 'Rename conversation', 'Delete conversation', 'Close AI assistant']) {
        assert.match(source, new RegExp(text));
    }
});
