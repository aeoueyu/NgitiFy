const MAX_CONVERSATION_TITLE_LENGTH =
    100;

const MAX_DERIVED_TITLE_LENGTH =
    60;

const MAX_MESSAGE_LENGTH =
    12000;

const normalizeWhitespace =
    (
        value = ''
    ) =>
        String(
            value || ''
        )
            .replace(
                /\s+/g,
                ' '
            )
            .trim();

const normalizeConversationTitle =
    (
        value = ''
    ) => {
        const normalized =
            normalizeWhitespace(
                value
            );

        if (!normalized) {
            const error =
                new Error(
                    'Conversation title is required.'
                );

            error.statusCode =
                400;

            throw error;
        }

        if (
            normalized.length
            >
            MAX_CONVERSATION_TITLE_LENGTH
        ) {
            const error =
                new Error(
                    `Conversation title must be ${MAX_CONVERSATION_TITLE_LENGTH} characters or fewer.`
                );

            error.statusCode =
                400;

            throw error;
        }

        return normalized;
    };

const deriveConversationTitle =
    (
        firstPatientMessage = ''
    ) => {
        const normalized =
            normalizeWhitespace(
                firstPatientMessage
            );

        if (!normalized) {
            return 'New conversation';
        }

        if (
            normalized.length
            <=
            MAX_DERIVED_TITLE_LENGTH
        ) {
            return normalized;
        }

        const slice =
            normalized.slice(
                0,
                MAX_DERIVED_TITLE_LENGTH
            );

        const lastSpace =
            slice.lastIndexOf(
                ' '
            );

        const base =
            lastSpace >= 35
                ? slice.slice(
                    0,
                    lastSpace
                )
                : slice;

        return `${base.trim()}…`;
    };

const normalizeConversationMessage =
    (
        message = {}
    ) => {
        const role =
            String(
                message?.role
                || ''
            )
                .trim()
                .toLowerCase();

        if (
            ![
                'user',
                'assistant',
            ].includes(
                role
            )
        ) {
            const error =
                new Error(
                    'Conversation message role must be user or assistant.'
                );

            error.statusCode =
                400;

            throw error;
        }

        const content =
            String(
                message?.content
                || ''
            ).trim();

        if (!content) {
            const error =
                new Error(
                    'Conversation message content is required.'
                );

            error.statusCode =
                400;

            throw error;
        }

        if (
            content.length
            >
            MAX_MESSAGE_LENGTH
        ) {
            const error =
                new Error(
                    `Conversation message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`
                );

            error.statusCode =
                400;

            throw error;
        }

        return {
            role,
            content,
        };
    };

const serializeConversationMessage =
    (
        message = {}
    ) => ({
        id:
            message?._id
                ?.toString?.()
            || String(
                message?.id
                || ''
            ),

        role:
            message?.role
            || '',

        content:
            message?.content
            || '',

        createdAt:
            message?.createdAt
            || null,
    });

const serializeConversationSummary =
    (
        conversation = {}
    ) => ({
        id:
            conversation?._id
                ?.toString?.()
            || String(
                conversation?.id
                || ''
            ),

        title:
            conversation?.title
            || 'New conversation',

        titleSource:
            conversation
                ?.titleSource
            || 'derived',

        isPinned:
            Boolean(
                conversation
                    ?.isPinned
            ),

        isArchived:
            Boolean(
                conversation
                    ?.isArchived
            ),

        archivedAt:
            conversation
                ?.archivedAt
            || null,

        lastMessageAt:
            conversation
                ?.lastMessageAt
            || conversation
                ?.updatedAt
            || null,

        messageCount:
            Array.isArray(
                conversation
                    ?.messages
            )
                ? conversation
                    .messages
                    .length
                : 0,

        createdAt:
            conversation
                ?.createdAt
            || null,

        updatedAt:
            conversation
                ?.updatedAt
            || null,
    });

const serializeConversation =
    (
        conversation = {}
    ) => ({
        ...serializeConversationSummary(
            conversation
        ),

        messages:
            Array.isArray(
                conversation
                    ?.messages
            )
                ? conversation
                    .messages
                    .map(
                        serializeConversationMessage
                    )
                : [],
    });

module.exports = {
    MAX_CONVERSATION_TITLE_LENGTH,
    MAX_DERIVED_TITLE_LENGTH,
    MAX_MESSAGE_LENGTH,

    deriveConversationTitle,
    normalizeConversationMessage,
    normalizeConversationTitle,
    serializeConversation,
    serializeConversationMessage,
    serializeConversationSummary,
};