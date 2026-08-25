import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const KNOWLEDGE_ROOT = path.join(__dirname, 'knowledge');
const REFUSAL_TEXT = 'I can only answer based on Dentime system knowledge and approved dental guidance.';
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const MIN_RELEVANCE = Number.parseInt(process.env.AI_MIN_RELEVANCE || '2', 10);
const MAX_CONTEXT_LENGTH = 6000;

const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({}) : null;

const getProviderErrorText = (error) => [
    error?.message,
    error?.status,
    error?.code,
    error?.error?.message,
    error?.error?.status,
    error?.error?.code,
].filter(Boolean).join(' ');

export function normalizeGeminiError(error) {
    const providerText = getProviderErrorText(error);
    const providerStatus = Number(error?.status || error?.code || error?.error?.code);

    if (
        providerStatus === 429
        || /RESOURCE_EXHAUSTED|quota exceeded|rate[ _-]?limit/i.test(providerText)
    ) {
        return Object.assign(
            new Error('The AI request limit has been reached for now. Please try again later.'),
            { statusCode: 429, cause: error }
        );
    }

    if (
        providerStatus === 503
        || /UNAVAILABLE|service unavailable|overloaded/i.test(providerText)
    ) {
        return Object.assign(
            new Error('The AI explanation service is temporarily unavailable. Please try again later.'),
            { statusCode: 503, cause: error }
        );
    }

    return Object.assign(
        new Error('The AI provider could not process this request.'),
        { statusCode: 502, cause: error }
    );
}

const callGemini = async (request) => {
    try {
        return await request();
    } catch (error) {
        throw normalizeGeminiError(error);
    }
};

const STOP_WORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'can', 'do', 'for', 'from',
    'how', 'i', 'if', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'our',
    'please', 'the', 'to', 'what', 'when', 'where', 'who', 'why', 'with', 'you',
    'your',
]);

const SCOPE_CONFIG = {
    patient: {
        folders: ['dental'],
        maxChunks: 5,
        fallbackSources: [
            'dental/general-dental-guidance.md',
            'dental/routine-preventive-care.md',
            'dental/common-procedure-overviews.md',
            'dental/everyday-oral-health-topics.md',
            'dental/post-op-care.md',
        ],
        systemInstruction: [
            "You are Dentime's AI patient care companion.",
            'Answer only from the supplied approved dental knowledge and any additional Dentime context provided with the request.',
            'Use a calm, human, supportive tone.',
            'Reply in the same language as the patient whenever possible.',
            'You may answer in English, Filipino or Tagalog, Cebuano or Bisaya, or another language the patient uses if you can do so clearly and safely.',
            'If the patient mixes English with Filipino language, mirror that naturally instead of forcing one language.',
            'You may explain dental guidance, post-operative care, post-operative diet suggestions, preventive care, common dental procedures, oral-hygiene basics, and patient-safe clinic information.',
            'You may also summarize live Dentime patient data that is included in the request context, such as the patient assigned branch, active appointment, recent appointments, visit prediction, and appointment availability.',
            'You may answer shortcut questions about what appointment the patient has, whether they currently have an active appointment, and what open booking slots are shown in the Dentime context.',
            'Make it clear that slot availability can still change until the patient completes the actual booking flow.',
            'If the patient asks you to book, cancel, or reschedule an appointment, do not pretend the action is done. Explain the available information from Dentime and tell them to use the booking flow or contact the clinic for changes.',
            'You may explain predictive visit windows only when Dentime has already supplied the visit-window data in the request context.',
            'Do not invent or recalculate predictive visit windows on your own.',
            'When asked to explain the current visit recommendation, explain only the existing System Recommendation in the Dentime context and never replace, change, postpone, or override it.',
            'When asked to explain a recent Oral Health Management trend, summarize only the supplied Oral Health Management records and do not diagnose or infer a condition.',
            'When asked to explain radiograph findings, explain only dentist-approved radiograph summaries and dentist-recorded findings supplied in approvedRadiographRecords; never interpret the image yourself.',
            'If approvedRadiographRecords is empty, reply exactly: No approved radiograph explanation is available.',
            'Never diagnose, prescribe medication, or make patient-specific treatment decisions.',
            'If the patient asks for a diagnosis, treatment recommendation for their specific case, prescription advice, urgent triage beyond basic safety, image interpretation, or anything that needs professional judgment, do not answer medically.',
            'For those questions, give a short supportive boundary message in the same language and tell the patient to consult their dentist or contact the clinic.',
            'If the answer is not supported by the approved knowledge or Dentime context, give that same short boundary message instead of guessing.',
        ].join(' '),
    },
    staff: {
        folders: ['system', 'dental'],
        maxChunks: 6,
        systemInstruction: [
            "You are Dentime's AI staff assistant.",
            'Answer only from the supplied Dentime workflow knowledge, approved dental knowledge, and any live Dentime data included with the request.',
            'Help staff with workflows, troubleshooting, and concise summaries.',
            'For summary requests, only summarize the live Dentime data that was provided in the request context.',
            'Do not invent metrics, records, steps, or system behavior that are not supported by the supplied knowledge or data.',
            'If the answer is not supported by the approved knowledge or Dentime context, reply exactly with the refusal message.',
        ].join(' '),
    },
    education: {
        folders: ['dental'],
        maxChunks: 6,
        systemInstruction: [
            "You are Dentime's dental education writer.",
            'Write patient-friendly educational content using only the supplied approved dental knowledge.',
            'Use clear language, practical guidance, and short sections.',
            'Do not add unsupported facts, diagnoses, or prescriptions.',
            'If the topic is not supported by the approved knowledge, reply exactly with the refusal message.',
        ].join(' '),
    },
};

