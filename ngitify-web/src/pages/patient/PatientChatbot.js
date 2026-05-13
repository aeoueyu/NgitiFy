import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FaPaperPlane, FaRobot, FaTrash } from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { CHATBOT_SUGGESTIONS, CHATBOT_WELCOME_MESSAGE } from '../../utils/patientPortal';
import { PatientPageFrame } from '../../components/patient/PatientFrame';
import styles from '../../styles/patient/PatientPortal.module.css';

const buildConversationHistory = (messages) => messages
    .filter((message, index) => message.role === 'user' || index > 0)
    .slice(-10)
    .map((message) => ({
        role: message.role,
        content: message.content,
    }));

function normalizeChatErrorMessage(rawMessage = '') {
    if (rawMessage === 'AI features are not enabled.') {
        return 'NgitiBot is not enabled on the server right now. Please contact the clinic for help.';
    }
    if (rawMessage === 'Too many AI requests. Please wait before trying again.') {
        return 'NgitiBot is handling many requests right now. Please wait a bit, then try again.';
    }
    if (
        rawMessage === 'Token expired. Please log in again.'
        || rawMessage === 'Invalid token.'
        || rawMessage === 'Access denied. No token provided.'
    ) {
        return 'Your session expired. Please log in again, then try NgitiBot once more.';
    }
    return 'I am having trouble connecting right now. Please try again in a moment, or contact the clinic directly.';
}

