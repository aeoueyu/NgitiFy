import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styles from '../../styles/admin/InventoryTracker.module.css'; 
import { FaSearch, FaPlus, FaEdit, FaTrash, FaExclamationCircle, FaBoxes, FaExclamationTriangle, FaTimesCircle } from 'react-icons/fa';
import { usePermissions } from '../../hooks/usePermissions';
import { authFetch } from '../../utils/api';

import AddInventoryItem from './AddInventoryItem'; 
import EditInventoryItem from './EditInventoryItem'; 
import ConfirmModal from '../../components/common/ConfirmModal'; 
import { useToast } from '../../context/ToastContext';

const BASE_CATEGORIES = [
    "Personal Protective Equipment (PPE)", "Consumables", "Restorative Materials", 
    "Diagnostic Supplies", "Surgical Supplies", "Endodontic Supplies", 
    "Cleaning & Sterilization", "General Clinic Supplies"
];

const BASE_UNITS = ["pcs", "box", "set", "pack", "bottle", "tube"];

export default function InventoryTracker() {
    const { addToast } = useToast();
    const { canReadInventory, canEditInventory } = usePermissions();

    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [inventoryList, setInventoryList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false); 
    const [selectedItemId, setSelectedItemId] = useState(null);    

    const [confirmConfig, setConfirmConfig] = useState(null);

    const fetchInventory = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await authFetch('/inventory');

            if (response.ok) {
                const data = await response.json();
                
                const mappedInventory = data.map(item => ({
                    id: item._id,
                    name: item.itemName || item.name || 'Unknown Item',
                    category: item.category || 'Uncategorized',
                    currentStock: item.quantity !== undefined ? item.quantity : (item.currentStock || 0),
                    threshold: item.reorderLevel !== undefined ? item.reorderLevel : (item.threshold || 0),
                    unit: item.unit || 'pcs'
                }));
                
                setInventoryList(mappedInventory);
            } else {
                console.error("Failed to load inventory data");
            }
        } catch (error) {
            console.error("Error fetching inventory:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (canReadInventory) {
            fetchInventory();
        }
    }, [fetchInventory, canReadInventory]);

    const dynamicCategories = useMemo(() => {
        const fetchedCategories = inventoryList.map(item => item.category).filter(Boolean);
        const uniqueCategories = [...new Set([...BASE_CATEGORIES, ...fetchedCategories])];
        return uniqueCategories.sort();
    }, [inventoryList]);

    const dynamicUnits = useMemo(() => {
        const fetchedUnits = inventoryList.map(item => item.unit).filter(Boolean);
        const uniqueUnits = [...new Set([...BASE_UNITS, ...fetchedUnits])];
        return uniqueUnits.sort();
    }, [inventoryList]);

    const inventoryStats = useMemo(() => {
        let total = inventoryList.length;
        let lowStock = 0;
        let outOfStock = 0;

        inventoryList.forEach(item => {
            if (item.currentStock <= 0) {
                outOfStock++;
            } else if (item.currentStock <= item.threshold) {
                lowStock++;
            }
        });

        return { total, lowStock, outOfStock };
    }, [inventoryList]);

    if (!canReadInventory) {
        return (
            <div className={styles.container}>
                <div style={{ textAlign: 'center', padding: '100px', color: '#dc3545', fontWeight: 'bold', fontSize: '18px' }}>
                    Access Denied. You do not have permission to view the Inventory module.
                </div>
            </div>
        );
    }

    const filteredInventory = inventoryList.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
        return matchesSearch && matchesCategory;
    });

    const triggerDelete = (id, itemName) => {
        setConfirmConfig({
            title: 'Delete Inventory Item',
            message: `Are you sure you want to permanently delete "${itemName}"? This action cannot be undone.`,
            confirmText: 'Yes, Delete',
            isDestructive: true,
            onConfirm: () => executeDelete(id)
        });
    };

    const executeDelete = async (id) => {
        try {
            const res = await authFetch(`/inventory/${id}`, { method: 'DELETE' });

            if (res.ok) {
                setInventoryList(prev => prev.filter(item => item.id !== id));
                addToast('Item deleted successfully.', 'success');
            } else {
                const data = await res.json();
                addToast(data.message || "Failed to delete item.", 'error'); 
            }
        } catch (error) {
            console.error("Error deleting item:", error);
            addToast("Cannot connect to server.", 'error'); 
        } finally {
            setConfirmConfig(null); 
        }
    };

    const handleEditClick = (id) => {
        setSelectedItemId(id);
        setIsEditModalOpen(true);
    };

    const handleCloseEditModal = () => {
        setIsEditModalOpen(false);
        setSelectedItemId(null);
    };

    const getStatusBadge = (current, threshold) => {
        if (current <= 0) {
            return <span style={{ backgroundColor: '#fef2f2', color: '#dc3545', padding: '6px 14px', borderRadius: '20px', fontWeight: '700', fontSize: '11px', border: '1px solid #fecaca', whiteSpace: 'nowrap' }}>OUT OF STOCK</span>;
        }
        if (current <= threshold) {
            return (
                <span style={{ backgroundColor: '#fffbeb', color: '#d97706', padding: '6px 14px', borderRadius: '20px', fontWeight: '700', fontSize: '11px', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                    <FaExclamationCircle /> LOW STOCK
                </span>
            );
        }
        return <span style={{ backgroundColor: '#f0fdf4', color: '#16a34a', padding: '6px 14px', borderRadius: '20px', fontWeight: '700', fontSize: '11px', border: '1px solid #bbf7d0', whiteSpace: 'nowrap' }}>IN STOCK</span>;
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Inventory Tracker</h1>
                <p className={styles.subtitle}>Monitor clinic supplies, check stock levels, and receive low-stock alerts.</p>
            </header>

            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <p className={styles.statTitle}>Total Items</p>
                        <div className={`${styles.statIconWrapper} ${styles.bgBlue}`}>
                            <FaBoxes className={styles.statIcon} />
                        </div>
                    </div>
                    <h2 className={styles.statValue}>{inventoryStats.total}</h2>
                    <p className={styles.statDesc}>Tracked in system</p>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <p className={styles.statTitle}>Low Stock</p>
                        <div className={`${styles.statIconWrapper} ${styles.bgYellow}`}>
                            <FaExclamationTriangle className={styles.statIcon} />
                        </div>
                    </div>
                    <h2 className={styles.statValue} style={{ color: inventoryStats.lowStock > 0 ? '#d97706' : '#01538b' }}>
                        {inventoryStats.lowStock}
                    </h2>
                    <p className={`${styles.statDesc} ${inventoryStats.lowStock > 0 ? styles.warningText : ''}`}>
                        {inventoryStats.lowStock > 0 ? 'Approaching depletion' : 'Stock levels optimal'}
                    </p>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <p className={styles.statTitle}>Out of Stock</p>
                        <div className={`${styles.statIconWrapper} ${styles.bgRed}`}>
                            <FaTimesCircle className={styles.statIcon} />
                        </div>
                    </div>
                    <h2 className={styles.statValue} style={{ color: inventoryStats.outOfStock > 0 ? '#dc2626' : '#01538b' }}>
                        {inventoryStats.outOfStock}
                    </h2>
                    <p className={`${styles.statDesc} ${inventoryStats.outOfStock > 0 ? styles.dangerText : ''}`}>
                        {inventoryStats.outOfStock > 0 ? 'Requires immediate restock' : 'No empty stocks'}
                    </p>
                </div>
            </div>

            <div className={styles.controlsRow}>
                <div className={styles.searchFilterGroup}>
                    <div className={styles.searchWrapper}>
                        <FaSearch className={styles.searchIcon} />
                        <input 
                            type="text" 
                            placeholder="Search items by name..." 
                            className={styles.searchInput} 
                            value={searchQuery} 
                            onChange={(e) => setSearchQuery(e.target.value)} 
                        />
                    </div>
                    
                    <select 
                        className={styles.filterSelect} 
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                        <option value="All">All Categories</option>
                        {dynamicCategories.map(cat => (
                            <option key={`filter-${cat}`} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>
                
                {canEditInventory && (
                    <button className={styles.addBtn} onClick={() => setIsAddModalOpen(true)}>
                        <FaPlus className={styles.btnIcon} style={{ fontSize: '12px', marginRight: '8px' }} /> Add New Item
                    </button>
                )}
            </div>

            <div className={styles.tableContainer}>
                <table className={styles.userTable}>
                    <thead>
                        <tr>
                            <th style={{ width: '25%' }}>Item Name</th>
                            <th style={{ width: '22%' }}>Category</th>
                            <th style={{ width: '20%' }}>Stock Level</th>
                            <th style={{ width: '13%' }}>Threshold</th>
                            <th style={{ width: '10%' }}>Status</th>
                            <th style={{ width: '10%', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="6" style={{textAlign: 'center', padding: '40px', color: '#01538b'}}>Loading inventory records...</td></tr>
                        ) : filteredInventory.length > 0 ? (
                            filteredInventory.map((item) => {
                                const maxVisualCapacity = Math.max(item.currentStock, item.threshold * 2) || 1;
                                const fillPercentage = Math.min(100, (item.currentStock / maxVisualCapacity) * 100);
                                
                                let fillClass = styles.fillGreen;
                                if (item.currentStock <= 0) fillClass = styles.fillRed;
                                else if (item.currentStock <= item.threshold) fillClass = styles.fillYellow;

                                return (
                                    <tr key={item.id}>
                                        <td className={styles.fwBold} style={{ color: '#01538b', fontSize: '15px' }}>{item.name}</td>
                                        <td>
                                            <span style={{ backgroundColor: '#f1f5f9', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                                {item.category}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{ fontWeight: '700', color: item.currentStock <= item.threshold ? '#dc3545' : '#334155', fontSize: '15px' }}>
                                                {item.currentStock} <span style={{ fontSize: '12px', fontWeight: '500', color: '#64748b' }}>{item.unit}</span>
                                            </span>
                                            <div className={styles.progressBarBg}>
                                                <div 
                                                    className={`${styles.progressBarFill} ${fillClass}`}
                                                    style={{ width: `${fillPercentage}%` }}
                                                ></div>
                                            </div>
                                        </td>
                                        <td style={{ color: '#64748b', fontSize: '14px', fontWeight: '500' }}>
                                            {item.threshold} <span style={{ fontSize: '12px' }}>{item.unit}</span>
                                        </td>
                                        <td>{getStatusBadge(item.currentStock, item.threshold)}</td>
                                        <td className={styles.actionsCell} style={{ textAlign: 'center' }}>
                                            {canEditInventory ? (
                                                <>
                                                    <button className={styles.iconBtn} onClick={() => handleEditClick(item.id)} title="Edit Item"><FaEdit /></button>
                                                    <button className={`${styles.iconBtn} ${styles.deleteBtn}`} onClick={() => triggerDelete(item.id, item.name)} title="Delete Item" style={{ color: '#dc3545' }}><FaTrash /></button>
                                                </>
                                            ) : (
                                                <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>Read Only</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr><td colSpan="6" style={{textAlign: 'center', padding: '40px', color: '#64748b'}}>No items found in inventory.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isAddModalOpen && (
                <AddInventoryItem 
                    existingCategories={dynamicCategories} 
                    existingUnits={dynamicUnits}
                    onClose={() => setIsAddModalOpen(false)} 
                    onSuccess={fetchInventory} 
                />
            )}

            {isEditModalOpen && selectedItemId && (
                <EditInventoryItem 
                    itemId={selectedItemId} 
                    existingCategories={dynamicCategories} 
                    existingUnits={dynamicUnits}
                    onClose={handleCloseEditModal} 
                    onSuccess={fetchInventory} 
                />
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
        </div>
    );
}