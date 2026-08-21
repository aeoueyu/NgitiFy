import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import {
    FaArchive,
    FaBars,
    FaBook,
    FaCalendarAlt,
    FaChevronLeft,
    FaEllipsisH,
    FaExclamationTriangle,
    FaInfoCircle,
    FaPaperPlane,
    FaPen,
    FaPlus,
    FaRedoAlt,
    FaRobot,
    FaTimes,
    FaTooth,
    FaTrash,
} from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import {
    PatientPageFrame,
} from '../../components/patient/PatientFrame';
import styles from '../../styles/patient/PatientPortal.module.css';

const QUICK_PROMPTS = [
    {
        id: 'visit-recommendation',
        icon: FaCalendarAlt,
        label:
            'Explain my current visit recommendation',
    },
    {
        id: 'oral-health-trend',
        icon: FaTooth,
        label:
            'Explain my recent Oral Health Management trend',
    },
    {
        id: 'education',
        icon: FaBook,
        label:
            'Give me Dental Health Education related to my recent log',
    },
    {
        id: 'appointment',
        icon: FaCalendarAlt,
        label:
            'Help me understand my upcoming appointment',
    },
    {
        id: 'home-care',
        icon: FaTooth,
        label:
            'Give me brushing and flossing guidance',
    },
];

const WELCOME_MESSAGE = {
    id: 'welcome',
    role: 'assistant',
    content:
        'Hello! Ask me about your existing NgitiFy care information, Oral Health Management records, Dental Health Education, appointments, or System Recommendation. I provide educational explanations and do not diagnose conditions.',
};

const formatDateKey = (value) => {
    if (!value) return '';

    const normalized =
        String(value).trim();

    const match =
        normalized.match(
            /^(\d{4})-(\d{2})-(\d{2})$/
        );

    if (match) {
        const [
            ,
            year,
            month,
            day,
        ] = match;

        const date =
            new Date(
                Number(year),
                Number(month) - 1,
                Number(day)
            );

        return date.toLocaleDateString(
            'en-PH',
            {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
            }
        );
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return normalized;
    }

    return date.toLocaleDateString(
        'en-PH',
        {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        }
    );
};

const normalizePersistedMessages = (
    messages = []
) => {
    if (!Array.isArray(messages)) {
        return [];
    }

    return messages
        .filter(
            (message) =>
                [
                    'user',
                    'assistant',
                ].includes(
                    message?.role
                )
                && String(
                    message?.content
                    || ''
                ).trim()
        )
        .map(
            (
                message,
                index
            ) => ({
                id:
                    message?.id
                    || message?._id
                    || `${message?.role || 'message'}-${index}`,
                role:
                    message.role,
                content:
                    String(
                        message.content
                    ).trim(),
            })
        );
};

const getErrorMessage = (
    status,
    payload
) => {
    if (status === 429) {
        return 'The AI request limit has been reached for now. Your System Recommendation and other core NgitiFy features are still available.';
    }

    if (status === 503) {
        return 'The AI explanation service is temporarily unavailable. Your System Recommendation, Oral Health Management, and Dental Health Education are still available.';
    }

    if (status === 409) {
        return (
            payload?.message
            || 'This conversation cannot receive new messages right now.'
        );
    }

    return (
        payload?.message
        || 'The AI explanation could not be loaded. Please try again.'
    );
};

