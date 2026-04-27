import React, { useState, useEffect, useCallback } from 'react';
import styles from '../../styles/dentist/MaterialUsageLog.module.css';
import { FaBoxOpen, FaTrash, FaPlus, FaSearch, FaChevronDown, FaChevronUp, FaClipboardList } from 'react-icons/fa';
import { useToast } from '../../context/ToastContext';
import { authFetch } from '../../utils/api';
import { formatDateShort, formatDateLong } from '../../utils/dateUtils';

// ─── MODAL MODE (used from DentistAppointments) ──────────────────────────────
// Rendered when `appointment` prop is provided.

function MaterialUsageModal({ appointment, onClose, onSuccess }) {
    const { addToast } = useToast();
    const [inventoryList, setInventoryList] = useState([]);
    const [usedMaterials, setUsedMaterials] = useState([{ itemId: '', quantity: 1 }]);
    const [isSubmittingLog, setIsSubmittingLog] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchInventory = async () => {
            try {
                const res = await authFetch('/inventory');
                if (!res.ok) throw new Error('Failed to load inventory.');
                setInventoryList(await res.json());
            } catch (error) {
                addToast('Failed to load inventory data.', 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchInventory();
    }, [addToast]);

    const handleAddRow = () => setUsedMaterials(prev => [...prev, { itemId: '', quantity: 1 }]);
    const handleRemoveRow = (index) => setUsedMaterials(prev => prev.filter((_, i) => i !== index));
    const handleChange = (index, field, value) => {
        setUsedMaterials(prev => {
            const updated = [...prev];
            updated[index][field] = value;
            return updated;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const isValid = usedMaterials.every(m => m.itemId && m.quantity > 0);
        if (!isValid) {
            addToast('Please select an item and valid quantity for all rows.', 'error');
            return;
        }
        setIsSubmittingLog(true);
        try {
            // Step 1: Deduct from inventory
            const deductRes = await authFetch('/inventory/deduct', {
                method: 'PATCH',
                body: JSON.stringify({
                    appointmentId: appointment.id || appointment._id,
                    patientId: appointment.patientId,
                    itemsUsed: usedMaterials.map(m => ({
                        inventoryId: m.itemId,
                        quantityUsed: Number(m.quantity),
                    })),
                }),
            });
            if (!deductRes.ok) throw new Error((await deductRes.json()).message || 'Failed to deduct inventory.');

            // Step 2: Save usage log record
            const itemsWithNames = usedMaterials.map(m => {
                const inv = inventoryList.find(i => (i._id || i.id) === m.itemId);
                return {
                    name: inv ? inv.name || inv.itemName : 'Unknown',
                    quantity: Number(m.quantity),
                    unit: inv ? inv.unit || 'piece' : 'piece',
                };
            });
            await authFetch('/material-usage', {
                method: 'POST',
                body: JSON.stringify({
                    patientId: appointment.patientId || null,
                    procedureType: appointment.procedure || 'Procedure',
                    materials: itemsWithNames,
                    branch: appointment.branch || '',
                    usedAt: appointment.rawDate || new Date().toISOString(),
                }),
            });

            addToast('Materials successfully logged and deducted from inventory.', 'success');
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            addToast(error.message || 'Cannot connect to server.', 'error');
        } finally {
            setIsSubmittingLog(false);
        }
    };

    if (!appointment) return null;

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.materialModalCard}>
                <div className={styles.materialHeaderInfo}>
                    <h2 className={styles.modalTitle}>
                        <FaBoxOpen /> Log Materials Used
                    </h2>
                    <p className={styles.materialPatientName}>{appointment.patientName || 'Unknown Patient'}</p>
                    <p className={styles.materialProcedure}>
                        {appointment.procedure || 'Procedure'} • {appointment.rawDate ? formatDateShort(appointment.rawDate) : 'Unknown Date'}
                    </p>
                </div>

                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Loading inventory...</div>
                ) : (
                    <form onSubmit={handleSubmit}>
                        <div style={{ maxHeight: '280px', overflowY: 'auto', paddingRight: '5px', marginBottom: '15px' }}>
                            {usedMaterials.map((row, idx) => (
                                <div key={idx} className={styles.materialRow}>
                                    <select
                                        className={styles.materialSelect}
                                        required
                                        value={row.itemId}
                                        onChange={(e) => handleChange(idx, 'itemId', e.target.value)}
                                        disabled={isSubmittingLog}
                                    >
                                        <option value="" disabled hidden>Select item from inventory...</option>
                                        {inventoryList.map(item => (
                                            <option key={item._id || item.id} value={item._id || item.id}>
                                                {item.name || item.itemName} ({item.stock ?? item.quantity} {item.unit} available)
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        type="number" min="1" placeholder="Qty"
                                        className={styles.qtyInput} required
                                        value={row.quantity}
                                        onChange={(e) => handleChange(idx, 'quantity', e.target.value)}
                                        disabled={isSubmittingLog}
                                    />
                                    <button
                                        type="button" className={styles.removeBtn}
                                        onClick={() => handleRemoveRow(idx)}
                                        disabled={usedMaterials.length === 1 || isSubmittingLog}
                                        title="Remove item"
                                    >
                                        <FaTrash />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <button type="button" className={styles.addMaterialRowBtn} onClick={handleAddRow} disabled={isSubmittingLog}>
                            <FaPlus style={{ marginRight: '6px' }} /> Add Another Item
                        </button>

                        <div className={styles.modalButtonGroup}>
                            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isSubmittingLog}>Cancel</button>
                            <button type="submit" className={styles.saveMaterialBtn} disabled={isSubmittingLog}>
                                {isSubmittingLog ? 'Saving...' : 'Save & Deduct Stock'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

// ─── LOG NEW ENTRY MODAL (standalone page modal) ──────────────────────────────

function LogNewEntryModal({ onClose, onSuccess, inventoryList, branches }) {
    const { addToast } = useToast();
    const [form, setForm] = useState({
        procedureType: '',
        patientName: '',
        branch: '',
        usedAt: new Date().toISOString().split('T')[0],
    });
    const [usedMaterials, setUsedMaterials] = useState([{ itemId: '', quantity: 1 }]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
    const handleAddRow = () => setUsedMaterials(prev => [...prev, { itemId: '', quantity: 1 }]);
    const handleRemoveRow = (index) => setUsedMaterials(prev => prev.filter((_, i) => i !== index));
    const handleRowChange = (index, field, value) => {
        setUsedMaterials(prev => {
            const updated = [...prev];
            updated[index][field] = value;
            return updated;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.procedureType || !form.branch) {
            addToast('Procedure type and branch are required.', 'error');
            return;
        }
        const isValid = usedMaterials.every(m => m.itemId && m.quantity > 0);
        if (!isValid) {
            addToast('Please select an item and valid quantity for all rows.', 'error');
            return;
        }
        setIsSubmitting(true);
        try {
            // Step 1: Deduct inventory
            await authFetch('/inventory/deduct', {
                method: 'PATCH',
                body: JSON.stringify({
                    itemsUsed: usedMaterials.map(m => ({
                        inventoryId: m.itemId,
                        quantityUsed: Number(m.quantity),
                    })),
                }),
            });

            // Step 2: Create usage log
            const itemsWithNames = usedMaterials.map(m => {
                const inv = inventoryList.find(i => (i._id || i.id) === m.itemId);
                return {
                    name: inv ? (inv.name || inv.itemName) : 'Unknown',
                    quantity: Number(m.quantity),
                    unit: inv ? inv.unit || 'piece' : 'piece',
                };
            });

            const res = await authFetch('/material-usage', {
                method: 'POST',
                body: JSON.stringify({
                    procedureType: form.procedureType,
                    materials: itemsWithNames,
                    branch: form.branch,
                    usedAt: form.usedAt,
                    notes: form.patientName ? `Patient: ${form.patientName}` : '',
                }),
            });
            if (!res.ok) throw new Error((await res.json()).message || 'Failed to save log.');

            addToast('Material usage log saved and inventory deducted.', 'success');
            onSuccess();
            onClose();
        } catch (error) {
            addToast(error.message || 'Failed to save log.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.materialModalCard} style={{ maxWidth: '600px' }}>
                <div className={styles.materialHeaderInfo}>
                    <h2 className={styles.modalTitle}><FaPlus /> Log New Material Usage</h2>
                    <p className={styles.materialProcedure}>Record materials used during a procedure and deduct from stock.</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Procedure Type <span style={{ color: 'red' }}>*</span></label>
                            <input
                                type="text" required className={styles.materialSelect} style={{ flex: 'none', width: '100%' }}
                                placeholder="e.g., Tooth Extraction, Scaling"
                                value={form.procedureType}
                                onChange={e => handleChange('procedureType', e.target.value)}
                                disabled={isSubmitting}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Patient Name (optional)</label>
                            <input
                                type="text" className={styles.materialSelect} style={{ flex: 'none', width: '100%' }}
                                placeholder="e.g., Juan dela Cruz"
                                value={form.patientName}
                                onChange={e => handleChange('patientName', e.target.value)}
                                disabled={isSubmitting}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Branch <span style={{ color: 'red' }}>*</span></label>
                            <select
                                required className={styles.materialSelect} style={{ flex: 'none', width: '100%' }}
                                value={form.branch}
                                onChange={e => handleChange('branch', e.target.value)}
                                disabled={isSubmitting}
                            >
                                <option value="" disabled hidden>Select Branch</option>
                                {branches.map(b => (
                                    <option key={b._id} value={b.name}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                            <label className={styles.formLabel}>Date Used <span style={{ color: 'red' }}>*</span></label>
                            <input
                                type="date" required className={styles.materialSelect} style={{ flex: 'none', width: '100%' }}
                                value={form.usedAt}
                                onChange={e => handleChange('usedAt', e.target.value)}
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '18px', marginBottom: '10px' }}>
                        <p className={styles.formLabel} style={{ marginBottom: '12px' }}>Materials Used <span style={{ color: 'red' }}>*</span></p>
                        <div style={{ maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                            {usedMaterials.map((row, idx) => (
                                <div key={idx} className={styles.materialRow}>
                                    <select
                                        className={styles.materialSelect} required
                                        value={row.itemId}
                                        onChange={e => handleRowChange(idx, 'itemId', e.target.value)}
                                        disabled={isSubmitting}
                                    >
                                        <option value="" disabled hidden>Select item...</option>
                                        {inventoryList.map(item => (
                                            <option key={item._id || item.id} value={item._id || item.id}>
                                                {item.name || item.itemName} ({item.stock ?? item.quantity} {item.unit} left)
                                            </option>
                                        ))}
                                    </select>
                                    <input
                                        type="number" min="1" placeholder="Qty"
                                        className={styles.qtyInput} required
                                        value={row.quantity}
                                        onChange={e => handleRowChange(idx, 'quantity', e.target.value)}
                                        disabled={isSubmitting}
                                    />
                                    <button
                                        type="button" className={styles.removeBtn}
                                        onClick={() => handleRemoveRow(idx)}
                                        disabled={usedMaterials.length === 1 || isSubmitting}
                                    >
                                        <FaTrash />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button type="button" className={styles.addMaterialRowBtn} onClick={handleAddRow} disabled={isSubmitting}>
                            <FaPlus style={{ marginRight: '6px' }} /> Add Another Item
                        </button>
                    </div>

                    <div className={styles.modalButtonGroup}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isSubmitting}>Cancel</button>
                        <button type="submit" className={styles.saveMaterialBtn} disabled={isSubmitting}>
                            {isSubmitting ? 'Saving...' : 'Save & Deduct Stock'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── STANDALONE PAGE MODE ─────────────────────────────────────────────────────
// Rendered when no `appointment` prop is provided (route: /dentist/material-usage)

function MaterialUsagePage() {
    const { addToast } = useToast();

    const [logs, setLogs] = useState([]);
    const [inventoryList, setInventoryList] = useState([]);
    const [branches, setBranches] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedLogs, setExpandedLogs] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [isLogModalOpen, setIsLogModalOpen] = useState(false);

    const fetchLogs = useCallback(async () => {
        try {
            const res = await authFetch('/material-usage');
            if (!res.ok) throw new Error('Failed to load logs.');
            const data = await res.json();
            setLogs(data.map(log => ({
                ...log,
                id: log._id || log.id,
                rawDate: new Date(log.usedAt || log.createdAt),
            })));
        } catch (err) {
            addToast('Failed to load material usage logs.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        fetchLogs();
        const fetchSupportData = async () => {
            try {
                const [invRes, branchRes] = await Promise.all([
                    authFetch('/inventory'),
                    authFetch('/branches'),
                ]);
                if (invRes.ok) setInventoryList(await invRes.json());
                if (branchRes.ok) setBranches(await branchRes.json());
            } catch (e) { /* silent */ }
        };
        fetchSupportData();
    }, [fetchLogs]);

    const toggleExpand = (id) => setExpandedLogs(prev => ({ ...prev, [id]: !prev[id] }));

    const filteredLogs = logs.filter(log => {
        const lower = searchQuery.toLowerCase();
        const matchSearch = !searchQuery ||
            (log.procedureType || '').toLowerCase().includes(lower) ||
            (log.patientName || '').toLowerCase().includes(lower) ||
            (log.branch || '').toLowerCase().includes(lower);
        let matchDate = true;
        if (dateFrom) matchDate = matchDate && log.rawDate >= new Date(dateFrom);
        if (dateTo) {
            const end = new Date(dateTo);
            end.setHours(23, 59, 59, 999);
            matchDate = matchDate && log.rawDate <= end;
        }
        return matchSearch && matchDate;
    });

    // Stats
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthCount = logs.filter(l => l.rawDate >= startOfMonth).length;

    const materialFreq = {};
    logs.forEach(log => (log.materials || []).forEach(m => {
        materialFreq[m.name] = (materialFreq[m.name] || 0) + m.quantity;
    }));
    const topMaterial = Object.entries(materialFreq).sort((a, b) => b[1] - a[1])[0];

    return (
        <main className={styles.pageWrapper}>
            <div className={styles.pageHeader}>
                <div>
                    <h1 className={styles.pageTitle}><FaBoxOpen style={{ marginRight: '10px', color: '#2dccf6' }} />Material Usage Log</h1>
                    <p className={styles.pageSubtitle}>Track and record dental supplies used during patient procedures.</p>
                </div>
                <button className={styles.saveMaterialBtn} onClick={() => setIsLogModalOpen(true)}>
                    <FaPlus style={{ marginRight: '7px' }} /> Log New Entry
                </button>
            </div>

            {/* STATS */}
            <div className={styles.statsRow}>
                <div className={styles.statCard}>
                    <p className={styles.statLabel}>Total Logs</p>
                    <h2 className={styles.statValue}>{logs.length}</h2>
                    <p className={styles.statSub}>All time entries</p>
                </div>
                <div className={styles.statCard}>
                    <p className={styles.statLabel}>This Month</p>
                    <h2 className={styles.statValue}>{thisMonthCount}</h2>
                    <p className={styles.statSub}>{now.toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
                </div>
                <div className={styles.statCard}>
                    <p className={styles.statLabel}>Most Used Item</p>
                    <h2 className={styles.statValue} style={{ fontSize: '18px', marginTop: '6px' }}>
                        {topMaterial ? topMaterial[0] : '—'}
                    </h2>
                    <p className={styles.statSub}>{topMaterial ? `${topMaterial[1]} units used` : 'No data yet'}</p>
                </div>
            </div>

            {/* FILTERS */}
            <div className={styles.filtersBar}>
                <div className={styles.searchWrapper}>
                    <FaSearch className={styles.searchIcon} />
                    <input
                        type="text" placeholder="Search by procedure, patient, or branch..."
                        className={styles.searchInput}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className={styles.dateFilters}>
                    <input type="date" className={styles.dateInput} value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="From" />
                    <span className={styles.dateSep}>—</span>
                    <input type="date" className={styles.dateInput} value={dateTo} onChange={e => setDateTo(e.target.value)} title="To" />
                </div>
            </div>

            {/* LOG TABLE */}
            <div className={styles.tableCard}>
                {isLoading ? (
                    <div className={styles.emptyState}>Loading usage logs...</div>
                ) : filteredLogs.length === 0 ? (
                    <div className={styles.emptyState}>
                        <FaClipboardList style={{ fontSize: '36px', color: '#cbd5e1', marginBottom: '12px' }} />
                        <p>{logs.length === 0 ? 'No material usage logs recorded yet.' : 'No results match the current filters.'}</p>
                    </div>
                ) : (
                    <table className={styles.logTable}>
                        <thead>
                            <tr className={styles.tableHeader}>
                                <th>Date</th>
                                <th>Procedure</th>
                                <th>Patient</th>
                                <th>Branch</th>
                                <th>Items Used</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLogs.map(log => (
                                <React.Fragment key={log.id}>
                                    <tr className={styles.tableRow}>
                                        <td className={styles.tdDate}>{formatDateShort(log.rawDate)}</td>
                                        <td className={styles.tdProcedure}>{log.procedureType}</td>
                                        <td className={styles.tdPatient}>{log.patientName || '—'}</td>
                                        <td className={styles.tdBranch}>{log.branch || '—'}</td>
                                        <td className={styles.tdItems}>
                                            <span className={styles.itemsBadge}>{(log.materials || []).length} item(s)</span>
                                        </td>
                                        <td className={styles.tdActions}>
                                            <button
                                                className={styles.expandBtn}
                                                onClick={() => toggleExpand(log.id)}
                                            >
                                                {expandedLogs[log.id] ? <><FaChevronUp /> Hide</> : <><FaChevronDown /> Details</>}
                                            </button>
                                        </td>
                                    </tr>
                                    {expandedLogs[log.id] && (
                                        <tr className={styles.expandedRow}>
                                            <td colSpan={6}>
                                                <div className={styles.expandedContent}>
                                                    <p className={styles.expandedTitle}>Materials Used on {formatDateLong(log.rawDate.toISOString())}</p>
                                                    <div className={styles.materialChips}>
                                                        {(log.materials || []).map((m, i) => (
                                                            <span key={i} className={styles.materialChip}>
                                                                {m.name} — {m.quantity} {m.unit}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    {log.notes && (
                                                        <p className={styles.logNote}><strong>Note:</strong> {log.notes}</p>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* LOG NEW ENTRY MODAL */}
            {isLogModalOpen && (
                <LogNewEntryModal
                    onClose={() => setIsLogModalOpen(false)}
                    onSuccess={() => { fetchLogs(); }}
                    inventoryList={inventoryList}
                    branches={branches}
                />
            )}
        </main>
    );
}

// ─── DEFAULT EXPORT: Auto-detects mode ───────────────────────────────────────

export default function MaterialUsageLog({ appointment, onClose, onSuccess }) {
    if (appointment) {
        return <MaterialUsageModal appointment={appointment} onClose={onClose} onSuccess={onSuccess} />;
    }
    return <MaterialUsagePage />;
}