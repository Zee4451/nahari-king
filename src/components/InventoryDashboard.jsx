import React, { useState, useEffect, useMemo, useCallback } from 'react';
import NavigationBar from './NavigationBar';
import { ErrorBanner, SuccessBanner } from './Reusable/LoadingComponents';
import {
    subscribeToInventory,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    addPurchaseRecord,
    addWasteEntry
} from '../services/inventoryService';
import styles from './InventoryBOM.module.css';

const CATEGORIES = [
    { value: 'meat', label: 'Meat' },
    { value: 'spice', label: 'Spice' },
    { value: 'dairy', label: 'Dairy' },
    { value: 'oil', label: 'Oil & Fat' },
    { value: 'grain', label: 'Grain & Flour' },
    { value: 'vegetable', label: 'Vegetable' },
    { value: 'other', label: 'Other' }
];

const UNITS = ['kg', 'g', 'liters', 'ml', 'pieces', 'packets', 'dozen'];

const emptyItem = {
    name: '',
    unit: 'kg',
    currentStock: '',
    costPerUnit: '',
    reorderLevel: '',
    category: 'other'
};

const InlinePurchaseForm = ({ item, onSubmit, onCancel, onError }) => {
    const [qty, setQty] = useState('');
    const [cost, setCost] = useState(item.costPerUnit || '');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!qty || Number(qty) <= 0) {
            onError('Enter a valid quantity');
            return;
        }
        setSubmitting(true);
        try {
            await onSubmit(item, qty, cost);
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={styles['purchase-inline'] || 'purchase-inline'}>
            <input type="number" placeholder="Qty" value={qty} onChange={e => setQty(e.target.value)} min="0" step="0.1" disabled={submitting} />
            <input type="number" placeholder="₹/unit" value={cost} onChange={e => setCost(e.target.value)} min="0" step="0.01" disabled={submitting} />
            <button className={`${styles['btn-success'] || 'btn-success'} ${styles['btn-sm'] || 'btn-sm'}`} onClick={handleSubmit} disabled={submitting}>{submitting ? '...' : '✓'}</button>
            <button className={`${styles['btn-secondary'] || 'btn-secondary'} ${styles['btn-sm'] || 'btn-sm'}`} onClick={onCancel} disabled={submitting}>✕</button>
        </div>
    );
};

const InlineWasteForm = ({ item, onSubmit, onCancel, onError }) => {
    const [qty, setQty] = useState('');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!qty || Number(qty) <= 0) {
            onError('Enter a valid quantity');
            return;
        }
        if (Number(qty) > item.currentStock) {
            onError('Cannot waste more quantity than is in stock');
            return;
        }
        setSubmitting(true);
        try {
            await onSubmit(item, qty, reason);
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={styles['purchase-inline'] || 'purchase-inline'}>
            <input type="number" placeholder="Qty" value={qty} onChange={e => setQty(e.target.value)} min="0" max={item.currentStock} step="0.1" title="Waste Quantity" disabled={submitting} />
            <input type="text" placeholder="Reason" value={reason} onChange={e => setReason(e.target.value)} title="Reason for wasting" disabled={submitting} />
            <button className={`${styles['btn-success'] || 'btn-success'} ${styles['btn-sm'] || 'btn-sm'}`} onClick={handleSubmit} disabled={submitting}>{submitting ? '...' : '✓'}</button>
            <button className={`${styles['btn-secondary'] || 'btn-secondary'} ${styles['btn-sm'] || 'btn-sm'}`} onClick={onCancel} disabled={submitting}>✕</button>
        </div>
    );
};