const PatientAiCompanion = ({
    embedded = false,
    isOpen = true,
    onClose,
}) => {
    const [
        visitInfo,
        setVisitInfo,
    ] = useState(null);

    const [
        oralHealth,
        setOralHealth,
    ] = useState(null);

    const [
        careLoading,
        setCareLoading,
    ] = useState(true);

    const [
        careError,
        setCareError,
    ] = useState('');

    const [
        conversations,
        setConversations,
    ] = useState([]);

    const [
        archivedConversations,
        setArchivedConversations,
    ] = useState([]);

    const [
        conversationsLoading,
        setConversationsLoading,
    ] = useState(true);

    const [
        conversationsError,
        setConversationsError,
    ] = useState('');

    const [
        currentConversation,
        setCurrentConversation,
    ] = useState(null);

    const [
        openingConversation,
        setOpeningConversation,
    ] = useState(false);

    const [
        messages,
        setMessages,
    ] = useState([
        WELCOME_MESSAGE,
    ]);

    const [
        input,
        setInput,
    ] = useState('');

    const [
        sending,
        setSending,
    ] = useState(false);

    const [
        chatError,
        setChatError,
    ] = useState('');

    const [
        lastFailedPrompt,
        setLastFailedPrompt,
    ] = useState('');

    const [
        sidebarOpen,
        setSidebarOpen,
    ] = useState(false);

    const [
        sidebarView,
        setSidebarView,
    ] = useState('active');

    const [
        activeOverlay,
        setActiveOverlay,
    ] = useState(null);

    const [
        selectedConversation,
        setSelectedConversation,
    ] = useState(null);

    const [
        renameValue,
        setRenameValue,
    ] = useState('');

    const [
        pendingArchiveState,
        setPendingArchiveState,
    ] = useState(null);

    const messagesEndRef =
        useRef(null);

    const textareaRef =
        useRef(null);

    const conversationCacheRef =
        useRef(new Map());

    const openConversationRequestRef =
        useRef(0);

    const conversationMutationVersionRef =
        useRef(new Map());

    const fetchCareSnapshot =
        useCallback(async () => {
            setCareLoading(true);
            setCareError('');

            try {
                const [
                    predictionResponse,
                    oralHealthResponse,
                ] = await Promise.all([
                    authFetch(
                        '/my/visit-prediction'
                    ),
                    authFetch(
                        '/my/oral-health'
                    ),
                ]);

                if (
                    !predictionResponse.ok
                ) {
                    throw new Error(
                        'Recommended Visit Window could not be loaded.'
                    );
                }

                if (
                    !oralHealthResponse.ok
                ) {
                    throw new Error(
                        'Oral Health Management could not be loaded.'
                    );
                }

                const predictionPayload =
                    await predictionResponse
                        .json();

                const oralHealthPayload =
                    await oralHealthResponse
                        .json();

                setVisitInfo(
                    predictionPayload
                        ?.prediction
                    || null
                );

                setOralHealth(
                    oralHealthPayload
                    && typeof oralHealthPayload
                        === 'object'
                        ? oralHealthPayload
                        : null
                );
            } catch (error) {
                setCareError(
                    error.message
                    || 'Your current care information could not be loaded.'
                );
            } finally {
                setCareLoading(false);
            }
        }, []);

    const fetchConversationList =
        useCallback(
            async ({
                archived = false,
            } = {}) => {
                const response =
                    await authFetch(
                        `/my/ai-conversations?archived=${
                            archived
                                ? 'true'
                                : 'false'
                        }`
                    );

                const payload =
                    await response
                        .json()
                        .catch(
                            () => ({})
                        );

                if (!response.ok) {
                    throw new Error(
                        payload?.message
                        || 'Saved conversations could not be loaded.'
                    );
                }

                return Array.isArray(
                    payload
                        ?.conversations
                )
                    ? payload
                        .conversations
                    : [];
            },
            []
        );

    const refreshConversationLists =
        useCallback(
            async ({
                quiet = false,
            } = {}) => {
                if (!quiet) {
                    setConversationsLoading(
                        true
                    );
                }

                setConversationsError('');

                try {
                    const [
                        active,
                        archived,
                    ] =
                        await Promise.all([
                            fetchConversationList({
                                archived:
                                    false,
                            }),
                            fetchConversationList({
                                archived:
                                    true,
                            }),
                        ]);

                    setConversations(
                        active
                    );

                    setArchivedConversations(
                        archived
                    );
                } catch (error) {
                    setConversationsError(
                        error.message
                        || 'Saved conversations could not be loaded.'
                    );
                } finally {
                    setConversationsLoading(
                        false
                    );
                }
            },
            [
                fetchConversationList,
            ]
        );

    useEffect(() => {
        fetchCareSnapshot();
    }, [
        fetchCareSnapshot,
    ]);

    useEffect(() => {
        refreshConversationLists();
    }, [
        refreshConversationLists,
    ]);

    useEffect(() => {
        messagesEndRef.current
            ?.scrollIntoView({
                behavior: 'smooth',
                block: 'end',
            });
    }, [
        messages,
        sending,
        openingConversation,
        chatError,
    ]);

    useEffect(() => {
        if (!embedded || !isOpen) {
            setSidebarOpen(false);
            setActiveOverlay(null);
            return;
        }

        const focusTimerId = window.setTimeout(() => {
            textareaRef.current?.focus();
        }, 180);

        return () => window.clearTimeout(focusTimerId);
    }, [embedded, isOpen]);

    const oralHealthSummary =
        useMemo(
            () => (
                oralHealth?.summary
                && typeof oralHealth
                    .summary
                    === 'object'
                    ? oralHealth
                        .summary
                    : {}
            ),
            [
                oralHealth,
            ]
        );

    const recentLogs =
        useMemo(
            () => (
                Array.isArray(
                    oralHealth?.logs
                )
                    ? oralHealth
                        .logs
                    : []
            ),
            [
                oralHealth,
            ]
        );

    const contextualEducation =
        useMemo(
            () => (
                Array.isArray(
                    oralHealth
                        ?.contextualEducation
                )
                    ? oralHealth
                        .contextualEducation
                    : []
            ),
            [
                oralHealth,
            ]
        );

    const latestLogDate =
        oralHealthSummary
            .lastLogDateKey
        || recentLogs[0]
            ?.logDateKey
        || '';

    const recommendationLabel =
        visitInfo?.label
        || (
            careLoading
                ? 'Loading...'
                : 'Insufficient Data'
        );

    const recommendationWindow =
        visitInfo?.windowLabel
        || visitInfo
            ?.recommendedDateLabel
        || '';

    const recommendationReason =
        visitInfo
            ?.recommendationReason
        || (
            visitInfo
                ? 'NgitiFy is using the current System Recommendation.'
                : 'NgitiFy does not currently have enough supported clinic information to create a visit window.'
        );

    const pinnedConversations =
        conversations.filter(
            (conversation) =>
                conversation
                    .isPinned
        );

    const recentConversations =
        conversations.filter(
            (conversation) =>
                !conversation
                    .isPinned
        );

    const currentConversationArchived =
        Boolean(
            currentConversation
                ?.isArchived
        );

    const applyConversationLocally =
        useCallback(
            (conversation) => {
                if (
                    !conversation?.id
                ) {
                    return null;
                }

                const cached =
                    conversationCacheRef
                        .current
                        .get(
                            conversation.id
                        );

                const merged = {
                    ...cached,
                    ...conversation,
                    messages:
                        conversation
                            .messages
                        || cached
                            ?.messages
                        || [],
                };

                conversationCacheRef
                    .current
                    .set(
                        merged.id,
                        merged
                    );

                setCurrentConversation(
                    (current) => {
                        if (
                            current?.id
                            !== merged.id
                        ) {
                            return current;
                        }

                        return {
                            ...current,
                            ...merged,
                            messages:
                                merged.messages
                                || current
                                    .messages
                                || [],
                        };
                    }
                );

                if (
                    merged.isArchived
                ) {
                    setConversations(
                        (current) =>
                            current.filter(
                                (item) =>
                                    item.id
                                    !== merged.id
                            )
                    );

                    setArchivedConversations(
                        (current) => {
                            const remaining =
                                current.filter(
                                    (item) =>
                                        item.id
                                        !== merged.id
                                );

                            return [
                                merged,
                                ...remaining,
                            ];
                        }
                    );
                } else {
                    setArchivedConversations(
                        (current) =>
                            current.filter(
                                (item) =>
                                    item.id
                                    !== merged.id
                            )
                    );

                    setConversations(
                        (current) => {
                            const remaining =
                                current.filter(
                                    (item) =>
                                        item.id
                                        !== merged.id
                                );

                            return [
                                merged,
                                ...remaining,
                            ];
                        }
                    );
                }

                return merged;
            },
            []
        );

    const updateConversation =
        useCallback(
            async (
                conversation,
                changes
            ) => {
                if (
                    !conversation?.id
                ) {
                    return null;
                }

                setConversationsError('');

                const cached =
                    conversationCacheRef
                        .current
                        .get(
                            conversation.id
                        );

                const original = {
                    ...cached,
                    ...conversation,
                    messages:
                        cached?.messages
                        || conversation
                            .messages
                        || [],
                };

                const optimistic = {
                    ...original,
                    ...changes,
                };

                if (
                    Object.prototype
                        .hasOwnProperty
                        .call(
                            changes,
                            'title'
                        )
                ) {
                    optimistic.titleSource =
                        'manual';
                }

                if (
                    Object.prototype
                        .hasOwnProperty
                        .call(
                            changes,
                            'isArchived'
                        )
                ) {
                    optimistic.archivedAt =
                        changes.isArchived
                            ? new Date()
                                .toISOString()
                            : null;
                }

                applyConversationLocally(
                    optimistic
                );

                const previousVersion =
                    conversationMutationVersionRef
                        .current
                        .get(
                            conversation.id
                        )
                    || 0;

                const mutationVersion =
                    previousVersion + 1;

                conversationMutationVersionRef
                    .current
                    .set(
                        conversation.id,
                        mutationVersion
                    );

                try {
                    const response =
                        await authFetch(
                            `/my/ai-conversations/${conversation.id}`,
                            {
                                method:
                                    'PATCH',
                                body:
                                    JSON.stringify(
                                        changes
                                    ),
                            }
                        );

                    const payload =
                        await response
                            .json()
                            .catch(
                                () => ({})
                            );

                    if (!response.ok) {
                        throw new Error(
                            payload?.message
                            || 'The conversation could not be updated.'
                        );
                    }

                    const latestVersion =
                        conversationMutationVersionRef
                            .current
                            .get(
                                conversation.id
                            );

                    const persisted =
                        payload
                            ?.conversation
                        || optimistic;

                    if (
                        latestVersion
                        === mutationVersion
                    ) {
                        applyConversationLocally(
                            persisted
                        );
                    }

                    void refreshConversationLists({
                        quiet: true,
                    });

                    return persisted;
                } catch (error) {
                    const latestVersion =
                        conversationMutationVersionRef
                            .current
                            .get(
                                conversation.id
                            );

                    if (
                        latestVersion
                        === mutationVersion
                    ) {
                        applyConversationLocally(
                            original
                        );

                        setConversationsError(
                            error.message
                            || 'The conversation could not be updated.'
                        );
                    }

                    return null;
                }
            },
            [
                applyConversationLocally,
                refreshConversationLists,
            ]
        );

    const openConversation =
        useCallback(
            async (
                conversation,
                {
                    closeSidebar = true,
                } = {}
            ) => {
                const conversationId =
                    typeof conversation
                        === 'string'
                        ? conversation
                        : conversation
                            ?.id;

                const summary =
                    typeof conversation
                        === 'object'
                        ? conversation
                        : null;

                if (
                    !conversationId
                    || sending
                ) {
                    return;
                }

                const requestId =
                    openConversationRequestRef
                        .current + 1;

                openConversationRequestRef
                    .current =
                    requestId;

                setChatError('');
                setLastFailedPrompt('');
                setActiveOverlay(null);

                const cached =
                    conversationCacheRef
                        .current
                        .get(
                            conversationId
                        );

                if (cached) {
                    const cachedMessages =
                        normalizePersistedMessages(
                            cached.messages
                        );

                    setCurrentConversation(
                        cached
                    );

                    setMessages(
                        cachedMessages
                            .length
                            ? cachedMessages
                            : [
                                WELCOME_MESSAGE,
                            ]
                    );

                    setOpeningConversation(
                        false
                    );
                } else {
                    setCurrentConversation(
                        summary
                        || {
                            id:
                                conversationId,
                            title:
                                'Conversation',
                        }
                    );

                    setMessages([]);

                    setOpeningConversation(
                        true
                    );
                }

                setInput('');

                if (closeSidebar) {
                    setSidebarOpen(false);
                }

                try {
                    const response =
                        await authFetch(
                            `/my/ai-conversations/${conversationId}`
                        );

                    const payload =
                        await response
                            .json()
                            .catch(
                                () => ({})
                            );

                    if (!response.ok) {
                        throw new Error(
                            payload?.message
                            || 'This conversation could not be opened.'
                        );
                    }

                    const persisted =
                        payload
                            ?.conversation
                        || null;

                    if (!persisted) {
                        throw new Error(
                            'This conversation could not be opened.'
                        );
                    }

                    conversationCacheRef
                        .current
                        .set(
                            persisted.id,
                            persisted
                        );

                    if (
                        openConversationRequestRef
                            .current
                        !== requestId
                    ) {
                        return;
                    }

                    const persistedMessages =
                        normalizePersistedMessages(
                            persisted.messages
                        );

                    setCurrentConversation(
                        persisted
                    );

                    setMessages(
                        persistedMessages
                            .length
                            ? persistedMessages
                            : [
                                WELCOME_MESSAGE,
                            ]
                    );

                    setOpeningConversation(
                        false
                    );

                    setChatError('');
                } catch (error) {
                    if (
                        openConversationRequestRef
                            .current
                        !== requestId
                    ) {
                        return;
                    }

                    setOpeningConversation(
                        false
                    );

                    if (!cached) {
                        setChatError(
                            error.message
                            || 'This conversation could not be opened.'
                        );
                    }
                }
            },
            [
                sending,
            ]
        );

    const startNewConversation =
        useCallback(() => {
            if (sending) {
                return;
            }

            openConversationRequestRef
                .current += 1;

            setCurrentConversation(
                null
            );

            setOpeningConversation(
                false
            );

            setMessages([
                WELCOME_MESSAGE,
            ]);

            setInput('');
            setChatError('');
            setLastFailedPrompt('');
            setSelectedConversation(
                null
            );
            setActiveOverlay(null);
            setSidebarView('active');
            setSidebarOpen(false);

            window.setTimeout(
                () => {
                    textareaRef.current
                        ?.focus();
                },
                0
            );
        }, [
            sending,
        ]);

    const createConversation =
        useCallback(async () => {
            if (sending) {
                return null;
            }

            try {
                const response =
                    await authFetch(
                        '/my/ai-conversations',
                        {
                            method:
                                'POST',
                            body:
                                JSON.stringify(
                                    {}
                                ),
                        }
                    );

                const payload =
                    await response
                        .json()
                        .catch(
                            () => ({})
                        );

                if (!response.ok) {
                    throw new Error(
                        payload?.message
                        || 'A new conversation could not be created.'
                    );
                }

                const conversation =
                    payload
                        ?.conversation
                    || null;

                if (!conversation) {
                    throw new Error(
                        'A new conversation could not be created.'
                    );
                }

                conversationCacheRef
                    .current
                    .set(
                        conversation.id,
                        conversation
                    );

                setCurrentConversation(
                    conversation
                );

                return conversation;
            } catch (error) {
                setChatError(
                    error.message
                    || 'A new conversation could not be created.'
                );

                return null;
            }
        }, [
            sending,
        ]);

    const sendMessage =
        useCallback(
            async (
                promptText
            ) => {
                const text =
                    String(
                        promptText
                        !== undefined
                            ? promptText
                            : input
                    ).trim();

                if (
                    !text
                    || sending
                    || currentConversationArchived
                    || openingConversation
                ) {
                    return;
                }

                let conversation =
                    currentConversation;

                if (
                    !conversation?.id
                ) {
                    conversation =
                        await createConversation();

                    if (
                        !conversation?.id
                    ) {
                        return;
                    }
                }

                const optimisticUserMessage = {
                    id:
                        `user-${Date.now()}`,
                    role: 'user',
                    content:
                        text,
                };

                setMessages(
                    (current) => [
                        ...current,
                        optimisticUserMessage,
                    ]
                );

                setInput('');
                setSending(true);
                setChatError('');
                setLastFailedPrompt('');

                try {
                    const response =
                        await authFetch(
                            `/my/ai-conversations/${conversation.id}/messages`,
                            {
                                method:
                                    'POST',
                                body:
                                    JSON.stringify({
                                        content:
                                            text,
                                    }),
                            }
                        );

                    const payload =
                        await response
                            .json()
                            .catch(
                                () => ({})
                            );

                    if (!response.ok) {
                        throw new Error(
                            getErrorMessage(
                                response.status,
                                payload
                            )
                        );
                    }

                    const persisted =
                        payload
                            ?.conversation
                        || conversation;

                    const persistedMessages =
                        normalizePersistedMessages(
                            persisted
                                ?.messages
                        );

                    if (
                        persistedMessages
                            .length
                    ) {
                        setMessages(
                            persistedMessages
                        );
                    } else {
                        const reply =
                            String(
                                payload
                                    ?.reply
                                || ''
                            ).trim();

                        if (!reply) {
                            throw new Error(
                                'The AI explanation returned an empty response.'
                            );
                        }

                        setMessages(
                            (current) => [
                                ...current,
                                {
                                    id:
                                        `assistant-${Date.now()}`,
                                    role:
                                        'assistant',
                                    content:
                                        reply,
                                },
                            ]
                        );
                    }

                    if (
                        persisted?.id
                    ) {
                        conversationCacheRef
                            .current
                            .set(
                                persisted.id,
                                persisted
                            );
                    }

                    setCurrentConversation(
                        persisted
                    );

                    void refreshConversationLists({
                        quiet: true,
                    });
                } catch (error) {
                    setMessages(
                        (current) =>
                            current.filter(
                                (message) =>
                                    message.id
                                    !== optimisticUserMessage.id
                            )
                    );

                    setChatError(
                        error.message
                        || 'The AI explanation could not be loaded.'
                    );

                    setLastFailedPrompt(
                        text
                    );
                } finally {
                    setSending(false);

                    window.setTimeout(
                        () => {
                            textareaRef
                                .current
                                ?.focus();
                        },
                        0
                    );
                }
            },
            [
                createConversation,
                currentConversation,
                currentConversationArchived,
                input,
                openingConversation,
                refreshConversationLists,
                sending,
            ]
        );

    const requestConversationMenu =
        (
            conversation
        ) => {
            setSelectedConversation(
                conversation
            );

            setActiveOverlay(
                'conversation-menu'
            );
        };

    const beginRename = () => {
        if (!selectedConversation) {
            return;
        }

        setRenameValue(
            selectedConversation
                .title
            || ''
        );

        setActiveOverlay(
            'rename'
        );
    };

    const confirmRename = () => {
        const title =
            renameValue.trim();

        const conversation =
            selectedConversation;

        if (
            !title
            || !conversation
        ) {
            return;
        }

        setSelectedConversation({
            ...conversation,
            title,
            titleSource:
                'manual',
        });

        setActiveOverlay(null);

        void updateConversation(
            conversation,
            {
                title,
            }
        );
    };

    const requestArchive =
        (
            conversation
        ) => {
            if (!conversation) {
                return;
            }

            setSelectedConversation(
                conversation
            );

            setPendingArchiveState(
                !conversation
                    .isArchived
            );

            setActiveOverlay(
                'archive-confirm'
            );
        };

    const confirmArchive = () => {
        const conversation =
            selectedConversation;

        if (
            !conversation
            || pendingArchiveState
                === null
        ) {
            return;
        }

        const nextArchived =
            pendingArchiveState;

        setPendingArchiveState(
            null
        );

        setActiveOverlay(null);

        void updateConversation(
            conversation,
            {
                isArchived:
                    nextArchived,
            }
        );
    };

    const requestDelete =
        (
            conversation
        ) => {
            if (!conversation) {
                return;
            }

            setSelectedConversation(
                conversation
            );

            setActiveOverlay(
                'delete-confirm'
            );
        };

    const confirmDelete =
        useCallback(
            async () => {
                const conversation =
                    selectedConversation;

                if (
                    !conversation?.id
                ) {
                    return;
                }

                const cached =
                    conversationCacheRef
                        .current
                        .get(
                            conversation.id
                        );

                const original = {
                    ...cached,
                    ...conversation,
                    messages:
                        cached
                            ?.messages
                        || conversation
                            .messages
                        || [],
                };

                const deletingCurrent =
                    currentConversation
                        ?.id
                    === conversation.id;

                const previousMessages =
                    deletingCurrent
                        ? messages
                        : null;

                setActiveOverlay(null);
                setSelectedConversation(
                    null
                );

                conversationCacheRef
                    .current
                    .delete(
                        conversation.id
                    );

                setConversations(
                    (current) =>
                        current.filter(
                            (item) =>
                                item.id
                                !== conversation.id
                        )
                );

                setArchivedConversations(
                    (current) =>
                        current.filter(
                            (item) =>
                                item.id
                                !== conversation.id
                        )
                );

                if (deletingCurrent) {
                    openConversationRequestRef
                        .current += 1;

                    setCurrentConversation(
                        null
                    );

                    setOpeningConversation(
                        false
                    );

                    setMessages([
                        WELCOME_MESSAGE,
                    ]);

                    setInput('');
                    setChatError('');
                    setLastFailedPrompt('');
                }

                try {
                    const response =
                        await authFetch(
                            `/my/ai-conversations/${conversation.id}`,
                            {
                                method:
                                    'DELETE',
                            }
                        );

                    const payload =
                        await response
                            .json()
                            .catch(
                                () => ({})
                            );

                    if (!response.ok) {
                        throw new Error(
                            payload?.message
                            || 'The conversation could not be deleted.'
                        );
                    }

                    void refreshConversationLists({
                        quiet: true,
                    });
                } catch (error) {
                    conversationCacheRef
                        .current
                        .set(
                            original.id,
                            original
                        );

                    if (
                        original
                            .isArchived
                    ) {
                        setArchivedConversations(
                            (current) => [
                                original,
                                ...current.filter(
                                    (item) =>
                                        item.id
                                        !== original.id
                                ),
                            ]
                        );
                    } else {
                        setConversations(
                            (current) => [
                                original,
                                ...current.filter(
                                    (item) =>
                                        item.id
                                        !== original.id
                                ),
                            ]
                        );
                    }

                    if (
                        deletingCurrent
                    ) {
                        setCurrentConversation(
                            original
                        );

                        setMessages(
                            previousMessages
                                ?.length
                                ? previousMessages
                                : normalizePersistedMessages(
                                    original
                                        .messages
                                )
                        );
                    }

                    setConversationsError(
                        error.message
                        || 'The conversation could not be deleted.'
                    );
                }
            },
            [
                currentConversation,
                messages,
                refreshConversationLists,
                selectedConversation,
            ]
        );

    const handleSubmit =
        (event) => {
            event.preventDefault();

            void sendMessage();
        };

    const handleKeyDown =
        (event) => {
            if (
                event.key === 'Enter'
                && !event.shiftKey
            ) {
                event.preventDefault();

                void sendMessage();
            }
        };

    const renderConversationItem =
        (
            conversation
        ) => (
            <div
                key={
                    conversation.id
                }
                className={`${styles.patientAiSavedConversation}${
                    currentConversation?.id
                    === conversation.id
                        ? ` ${styles.patientAiSavedConversationActive}`
                        : ''
                }`}
            >
                <button
                    type="button"
                    className={
                        styles.patientAiSavedConversationMain
                    }
                    onClick={() =>
                        openConversation(
                            conversation
                        )
                    }
                >
                    <FaRobot
                        aria-hidden="true"
                        focusable="false"
                    />

                    <span>
                        {conversation.title
                        || 'New conversation'}
                    </span>
                </button>

                <button
                    type="button"
                    className={
                        styles.patientAiConversationMenuButton
                    }
                    onClick={() =>
                        requestConversationMenu(
                            conversation
                        )
                    }
                    aria-label={
                        `Conversation options for ${conversation.title || 'conversation'}`
                    }
                >
                    <FaEllipsisH
                        aria-hidden="true"
                        focusable="false"
                    />
                </button>
            </div>
        );

    const renderSidebarContent =
        () => {
            const showingArchived =
                sidebarView
                === 'archived';

            return (
                <>
                    <div
                        className={
                            styles.patientAiSidebarHeader
                        }
                    >
                        <button
                            type="button"
                            className={
                                styles.patientAiIconButton
                            }
                            onClick={() => {
                                if (
                                    showingArchived
                                ) {
                                    setSidebarView(
                                        'active'
                                    );
                                    return;
                                }

                                setActiveOverlay(
                                    null
                                );

                                setSidebarOpen(
                                    false
                                );
                            }}
                            aria-label={
                                showingArchived
                                    ? 'Back to conversations'
                                    : 'Close conversations'
                            }
                        >
                            {showingArchived ? (
                                <FaChevronLeft />
                            ) : (
                                <FaTimes />
                            )}
                        </button>

                        <strong>
                            {showingArchived
                                ? 'Archived'
                                : 'Chats'}
                        </strong>

                        <button
                            type="button"
                            className={
                                styles.patientAiIconButton
                            }
                            onClick={
                                startNewConversation
                            }
                            disabled={
                                sending
                            }
                            aria-label="New conversation"
                        >
                            <FaPlus />
                        </button>
                    </div>

                    {showingArchived ? (
                        <div
                            className={
                                styles.patientAiSavedList
                            }
                        >
                            {archivedConversations
                                .length ? (
                                archivedConversations
                                    .map(
                                        renderConversationItem
                                    )
                            ) : (
                                <p
                                    className={
                                        styles.patientAiSavedEmpty
                                    }
                                >
                                    No archived conversations.
                                </p>
                            )}
                        </div>
                    ) : (
                        <>
                            <div
                                className={
                                    styles.patientAiSidebarNewWrap
                                }
                            >
                                <button
                                    type="button"
                                    className={
                                        styles.patientAiNewConversationButton
                                    }
                                    onClick={
                                        startNewConversation
                                    }
                                    disabled={
                                        sending
                                    }
                                >
                                    <FaPlus />

                                    <span>
                                        New conversation
                                    </span>
                                </button>
                            </div>

                            {conversationsLoading ? (
                                <p
                                    className={
                                        styles.patientAiSavedEmpty
                                    }
                                >
                                    Loading saved conversations...
                                </p>
                            ) : null}

                            {conversationsError ? (
                                <div
                                    className={
                                        styles.patientAiSidebarError
                                    }
                                >
                                    <span>
                                        {conversationsError}
                                    </span>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            refreshConversationLists()
                                        }
                                    >
                                        Retry
                                    </button>
                                </div>
                            ) : null}

                            {!conversationsLoading ? (
                                <div
                                    className={
                                        styles.patientAiSavedList
                                    }
                                >
                                    {pinnedConversations
                                        .length ? (
                                        <>
                                            <span
                                                className={
                                                    styles.patientAiSavedSectionLabel
                                                }
                                            >
                                                PINNED
                                            </span>

                                            {pinnedConversations
                                                .map(
                                                    renderConversationItem
                                                )}
                                        </>
                                    ) : null}

                                    <span
                                        className={
                                            styles.patientAiSavedSectionLabel
                                        }
                                    >
                                        RECENT
                                    </span>

                                    {recentConversations
                                        .length ? (
                                        recentConversations
                                            .map(
                                                renderConversationItem
                                            )
                                    ) : (
                                        <p
                                            className={
                                                styles.patientAiSavedEmpty
                                            }
                                        >
                                            No saved conversations yet.
                                        </p>
                                    )}

                                    <button
                                        type="button"
                                        className={
                                            styles.patientAiArchivedLink
                                        }
                                        onClick={() =>
                                            setSidebarView(
                                                'archived'
                                            )
                                        }
                                    >
                                        <FaArchive />

                                        <span>
                                            Archived conversations
                                        </span>
                                    </button>
                                </div>
                            ) : null}
                        </>
                    )}
                </>
            );
        };

    return (
        <PatientPageFrame
            hideHeader
            title="AI Care Companion"
            bare={embedded}
        >
            <div
                className={`${styles.patientAiConversationShell}${
                    embedded
                        ? ` ${styles.patientAiConversationShellFloating}`
                        : ''
                }`}
                role={embedded ? 'dialog' : undefined}
                aria-modal={embedded ? 'false' : undefined}
                aria-label={embedded ? 'Patient AI Care Companion' : undefined}
            >
                <aside
                    className={`${styles.patientAiConversationSidebar}${
                        sidebarOpen
                            ? ` ${styles.patientAiConversationSidebarOpen}`
                            : ''
                    }`}
                >
                    {renderSidebarContent()}
                </aside>

                {sidebarOpen ? (
                    <button
                        type="button"
                        className={
                            styles.patientAiSidebarBackdrop
                        }
                        onClick={() =>
                            setSidebarOpen(
                                false
                            )
                        }
                        aria-label="Close saved conversations"
                    />
                ) : null}

                <section
                    className={
                        styles.patientAiConversationMain
                    }
                >
                    <header
                        className={`${styles.patientAiConversationTopBar}${
                            embedded
                                ? ` ${styles.patientAiFloatingTopBar}`
                                : ''
                        }`}
                    >
                        <div className={styles.patientAiTopBarLeft}>
                            <button
                                type="button"
                                className={styles.patientAiTopBarIconButton}
                                onClick={() => {
                                    setActiveOverlay(null);
                                    setSidebarView('active');
                                    setSidebarOpen(true);
                                }}
                                aria-label="Open saved conversations"
                                title="Chat history"
                            >
                                <FaBars />
                            </button>

                            {embedded ? (
                                <div className={styles.patientAiFloatingIdentity}>
                                    <span className={styles.patientAiFloatingAvatar} aria-hidden="true">
                                        <FaRobot />
                                    </span>
                                    <div className={styles.patientAiFloatingTitle}>
                                        <strong>NgitiFy AI</strong>
                                        <span>{currentConversation?.title || 'Care Companion'}</span>
                                    </div>
                                </div>
                            ) : null}
                        </div>

                        {!embedded ? (
                            <div className={styles.patientAiConversationTitleWrap}>
                                <strong>{currentConversation?.title || 'AI Care Companion'}</strong>
                                <span>AI Care Companion</span>
                            </div>
                        ) : null}

                        <button
                            type="button"
                            className={styles.patientAiInfoButton}
                            onClick={() => {
                                if (embedded) {
                                    onClose?.();
                                    return;
                                }

                                setActiveOverlay('info');
                            }}
                            aria-label={embedded ? 'Close AI Care Companion' : 'About AI Care Companion'}
                            title={embedded ? 'Close chat' : 'About AI Care Companion'}
                        >
                            {embedded ? <FaTimes /> : <FaInfoCircle />}
                        </button>
                    </header>

                    <div
                        className={
                            styles.patientAiConversationMessages
                        }
                        aria-live="polite"
                    >
                        {openingConversation ? (
                            <div
                                className={
                                    styles.patientAiConversationLoading
                                }
                            >
                                <FaRobot />

                                <span>
                                    Loading conversation...
                                </span>
                            </div>
                        ) : null}

                        {!openingConversation
                            ? messages.map(
                                (
                                    message
                                ) => (
                                    <div
                                        key={
                                            message.id
                                        }
                                        className={
                                            message.role
                                            === 'user'
                                                ? styles.patientAiMessageRowUser
                                                : styles.patientAiMessageRowAssistant
                                        }
                                    >
                                        {message.role
                                        === 'assistant' ? (
                                            <div
                                                className={
                                                    styles.patientAiMessageAvatar
                                                }
                                            >
                                                <FaRobot />
                                            </div>
                                        ) : null}

                                        <div
                                            className={
                                                message.role
                                                === 'user'
                                                    ? styles.patientAiUserBubble
                                                    : styles.patientAiAssistantBubble
                                            }
                                        >
                                            {String(
                                                message.content
                                                || ''
                                            )
                                                .split(
                                                    '\n'
                                                )
                                                .map(
                                                    (
                                                        line,
                                                        index
                                                    ) =>
                                                        line.trim() ? (
                                                            <p
                                                                key={`${message.id}-${index}`}
                                                            >
                                                                {line}
                                                            </p>
                                                        ) : (
                                                            <br
                                                                key={`${message.id}-${index}`}
                                                            />
                                                        )
                                                )}
                                        </div>
                                    </div>
                                )
                            )
                            : null}

                        {sending ? (
                            <div
                                className={
                                    styles.patientAiMessageRowAssistant
                                }
                            >
                                <div
                                    className={
                                        styles.patientAiMessageAvatar
                                    }
                                >
                                    <FaRobot />
                                </div>

                                <div
                                    className={
                                        styles.patientAiAssistantBubble
                                    }
                                >
                                    <div
                                        className={
                                            styles.patientAiTyping
                                        }
                                    >
                                        <span />
                                        <span />
                                        <span />
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        {chatError ? (
                            <div
                                className={
                                    styles.patientAiChatError
                                }
                                role="alert"
                            >
                                <FaExclamationTriangle />

                                <div>
                                    <strong>
                                        AI explanation unavailable
                                    </strong>

                                    <p>
                                        {chatError}
                                    </p>
                                </div>

                                {lastFailedPrompt ? (
                                    <button
                                        type="button"
                                        className={
                                            styles.patientAiRetryButton
                                        }
                                        onClick={() =>
                                            sendMessage(
                                                lastFailedPrompt
                                            )
                                        }
                                        disabled={
                                            sending
                                        }
                                    >
                                        <FaRedoAlt />
                                        Retry
                                    </button>
                                ) : null}
                            </div>
                        ) : null}

                        <div
                            ref={
                                messagesEndRef
                            }
                        />
                    </div>

                    {currentConversationArchived ? (
                        <div
                            className={
                                styles.patientAiArchivedNotice
                            }
                        >
                            This conversation is archived. Unarchive it to continue chatting.
                        </div>
                    ) : (
                        <div
                            className={
                                styles.patientAiConversationDock
                            }
                        >
                            <div
                                className={
                                    styles.patientAiConversationPromptRow
                                }
                            >
                                {QUICK_PROMPTS.map(
                                    (
                                        prompt
                                    ) => {
                                        const PromptIcon =
                                            prompt.icon;

                                        return (
                                            <button
                                                key={
                                                    prompt.id
                                                }
                                                type="button"
                                                onClick={() =>
                                                    sendMessage(
                                                        prompt.label
                                                    )
                                                }
                                                disabled={
                                                    sending
                                                    || openingConversation
                                                }
                                            >
                                                <PromptIcon />

                                                <span>
                                                    {prompt.label}
                                                </span>
                                            </button>
                                        );
                                    }
                                )}
                            </div>

                            <form
                                className={
                                    styles.patientAiComposer
                                }
                                onSubmit={
                                    handleSubmit
                                }
                            >
                                <label
                                    htmlFor="patient-ai-message"
                                    className={
                                        styles.srOnly
                                    }
                                >
                                    Message AI Care Companion
                                </label>

                                <textarea
                                    ref={
                                        textareaRef
                                    }
                                    id="patient-ai-message"
                                    className={
                                        styles.patientAiTextarea
                                    }
                                    value={
                                        input
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setInput(
                                            event
                                                .target
                                                .value
                                        )
                                    }
                                    onKeyDown={
                                        handleKeyDown
                                    }
                                    placeholder="Message AI Care Companion..."
                                    rows={2}
                                    maxLength={
                                        1500
                                    }
                                    disabled={
                                        sending
                                        || openingConversation
                                    }
                                />

                                <button
                                    type="submit"
                                    className={
                                        styles.patientAiSendButton
                                    }
                                    disabled={
                                        sending
                                        || openingConversation
                                        || !input
                                            .trim()
                                    }
                                    aria-label="Send message"
                                >
                                    <FaPaperPlane />
                                </button>
                            </form>
                        </div>
                    )}
                </section>

                {activeOverlay
                === 'info' ? (
                    <div
                        className={
                            styles.patientAiOverlayBackdrop
                        }
                        onMouseDown={(
                            event
                        ) => {
                            if (
                                event.target
                                === event.currentTarget
                            ) {
                                setActiveOverlay(
                                    null
                                );
                            }
                        }}
                    >
                        <section
                            className={
                                styles.patientAiInfoPanel
                            }
                            role="dialog"
                            aria-modal="true"
                            aria-label="About AI Care Companion"
                        >
                            <div
                                className={
                                    styles.patientAiOverlayHeader
                                }
                            >
                                <div>
                                    <span>
                                        AI CARE COMPANION
                                    </span>

                                    <h2>
                                        About this chat
                                    </h2>
                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setActiveOverlay(
                                            null
                                        )
                                    }
                                    aria-label="Close information"
                                >
                                    <FaTimes />
                                </button>
                            </div>

                            <div
                                className={
                                    styles.patientAiInfoScroll
                                }
                            >
                                <section>
                                    <h3>
                                        What NgitiFy already knows
                                    </h3>

                                    {careError ? (
                                        <p
                                            className={
                                                styles.patientAiInfoError
                                            }
                                        >
                                            {careError}
                                        </p>
                                    ) : null}
                                </section>

                                <section>
                                    <span
                                        className={
                                            styles.patientAiInfoEyebrow
                                        }
                                    >
                                        SYSTEM RECOMMENDATION
                                    </span>

                                    <h3>
                                        Recommended Visit Window
                                    </h3>

                                    <strong
                                        className={
                                            styles.patientAiInfoStrong
                                        }
                                    >
                                        {recommendationLabel}
                                    </strong>

                                    {recommendationWindow ? (
                                        <p>
                                            {recommendationWindow}
                                        </p>
                                    ) : null}

                                    <p>
                                        {recommendationReason}
                                    </p>

                                    {visitInfo
                                        ?.contactClinicSooner ? (
                                        <p
                                            className={
                                                styles.patientAiInfoNotice
                                            }
                                        >
                                            {visitInfo
                                                .contactClinicReason
                                            || 'NgitiFy suggests contacting the clinic sooner.'}
                                        </p>
                                    ) : null}

                                    <small>
                                        This System Recommendation comes from NgitiFy&apos;s deterministic backend rules. AI may explain it but may not calculate, postpone, replace, or override it.
                                    </small>
                                </section>

                                <section>
                                    <span
                                        className={
                                            styles.patientAiInfoEyebrow
                                        }
                                    >
                                        ORAL HEALTH MANAGEMENT
                                    </span>

                                    <h3>
                                        Relevant recorded context
                                    </h3>

                                    <p>
                                        {latestLogDate
                                            ? `Latest saved log: ${formatDateKey(latestLogDate)}.`
                                            : 'No recent Daily Oral Health Log is available yet.'}
                                    </p>

                                    <p>
                                        Recent logs: {oralHealthSummary.recentLogCount ?? recentLogs.length}
                                    </p>

                                    <small>
                                        Oral Health Management entries are recorded context only. They help AI explain existing information and do not become a diagnosis.
                                    </small>
                                </section>

                                <section>
                                    <span
                                        className={
                                            styles.patientAiInfoEyebrow
                                        }
                                    >
                                        DENTAL HEALTH EDUCATION
                                    </span>

                                    <h3>
                                        Relevant approved education
                                    </h3>

                                    {contextualEducation
                                        .length ? (
                                        contextualEducation
                                            .slice(
                                                0,
                                                3
                                            )
                                            .map(
                                                (
                                                    article
                                                ) => (
                                                    <div
                                                        key={
                                                            article.id
                                                        }
                                                        className={
                                                            styles.patientAiInfoEducation
                                                        }
                                                    >
                                                        <span>
                                                            {article.category
                                                            || 'Dental Health Education'}
                                                        </span>

                                                        <strong>
                                                            {article.title}
                                                        </strong>
                                                    </div>
                                                )
                                            )
                                    ) : (
                                        <p>
                                            No contextual Dental Health Education topics are currently matched to your recent logs.
                                        </p>
                                    )}

                                    <small>
                                        Dental Health Education remains approved educational content. AI must not provide a diagnosis.
                                    </small>
                                </section>

                                <div
                                    className={
                                        styles.patientAiInfoSafety
                                    }
                                >
                                    <FaExclamationTriangle />

                                    <p>
                                        AI Care Companion is educational and explanatory. It does not diagnose conditions or replace professional dental care. Contact the clinic if symptoms persist, worsen, or concern you.
                                    </p>
                                </div>
                            </div>
                        </section>
                    </div>
                ) : null}

                {activeOverlay
                === 'conversation-menu' ? (
                    <div
                        className={
                            styles.patientAiOverlayBackdrop
                        }
                        onMouseDown={(
                            event
                        ) => {
                            if (
                                event.target
                                === event.currentTarget
                            ) {
                                setActiveOverlay(
                                    null
                                );
                            }
                        }}
                    >
                        <section
                            className={
                                styles.patientAiActionPanel
                            }
                            role="dialog"
                            aria-modal="true"
                        >
                            <h3>
                                {selectedConversation
                                    ?.title
                                || 'Conversation'}
                            </h3>

                            <button
                                type="button"
                                onClick={
                                    beginRename
                                }
                            >
                                <FaPen />
                                Rename
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    const conversation =
                                        selectedConversation;

                                    if (!conversation) {
                                        return;
                                    }

                                    setActiveOverlay(
                                        null
                                    );

                                    void updateConversation(
                                        conversation,
                                        {
                                            isPinned:
                                                !conversation
                                                    .isPinned,
                                        }
                                    );
                                }}
                            >
                                {selectedConversation
                                    ?.isPinned
                                    ? 'Unpin'
                                    : 'Pin'}
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    requestArchive(
                                        selectedConversation
                                    )
                                }
                            >
                                <FaArchive />

                                {selectedConversation
                                    ?.isArchived
                                    ? 'Unarchive'
                                    : 'Archive'}
                            </button>

                            <button
                                type="button"
                                className={
                                    styles.patientAiDangerAction
                                }
                                onClick={() =>
                                    requestDelete(
                                        selectedConversation
                                    )
                                }
                            >
                                <FaTrash />
                                Delete
                            </button>
                        </section>
                    </div>
                ) : null}

                {activeOverlay
                === 'rename' ? (
                    <div
                        className={
                            styles.patientAiOverlayBackdrop
                        }
                    >
                        <section
                            className={
                                styles.patientAiConfirmPanel
                            }
                            role="dialog"
                            aria-modal="true"
                        >
                            <h3>
                                Rename conversation
                            </h3>

                            <input
                                type="text"
                                value={
                                    renameValue
                                }
                                onChange={(
                                    event
                                ) =>
                                    setRenameValue(
                                        event
                                            .target
                                            .value
                                    )
                                }
                                maxLength={
                                    100
                                }
                                autoFocus
                            />

                            <div
                                className={
                                    styles.patientAiConfirmActions
                                }
                            >
                                <button
                                    type="button"
                                    onClick={() =>
                                        setActiveOverlay(
                                            null
                                        )
                                    }
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    className={
                                        styles.patientAiConfirmPrimary
                                    }
                                    onClick={
                                        confirmRename
                                    }
                                    disabled={
                                        !renameValue
                                            .trim()
                                    }
                                >
                                    Save
                                </button>
                            </div>
                        </section>
                    </div>
                ) : null}

                {activeOverlay
                === 'archive-confirm' ? (
                    <div
                        className={
                            styles.patientAiOverlayBackdrop
                        }
                    >
                        <section
                            className={
                                styles.patientAiConfirmPanel
                            }
                            role="dialog"
                            aria-modal="true"
                        >
                            <h3>
                                {pendingArchiveState
                                    ? 'Archive conversation?'
                                    : 'Unarchive conversation?'}
                            </h3>

                            <p>
                                {pendingArchiveState
                                    ? 'This conversation will move to Archived and become read-only.'
                                    : 'This conversation will return to your active chats and you can continue messaging.'}
                            </p>

                            <div
                                className={
                                    styles.patientAiConfirmActions
                                }
                            >
                                <button
                                    type="button"
                                    onClick={() => {
                                        setPendingArchiveState(
                                            null
                                        );

                                        setActiveOverlay(
                                            null
                                        );
                                    }}
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    className={
                                        styles.patientAiConfirmPrimary
                                    }
                                    onClick={
                                        confirmArchive
                                    }
                                >
                                    {pendingArchiveState
                                        ? 'Archive'
                                        : 'Unarchive'}
                                </button>
                            </div>
                        </section>
                    </div>
                ) : null}

                {activeOverlay
                === 'delete-confirm' ? (
                    <div
                        className={
                            styles.patientAiOverlayBackdrop
                        }
                    >
                        <section
                            className={
                                styles.patientAiConfirmPanel
                            }
                            role="dialog"
                            aria-modal="true"
                        >
                            <h3>
                                Delete conversation?
                            </h3>

                            <p>
                                This permanently deletes this saved conversation and its message history.
                            </p>

                            <div
                                className={
                                    styles.patientAiConfirmActions
                                }
                            >
                                <button
                                    type="button"
                                    onClick={() =>
                                        setActiveOverlay(
                                            null
                                        )
                                    }
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    className={
                                        styles.patientAiConfirmDanger
                                    }
                                    onClick={
                                        confirmDelete
                                    }
                                >
                                    Delete
                                </button>
                            </div>
                        </section>
                    </div>
                ) : null}
            </div>
        </PatientPageFrame>
    );
};

export default PatientAiCompanion;
