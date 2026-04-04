import React, { useState, useEffect } from 'react';
import styles from '../../styles/owner/AddInventoryItem.module.css'; // Reusing the shared CSS module!
import successIcon from '../../assets/alert/success.svg'; 
import BackIcon from '../../assets/icons/Back.svg'; 

const categoryOptions = [
    "Diagnostic Supplies", "Preventive Supplies", "Restorative Materials", 
    "Surgical Supplies", "Endodontic Supplies", "Periodontic Supplies", 
    "Orthodontic Supplies", "Personal Protective Equipment (PPE)", "Cleaning & Sterilization",
    "General Clinic Supplies"
];

const unitOptions = ["pcs", "box", "set", "pack", "bottle", "tube", "vial"];

export default function EditInventoryItem({ itemId, onClose, onSuccess }) {
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [errors, setErrors] = useState({});

    const [formData, setFormData] = useState({
        name: '', category: '', currentStock: '', threshold: '', unit: 'pcs'
    });
    const [initialData, setInitialData] = useState(null);

    useEffect(() => {
        const fetchItemData = async () => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`http://localhost:5000/api/inventory/${itemId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    const fetchedData = {
                        name: data.itemName || data.name || '',
                        category: data.category || '',
                        currentStock: data.quantity !== undefined ? data.quantity.toString() : (data.currentStock !== undefined ? data.currentStock.toString() : ''),
                        threshold: data.reorderLevel !== undefined ? data.reorderLevel.toString() : '',
                        unit: data.unit || 'pcs'
                    };
                    setFormData(fetchedData);
                    setInitialData(fetchedData);
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
    }, [itemId, onClose]);

    const hasChanges = initialData ? JSON.stringify(formData) !== JSON.stringify(initialData) : false;

    const handleChange = (e) => {
        const { name, value } = e.target;
        if ((name === 'currentStock' || name === 'threshold') && value !== '' && Number(value) < 0) return;
        setFormData(prev => ({ ...prev, [name]: value }));
        
        if (errors[name]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[name];
                return newErrors;
            });
        }
    };

    const validateForm = () => {
        let newErrors = {};
        let isValid = true;
        if (!formData.name.trim()) { newErrors.name = "Item name is required"; isValid = false; }
        if (!formData.category) { newErrors.category = "Category is required"; isValid = false; }
        if (formData.currentStock === '') { newErrors.currentStock = "Stock level is required"; isValid = false; }
        if (formData.threshold === '') { newErrors.threshold = "Threshold is required"; isValid = false; }
        
        setErrors(newErrors);
        if (!isValid) {
            const firstErrorKey = Object.keys(newErrors)[0];
            const el = document.getElementsByName(firstErrorKey)[0];
            if(el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
        }
        return isValid;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        setIsSaving(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`http://localhost:5000/api/inventory/${itemId}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    itemName: formData.name.trim(), 
                    category: formData.category,
                    quantity: Number(formData.currentStock), 
                    reorderLevel: Number(formData.threshold), 
                    unit: formData.unit
                }),
            });

            if (response.ok) {
                setShowSuccessModal(true);
            } else {
                const data = await response.json();
                alert(data.message || "Failed to update inventory item.");
            }
        } catch (error) {
            console.error("Error:", error);
            alert("Cannot connect to server.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleSuccessClose = () => {
        setShowSuccessModal(false);
        onSuccess(); 
        onClose();   
    };

    return (
        <div className={styles.mainOverlay}>
            <div className={styles.overlayBackground} onClick={!isSaving && !showSuccessModal ? onClose : undefined}></div>
            
            <div className={styles.formCard}>
                {isLoading ? (
                    <div style={{ textAlign: 'center', padding: '50px', color: '#01538b', fontWeight: 'bold' }}>
                        Loading Item Data...
                    </div>
                ) : (
                    <>
                        <div className={styles.headerWrapper}>
                            <button className={styles.backIconButton} onClick={onClose} type="button" disabled={isSaving}>
                                <img src={BackIcon} alt="Back" />
                            </button>
                            <div className={styles.header}>
                                <h2>Edit <span className={styles.highlight}>Inventory Item</span></h2>
                                <p>Update the details and stock thresholds for this item.</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} noValidate>
                            <h3 className={styles.mainSectionTitle}>Item Details</h3>
                            
                            <div className={styles.row}>
                                <div className={styles.formGroup}>
                                    <label>ITEM NAME <span style={{color:'red'}}>*</span></label>
                                    <input 
                                        className={`${styles.inputField} ${errors.name ? styles.errorBorder : ''}`} 
                                        name="name" value={formData.name} onChange={handleChange} 
                                        placeholder="e.g. Disposable Saliva Ejector" maxLength={100} disabled={isSaving}
                                    />
                                    {errors.name && <span className={styles.errorText}>{errors.name}</span>}
                                </div>
                            </div>

                            <div className={styles.row}>
                                <div className={styles.formGroup}>
                                    <label>CATEGORY <span style={{color:'red'}}>*</span></label>
                                    <select name="category" className={`${styles.inputField} ${errors.category ? styles.errorBorder : ''}`} value={formData.category} onChange={handleChange} disabled={isSaving}>
                                        <option value="" hidden>Select Category</option>
                                        {categoryOptions.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                    {errors.category && <span className={styles.errorText}>{errors.category}</span>}
                                </div>
                                <div className={styles.formGroup}>
                                    <label>UNIT <span style={{color:'red'}}>*</span></label>
                                    <select name="unit" className={styles.inputField} value={formData.unit} onChange={handleChange} disabled={isSaving}>
                                        {unitOptions.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className={styles.row}>
                                <div className={styles.formGroup}>
                                    <label>CURRENT STOCK LEVEL <span style={{color:'red'}}>*</span></label>
                                    <input type="number" className={`${styles.inputField} ${errors.currentStock ? styles.errorBorder : ''}`} name="currentStock" value={formData.currentStock} onChange={handleChange} placeholder="0" min="0" disabled={isSaving}/>
                                    {errors.currentStock && <span className={styles.errorText}>{errors.currentStock}</span>}
                                </div>
                                <div className={styles.formGroup}>
                                    <label>LOW STOCK THRESHOLD <span style={{color:'red'}}>*</span></label>
                                    <input type="number" className={`${styles.inputField} ${errors.threshold ? styles.errorBorder : ''}`} name="threshold" value={formData.threshold} onChange={handleChange} placeholder="Alert when below..." min="0" disabled={isSaving}/>
                                    {errors.threshold && <span className={styles.errorText}>{errors.threshold}</span>}
                                </div>
                            </div>

                            <div className={styles.buttonGroup}>
                                <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isSaving}>CANCEL</button>
                                <button type="submit" className={styles.submitBtn} disabled={isSaving || !hasChanges}>
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
        </div>
    );
}