import React, { useState, useEffect, useCallback } from 'react';
import styles from '../../styles/owner/InventoryTracker.module.css'; 
import { FaSearch, FaPlus, FaEdit, FaTrash, FaExclamationCircle } from 'react-icons/fa';

import AddInventoryItem from './AddInventoryItem'; 
import EditInventoryItem from './EditInventoryItem'; 

export default function InventoryTracker() {
    const [searchQuery, setSearchQuery] = useState('');
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
                    // FIXED: Now safely checks for reorderLevel
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
        fetchInventory();
    }, [fetchInventory]);

    const filteredInventory = inventoryList.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDelete = async (id, itemName) => {
        if (!window.confirm(`Are you sure you want to permanently delete ${itemName}?`)) return;

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
            return <span style={{ color: '#dc3545', fontWeight: '600', fontSize: '13px' }}>Out of Stock</span>;
        }
        if (current <= threshold) {
            return (
                <span style={{ color: '#f59e0b', fontWeight: '600', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FaExclamationCircle /> Low Stock
                </span>
            );
        }
        return <span style={{ color: '#28a745', fontWeight: '600', fontSize: '13px' }}>In Stock</span>;
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Inventory Tracker</h1>
                <p className={styles.subtitle}>Monitor clinic supplies, check stock levels, and receive low-stock alerts.</p>
            </header>

            <div className={styles.controlsRow}>
                <div className={styles.searchWrapper}>
                    <FaSearch className={styles.searchIcon} />
                    <input 
                        type="text" 
                        placeholder="Search items by name or category..." 
                        className={styles.searchInput} 
                        value={searchQuery} 
                        onChange={(e) => setSearchQuery(e.target.value)} 
                    />
                </div>
                
                <button className={styles.addBtn} onClick={() => setIsAddModalOpen(true)}>
                    <FaPlus className={styles.btnIcon} style={{ fontSize: '12px' }} /> Add New Item
                </button>
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
                            <th>Actions</th>
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
                                        <span style={{ backgroundColor: '#f0f4f8', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', color: '#555' }}>
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
                                    <td>
                                        <button 
                                            className={styles.iconBtn} 
                                            onClick={() => handleEditClick(item.id)}
                                            title="Edit Item"
                                        >
                                            <FaEdit />
                                        </button>
                                        
                                        <button 
                                            className={`${styles.iconBtn} ${styles.deleteBtn}`} 
                                            onClick={() => handleDelete(item.id, item.name)}
                                            title="Delete Item"
                                        >
                                            <FaTrash />
                                        </button>
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
                    onClose={() => setIsAddModalOpen(false)} 
                    onSuccess={fetchInventory} 
                />
            )}

            {isEditModalOpen && selectedItemId && (
                <EditInventoryItem 
                    itemId={selectedItemId}
                    onClose={handleCloseEditModal} 
                    onSuccess={fetchInventory} 
                />
            )}
        </div>
    );
}