import React, { useState, useEffect, useCallback } from 'react';
import { FaPlus, FaPhoneAlt, FaCheckCircle, FaForward, FaTrash, FaSyncAlt, FaTimes } from 'react-icons/fa';
import { MdOutlineQueuePlayNext } from 'react-icons/md';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import styles from '../../styles/admin/QueueManagement.module.css';

export default function QueueManagement() {
    const { addToast } = useToast();

    // ── State ──────────────────────────────────────────────────
    const [queue, setQueue]           = useState([]);
    const [branches, setBranches]     = useState([]);
    const [dentists, setDentists]     = useState([]);
    const [loading, setLoading]       = useState(true);
    const [selectedBranch, setSelectedBranch] = useState('');
    const [showModal, setShowModal]   = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const [form, setForm] = useState({
        patientName: '',
        contactNumber: '',
        procedureType: '',
        assignedDentist: '',
        branch: ''
    });

    // ── Fetch helpers ──────────────────────────────────────────
    const fetchQueue = useCallback(async () => {
        try {
            const params = selectedBranch ? `?branch=${encodeURIComponent(selectedBranch)}` : '';
            const res = await authFetch(`/queue${params}`);
            if (res.ok) {
                const data = await res.json();
                setQueue(data);
            }
        } catch (err) {
            console.error('Error fetching queue:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedBranch]);

    const fetchBranches = useCallback(async () => {
        try {
            const res = await authFetch('/branches');
            if (res.ok) {
                const data = await res.json();
                setBranches(data);
                // Default: first branch selected
                if (data.length > 0 && !selectedBranch) {
                    setSelectedBranch(data[0].name);
                    setForm(f => ({ ...f, branch: data[0].name }));
                }
            }
        } catch (err) { console.error('Error fetching branches:', err); }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const fetchDentists = useCallback(async () => {
        try {
            const res = await authFetch('/users?role=dentist');
            if (res.ok) {
                const data = await res.json();
                setDentists(data);
            }
        } catch (err) { console.error('Error fetching dentists:', err); }
    }, []);

    // ── Initial load + 30-sec auto-refresh ────────────────────
    useEffect(() => {
        fetchBranches();
        fetchDentists();
    }, [fetchBranches, fetchDentists]);

    useEffect(() => {
        fetchQueue();
        const interval = setInterval(fetchQueue, 30000);
        return () => clearInterval(interval);
    }, [fetchQueue]);

    // ── Column splitters ───────────────────────────────────────
    const waiting  = queue.filter(e => e.status === 'waiting');
    const serving  = queue.filter(e => e.status === 'serving');
    const finished = queue.filter(e => e.status === 'done' || e.status === 'skipped');

    // ── Status update ──────────────────────────────────────────
    const updateStatus = async (id, status) => {
        try {
            const res = await authFetch(`/queue/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            if (res.ok) {
                const updated = await res.json();
                setQueue(prev => prev.map(e => e._id === id ? updated : e));
                const labels = { serving: 'called', done: 'marked as done', skipped: 'skipped' };
                addToast(`Ticket #${updated.ticketNumber} ${labels[status]}.`, 'success');
            } else {
                const err = await res.json();
                addToast(err.message || 'Failed to update status.', 'error');
            }
        } catch (err) {
            addToast('Network error. Please try again.', 'error');
        }
    };

    // ── Delete entry ───────────────────────────────────────────
    const removeEntry = async (id, ticketNumber) => {
        if (!window.confirm(`Remove ticket #${ticketNumber} from the queue?`)) return;
        try {
            const res = await authFetch(`/queue/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setQueue(prev => prev.filter(e => e._id !== id));
                addToast(`Ticket #${ticketNumber} removed.`, 'success');
            } else {
                addToast('Failed to remove entry.', 'error');
            }
        } catch (err) {
            addToast('Network error. Please try again.', 'error');
        }
    };

    // ── Add walk-in ────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.patientName.trim()) return addToast('Patient name is required.', 'error');
        if (!form.branch) return addToast('Please select a branch.', 'error');

        setSubmitting(true);
        try {
            const res = await authFetch('/queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            const data = await res.json();
            if (res.ok) {
                setQueue(prev => [...prev, data]);
                addToast(`Ticket #${data.ticketNumber} created for ${data.patientName}.`, 'success');
                setShowModal(false);
                setForm({ patientName: '', contactNumber: '', procedureType: '', assignedDentist: '', branch: selectedBranch });
            } else {
                addToast(data.message || 'Failed to add walk-in.', 'error');
            }
        } catch (err) {
            addToast('Network error. Please try again.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleFormChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

    const handleBranchChange = (e) => {
        setSelectedBranch(e.target.value);
        setForm(f => ({ ...f, branch: e.target.value }));
    };

    // ── Ticket card ────────────────────────────────────────────
    const TicketCard = ({ entry }) => {
        const isWaiting  = entry.status === 'waiting';
        const isServing  = entry.status === 'serving';
        const isDone     = entry.status === 'done';
        const isSkipped  = entry.status === 'skipped';

        return (
            <div className={`${styles.card} ${styles[entry.status]}`}>
                <div className={styles.cardHeader}>
                    <span className={`${styles.ticketBadge} ${styles[`badge_${entry.status}`]}`}>
                        #{String(entry.ticketNumber).padStart(3, '0')}
                    </span>
                    {isSkipped && <span className={styles.skippedTag}>Skipped</span>}
                    {isDone    && <span className={styles.doneTag}>Completed</span>}
                </div>

                <div className={styles.cardBody}>
                    <p className={styles.patientName}>{entry.patientName}</p>
                    {entry.procedureType && (
                        <p className={styles.meta}>📋 {entry.procedureType}</p>
                    )}
                    {entry.assignedDentist && (
                        <p className={styles.meta}>🦷 Dr. {entry.assignedDentist}</p>
                    )}
                    {entry.contactNumber && (
                        <p className={styles.meta}><FaPhoneAlt style={{ marginRight: 4, fontSize: 11 }} />{entry.contactNumber}</p>
                    )}
                    {entry.calledAt && (
                        <p className={styles.metaTime}>Called: {new Date(entry.calledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    )}
                    {entry.completedAt && (
                        <p className={styles.metaTime}>Done: {new Date(entry.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    )}
                </div>

                <div className={styles.cardActions}>
                    {isWaiting && (
                        <>
                            <button className={`${styles.actionBtn} ${styles.callBtn}`} onClick={() => updateStatus(entry._id, 'serving')} title="Call next">
                                <MdOutlineQueuePlayNext /> Call
                            </button>
                            <button className={`${styles.actionBtn} ${styles.skipBtn}`} onClick={() => updateStatus(entry._id, 'skipped')} title="Skip">
                                <FaForward /> Skip
                            </button>
                        </>
                    )}
                    {isServing && (
                        <button className={`${styles.actionBtn} ${styles.doneBtn}`} onClick={() => updateStatus(entry._id, 'done')} title="Mark done">
                            <FaCheckCircle /> Done
                        </button>
                    )}
                    <button className={`${styles.actionBtn} ${styles.removeBtn}`} onClick={() => removeEntry(entry._id, entry.ticketNumber)} title="Remove">
                        <FaTrash />
                    </button>
                </div>
            </div>
        );
    };

    // ── Column ─────────────────────────────────────────────────
    const Column = ({ title, entries, colorClass, icon, emptyText }) => (
        <div className={`${styles.column} ${styles[colorClass]}`}>
            <div className={styles.columnHeader}>
                <span className={styles.columnIcon}>{icon}</span>
                <h3 className={styles.columnTitle}>{title}</h3>
                <span className={styles.columnCount}>{entries.length}</span>
            </div>
            <div className={styles.cardList}>
                {entries.length === 0
                    ? <p className={styles.emptyCol}>{emptyText}</p>
                    : entries.map(e => <TicketCard key={e._id} entry={e} />)
                }
            </div>
        </div>
    );

    // ── Render ─────────────────────────────────────────────────
    return (
        <div className={styles.page}>
            {/* ── Page header ── */}
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}>Queue Management</h1>
                    <p className={styles.pageSubtitle}>Manage walk-in patient flow in real time.</p>
                </div>
                <div className={styles.headerActions}>
                    {branches.length > 0 && (
                        <select
                            className={styles.branchSelect}
                            value={selectedBranch}
                            onChange={handleBranchChange}
                        >
                            <option value="">All Branches</option>
                            {branches.map(b => (
                                <option key={b._id} value={b.name}>{b.name}</option>
                            ))}
                        </select>
                    )}
                    <button className={styles.refreshBtn} onClick={fetchQueue} title="Refresh">
                        <FaSyncAlt />
                    </button>
                    <button className={styles.addBtn} onClick={() => setShowModal(true)}>
                        <FaPlus /> New Walk-In
                    </button>
                </div>
            </div>

            {/* ── Stats bar ── */}
            <div className={styles.statsBar}>
                <div className={styles.statItem}>
                    <span className={styles.statNumber}>{waiting.length}</span>
                    <span className={styles.statLabel}>Waiting</span>
                </div>
                <div className={styles.statDivider} />
                <div className={styles.statItem}>
                    <span className={styles.statNumber}>{serving.length}</span>
                    <span className={styles.statLabel}>Being Served</span>
                </div>
                <div className={styles.statDivider} />
                <div className={styles.statItem}>
                    <span className={styles.statNumber}>{finished.length}</span>
                    <span className={styles.statLabel}>Completed / Skipped</span>
                </div>
                <div className={styles.statDivider} />
                <div className={styles.statItem}>
                    <span className={styles.statNumber}>{queue.length}</span>
                    <span className={styles.statLabel}>Total Today</span>
                </div>
            </div>

            {/* ── Kanban board ── */}
            {loading ? (
                <p className={styles.loadingText}>Loading queue...</p>
            ) : (
                <div className={styles.kanban}>
                    <Column
                        title="Waiting"
                        entries={waiting}
                        colorClass="col_waiting"
                        icon="⏳"
                        emptyText="No patients waiting."
                    />
                    <Column
                        title="Currently Serving"
                        entries={serving}
                        colorClass="col_serving"
                        icon="🦷"
                        emptyText="No one is being served right now."
                    />
                    <Column
                        title="Done / Skipped"
                        entries={finished}
                        colorClass="col_done"
                        icon="✅"
                        emptyText="No completed entries yet today."
                    />
                </div>
            )}

            {/* ── Add Walk-In Modal ── */}
            {showModal && (
                <div className={styles.overlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalTitle}>New Walk-In Patient</h2>
                            <button className={styles.closeModalBtn} onClick={() => setShowModal(false)}>
                                <FaTimes />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className={styles.formGroup}>
                                <label>Patient Name <span className={styles.required}>*</span></label>
                                <input
                                    name="patientName"
                                    className={styles.formInput}
                                    placeholder="e.g. Juan Dela Cruz"
                                    value={form.patientName}
                                    onChange={handleFormChange}
                                    required
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Contact Number <span className={styles.optional}>(optional)</span></label>
                                <input
                                    name="contactNumber"
                                    className={styles.formInput}
                                    placeholder="e.g. 09XX-XXX-XXXX"
                                    value={form.contactNumber}
                                    onChange={handleFormChange}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Procedure / Concern <span className={styles.optional}>(optional)</span></label>
                                <input
                                    name="procedureType"
                                    className={styles.formInput}
                                    placeholder="e.g. Tooth Extraction"
                                    value={form.procedureType}
                                    onChange={handleFormChange}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Assign Dentist <span className={styles.optional}>(optional)</span></label>
                                <select
                                    name="assignedDentist"
                                    className={styles.formInput}
                                    value={form.assignedDentist}
                                    onChange={handleFormChange}
                                >
                                    <option value="">— Select a dentist —</option>
                                    {dentists.map(d => (
                                        <option key={d._id} value={`${d.name?.first} ${d.name?.last}`}>
                                            Dr. {d.name?.first} {d.name?.last}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.formGroup}>
                                <label>Branch <span className={styles.required}>*</span></label>
                                <select
                                    name="branch"
                                    className={styles.formInput}
                                    value={form.branch}
                                    onChange={handleFormChange}
                                    required
                                >
                                    <option value="">— Select a branch —</option>
                                    {branches.map(b => (
                                        <option key={b._id} value={b.name}>{b.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.modalActions}>
                                <button type="button" className={styles.cancelBtn} onClick={() => setShowModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className={styles.submitBtn} disabled={submitting}>
                                    {submitting ? 'Adding...' : 'Add to Queue'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}