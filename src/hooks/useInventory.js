import { useState, useEffect, useMemo, useCallback } from 'react';
import {
    subscribeToInventory,
    addInventoryItem as firebaseAddInventoryItem,
    updateInventoryItem as firebaseUpdateInventoryItem,
    deleteInventoryItem as firebaseDeleteInventoryItem,
    addPurchaseRecord as firebaseAddPurchaseRecord,
    addWasteEntry as firebaseAddWasteEntry
} from '../services/inventoryService';

export const useInventory = () => {
    const [inventory, setInventory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const unsubscribe = subscribeToInventory((items) => {
            setInventory(items);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const lowStockItems = useMemo(() => {
        return inventory.filter(item => item.currentStock <= item.reorderLevel && item.reorderLevel > 0);
    }, [inventory]);

    const addInventoryItem = useCallback(async (itemData) => {
        try {
            await firebaseAddInventoryItem(itemData);
            setError('');
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    const updateInventoryItem = useCallback(async (id, itemData) => {
        try {
            await firebaseUpdateInventoryItem(id, itemData);
            setError('');
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    const deleteInventoryItem = useCallback(async (id) => {
        try {
            await firebaseDeleteInventoryItem(id);
            setError('');
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    const addPurchaseRecord = useCallback(async (recordData) => {
        try {
            await firebaseAddPurchaseRecord(recordData);
            setError('');
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    const addWasteEntry = useCallback(async (wasteData) => {
        try {
            await firebaseAddWasteEntry(wasteData);
            setError('');
        } catch (err) {
            setError(err.message);
            throw err;
        }
    }, []);

    const clearError = useCallback(() => {
        setError('');
    }, []);

    return {
        inventory,
        loading,
        error,
        lowStockItems,
        addInventoryItem,
        updateInventoryItem,
        deleteInventoryItem,
        addPurchaseRecord,
        addWasteEntry,
        clearError
    };
};
