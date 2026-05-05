import React, { useState } from 'react';
import { authFetch } from '../../utils/api';
import { useAuth } from '../../hooks/useAuth';
import styles from '../../styles/admin/StaffModals.module.css'; 
import successIcon from '../../assets/alert/success.svg'; 
import BackIcon from '../../assets/icons/Back.svg'; 
import ConfirmModal from '../../components/common/ConfirmModal';

// Accepting existingUnits prop from InventoryTracker
export default function AddInventoryItem({ onClose, onSuccess, existingCategories = [], existingUnits = [], branchOptions = [], defaultBranch = '' }) {
    const { user } = useAuth();
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [serverMessage, setServerMessage] = useState('');

    const [formData, setFormData] = useState({
        name: '', category: '', currentStock: '', threshold: '10', unit: 'pcs',
        brand: '', expirationDate: '', batchNumber: '', supplierName: '', branch: defaultBranch || ''
    });
    
    const [customCategory, setCustomCategory] = useState('');
    const [customUnit, setCustomUnit] = useState('');
    const isScopedBranchUser = user?.role === 'branch-manager' || user?.role === 'secretary';

    const handleChange = (e) => {
        const { name, value } = e.target;
        if ((name === 'currentStock' || name === 'threshold') && value !== '' && Number(value) < 0) return;
        
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

        if (!formData.branch) { newErrors.branch = "Required"; isValid = false; }

        if (formData.currentStock === '') { newErrors.currentStock = "Required"; isValid = false; }
        else if (Number(formData.currentStock) < 0) { newErrors.currentStock = 'Cannot be negative'; isValid = false; }
        if (formData.threshold === '') { newErrors.threshold = "Required"; isValid = false; }
        else if (Number(formData.threshold) < 0) { newErrors.threshold = 'Cannot be negative'; isValid = false; }
        if (!formData.brand.trim()) { newErrors.brand = "Required"; isValid = false; }
        
        setErrors(newErrors);
        return isValid;
    };

    const submitNewItem = async () => {
        setIsLoading(true);
        
        const finalCategory = formData.category === 'Other' ? customCategory.trim() : formData.category;
        const finalUnit = formData.unit === 'Other' ? customUnit.trim() : formData.unit;

        try {
            const response = await authFetch('/inventory', {
                method: 'POST',
                body: JSON.stringify({
                    itemName: formData.name.trim(),
                    category: finalCategory,
                    quantity: Number(formData.currentStock),
                    reorderLevel: Number(formData.threshold),
                    unit: finalUnit,
                    branch: formData.branch,
                    brand: formData.brand.trim(),
                    expirationDate: formData.expirationDate || null,
                    batchNumber: formData.batchNumber.trim(),
                    supplierName: formData.supplierName.trim(),
                }),
            });

            if (response.ok) {
                setShowConfirmModal(false);
                setShowSuccessModal(true);
            } else {
                const data = await response.json();
                setServerMessage(data.message || "Failed to add inventory item.");
                if (data.errors) setErrors((prev) => ({ ...prev, ...data.errors }));
            }
        } catch (error) {
            console.error("Error:", error);
            setServerMessage("Cannot connect to server.");
        } finally {
            setIsLoading(false);
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
            <div className={styles.overlayBackground} onClick={!isLoading && !showSuccessModal ? onClose : undefined}></div>
            
            <div className={styles.formCard}>
                <div className={styles.headerWrapper}>
                    <div className={styles.headerLeft}>
                        <button className={styles.backIconButton} onClick={onClose} type="button" disabled={isLoading}>
                            <img src={BackIcon} alt="Back" />
                        </button>
                        <div className={styles.header}>
                            <h2>Add New <span className={styles.highlight}>Inventory Item</span></h2>
                            <p>Register new clinic supplies to track their stock levels.</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} noValidate>
                    <h3 className={styles.mainSectionTitle}>Item Details</h3>
                    
                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>ITEM NAME <span style={{color:'red'}}>*</span></label>
                            <input className={`${styles.inputField} ${errors.name ? styles.errorBorder : ''}`} name="name" value={formData.name} onChange={handleChange} placeholder="e.g. Latex Gloves" maxLength={100} disabled={isLoading} />
                            {errors.name && <span className={styles.errorText}>{errors.name}</span>}
                        </div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>CATEGORY <span style={{color:'red'}}>*</span></label>
                            <select name="category" className={`${styles.inputField} ${errors.category ? styles.errorBorder : ''}`} value={formData.category} onChange={handleChange} disabled={isLoading}>
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
                                        disabled={isLoading}
                                    />
                                    {errors.customCategory && <span className={styles.errorText}>{errors.customCategory}</span>}
                                </div>
                            )}
                        </div>

                        <div className={styles.formGroup}>
                            <label>BRANCH <span style={{color:'red'}}>*</span></label>
                            <select
                                name="branch"
                                className={`${styles.inputField} ${errors.branch ? styles.errorBorder : ''}`}
                                value={formData.branch}
                                onChange={handleChange}
                                disabled={isLoading || isScopedBranchUser}
                            >
                                <option value="" hidden>Select Branch</option>
                                {branchOptions.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
                            </select>
                            {errors.branch && <span className={styles.errorText}>{errors.branch}</span>}
                        </div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>UNIT <span style={{color:'red'}}>*</span></label>
                            <select name="unit" className={`${styles.inputField} ${errors.unit ? styles.errorBorder : ''}`} value={formData.unit} onChange={handleChange} disabled={isLoading}>
                                <option value="" hidden>Select Unit</option>
                                {/* Maps dynamic units generated in parent */}
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
                                        disabled={isLoading}
                                    />
                                    {errors.customUnit && <span className={styles.errorText}>{errors.customUnit}</span>}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>INITIAL STOCK LEVEL <span style={{color:'red'}}>*</span></label>
                            <input type="number" className={`${styles.inputField} ${errors.currentStock ? styles.errorBorder : ''}`} name="currentStock" value={formData.currentStock} onChange={handleChange} placeholder="0" min="0" disabled={isLoading} />
                            {errors.currentStock && <span className={styles.errorText}>{errors.currentStock}</span>}
                        </div>
                        <div className={styles.formGroup}>
                            <label>LOW STOCK THRESHOLD <span style={{color:'red'}}>*</span></label>
                            <input type="number" className={`${styles.inputField} ${errors.threshold ? styles.errorBorder : ''}`} name="threshold" value={formData.threshold} onChange={handleChange} placeholder="Alert when below..." min="0" disabled={isLoading} />
                            {errors.threshold && <span className={styles.errorText}>{errors.threshold}</span>}
                        </div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>BRAND <span style={{color:'red'}}>*</span></label>
                            <input className={`${styles.inputField} ${errors.brand ? styles.errorBorder : ''}`} name="brand" value={formData.brand} onChange={handleChange} placeholder="e.g. Listerine" maxLength={80} disabled={isLoading} />
                            {errors.brand && <span className={styles.errorText}>{errors.brand}</span>}
                        </div>
                        <div className={styles.formGroup}>
                            <label>EXPIRATION DATE</label>
                            <input type="date" className={styles.inputField} name="expirationDate" value={formData.expirationDate} onChange={handleChange} disabled={isLoading} />
                        </div>
                    </div>

                    <div className={styles.row}>
                        <div className={styles.formGroup}>
                            <label>BATCH NUMBER</label>
                            <input className={styles.inputField} name="batchNumber" value={formData.batchNumber} onChange={handleChange} placeholder="Optional batch / lot number" maxLength={80} disabled={isLoading} />
                        </div>
                        <div className={styles.formGroup}>
                            <label>SUPPLIER</label>
                            <input className={styles.inputField} name="supplierName" value={formData.supplierName} onChange={handleChange} placeholder="Optional supplier name" maxLength={100} disabled={isLoading} />
                        </div>
                    </div>

                    {serverMessage && <div className={styles.errorText} style={{ marginLeft: 0 }}>{serverMessage}</div>}

                    <div className={styles.buttonGroup}>
                        <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isLoading}>CANCEL</button>
                        <button type="submit" className={styles.submitBtn} disabled={isLoading}>{isLoading ? 'ADDING ITEM...' : 'ADD ITEM'}</button>
                    </div>
                </form>
            </div>

            {showSuccessModal && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modalCard}>
                        <img src={successIcon} alt="Success" className={styles.modalIcon} />
                        <h3 className={styles.modalTitle}>Success!</h3>
                        <p className={styles.modalMessage}>The new item has been added to your inventory tracker.</p>
                        <button className={styles.modalButton} onClick={handleSuccessClose}>DONE</button>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={showConfirmModal}
                title="Save New Inventory Item"
                message="Are you sure you want to save this new inventory item? This will immediately add it to the tracker."
                confirmText={isLoading ? 'Saving...' : 'Yes, Save Item'}
                onConfirm={submitNewItem}
                onCancel={() => !isLoading && setShowConfirmModal(false)}
            />
        </div>
    );
}
