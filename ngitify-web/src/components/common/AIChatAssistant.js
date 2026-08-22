import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FaArchive, FaBars, FaEdit, FaExclamationTriangle, FaPaperPlane, FaPlus, FaRedoAlt, FaRobot, FaThumbtack, FaTimes, FaTrash, FaUndo } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';
import { STAFF_AI_SUGGESTIONS } from '../../data/staffAiKnowledge';
import styles from '../../styles/patient/PatientPortal.module.css';

const welcome = (role) => ({ id: 'welcome', role: 'assistant', isStreaming: false, content: `Hi! I’m NgitiBot. I can help with permitted ${role || 'staff'} work information and explain the features available to your role.` });
const moduleFromPath = (path = '') => (path.split('/').filter(Boolean).pop() || 'dashboard').replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function AIChatAssistant({ isOpen, onClose }) {
    const { user } = useAuth();
    const location = useLocation();
    const role = user?.role || '';
    const suggestions = STAFF_AI_SUGGESTIONS[role] || STAFF_AI_SUGGESTIONS.default;
    const [messages, setMessages] = useState([welcome(role)]);
    const [conversations, setConversations] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [showHistory, setShowHistory] = useState(false);
    const [showArchived, setShowArchived] = useState(false);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [error, setError] = useState('');
    const [lastFailedPrompt, setLastFailedPrompt] = useState('');
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const abortRef = useRef(null);

    const loadList = useCallback(async (archived = showArchived) => {
        setIsLoadingHistory(true);
        try {
            const response = await authFetch(`/staff/ai/conversations?archived=${archived}`);
            if (!response.ok) throw new Error('Could not load conversations.');
            const data = await response.json();
            setConversations(data.conversations || []);
        } catch (nextError) { setError(nextError.message); }
        finally { setIsLoadingHistory(false); }
    }, [showArchived]);

    useEffect(() => {
        if (!isOpen) return;
        loadList();
        const timer = window.setTimeout(() => inputRef.current?.focus(), 150);
        return () => window.clearTimeout(timer);
    }, [isOpen, loadList]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const closeOnEscape = (event) => {
            if (event.key !== 'Escape') return;
            if (showHistory) setShowHistory(false); else onClose();
        };
        window.addEventListener('keydown', closeOnEscape);
        return () => window.removeEventListener('keydown', closeOnEscape);
    }, [isOpen, onClose, showHistory]);
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
    }, [messages]);

    const newConversation = useCallback(() => {
        abortRef.current?.abort();
        setActiveId(null); setMessages([welcome(role)]); setInput(''); setError(''); setLastFailedPrompt(''); setShowHistory(false);
    }, [role]);

    const ensureConversation = useCallback(async () => {
        if (activeId) return activeId;
        const response = await authFetch('/staff/ai/conversations', { method: 'POST', body: JSON.stringify({}) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'Could not start a conversation.');
        setActiveId(data.conversation.id);
        return data.conversation.id;
    }, [activeId]);

    const openConversation = async (id) => {
        setError('');
        const response = await authFetch(`/staff/ai/conversations/${id}`);
        const data = await response.json();
        if (!response.ok) return setError(data.message || 'Could not open that conversation.');
        setActiveId(id);
        setMessages(data.conversation.messages?.length ? data.conversation.messages : [welcome(role)]);
        setShowHistory(false);
    };

    const updateConversation = async (conversation, changes) => {
        const response = await authFetch(`/staff/ai/conversations/${conversation.id}`, { method: 'PATCH', body: JSON.stringify(changes) });
        const data = await response.json();
        if (!response.ok) return setError(data.message || 'Could not update that conversation.');
        if (changes.isArchived && activeId === conversation.id) newConversation();
        await loadList();
    };
    const renameConversation = async (conversation) => {
        const title = window.prompt('Rename conversation', conversation.title);
        if (title?.trim()) await updateConversation(conversation, { title: title.trim() });
    };
    const deleteConversation = async (conversation) => {
        if (!window.confirm(`Delete “${conversation.title}”? This cannot be undone.`)) return;
        const response = await authFetch(`/staff/ai/conversations/${conversation.id}`, { method: 'DELETE' });
        if (!response.ok) return setError('Could not delete that conversation.');
        if (activeId === conversation.id) newConversation();
        await loadList();
    };

    const sendMessage = useCallback(async (value) => {
        const content = String(value ?? input).trim();
        if (!content || isStreaming) return;
        setInput(''); setError(''); setLastFailedPrompt('');
        const userMessage = { id: `user-${Date.now()}`, role: 'user', content };
        const assistantId = `assistant-${Date.now()}`;
        setMessages((current) => [...current, userMessage, { id: assistantId, role: 'assistant', content: '', isStreaming: true }]);
        setIsStreaming(true);
        try {
            const conversationId = await ensureConversation();
            const controller = new AbortController(); abortRef.current = controller;
            const response = await authFetch(`/staff/ai/conversations/${conversationId}/messages`, {
                method: 'POST', signal: controller.signal,
                body: JSON.stringify({ message: { role: 'user', content }, assistantContext: { currentRoute: location.pathname, currentModule: moduleFromPath(location.pathname) } }),
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || 'The assistant could not respond.');
            }
            if (!response.body?.getReader) throw new Error('The response stream was unavailable. Please try again.');
            const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
            while (true) {
                const { done, value: chunk } = await reader.read(); if (done) break;
                buffer += decoder.decode(chunk, { stream: true });
                const lines = buffer.split('\n'); buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const raw = line.slice(6).trim(); if (raw === '[DONE]') continue;
                    let data;
                    try { data = JSON.parse(raw); } catch { continue; }
                    if (data.error) throw new Error(data.error);
                    if (data.text) setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: item.content + data.text } : item));
                }
            }
            await loadList(false);
        } catch (nextError) {
            if (nextError.name !== 'AbortError') {
                setError(nextError.message);
                setLastFailedPrompt(content);
                setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: 'I couldn’t complete that request. Please try again.' } : item));
            }
        } finally {
            setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, isStreaming: false } : item));
            setIsStreaming(false); abortRef.current = null;
        }
    }, [ensureConversation, input, isStreaming, loadList, location.pathname]);

    if (!isOpen) return null;
    const pinned = conversations.filter((item) => item.isPinned);
    const recent = conversations.filter((item) => !item.isPinned);
    return <div className={`${styles.patientAiConversationShell} ${styles.patientAiConversationShellFloating}`} role="dialog" aria-modal="false" aria-label="NgitiBot">
        <aside className={`${styles.patientAiConversationSidebar} ${showHistory ? styles.patientAiConversationSidebarOpen : ''}`} aria-label="Conversation history">
            <div className={styles.patientAiSidebarHeader}><button type="button" className={styles.patientAiIconButton} onClick={() => setShowHistory(false)} aria-label="Close history"><FaTimes /></button><strong>Conversations</strong><span /></div>
            <div className={styles.patientAiSidebarNewWrap}><button type="button" className={styles.patientAiNewConversationButton} onClick={newConversation}><FaPlus /> New chat</button></div>
            <div className={styles.patientAiSavedList}>
                <button type="button" className={styles.patientAiArchivedLink} onClick={() => { const next = !showArchived; setShowArchived(next); loadList(next); }}><FaArchive /> {showArchived ? 'Back to conversations' : 'Archived'}</button>
                {isLoadingHistory ? <p className={styles.patientAiSavedEmpty}>Loading…</p> : conversations.length === 0 ? <p className={styles.patientAiSavedEmpty}>No {showArchived ? 'archived ' : ''}conversations yet.</p> : <>{!!pinned.length && <ConversationGroup title="Pinned" items={pinned} {...{ openConversation, renameConversation, updateConversation, deleteConversation, showArchived, activeId }} />}<ConversationGroup title={showArchived ? 'Archived' : 'Recent'} items={recent} {...{ openConversation, renameConversation, updateConversation, deleteConversation, showArchived, activeId }} /></>}
            </div>
        </aside>
        {showHistory ? <button type="button" className={styles.patientAiSidebarBackdrop} onClick={() => setShowHistory(false)} aria-label="Close saved conversations" /> : null}
        <section className={styles.patientAiConversationMain}>
            <header className={`${styles.patientAiConversationTopBar} ${styles.patientAiFloatingTopBar}`}>
                <div className={styles.patientAiTopBarLeft}><button type="button" className={styles.patientAiTopBarIconButton} onClick={() => setShowHistory(true)} aria-label="Open conversation history"><FaBars /></button><div className={styles.patientAiFloatingIdentity}><span className={styles.patientAiFloatingAvatar} aria-hidden="true"><FaRobot /></span><div className={styles.patientAiFloatingTitle}><strong>NgitiBot</strong><span>{moduleFromPath(location.pathname)}</span></div></div></div>
                <button type="button" className={styles.patientAiInfoButton} onClick={onClose} aria-label="Close NgitiBot" title="Close chat"><FaTimes /></button>
            </header>
            <div className={styles.patientAiConversationMessages} aria-live="polite">
                {messages.map((message) => <div key={message.id || `${message.role}-${message.createdAt}`} className={message.role === 'user' ? styles.patientAiMessageRowUser : styles.patientAiMessageRowAssistant}>
                    {message.role === 'assistant' ? <div className={styles.patientAiMessageAvatar}><FaRobot /></div> : null}
                    <div className={message.role === 'user' ? styles.patientAiUserBubble : styles.patientAiAssistantBubble}>
                        {message.isStreaming && !message.content ? <div className={styles.patientAiTyping}><span /><span /><span /></div> : String(message.content || '').split('\n').map((line, index) => line ? <p key={index}>{line}</p> : <br key={index} />)}
                    </div>
                </div>)}
                {error ? <div className={styles.patientAiChatError} role="alert"><FaExclamationTriangle /><div><strong>NgitiBot response unavailable</strong><p>{error}</p></div>{lastFailedPrompt ? <button type="button" className={styles.patientAiRetryButton} onClick={() => sendMessage(lastFailedPrompt)} disabled={isStreaming}><FaRedoAlt /> Retry</button> : null}</div> : null}
                <div ref={messagesEndRef} />
            </div>
            <div className={styles.patientAiConversationDock}>
                {messages.length === 1 ? <div className={styles.patientAiConversationPromptRow}>{suggestions.slice(0, 4).map((prompt) => <button type="button" key={prompt} onClick={() => sendMessage(prompt)} disabled={isStreaming}><FaRobot /><span>{prompt}</span></button>)}</div> : null}
                <form className={styles.patientAiComposer} onSubmit={(event) => { event.preventDefault(); sendMessage(); }}>
                    <label htmlFor="staff-ngitibot-message" className={styles.srOnly}>Message NgitiBot</label>
                    <textarea id="staff-ngitibot-message" ref={inputRef} className={styles.patientAiTextarea} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="Message NgitiBot..." rows={2} maxLength={1500} disabled={isStreaming} />
                    <button type="submit" className={styles.patientAiSendButton} disabled={!input.trim() || isStreaming} aria-label="Send message"><FaPaperPlane /></button>
                </form>
            </div>
        </section>
    </div>;
}

