import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styles from '../../styles/admin/InventoryTracker.module.css';
import tblStyles from '../../styles/wideTable.module.css';
import {
    FaSearch,
    FaPlus,
    FaTrash,
    FaExclamationCircle,
    FaBoxes,
    FaExclamationTriangle,
    FaTimesCircle,
    FaDownload,
    FaFilePdf,
    FaChevronDown,
    FaChevronUp,
    FaEdit,
} from 'react-icons/fa';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../hooks/useAuth';
import { authFetch } from '../../utils/api';
import { downloadCsvFile, openPrintReport } from '../../utils/exportHelpers';
import AddInventoryItem from './AddInventoryItem';
import AddInventoryStock from './AddInventoryStock';
import EditInventoryItem from './EditInventoryItem';
import ConfirmModal from '../../components/common/ConfirmModal';
import { useToast } from '../../context/ToastContext';
import { formatDateShort } from '../../utils/dateUtils';

const BASE_CATEGORIES = [
    'Personal Protective Equipment (PPE)', 'Consumables', 'Restorative Materials',
    'Diagnostic Supplies', 'Surgical Supplies', 'Endodontic Supplies',
    'Cleaning & Sterilization', 'General Clinic Supplies'
];

const BASE_UNITS = ['pcs', 'box', 'set', 'pack', 'bottle', 'tube'];

const summarizeItem = (item, batches = []) => {
    const totalStock = batches.reduce((sum, batch) => sum + Number(batch.currentStock || batch.quantity || 0), 0);
    const threshold = Number(item.lowStockThreshold ?? item.reorderLevel ?? item.threshold ?? 0);
    const activeBatches = batches.filter((batch) => Number(batch.currentStock || batch.quantity || 0) > 0);
    const expiryCandidates = activeBatches
        .filter((batch) => batch.expirationDate)
        .sort((left, right) => new Date(left.expirationDate) - new Date(right.expirationDate));
    const nearestExpiry = expiryCandidates[0]?.expirationDate || null;
    const hasExpiredBatch = batches.some((batch) => batch.isExpired || batch.status === 'Expired');
    const hasExpiringSoon = batches.some((batch) => batch.isExpiringSoon);
    const isLowStock = totalStock <= threshold;

    return {
        id: item._id || item.id,
        itemId: item._id || item.id,
        name: item.name || item.itemName || 'Unknown Item',
        category: item.category || 'Uncategorized',
        unit: item.unit || 'pcs',
        branch: item.branch || '',
        threshold,
        totalStock,
        nearestExpiry,
        batchCount: batches.length,
        batches,
        hasExpiredBatch,
        hasExpiringSoon,
        isLowStock,
    };
};

