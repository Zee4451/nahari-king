import React, { useState, useEffect, useCallback } from 'react';
import styles from '../SettingsPage.module.css';
import { useDrag, useDrop } from 'react-dnd';
import Form from '../Reusable/Form';
import { useApiOperation } from '../../hooks/useApiOperations';
import {
    subscribeToMenuItems,
    addMenuItem as addMenuItemFirebase,
    updateMenuItem as updateMenuItemFirebase,
    deleteMenuItem as deleteMenuItemFirebase,
    bulkUpdateMenuItems,
    toggleMenuItemAvailability,
    retryWithBackoff
} from '../../services/firebaseService';
import { serverTimestamp } from 'firebase/firestore';

const ITEM_TYPE = 'MENU_ITEM';

const MenuManagement = () => {
    const [menuItems, setMenuItems] = useState([]);
    const [editingItem, setEditingItem] = useState(null);

    const addMenuItemOperation = useApiOperation(addMenuItemFirebase, {
        successMessage: 'Menu item added successfully!',
        errorMessage: 'Failed to add menu item'
    });

    const updateMenuItemOperation = useApiOperation(updateMenuItemFirebase, {
        successMessage: 'Menu item updated successfully!',
        errorMessage: 'Failed to update menu item'
    });

    const deleteMenuItemOperation = useApiOperation(deleteMenuItemFirebase, {
        successMessage: 'Menu item deleted successfully!',
        errorMessage: 'Failed to delete menu item'
    });

    const toggleAvailabilityOperation = useApiOperation(toggleMenuItemAvailability, {
        successMessage: 'Item availability updated!',
        errorMessage: 'Failed to update availability'
    });

    useEffect(() => {
        const unsubscribeMenuItems = subscribeToMenuItems((updatedMenuItems) => {
            try {
                const sortedItems = updatedMenuItems.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
                setMenuItems(sortedItems);
            } catch (error) {
                console.error('Error processing menu items update:', error);
            }
        });

        return () => {
            unsubscribeMenuItems();
        };
    }, []);

    const moveMenuItem = useCallback(async (dragIndex, hoverIndex) => {
        const draggedItemLocal = menuItems[dragIndex];
        const newMenuItems = [...menuItems];
        newMenuItems.splice(dragIndex, 1);
        newMenuItems.splice(hoverIndex, 0, draggedItemLocal);

        const updatedItems = newMenuItems.map((item, index) => ({
            ...item,
            sequence: index + 1
        }));

        try {
            await retryWithBackoff(() => bulkUpdateMenuItems(updatedItems));
        } catch (error) {
            console.error('Error updating menu item positions:', error);
        }
    }, [menuItems]);

    const handleAddMenuItem = async (formData) => {
        const menuItemData = {
            name: formData.name,
            price: parseFloat(formData.price),
            available: formData.available,
            category: formData.category || 'Main Course',
            sequence: menuItems.length + 1,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        await addMenuItemOperation.execute(menuItemData);
    };

    const handleUpdateMenuItem = async (formData) => {
        const updateData = {
            name: formData.name.trim(),
            price: parseFloat(formData.price),
            available: Boolean(formData.available),
            category: formData.category || 'Main Course'
        };
        if (!editingItem.id) throw new Error('Invalid item ID');

        await updateMenuItemOperation.execute(editingItem.id, {
            ...updateData,
            updatedAt: serverTimestamp()
        });
        setEditingItem(null);
    };

    const handleDeleteMenuItem = async (itemId) => {
        if (window.confirm('Are you sure you want to delete this menu item?')) {
            await deleteMenuItemOperation.execute(itemId);
        }
    };

    const handleToggleAvailability = async (itemId, currentAvailability) => {
        await toggleAvailabilityOperation.execute(itemId, currentAvailability);
    };

    const DraggableMenuItem = ({ item, index }) => {
        const [{ isDragging }, drag] = useDrag({
            type: ITEM_TYPE,
            item: { id: item.id, index },
            collect: (monitor) => ({
                isDragging: monitor.isDragging(),
            }),
        });

        const [, drop] = useDrop({
            accept: ITEM_TYPE,
            hover: (draggedItem, monitor) => {
                if (!monitor.isOver({ shallow: true })) return;
                if (draggedItem.index !== index) {
                    moveMenuItem(draggedItem.index, index);
                    draggedItem.index = index;
                }
            },
        });

        return (
            <div
                ref={(node) => drag(drop(node))}
                className={`${styles['menu-item'] || 'menu-item'} ${isDragging ? (styles.dragging || 'dragging') : ''} ${!item.available ? (styles.unavailable || 'unavailable') : ''}`}
                style={{ opacity: isDragging ? 0.5 : 1 }}
            >
                <div className={styles['item-handle'] || 'item-handle'}>⋮⋮</div>
                <div className={styles['item-details'] || 'item-details'}>
                    <div className={styles['item-name'] || 'item-name'}>{item.name}</div>
                    <div className={styles['item-category'] || 'item-category'}>{item.category}</div>
                    <div className={styles['item-price'] || 'item-price'}>₹{item.price}</div>
                </div>
                <div className={styles['item-actions'] || 'item-actions'}>
                    <button
                        className={`${styles['availability-toggle'] || 'availability-toggle'} ${item.available ? (styles.available || 'available') : (styles.unavailable || 'unavailable')}`}
                        onClick={() => handleToggleAvailability(item.id, item.available)}
                        disabled={toggleAvailabilityOperation.loading}
                    >
                        {toggleAvailabilityOperation.loading ? '...' : (item.available ? '✓' : '✗')}
                    </button>
                    <button
                        className={styles['edit-btn'] || 'edit-btn'}
                        onClick={() => setEditingItem({ ...item })}
                    >
                        Edit
                    </button>
                    <button
                        className={styles['delete-btn'] || 'delete-btn'}
                        onClick={() => handleDeleteMenuItem(item.id)}
                        disabled={deleteMenuItemOperation.loading}
                    >
                        {deleteMenuItemOperation.loading ? 'Deleting...' : 'Delete'}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className={styles['settings-section'] || 'settings-section'}>
            <h2>Menu Management</h2>

            <div className={styles['add-item-form'] || 'add-item-form'}>
                <h3>Add New Menu Item</h3>
                <Form
                    initialValues={{ name: '', price: '', category: '', available: true }}
                    validationRules={{
                        name: { required: true },
                        price: { required: true, custom: (value) => (isNaN(value) || parseFloat(value) <= 0) ? 'Please enter a valid price' : '' }
                    }}
                    onSubmit={handleAddMenuItem}
                    submitText="Add Item"
                    loading={addMenuItemOperation.loading}
                    fields={[
                        { name: 'name', label: 'Item Name', type: 'text', required: true, placeholder: 'Enter item name' },
                        { name: 'price', label: 'Price', type: 'number', required: true, placeholder: 'Enter price', step: '0.01', min: '0.01' },
                        { name: 'category', label: 'Category', type: 'select', inputProps: { children: (<><option value="">Select Category</option><option value="Appetizer">Appetizer</option><option value="Main Course">Main Course</option><option value="Dessert">Dessert</option><option value="Beverage">Beverage</option></>) } },
                        { name: 'available', label: 'Available', type: 'checkbox' }
                    ]}
                />
            </div>

            {editingItem && (
                <div className={styles['edit-item-form'] || 'edit-item-form'}>
                    <h3>Edit Menu Item</h3>
                    <Form
                        initialValues={editingItem}
                        validationRules={{
                            name: { required: true },
                            price: { required: true, custom: (value) => (isNaN(value) || parseFloat(value) <= 0) ? 'Please enter a valid price' : '' }
                        }}
                        onSubmit={handleUpdateMenuItem}
                        onCancel={() => setEditingItem(null)}
                        submitText="Save Changes"
                        cancelText="Cancel"
                        loading={updateMenuItemOperation.loading}
                        fields={[
                            { name: 'name', label: 'Item Name', type: 'text', required: true, placeholder: 'Enter item name' },
                            { name: 'price', label: 'Price', type: 'number', required: true, placeholder: 'Enter price', step: '0.01', min: '0.01' },
                            { name: 'category', label: 'Category', type: 'select', inputProps: { children: (<><option value="Appetizer">Appetizer</option><option value="Main Course">Main Course</option><option value="Dessert">Dessert</option><option value="Beverage">Beverage</option></>) } },
                            { name: 'available', label: 'Available', type: 'checkbox' }
                        ]}
                    />
                </div>
            )}

            <div className={styles['menu-items-list'] || 'menu-items-list'}>
                <h3>Menu Items (Drag to reorder)</h3>
                {menuItems.length === 0 ? (
                    <p>No menu items found. Add some items above.</p>
                ) : (
                    menuItems.map((item, index) => (
                        <DraggableMenuItem key={item.id} item={item} index={index} />
                    ))
                )}
            </div>
        </div>
    );
};

export default MenuManagement;