function tokenize(text = '') {
    return String(text)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token && !STOP_WORDS.has(token) && token.length > 1);
}

function normalizeMessages(messages = []) {
    return (Array.isArray(messages) ? messages : [])
        .map((message) => {
            const rawRole = String(message?.role || 'user').toLowerCase();
            const role = rawRole === 'assistant' || rawRole === 'model' ? 'model' : 'user';
            const text = String(message?.content || '').trim();

            if (!text) {
                return null;
            }

            return {
                role,
                parts: [{ text }],
            };
        })
        .filter(Boolean);
}

function getLastUserText(contents = []) {
    for (let index = contents.length - 1; index >= 0; index -= 1) {
        if (contents[index]?.role === 'user') {
            return contents[index]?.parts?.[0]?.text?.trim() || '';
        }
    }
    return '';
}

function listMarkdownFiles(folderPath) {
    if (!fs.existsSync(folderPath)) {
        return [];
    }

    return fs.readdirSync(folderPath, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(folderPath, entry.name);
        if (entry.isDirectory()) {
            return listMarkdownFiles(fullPath);
        }
        if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
            return [fullPath];
        }
        return [];
    });
}

function splitMarkdownIntoChunks(filePath, content) {
    const cleaned = String(content || '').replace(/\r/g, '').trim();
    if (!cleaned) {
        return [];
    }

    const sections = cleaned
        .split(/\n(?=#{1,3}\s)/g)
        .map((section) => section.trim())
        .filter(Boolean);

    return sections.flatMap((section, sectionIndex) => {
        const blocks = section
            .split(/\n{2,}/g)
            .map((block) => block.trim())
            .filter((block) => block.length >= 80);

        if (!blocks.length) {
            return [{
                source: path.relative(KNOWLEDGE_ROOT, filePath).replace(/\\/g, '/'),
                text: section,
                sectionIndex,
            }];
        }

        return blocks.map((block, blockIndex) => ({
            source: path.relative(KNOWLEDGE_ROOT, filePath).replace(/\\/g, '/'),
            text: block,
            sectionIndex,
            blockIndex,
        }));
    });
}

function loadKnowledgeChunks(folders = []) {
    return folders.flatMap((folder) => {
        const folderPath = path.join(KNOWLEDGE_ROOT, folder);
        return listMarkdownFiles(folderPath).flatMap((filePath) => {
            const content = fs.readFileSync(filePath, 'utf8');
            return splitMarkdownIntoChunks(filePath, content);
        });
    });
}

function scoreChunk(queryTokens, chunk) {
    if (!queryTokens.length) {
        return 0;
    }

    const haystack = `${chunk.source}\n${chunk.text}`.toLowerCase();
    return queryTokens.reduce((score, token) => {
        if (!haystack.includes(token)) {
            return score;
        }

        const sourceBoost = chunk.source.toLowerCase().includes(token) ? 3 : 0;
        const headingBoost = chunk.text.toLowerCase().split('\n', 1)[0]?.includes(token) ? 2 : 0;
        return score + 1 + sourceBoost + headingBoost;
    }, 0);
}

function selectKnowledge(scope, queryText) {
    const config = SCOPE_CONFIG[scope];
    const queryTokens = tokenize(queryText);
    const allChunks = loadKnowledgeChunks(config.folders);
    const chunks = allChunks
        .map((chunk) => ({
            ...chunk,
            score: scoreChunk(queryTokens, chunk),
        }))
        .filter((chunk) => chunk.score >= MIN_RELEVANCE)
        .sort((left, right) => right.score - left.score)
        .slice(0, config.maxChunks);

    if (chunks.length > 0) {
        return chunks;
    }

    if (!config.fallbackSources?.length) {
        return [];
    }

    const fallbackSourceSet = new Set(config.fallbackSources);
    return allChunks
        .filter((chunk) => fallbackSourceSet.has(chunk.source))
        .slice(0, config.maxChunks);
}

const prioritizePatientCareContext = (additionalContext) => {
    if (
        !additionalContext
        || typeof additionalContext !== 'object'
        || Array.isArray(additionalContext)
        || !additionalContext.careContext
        || typeof additionalContext.careContext !== 'object'
    ) {
        return additionalContext;
    }

    const {
        careContext,
        patientSession,
        appointmentsSnapshot,
        branchInfo,
        appointmentAvailability,
        ...remainingContext
    } = additionalContext;
    const {
        radiographAvailability,
        approvedRadiographRecords,
        systemRecommendation,
        oralHealthManagement,
        ...remainingCareContext
    } = careContext;

    return {
        careContext: {
            radiographAvailability,
            approvedRadiographRecords,
            systemRecommendation,
            oralHealthManagement,
            ...remainingCareContext,
        },
        patientSession,
        appointmentsSnapshot,
        branchInfo,
        appointmentAvailability,
        ...remainingContext,
    };
};

export function formatAdditionalContext(additionalContext) {
    if (!additionalContext) {
        return '';
    }

    if (typeof additionalContext === 'string') {
        return additionalContext.slice(0, MAX_CONTEXT_LENGTH).trim();
    }

    try {
        return JSON.stringify(
            prioritizePatientCareContext(additionalContext)
        ).slice(0, MAX_CONTEXT_LENGTH);
    } catch {
        return String(additionalContext).slice(0, MAX_CONTEXT_LENGTH).trim();
    }
}

function buildPrompt(scope, queryText, chunks, additionalContext) {
    const knowledgeText = chunks.length
        ? chunks
            .map((chunk, index) => `[Knowledge ${index + 1} | ${chunk.source}]\n${chunk.text}`)
            .join('\n\n')
        : 'No matching knowledge chunks were found.';

    const extraContext = additionalContext
        ? `\n\n[Additional Dentime Context]\n${additionalContext}`
        : '';

    if (scope === 'education') {
        return [
            'Use the approved knowledge below to write a patient-friendly educational article.',
            'If the knowledge is insufficient, reply with the refusal message only.',
            '',
            knowledgeText,
            extraContext,
            '',
            `[Requested Topic]\n${queryText}`,
        ].join('\n');
    }

    if (scope === 'patient') {
        return [
            'Use only the approved knowledge and Dentime context below.',
            'Reply in the same language as the latest patient message whenever possible.',
            'You may use live Dentime appointment and branch context when it is provided.',
            'For System Recommendation explanations, preserve the existing recommendation exactly and do not replace or override it.',
            'For Oral Health Management trend explanations, use only the supplied records and do not diagnose.',
            'For radiograph explanations, use only approvedRadiographRecords. If that list is empty, reply exactly: No approved radiograph explanation is available.',
            'Do not claim you booked, cancelled, or rescheduled anything unless the Dentime context explicitly says that action already happened.',
            'If the question needs professional judgment or is unsupported, do not answer medically.',
            'Instead, give a brief supportive message telling the patient to consult their dentist or contact the clinic.',
            '',
            knowledgeText,
            extraContext,
            '',
            `[User Request]\n${queryText}`,
        ].join('\n');
    }

    return [
        'Use only the approved knowledge and Dentime context below.',
        'If the answer is unsupported, reply with the refusal message only.',
        '',
        knowledgeText,
        extraContext,
        '',
        `[User Request]\n${queryText}`,
    ].join('\n');
}

function buildContentsWithPrompt(normalizedContents, prompt) {
    const priorTurns = normalizedContents.slice(0, -1);
    const latestUserMessage = normalizedContents.at(-1);

    if (!latestUserMessage || latestUserMessage.role !== 'user') {
        return [{ role: 'user', parts: [{ text: prompt }] }];
    }

    return [
        ...priorTurns,
        {
            role: 'user',
            parts: [{ text: prompt }],
        },
    ];
}

function ensureScope(scope) {
    if (!SCOPE_CONFIG[scope]) {
        throw new Error(`Unsupported AI scope: ${scope}`);
    }
    return SCOPE_CONFIG[scope];
}

function prepareRequest({ scope, messages, additionalContext }) {
    const config = ensureScope(scope);
    const normalizedContents = normalizeMessages(messages);
    const queryText = getLastUserText(normalizedContents);
    const formattedContext = formatAdditionalContext(additionalContext);
    const knowledgeChunks = selectKnowledge(scope, queryText);

    if (!queryText) {
        return {
            config,
            contents: [],
            shouldRefuse: true,
        };
    }

    if (!knowledgeChunks.length && !formattedContext) {
        return {
            config,
            contents: [],
            shouldRefuse: true,
        };
    }

    const prompt = buildPrompt(scope, queryText, knowledgeChunks, formattedContext);
    const contents = buildContentsWithPrompt(normalizedContents, prompt);

    return {
        config,
        contents,
        shouldRefuse: false,
    };
}

export function isAiConfigured() {
    return Boolean(ai);
}

export function getRefusalText() {
    return REFUSAL_TEXT;
}

export async function generateScopedReply({ scope, messages, additionalContext }) {
    if (!ai) {
        throw new Error('Gemini API is not configured.');
    }

    const request = prepareRequest({ scope, messages, additionalContext });
    if (request.shouldRefuse) {
        return REFUSAL_TEXT;
    }

    const response = await callGemini(() => ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: request.contents,
        config: {
            systemInstruction: request.config.systemInstruction,
            temperature: scope === 'education' ? 0.4 : 0.2,
        },
    }));

    return String(response.text || REFUSAL_TEXT).trim() || REFUSAL_TEXT;
}

export async function generateScopedStream({ scope, messages, additionalContext }) {
    if (!ai) {
        throw new Error('Gemini API is not configured.');
    }

    const request = prepareRequest({ scope, messages, additionalContext });
    if (request.shouldRefuse) {
        return null;
    }

    return callGemini(() => ai.models.generateContentStream({
        model: DEFAULT_MODEL,
        contents: request.contents,
        config: {
            systemInstruction: request.config.systemInstruction,
            temperature: 0.2,
        },
    }));
}
