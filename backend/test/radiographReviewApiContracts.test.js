const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { buildPatientAiRadiographContext } = require('../utils/patientAi');

const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

test('radiograph review mutation endpoints are authenticated and dentist scoped', () => {
    for (const route of ['/analyze', '/detections/:detectionId', '/annotations', '/generate-summary', '/cancel-summary-revision', '/approve-summary']) {
        assert.ok(serverSource.includes(route));
    }
    assert.match(serverSource, /const requireDentistRadiograph/);
    assert.match(serverSource, /req\.user\.role !== 'dentist'/);
    assert.match(serverSource, /dentistCanAccessPatient\(req\.user\.id, patient\._id\)/);
});

test('patient radiograph serialization omits raw analysis and unapproved summary drafts', () => {
    const serializer = serverSource.slice(serverSource.indexOf('const buildPatientRadiographPayload'), serverSource.indexOf('const buildNonInterpretiveRadiographPayload'));
    assert.doesNotMatch(serializer, /analysis:/);
    assert.match(serializer, /status === 'approved'/);
    assert.doesNotMatch(serializer, /draft:/);
});

test('patient AI receives only approved radiograph records', () => {
    const records = buildPatientAiRadiographContext([
        { _id: 'approved', label: 'Panoramic', reviewSummary: { status: 'approved', approvedText: 'Dentist approved.', revisionDraft: 'Unapproved replacement.', approvedAt: new Date(), approvedBy: 'd1' }, annotations: [{ toothNumber: '46', findingType: 'Existing restoration', status: 'active' }, { toothNumber: '47', findingType: 'Archived private finding', status: 'archived' }, { toothNumber: '48', findingType: 'Deleted private finding', status: 'deleted' }] },
        { _id: 'draft', label: 'Periapical', reviewSummary: { status: 'draft', draft: 'Not approved.' }, analysis: { detections: [{ predictedToothNumber: '47' }] } },
    ]);
    assert.equal(records.length, 1);
    assert.equal(records[0].approvedSummary, 'Dentist approved.');
    assert.equal(records[0].dentistRecordedFindings.length, 1);
    assert.equal(JSON.stringify(records).includes('Unapproved replacement'), false);
    assert.equal(JSON.stringify(records).includes('Archived private finding'), false);
    assert.equal(JSON.stringify(records).includes('Deleted private finding'), false);
    assert.equal(JSON.stringify(records).includes('predictedToothNumber'), false);
});

