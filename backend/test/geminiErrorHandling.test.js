const test = require('node:test');
const assert = require('node:assert/strict');

test('Gemini quota errors become safe HTTP 429 errors', async () => {
    const { normalizeGeminiError } = await import('../ai/geminiService.mjs');
    const providerError = new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","message":"Quota exceeded"}}');
    providerError.code = 429;

    const error = normalizeGeminiError(providerError);

    assert.equal(error.statusCode, 429);
    assert.equal(error.message, 'The AI request limit has been reached for now. Please try again later.');
    assert.doesNotMatch(error.message, /RESOURCE_EXHAUSTED|generativelanguage|free_tier/i);
});

test('unknown Gemini errors do not expose provider details', async () => {
    const { normalizeGeminiError } = await import('../ai/geminiService.mjs');
    const error = normalizeGeminiError(new Error('secret provider diagnostic'));

    assert.equal(error.statusCode, 502);
    assert.equal(error.message, 'The AI provider could not process this request.');
    assert.doesNotMatch(error.message, /secret provider diagnostic/);
});

test('patient context formatting preserves approved radiographs before the size limit', async () => {
    const { formatAdditionalContext } = await import('../ai/geminiService.mjs');
    const formatted = formatAdditionalContext({
        patientSession: {
            padding: 'x'.repeat(7000),
        },
        careContext: {
            systemRecommendation: {
                label: 'Recommended',
            },
            oralHealthManagement: {
                recentLogs: [],
            },
            radiographAvailability: {
                available: true,
            },
            approvedRadiographRecords: [
                {
                    approvedSummary: 'Dentist-approved explanation.',
                },
            ],
        },
    });

    assert.ok(formatted.length <= 6000);
    assert.ok(
        formatted.indexOf('approvedRadiographRecords')
        < formatted.indexOf('patientSession')
    );
    assert.match(formatted, /Dentist-approved explanation\./);
});
