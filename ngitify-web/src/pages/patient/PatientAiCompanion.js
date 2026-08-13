import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    FaBook,
    FaCalendarAlt,
    FaExclamationTriangle,
    FaPaperPlane,
    FaRedoAlt,
    FaRobot,
    FaTooth,
} from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import {
    PatientPageFrame,
} from '../../components/patient/PatientFrame';
import styles from '../../styles/patient/PatientPortal.module.css';

const QUICK_PROMPTS = [
    {
        id: 'visit-recommendation',
        icon: FaCalendarAlt,
        label: 'Explain my current visit recommendation',
    },
    {
        id: 'oral-health-trend',
        icon: FaTooth,
        label: 'Explain my recent Oral Health Management trend',
    },
    {
        id: 'education',
        icon: FaBook,
        label: 'Give me Dental Health Education related to my recent log',
    },
    {
        id: 'appointment',
        icon: FaCalendarAlt,
        label: 'Help me understand my upcoming appointment',
    },
    {
        id: 'home-care',
        icon: FaTooth,
        label: 'Give me brushing and flossing guidance',
    },
];

const WELCOME_MESSAGE = {
    id: 'welcome',
    role: 'assistant',
    content:
        'Hello! I can explain your existing NgitiFy care information, Dental Health Education, appointments, and Oral Health Management records. I can help you understand what the system already shows, but I do not diagnose conditions or create my own medical recommendations.',
};

const formatDateKey = (value) => {
    if (!value) return '';

    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);

    if (!match) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value);

        return date.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }

    const [, year, month, day] = match;
    const date = new Date(
        Number(year),
        Number(month) - 1,
        Number(day)
    );

    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

const getErrorMessage = (status, payload) => {
    if (status === 429) {
        return 'The AI request limit has been reached for now. Your Oral Health Management, Recommended Visit Window, Dental Health Education, appointments, and records are still available.';
    }

    if (status === 503) {
        return 'The AI explanation service is temporarily unavailable. Your System Recommendation and other core NgitiFy care features are still available.';
    }

    return (
        payload?.message
        || 'The AI explanation could not be loaded. Please try again.'
    );
};

