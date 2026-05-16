import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    FaPlus,
    FaPhoneAlt,
    FaCheckCircle,
    FaForward,
    FaTrash,
    FaSyncAlt,
    FaTimes,
    FaUserPlus,
    FaClipboardList,
    FaUserMd,
} from 'react-icons/fa';
import { MdOutlinePendingActions, MdOutlineQueuePlayNext } from 'react-icons/md';
import { authFetch } from '../../utils/api';
import { useToast } from '../../context/ToastContext';
import { useSystemConfig } from '../../hooks/useSystemConfig';
import ConfirmModal from '../../components/common/ConfirmModal';
import styles from '../../styles/admin/QueueManagement.module.css';

const initialForm = {
    patientName: '',
    contactNumber: '',
    procedureType: '',
    assignedDentist: '',
};

export default function SecretaryQueue() {
    const { addToast } = useToast();
    const { config: systemConfig } = useSystemConfig();
    const clinicProcedureOptions = useMemo(() => (
        (Array.isArray(systemConfig?.clinicProcedures) ? systemConfig.clinicProcedures : [])
            .map((procedure) => String(procedure || '').trim())
            .filter(Boolean)
    ), [systemConfig?.clinicProcedures]);

    const [queue, setQueue] = useState([]);
    const [dentists, setDentists] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState(null);
    const [form, setForm] = useState(initialForm);

    const fetchQueue = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await authFetch('/queue');
            if (res.ok) {
                setQueue(await res.json());
            } else if (!silent) {
                addToast('Failed to load queue.', 'error');
            }
        } catch {
            if (!silent) addToast('Could not connect to the server.', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    const fetchDentists = useCallback(async () => {
        try {
            const res = await authFetch('/assignable-dentists');
            if (res.ok) {
                const data = await res.json();
                setDentists(data.filter((dentist) => dentist.status === 'active' && !dentist.isArchived));
            }
        } catch (error) {
            console.error('Error fetching dentists:', error);
        }
    }, []);

    useEffect(() => {
        fetchDentists();
    }, [fetchDentists]);

    useEffect(() => {
        fetchQueue();
        const interval = setInterval(() => fetchQueue(true), 30000);
        return () => clearInterval(interval);
    }, [fetchQueue]);

    const waiting = queue.filter((entry) => entry.status === 'pending');
    const serving = queue.filter((entry) => entry.status === 'in-clinic');
    const finished = queue.filter((entry) => entry.status === 'completed' || entry.status === 'cancelled');

    const updateStatus = async (id, status, ticketNumber) => {
        try {
            const res = await authFetch(`/queue/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });

            if (res.ok) {
                const updated = await res.json();
                setQueue((prev) => prev.map((entry) => (entry._id === id ? updated : entry)));
                const labels = { 'in-clinic': 'called in', completed: 'marked as completed', cancelled: 'cancelled' };
                addToast(`Ticket #${String(ticketNumber).padStart(3, '0')} ${labels[status] || 'updated'}.`, 'success');
            } else {
                const error = await res.json();
                addToast(error.message || 'Failed to update status.', 'error');
            }
        } catch {
            addToast('Network error. Please try again.', 'error');
        }
    };

    const executeRemove = async (id, ticketNumber) => {
        try {
            const res = await authFetch(`/queue/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setQueue((prev) => prev.filter((entry) => entry._id !== id));
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

    const triggerRemove = (id, ticketNumber) => {
        setConfirmConfig({
            title: 'Remove from Queue',
            message: `Are you sure you want to remove Ticket #${String(ticketNumber).padStart(3, '0')} from the queue? This cannot be undone.`,
            confirmText: 'Yes, Remove',
            isDestructive: true,
            onConfirm: () => executeRemove(id, ticketNumber),
            onCancel: () => setConfirmConfig(null),
        });
    };

    const handleFormChange = (event) => {
        const { name, value } = event.target;
        const nextValue = name === 'contactNumber' ? value.replace(/[^0-9]/g, '').slice(0, 11) : value;
        setForm((prev) => ({ ...prev, [name]: nextValue }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!form.patientName.trim()) {
            addToast('Patient name is required.', 'error');
            return;
        }

        if (form.contactNumber && !/^09\d{9}$/.test(form.contactNumber)) {
            addToast('Contact number must follow the 09XXXXXXXXX format.', 'error');
            return;
        }

        setSubmitting(true);
        try {
            const res = await authFetch('/queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const data = await res.json();

            if (res.ok) {
                setQueue((prev) => [...prev, data]);
                addToast(`Ticket #${String(data.ticketNumber).padStart(3, '0')} created for ${data.patientName}.`, 'success');
                setShowModal(false);
                setForm(initialForm);
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
        setForm(initialForm);
    };

    const TicketCard = ({ entry }) => {
        const isWaiting = entry.status === 'pending';
        const isServing = entry.status === 'in-clinic';
        const isDone = entry.status === 'completed';
        const isSkipped = entry.status === 'cancelled';

        return (
            <div className={`${styles.card} ${styles[entry.status]}`}>
                <div className={styles.cardHeader}>
                    <span className={`${styles.ticketBadge} ${styles[`badge_${entry.status}`]}`}>
                        #{String(entry.ticketNumber).padStart(3, '0')}
                    </span>
                    {isSkipped && <span className={styles.skippedTag}>Skipped</span>}
                    {isDone && <span className={styles.doneTag}>Completed</span>}
                </div>

                <div className={styles.cardBody}>
                    <p className={styles.patientName}>{entry.patientName}</p>
                    {entry.procedureType && (
                        <p className={styles.meta}>
                            <FaClipboardList style={{ marginRight: 4, fontSize: 11 }} />
                            {entry.procedureType}
                        </p>
                    )}
                    {entry.assignedDentist && (
                        <p className={styles.meta}>
                            <FaUserMd style={{ marginRight: 4, fontSize: 11 }} />
                            Dr. {entry.assignedDentist}
                        </p>
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
                                onClick={() => updateStatus(entry._id, 'in-clinic', entry.ticketNumber)}
                                title="Call patient"
                            >
                                <MdOutlineQueuePlayNext /> Call
                            </button>
                            <button
                                className={`${styles.actionBtn} ${styles.skipBtn}`}
                                onClick={() => updateStatus(entry._id, 'cancelled', entry.ticketNumber)}
                                title="Skip patient"
                            >
                                <FaForward /> Skip
                            </button>
                        </>
                    )}
                    {isServing && (
                        <button
                            className={`${styles.actionBtn} ${styles.doneBtn}`}
                            onClick={() => updateStatus(entry._id, 'completed', entry.ticketNumber)}
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
                    : entries.map((entry) => <TicketCard key={entry._id} entry={entry} />)}
            </div>
        </div>
    );

    return (
        <>
            <div className={styles.page}>
                <div className={styles.pageHeader}>
                    <div>
                        <h1 className={styles.pageTitle}>Walk-In Queue</h1>
                        <p className={styles.pageSubtitle}>Manage walk-in patient flow in real time for your branch.</p>
                        <p className={styles.pageSubtitle} style={{ marginTop: '6px', color: '#64748b' }}>
                            Booked appointments stay prioritized, while walk-ins fill the live queue for the same branch.
                        </p>
                    </div>
                    <div className={styles.headerActions}>
                        <button className={styles.refreshBtn} onClick={() => fetchQueue()} title="Refresh queue">
                            <FaSyncAlt />
                        </button>
                        <button className={styles.addBtn} onClick={() => setShowModal(true)}>
                            <FaUserPlus /> New Walk-In
                        </button>
                    </div>
                </div>

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

                {loading ? (
                    <p className={styles.loadingText}>Loading queue...</p>
                ) : (
                    <div className={styles.kanban}>
                        <Column
                            title="Waiting"
                            entries={waiting}
                            colorClass="col_waiting"
                            icon={<MdOutlinePendingActions />}
                            emptyText="No patients waiting."
                        />
                        <Column
                            title="Currently Serving"
                            entries={serving}
                            colorClass="col_serving"
                            icon={<MdOutlineQueuePlayNext />}
                            emptyText="No one is being served right now."
                        />
                        <Column
                            title="Done / Skipped"
                            entries={finished}
                            colorClass="col_done"
                            icon={<FaCheckCircle />}
                            emptyText="No completed entries yet today."
                        />
                    </div>
                )}
            </div>

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

                            <div className={styles.formGroup}>
                                <label>
                                    Contact Number <span className={styles.optional}>(optional)</span>
                                </label>
                                <input
                                    name="contactNumber"
                                    className={styles.formInput}
                                    placeholder="e.g. 09123456789"
                                    value={form.contactNumber}
                                    onChange={handleFormChange}
                                    maxLength={11}
                                    disabled={submitting}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>
                                    Procedure / Concern <span className={styles.optional}>(optional)</span>
                                </label>
                                <select
                                    name="procedureType"
                                    className={styles.formInput}
                                    value={form.procedureType}
                                    onChange={handleFormChange}
                                    disabled={submitting}
                                >
                                    <option value="">- Select or leave blank -</option>
                                    {clinicProcedureOptions.map((procedure) => (
                                        <option key={procedure} value={procedure}>{procedure}</option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.formGroup}>
                                <label>
                                    Assign Dentist <span className={styles.optional}>(optional)</span>
                                </label>
                                <select
                                    name="assignedDentist"
                                    className={styles.formInput}
                                    value={form.assignedDentist}
                                    onChange={handleFormChange}
                                    disabled={submitting}
                                >
                                    <option value="">- Select a dentist -</option>
                                    {dentists.map((dentist) => (
                                        <option
                                            key={dentist._id}
                                            value={`${dentist.name?.first} ${dentist.name?.last}`}
                                        >
                                            Dr. {dentist.name?.first} {dentist.name?.last}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.modalActions}>
                                <button type="button" className={styles.cancelBtn} onClick={handleCloseModal} disabled={submitting}>
                                    Cancel
                                </button>
                                <button type="submit" className={styles.submitBtn} disabled={submitting}>
                                    {submitting ? 'Adding...' : <><FaPlus style={{ marginRight: '6px' }} /> Add to Queue</>}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

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
