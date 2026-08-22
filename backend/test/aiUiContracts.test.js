const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (...parts) => fs.readFileSync(path.join(__dirname, '..', '..', ...parts), 'utf8');

test('mobile patient shell exposes a global accessible AI overlay launcher', () => {
    const source = read('ngitify-mobile', 'src', 'navigation', 'AppNavigator.js');
    assert.match(source, /accessibilityLabel="Open NgitiBot"/);
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

test('web staff NgitiBot reuses the patient floating shell and conversation styles', () => {
    const source = read('ngitify-web', 'src', 'components', 'common', 'AIChatAssistant.js');
    const sharedShell = read('ngitify-web', 'src', 'components', 'common', 'NgitiBotFloatingChat.js');
    const patientEntry = read('ngitify-web', 'src', 'components', 'patient', 'PatientAIChat.js');
    const staffEntry = read('ngitify-web', 'src', 'components', 'sidebar', 'Sidebar.js');
    for (const text of ['New chat', 'Pinned', 'Archived', 'Rename conversation', 'Delete conversation', 'Close NgitiBot']) {
        assert.match(source, new RegExp(text));
    }
    assert.match(source, /PatientPortal\.module\.css/);
    assert.match(source, /patientAiConversationShellFloating/);
    assert.match(sharedShell, /patientAiLauncher/);
    assert.match(sharedShell, /patientAiFloatingHost/);
    assert.match(patientEntry, /<NgitiBotFloatingChat/);
    assert.match(staffEntry, /<NgitiBotFloatingChat/);
    assert.doesNotMatch(staffEntry, /staffAiLauncher/);
    assert.match(source, /aria-label="NgitiBot"/);
    assert.doesNotMatch(source, /NgitiFy Staff AI|AI assistant/);
});
