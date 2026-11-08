import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import styles from '../SettingsPage.module.css';
import { useDrag, useDrop } from 'react-dnd';
import {
    subscribeToMenuItems,
    addMenuItem as addMenuItemFirebase,
    updateMenuItem as updateMenuItemFirebase,
    deleteMenuItem as deleteMenuItemFirebase,
    bulkUpdateMenuItems,
    toggleMenuItemAvailability,
    retryWithBackoff,
    subscribeToCategories,
    addCategory as addCategoryFirebase,
    updateCategory as updateCategoryFirebase,
    deleteCategory as deleteCategoryFirebase,
    DEFAULT_MENU_CATEGORIES
} from '../../services/firebaseService';
import { serverTimestamp } from 'firebase/firestore';
import {
    Plus,
    Pencil,
    Trash2,
    Check,
    X,
    Tags,
    Utensils,
    IndianRupee,
    Layers,
    Sparkles,
    Eye,
    FolderKanban
} from 'lucide-react';
import CategoryIcon, { CURATED_CATEGORY_ICONS } from '../Common/CategoryIcon';

const ITEM_TYPE = 'MENU_ITEM';

const MenuManagement = () => {
    const [menuItems, setMenuItems] = useState([]);
    const [editingItem, setEditingItem] = useState(null);
    const isDraggingRef = useRef(false);
    const menuItemsRef = useRef(menuItems);

    // Dynamic Categories State
    const [categories, setCategories] = useState([]);
    const [activeCategoryFilter, setActiveCategoryFilter] = useState('ALL');

    // Category Modal (Create / Edit Category)
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [categoryFormData, setCategoryFormData] = useState({ id: null, name: '', icon: 'soup' });
    const [categoryError, setCategoryError] = useState('');
    const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);

    // Dedicated Add Dish Form State
    const [dishName, setDishName] = useState('');
    const [dishPrice, setDishPrice] = useState('');
    const [dishCategory, setDishCategory] = useState('');
    const [dishAvailable, setDishAvailable] = useState(true);
    const [dishFormError, setDishFormError] = useState('');
    const [isSubmittingDish, setIsSubmittingDish] = useState(false);

    // Inline New Category trigger from dish form
    const [inlineNewCategory, setInlineNewCategory] = useState(false);
    const [inlineCategoryName, setInlineCategoryName] = useState('');

    useEffect(() => {
        menuItemsRef.current = menuItems;
    }, [menuItems]);

    // Real-time Subscription to Menu Items
    useEffect(() => {
        let unsubscribeMenuItems = () => {};
        try {
            unsubscribeMenuItems = subscribeToMenuItems((updatedMenuItems) => {
                try {
                    if (!isDraggingRef.current) {
                        const sortedItems = (updatedMenuItems || []).sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
                        setMenuItems(sortedItems);
                    }
                } catch (error) {
                    console.error('Error processing menu items update:', error);
                }
            });
        } catch (e) {
            console.error('Error in subscribeToMenuItems effect:', e);
        }

        return () => {
            try {
                if (typeof unsubscribeMenuItems === 'function') {
                    unsubscribeMenuItems();
                }
            } catch (err) {
                console.warn('Error unsubscribing menu items:', err);
            }
        };
    }, []);

    // Real-time Subscription to Categories
    useEffect(() => {
        let unsubscribeCategories = () => {};
        try {
            unsubscribeCategories = subscribeToCategories((updatedCategories) => {
                setCategories(updatedCategories || DEFAULT_MENU_CATEGORIES);
            });
        } catch (e) {
            console.error('Error in subscribeToCategories effect:', e);
        }

        return () => {
            try {
                if (typeof unsubscribeCategories === 'function') {
                    unsubscribeCategories();
                }
            } catch (err) {
                console.warn('Error unsubscribing categories:', err);
            }
        };
    }, []);

    // Helper to get item category safely
    const getItemCategory = useCallback((item) => {
        if (!item) return 'Main Course';
        if (item.category && item.category.trim() !== '') {
            return item.category.trim();
        }
        const name = (item.name || '').toLowerCase();
        if (name.includes('nalli') || name.includes('nihari')) return 'Nalli Nihari';
        if (name.includes('roti') || name.includes('naan') || name.includes('kulcha') || name.includes('paratha')) return 'Roti';
        if (name.includes('biryani') || name.includes('rice') || name.includes('pulao')) return 'Biryani & Rice';
        if (name.includes('beverage') || name.includes('chai') || name.includes('tea') || name.includes('coke') || name.includes('drink')) return 'Beverages';
        if (name.includes('kabab') || name.includes('kebab') || name.includes('tikka') || name.includes('starter')) return 'Starters';
        if (name.includes('dessert') || name.includes('kheer') || name.includes('halwa')) return 'Dessert';
        return 'Main Course';
    }, []);

    // Counts of items per category
    const categoryCounts = useMemo(() => {
        const map = {};
        menuItems.forEach((item) => {
            const cat = getItemCategory(item);
            map[cat] = (map[cat] || 0) + 1;
        });
        return map;
    }, [menuItems, getItemCategory]);

    // All available category names
    const allCategoryNames = useMemo(() => {
        const list = [];
        const seen = new Set();
        categories.forEach(c => {
            if (c && c.name && !seen.has(c.name)) {
                seen.add(c.name);
                list.push(c.name);
            }
        });
        menuItems.forEach(it => {
            const cat = getItemCategory(it);
            if (cat && !seen.has(cat)) {
                seen.add(cat);
                list.push(cat);
            }
        });
        return list;
    }, [categories, menuItems, getItemCategory]);

    // Sync default category for Add Dish form
    useEffect(() => {
        if (activeCategoryFilter !== 'ALL') {
            setDishCategory(activeCategoryFilter);
        } else if (!dishCategory && categories.length > 0) {
            setDishCategory(categories[0].name);
        }
    }, [activeCategoryFilter, categories, dishCategory]);

    // Drag & Drop reordering
    const moveMenuItem = useCallback((dragIndex, hoverIndex) => {
        setMenuItems((prev) => {
            if (dragIndex === hoverIndex) return prev;
            const updated = [...prev];
            const [dragged] = updated.splice(dragIndex, 1);
            updated.splice(hoverIndex, 0, dragged);
            return updated;
        });
    }, []);

    const commitMenuItemOrder = useCallback(async () => {
        isDraggingRef.current = false;
        const currentItems = menuItemsRef.current;
        if (!currentItems || currentItems.length === 0) return;

        const updatedItems = currentItems.map((item, index) => ({
            ...item,
            sequence: index + 1
        }));

        try {
            await retryWithBackoff(() => bulkUpdateMenuItems(updatedItems));
        } catch (error) {
            console.error('Error updating menu item positions:', error);
        }
    }, []);

    // ----------------------------------------------------
    // Category Management Handlers
    // ----------------------------------------------------
    const handleOpenCategoryModal = (category = null) => {
        if (category) {
            setCategoryFormData({ id: category.id, name: category.name, icon: category.icon || 'soup' });
        } else {
            setCategoryFormData({ id: null, name: '', icon: 'soup' });
        }
        setCategoryError('');
        setIsCategoryModalOpen(true);
    };

    const handleCloseCategoryModal = () => {
        setIsCategoryModalOpen(false);
        setCategoryFormData({ id: null, name: '', icon: 'soup' });
        setCategoryError('');
    };

    const handleSaveCategory = async (e) => {
        e.preventDefault();
        const trimmedName = categoryFormData.name.trim();
        if (!trimmedName) {
            setCategoryError('Please enter a category name');
            return;
        }

        setIsCategorySubmitting(true);
        setCategoryError('');
        try {
            if (categoryFormData.id) {
                // Update existing category
                await updateCategoryFirebase(categoryFormData.id, {
                    name: trimmedName,
                    icon: categoryFormData.icon || '🍽️'
                });
            } else {
                // Add new category
                await addCategoryFirebase({
                    name: trimmedName,
                    icon: categoryFormData.icon || '🍽️',
                    sequence: categories.length + 1
                });
            }
            handleCloseCategoryModal();
        } catch (err) {
            console.error('Error saving category:', err);
            setCategoryError(err.message || 'Failed to save category');
        } finally {
            setIsCategorySubmitting(false);
        }
    };

    const handleDeleteCategory = async (cat) => {
        if (categories.length <= 1) {
            alert('At least one category must exist.');
            return;
        }

        const count = categoryCounts[cat.name] || 0;
        const confirmMsg = count > 0
            ? `Category "${cat.name}" has ${count} items. Deleting it will reassign these items to "Main Course". Are you sure?`
            : `Are you sure you want to delete category "${cat.name}"?`;

        if (!window.confirm(confirmMsg)) return;

        try {
            await deleteCategoryFirebase(cat.id);

            // Reassign items that belonged to this category
            if (count > 0) {
                const itemsToUpdate = menuItems
                    .filter(it => getItemCategory(it) === cat.name)
                    .map(it => ({ ...it, category: 'Main Course' }));
                if (itemsToUpdate.length > 0) {
                    await bulkUpdateMenuItems(itemsToUpdate);
                }
            }

            if (activeCategoryFilter === cat.name) {
                setActiveCategoryFilter('ALL');
            }
        } catch (err) {
            console.error('Error deleting category:', err);
            alert('Failed to delete category: ' + err.message);
        }
    };

    // Quick change category from item row
    const handleQuickCategoryChange = async (itemId, newCategory) => {
        if (!itemId || !newCategory) return;
        try {
            await updateMenuItemFirebase(itemId, { category: newCategory });
        } catch (err) {
            console.error('Failed to change item category:', err);
            alert('Failed to change item category: ' + err.message);
        }
    };

    // ----------------------------------------------------
    // Modern Add Dish Submit Handler
    // ----------------------------------------------------
    const handleAddDishSubmit = async (e) => {
        e.preventDefault();
        const trimmedName = dishName.trim();
        const parsedPrice = parseFloat(dishPrice);

        if (!trimmedName) {
            setDishFormError('Please enter a dish name');
            return;
        }
        if (isNaN(parsedPrice) || parsedPrice <= 0) {
            setDishFormError('Please enter a valid price in ₹');
            return;
        }

        let finalCategory = dishCategory;
        if (inlineNewCategory && inlineCategoryName.trim()) {
            finalCategory = inlineCategoryName.trim();
            try {
                await addCategoryFirebase({
                    name: finalCategory,
                    icon: '🍲',
                    sequence: categories.length + 1
                });
            } catch (catErr) {
                console.warn('Could not auto-add category:', catErr);
            }
        }

        if (!finalCategory) {
            finalCategory = categories[0]?.name || 'Main Course';
        }

        setIsSubmittingDish(true);
        setDishFormError('');

        try {
            const menuItemData = {
                name: trimmedName,
                price: parsedPrice,
                available: dishAvailable,
                category: finalCategory,
                sequence: menuItems.length + 1,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            await addMenuItemFirebase(menuItemData);

            // Reset form fields
            setDishName('');
            setDishPrice('');
            setInlineNewCategory(false);
            setInlineCategoryName('');
            setDishAvailable(true);
        } catch (err) {
            console.error('Failed to add dish:', err);
            setDishFormError(err.message || 'Failed to add dish');
        } finally {
            setIsSubmittingDish(false);
        }
    };

    // ----------------------------------------------------
    // Modern Edit Dish Submit Handler
    // ----------------------------------------------------
    const handleEditDishSubmit = async (e) => {
        e.preventDefault();
        if (!editingItem) return;

        const trimmedName = (editingItem.name || '').trim();
        const parsedPrice = parseFloat(editingItem.price);

        if (!trimmedName) {
            alert('Dish name cannot be empty');
            return;
        }
        if (isNaN(parsedPrice) || parsedPrice <= 0) {
            alert('Please enter a valid price');
            return;
        }

        try {
            await updateMenuItemFirebase(editingItem.id, {
                name: trimmedName,
                price: parsedPrice,
                category: editingItem.category || 'Main Course',
                available: Boolean(editingItem.available),
                updatedAt: serverTimestamp()
            });
            setEditingItem(null);
        } catch (err) {
            console.error('Failed to update dish:', err);
            alert('Failed to update dish: ' + err.message);
        }
    };

    const handleDeleteMenuItem = async (itemId) => {
        if (window.confirm('Are you sure you want to delete this menu item?')) {
            try {
                await deleteMenuItemFirebase(itemId);
            } catch (err) {
                console.error('Failed to delete item:', err);
            }
        }
    };

    const handleToggleAvailability = async (itemId, currentAvailability) => {
        try {
            await toggleMenuItemAvailability(itemId, currentAvailability);
        } catch (err) {
            console.error('Failed to toggle availability:', err);
        }
    };

    // Filter items to display based on activeCategoryFilter
    const displayedMenuItems = useMemo(() => {
        if (activeCategoryFilter === 'ALL') return menuItems;
        return menuItems.filter(it => getItemCategory(it) === activeCategoryFilter);
    }, [menuItems, activeCategoryFilter, getItemCategory]);

    // ----------------------------------------------------
    // Draggable Item Component
    // ----------------------------------------------------
    const DraggableMenuItem = ({ item, index }) => {
        const ref = useRef(null);

        const [{ isDragging }, drag] = useDrag({
            type: ITEM_TYPE,
            item: () => {
                isDraggingRef.current = true;
                return { id: item.id, index };
            },
            end: () => {
                commitMenuItemOrder();
            },
            collect: (monitor) => ({
                isDragging: monitor.isDragging(),
            }),
        });

        const [, drop] = useDrop({
            accept: ITEM_TYPE,
            hover: (draggedItem) => {
                if (!ref.current) return;
                if (draggedItem.index !== index) {
                    moveMenuItem(draggedItem.index, index);
                    draggedItem.index = index;
                }
            },
        });

        // Touch Drag for Tablets & Mobile POS
        const touchState = useRef({ active: false, startY: 0, startX: 0 });
        const handleTouchStart = (e) => {
            if (e.target.closest(`.${styles['item-actions'] || 'item-actions'}`) || e.target.closest('select')) return;
            const touch = e.touches[0];
            touchState.current = { active: true, startX: touch.clientX, startY: touch.clientY, currentIndex: index };
            isDraggingRef.current = true;
        };

        const handleTouchMove = (e) => {
            if (!touchState.current.active) return;
            const touch = e.touches[0];
            if (Math.abs(touch.clientY - touchState.current.startY) > 8) {
                if (e.cancelable) e.preventDefault();
            }
            const elem = document.elementFromPoint(touch.clientX, touch.clientY);
            const card = elem?.closest('[data-settings-menu-index]');
            if (card) {
                const targetIndex = Number(card.getAttribute('data-settings-menu-index'));
                if (!isNaN(targetIndex) && targetIndex !== touchState.current.currentIndex) {
                    moveMenuItem(touchState.current.currentIndex, targetIndex);
                    touchState.current.currentIndex = targetIndex;
                }
            }
        };

        const handleTouchEnd = () => {
            if (touchState.current.active) {
                touchState.current.active = false;
                commitMenuItemOrder();
            }
        };

        drag(drop(ref));

        const currentCat = getItemCategory(item);

        return (
            <div
                ref={ref}
                data-settings-menu-index={index}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className={`${styles['menu-item'] || 'menu-item'} ${isDragging ? (styles.dragging || 'dragging') : ''} ${!item.available ? (styles.unavailable || 'unavailable') : ''}`}
                style={{ opacity: isDragging ? 0.4 : 1, cursor: 'grab' }}
            >
                <div className={styles['item-handle'] || 'item-handle'} title="Hold & drag to reorder">⋮⋮</div>
                <div className={styles['item-details'] || 'item-details'}>
                    <div className={styles['item-name'] || 'item-name'}>{item.name}</div>

                    {/* Quick Category Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Category:</span>
                        <select
                            className="item-category-select"
                            value={currentCat}
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                            onChange={(e) => handleQuickCategoryChange(item.id, e.target.value)}
                            title="Quickly change item category"
                        >
                            {allCategoryNames.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles['item-price'] || 'item-price'} style={{ marginTop: '0.25rem' }}>
                        ₹{item.price}
                    </div>
                </div>
                <div
                    className={styles['item-actions'] || 'item-actions'}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                >
                    <button
                        className={`${styles['availability-toggle'] || 'availability-toggle'} ${item.available ? (styles.available || 'available') : (styles.unavailable || 'unavailable')}`}
                        onClick={() => handleToggleAvailability(item.id, item.available)}
                        title="Toggle In-stock / Out-of-stock"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                        {item.available ? <><Check size={14} /> In Stock</> : <><X size={14} /> Out of Stock</>}
                    </button>
                    <button
                        className={styles['edit-btn'] || 'edit-btn'}
                        onClick={() => setEditingItem({ ...item, category: currentCat })}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                        <Pencil size={13} /> Edit
                    </button>
                    <button
                        className={styles['delete-btn'] || 'delete-btn'}
                        onClick={() => handleDeleteMenuItem(item.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                        <Trash2 size={13} /> Delete
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className={styles['settings-section'] || 'settings-section'}>

            {/* ========================================================
                1. MODERN MENU CATEGORIES CARD
                ======================================================== */}
            <div className="modern-category-card">
                <div className="modern-card-header">
                    <div className="modern-card-header-left">
                        <div className="modern-header-icon"><Tags size={22} strokeWidth={2.2} /></div>
                        <div>
                            <h3 className="modern-card-title">Menu Categories & Folders</h3>
                            <p className="modern-card-subtitle">
                                Manage categories (Nalli Nihari, Roti, Biryani, etc.) to group dishes in POS screen
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="btn-add-dish"
                        onClick={() => handleOpenCategoryModal(null)}
                        style={{ padding: '0.55rem 1.15rem', fontSize: '0.92rem' }}
                    >
                        + Add New Category
                    </button>
                </div>

                {/* Grid of Category Cards */}
                <div className="modern-categories-grid">
                    {categories.map((cat) => {
                        const count = categoryCounts[cat.name] || 0;
                        const isFiltered = activeCategoryFilter === cat.name;

                        return (
                            <div
                                key={cat.id}
                                className={`modern-category-pill ${isFiltered ? 'active-pill' : ''}`}
                                onClick={() => setActiveCategoryFilter(isFiltered ? 'ALL' : cat.name)}
                                title={`Click to filter items by ${cat.name}`}
                            >
                                <div className="pill-left">
                                    <CategoryIcon name={cat.icon || cat.name} size={18} showBadge badgeSize={38} />
                                    <div className="pill-text">
                                        <span className="pill-name">{cat.name}</span>
                                        <span className="pill-count">{count} {count === 1 ? 'item' : 'items'}</span>
                                    </div>
                                </div>
                                <div className="pill-actions" onClick={(e) => e.stopPropagation()}>
                                    <button
                                        type="button"
                                        className="pill-btn"
                                        onClick={() => handleOpenCategoryModal(cat)}
                                        title="Rename category or change icon"
                                    >
                                        <Pencil size={13} />
                                    </button>
                                    <button
                                        type="button"
                                        className="pill-btn delete"
                                        onClick={() => handleDeleteCategory(cat)}
                                        title="Delete Category"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ========================================================
                CATEGORY MODAL (CREATE / EDIT CATEGORY)
                ======================================================== */}
            {isCategoryModalOpen && (
                <div className="category-modal-overlay" onClick={handleCloseCategoryModal}>
                    <div className="category-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                <div className="modern-modal-icon">
                                    {categoryFormData.id ? <Pencil size={18} /> : <Plus size={18} />}
                                </div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 700 }}>
                                    {categoryFormData.id ? 'Edit Category' : 'Create New Category'}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={handleCloseCategoryModal}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', padding: '4px' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {categoryError && (
                            <div style={{ padding: '0.6rem 0.8rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '0.88rem', marginBottom: '1rem' }}>
                                {categoryError}
                            </div>
                        )}

                        <form onSubmit={handleSaveCategory}>
                            <div className="input-block" style={{ marginBottom: '1rem' }}>
                                <label className="input-label">Category Name *</label>
                                <div className="input-wrapper">
                                    <span className="input-icon-prefix"><Tags size={18} style={{ color: "#64748b" }} /></span>
                                    <input
                                        type="text"
                                        className="modern-text-input"
                                        placeholder="e.g. Nalli Nihari, Breads, Sweets..."
                                        value={categoryFormData.name}
                                        onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                                        autoFocus
                                        required
                                    />
                                </div>
                            </div>

                            <div className="input-block" style={{ marginBottom: '1.25rem' }}>
                                <label className="input-label">Select Category Icon</label>
                                <div className="modern-icon-palette">
                                    {CURATED_CATEGORY_ICONS.map((catIcon) => {
                                        const IconComp = catIcon.Icon;
                                        const isSelected = categoryFormData.icon === catIcon.id || categoryFormData.icon === catIcon.label;
                                        return (
                                            <button
                                                key={catIcon.id}
                                                type="button"
                                                className={`modern-icon-palette-btn ${isSelected ? 'selected' : ''}`}
                                                onClick={() => setCategoryFormData({ ...categoryFormData, icon: catIcon.id })}
                                                style={{
                                                    borderColor: isSelected ? catIcon.color : undefined,
                                                    background: isSelected ? catIcon.bg : '#ffffff'
                                                }}
                                            >
                                                <div
                                                    className="icon-palette-badge"
                                                    style={{ background: catIcon.bg, color: catIcon.color }}
                                                >
                                                    <IconComp size={20} strokeWidth={2.2} />
                                                </div>
                                                <span className="icon-palette-label">{catIcon.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="dish-preview-badge" style={{ marginBottom: '1.25rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                    <CategoryIcon name={categoryFormData.icon || 'general'} size={18} showBadge badgeSize={34} />
                                    <span>
                                        <strong>Preview:</strong> {categoryFormData.name.trim() || 'Category Name'}
                                    </span>
                                </div>
                            </div>

                            <div className="modern-form-actions" style={{ justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    className="secondary-btn"
                                    onClick={handleCloseCategoryModal}
                                    style={{ minHeight: '44px', padding: '0.6rem 1.2rem', borderRadius: '8px' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn-add-dish"
                                    disabled={isCategorySubmitting}
                                    style={{ minHeight: '44px', padding: '0.6rem 1.5rem', borderRadius: '8px' }}
                                >
                                    {isCategorySubmitting ? 'Saving...' : 'Save Category'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================
                2. MODERN ADD NEW MENU DISH FORM
                ======================================================== */}
            <div className="modern-dish-card">
                <div className="modern-card-header">
                    <div className="modern-card-header-left">
                        <div className="modern-header-icon" style={{ background: '#ecfdf5', color: '#059669' }}><Utensils size={22} strokeWidth={2.2} /></div>
                        <div>
                            <h3 className="modern-card-title">
                                {activeCategoryFilter !== 'ALL'
                                    ? `Add Dish to "${activeCategoryFilter}"`
                                    : 'Add New Menu Item'}
                            </h3>
                            <p className="modern-card-subtitle">
                                Enter dish name, price in ₹, and choose its category to immediately display on the POS terminal
                            </p>
                        </div>
                    </div>

                    {activeCategoryFilter !== 'ALL' && (
                        <div style={{ background: '#ecfdf5', color: '#065f46', padding: '0.35rem 0.75rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
                            Category Locked: {activeCategoryFilter}
                        </div>
                    )}
                </div>

                {dishFormError && (
                    <div style={{ padding: '0.65rem 0.9rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#dc2626', fontSize: '0.88rem', marginBottom: '1.25rem' }}>
                        {dishFormError}
                    </div>
                )}

                <form onSubmit={handleAddDishSubmit}>
                    <div className="dish-form-grid">

                        {/* 1. Dish Name Input */}
                        <div className="input-block">
                            <label className="input-label">
                                <span>Dish / Item Name *</span>
                            </label>
                            <div className="input-wrapper">
                                <span className="input-icon-prefix"><Utensils size={18} style={{ color: "#64748b" }} /></span>
                                <input
                                    type="text"
                                    className="modern-text-input"
                                    placeholder="e.g. Nalli Nihari Full, Khameeri Roti, Shahi Tukda"
                                    value={dishName}
                                    onChange={(e) => setDishName(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {/* 2. Price in ₹ Input */}
                        <div className="input-block">
                            <label className="input-label">
                                <span>Price (₹) *</span>
                            </label>
                            <div className="input-wrapper">
                                <span className="input-icon-prefix"><IndianRupee size={18} style={{ color: '#16a34a' }} /></span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    className="modern-text-input"
                                    placeholder="e.g. 250.00"
                                    value={dishPrice}
                                    onChange={(e) => setDishPrice(e.target.value)}
                                    required
                                    style={{ fontWeight: 600 }}
                                />
                            </div>
                        </div>

                        {/* 3. Category Selector */}
                        <div className="input-block">
                            <div className="input-label">
                                <span>Category / Menu Folder *</span>
                                {!inlineNewCategory && (
                                    <button
                                        type="button"
                                        onClick={() => setInlineNewCategory(true)}
                                        style={{ background: 'none', border: 'none', color: '#007bff', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 600 }}
                                    >
                                        + New Category
                                    </button>
                                )}
                            </div>

                            {!inlineNewCategory ? (
                                <div className="input-wrapper">
                                    <span className="input-icon-prefix"><Layers size={18} style={{ color: "#64748b" }} /></span>
                                    <select
                                        className="modern-select-input"
                                        value={dishCategory}
                                        onChange={(e) => {
                                            if (e.target.value === '__NEW__') {
                                                setInlineNewCategory(true);
                                            } else {
                                                setDishCategory(e.target.value);
                                            }
                                        }}
                                        required
                                    >
                                        {allCategoryNames.map(cat => (
                                            <option key={cat} value={cat}>
                                                {cat}
                                            </option>
                                        ))}
                                        <option value="__NEW__">+ Add New Category...</option>
                                    </select>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <input
                                        type="text"
                                        className="modern-text-input"
                                        placeholder="Type new category name..."
                                        value={inlineCategoryName}
                                        onChange={(e) => setInlineCategoryName(e.target.value)}
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        className="secondary-btn"
                                        onClick={() => {
                                            setInlineNewCategory(false);
                                            setInlineCategoryName('');
                                        }}
                                        style={{ minHeight: '46px', padding: '0.5rem 0.85rem' }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* 4. Availability Status Toggle */}
                        <div className="input-block">
                            <label className="input-label">
                                <span>⚡ Stock / Service Status</span>
                            </label>
                            <div
                                className={`availability-pill-toggle ${dishAvailable ? 'is-available' : 'is-unavailable'}`}
                                onClick={() => setDishAvailable(!dishAvailable)}
                                title="Click to toggle availability"
                            >
                                <div className="toggle-switch-indicator"></div>
                                <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                                    {dishAvailable ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Check size={16} /> In Stock (Available for Orders)</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><X size={16} /> Out of Stock (Disabled in POS)</span>}
                                </span>
                            </div>
                        </div>

                    </div>

                    {/* Live Preview Bar */}
                    <div className="dish-preview-badge">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <CategoryIcon name={dishCategory} size={16} showBadge badgeSize={32} />
                            <span>
                                <strong>Live Preview:</strong> {dishName.trim() ? dishName.trim() : 'Dish Name'}
                                {' — '}
                                <strong style={{ color: '#16a34a' }}>₹{dishPrice ? parseFloat(dishPrice).toFixed(2) : '0.00'}</strong>
                                {' | '}
                                <span style={{ color: '#64748b' }}>Category: {inlineNewCategory ? (inlineCategoryName || 'New Category') : dishCategory}</span>
                            </span>
                        </div>
                        <span style={{ fontSize: '0.8rem', color: dishAvailable ? '#059669' : '#dc2626', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            {dishAvailable ? <><Check size={14} /> Ready to serve</> : <><X size={14} /> Out of stock</>}
                        </span>
                    </div>

                    {/* Form Submit Action */}
                    <div className="modern-form-actions">
                        <button
                            type="submit"
                            className="btn-add-dish"
                            disabled={isSubmittingDish}
                        >
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Plus size={18} /> {isSubmittingDish ? 'Adding to Menu...' : 'Add Dish to Menu'}</span>
                        </button>
                    </div>
                </form>
            </div>

            {/* ========================================================
                3. EDIT MENU ITEM MODAL (When editing an item)
                ======================================================== */}
            {editingItem && (
                <div className="category-modal-overlay" onClick={() => setEditingItem(null)}>
                    <div className="category-modal-card" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a', fontWeight: 700 }}>
                                Edit Dish: {editingItem.name}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setEditingItem(null)}
                                style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: '#64748b' }}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleEditDishSubmit}>
                            <div className="input-block" style={{ marginBottom: '1rem' }}>
                                <label className="input-label">Dish Name *</label>
                                <div className="input-wrapper">
                                    <span className="input-icon-prefix"><Utensils size={18} style={{ color: "#64748b" }} /></span>
                                    <input
                                        type="text"
                                        className="modern-text-input"
                                        value={editingItem.name}
                                        onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="input-block" style={{ marginBottom: '1rem' }}>
                                <label className="input-label">Price in ₹ *</label>
                                <div className="input-wrapper">
                                    <span className="input-icon-prefix"><IndianRupee size={18} style={{ color: '#16a34a' }} /></span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0.01"
                                        className="modern-text-input"
                                        value={editingItem.price}
                                        onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value })}
                                        required
                                        style={{ fontWeight: 600 }}
                                    />
                                </div>
                            </div>

                            <div className="input-block" style={{ marginBottom: '1rem' }}>
                                <label className="input-label">Category *</label>
                                <div className="input-wrapper">
                                    <span className="input-icon-prefix"><Layers size={18} style={{ color: "#64748b" }} /></span>
                                    <select
                                        className="modern-select-input"
                                        value={editingItem.category || ''}
                                        onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                                    >
                                        {allCategoryNames.map(cat => {
                                            const catObj = categories.find(c => c.name === cat);
                                            const icon = catObj?.icon || '🍽️';
                                            return (
                                                <option key={cat} value={cat}>
                                                    {icon} {cat}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            </div>

                            <div className="input-block" style={{ marginBottom: '1.25rem' }}>
                                <label className="input-label">Stock Status</label>
                                <div
                                    className={`availability-pill-toggle ${editingItem.available ? 'is-available' : 'is-unavailable'}`}
                                    onClick={() => setEditingItem({ ...editingItem, available: !editingItem.available })}
                                >
                                    <div className="toggle-switch-indicator"></div>
                                    <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                                        {editingItem.available ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Check size={14} /> In Stock</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><X size={14} /> Out of Stock</span>}
                                    </span>
                                </div>
                            </div>

                            <div className="modern-form-actions" style={{ justifyContent: 'flex-end' }}>
                                <button
                                    type="button"
                                    className="secondary-btn"
                                    onClick={() => setEditingItem(null)}
                                    style={{ minHeight: '44px', padding: '0.6rem 1.2rem', borderRadius: '8px' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn-add-dish"
                                    style={{ minHeight: '44px', padding: '0.6rem 1.5rem', borderRadius: '8px' }}
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================
                4. MENU ITEMS LIST WITH CATEGORY FILTER TABS
                ======================================================== */}
            <div className={styles['menu-items-list'] || 'menu-items-list'}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                        Menu Dishes & Items ({displayedMenuItems.length})
                    </h3>
                    <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                        💡 Hold & drag (⋮⋮) to arrange dish order on POS screen
                    </span>
                </div>

                {/* Category Filter Pills Bar */}
                <div className="menu-category-filter-bar">
                    <button
                        type="button"
                        className={`menu-category-filter-chip ${activeCategoryFilter === 'ALL' ? 'active' : ''}`}
                        onClick={() => setActiveCategoryFilter('ALL')}
                    >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <CategoryIcon name="all" size={15} /> All
                        </span>
                        <span className="chip-badge">{menuItems.length}</span>
                    </button>

                    {allCategoryNames.map((catName) => {
                        const count = categoryCounts[catName] || 0;
                        const isSelected = activeCategoryFilter === catName;

                        return (
                            <button
                                key={catName}
                                type="button"
                                className={`menu-category-filter-chip ${isSelected ? 'active' : ''}`}
                                onClick={() => setActiveCategoryFilter(catName)}
                            >
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                    <CategoryIcon name={catName} size={15} /> {catName}
                                </span>
                                <span className="chip-badge">{count}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Banner when viewing a specific category */}
                {activeCategoryFilter !== 'ALL' && (
                    <div className="category-filter-banner">
                        <span>
                            Showing dishes in <strong>{activeCategoryFilter}</strong> ({displayedMenuItems.length} dishes)
                        </span>
                        <button
                            type="button"
                            onClick={() => setActiveCategoryFilter('ALL')}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#166534',
                                textDecoration: 'underline',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: 600
                            }}
                        >
                            View All Dishes
                        </button>
                    </div>
                )}

                {displayedMenuItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2.5rem 1.5rem', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #cbd5e1' }}>
                        <p style={{ margin: '0 0 0.5rem 0', color: '#64748b', fontSize: '1rem', fontWeight: 500 }}>
                            {activeCategoryFilter !== 'ALL'
                                ? `No dishes found in "${activeCategoryFilter}".`
                                : 'No dishes in the menu yet. Use the form above to add your first dish!'}
                        </p>
                        {activeCategoryFilter !== 'ALL' && (
                            <p style={{ fontSize: '0.88rem', color: '#007bff', margin: 0, fontWeight: 600 }}>
                                Tip: The form above is already set to "{activeCategoryFilter}" — enter a dish name and price to add it now!
                            </p>
                        )}
                    </div>
                ) : (
                    displayedMenuItems.map((item, index) => (
                        <DraggableMenuItem key={item.id} item={item} index={index} />
                    ))
                )}
            </div>
        </div>
    );
};

export default MenuManagement;