function ConversationGroup({ title, items, openConversation, renameConversation, updateConversation, deleteConversation, showArchived, activeId }) {
    if (!items.length) return null;
    return <div><span className={styles.patientAiSavedSectionLabel}>{title}</span>{items.map((conversation) => <div className={`${styles.patientAiSavedConversation} ${activeId === conversation.id ? styles.patientAiSavedConversationActive : ''}`} key={conversation.id}><button type="button" className={styles.patientAiSavedConversationMain} onClick={() => openConversation(conversation.id)}><FaRobot /><span>{conversation.title}</span></button>
        {!showArchived ? <button type="button" className={styles.patientAiConversationMenuButton} onClick={() => updateConversation(conversation, { isPinned: !conversation.isPinned })} aria-label={conversation.isPinned ? 'Unpin conversation' : 'Pin conversation'}><FaThumbtack /></button> : null}<button type="button" className={styles.patientAiConversationMenuButton} onClick={() => renameConversation(conversation)} aria-label="Rename conversation"><FaEdit /></button><button type="button" className={styles.patientAiConversationMenuButton} onClick={() => updateConversation(conversation, { isArchived: !conversation.isArchived })} aria-label={conversation.isArchived ? 'Restore conversation' : 'Archive conversation'}>{conversation.isArchived ? <FaUndo /> : <FaArchive />}</button><button type="button" className={styles.patientAiConversationMenuButton} onClick={() => deleteConversation(conversation)} aria-label="Delete conversation"><FaTrash /></button>
    </div>)}</div>;
}
