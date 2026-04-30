import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './AIChatAssistant.module.css';
import { FaTimes, FaRobot, FaPaperPlane, FaTrash, FaChevronDown } from 'react-icons/fa';
import { BASE_URL } from '../../utils/api';

const QUICK_PROMPTS = [
    'What materials are needed for a tooth extraction?',
    'Post-op care instructions for scaling?',
    'How do I log material usage in NgitiFy?',
    'How do I access a patient\'s odontogram?',
];

const WELCOME_MESSAGE = {
    id: 'welcome',
    role: 'assistant',
    content: "Hello! I'm your NgitiFy AI Staff Assistant. I can help you with dental procedure questions, material protocols, post-op care guidelines, and how to use the NgitiFy system.\n\nWhat can I help you with today?",
    isStreaming: false,
};

export default function AIChatAssistant({ isOpen, onClose }) {
    const [messages, setMessages] = useState([WELCOME_MESSAGE]);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [showScrollBtn, setShowScrollBtn] = useState(false);

    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const inputRef = useRef(null);
    const abortRef = useRef(null);

    // Auto-scroll to bottom on new messages
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    useEffect(() => {
        if (isOpen) {
            scrollToBottom();
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen, messages, scrollToBottom]);

    // Show scroll-to-bottom button when scrolled up
    const handleScroll = () => {
        const el = messagesContainerRef.current;
        if (!el) return;
        const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        setShowScrollBtn(distFromBottom > 120);
    };

    const sendMessage = useCallback(async (text) => {
        const userText = (text || input).trim();
        if (!userText || isStreaming) return;

        setInput('');

        const userMsg = { id: Date.now(), role: 'user', content: userText, isStreaming: false };
        const assistantMsgId = Date.now() + 1;
        const assistantMsg = { id: assistantMsgId, role: 'assistant', content: '', isStreaming: true };

        setMessages(prev => [...prev, userMsg, assistantMsg]);
        setIsStreaming(true);

        // Build history for the API (exclude welcome and currently-streaming messages)
        const history = [...messages.filter(m => m.id !== 'welcome'), userMsg].map(m => ({
            role: m.role,
            content: m.content,
        }));

        try {
            const token = localStorage.getItem('token');
            const controller = new AbortController();
            abortRef.current = controller;

            const response = await fetch(`${BASE_URL}/api/ai/staff-chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ messages: history }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.message || 'Request failed.');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep partial line

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') break;

                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.text) {
                            setMessages(prev => prev.map(m =>
                                m.id === assistantMsgId
                                    ? { ...m, content: m.content + parsed.text }
                                    : m
                            ));
                        }
                        if (parsed.error) throw new Error(parsed.error);
                    } catch (parseErr) {
                        if (parseErr.message !== 'Unexpected end of JSON input') {
                            throw parseErr;
                        }
                    }
                }
            }

        } catch (err) {
            if (err.name === 'AbortError') return;
            console.error('Staff chat error:', err);
            setMessages(prev => prev.map(m =>
                m.id === assistantMsgId
                    ? { ...m, content: 'Sorry, I encountered an error. Please try again.', isStreaming: false }
                    : m
            ));
        } finally {
            setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { ...m, isStreaming: false } : m
            ));
            setIsStreaming(false);
            abortRef.current = null;
        }
    }, [input, isStreaming, messages]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const handleClear = () => {
        if (isStreaming && abortRef.current) abortRef.current.abort();
        setMessages([WELCOME_MESSAGE]);
        setIsStreaming(false);
    };

    if (!isOpen) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.panel}>

                {/* HEADER */}
                <div className={styles.header}>
                    <div className={styles.headerLeft}>
                        <div className={styles.avatarBubble}>
                            <FaRobot className={styles.avatarIcon} />
                        </div>
                        <div>
                            <h3 className={styles.headerTitle}>AI Staff Assistant</h3>
                            <p className={styles.headerSub}>NgitiFy · Dentime Dental Clinic</p>
                        </div>
                    </div>
                    <div className={styles.headerActions}>
                        <button className={styles.clearBtn} onClick={handleClear} title="Clear conversation">
                            <FaTrash />
                        </button>
                        <button className={styles.closeBtn} onClick={onClose} title="Close">
                            <FaTimes />
                        </button>
                    </div>
                </div>

                {/* MESSAGES */}
                <div
                    className={styles.messages}
                    ref={messagesContainerRef}
                    onScroll={handleScroll}
                >
                    {messages.map(msg => (
                        <div
                            key={msg.id}
                            className={`${styles.messageRow} ${msg.role === 'user' ? styles.userRow : styles.assistantRow}`}
                        >
                            {msg.role === 'assistant' && (
                                <div className={styles.assistantAvatar}>
                                    <FaRobot />
                                </div>
                            )}
                            <div className={`${styles.bubble} ${msg.role === 'user' ? styles.userBubble : styles.assistantBubble}`}>
                                {msg.content
                                    ? msg.content.split('\n').map((line, i) =>
                                        line.trim()
                                            ? <p key={i} className={styles.bubbleLine}>{line}</p>
                                            : <br key={i} />
                                    )
                                    : null
                                }
                                {msg.isStreaming && (
                                    <span className={styles.cursor} aria-hidden="true">▋</span>
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* SCROLL TO BOTTOM */}
                {showScrollBtn && (
                    <button className={styles.scrollToBottomBtn} onClick={scrollToBottom}>
                        <FaChevronDown />
                    </button>
                )}

                {/* QUICK PROMPTS */}
                {messages.length <= 2 && !isStreaming && (
                    <div className={styles.quickPrompts}>
                        {QUICK_PROMPTS.map((prompt, i) => (
                            <button
                                key={i}
                                className={styles.quickBtn}
                                onClick={() => sendMessage(prompt)}
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                )}

                {/* INPUT */}
                <div className={styles.inputArea}>
                    <textarea
                        ref={inputRef}
                        className={styles.input}
                        placeholder="Ask about procedures, materials, or NgitiFy..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={1}
                        disabled={isStreaming}
                    />
                    <button
                        className={styles.sendBtn}
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || isStreaming}
                        title="Send (Enter)"
                    >
                        <FaPaperPlane />
                    </button>
                </div>

                <p className={styles.disclaimer}>
                    AI responses are for informational use only. Always apply professional clinical judgment.
                </p>
            </div>
        </div>
    );
}
