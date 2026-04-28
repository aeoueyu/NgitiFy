// ngitify-web/src/pages/secretary/SecretaryQueue.js

import React, { useState, useEffect, useCallback } from 'react';
import {
    FaPlus, FaPhoneAlt, FaCheckCircle, FaForward,
    FaTrash, FaSyncAlt, FaTimes, FaUserPlus
} from 'react-icons/fa';
import { MdOutlineQueuePlayNext } from 'react-icons/md';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import ConfirmModal from '../../components/common/ConfirmModal';
import styles from '../../styles/admin/QueueManagement.module.css'; // reuse admin CSS

const PROCEDURE_OPTIONS = [
    'Consultation', 'Teeth Cleaning (Prophylaxis)', 'Tooth Extraction',
    'Dental Filling (Composite)', 'Root Canal Treatment',
    'Braces / Orthodontic Adjustment', 'Teeth Whitening',
    'Crown / Bridge Fitting', 'Wisdom Tooth Extraction',
    'Oral Surgery', 'X-Ray / Radiograph', 'Other',
];

export default function SecretaryQueue() {
    const { addToast } = useToast();
    const { user } = useAuth();

    // ── State ──────────────────────────────────────────────────────────────────
    const [queue, setQueue]           = useState([]);
    const [dentists, setDentists]     = useState([]);
    const [loading, setLoading]       = useState(true);
    const [showModal, setShowModal]   = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Confirm modal state
    const [confirmConfig, setConfirmConfig] = useState(null);

    const [form, setForm] = useState({
        patientName:     '',
        contactNumber:   '',
        procedureType:   '',
        assignedDentist: '',
    });

    // ── Data fetching ──────────────────────────────────────────────────────────

    const fetchQueue = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            // Backend scopes to the secretary's branch via JWT middleware
            const res = await authFetch('/queue');
            if (res.ok) {
                const data = await res.json();
                setQueue(data);
            } else {
                if (!silent) addToast('Failed to load queue.', 'error');
            }
        } catch (err) {
            if (!silent) addToast('Could not connect to the server.', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    const fetchDentists = useCallback(async () => {
        try {
            const res = await authFetch('/users?role=dentist');
            if (res.ok) {
                const data = await res.json();
                setDentists(data.filter(d => d.status === 'active' && !d.isArchived));
            }
        } catch (err) {
            console.error('Error fetching dentists:', err);
        }
    }, []);

    // Initial load + 30-second auto-refresh
    useEffect(() => {
        fetchDentists();
    }, [fetchDentists]);

    useEffect(() => {
        fetchQueue();
        const interval = setInterval(() => fetchQueue(true), 30000);
        return () => clearInterval(interval);
    }, [fetchQueue]);

    // ── Column splitters ───────────────────────────────────────────────────────
    const waiting  = queue.filter(e => e.status === 'waiting');
    const serving  = queue.filter(e => e.status === 'serving');
    const finished = queue.filter(e => e.status === 'done' || e.status === 'skipped');

    // ── Status update ──────────────────────────────────────────────────────────
    const updateStatus = async (id, status, ticketNumber) => {
        try {
            const res = await authFetch(`/queue/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            if (res.ok) {
                const updated = await res.json();
                setQueue(prev => prev.map(e => e._id === id ? updated : e));
                const labels = { serving: 'called in', done: 'marked as done', skipped: 'skipped' };
                addToast(`Ticket #${String(ticketNumber).padStart(3, '0')} ${labels[status] || 'updated'}.`, 'success');
            } else {
                const err = await res.json();
                addToast(err.message || 'Failed to update status.', 'error');
            }
        } catch {
            addToast('Network error. Please try again.', 'error');
        }
    };

    // ── Remove entry (with confirm modal) ─────────────────────────────────────
    const triggerRemove = (id, ticketNumber) => {
        setConfirmConfig({
            title:       'Remove from Queue',
            message:     `Are you sure you want to remove Ticket #${String(ticketNumber).padStart(3, '0')} from the queue? This cannot be undone.`,
            confirmText: 'Yes, Remove',
            isDestructive: true,
            onConfirm:   () => executeRemove(id, ticketNumber),
            onCancel:    () => setConfirmConfig(null),
        });
    };

    const executeRemove = async (id, ticketNumber) => {
        try {
            const res = await authFetch(`/queue/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setQueue(prev => prev.filter(e => e._id !== id));
                addToast(`Ticket #${String(ticketNumber).padStart(3, '0')} removed from queue.`, 'success');
            } else {
                addToast('Failed to remove entry.', 'error');
            }
        } catch {
            addToast('Network error. Please try again.', 'error');
        } finally {
            setConfirmConfig(null);
        }
    };

    // ── Add walk-in ────────────────────────────────────────────────────────────
    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.patientName.trim()) {
            addToast('Patient name is required.', 'error');
            return;
        }

        setSubmitting(true);
        try {
            // Branch is injected server-side from the secretary's JWT
            const res = await authFetch('/queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();

            if (res.ok) {
                setQueue(prev => [...prev, data]);
                addToast(
                    `Ticket #${String(data.ticketNumber).padStart(3, '0')} created for ${data.patientName}.`,
                    'success'
                );
                setShowModal(false);
                setForm({ patientName: '', contactNumber: '', procedureType: '', assignedDentist: '' });
            } else {
                addToast(data.message || 'Failed to add walk-in.', 'error');
            }
        } catch {
            addToast('Network error. Please try again.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setForm({ patientName: '', contactNumber: '', procedureType: '', assignedDentist: '' });
    };

    // ── Ticket card sub-component ──────────────────────────────────────────────
    const TicketCard = ({ entry }) => {
        const isWaiting = entry.status === 'waiting';
        const isServing = entry.status === 'serving';
        const isDone    = entry.status === 'done';
        const isSkipped = entry.status === 'skipped';

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
                        <p className={styles.meta}>
                            <FaPhoneAlt style={{ marginRight: 4, fontSize: 11 }} />
                            {entry.contactNumber}
                        </p>
                    )}
                    {entry.calledAt && (
                        <p className={styles.metaTime}>
                            Called: {new Date(entry.calledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    )}
                    {entry.completedAt && (
                        <p className={styles.metaTime}>
                            Done: {new Date(entry.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    )}
                    {entry.createdAt && (
                        <p className={styles.metaTime}>
                            Queued: {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    )}
                </div>

                <div className={styles.cardActions}>
                    {isWaiting && (
                        <>
                            <button
                                className={`${styles.actionBtn} ${styles.callBtn}`}
                                onClick={() => updateStatus(entry._id, 'serving', entry.ticketNumber)}
                                title="Call patient"
                            >
                                <MdOutlineQueuePlayNext /> Call
                            </button>
                            <button
                                className={`${styles.actionBtn} ${styles.skipBtn}`}
                                onClick={() => updateStatus(entry._id, 'skipped', entry.ticketNumber)}
                                title="Skip patient"
                            >
                                <FaForward /> Skip
                            </button>
                        </>
                    )}
                    {isServing && (
                        <button
                            className={`${styles.actionBtn} ${styles.doneBtn}`}
                            onClick={() => updateStatus(entry._id, 'done', entry.ticketNumber)}
                            title="Mark as done"
                        >
                            <FaCheckCircle /> Done
                        </button>
                    )}
                    {!isDone && (
                        <button
                            className={`${styles.actionBtn} ${styles.removeBtn}`}
                            onClick={() => triggerRemove(entry._id, entry.ticketNumber)}
                            title="Remove from queue"
                        >
                            <FaTrash />
                        </button>
                    )}
                </div>
            </div>
        );
    };

    // ── Kanban column sub-component ────────────────────────────────────────────
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

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <>
            <div className={styles.page}>

                {/* ── Page Header ── */}
                <div className={styles.pageHeader}>
                    <div>
                        <h1 className={styles.pageTitle}>Walk-In Queue</h1>
                        <p className={styles.pageSubtitle}>
                            Manage walk-in patient flow in real time for your branch.
                        </p>
                    </div>
                    <div className={styles.headerActions}>
                        <button
                            className={styles.refreshBtn}
                            onClick={() => fetchQueue()}
                            title="Refresh queue"
                        >
                            <FaSyncAlt />
                        </button>
                        <button
                            className={styles.addBtn}
                            onClick={() => setShowModal(true)}
                        >
                            <FaUserPlus /> New Walk-In
                        </button>
                    </div>
                </div>

                {/* ── Stats Bar ── */}
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
                        <span className={styles.statLabel}>Done / Skipped</span>
                    </div>
                    <div className={styles.statDivider} />
                    <div className={styles.statItem}>
                        <span className={styles.statNumber}>{queue.length}</span>
                        <span className={styles.statLabel}>Total Today</span>
                    </div>
                </div>

                {/* ── Kanban Board ── */}
                {loading ? (
                    <p className={styles.loadingText}>Loading queue…</p>
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
            </div>

            {/* ── Add Walk-In Modal ── */}
            {showModal && (
                <div className={styles.overlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalTitle}>
                                <FaUserPlus style={{ marginRight: '10px', color: '#01538b' }} />
                                New Walk-In Patient
                            </h2>
                            <button className={styles.closeModalBtn} onClick={handleCloseModal}>
                                <FaTimes />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            {/* Patient Name */}
                            <div className={styles.formGroup}>
                                <label>
                                    Patient Name <span className={styles.required}>*</span>
                                </label>
                                <input
                                    name="patientName"
                                    className={styles.formInput}
                                    placeholder="e.g. Juan Dela Cruz"
                                    value={form.patientName}
                                    onChange={handleFormChange}
                                    required
                                    disabled={submitting}
                                />
                            </div>

                            {/* Contact Number */}
                            <div className={styles.formGroup}>
                                <label>
                                    Contact Number{' '}
                                    <span className={styles.optional}>(optional)</span>
                                </label>
                                <input
                                    name="contactNumber"
                                    className={styles.formInput}
                                    placeholder="e.g. 09XX-XXX-XXXX"
                                    value={form.contactNumber}
                                    onChange={handleFormChange}
                                    disabled={submitting}
                                />
                            </div>

                            {/* Procedure / Concern */}
                            <div className={styles.formGroup}>
                                <label>
                                    Procedure / Concern{' '}
                                    <span className={styles.optional}>(optional)</span>
                                </label>
                                <select
                                    name="procedureType"
                                    className={styles.formInput}
                                    value={form.procedureType}
                                    onChange={handleFormChange}
                                    disabled={submitting}
                                >
                                    <option value="">— Select or leave blank —</option>
                                    {PROCEDURE_OPTIONS.map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Assign Dentist */}
                            <div className={styles.formGroup}>
                                <label>
                                    Assign Dentist{' '}
                                    <span className={styles.optional}>(optional)</span>
                                </label>
                                <select
                                    name="assignedDentist"
                                    className={styles.formInput}
                                    value={form.assignedDentist}
                                    onChange={handleFormChange}
                                    disabled={submitting}
                                >
                                    <option value="">— Select a dentist —</option>
                                    {dentists.map(d => (
                                        <option
                                            key={d._id}
                                            value={`${d.name?.first} ${d.name?.last}`}
                                        >
                                            Dr. {d.name?.first} {d.name?.last}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.modalActions}>
                                <button
                                    type="button"
                                    className={styles.cancelBtn}
                                    onClick={handleCloseModal}
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className={styles.submitBtn}
                                    disabled={submitting}
                                >
                                    {submitting ? 'Adding…' : (
                                        <><FaPlus style={{ marginRight: '6px' }} /> Add to Queue</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Confirm Remove Modal ── */}
            <ConfirmModal
                isOpen={!!confirmConfig}
                title={confirmConfig?.title}
                message={confirmConfig?.message}
                confirmText={confirmConfig?.confirmText}
                isDestructive={confirmConfig?.isDestructive}
                onConfirm={confirmConfig?.onConfirm}
                onCancel={() => setConfirmConfig(null)}
            />
        </>
    );
}