const InventoryDashboard = () => {
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [formData, setFormData] = useState(emptyItem);
    const [formLoading, setFormLoading] = useState(false);

    // Action tracking state
    const [purchasingItemId, setPurchasingItemId] = useState(null);
    const [wastingItemId, setWastingItemId] = useState(null);

    // Subscribe to real-time inventory
    useEffect(() => {
        const unsubscribe = subscribeToInventory((items) => {
            setInventory(items);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Filtered inventory
    const filteredInventory = useMemo(() => {
        return inventory.filter(item => {
            const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
            return matchesSearch && matchesCategory;
        });
    }, [inventory, searchTerm, categoryFilter]);

    // Low stock items
    const lowStockItems = useMemo(() => {
        return inventory.filter(item => item.currentStock <= item.reorderLevel && item.reorderLevel > 0);
    }, [inventory]);

    // Form handlers
    const openAddModal = () => {
        setEditingItem(null);
        setFormData(emptyItem);
        setShowModal(true);
    };

    const openEditModal = (item) => {
        setEditingItem(item);
        setFormData({
            name: item.name,
            unit: item.unit,
            currentStock: item.currentStock,
            costPerUnit: item.costPerUnit,
            reorderLevel: item.reorderLevel,
            category: item.category
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingItem(null);
        setFormData(emptyItem);
    };

    const handleFormChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setError('Item name is required');
            return;
        }
        setFormLoading(true);
        try {
            if (editingItem) {
                await updateInventoryItem(editingItem.id, {
                    name: formData.name.trim(),
                    unit: formData.unit,
                    currentStock: Number(formData.currentStock) || 0,
                    costPerUnit: Number(formData.costPerUnit) || 0,
                    reorderLevel: Number(formData.reorderLevel) || 0,
                    category: formData.category
                });
                setSuccess(`"${formData.name}" updated successfully`);
            } else {
                await addInventoryItem(formData);
                setSuccess(`"${formData.name}" added to inventory`);
            }
            closeModal();
        } catch (err) {
            setError(err.message);
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async (item) => {
        if (!window.confirm(`Delete "${item.name}" from inventory?`)) return;
        try {
            await deleteInventoryItem(item.id);
            setSuccess(`"${item.name}" deleted`);
        } catch (err) {
            setError(err.message);
        }
    };

    // Purchase handlers
    const startPurchase = (item) => {
        cancelWaste(); // close waste form if open
        setPurchasingItemId(item.id);
    };

    const cancelPurchase = () => {
        setPurchasingItemId(null);
    };

    const submitPurchase = async (item, qty, cost) => {
        try {
            await addPurchaseRecord({
                inventoryItemId: item.id,
                itemName: item.name,
                quantity: qty,
                unitCost: cost
            });
            setSuccess(`Added ${qty} ${item.unit} of "${item.name}" to stock`);
            cancelPurchase();
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    // Waste handlers
    const startWaste = (item) => {
        cancelPurchase(); // close purchase form if open
        setWastingItemId(item.id);
    };

    const cancelWaste = () => {
        setWastingItemId(null);
    };

    const submitWaste = async (item, qty, reason) => {
        try {
            await addWasteEntry({
                inventoryItemId: item.id,
                itemName: item.name,
                quantity: qty,
                reason: reason || 'Not specified',
                unitCost: item.costPerUnit || 0
            });
            setSuccess(`Logged ${qty} ${item.unit} of "${item.name}" as waste`);
            cancelWaste();
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const getStockStatus = (item) => {
        if (item.currentStock <= 0) return 'out';
        if (item.reorderLevel > 0 && item.currentStock <= item.reorderLevel) return 'low';
        return 'ok';
    };

    const getStockLabel = (status) => {
        if (status === 'out') return '⛔ Out';
        if (status === 'low') return '⚠️ Low';
        return '✅ OK';
    };

    if (loading) {
        return (
            <div className={styles['inventory-page'] || 'inventory-page'}>
                <NavigationBar currentPage="inventory" />
                <div className={styles['inventory-content'] || 'inventory-content'}>
                    <div className={styles['loading'] || 'loading'}>Loading inventory...</div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles['inventory-page'] || 'inventory-page'}>
            <NavigationBar currentPage="inventory" />
            <div className={styles['inventory-content'] || 'inventory-content'}>
                {error && <ErrorBanner message={error} onClose={() => setError('')} />}
                {success && <SuccessBanner message={success} onClose={() => setSuccess('')} autoDismiss={3000} />}

                <div className={styles['inventory-header'] || 'inventory-header'}>
                    <h1>📦 Inventory Management</h1>
                    <div className={styles['header-actions'] || 'header-actions'}>
                        <button className={styles['btn-primary'] || 'btn-primary'} onClick={openAddModal}>+ Add Item</button>
                    </div>
                </div>

                {/* Low Stock Alert */}
                {lowStockItems.length > 0 && (
                    <div className={styles['low-stock-banner'] || 'low-stock-banner'}>
                        <span className={styles['alert-icon'] || 'alert-icon'}>⚠️</span>
                        <span className={styles['alert-text'] || 'alert-text'}>
                            {lowStockItems.length} item{lowStockItems.length > 1 ? 's' : ''} low on stock: {lowStockItems.map(i => i.name).join(', ')}
                        </span>
                    </div>
                )}

                {/* Search & Filter */}
                <div className={styles['filter-bar'] || 'filter-bar'}>
                    <input
                        className={styles['search-input'] || 'search-input'}
                        type="text"
                        placeholder="Search items..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <select
                        className={styles['filter-select'] || 'filter-select'}
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                        <option value="all">All Categories</option>
                        {CATEGORIES.map(cat => (
                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                    </select>
                </div>

                {/* Inventory Table */}
                {filteredInventory.length === 0 ? (
                    <div className={styles['empty-state'] || 'empty-state'}>
                        <p>{inventory.length === 0 ? 'No inventory items yet.' : 'No items match your filter.'}</p>
                        {inventory.length === 0 && (
                            <button className={styles['btn-primary'] || 'btn-primary'} onClick={openAddModal}>Add your first item</button>
                        )}
                    </div>
                ) : (
                    <div className={styles['data-table-container'] || 'data-table-container'}>
                        <table className={styles['data-table'] || 'data-table'}>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Category</th>
                                    <th>Stock</th>
                                    <th>Unit</th>
                                    <th>Cost/Unit (₹)</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredInventory.map(item => {
                                    const status = getStockStatus(item);
                                    return (
                                        <tr key={item.id} className={status !== 'ok' ? 'low-stock' : ''}>
                                            <td><strong>{item.name}</strong></td>
                                            <td><span className={styles['category-badge'] || 'category-badge'}>{item.category}</span></td>
                                            <td>{item.currentStock}</td>
                                            <td>{item.unit}</td>
                                            <td>₹{(item.costPerUnit || 0).toFixed(2)}</td>
                                            <td><span className={`stock-badge ${status}`}>{getStockLabel(status)}</span></td>
                                            <td>
                                                {purchasingItemId === item.id ? (
                                                    <InlinePurchaseForm item={item} onSubmit={submitPurchase} onCancel={cancelPurchase} onError={setError} />
                                                ) : wastingItemId === item.id ? (
                                                    <InlineWasteForm item={item} onSubmit={submitWaste} onCancel={cancelWaste} onError={setError} />
                                                ) : (
                                                    <div className={styles['actions-cell'] || 'actions-cell'}>
                                                        <button className={`${styles['btn-success'] || 'btn-success'} ${styles['btn-sm'] || 'btn-sm'}`} onClick={() => startPurchase(item)} title="Add Stock">+Stock</button>
                                                        <button className={`${styles['btn-danger'] || 'btn-danger'} ${styles['btn-sm'] || 'btn-sm'}`} onClick={() => startWaste(item)} title="Log Waste">Waste</button>
                                                        <button className={`${styles['btn-secondary'] || 'btn-secondary'} ${styles['btn-sm'] || 'btn-sm'}`} onClick={() => openEditModal(item)} title="Edit">Edit</button>
                                                        <button className={`${styles['btn-danger'] || 'btn-danger'} ${styles['btn-sm'] || 'btn-sm'}`} onClick={() => handleDelete(item)} title="Delete">Del</button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Add/Edit Modal */}
                {showModal && (
                    <div className={styles['modal-overlay'] || 'modal-overlay'} onClick={closeModal}>
                        <div className={styles['modal-content'] || 'modal-content'} onClick={(e) => e.stopPropagation()}>
                            <h2>{editingItem ? 'Edit Item' : 'Add Inventory Item'}</h2>
                            <form onSubmit={handleSubmit}>
                                <div className={styles['form-group'] || 'form-group'}>
                                    <label>Item Name *</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => handleFormChange('name', e.target.value)}
                                        placeholder="e.g. Goat Shanks"
                                        required
                                        autoFocus
                                    />
                                </div>
                                <div className={styles['form-row'] || 'form-row'}>
                                    <div className={styles['form-group'] || 'form-group'}>
                                        <label>Category</label>
                                        <select
                                            value={formData.category}
                                            onChange={(e) => handleFormChange('category', e.target.value)}
                                        >
                                            {CATEGORIES.map(cat => (
                                                <option key={cat.value} value={cat.value}>{cat.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className={styles['form-group'] || 'form-group'}>
                                        <label>Unit</label>
                                        <select
                                            value={formData.unit}
                                            onChange={(e) => handleFormChange('unit', e.target.value)}
                                        >
                                            {UNITS.map(u => (
                                                <option key={u} value={u}>{u}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className={styles['form-row'] || 'form-row'}>
                                    <div className={styles['form-group'] || 'form-group'}>
                                        <label>Current Stock</label>
                                        <input
                                            type="number"
                                            value={formData.currentStock}
                                            onChange={(e) => handleFormChange('currentStock', e.target.value)}
                                            placeholder="0"
                                            min="0"
                                            step="0.1"
                                        />
                                    </div>
                                    <div className={styles['form-group'] || 'form-group'}>
                                        <label>Cost per Unit (₹)</label>
                                        <input
                                            type="number"
                                            value={formData.costPerUnit}
                                            onChange={(e) => handleFormChange('costPerUnit', e.target.value)}
                                            placeholder="0.00"
                                            min="0"
                                            step="0.01"
                                        />
                                    </div>
                                </div>
                                <div className={styles['form-group'] || 'form-group'}>
                                    <label>Reorder Level (alert when stock drops below)</label>
                                    <input
                                        type="number"
                                        value={formData.reorderLevel}
                                        onChange={(e) => handleFormChange('reorderLevel', e.target.value)}
                                        placeholder="0"
                                        min="0"
                                        step="0.1"
                                    />
                                </div>
                                <div className={styles['form-actions'] || 'form-actions'}>
                                    <button type="button" className={styles['btn-secondary'] || 'btn-secondary'} onClick={closeModal} disabled={formLoading}>
                                        Cancel
                                    </button>
                                    <button type="submit" className={styles['btn-primary'] || 'btn-primary'} disabled={formLoading}>
                                        {formLoading ? 'Saving...' : (editingItem ? 'Update Item' : 'Add Item')}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InventoryDashboard;