test('dentist finding lifecycle endpoints preserve audit history and use soft deletion', () => {
    const lifecycleRoutes = serverSource.slice(serverSource.indexOf("app.patch('/api/patients/:id/radiographs/:radiographId/annotations/:annotationId'"), serverSource.indexOf("app.post('/api/patients/:id/radiographs/:radiographId/generate-summary'"));
    assert.match(lifecycleRoutes, /recordRadiographFindingChange/);
    assert.match(lifecycleRoutes, /annotations\/:annotationId\/archive/);
    assert.match(lifecycleRoutes, /annotations\/:annotationId\/restore/);
    assert.match(lifecycleRoutes, /app\.delete\('\/api\/patients\/:id\/radiographs\/:radiographId\/annotations\/:annotationId'/);
    assert.match(lifecycleRoutes, /A reason is required to delete a clinical finding/);
    assert.match(lifecycleRoutes, /finding\.status = 'deleted'/);
    assert.match(lifecycleRoutes, /finding\.deletionReason = reason/);
    assert.doesNotMatch(lifecycleRoutes, /\.remove\(|\.deleteOne\(|\.splice\(/);
    assert.match(lifecycleRoutes, /markRadiographSummaryAfterFindingChange/);
});

test('dentist findings require a location and valid clinical finding text on frontend and backend', () => {
    const annotationRoutes = serverSource.slice(serverSource.indexOf("app.post('/api/patients/:id/radiographs/:radiographId/annotations'"), serverSource.indexOf("app.post('/api/patients/:id/radiographs/:radiographId/generate-summary'"));
    assert.match(annotationRoutes, /Finding recorded by dentist is required/);
    assert.match(annotationRoutes, /Finding recorded by dentist must be 160 characters or fewer/);
    assert.match(annotationRoutes, /Clinical note must be 2000 characters or fewer/);
    assert.match(annotationRoutes, /Annotation location is required/);

    const uiSource = fs.readFileSync(path.join(__dirname, '..', '..', 'ngitify-web', 'src', 'components', 'dentist', 'RadiographReviewPanel.js'), 'utf8');
    const uiStyles = fs.readFileSync(path.join(__dirname, '..', '..', 'ngitify-web', 'src', 'components', 'dentist', 'RadiographReviewPanel.module.css'), 'utf8');
    assert.match(uiSource, /errors\.findingType = 'Required'/);
    assert.match(uiSource, /aria-invalid=\{Boolean\(findingErrors\.findingType\)\}/);
    assert.match(uiStyles, /\[aria-invalid="true"\][^{]*\{[^}]*border-color: #dc2626/);
    assert.match(uiStyles, /data-location-invalid="true"/);
});

test('evaluation export uses pseudonymous ids and excludes direct patient identifiers', () => {
    const evaluationRoute = serverSource.slice(serverSource.indexOf("app.get('/api/radiograph-review/evaluation'"), serverSource.indexOf("const createStaffAiRouter", serverSource.indexOf("app.get('/api/radiograph-review/evaluation'")));
    assert.match(evaluationRoute, /createHmac\('sha256'/);
    assert.doesNotMatch(evaluationRoute, /patient\.name|patient\.email|contactNumber|address/);
});

test('radiograph summary approval records manual review and dentist approval before publication', () => {
    const approvalRoute = serverSource.slice(serverSource.indexOf("app.post('/api/patients/:id/radiographs/:radiographId/approve-summary'"), serverSource.indexOf("app.get('/api/radiograph-review/evaluation'"));
    assert.match(approvalRoute, /manualReviewConfirmed === true/);
    assert.match(approvalRoute, /canApproveRadiographSummary/);
    assert.match(approvalRoute, /summary\.approvedAt = new Date\(\)/);
    assert.match(approvalRoute, /summary\.approvedBy = req\.user\.id/);
});

test('approved radiograph summaries use a separate revision draft until reapproval', () => {
    const generationRoute = serverSource.slice(serverSource.indexOf("app.post('/api/patients/:id/radiographs/:radiographId/generate-summary'"), serverSource.indexOf("app.post('/api/patients/:id/radiographs/:radiographId/approve-summary'"));
    const approvalRoute = serverSource.slice(serverSource.indexOf("app.post('/api/patients/:id/radiographs/:radiographId/approve-summary'"), serverSource.indexOf("app.get('/api/radiograph-review/evaluation'"));
    assert.match(generationRoute, /summary\.revisionDraft = draft/);
    assert.match(generationRoute, /current approved summary remains available until this revision is approved/i);
    assert.doesNotMatch(generationRoute, /summary\.approvedText\s*=/);
    assert.match(approvalRoute, /hasPendingDraft/);
    assert.match(approvalRoute, /summary\.draft = ''/);
    assert.match(approvalRoute, /summary\.revisionDraft = ''/);
});

test('cancelling a summary revision retains the approved record and clears only revision fields', () => {
    const cancelRoute = serverSource.slice(serverSource.indexOf("app.post('/api/patients/:id/radiographs/:radiographId/cancel-summary-revision'"), serverSource.indexOf("app.post('/api/patients/:id/radiographs/:radiographId/approve-summary'"));
    assert.match(cancelRoute, /requireDentistRadiograph/);
    assert.match(cancelRoute, /summary\.revisionDraft = ''/);
    assert.match(cancelRoute, /summary\.revisionStartedAt = null/);
    assert.match(cancelRoute, /summary\.revisionStartedBy = null/);
    assert.doesNotMatch(cancelRoute, /summary\.approvedText\s*=/);
    assert.doesNotMatch(cancelRoute, /summary\.approvedAt\s*=/);
    assert.match(cancelRoute, /previous approved summary was retained/i);
});

test('radiograph upload accepts only the controlled clinical type list', () => {
    const uploadRoute = serverSource.slice(serverSource.indexOf("app.post('/api/patients/:id/radiographs'"), serverSource.indexOf("app.delete('/api/patients/:id/radiographs/:entryId'"));
    for (const type of ['Periapical', 'Bitewing', 'Occlusal', 'Panoramic', 'Other']) {
        assert.match(serverSource, new RegExp(`['\"]${type}['\"]`));
    }
    assert.match(uploadRoute, /RADIOGRAPH_TYPES\.includes\(label\)/);
    assert.match(uploadRoute, /valid radiograph type and date/);
    const emrSource = fs.readFileSync(path.join(__dirname, '..', '..', 'ngitify-web', 'src', 'pages', 'admin', 'PatientEMR.js'), 'utf8');
    assert.match(emrSource, /DEFAULT_RADIOGRAPH_TYPE = 'Periapical'/);
    assert.match(emrSource, /<select[\s\S]*value=\{uploadForm\.label\}[\s\S]*required/);
    assert.doesNotMatch(emrSource, /placeholder="e\.g\. Panoramic, Periapical, Bitewing"/);
});

test('radiograph review UI omits visual detection overlays and supports guarded enhancement', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'ngitify-web', 'src', 'components', 'dentist', 'RadiographReviewPanel.js'), 'utf8');
    assert.doesNotMatch(source, /Show AI|detectionBox|AI suggestion:/);
    assert.match(source, /Improving\.\.\./);
    assert.match(source, /improveInFlightRef/);
    assert.match(source, /getBoundingClientRect\(\)/);
});

test('radiograph analyzer ignores a missing configured executable and has portable Python fallbacks', () => {
    const commandResolver = serverSource.slice(
        serverSource.indexOf('const getRadiographEnhancerCommands'),
        serverSource.indexOf('const spawnRadiographAnalyzer')
    );
    assert.match(commandResolver, /fs\.existsSync\(configuredCommand\)/);
    assert.match(commandResolver, /\.venv-ai/);
    assert.match(commandResolver, /command: 'py', args: \['-3'\]/);
    assert.match(commandResolver, /command: 'python3'/);
});

test('adaptive enhancement stores provenance and dentist feedback without replacing the original', () => {
    const enhanceRoute = serverSource.slice(
        serverSource.indexOf("app.post('/api/radiographs/enhance'"),
        serverSource.indexOf('// AI PATIENT CARE COMPANION')
    );
    assert.match(enhanceRoute, /radiographType: radiograph\.label/);
    assert.match(enhanceRoute, /metadata: result\.metadata/);
    assert.match(enhanceRoute, /enhancement-feedback/);
    assert.match(enhanceRoute, /\['useful', 'not-useful', 'artifact'\]/);
    assert.match(enhanceRoute, /dentistCanAccessPatient/);
    assert.doesNotMatch(enhanceRoute, /radiograph\.url\s*=/);
});

test('adaptive enhancer declares type profiles, safeguards, and transparent metadata', () => {
    const enhancer = fs.readFileSync(path.join(__dirname, '..', 'python', 'radiograph_enhance.py'), 'utf8');
    for (const type of ['periapical', 'bitewing', 'occlusal', 'panoramic', 'other']) {
        assert.match(enhancer, new RegExp(`"${type}"`));
    }
    assert.match(enhancer, /sourceBitDepth/);
    assert.match(enhancer, /transformations/);
    assert.match(enhancer, /resolution is too low/);
    assert.match(enhancer, /clipped pixels/);
    assert.match(enhancer, /artificial detail/);
});

test('radiograph summary panel defines explicit readable text colors', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', '..', 'ngitify-web', 'src', 'components', 'dentist', 'RadiographReviewPanel.module.css'), 'utf8');
    assert.match(css, /\.panel \{[^}]*color: #17364a/);
    assert.match(css, /\.section h3 \{[^}]*color: #123c59/);
    assert.match(css, /\.sectionHelper \{[^}]*color: #526777 !important/);
});

test('dentist review exposes enhancement comparison and omits obsolete model evaluation controls', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'ngitify-web', 'src', 'components', 'dentist', 'RadiographReviewPanel.js'), 'utf8');
    assert.match(source, /Compare original \/ enhanced/);
    assert.match(source, /Enhancement details/);
    assert.match(source, /Introduced artifact/);
    assert.doesNotMatch(source, /Model evaluation|Load metrics|Export anonymized CSV/);
});
