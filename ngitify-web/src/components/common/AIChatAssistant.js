import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FaArchive, FaBars, FaChevronDown, FaEdit, FaMinus, FaPaperPlane, FaPlus, FaRobot, FaThumbtack, FaTimes, FaTrash, FaUndo } from 'react-icons/fa';
import { useAuth } from '../../hooks/useAuth';
import { authFetch, BASE_URL } from '../../utils/api';
import { STAFF_AI_SUGGESTIONS } from '../../data/staffAiKnowledge';
import styles from './AIChatAssistant.module.css';

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
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const messagesEndRef = useRef(null);
    const messagesRef = useRef(null);
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
    useEffect(() => messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' }), [messages]);

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
            const token = localStorage.getItem('token');
            const controller = new AbortController(); abortRef.current = controller;
            const response = await fetch(`${BASE_URL}/api/staff/ai/conversations/${conversationId}/messages`, {
                method: 'POST', signal: controller.signal,
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({ message: { role: 'user', content }, assistantContext: { currentRoute: location.pathname, currentModule: moduleFromPath(location.pathname) } }),
            });
            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.message || 'The assistant could not respond.');
            }
            const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
            while (true) {
                const { done, value: chunk } = await reader.read(); if (done) break;
                buffer += decoder.decode(chunk, { stream: true });
                const lines = buffer.split('\n'); buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const raw = line.slice(6).trim(); if (raw === '[DONE]') continue;
                    const data = JSON.parse(raw);
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
    return <div className={styles.overlay} role="dialog" aria-modal="false" aria-label="NgitiBot"><section className={styles.panel}>
        <header className={styles.header}><div className={styles.headerLeft}>
            <button className={styles.headerIconBtn} onClick={() => setShowHistory(true)} aria-label="Open conversation history"><FaBars /></button>
            <div className={styles.avatarBubble}><FaRobot className={styles.avatarIcon} /></div><div><h3 className={styles.headerTitle}>NgitiBot</h3><p className={styles.headerSub}>{moduleFromPath(location.pathname)}</p></div>
        </div><div className={styles.headerActions}><button className={styles.headerIconBtn} onClick={newConversation} aria-label="Start a new conversation"><FaPlus /></button><button className={styles.headerIconBtn} onClick={onClose} aria-label="Minimize NgitiBot"><FaMinus /></button><button className={styles.closeBtn} onClick={onClose} aria-label="Close NgitiBot"><FaTimes /></button></div></header>
        <div className={styles.messages} ref={messagesRef} onScroll={() => { const el = messagesRef.current; setShowScrollBtn(el ? el.scrollHeight - el.scrollTop - el.clientHeight > 120 : false); }}>
            {messages.map((message) => <div key={message.id || `${message.role}-${message.createdAt}`} className={`${styles.messageRow} ${message.role === 'user' ? styles.userRow : styles.assistantRow}`}>
                {message.role === 'assistant' && <div className={styles.assistantAvatar}><FaRobot /></div>}<div className={`${styles.bubble} ${message.role === 'user' ? styles.userBubble : styles.assistantBubble}`}>
                    {String(message.content || '').split('\n').map((line, index) => <p key={index} className={styles.bubbleLine}>{line || '\u00a0'}</p>)}{message.isStreaming && <span className={styles.cursor}>▌</span>}
                </div></div>)}<div ref={messagesEndRef} />
        </div>
        {showScrollBtn && <button className={styles.scrollToBottomBtn} onClick={() => messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' })} aria-label="Scroll to newest message"><FaChevronDown /></button>}
        {messages.length === 1 && <div className={styles.quickPrompts}>{suggestions.slice(0, 4).map((prompt) => <button key={prompt} className={styles.quickBtn} onClick={() => sendMessage(prompt)}>{prompt}</button>)}</div>}
        {error && <div className={styles.errorBanner} role="alert">{error}{lastFailedPrompt && <button type="button" onClick={() => sendMessage(lastFailedPrompt)}>Retry</button>}</div>}
        <div className={styles.inputArea}><textarea ref={inputRef} className={styles.input} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} placeholder="Message NgitiBot…" rows={1} disabled={isStreaming} aria-label="Message NgitiBot" /><button className={styles.sendBtn} onClick={() => sendMessage()} disabled={!input.trim() || isStreaming} aria-label="Send message"><FaPaperPlane /></button></div>
        <p className={styles.disclaimer}>Read-only guidance. NgitiFy permissions still apply.</p>
        {showHistory && <><button className={styles.drawerBackdrop} onClick={() => setShowHistory(false)} aria-label="Close conversation history" /><aside className={styles.historyDrawer} aria-label="Conversation history">
            <div className={styles.drawerHeader}><strong>Conversations</strong><button onClick={() => setShowHistory(false)} aria-label="Close history"><FaTimes /></button></div>
            <button className={styles.newChatBtn} onClick={newConversation}><FaPlus /> New chat</button><button className={styles.archiveToggle} onClick={() => { const next = !showArchived; setShowArchived(next); loadList(next); }}><FaArchive /> {showArchived ? 'Back to conversations' : 'Archived'}</button>
            {isLoadingHistory ? <p className={styles.drawerEmpty}>Loading…</p> : conversations.length === 0 ? <p className={styles.drawerEmpty}>No {showArchived ? 'archived ' : ''}conversations yet.</p> : <>{!!pinned.length && <ConversationGroup title="Pinned" items={pinned} {...{ openConversation, renameConversation, updateConversation, deleteConversation, showArchived }} />}<ConversationGroup title={showArchived ? 'Archived' : 'Recent'} items={recent} {...{ openConversation, renameConversation, updateConversation, deleteConversation, showArchived }} /></>}
        </aside></>}
    </section></div>;
}

function ConversationGroup({ title, items, openConversation, renameConversation, updateConversation, deleteConversation, showArchived }) {
    if (!items.length) return null;
    return <div className={styles.conversationGroup}><h4>{title}</h4>{items.map((conversation) => <div className={styles.conversationItem} key={conversation.id}><button className={styles.conversationTitle} onClick={() => openConversation(conversation.id)}><span>{conversation.title}</span><small>{conversation.lastMessageAt ? new Date(conversation.lastMessageAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}</small></button><div className={styles.conversationActions}>
        {!showArchived && <button onClick={() => updateConversation(conversation, { isPinned: !conversation.isPinned })} aria-label={conversation.isPinned ? 'Unpin conversation' : 'Pin conversation'}><FaThumbtack /></button>}<button onClick={() => renameConversation(conversation)} aria-label="Rename conversation"><FaEdit /></button><button onClick={() => updateConversation(conversation, { isArchived: !conversation.isArchived })} aria-label={conversation.isArchived ? 'Restore conversation' : 'Archive conversation'}>{conversation.isArchived ? <FaUndo /> : <FaArchive />}</button><button onClick={() => deleteConversation(conversation)} aria-label="Delete conversation"><FaTrash /></button>
    </div></div>)}</div>;
}
