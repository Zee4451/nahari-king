import { useState, useEffect, useRef, useCallback } from 'react';
import { subscribeToTables, updateTable, deleteTable as deleteTableFirebase, addHistory as addHistoryFirebase } from '../services/firebaseService';

export const useTables = () => {
    const [tables, setTables] = useState({});
    const [loading, setLoading] = useState(true);
    const tablesRef = useRef({});

    useEffect(() => {
        // Initialize with default tables 1-10 if empty
        const defaultTables = {};
        for (let i = 1; i <= 10; i++) {
            defaultTables[i] = {
                id: i,
                orders: [],
                total: 0
            };
        }
        tablesRef.current = defaultTables;
        setTables(defaultTables);

        const unsubscribe = subscribeToTables((updatedTables) => {
            if (Object.keys(updatedTables).length > 0) {
                // Sanitize any NaN IDs caused by the Math.max bug so users can delete stuck orders
                Object.values(updatedTables).forEach(table => {
                    if (table.orders) {
                        table.orders.forEach((order, index) => {
                            if (!order.id || Number.isNaN(order.id) || order.id === 'NaN') {
                                order.id = `recovered-${Date.now()}-${index}`;
                            }
                        });
                    }
                });

                tablesRef.current = updatedTables;
                setTables(updatedTables);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const addOrderToTable = useCallback(async (tableId) => {
        const table = tablesRef.current[tableId];
        if (!table) return;

        // Use a robust string-based ID to prevent NaN math errors.
        const newOrderId = `order-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const newOrder = { id: newOrderId, items: [], total: 0 };

        const updatedTable = {
            ...table,
            orders: [...table.orders, newOrder],
            id: tableId
        };

        // Optimistic UI Update
        const newlyUpdatedTables = { ...tablesRef.current, [tableId]: updatedTable };
        tablesRef.current = newlyUpdatedTables;
        setTables(newlyUpdatedTables);

        await updateTable(tableId, updatedTable);
    }, []);

    const addItemToOrder = useCallback(async (tableId, orderId, menuItem) => {
        const table = tablesRef.current[tableId];
        if (!table) return;

        const orderIndex = table.orders.findIndex(order => order.id === orderId);
        if (orderIndex === -1) return;

        const order = table.orders[orderIndex];
        const existingItemIndex = order.items.findIndex(item => item.id === menuItem.id);

        let updatedItems;
        if (existingItemIndex > -1) {
            updatedItems = [...order.items];
            updatedItems[existingItemIndex] = {
                ...updatedItems[existingItemIndex],
                quantity: updatedItems[existingItemIndex].quantity + 1
            };
        } else {
            updatedItems = [...order.items, { ...menuItem, quantity: 1 }];
        }

        const updatedOrders = [...table.orders];
        updatedOrders[orderIndex] = {
            ...order,
            items: updatedItems,
            total: updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
        };

        const updatedTable = {
            ...table,
            orders: updatedOrders,
            total: updatedOrders.reduce((sum, order) => sum + order.total, 0)
        };

        // Optimistic UI Update
        const newlyUpdatedTables = { ...tablesRef.current, [tableId]: updatedTable };
        tablesRef.current = newlyUpdatedTables;
        setTables(newlyUpdatedTables);

        await updateTable(tableId, updatedTable);
    }, []);

    const updateItemQuantity = useCallback(async (tableId, orderId, itemId, newQuantity) => {
        if (newQuantity < 0) return;
        const table = tablesRef.current[tableId];
        if (!table) return;

        const orderIndex = table.orders.findIndex(order => order.id === orderId);
        if (orderIndex === -1) return;

        const order = table.orders[orderIndex];
        const itemIndex = order.items.findIndex(item => item.id === itemId);
        if (itemIndex === -1) return;

        let updatedItems;
        if (newQuantity === 0) {
            updatedItems = order.items.filter(item => item.id !== itemId);
        } else {
            updatedItems = [...order.items];
            updatedItems[itemIndex] = {
                ...updatedItems[itemIndex],
                quantity: newQuantity
            };
        }

        const updatedOrders = [...table.orders];
        updatedOrders[orderIndex] = {
            ...order,
            items: updatedItems,
            total: updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
        };

        const updatedTable = {
            ...table,
            orders: updatedOrders,
            total: updatedOrders.reduce((sum, order) => sum + order.total, 0)
        };

        // Optimistic UI Update
        const newlyUpdatedTables = { ...tablesRef.current, [tableId]: updatedTable };
        tablesRef.current = newlyUpdatedTables;
        setTables(newlyUpdatedTables);

        await updateTable(tableId, updatedTable);
    }, []);

    const clearOrder = useCallback(async (tableId, orderId) => {
        const table = tablesRef.current[tableId];
        if (!table) return;

        const updatedOrders = table.orders.map(order => {
            if (String(order.id) === String(orderId)) {
                return { ...order, items: [], total: 0 };
            }
            return order;
        });

        const updatedTable = {
            ...table,
            orders: updatedOrders,
            total: updatedOrders.reduce((sum, order) => sum + order.total, 0)
        };

        // Optimistic UI Update
        const newlyUpdatedTables = { ...tablesRef.current, [tableId]: updatedTable };
        tablesRef.current = newlyUpdatedTables;
        setTables(newlyUpdatedTables);

        await updateTable(tableId, updatedTable);
    }, []);

    const removeOrder = useCallback(async (tableId, orderId) => {
        const table = tablesRef.current[tableId];
        if (!table) return;

        const updatedOrders = table.orders.filter(order => String(order.id) !== String(orderId));
        const updatedTable = {
            ...table,
            orders: updatedOrders,
            total: updatedOrders.reduce((sum, order) => sum + order.total, 0)
        };

        // Optimistic UI Update
        const newlyUpdatedTables = { ...tablesRef.current, [tableId]: updatedTable };
        tablesRef.current = newlyUpdatedTables;
        setTables(newlyUpdatedTables);

        await updateTable(tableId, updatedTable);
    }, []);

    const clearTable = useCallback(async (tableId) => {
        const table = tablesRef.current[tableId];
        if (!table) return;

        const updatedTable = {
            id: tableId,
            orders: [],
            total: 0
        };

        // Optimistic UI Update
        const newlyUpdatedTables = { ...tablesRef.current, [tableId]: updatedTable };
        tablesRef.current = newlyUpdatedTables;
        setTables(newlyUpdatedTables);

        await updateTable(tableId, updatedTable);
    }, []);

    const addNewTable = useCallback(async () => {
        const existingTableIds = Object.keys(tablesRef.current).map(Number);
        const newTableId = existingTableIds.length > 0 ? Math.max(...existingTableIds) + 1 : 11;
        const newTable = {
            id: newTableId,
            orders: [],
            total: 0
        };
        await updateTable(newTableId, newTable);
        return newTableId;
    }, []);

    const deleteTable = useCallback(async (tableId) => {
        const table = tablesRef.current[tableId];
        if (table && table.orders.length > 0) {
            const nonEmptyOrders = table.orders.filter(order => order.total > 0);
            if (nonEmptyOrders.length > 0) {
                const historyEntry = {
                    id: Date.now().toString(),
                    tableId,
                    orders: nonEmptyOrders,
                    total: table.total,
                    timestamp: new Date().toLocaleString()
                };
                await addHistoryFirebase(historyEntry);
            }
        }
        await deleteTableFirebase(tableId);
        return true;
    }, []);

    return {
        tables,
        loading,
        addOrderToTable,
        addItemToOrder,
        updateItemQuantity,
        clearOrder,
        removeOrder,
        clearTable,
        addNewTable,
        deleteTable,
        tablesRef
    };
};