const PatientAiCompanion = () => {
    const { user } = useAuth();

    const [visitInfo, setVisitInfo] = useState(null);
    const [oralHealth, setOralHealth] = useState(null);
    const [careLoading, setCareLoading] = useState(true);
    const [careError, setCareError] = useState('');

    const [messages, setMessages] = useState([
        WELCOME_MESSAGE,
    ]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [chatError, setChatError] = useState('');
    const [lastFailedPrompt, setLastFailedPrompt] = useState('');

    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);

    const fetchCareSnapshot = useCallback(async () => {
        setCareLoading(true);
        setCareError('');

        try {
            const [
                predictionResponse,
                oralHealthResponse,
            ] = await Promise.all([
                authFetch('/my/visit-prediction'),
                authFetch('/my/oral-health'),
            ]);

            if (!predictionResponse.ok) {
                throw new Error(
                    'Recommended Visit Window could not be loaded.'
                );
            }

            if (!oralHealthResponse.ok) {
                throw new Error(
                    'Oral Health Management could not be loaded.'
                );
            }

            const predictionPayload =
                await predictionResponse.json();

            const oralHealthPayload =
                await oralHealthResponse.json();

            setVisitInfo(
                predictionPayload?.prediction || null
            );

            setOralHealth(
                oralHealthPayload
                && typeof oralHealthPayload === 'object'
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

    useEffect(() => {
        fetchCareSnapshot();
    }, [fetchCareSnapshot]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'end',
        });
    }, [messages, sending]);

    const oralHealthSummary = useMemo(
        () => (
            oralHealth?.summary
            && typeof oralHealth.summary === 'object'
                ? oralHealth.summary
                : {}
        ),
        [oralHealth]
    );

    const recentLogs = useMemo(
        () => (
            Array.isArray(oralHealth?.logs)
                ? oralHealth.logs
                : []
        ),
        [oralHealth]
    );

    const contextualEducation = useMemo(
        () => (
            Array.isArray(oralHealth?.contextualEducation)
                ? oralHealth.contextualEducation
                : []
        ),
        [oralHealth]
    );

    const recommendationLabel =
        visitInfo?.label
        || (
            careLoading
                ? 'Loading...'
                : 'Insufficient Data'
        );

    const recommendationWindow =
        visitInfo?.windowLabel
        || visitInfo?.recommendedDateLabel
        || '';

    const recommendationReason =
        visitInfo?.recommendationReason
        || (
            visitInfo
                ? 'NgitiFy is using the current system recommendation.'
                : 'NgitiFy does not currently have enough supported clinic information to create a visit window.'
        );

    const latestLogDate =
        oralHealthSummary.lastLogDateKey
        || recentLogs[0]?.logDateKey
        || '';

    const sendMessage = useCallback(async (promptText) => {
        const text = String(
            promptText !== undefined
                ? promptText
                : input
        ).trim();

        if (!text || sending) {
            return;
        }

        const userMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: text,
        };

        const existingConversation = messages
            .filter(
                (message) =>
                    message.id !== 'welcome'
                    && message.content
            )
            .map((message) => ({
                role: message.role,
                content: message.content,
            }));

        const apiMessages = [
            ...existingConversation,
            {
                role: 'user',
                content: text,
            },
        ];

        setInput('');
        setChatError('');
        setLastFailedPrompt('');
        setSending(true);

        setMessages((current) => [
            ...current,
            userMessage,
        ]);

        try {
            const response = await authFetch('/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: apiMessages,
                    assistantContext: {
                        clientUiState: {
                            source: 'patient-web',
                            currentModule:
                                'Patient AI Assistant',
                            requestedAt:
                                new Date().toISOString(),
                        },
                    },
                }),
            });

            const payload = await response
                .json()
                .catch(() => ({}));

            if (!response.ok) {
                throw Object.assign(
                    new Error(
                        getErrorMessage(
                            response.status,
                            payload
                        )
                    ),
                    {
                        status: response.status,
                    }
                );
            }

            const reply = String(
                payload?.reply || ''
            ).trim();

            if (!reply) {
                throw new Error(
                    'The AI explanation returned an empty response.'
                );
            }

            setMessages((current) => [
                ...current,
                {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: reply,
                },
            ]);
        } catch (error) {
            setChatError(
                error.message
                || 'The AI explanation could not be loaded.'
            );

            setLastFailedPrompt(text);
        } finally {
            setSending(false);

            window.setTimeout(() => {
                textareaRef.current?.focus();
            }, 0);
        }
    }, [
        input,
        messages,
        sending,
    ]);

    const handleSubmit = (event) => {
        event.preventDefault();
        sendMessage();
    };

    const handleKeyDown = (event) => {
        if (
            event.key === 'Enter'
            && !event.shiftKey
        ) {
            event.preventDefault();
            sendMessage();
        }
    };

    const clearConversation = () => {
        if (sending) return;

        setMessages([
            WELCOME_MESSAGE,
        ]);

        setInput('');
        setChatError('');
        setLastFailedPrompt('');
    };

    return (
        <PatientPageFrame
            title="AI Care Companion"
            subtitle="AI explanations for your existing NgitiFy care information, with the System Recommendation kept separate and authoritative."
        >
            <div className={styles.patientAiPageGrid}>
                <aside className={styles.patientAiContextColumn}>
                    <section className={styles.patientAiContextCard}>
                        <div className={styles.patientAiContextHeading}>
                            <div className={styles.patientAiContextIcon}>
                                <FaCalendarAlt
                                    aria-hidden="true"
                                    focusable="false"
                                />
                            </div>

                            <div>
                                <span className={styles.patientAiContextEyebrow}>
                                    System Recommendation
                                </span>

                                <h2 className={styles.patientAiContextTitle}>
                                    Recommended Visit Window
                                </h2>
                            </div>
                        </div>

                        {careLoading ? (
                            <div className={styles.patientAiContextLoading}>
                                Loading your current recommendation...
                            </div>
                        ) : careError ? (
                            <div className={styles.patientAiContextError}>
                                <FaExclamationTriangle
                                    aria-hidden="true"
                                    focusable="false"
                                />

                                <span>{careError}</span>
                            </div>
                        ) : (
                            <>
                                <div className={styles.patientAiRecommendationStatus}>
                                    {recommendationLabel}
                                </div>

                                {recommendationWindow ? (
                                    <p className={styles.patientAiRecommendationWindow}>
                                        {recommendationWindow}
                                    </p>
                                ) : null}

                                <p className={styles.patientAiContextText}>
                                    {recommendationReason}
                                </p>

                                {visitInfo?.contactClinicSooner ? (
                                    <div className={styles.patientAiContactNotice}>
                                        <strong>
                                            Contact clinic guidance
                                        </strong>

                                        <span>
                                            {visitInfo.contactClinicReason
                                            || 'The deterministic NgitiFy recommendation suggests contacting the clinic sooner.'}
                                        </span>
                                    </div>
                                ) : null}
                            </>
                        )}

                        <div className={styles.patientAiAuthorityNotice}>
                            <strong>
                                System Recommendation
                            </strong>

                            <span>
                                This is produced by NgitiFy&apos;s deterministic backend rules. The AI may explain it but does not calculate, postpone, or override it.
                            </span>
                        </div>
                    </section>

                    <section className={styles.patientAiContextCard}>
                        <div className={styles.patientAiContextHeading}>
                            <div className={styles.patientAiContextIcon}>
                                <FaTooth
                                    aria-hidden="true"
                                    focusable="false"
                                />
                            </div>

                            <div>
                                <span className={styles.patientAiContextEyebrow}>
                                    Oral Health Management
                                </span>

                                <h2 className={styles.patientAiContextTitle}>
                                    Recent context
                                </h2>
                            </div>
                        </div>

                        <div className={styles.patientAiMiniStats}>
                            <div className={styles.patientAiMiniStat}>
                                <strong>
                                    {oralHealthSummary.recentLogCount
                                    ?? recentLogs.length}
                                </strong>

                                <span>Recent logs</span>
                            </div>

                            <div className={styles.patientAiMiniStat}>
                                <strong>
                                    {contextualEducation.length}
                                </strong>

                                <span>Related topics</span>
                            </div>
                        </div>

                        <p className={styles.patientAiContextText}>
                            {latestLogDate
                                ? `Latest saved log: ${formatDateKey(latestLogDate)}.`
                                : 'No recent Daily Oral Health Log is available yet.'}
                        </p>

                        <div className={styles.patientAiAuthorityNotice}>
                            <strong>
                                Recorded context only
                            </strong>

                            <span>
                                Oral Health Management information helps the AI explain your existing records. It does not become a diagnosis.
                            </span>
                        </div>
                    </section>

                    <section className={styles.patientAiContextCard}>
                        <div className={styles.patientAiContextHeading}>
                            <div className={styles.patientAiContextIcon}>
                                <FaBook
                                    aria-hidden="true"
                                    focusable="false"
                                />
                            </div>

                            <div>
                                <span className={styles.patientAiContextEyebrow}>
                                    Dental Health Education
                                </span>

                                <h2 className={styles.patientAiContextTitle}>
                                    Approved education
                                </h2>
                            </div>
                        </div>

                        {contextualEducation.length ? (
                            <div className={styles.patientAiEducationList}>
                                {contextualEducation
                                    .slice(0, 3)
                                    .map((article) => (
                                        <div
                                            key={article.id}
                                            className={styles.patientAiEducationItem}
                                        >
                                            <span>
                                                {article.category
                                                || 'Dental Health Education'}
                                            </span>

                                            <strong>
                                                {article.title}
                                            </strong>
                                        </div>
                                    ))}
                            </div>
                        ) : (
                            <p className={styles.patientAiContextText}>
                                No contextual Dental Health Education topics are currently matched to your recent logs.
                            </p>
                        )}

                        <div className={styles.patientAiAuthorityNotice}>
                            <strong>
                                Education, not diagnosis
                            </strong>

                            <span>
                                Critical education continues to come from NgitiFy&apos;s approved Dental Health Education library rather than depending on AI generation.
                            </span>
                        </div>
                    </section>
                </aside>

                <section className={styles.patientAiChatCard}>
                    <div className={styles.patientAiChatHeader}>
                        <div className={styles.patientAiChatIdentity}>
                            <div className={styles.patientAiRobotAvatar}>
                                <FaRobot
                                    aria-hidden="true"
                                    focusable="false"
                                />
                            </div>

                            <div>
                                <span className={styles.patientAiChatEyebrow}>
                                    AI Explanation
                                </span>

                                <h2 className={styles.patientAiChatTitle}>
                                    Ask NgitiFy
                                </h2>

                                <p className={styles.patientAiChatSubtitle}>
                                    {user?.firstName
                                        ? `Ask questions about your existing care information, ${user.firstName}.`
                                        : 'Ask questions about your existing care information.'}
                                </p>
                            </div>
                        </div>

                        <button
                            type="button"
                            className={styles.patientAiClearButton}
                            onClick={clearConversation}
                            disabled={
                                sending
                                || messages.length <= 1
                            }
                        >
                            Clear
                        </button>
                    </div>

                    <div className={styles.patientAiQuickPromptSection}>
                        <span className={styles.patientAiQuickPromptLabel}>
                            Suggested prompts
                        </span>

                        <div className={styles.patientAiPromptGrid}>
                            {QUICK_PROMPTS.map((prompt) => {
                                const PromptIcon = prompt.icon;

                                return (
                                    <button
                                        key={prompt.id}
                                        type="button"
                                        className={styles.patientAiPromptButton}
                                        onClick={() =>
                                            sendMessage(
                                                prompt.label
                                            )
                                        }
                                        disabled={sending}
                                    >
                                        <PromptIcon
                                            aria-hidden="true"
                                            focusable="false"
                                        />

                                        <span>
                                            {prompt.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div
                        className={styles.patientAiMessages}
                        aria-live="polite"
                    >
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={
                                    message.role === 'user'
                                        ? styles.patientAiMessageRowUser
                                        : styles.patientAiMessageRowAssistant
                                }
                            >
                                {message.role === 'assistant' ? (
                                    <div className={styles.patientAiMessageAvatar}>
                                        <FaRobot
                                            aria-hidden="true"
                                            focusable="false"
                                        />
                                    </div>
                                ) : null}

                                <div
                                    className={
                                        message.role === 'user'
                                            ? styles.patientAiUserBubble
                                            : styles.patientAiAssistantBubble
                                    }
                                >
                                    {String(
                                        message.content || ''
                                    )
                                        .split('\n')
                                        .map((line, index) => (
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
                                        ))}
                                </div>
                            </div>
                        ))}

                        {sending ? (
                            <div className={styles.patientAiMessageRowAssistant}>
                                <div className={styles.patientAiMessageAvatar}>
                                    <FaRobot
                                        aria-hidden="true"
                                        focusable="false"
                                    />
                                </div>

                                <div className={styles.patientAiAssistantBubble}>
                                    <div
                                        className={styles.patientAiTyping}
                                        aria-label="AI is preparing an explanation"
                                    >
                                        <span />
                                        <span />
                                        <span />
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        <div ref={messagesEndRef} />
                    </div>

                    {chatError ? (
                        <div
                            className={styles.patientAiChatError}
                            role="alert"
                        >
                            <FaExclamationTriangle
                                aria-hidden="true"
                                focusable="false"
                            />

                            <div>
                                <strong>
                                    AI explanation unavailable
                                </strong>

                                <p>{chatError}</p>
                            </div>

                            {lastFailedPrompt ? (
                                <button
                                    type="button"
                                    className={styles.patientAiRetryButton}
                                    onClick={() =>
                                        sendMessage(
                                            lastFailedPrompt
                                        )
                                    }
                                    disabled={sending}
                                >
                                    <FaRedoAlt
                                        aria-hidden="true"
                                        focusable="false"
                                    />
                                    Retry
                                </button>
                            ) : null}
                        </div>
                    ) : null}

                    <form
                        className={styles.patientAiComposer}
                        onSubmit={handleSubmit}
                    >
                        <label
                            htmlFor="patient-ai-message"
                            className={styles.srOnly}
                        >
                            Ask the Patient AI Assistant
                        </label>

                        <textarea
                            ref={textareaRef}
                            id="patient-ai-message"
                            className={styles.patientAiTextarea}
                            value={input}
                            onChange={(event) =>
                                setInput(
                                    event.target.value
                                )
                            }
                            onKeyDown={handleKeyDown}
                            placeholder="Ask about your visit recommendation, recent trend, appointment, or Dental Health Education..."
                            rows={2}
                            maxLength={1500}
                            disabled={sending}
                        />

                        <button
                            type="submit"
                            className={styles.patientAiSendButton}
                            disabled={
                                sending
                                || !input.trim()
                            }
                            aria-label="Send message"
                        >
                            <FaPaperPlane
                                aria-hidden="true"
                                focusable="false"
                            />
                        </button>
                    </form>

                    <div className={styles.patientAiDisclaimer}>
                        <FaExclamationTriangle
                            aria-hidden="true"
                            focusable="false"
                        />

                        <p>
                            AI information is educational and explanatory, not a diagnosis. The AI does not independently calculate medical urgency or replace your dentist&apos;s recommendation. Contact the clinic if symptoms persist, worsen, or concern you.
                        </p>
                    </div>
                </section>
            </div>
        </PatientPageFrame>
    );
};

export default PatientAiCompanion;