export default function InventoryTracker() {
    const { addToast } = useToast();
    const { canReadInventory, canEditInventory } = usePermissions();
    const { user } = useAuth();

    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [inventoryItems, setInventoryItems] = useState([]);
    const [inventoryBatches, setInventoryBatches] = useState([]);
    const [branchOptions, setBranchOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedItems, setExpandedItems] = useState([]);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isAddStockModalOpen, setIsAddStockModalOpen] = useState(false);
    const [selectedStockItemId, setSelectedStockItemId] = useState('');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState(null);

    const [confirmConfig, setConfirmConfig] = useState(null);

    const fetchInventory = useCallback(async () => {
        try {
            setIsLoading(true);
            const [itemsResponse, batchesResponse] = await Promise.all([
                authFetch('/inventory/items'),
                authFetch('/inventory'),
            ]);

            if (!itemsResponse.ok || !batchesResponse.ok) {
                throw new Error('Failed to load inventory data.');
            }

            const [itemsData, batchesData] = await Promise.all([
                itemsResponse.json(),
                batchesResponse.json(),
            ]);

            setInventoryItems(Array.isArray(itemsData) ? itemsData : []);
            setInventoryBatches(Array.isArray(batchesData) ? batchesData.map((batch) => ({
                ...batch,
                id: batch._id || batch.id,
                itemId: batch.itemId || batch.inventoryItem || '',
                name: batch.itemName || batch.name || 'Unknown Item',
                currentStock: batch.quantity !== undefined ? Number(batch.quantity) : Number(batch.currentStock || 0),
                threshold: batch.reorderLevel !== undefined ? Number(batch.reorderLevel) : Number(batch.threshold || 0),
                unit: batch.unit || 'pcs',
                branch: batch.branch || '',
            })) : []);
        } catch (error) {
            console.error('Error fetching inventory:', error);
            addToast('Failed to load inventory data.', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [addToast]);

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

    const batchesByItemId = useMemo(() => {
        const grouped = new Map();
        inventoryBatches.forEach((batch) => {
            const key = String(batch.itemId || '');
            if (!key) return;
            const existing = grouped.get(key) || [];
            existing.push(batch);
            grouped.set(key, existing);
        });
        grouped.forEach((batches, key) => {
            grouped.set(key, batches.sort((left, right) => {
                const leftDate = left.receivedDate ? new Date(left.receivedDate).getTime() : 0;
                const rightDate = right.receivedDate ? new Date(right.receivedDate).getTime() : 0;
                return leftDate - rightDate;
            }));
        });
        return grouped;
    }, [inventoryBatches]);

    const dynamicCategories = useMemo(() => {
        const fetchedCategories = inventoryItems.map((item) => item.category).filter(Boolean);
        return [...new Set([...BASE_CATEGORIES, ...fetchedCategories])].sort();
    }, [inventoryItems]);

    const dynamicUnits = useMemo(() => {
        const fetchedUnits = inventoryItems.map((item) => item.unit).filter(Boolean);
        return [...new Set([...BASE_UNITS, ...fetchedUnits])].sort();
    }, [inventoryItems]);

    const summaryInventory = useMemo(() => {
        return inventoryItems
            .map((item) => summarizeItem(item, batchesByItemId.get(String(item._id || item.id || '')) || []))
            .sort((left, right) => left.name.localeCompare(right.name));
    }, [inventoryItems, batchesByItemId]);

    const inventoryStats = useMemo(() => {
        let lowStock = 0;
        let expiringSoon = 0;
        let expired = 0;

        summaryInventory.forEach((item) => {
            if (item.isLowStock) lowStock++;
            if (item.hasExpiringSoon) expiringSoon++;
            if (item.hasExpiredBatch) expired++;
        });

        return {
            total: summaryInventory.length,
            lowStock,
            expiringSoon,
            expired,
        };
    }, [summaryInventory]);

    const filteredInventory = useMemo(() => {
        const query = searchQuery.toLowerCase();
        return summaryInventory.filter((item) => {
            const matchesSearch =
                item.name.toLowerCase().includes(query) ||
                item.category.toLowerCase().includes(query) ||
                item.batches.some((batch) =>
                    String(batch.brand || '').toLowerCase().includes(query) ||
                    String(batch.batchNumber || '').toLowerCase().includes(query)
                );
            const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [summaryInventory, searchQuery, categoryFilter]);

    const exportRows = filteredInventory.map((item) => [
        item.name,
        item.branch || 'Unassigned',
        item.category,
        `${item.totalStock} ${item.unit}`,
        item.threshold,
        item.nearestExpiry ? formatDateShort(item.nearestExpiry) : 'No expiry',
        item.batchCount,
        item.isLowStock ? 'Low Stock' : item.hasExpiredBatch ? 'Has Expired Batch' : item.hasExpiringSoon ? 'Expiring Soon' : 'Healthy',
    ]);

    const handleExportCsv = () => {
        downloadCsvFile(
            `inventory_${new Date().toISOString().slice(0, 10)}.csv`,
            ['Item', 'Branch', 'Category', 'Total Quantity', 'Reorder Level', 'Nearest Expiry', 'Batches', 'Status'],
            exportRows,
        );
    };

    const handleExportPdf = () => {
        openPrintReport({
            title: 'Inventory Records Report',
            subtitle: 'Dentime Dental Clinic - NgitiFy',
            summaryItems: [
                { label: 'Tracked Items', value: filteredInventory.length },
                { label: 'Low Stock', value: inventoryStats.lowStock },
                { label: 'Expiring Soon', value: inventoryStats.expiringSoon },
                { label: 'Expired', value: inventoryStats.expired },
            ],
            sections: [
                {
                    title: 'Inventory Listing',
                    headers: ['Item', 'Branch', 'Category', 'Total Quantity', 'Reorder Level', 'Nearest Expiry', 'Batches', 'Status'],
                    rows: exportRows,
                },
            ],
        });
    };

    if (!canReadInventory) {
        return (
            <div className={styles.container}>
                <div style={{ textAlign: 'center', padding: '100px', color: '#dc3545', fontWeight: 'bold', fontSize: '18px' }}>
                    Access Denied. You do not have permission to view the Inventory module.
                </div>
            </div>
        );
    }

    const toggleExpanded = (itemId) => {
        setExpandedItems((prev) =>
            prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
        );
    };

    const triggerDeleteBatch = (batchId, itemName, batchNumber) => {
        setConfirmConfig({
            title: 'Delete Stock Batch',
            message: `Are you sure you want to permanently delete the ${batchNumber ? `batch ${batchNumber} for ` : ''}"${itemName}"? This will remove that stock record from the tracker.`,
            confirmText: 'Yes, Delete Batch',
            isDestructive: true,
            onConfirm: () => executeDeleteBatch(batchId)
        });
    };

    const executeDeleteBatch = async (batchId) => {
        try {
            const res = await authFetch(`/inventory/${batchId}`, { method: 'DELETE' });

            if (res.ok) {
                addToast('Stock batch deleted successfully.', 'success');
                fetchInventory();
            } else {
                const data = await res.json();
                addToast(data.message || 'Failed to delete stock batch.', 'error');
            }
        } catch (error) {
            console.error('Error deleting stock batch:', error);
            addToast('Cannot connect to server.', 'error');
        } finally {
            setConfirmConfig(null);
        }
    };

    const getSummaryStatusBadge = (item) => {
        if (item.hasExpiredBatch) {
            return <span className={`${styles.statusBadge} ${styles.expiredBadge}`}>HAS EXPIRED BATCH</span>;
        }
        if (item.totalStock <= 0) {
            return <span className={`${styles.statusBadge} ${styles.depletedBadge}`}>OUT OF STOCK</span>;
        }
        if (item.hasExpiringSoon) {
            return <span className={`${styles.statusBadge} ${styles.warningBadge}`}>EXPIRING SOON</span>;
        }
        if (item.isLowStock) {
            return (
                <span className={`${styles.statusBadge} ${styles.warningBadge}`}>
                    <FaExclamationCircle /> LOW STOCK
                </span>
            );
        }
        return <span className={`${styles.statusBadge} ${styles.healthyBadge}`}>HEALTHY</span>;
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Inventory Tracker</h1>
                <p className={styles.subtitle}>Track supply definitions, receive stock batches, and watch low-stock items for manual restocking.</p>
            </header>

            <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <p className={styles.statTitle}>Tracked Items</p>
                        <div className={`${styles.statIconWrapper} ${styles.bgBlue}`}>
                            <FaBoxes className={styles.statIcon} />
                        </div>
                    </div>
                    <h2 className={styles.statValue}>{inventoryStats.total}</h2>
                    <p className={styles.statDesc}>Supply records in system</p>
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
                        {inventoryStats.lowStock > 0 ? 'Needs manual restock review' : 'Stock levels look stable'}
                    </p>
                </div>

                <div className={styles.statCard}>
                    <div className={styles.statHeader}>
                        <p className={styles.statTitle}>Expiring / Expired</p>
                        <div className={`${styles.statIconWrapper} ${styles.bgRed}`}>
                            <FaTimesCircle className={styles.statIcon} />
                        </div>
                    </div>
                    <h2 className={styles.statValue} style={{ color: (inventoryStats.expiringSoon + inventoryStats.expired) > 0 ? '#d97706' : '#01538b' }}>
                        {inventoryStats.expiringSoon + inventoryStats.expired}
                    </h2>
                    <p className={`${styles.statDesc} ${(inventoryStats.expiringSoon + inventoryStats.expired) > 0 ? styles.warningText : ''}`}>
                        {(inventoryStats.expiringSoon + inventoryStats.expired) > 0 ? 'Check batch usage order' : 'No urgent batch expiry issues'}
                    </p>
                </div>
            </div>

            <div className={styles.controlsRow}>
                <div className={styles.searchFilterGroup}>
                    <div className={styles.searchWrapper}>
                        <FaSearch className={styles.searchIcon} />
                        <input
                            type="text"
                            placeholder="Search items, categories, brands, or batch numbers..."
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
                        {dynamicCategories.map((cat) => (
                            <option key={`filter-${cat}`} value={cat}>{cat}</option>
                        ))}
                    </select>
                </div>

                <div className={styles.headerActions}>
                    <button type="button" className={styles.secondaryBtn} onClick={handleExportCsv} disabled={filteredInventory.length === 0}>
                        <FaDownload /> Export CSV
                    </button>
                    <button type="button" className={styles.secondaryBtn} onClick={handleExportPdf} disabled={filteredInventory.length === 0}>
                        <FaFilePdf /> Export PDF
                    </button>
                    {canEditInventory && (
                        <button className={styles.addBtn} onClick={() => {
                            setSelectedStockItemId('');
                            setIsAddStockModalOpen(true);
                        }}>
                            <FaPlus className={styles.btnIcon} style={{ fontSize: '12px', marginRight: '8px' }} /> Receive Stock
                        </button>
                    )}
                    {canEditInventory && (
                        <button className={styles.addBtn} style={{ backgroundColor: '#2dccf6' }} onClick={() => setIsAddModalOpen(true)}>
                            <FaPlus className={styles.btnIcon} style={{ fontSize: '12px', marginRight: '8px' }} /> Add New Item
                        </button>
                    )}
                </div>
            </div>

            <div className={`${styles.tableContainer} ${tblStyles.tableWrapper}`}>
                <table className={`${styles.userTable} ${styles.inventoryTable}`}>
                    <thead>
                        <tr>
                            <th style={{ width: '26%' }}>Item</th>
                            <th style={{ width: '12%' }}>Branch</th>
                            <th style={{ width: '14%' }}>Category</th>
                            <th style={{ width: '12%' }}>On Hand</th>
                            <th style={{ width: '12%' }}>Reorder</th>
                            <th style={{ width: '14%' }}>Nearest Expiry</th>
                            <th style={{ width: '10%' }}>Batches</th>
                            <th style={{ width: '16%', textAlign: 'center' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#01538b' }}>Loading inventory records...</td></tr>
                        ) : filteredInventory.length > 0 ? (
                            filteredInventory.map((item) => {
                                const isExpanded = expandedItems.includes(item.itemId);
                                return (
                                    <React.Fragment key={item.itemId}>
                                        <tr>
                                            <td className={tblStyles.wrapCell} style={{ color: '#01538b', fontSize: '15px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    <span className={styles.fwBold} style={{ color: '#01538b', fontSize: '15px' }}>{item.name}</span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                        {getSummaryStatusBadge(item)}
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ color: '#334155', fontWeight: 600 }}>{item.branch || 'Unassigned'}</td>
                                            <td>
                                                <span className={styles.categoryPill}>{item.category}</span>
                                            </td>
                                            <td>
                                                <span style={{ fontWeight: '700', color: item.isLowStock ? '#dc3545' : '#334155', fontSize: '15px' }}>
                                                    {item.totalStock} <span style={{ fontSize: '12px', fontWeight: '500', color: '#64748b' }}>{item.unit}</span>
                                                </span>
                                            </td>
                                            <td style={{ color: '#334155', fontWeight: 700 }}>{item.threshold} {item.unit}</td>
                                            <td style={{ color: item.hasExpiredBatch ? '#dc2626' : '#64748b', fontSize: '14px', fontWeight: '600' }}>
                                                {item.nearestExpiry ? formatDateShort(item.nearestExpiry) : 'No expiry'}
                                            </td>
                                            <td style={{ color: '#334155', fontWeight: 700 }}>{item.batchCount}</td>
                                            <td className={styles.actionsCell} style={{ textAlign: 'center' }}>
                                                <button className={styles.iconBtn} onClick={() => toggleExpanded(item.itemId)} title={isExpanded ? 'Hide batches' : 'Show batches'}>
                                                    {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
                                                </button>
                                                {canEditInventory && (
                                                    <>
                                                        <button
                                                            className={styles.iconBtn}
                                                            onClick={() => {
                                                                setSelectedItemId(item.itemId);
                                                                setIsEditModalOpen(true);
                                                            }}
                                                            title="Edit item"
                                                        >
                                                            <FaEdit />
                                                        </button>
                                                        <button
                                                            className={styles.iconBtn}
                                                            onClick={() => {
                                                                setSelectedStockItemId(item.itemId);
                                                                setIsAddStockModalOpen(true);
                                                            }}
                                                            title="Receive stock"
                                                        >
                                                            <FaPlus />
                                                        </button>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan="8" className={styles.batchDetailsCell}>
                                                    {item.batches.length === 0 ? (
                                                        <div className={styles.emptyBatchState}>No stock batches yet. Receive stock when this item arrives at the clinic.</div>
                                                    ) : (
                                                        <div className={styles.batchPanel}>
                                                            <div className={styles.batchPanelHeader}>
                                                                <h3 className={styles.batchPanelTitle}>Batch History</h3>
                                                                <p className={styles.batchPanelSubtitle}>Each batch keeps its own quantity, supplier, and expiry for tracking.</p>
                                                            </div>
                                                            <table className={styles.batchTable}>
                                                                <thead>
                                                                    <tr>
                                                                        <th>Brand</th>
                                                                        <th>Batch No.</th>
                                                                        <th>Supplier</th>
                                                                        <th>Received</th>
                                                                        <th>Expiry</th>
                                                                        <th>Remaining</th>
                                                                        <th>Status</th>
                                                                        {canEditInventory && <th style={{ textAlign: 'center' }}>Action</th>}
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {item.batches.map((batch) => (
                                                                        <tr key={batch.id}>
                                                                            <td>{batch.brand || 'Unspecified'}</td>
                                                                            <td>{batch.batchNumber || '-'}</td>
                                                                            <td>{batch.supplierName || '-'}</td>
                                                                            <td>{batch.receivedDate ? formatDateShort(batch.receivedDate) : '-'}</td>
                                                                            <td>{batch.expirationDate ? formatDateShort(batch.expirationDate) : 'No expiry'}</td>
                                                                            <td>{batch.currentStock} {item.unit}</td>
                                                                            <td>{batch.status || 'Active'}</td>
                                                                            {canEditInventory && (
                                                                                <td style={{ textAlign: 'center' }}>
                                                                                    <button
                                                                                        className={`${styles.iconBtn} ${styles.deleteBtn}`}
                                                                                        onClick={() => triggerDeleteBatch(batch.id, item.name, batch.batchNumber)}
                                                                                        title="Delete batch"
                                                                                        style={{ color: '#dc3545' }}
                                                                                    >
                                                                                        <FaTrash />
                                                                                    </button>
                                                                                </td>
                                                                            )}
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })
                        ) : (
                            <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No items found in inventory.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {isAddModalOpen && (
                <AddInventoryItem
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
                    inventoryEntries={inventoryItems}
                    inventoryBatches={inventoryBatches}
                    initialItemId={selectedStockItemId}
                    onClose={() => {
                        setIsAddStockModalOpen(false);
                        setSelectedStockItemId('');
                    }}
                    onSuccess={fetchInventory}
                />
            )}

            {isEditModalOpen && selectedItemId && (
                <EditInventoryItem
                    itemId={selectedItemId}
                    existingCategories={dynamicCategories}
                    existingUnits={dynamicUnits}
                    onClose={() => {
                        setIsEditModalOpen(false);
                        setSelectedItemId(null);
                    }}
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
