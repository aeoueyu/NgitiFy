import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styles from '../../styles/owner/InventoryTracker.module.css'; 
import { FaSearch, FaPlus, FaEdit, FaTrash, FaExclamationCircle } from 'react-icons/fa';
import { usePermissions } from '../../hooks/usePermissions';

import AddInventoryItem from './AddInventoryItem'; 
import EditInventoryItem from './EditInventoryItem'; 

const BASE_CATEGORIES = [
    "Personal Protective Equipment (PPE)", "Consumables", "Restorative Materials", 
    "Diagnostic Supplies", "Surgical Supplies", "Endodontic Supplies", 
    "Cleaning & Sterilization", "General Clinic Supplies"
];

const BASE_UNITS = ["pcs", "box", "set", "pack", "bottle", "tube"];

export default function InventoryTracker() {
    const { canReadInventory, canEditInventory } = usePermissions();

    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [inventoryList, setInventoryList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false); 
    const [selectedItemId, setSelectedItemId] = useState(null);    

    const fetchInventory = useCallback(async () => {
        try {
            setIsLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:5000/api/inventory', {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

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

    // ==========================================
    // ALL HOOKS MUST BE ABOVE EARLY RETURNS
    // ==========================================
    
    // Dynamic Categories
    const dynamicCategories = useMemo(() => {
        const fetchedCategories = inventoryList.map(item => item.category).filter(Boolean);
        const uniqueCategories = [...new Set([...BASE_CATEGORIES, ...fetchedCategories])];
        return uniqueCategories.sort();
    }, [inventoryList]);

    // Dynamic Units
    const dynamicUnits = useMemo(() => {
        const fetchedUnits = inventoryList.map(item => item.unit).filter(Boolean);
        const uniqueUnits = [...new Set([...BASE_UNITS, ...fetchedUnits])];
        return uniqueUnits.sort();
    }, [inventoryList]);


    // ==========================================
    // HARD STOP: PAGE PROTECTION
    // ==========================================
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

    const handleDelete = async (id, itemName) => {
        if (!window.confirm(`Are you sure you want to permanently delete ${itemName} from inventory?`)) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:5000/api/inventory/${id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (res.ok) {
                setInventoryList(prev => prev.filter(item => item.id !== id));
            } else {
                const data = await res.json();
                alert(data.message || "Failed to delete item.");
            }
        } catch (error) {
            console.error("Error deleting item:", error);
            alert("Cannot connect to server.");
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
            return <span style={{ backgroundColor: '#fef2f2', color: '#dc3545', padding: '5px 12px', borderRadius: '20px', fontWeight: '600', fontSize: '12px', border: '1px solid #fecaca' }}>Out of Stock</span>;
        }
        if (current <= threshold) {
            return (
                <span style={{ backgroundColor: '#fffbeb', color: '#d97706', padding: '5px 12px', borderRadius: '20px', fontWeight: '600', fontSize: '12px', border: '1px solid #fde68a', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <FaExclamationCircle /> Low Stock
                </span>
            );
        }
        return <span style={{ backgroundColor: '#f0fdf4', color: '#16a34a', padding: '5px 12px', borderRadius: '20px', fontWeight: '600', fontSize: '12px', border: '1px solid #bbf7d0' }}>In Stock</span>;
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Inventory Tracker</h1>
                <p className={styles.subtitle}>Monitor clinic supplies, check stock levels, and receive low-stock alerts.</p>
            </header>

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
                
                {/* PROTECTED: ADD BUTTON */}
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
                            <th>Item Name</th>
                            <th>Category</th>
                            <th>Stock Level</th>
                            <th>Threshold (Min)</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="6" style={{textAlign: 'center', padding: '30px', color: '#01538b'}}>Loading inventory records...</td></tr>
                        ) : filteredInventory.length > 0 ? (
                            filteredInventory.map((item) => (
                                <tr key={item.id}>
                                    <td className={styles.fwBold} style={{ color: '#01538b' }}>{item.name}</td>
                                    <td>
                                        <span style={{ backgroundColor: '#f1f5f9', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', color: '#475569', fontWeight: '500' }}>
                                            {item.category}
                                        </span>
                                    </td>
                                    <td style={{ fontWeight: '600', color: item.currentStock <= item.threshold ? '#dc3545' : '#333' }}>
                                        {item.currentStock} {item.unit}
                                    </td>
                                    <td style={{ color: '#888', fontSize: '13px' }}>
                                        {item.threshold} {item.unit}
                                    </td>
                                    <td>{getStatusBadge(item.currentStock, item.threshold)}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        {/* PROTECTED: EDIT & DELETE BUTTONS */}
                                        {canEditInventory ? (
                                            <>
                                                <button className={styles.iconBtn} onClick={() => handleEditClick(item.id)} title="Edit Item"><FaEdit /></button>
                                                <button className={`${styles.iconBtn} ${styles.deleteBtn}`} onClick={() => handleDelete(item.id, item.name)} title="Delete Item" style={{ color: '#dc3545' }}><FaTrash /></button>
                                            </>
                                        ) : (
                                            <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>Read Only</span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr><td colSpan="6" style={{textAlign: 'center', padding: '30px', color: '#64748b'}}>No items found in inventory.</td></tr>
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
        </div>
    );
}