const assert =
    require(
        'node:assert/strict'
    );

const fs =
    require(
        'node:fs'
    );

const path =
    require(
        'node:path'
    );

const test =
    require(
        'node:test'
    );

const SERVER_FILE =
    fs.readFileSync(
        path.resolve(
            __dirname,
            '..',
            'server.js'
        ),
        'utf8'
    );

test(
    'Patient AI conversations expose shared authenticated CRUD endpoints',
    () => {
        const requiredRoutes = [
            {
                method:
                    'GET list',
                pattern:
                    /app\.get\(\s*['"]\/api\/my\/ai-conversations['"]/,
            },
            {
                method:
                    'POST create',
                pattern:
                    /app\.post\(\s*['"]\/api\/my\/ai-conversations['"]/,
            },
            {
                method:
                    'GET one',
                pattern:
                    /app\.get\(\s*['"]\/api\/my\/ai-conversations\/:id['"]/,
            },
            {
                method:
                    'PATCH',
                pattern:
                    /app\.patch\(\s*['"]\/api\/my\/ai-conversations\/:id['"]/,
            },
            {
                method:
                    'DELETE',
                pattern:
                    /app\.delete\(\s*['"]\/api\/my\/ai-conversations\/:id['"]/,
            },
        ];

        requiredRoutes.forEach(
            (
                route
            ) => {
                assert.match(
                    SERVER_FILE,
                    route.pattern,
                    `Missing ${route.method} Patient AI conversation route.`
                );
            }
        );
    }
);

test(
    'persisted Patient AI messaging endpoint is authenticated and rate limited',
    () => {
        assert.match(
            SERVER_FILE,
            /\/api\/my\/ai-conversations\/:id\/messages/
        );

        assert.match(
            SERVER_FILE,
            /verifyToken,\s*aiChatLimiter/
        );
    }
);

test(
    'persisted Patient AI messaging supports incremental SSE replies',
    () => {
        assert.match(
            SERVER_FILE,
            /req\.query\.stream/
        );

        assert.match(
            SERVER_FILE,
            /generateScopedStream/
        );

        assert.match(
            SERVER_FILE,
            /text\/event-stream/
        );

        assert.match(
            SERVER_FILE,
            /data: \[DONE\]/
        );
    }
);

test(
    'conversation ownership is always scoped to authenticated Patient id',
    () => {
        assert.match(
            SERVER_FILE,
            /patient:\s*req\.user\.id/
        );

        assert.match(
            SERVER_FILE,
            /_id:\s*normalizedId[\s\S]*patient:\s*req\.user\.id/
        );
    }
);

test(
    'conversation routes reject non-Patient roles',
    () => {
        assert.match(
            SERVER_FILE,
            /req\.user\.role\s*!==\s*'patient'/
        );

        assert.match(
            SERVER_FILE,
            /assertPatientAiAccess/
        );
    }
);

test(
    'normal conversation list separates archived state',
    () => {
        assert.match(
            SERVER_FILE,
            /isArchived:\s*archived/
        );

        assert.match(
            SERVER_FILE,
            /req\.query\.archived/
        );
    }
);

test(
    'conversation list orders pinned conversations before recent conversations',
    () => {
        assert.match(
            SERVER_FILE,
            /isPinned:\s*-1/
        );

        assert.match(
            SERVER_FILE,
            /lastMessageAt:\s*-1/
        );
    }
);

test(
    'conversation metadata supports rename pin and archive operations',
    () => {
        assert.match(
            SERVER_FILE,
            /normalizeConversationTitle/
        );

        assert.match(
            SERVER_FILE,
            /conversation\s*\.isPinned/
        );

        assert.match(
            SERVER_FILE,
            /conversation\s*\.isArchived/
        );

        assert.match(
            SERVER_FILE,
            /archivedAt/
        );
    }
);

test(
    'archived conversations cannot receive new AI messages',
    () => {
        assert.match(
            SERVER_FILE,
            /Unarchive this conversation before sending a new message/
        );

        assert.match(
            SERVER_FILE,
            /status\(\s*409\s*\)/
        );
    }
);

test(
    'first Patient message deterministically derives the conversation title',
    () => {
        assert.match(
            SERVER_FILE,
            /deriveConversationTitle/
        );

        assert.match(
            SERVER_FILE,
            /hadPatientMessage/
        );

        assert.match(
            SERVER_FILE,
            /titleSource/
        );
    }
);

test(
    'persisted AI conversations continue using server-owned Patient care context',
    () => {
        assert.match(
            SERVER_FILE,
            /buildPatientAiLiveContext/
        );

        assert.match(
            SERVER_FILE,
            /userId:\s*req\.user\.id/
        );

        assert.match(
            SERVER_FILE,
            /scope:\s*'patient'/
        );
    }
);

test(
    'Patient and assistant messages are persisted together after AI reply succeeds',
    () => {
        const replyIndex =
            SERVER_FILE.indexOf(
                'generateScopedReply({',
                SERVER_FILE.indexOf(
                    '/api/my/ai-conversations/:id/messages'
                )
            );

        const firstPushIndex =
            SERVER_FILE.indexOf(
                '.push({',
                replyIndex
            );

        assert.ok(
            replyIndex >= 0,
            'Persisted AI endpoint must generate an AI reply.'
        );

        assert.ok(
            firstPushIndex
            > replyIndex,
            'Persisted messages must only be pushed after AI reply generation.'
        );

        assert.match(
            SERVER_FILE.slice(
                firstPushIndex
            ),
            /conversation[\s\S]*\.save\(\)/
        );
    }
);

test(
    'full conversation endpoint serializes persisted message history',
    () => {
        assert.match(
            SERVER_FILE,
            /serializeConversation\(\s*conversation\s*\)/
        );
    }
);

test(
    'conversation list uses summaries instead of exposing every message body',
    () => {
        assert.match(
            SERVER_FILE,
            /serializeConversationSummary/
        );
    }
);

test(
    'legacy Patient AI endpoint remains available during Web and Mobile migration',
    () => {
        assert.match(
            SERVER_FILE,
            /\/api\/ai\/chat/
        );

        assert.match(
            SERVER_FILE,
            /handlePatientAiChat/
        );
    }
);
