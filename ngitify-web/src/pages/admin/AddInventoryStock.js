import React, { useEffect, useMemo, useState } from 'react';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/StaffModals.module.css';
import successIcon from '../../assets/alert/success.svg';
import BackIcon from '../../assets/icons/Back.svg';
import ConfirmModal from '../../components/common/ConfirmModal';

const buildItemCatalog = (inventoryEntries = []) => {
    const seen = new Map();
    inventoryEntries.forEach((entry) => {
        const itemId = entry.itemId || entry._id || entry.id;
        if (!itemId || seen.has(itemId)) return;
        seen.set(itemId, {
            itemId,
            name: entry.name || entry.itemName || '',
            category: entry.category || '',
            unit: entry.unit || 'pcs',
            branch: entry.branch || '',
        });
    });
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
};

export default function AddInventoryStock({ inventoryEntries = [], inventoryBatches = [], onClose, onSuccess, initialItemId = '' }) {
    const isItemLocked = Boolean(initialItemId);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [serverMessage, setServerMessage] = useState('');
    const [formData, setFormData] = useState({
        itemId: initialItemId,
        brand: '',
        quantityReceived: '',
        expirationDate: '',
        batchNumber: '',
        supplierName: '',
        receivedDate: new Date().toISOString().split('T')[0],
    });

    const items = useMemo(() => buildItemCatalog(inventoryEntries), [inventoryEntries]);
    const selectedItem = items.find((item) => item.itemId === formData.itemId) || null;

    const brandOptions = useMemo(() => {
        if (!selectedItem) return [];
        return Array.from(
            new Set(
                inventoryEntries
                    .filter((entry) => (entry.itemId || entry._id || entry.id) === selectedItem.itemId)
                    .concat(
                        inventoryBatches.filter((entry) => (entry.itemId || entry._id || entry.id) === selectedItem.itemId)
                    )
                    .map((entry) => String(entry.brand || '').trim())
                    .filter(Boolean)
            )
        ).sort((a, b) => a.localeCompare(b));
    }, [inventoryEntries, inventoryBatches, selectedItem]);

    const handleChange = (event) => {
        const { name, value } = event.target;
        if (name === 'quantityReceived' && value !== '' && Number(value) < 0) return;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
            ...(name === 'itemId' ? { brand: brandOptions[0] || '' } : {}),
        }));
        setServerMessage('');
        if (errors[name]) {
            setErrors((prev) => ({ ...prev, [name]: '' }));
        }
    };

    useEffect(() => {
        if (!selectedItem) return;
        if (formData.brand) return;
        if (brandOptions.length === 0) return;
        setFormData((prev) => ({ ...prev, brand: brandOptions[0] }));
    }, [selectedItem, brandOptions, formData.brand]);

    const validateForm = () => {
        const nextErrors = {};

        if (!formData.itemId) nextErrors.itemId = 'Select an item.';
        if (!formData.brand.trim()) nextErrors.brand = 'Enter or select a brand.';
        if (formData.quantityReceived === '') nextErrors.quantityReceived = 'Enter the quantity received.';
        else if (Number(formData.quantityReceived) <= 0) nextErrors.quantityReceived = 'Quantity must be greater than zero.';

        setErrors(nextErrors);
        return Object.keys(nextErrors).length === 0;
    };

    const submitStock = async () => {
        setIsSaving(true);
        try {
            const payload = {
                inventoryItemId: selectedItem.itemId,
                itemName: selectedItem.name,
                category: selectedItem.category,
                unit: selectedItem.unit,
                brand: formData.brand.trim(),
                quantityReceived: Number(formData.quantityReceived),
                quantityRemaining: Number(formData.quantityReceived),
                receivedDate: formData.receivedDate || new Date().toISOString().split('T')[0],
                expirationDate: formData.expirationDate || null,
                batchNumber: formData.batchNumber.trim(),
                supplierName: formData.supplierName.trim(),
            };

            const response = await authFetch('/inventory/batches', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                setServerMessage(data.message || 'Failed to add stock.');
                if (data.errors) setErrors((prev) => ({ ...prev, ...data.errors }));
                return;
            }
            setShowConfirmModal(false);
            setShowSuccessModal(true);
        } catch (error) {
            setServerMessage('Cannot connect to the server.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        if (!validateForm()) return;
        setShowConfirmModal(true);
    };

    const handleSuccessClose = () => {
        setShowSuccessModal(false);
        onSuccess();
        onClose();
    };

    return (
        <div className={styles.mainOverlay}>
            <div className={styles.overlayBackground} onClick={!isSaving && !showSuccessModal ? onClose : undefined} />

            <div className={styles.formCard}>
                <div className={styles.headerWrapper}>
                    <div className={styles.headerLeft}>
                        <button className={styles.backIconButton} onClick={onClose} type="button" disabled={isSaving}>
                            <img src={BackIcon} alt="Back" />
                        </button>
                        <div className={styles.header}>
                            <h2>Add <span className={styles.highlight}>Supply / Stock</span></h2>
                            <p>Receive fresh stock for the selected item and keep the batch history accurate.</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} noValidate>
                    <h3 className={styles.mainSectionTitle}>Stock Details</h3>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>ITEM <span style={{ color: 'red' }}>*</span></label>
                            <select
                                className={`${styles.inputField} ${errors.itemId ? styles.errorBorder : ''}`}
                                name="itemId"
                                value={formData.itemId}
                                onChange={handleChange}
                                disabled={isSaving || isItemLocked}
                            >
                                <option value="" hidden>Select an existing item</option>
                                {items.map((item) => (
                                    <option key={item.itemId} value={item.itemId}>
                                        {item.branch ? `${item.name} - ${item.branch}` : item.name}
                                    </option>
                                ))}
                            </select>
                            {isItemLocked && selectedItem && (
                                <span className={styles.helperText}>
                                    This stock entry is locked to `{selectedItem.name}`{selectedItem.branch ? ` in ${selectedItem.branch}` : ''}.
                                </span>
                            )}
                            {errors.itemId && <span className={styles.errorText}>{errors.itemId}</span>}
                        </div>

                        <div className={styles.formGroup}>
                            <label>BRAND <span style={{ color: 'red' }}>*</span></label>
                            <input
                                list="inventory-brand-options"
                                className={`${styles.inputField} ${errors.brand ? styles.errorBorder : ''}`}
                                name="brand"
                                value={formData.brand}
                                onChange={handleChange}
                                placeholder={selectedItem ? 'Type or pick a known brand' : 'Select item first'}
                                disabled={isSaving || !selectedItem}
                            />
                            <datalist id="inventory-brand-options">
                                {brandOptions.map((brand) => (
                                    <option key={brand} value={brand} />
                                ))}
                            </datalist>
                            {errors.brand && <span className={styles.errorText}>{errors.brand}</span>}
                        </div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>QUANTITY RECEIVED <span style={{ color: 'red' }}>*</span></label>
                            <input type="number" min="1" className={`${styles.inputField} ${errors.quantityReceived ? styles.errorBorder : ''}`} name="quantityReceived" value={formData.quantityReceived} onChange={handleChange} placeholder="0" disabled={isSaving} />
                            {errors.quantityReceived && <span className={styles.errorText}>{errors.quantityReceived}</span>}
                        </div>
                        <div className={styles.formGroup}>
                            <label>RECEIVED DATE</label>
                            <input type="date" className={styles.inputField} name="receivedDate" value={formData.receivedDate} onChange={handleChange} disabled={isSaving} />
                        </div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>EXPIRATION DATE</label>
                            <input type="date" className={styles.inputField} name="expirationDate" value={formData.expirationDate} onChange={handleChange} disabled={isSaving} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>BATCH NUMBER</label>
                            <input className={styles.inputField} name="batchNumber" value={formData.batchNumber} onChange={handleChange} placeholder="Optional batch / lot number" maxLength={80} disabled={isSaving} />
                        </div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>SUPPLIER</label>
                            <input className={styles.inputField} name="supplierName" value={formData.supplierName} onChange={handleChange} placeholder="Optional supplier name" maxLength={100} disabled={isSaving} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>UNIT</label>
                            <input className={styles.inputField} value={selectedItem?.unit || ''} disabled />
                        </div>
                    </div>

                    {serverMessage && <div className={styles.errorText} style={{ marginLeft: 0 }}>{serverMessage}</div>}

                    <div className={styles.buttonGroup}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isSaving}>Cancel</button>
                        <button type="submit" className={styles.submitBtn} disabled={isSaving}>{isSaving ? 'SAVING...' : 'SAVE STOCK'}</button>
                    </div>
                </form>
            </div>

            <ConfirmModal
                isOpen={showConfirmModal}
                title="Confirm Stock Addition"
                message="Are you sure you want to save this stock batch? This will immediately update the inventory tracker."
                confirmText={isSaving ? 'Saving...' : 'Yes, Save Stock'}
                onConfirm={submitStock}
                onCancel={() => !isSaving && setShowConfirmModal(false)}
            />

            {showSuccessModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard}>
                        <img src={successIcon} alt="Success" className={styles.modalIcon} />
                        <h3 className={styles.modalTitle}>Stock Added!</h3>
                        <p className={styles.modalMessage}>The new supply batch has been added successfully.</p>
                        <button className={styles.modalButton} onClick={handleSuccessClose}>DONE</button>
                    </div>
                </div>
            )}
        </div>
    );
}
