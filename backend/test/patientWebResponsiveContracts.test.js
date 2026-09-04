const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('patient web uses a full-width mobile content area with a compact navigation bar', () => {
    const layout = read('ngitify-web/src/components/layout/DashboardLayout.js');
    const layoutStyles = read('ngitify-web/src/components/layout/DashboardLayout.module.css');
    const sidebar = read('ngitify-web/src/components/sidebar/Sidebar.js');
    const sidebarStyles = read('ngitify-web/src/components/sidebar/Sidebar.module.css');

    assert.match(layout, /user\?\.role === 'patient' \? styles\.patientLayout/);
    assert.match(layoutStyles, /@media \(max-width: 768px\)[\s\S]*\.patientMainContent[\s\S]*padding-top: 64px/);
    assert.match(sidebar, /isPatient \? styles\.patientSidebar/);
    assert.match(sidebar, /aria-expanded=\{isExpanded\}/);
    assert.match(sidebarStyles, /\.patientSidebar \{[\s\S]*position: fixed;[\s\S]*height: 64px/);
    assert.match(sidebarStyles, /\.patientSidebar\.expanded \{[\s\S]*height: 100dvh/);
});

test('patient portal cards, tabs, forms, calendars, and modals adapt to phone widths', () => {
    const patientStyles = read('ngitify-web/src/styles/patient/PatientPortal.module.css');

    assert.match(patientStyles, /@media \(min-width: 769px\) and \(max-width: 1024px\)/);
    assert.match(patientStyles, /@media \(max-width: 600px\)[\s\S]*\.tabs \{[\s\S]*overflow-x: auto/);
    assert.match(patientStyles, /@media \(max-width: 600px\)[\s\S]*\.modalOverlay \{[\s\S]*align-items: flex-end/);
    assert.match(patientStyles, /@media \(max-width: 600px\)[\s\S]*\.formGrid,[\s\S]*\.infoGrid[\s\S]*grid-template-columns: minmax\(0, 1fr\)/);
});

test('patient profile and settings forms stack controls and actions on phones', () => {
    const profileStyles = read('ngitify-web/src/styles/admin/AdminProfile.module.css');
    const settingsStyles = read('ngitify-web/src/styles/admin/AdminSettings.module.css');

    assert.match(profileStyles, /@media \(max-width: 600px\)[\s\S]*\.profileSection \{[\s\S]*flex-direction: column/);
    assert.match(profileStyles, /\.buttonGroup > button \{[\s\S]*width: 100%/);
    assert.match(settingsStyles, /@media \(max-width: 1024px\)[\s\S]*\.settingsLayout \{[\s\S]*flex-direction: column/);
    assert.match(settingsStyles, /@media \(max-width: 600px\)[\s\S]*\.inputRow \{[\s\S]*flex-direction: column/);
});

test('patient EMR and shared patient pages contain mobile-safe content and form rules', () => {
    const emrStyles = read('ngitify-web/src/styles/dentist/PatientEMR.module.css');
    const sharedPageStyles = read('ngitify-web/src/styles/shared/SchedulePage.module.css');

    assert.match(emrStyles, /@media \(max-width: 720px\)[\s\S]*\.main-content \{[\s\S]*padding: 18px 12px 104px/);
    assert.match(emrStyles, /@media \(max-width: 720px\)[\s\S]*\.formCard \{[\s\S]*width: 100%;[\s\S]*max-height: calc\(100dvh - 12px\)/);
    assert.match(emrStyles, /@media \(max-width: 720px\)[\s\S]*\.formActions,[\s\S]*\.modalButtonGroup[\s\S]*flex-direction: column-reverse/);
    assert.match(sharedPageStyles, /@media \(max-width: 600px\)[\s\S]*\.wideModal,[\s\S]*\.viewerModal,[\s\S]*\.successModalCard[\s\S]*width: 100%/);
    assert.match(sharedPageStyles, /@media \(max-width: 600px\)[\s\S]*\.modalActions \{[\s\S]*flex-direction: column-reverse/);
});

test('global patient confirmation and session dialogs fit phone viewports', () => {
    const confirmStyles = read('ngitify-web/src/components/common/ConfirmModal.module.css');
    const sessionStyles = read('ngitify-web/src/components/common/SessionWarningModal.module.css');

    assert.match(confirmStyles, /\.modalCard \{[\s\S]*box-sizing: border-box/);
    assert.match(confirmStyles, /@media \(max-width: 600px\)[\s\S]*\.modalButtonGroup \{[\s\S]*flex-direction: column-reverse/);
    assert.match(sessionStyles, /\.modal \{[\s\S]*box-sizing: border-box/);
    assert.match(sessionStyles, /@media \(max-width: 600px\)[\s\S]*\.modal \{[\s\S]*border-radius: 20px 20px 0 0/);
});
