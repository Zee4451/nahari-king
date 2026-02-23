import { useState, useEffect, useCallback } from 'react';
import {
    subscribeToMenuItems,
    addMenuItem as firebaseAddMenuItem,
    updateMenuItem as firebaseUpdateMenuItem,
    deleteMenuItem as firebaseDeleteMenuItem,
    bulkUpdateMenuItems as firebaseBulkUpdateMenuItems,
    toggleMenuItemAvailability as firebaseToggleAvailability,
    retryWithBackoff
} from '../services/firebaseService';
import { serverTimestamp } from 'firebase/firestore';

export const useMenu = () => {
    const [menuItems, setMenuItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const unsubscribe = subscribeToMenuItems((updatedMenuItems) => {
            try {
                // Keep them sorted by sequence
                const sortedItems = updatedMenuItems.sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
                setMenuItems(sortedItems);
                setLoading(false);
            } catch (err) {
                console.error('Error processing menu items update:', err);
                setError('Failed to load menu items');
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const addMenuItem = useCallback(async (formData) => {
        try {
            const menuItemData = {
                name: formData.name,
                price: parseFloat(formData.price),
                available: formData.available,
                category: formData.category || 'Main Course',
                sequence: menuItems.length + 1,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            await firebaseAddMenuItem(menuItemData);
            setError('');
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, [menuItems.length]);

    const updateMenuItem = useCallback(async (id, formData) => {
        try {
            const updateData = {
                name: formData.name.trim(),
                price: parseFloat(formData.price),
                available: Boolean(formData.available),
                category: formData.category || 'Main Course',
                updatedAt: serverTimestamp()
            };
            await firebaseUpdateMenuItem(id, updateData);
            setError('');
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    const deleteMenuItem = useCallback(async (id) => {
        try {
            await firebaseDeleteMenuItem(id);
            setError('');
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    const toggleAvailability = useCallback(async (id, currentAvailability) => {
        try {
            await firebaseToggleAvailability(id, currentAvailability);
            setError('');
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    const reorderMenuItems = useCallback(async (dragIndex, hoverIndex) => {
        try {
            const draggedItemLocal = menuItems[dragIndex];
            const newMenuItems = [...menuItems];
            newMenuItems.splice(dragIndex, 1);
            newMenuItems.splice(hoverIndex, 0, draggedItemLocal);

            const updatedItems = newMenuItems.map((item, index) => ({
                ...item,
                sequence: index + 1
            }));

            // Optimistically update UI
            setMenuItems(updatedItems);

            await retryWithBackoff(() => firebaseBulkUpdateMenuItems(updatedItems));
            setError('');
        } catch (err) {
            console.error('Error updating menu item positions:', err);
            setError('Failed to save new custom order');
            throw err;
        }
    }, [menuItems]);

    const clearError = useCallback(() => setError(''), []);

    return {
        menuItems,
        loading,
        error,
        addMenuItem,
        updateMenuItem,
        deleteMenuItem,
        toggleAvailability,
        reorderMenuItems,
        clearError
    };
};
