import React, { useState, useEffect } from 'react';
import { authFetch } from '../../utils/api';
import styles from '../../styles/admin/StaffModals.module.css'; 
import successIcon from '../../assets/alert/success.svg'; 
import BackIcon from '../../assets/icons/Back.svg'; 
import ConfirmModal from '../../components/common/ConfirmModal';

export default function EditInventoryItem({ itemId, onClose, onSuccess, existingCategories = [], existingUnits = [] }) {
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [serverMessage, setServerMessage] = useState('');

    const [formData, setFormData] = useState({
        name: '', category: '', threshold: '', unit: 'pcs'
    });
    const [initialData, setInitialData] = useState(null);

    const [customCategory, setCustomCategory] = useState('');
    const [customUnit, setCustomUnit] = useState('');

    useEffect(() => {
        const fetchItemData = async () => {
            try {
                const response = await authFetch(`/inventory/items/${itemId}`);

                if (response.ok) {
                    const data = await response.json();
                    
                    const fetchedCat = data.category || '';
                    const isCustomCat = !existingCategories.includes(fetchedCat) && fetchedCat !== '';
                    
                    const fetchedUnit = data.unit || 'pcs';
                    const isCustomUnit = !existingUnits.includes(fetchedUnit) && fetchedUnit !== '';

                    const mappedData = {
                        name: data.itemName || data.name || '',
                        category: isCustomCat ? 'Other' : fetchedCat,
                        threshold: data.reorderLevel !== undefined ? data.reorderLevel.toString() : (data.lowStockThreshold !== undefined ? data.lowStockThreshold.toString() : ''),
                        unit: isCustomUnit ? 'Other' : fetchedUnit,
                    };

                    setFormData(mappedData);
                    setInitialData(mappedData);
                    
                    if (isCustomCat) setCustomCategory(fetchedCat);
                    if (isCustomUnit) setCustomUnit(fetchedUnit);

                } else {
                    alert("Failed to load item data.");
                    onClose();
                }
            } catch (error) {
                console.error("Error fetching inventory item:", error);
                alert("Cannot connect to server.");
                onClose();
            } finally {
                setIsLoading(false);
            }
        };

        if (itemId) fetchItemData();
    }, [itemId, onClose, existingCategories, existingUnits]);

    const hasChanges = initialData ? (
        JSON.stringify(formData) !== JSON.stringify(initialData) ||
        (formData.category === 'Other' && customCategory !== initialData.category) ||
        (formData.unit === 'Other' && customUnit !== initialData.unit)
    ) : false;

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name === 'threshold' && value !== '' && Number(value) < 0) return;
        setFormData(prev => ({ ...prev, [name]: value }));
        setServerMessage('');
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: undefined }));
    };

    const validateForm = () => {
        let newErrors = {}; let isValid = true;
        
        if (!formData.name.trim()) { newErrors.name = "Required"; isValid = false; }
        
        if (!formData.category) { newErrors.category = "Required"; isValid = false; }
        else if (formData.category === 'Other' && !customCategory.trim()) { newErrors.customCategory = "Custom category is required"; isValid = false; }
        
        if (!formData.unit) { newErrors.unit = "Required"; isValid = false; }
        else if (formData.unit === 'Other' && !customUnit.trim()) { newErrors.customUnit = "Custom unit is required"; isValid = false; }

        if (formData.threshold === '') { newErrors.threshold = "Required"; isValid = false; }
        else if (Number(formData.threshold) < 0) { newErrors.threshold = "Cannot be negative"; isValid = false; }
        
        setErrors(newErrors);
        return isValid;
    };

    const submitInventoryUpdate = async () => {
        setIsSaving(true);
        
        const finalCategory = formData.category === 'Other' ? customCategory.trim() : formData.category;
        const finalUnit = formData.unit === 'Other' ? customUnit.trim() : formData.unit;

        try {
            const response = await authFetch(`/inventory/items/${itemId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    itemName: formData.name.trim(),
                    category: finalCategory,
                    reorderLevel: Number(formData.threshold),
                    unit: finalUnit,
                }),
            });

            if (response.ok) {
                setShowConfirmModal(false);
                setShowSuccessModal(true);
            } else {
                const data = await response.json();
                setServerMessage(data.message || "Failed to update inventory item.");
                if (data.errors) setErrors(prev => ({ ...prev, ...data.errors }));
            }
        } catch (error) {
            console.error("Error:", error);
            setServerMessage("Cannot connect to server.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setShowConfirmModal(true);
    };

    const handleSuccessClose = () => { setShowSuccessModal(false); onSuccess(); onClose(); };

    return (
        <div className={styles.mainOverlay}>
            <div className={styles.overlayBackground} onClick={!isSaving && !showSuccessModal ? onClose : undefined}></div>
            
            <div className={styles.formCard}>
                {isLoading ? <div style={{ textAlign: 'center', padding: '50px', color: '#01538b' }}>Loading Item Data...</div> : (
                    <>
                        <div className={styles.headerWrapper}>
                            <div className={styles.headerLeft}>
                                <button className={styles.backIconButton} onClick={onClose} type="button" disabled={isSaving}>
                                    <img src={BackIcon} alt="Back" />
                                </button>
                                <div className={styles.header}>
                                    <h2>Edit <span className={styles.highlight}>Inventory Item</span></h2>
                                    <p>Update the item definition used for tracking and future stock receipts.</p>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} noValidate>
                            <h3 className={styles.mainSectionTitle}>Item Details</h3>
                            
                            <div className={styles.row}>
                                <div className={styles.formGroup}>
                                    <label>ITEM NAME <span style={{color:'red'}}>*</span></label>
                                    <input className={`${styles.inputField} ${errors.name ? styles.errorBorder : ''}`} name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Latex Gloves" maxLength={100} disabled={isSaving} />
                                    {errors.name && <span className={styles.errorText}>{errors.name}</span>}
                                </div>
                            </div>

                            <div className={styles.row}>
                                <div className={styles.formGroup}>
                                    <label>CATEGORY <span style={{color:'red'}}>*</span></label>
                                    <select name="category" className={`${styles.inputField} ${errors.category ? styles.errorBorder : ''}`} value={formData.category} onChange={handleChange} disabled={isSaving}>
                                        <option value="" hidden>Select Category</option>
                                        {existingCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                        <option value="Other">Other (Custom...)</option>
                                    </select>
                                    {errors.category && <span className={styles.errorText}>{errors.category}</span>}

                                    {formData.category === 'Other' && (
                                        <div style={{ marginTop: '10px' }}>
                                            <input 
                                                className={`${styles.inputField} ${errors.customCategory ? styles.errorBorder : ''}`} 
                                                placeholder="Type custom category name..." 
                                                value={customCategory} 
                                                onChange={(e) => { setCustomCategory(e.target.value); if(errors.customCategory) setErrors(prev => ({...prev, customCategory: undefined})); }} 
                                                disabled={isSaving}
                                            />
                                            {errors.customCategory && <span className={styles.errorText}>{errors.customCategory}</span>}
                                        </div>
                                    )}
                                </div>

                                <div className={styles.formGroup}>
                                    <label>UNIT <span style={{color:'red'}}>*</span></label>
                                    <select name="unit" className={`${styles.inputField} ${errors.unit ? styles.errorBorder : ''}`} value={formData.unit} onChange={handleChange} disabled={isSaving}>
                                        <option value="" hidden>Select Unit</option>
                                        {existingUnits.map(u => <option key={u} value={u}>{u}</option>)}
                                        <option value="Other">Other (Custom...)</option>
                                    </select>
                                    {errors.unit && <span className={styles.errorText}>{errors.unit}</span>}

                                    {formData.unit === 'Other' && (
                                        <div style={{ marginTop: '10px' }}>
                                            <input 
                                                className={`${styles.inputField} ${errors.customUnit ? styles.errorBorder : ''}`} 
                                                placeholder="Type custom unit (e.g. rolls)..." 
                                                value={customUnit} 
                                                onChange={(e) => { setCustomUnit(e.target.value); if(errors.customUnit) setErrors(prev => ({...prev, customUnit: undefined})); }} 
                                                disabled={isSaving}
                                            />
                                            {errors.customUnit && <span className={styles.errorText}>{errors.customUnit}</span>}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className={styles.row}>
                                <div className={styles.formGroup}>
                                    <label>LOW STOCK THRESHOLD <span style={{color:'red'}}>*</span></label>
                                    <input type="number" className={`${styles.inputField} ${errors.threshold ? styles.errorBorder : ''}`} name="threshold" value={formData.threshold} onChange={handleChange} placeholder="Alert when below..." min="0" disabled={isSaving} />
                                    {errors.threshold && <span className={styles.errorText}>{errors.threshold}</span>}
                                </div>
                            </div>

                            {serverMessage && <div className={styles.errorText} style={{ marginLeft: 0 }}>{serverMessage}</div>}

                            <div className={styles.buttonGroup}>
                                <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isSaving}>CANCEL</button>
                                <button type="submit" className={styles.submitBtn} disabled={isSaving || (!hasChanges && formData.category !== 'Other' && formData.unit !== 'Other')}>
                                    {isSaving ? 'SAVING CHANGES...' : 'UPDATE ITEM'}
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>

            {showSuccessModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard}>
                        <img src={successIcon} alt="Success" className={styles.modalIcon} />
                        <h3 className={styles.modalTitle}>Success!</h3>
                        <p className={styles.modalMessage}>The inventory item has been successfully updated.</p>
                        <button className={styles.modalButton} onClick={handleSuccessClose}>DONE</button>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={showConfirmModal}
                title="Save Inventory Changes"
                message="Are you sure you want to save these inventory changes? This cannot be undone."
                confirmText={isSaving ? 'Saving...' : 'Yes, Save Changes'}
                onConfirm={submitInventoryUpdate}
                onCancel={() => !isSaving && setShowConfirmModal(false)}
            />
        </div>
    );
}