export default function PatientChatbot() {
    const [messages, setMessages] = useState([
        { id: 'welcome', role: 'assistant', content: CHATBOT_WELCOME_MESSAGE },
    ]);
    const [inputValue, setInputValue] = useState('');
    const [visitPrediction, setVisitPrediction] = useState(null);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        let isMounted = true;
        const fetchPrediction = async () => {
            try {
                const response = await authFetch('/my/visit-prediction');
                if (!response.ok) return;
                const payload = await response.json();
                if (isMounted) {
                    setVisitPrediction(payload?.prediction || null);
                }
            } catch {
                if (isMounted) {
                    setVisitPrediction(null);
                }
            }
        };

        fetchPrediction();
        return () => {
            isMounted = false;
        };
    }, []);

    const assistantContext = useMemo(() => (
        visitPrediction
            ? {
                patientVisitWindow: {
                    status: visitPrediction.label,
                    daysUntilWindow: visitPrediction.daysUntilWindowStart,
                    nextDate: visitPrediction.recommendedDateLabel || visitPrediction.nextDate,
                    windowStart: visitPrediction.windowStartLabel,
                    windowEnd: visitPrediction.windowEndLabel,
                    historyCount: visitPrediction.historyCount,
                    lastVisitDate: visitPrediction.lastVisitDate,
                    lastProcedure: visitPrediction.lastProcedure,
                    recommendationReason: visitPrediction.recommendationReason,
                },
            }
            : null
    ), [visitPrediction]);

    const sendMessage = useCallback(async (text) => {
        const content = String(text || inputValue).trim();
        if (!content || sending) return;

        const nextUserMessage = { id: `${Date.now()}-user`, role: 'user', content };
        const nextMessages = [...messages, nextUserMessage];
        setMessages(nextMessages);
        setInputValue('');
        setSending(true);

        try {
            const response = await authFetch('/ai/chat', {
                method: 'POST',
                body: JSON.stringify({
                    messages: buildConversationHistory(nextMessages),
                    assistantContext,
                }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
                throw new Error(payload?.message || 'Network response was not ok');
            }

            setMessages((current) => [
                ...current,
                {
                    id: `${Date.now()}-assistant`,
                    role: 'assistant',
                    content: String(payload?.reply || '').trim() || 'Please contact the clinic for help.',
                },
            ]);
        } catch (error) {
            setMessages((current) => [
                ...current,
                {
                    id: `${Date.now()}-assistant-error`,
                    role: 'assistant',
                    content: normalizeChatErrorMessage(String(error?.message || '').trim()),
                },
            ]);
        } finally {
            setSending(false);
        }
    }, [assistantContext, inputValue, messages, sending]);

    return (
        <PatientPageFrame
            title="NgitiBot"
            subtitle="Ask about appointment details, available booking slots for your branch, post-op support, and approved routine dental guidance."
            actions={(
                <button
                    type="button"
                    className={styles.buttonSecondary}
                    onClick={() => {
                        setMessages([{ id: 'welcome', role: 'assistant', content: CHATBOT_WELCOME_MESSAGE }]);
                        setInputValue('');
                    }}
                >
                    <FaTrash style={{ marginRight: '8px' }} />
                    Clear Chat
                </button>
            )}
        >
            <div className={styles.heroGrid}>
                <section className={`${styles.heroCard} ${styles.heroCardDark}`}>
                    <span className={styles.heroTag}>Patient AI Chat</span>
                    <h2 className={styles.heroTitle}>Talk to NgitiBot on web</h2>
                    <p className={styles.heroText}>
                        NgitiBot uses live Dentime patient context when needed, including your active appointments and visit-window explanation, while staying inside approved dental guidance.
                    </p>
                </section>
                <section className={styles.summaryCard}>
                    <span className={styles.infoLabel}>Quick Questions</span>
                    <div className={styles.detailPills} style={{ marginTop: '12px' }}>
                        {CHATBOT_SUGGESTIONS.map((suggestion) => (
                            <button
                                key={suggestion}
                                type="button"
                                className={styles.detailPill}
                                onClick={() => setInputValue(suggestion)}
                                style={{ cursor: 'pointer' }}
                            >
                                {suggestion}
                            </button>
                        ))}
                    </div>
                </section>
            </div>

            <section className={styles.summaryCard} style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minHeight: '420px' }}>
                    {messages.map((message) => (
                        <div
                            key={message.id}
                            style={{
                                display: 'flex',
                                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                            }}
                        >
                            <div
                                style={{
                                    maxWidth: '78%',
                                    padding: '14px 16px',
                                    borderRadius: '18px',
                                    background: message.role === 'user' ? '#01538b' : '#ffffff',
                                    color: message.role === 'user' ? '#ffffff' : '#17364a',
                                    border: message.role === 'user' ? 'none' : '1px solid rgba(1, 83, 139, 0.08)',
                                    boxShadow: message.role === 'user' ? '0 12px 22px rgba(1, 83, 139, 0.18)' : '0 8px 18px rgba(15, 23, 42, 0.04)',
                                }}
                            >
                                {message.role === 'assistant' ? (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '12px', fontWeight: 800, color: '#2dccf6' }}>
                                        <FaRobot />
                                        NgitiBot
                                    </div>
                                ) : null}
                                {message.content.split('\n').map((line, index) => (
                                    <p key={`${message.id}-${index}`} style={{ margin: index === 0 ? 0 : '8px 0 0', lineHeight: 1.65 }}>
                                        {line}
                                    </p>
                                ))}
                            </div>
                        </div>
                    ))}
                    {sending ? (
                        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                            <div
                                style={{
                                    padding: '14px 16px',
                                    borderRadius: '18px',
                                    background: '#ffffff',
                                    border: '1px solid rgba(1, 83, 139, 0.08)',
                                    color: '#698191',
                                    fontWeight: 700,
                                }}
                            >
                                NgitiBot is typing...
                            </div>
                        </div>
                    ) : null}
                </div>
            </section>

            <section className={styles.summaryCard}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <textarea
                        className={styles.textarea}
                        style={{ minHeight: '72px', margin: 0 }}
                        value={inputValue}
                        onChange={(event) => setInputValue(event.target.value)}
                        placeholder="Message NgitiBot..."
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault();
                                sendMessage();
                            }
                        }}
                    />
                    <button
                        type="button"
                        className={styles.buttonPrimary}
                        onClick={() => sendMessage()}
                        disabled={!inputValue.trim() || sending}
                        style={{ alignSelf: 'stretch', minWidth: '140px' }}
                    >
                        <FaPaperPlane style={{ marginRight: '8px' }} />
                        {sending ? 'Sending...' : 'Send'}
                    </button>
                </div>
                <p className={styles.helpText} style={{ marginTop: '12px' }}>
                    NgitiBot replies are informational. For diagnosis, prescriptions, or treatment decisions, always rely on a licensed dental professional.
                </p>
            </section>
        </PatientPageFrame>
    );
}

