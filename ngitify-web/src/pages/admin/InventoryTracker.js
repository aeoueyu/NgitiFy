import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styles from '../../styles/admin/InventoryTracker.module.css'; 
import tblStyles from '../../styles/wideTable.module.css';
import { FaSearch, FaPlus, FaEdit, FaTrash, FaExclamationCircle, FaBoxes, FaExclamationTriangle, FaTimesCircle } from 'react-icons/fa';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';

import AddInventoryItem from './AddInventoryItem'; 
import AddInventoryStock from './AddInventoryStock';
import EditInventoryItem from './EditInventoryItem'; 
import ConfirmModal from '../../components/common/ConfirmModal'; 
import { useToast } from '../../context/ToastContext';
import { formatDateShort } from '../../utils/dateUtils';

const BASE_CATEGORIES = [
    "Personal Protective Equipment (PPE)", "Consumables", "Restorative Materials", 
    "Diagnostic Supplies", "Surgical Supplies", "Endodontic Supplies", 
    "Cleaning & Sterilization", "General Clinic Supplies"
];

const BASE_UNITS = ["pcs", "box", "set", "pack", "bottle", "tube"];

export default function InventoryTracker() {
    const { addToast } = useToast();
    const { canReadInventory, canEditInventory } = usePermissions();
    const { user } = useAuth();

    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [inventoryList, setInventoryList] = useState([]);
    const [branchOptions, setBranchOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
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
                    id: item._id || item.id,
                    itemId: item.itemId || '',
                    name: item.itemName || item.name || 'Unknown Item',
                    category: item.category || 'Uncategorized',
                    currentStock: item.quantity !== undefined ? item.quantity : (item.currentStock || 0),
                    threshold: item.reorderLevel !== undefined ? item.reorderLevel : (item.threshold || 0),
                    unit: item.unit || 'pcs',
                    brand: item.brand || 'Unspecified',
                    expirationDate: item.expirationDate || null,
                    receivedDate: item.receivedDate || null,
                    supplierName: item.supplierName || '',
                    batchNumber: item.batchNumber || '',
                    status: item.status || 'Active',
                    isExpired: Boolean(item.isExpired),
                    isExpiringSoon: Boolean(item.isExpiringSoon),
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

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const response = await authFetch('/branches?all=true');
                if (!response.ok) return;
                const data = await response.json();
                const names = (Array.isArray(data) ? data : [])
                    .map((branch) => branch?.name)
                    .filter(Boolean);
                setBranchOptions(names);
            } catch (error) {
                console.error('Failed to fetch branches for inventory:', error);
            }
        };

        if (canReadInventory) {
            fetchBranches();
        }
    }, [canReadInventory]);

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
        let expiringSoon = 0;
        let expired = 0;

        inventoryList.forEach(item => {
            if (item.isExpired || item.status === 'Expired') {
                expired++;
            } else if (item.isExpiringSoon) {
                expiringSoon++;
            }
            if (item.currentStock <= item.threshold) {
                lowStock++;
            }
        });

        return { total, lowStock, expiringSoon, expired };
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
        const query = searchQuery.toLowerCase();
        const matchesSearch =
            item.name.toLowerCase().includes(query) ||
            item.brand.toLowerCase().includes(query) ||
            item.batchNumber.toLowerCase().includes(query);
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

    const getStatusBadge = (item) => {
        if (item.isExpired || item.status === 'Expired') {
            return <span style={{ backgroundColor: '#fef2f2', color: '#dc3545', padding: '6px 14px', borderRadius: '20px', fontWeight: '700', fontSize: '11px', border: '1px solid #fecaca', whiteSpace: 'nowrap' }}>EXPIRED</span>;
        }
        if (item.currentStock <= 0) {
            return <span style={{ backgroundColor: '#f3f4f6', color: '#475569', padding: '6px 14px', borderRadius: '20px', fontWeight: '700', fontSize: '11px', border: '1px solid #cbd5e1', whiteSpace: 'nowrap' }}>DEPLETED</span>;
        }
        if (item.isExpiringSoon) {
            return <span style={{ backgroundColor: '#fffbeb', color: '#d97706', padding: '6px 14px', borderRadius: '20px', fontWeight: '700', fontSize: '11px', border: '1px solid #fde68a', whiteSpace: 'nowrap' }}>EXPIRING SOON</span>;
        }
        if (item.currentStock <= item.threshold) {
            return (
                <span style={{ backgroundColor: '#fffbeb', color: '#d97706', padding: '6px 14px', borderRadius: '20px', fontWeight: '700', fontSize: '11px', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                    <FaExclamationCircle /> LOW STOCK
                </span>
            );
        }
        return <span style={{ backgroundColor: '#f0fdf4', color: '#16a34a', padding: '6px 14px', borderRadius: '20px', fontWeight: '700', fontSize: '11px', border: '1px solid #bbf7d0', whiteSpace: 'nowrap' }}>ACTIVE</span>;
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
                        <p className={styles.statTitle}>Expiring Soon</p>
                        <div className={`${styles.statIconWrapper} ${styles.bgRed}`}>
                            <FaTimesCircle className={styles.statIcon} />
                        </div>
                    </div>
                    <h2 className={styles.statValue} style={{ color: inventoryStats.expiringSoon > 0 ? '#d97706' : '#01538b' }}>
                        {inventoryStats.expiringSoon}
                    </h2>
                    <p className={`${styles.statDesc} ${inventoryStats.expiringSoon > 0 ? styles.warningText : ''}`}>
                        {inventoryStats.expiringSoon > 0 ? 'Prioritize for use soon' : 'No near-expiry batches'}
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
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <button className={styles.addBtn} onClick={() => setIsAddStockModalOpen(true)}>
                            <FaPlus className={styles.btnIcon} style={{ fontSize: '12px', marginRight: '8px' }} /> Add Supply / Stock
                        </button>
                        <button className={styles.addBtn} style={{ backgroundColor: '#2dccf6' }} onClick={() => setIsAddModalOpen(true)}>
                            <FaPlus className={styles.btnIcon} style={{ fontSize: '12px', marginRight: '8px' }} /> Add New Item
                        </button>
                    </div>
                )}
            </div>

            <div className={`${styles.tableContainer} ${tblStyles.tableWrapper}`}>
                <table className={`${styles.userTable} ${styles.inventoryTable}`}>
                    <thead>
                        <tr>
                            <th style={{ width: '26%' }}>Item</th>
                            <th style={{ width: '14%' }}>Brand</th>
                            <th style={{ width: '18%' }}>Category</th>
                            <th style={{ width: '14%' }}>Qty</th>
                            <th style={{ width: '16%' }}>Expiry</th>
                            <th style={{ width: '12%', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="6" style={{textAlign: 'center', padding: '40px', color: '#01538b'}}>Loading inventory records...</td></tr>
                        ) : filteredInventory.length > 0 ? (
                            filteredInventory.map((item) => {
                                return (
                                    <tr key={item.id}>
                                        <td className={tblStyles.wrapCell} style={{ color: '#01538b', fontSize: '15px' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <span className={styles.fwBold} style={{ color: '#01538b', fontSize: '15px' }}>{item.name}</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                    {getStatusBadge(item)}
                                                    {item.batchNumber && (
                                                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>
                                                            Batch {item.batchNumber}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ color: '#334155', fontWeight: 600, whiteSpace: 'nowrap' }}>{item.brand}</td>
                                        <td>
                                            <span style={{ backgroundColor: '#f1f5f9', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', color: '#475569', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                                {item.category}
                                            </span>
                                        </td>
                                        <td>
                                            <span style={{ fontWeight: '700', color: item.currentStock <= item.threshold ? '#dc3545' : '#334155', fontSize: '15px' }}>
                                                {item.currentStock} <span style={{ fontSize: '12px', fontWeight: '500', color: '#64748b' }}>{item.unit}</span>
                                            </span>
                                        </td>
                                        <td style={{ color: item.isExpired ? '#dc2626' : '#64748b', fontSize: '14px', fontWeight: '600' }}>
                                            {item.expirationDate ? formatDateShort(item.expirationDate) : 'No expiry'}
                                        </td>
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
                    inventoryEntries={inventoryList}
                    branchOptions={branchOptions}
                    defaultBranch={user?.assignedBranch || user?.assignedBranches?.[0] || ''}
                    existingCategories={dynamicCategories} 
                    existingUnits={dynamicUnits}
                    onClose={() => setIsAddModalOpen(false)} 
                    onSuccess={fetchInventory} 
                />
            )}

            {isAddStockModalOpen && (
                <AddInventoryStock
                    inventoryEntries={inventoryList}
                    onClose={() => setIsAddStockModalOpen(false)}
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
