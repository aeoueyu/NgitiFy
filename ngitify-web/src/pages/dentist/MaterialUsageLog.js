// ngitify-web/src/pages/dentist/MaterialUsageLog.js

import React, { useState, useEffect } from 'react';
import styles from '../../styles/dentist/MaterialUsageLog.module.css';
import { FaBoxOpen, FaTrash, FaPlus } from 'react-icons/fa';
import { useToast } from '../../context/ToastContext';
import { authFetch } from '../../utils/api';
import { formatDateShort } from '../../utils/dateUtils';

export default function MaterialUsageLog({ appointment, onClose, onSuccess }) {
    const { addToast } = useToast();

    // States
    const [inventoryList, setInventoryList] = useState([]);
    const [usedMaterials, setUsedMaterials] = useState([{ itemId: '', quantity: 1 }]);
    const [isSubmittingLog, setIsSubmittingLog] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // ✅ FIX Bug 25: Fetch real inventory from API instead of using MOCK_INVENTORY
    useEffect(() => {
        const fetchInventory = async () => {
            try {
                const res = await authFetch('/inventory');
                if (!res.ok) throw new Error('Failed to load inventory.');
                const data = await res.json();
                setInventoryList(data);
            } catch (error) {
                console.error('Error fetching inventory:', error);
                addToast('Failed to load inventory data.', 'error');
            } finally {
                setIsLoading(false);
            }
        };
        fetchInventory();
    }, [addToast]);

    // Row Operations
    const handleAddRow = () => setUsedMaterials(prev => [...prev, { itemId: '', quantity: 1 }]);
    const handleRemoveRow = (index) => setUsedMaterials(prev => prev.filter((_, i) => i !== index));
    const handleChange = (index, field, value) => {
        setUsedMaterials(prev => {
            const updated = [...prev];
            updated[index][field] = value;
            return updated;
        });
    };

    // ✅ FIX Bug 25: PATCH real /inventory/deduct endpoint instead of simulating with setTimeout
    const handleSubmit = async (e) => {
        e.preventDefault();

        const isValid = usedMaterials.every(m => m.itemId && m.quantity > 0);
        if (!isValid) {
            addToast('Please select an item and valid quantity for all rows.', 'error');
            return;
        }

        setIsSubmittingLog(true);
        try {
            const payload = {
                appointmentId: appointment.id || appointment._id,
                patientId: appointment.patientId,
                itemsUsed: usedMaterials.map(m => ({
                    inventoryId: m.itemId,
                    quantityUsed: Number(m.quantity),
                })),
            };

            const res = await authFetch('/inventory/deduct', {
                method: 'PATCH',
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error((await res.json()).message || 'Failed to log materials.');

            addToast('Materials successfully logged and deducted from inventory.', 'success');
            if (onSuccess) onSuccess();
            onClose();
        } catch (error) {
            console.error('Material Log Error:', error);
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
                                                {item.name} ({item.stock ?? item.quantity} {item.unit} available)
                                            </option>
                                        ))}
                                    </select>

                                    <input
                                        type="number"
                                        min="1"
                                        placeholder="Qty"
                                        className={styles.qtyInput}
                                        required
                                        value={row.quantity}
                                        onChange={(e) => handleChange(idx, 'quantity', e.target.value)}
                                        disabled={isSubmittingLog}
                                    />

                                    <button
                                        type="button"
                                        className={styles.removeBtn}
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
                            <FaPlus style={{ marginRight: '6px' }}/> Add Another Item
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