import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    FaHeadset, FaInbox, FaPaperPlane, FaUserCheck,
    FaTimesCircle, FaExclamationCircle, FaFilter, FaCircle
} from 'react-icons/fa';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import styles from '../../styles/admin/ChatSupport.module.css';

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_FILTERS = ['all', 'open', 'in-progress', 'resolved', 'closed'];

const STATUS_META = {
    open:        { label: 'Open',        color: '#2980b9' },
    'in-progress': { label: 'In Progress', color: '#e67e22' },
    resolved:    { label: 'Resolved',    color: '#27ae60' },
    closed:      { label: 'Closed',      color: '#7f8c8d' },
};

const PRIORITY_META = {
    low:    { label: 'Low',    color: '#27ae60' },
    medium: { label: 'Medium', color: '#e67e22' },
    high:   { label: 'High',   color: '#e74c3c' },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (iso) =>
    new Date(iso).toLocaleString('en-PH', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });

const formatShortDate = (iso) =>
    new Date(iso).toLocaleString('en-PH', {
        month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });

// ── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }) {
    const meta = STATUS_META[status] || { label: status, color: '#7f8c8d' };
    return (
        <span className={styles.badge} style={{ backgroundColor: meta.color }}>
            {meta.label}
        </span>
    );
}

function PriorityBadge({ priority }) {
    const meta = PRIORITY_META[priority] || { label: priority, color: '#7f8c8d' };
    return (
        <span className={styles.priorityBadge} style={{ borderColor: meta.color, color: meta.color }}>
            <FaCircle style={{ fontSize: 7 }} /> {meta.label}
        </span>
    );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ChatSupport() {
    const { addToast } = useToast();
    const { user } = useAuth();

    // Left panel state
    const [tickets, setTickets]           = useState([]);
    const [totalTickets, setTotalTickets] = useState(0);
    const [filter, setFilter]             = useState('all');
    const [loadingList, setLoadingList]   = useState(true);

    // Right panel state
    const [selected, setSelected]         = useState(null);   // full ticket with messages
    const [loadingThread, setLoadingThread] = useState(false);
    const [reply, setReply]               = useState('');
    const [sending, setSending]           = useState(false);

    const threadEndRef = useRef(null);

    // ── Data fetching ─────────────────────────────────────────────────────────

    const fetchTickets = useCallback(async () => {
        setLoadingList(true);
        try {
            const params = filter !== 'all' ? `?status=${filter}` : '';
            const res = await authFetch(`/support-tickets${params}`);
            if (res.ok) {
                const data = await res.json();
                setTickets(data.tickets || []);
                setTotalTickets(data.total || 0);
            }
        } catch (err) {
            console.error('Error loading tickets:', err);
        } finally {
            setLoadingList(false);
        }
    }, [filter]);

    useEffect(() => { fetchTickets(); }, [fetchTickets]);

    const openTicket = async (ticketId) => {
        setLoadingThread(true);
        setSelected(null);
        try {
            const res = await authFetch(`/support-tickets/${ticketId}`);
            if (res.ok) {
                const data = await res.json();
                setSelected(data);
            } else {
                addToast('Failed to load ticket.', 'error');
            }
        } catch (err) {
            addToast('Error loading ticket.', 'error');
        } finally {
            setLoadingThread(false);
        }
    };

    // Auto-scroll to latest message whenever thread updates
    useEffect(() => {
        if (selected) {
            setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
        }
    }, [selected]);

    // ── Actions ───────────────────────────────────────────────────────────────

    const sendReply = async () => {
        if (!reply.trim() || !selected) return;
        setSending(true);
        try {
            const res = await authFetch(`/support-tickets/${selected._id}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: reply.trim() }),
            });
            if (res.ok) {
                const updated = await res.json();
                setSelected(updated);
                setReply('');
                // Refresh list to reflect status change (open → in-progress)
                fetchTickets();
            } else {
                addToast('Failed to send reply.', 'error');
            }
        } catch (err) {
            addToast('Error sending reply.', 'error');
        } finally {
            setSending(false);
        }
    };

    const updateTicket = async (fields) => {
        if (!selected) return;
        try {
            const res = await authFetch(`/support-tickets/${selected._id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fields),
            });
            if (res.ok) {
                const updated = await res.json();
                setSelected(updated);
                fetchTickets();
                addToast('Ticket updated.', 'success');
            } else {
                addToast('Failed to update ticket.', 'error');
            }
        } catch (err) {
            addToast('Error updating ticket.', 'error');
        }
    };

    const assignToMe = () =>
        updateTicket({ assignedTo: user?._id || user?.id, assignedToName: user?.email });

    const closeTicket = () => {
        if (window.confirm('Close this ticket? The patient will no longer be able to reply.')) {
            updateTicket({ status: 'closed' });
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendReply();
    };

    // ── Render ────────────────────────────────────────────────────────────────

    const openCount = tickets.filter(t => t.status === 'open').length;

    return (
        <div className={styles.page}>

            {/* ── Left Panel — Ticket Inbox ─────────────────────────────── */}
            <div className={styles.inbox}>

                {/* Inbox Header */}
                <div className={styles.inboxHeader}>
                    <div className={styles.inboxTitle}>
                        <FaHeadset className={styles.inboxIcon} />
                        <div>
                            <h2 className={styles.inboxHeading}>Chat Support</h2>
                            <p className={styles.inboxSub}>
                                {totalTickets} ticket{totalTickets !== 1 ? 's' : ''}
                                {openCount > 0 && ` · ${openCount} open`}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Filter Bar */}
                <div className={styles.filterBar}>
                    <FaFilter className={styles.filterIcon} />
                    {STATUS_FILTERS.map(f => (
                        <button
                            key={f}
                            className={`${styles.filterBtn} ${filter === f ? styles.activeFilter : ''}`}
                            onClick={() => { setFilter(f); setSelected(null); }}
                        >
                            {f === 'all' ? 'All' : STATUS_META[f]?.label || f}
                        </button>
                    ))}
                </div>

                {/* Ticket List */}
                <div className={styles.ticketList}>
                    {loadingList ? (
                        <div className={styles.listLoading}>Loading tickets…</div>
                    ) : tickets.length === 0 ? (
                        <div className={styles.emptyList}>
                            <FaInbox className={styles.emptyIcon} />
                            <p>No tickets found.</p>
                        </div>
                    ) : (
                        tickets.map(ticket => (
                            <div
                                key={ticket._id}
                                className={`${styles.ticketCard} ${selected?._id === ticket._id ? styles.ticketCardActive : ''}`}
                                onClick={() => openTicket(ticket._id)}
                            >
                                <div className={styles.ticketCardTop}>
                                    <span className={styles.ticketSubject}>{ticket.subject}</span>
                                    <PriorityBadge priority={ticket.priority} />
                                </div>
                                <div className={styles.ticketCardMeta}>
                                    <span className={styles.ticketPatient}>{ticket.patientName}</span>
                                    <span className={styles.ticketDate}>{formatShortDate(ticket.createdAt)}</span>
                                </div>
                                <StatusBadge status={ticket.status} />
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* ── Right Panel — Message Thread ──────────────────────────── */}
            <div className={styles.thread}>
                {!selected && !loadingThread ? (
                    <div className={styles.noSelection}>
                        <FaHeadset className={styles.noSelectionIcon} />
                        <p>Select a ticket to view the conversation.</p>
                    </div>
                ) : loadingThread ? (
                    <div className={styles.noSelection}>
                        <p>Loading conversation…</p>
                    </div>
                ) : (
                    <>
                        {/* Thread Header */}
                        <div className={styles.threadHeader}>
                            <div className={styles.threadHeaderLeft}>
                                <h3 className={styles.threadSubject}>{selected.subject}</h3>
                                <div className={styles.threadMeta}>
                                    <span>{selected.patientName}</span>
                                    {selected.patientEmail && (
                                        <span className={styles.metaDot}>·</span>
                                    )}
                                    {selected.patientEmail && (
                                        <span>{selected.patientEmail}</span>
                                    )}
                                    <span className={styles.metaDot}>·</span>
                                    <span>Opened {formatDate(selected.createdAt)}</span>
                                </div>
                            </div>
                            <div className={styles.threadBadges}>
                                <StatusBadge status={selected.status} />
                                <PriorityBadge priority={selected.priority} />
                            </div>
                        </div>

                        {/* Action Toolbar */}
                        <div className={styles.actionBar}>
                            {/* Assign to me */}
                            {!selected.assignedTo && (
                                <button className={styles.actionBtn} onClick={assignToMe}>
                                    <FaUserCheck /> Assign to Me
                                </button>
                            )}
                            {selected.assignedTo && (
                                <span className={styles.assignedTag}>
                                    <FaUserCheck /> {selected.assignedToName || 'Assigned'}
                                </span>
                            )}

                            {/* Status change */}
                            {selected.status !== 'resolved' && selected.status !== 'closed' && (
                                <button
                                    className={`${styles.actionBtn} ${styles.resolveBtn}`}
                                    onClick={() => updateTicket({ status: 'resolved' })}
                                >
                                    Mark Resolved
                                </button>
                            )}

                            {/* Priority selector */}
                            <select
                                className={styles.prioritySelect}
                                value={selected.priority}
                                onChange={(e) => updateTicket({ priority: e.target.value })}
                            >
                                <option value="low">Priority: Low</option>
                                <option value="medium">Priority: Medium</option>
                                <option value="high">Priority: High</option>
                            </select>

                            {/* Close ticket */}
                            {selected.status !== 'closed' && (
                                <button
                                    className={`${styles.actionBtn} ${styles.closeBtn}`}
                                    onClick={closeTicket}
                                >
                                    <FaTimesCircle /> Close Ticket
                                </button>
                            )}

                            {selected.status === 'closed' && (
                                <span className={styles.closedTag}>
                                    <FaExclamationCircle /> Ticket Closed
                                </span>
                            )}
                        </div>

                        {/* Messages */}
                        <div className={styles.messages}>
                            {selected.messages?.length === 0 && (
                                <div className={styles.noMessages}>No messages yet.</div>
                            )}
                            {selected.messages?.map((msg, i) => {
                                const isAdmin = ['administrator', 'co-administrator'].includes(msg.senderRole);
                                return (
                                    <div
                                        key={msg._id || i}
                                        className={`${styles.messageBubble} ${isAdmin ? styles.bubbleAdmin : styles.bubblePatient}`}
                                    >
                                        <div className={styles.bubbleMeta}>
                                            <span className={styles.bubbleSender}>{msg.senderName}</span>
                                            <span className={styles.bubbleRole}>({msg.senderRole})</span>
                                            <span className={styles.bubbleTime}>{formatDate(msg.sentAt)}</span>
                                        </div>
                                        <p className={styles.bubbleContent}>{msg.content}</p>
                                    </div>
                                );
                            })}
                            <div ref={threadEndRef} />
                        </div>

                        {/* Reply Box */}
                        {selected.status !== 'closed' ? (
                            <div className={styles.replyBox}>
                                <textarea
                                    className={styles.replyInput}
                                    placeholder="Type your reply… (Ctrl+Enter to send)"
                                    value={reply}
                                    onChange={(e) => setReply(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    rows={3}
                                    disabled={sending}
                                />
                                <button
                                    className={styles.sendBtn}
                                    onClick={sendReply}
                                    disabled={!reply.trim() || sending}
                                >
                                    <FaPaperPlane />
                                    {sending ? 'Sending…' : 'Send Reply'}
                                </button>
                            </div>
                        ) : (
                            <div className={styles.closedNotice}>
                                This ticket is closed. Reopen it to reply.
                                <button
                                    className={styles.reopenBtn}
                                    onClick={() => updateTicket({ status: 'open' })}
                                >
                                    Reopen Ticket
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}