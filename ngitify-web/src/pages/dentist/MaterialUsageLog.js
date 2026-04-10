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

    // Fetch real inventory data on mount
    useEffect(() => {
        const fetchInventory = async () => {
            try {
                // Future Implementation: const res = await authFetch('/inventory');
                // Temporarily bypassing actual fetch for UI testing continuity
                const MOCK_INVENTORY = [
                    { id: 'inv1', name: 'Lidocaine 2% Carpule', unit: 'pcs', stock: 150 },
                    { id: 'inv2', name: 'Composite Resin (A2)', unit: 'grams', stock: 45 },
                    { id: 'inv3', name: 'Disposable Latex Gloves', unit: 'pairs', stock: 300 },
                    { id: 'inv4', name: 'Sterile Gauze Pads', unit: 'packs', stock: 200 },
                    { id: 'inv5', name: 'Prophylaxis Paste', unit: 'cups', stock: 80 },
                ];
                setInventoryList(MOCK_INVENTORY);
            } catch (error) {
                console.error("Error fetching inventory:", error);
                addToast("Failed to load inventory data.", "error");
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validation
        const isValid = usedMaterials.every(m => m.itemId && m.quantity > 0);
        if (!isValid) {
            addToast("Please select an item and valid quantity for all rows.", "error");
            return;
        }

        setIsSubmittingLog(true);

        try {
            const payload = {
                appointmentId: appointment.id || appointment._id,
                patientId: appointment.patientId,
                itemsUsed: usedMaterials.map(m => ({
                    inventoryId: m.itemId,
                    quantityUsed: Number(m.quantity)
                }))
            };

            // Future implementation: await authFetch('/inventory/deduct', { method: 'POST', body: JSON.stringify(payload) });
            
            // Simulating API latency
            setTimeout(() => {
                addToast(`Materials successfully logged and deducted from inventory.`, "success");
                if (onSuccess) onSuccess(); // Ping parent component to refresh data if needed
                onClose(); // Close Modal
            }, 800);

        } catch (error) {
            console.error("Material Log Error:", error);
            addToast("Cannot connect to server.", "error");
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
                                            <option key={item.id} value={item.id}>
                                                {item.name} ({item.stock} {item.unit} available)
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