import { useState, useEffect, useRef, useCallback } from 'react';
import { subscribeToTables, updateTable, deleteTable as deleteTableFirebase, addHistory as addHistoryFirebase } from '../services/firebaseService';

export const useTables = () => {
    const [tables, setTables] = useState({});
    const [loading, setLoading] = useState(true);
    const tablesRef = useRef({});

    // Debounced remote sync queue to avoid lagging the UI on rapid taps
    const pendingSyncTimers = useRef({});
    const pendingTables = useRef({});

    const syncTableDebounced = useCallback((tableId, tableData) => {
        if (pendingSyncTimers.current[tableId]) {
            clearTimeout(pendingSyncTimers.current[tableId]);
        }
        pendingTables.current[tableId] = tableData;
        pendingSyncTimers.current[tableId] = setTimeout(async () => {
            const dataToSave = pendingTables.current[tableId];
            delete pendingSyncTimers.current[tableId];
            delete pendingTables.current[tableId];
            if (dataToSave) {
                try {
                    await updateTable(tableId, dataToSave);
                } catch (err) {
                    console.error(`Error syncing table ${tableId}:`, err);
                }
            }
        }, 280);
    }, []);

    const flushTableSync = useCallback(async (tableId) => {
        if (tableId) {
            if (pendingSyncTimers.current[tableId]) {
                clearTimeout(pendingSyncTimers.current[tableId]);
                delete pendingSyncTimers.current[tableId];
            }
            const dataToSave = pendingTables.current[tableId];
            delete pendingTables.current[tableId];
            if (dataToSave) {
                try {
                    await updateTable(tableId, dataToSave);
                } catch (err) {
                    console.error(`Error flushing table ${tableId}:`, err);
                }
            }
        } else {
            // Flush all pending
            const tableIds = Object.keys(pendingSyncTimers.current);
            for (const id of tableIds) {
                clearTimeout(pendingSyncTimers.current[id]);
                delete pendingSyncTimers.current[id];
                const data = pendingTables.current[id];
                delete pendingTables.current[id];
                if (data) {
                    try {
                        await updateTable(id, data);
                    } catch (err) {
                        console.error(`Error flushing table ${id}:`, err);
                    }
                }
            }
        }
    }, []);

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
                // Sanitize any NaN IDs caused by old math bug
                Object.values(updatedTables).forEach(table => {
                    if (table.orders) {
                        table.orders.forEach((order, index) => {
                            if (!order.id || Number.isNaN(order.id) || order.id === 'NaN') {
                                order.id = `recovered-${Date.now()}-${index}`;
                            }
                        });
                    }
                });

                // Preserve local in-flight edits during rapid tapping
                Object.keys(pendingTables.current).forEach(tId => {
                    if (pendingTables.current[tId]) {
                        updatedTables[tId] = pendingTables.current[tId];
                    }
                });

                tablesRef.current = updatedTables;
                setTables(updatedTables);
            }
            setLoading(false);
        });

        return () => {
            unsubscribe();
            // Flush any remaining writes on unmount
            flushTableSync();
        };
    }, [flushTableSync]);

    const addOrderToTable = useCallback(async (tableId) => {
        await flushTableSync(tableId);
        const table = tablesRef.current[tableId];
        if (!table) return;

        const newOrderId = `order-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const newOrder = { id: newOrderId, items: [], total: 0 };

        const updatedTable = {
            ...table,
            orders: [...table.orders, newOrder],
            id: tableId
        };

        // Instant local update (0ms UI lag)
        const newlyUpdatedTables = { ...tablesRef.current, [tableId]: updatedTable };
        tablesRef.current = newlyUpdatedTables;
        setTables(newlyUpdatedTables);

        await updateTable(tableId, updatedTable);
    }, [flushTableSync]);

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
                quantity: (Number(updatedItems[existingItemIndex].quantity) || 0) + 1
            };
        } else {
            updatedItems = [...order.items, { ...menuItem, quantity: 1, price: Number(menuItem.price) || 0 }];
        }

        const updatedOrders = [...table.orders];
        updatedOrders[orderIndex] = {
            ...order,
            items: updatedItems,
            total: updatedItems.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 0)), 0)
        };

        const updatedTable = {
            ...table,
            orders: updatedOrders,
            total: updatedOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0)
        };

        // Instant local update (0ms UI lag)
        const newlyUpdatedTables = { ...tablesRef.current, [tableId]: updatedTable };
        tablesRef.current = newlyUpdatedTables;
        setTables(newlyUpdatedTables);

        // Batch rapid taps into single Firestore write
        syncTableDebounced(tableId, updatedTable);
    }, [syncTableDebounced]);

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
                quantity: Number(newQuantity) || 0
            };
        }

        const updatedOrders = [...table.orders];
        updatedOrders[orderIndex] = {
            ...order,
            items: updatedItems,
            total: updatedItems.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.quantity) || 0)), 0)
        };

        const updatedTable = {
            ...table,
            orders: updatedOrders,
            total: updatedOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0)
        };

        // Instant local update (0ms UI lag)
        const newlyUpdatedTables = { ...tablesRef.current, [tableId]: updatedTable };
        tablesRef.current = newlyUpdatedTables;
        setTables(newlyUpdatedTables);

        // Batch rapid taps into single Firestore write
        syncTableDebounced(tableId, updatedTable);
    }, [syncTableDebounced]);

    const clearOrder = useCallback(async (tableId, orderId) => {
        await flushTableSync(tableId);
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

        // Instant local update
        const newlyUpdatedTables = { ...tablesRef.current, [tableId]: updatedTable };
        tablesRef.current = newlyUpdatedTables;
        setTables(newlyUpdatedTables);

        await updateTable(tableId, updatedTable);
    }, [flushTableSync]);

    const removeOrder = useCallback(async (tableId, orderId) => {
        await flushTableSync(tableId);
        const table = tablesRef.current[tableId];
        if (!table) return;

        const updatedOrders = table.orders.filter(order => String(order.id) !== String(orderId));
        const updatedTable = {
            ...table,
            orders: updatedOrders,
            total: updatedOrders.reduce((sum, order) => sum + order.total, 0)
        };

        // Instant local update
        const newlyUpdatedTables = { ...tablesRef.current, [tableId]: updatedTable };
        tablesRef.current = newlyUpdatedTables;
        setTables(newlyUpdatedTables);

        await updateTable(tableId, updatedTable);
    }, [flushTableSync]);

    const clearTable = useCallback(async (tableId) => {
        await flushTableSync(tableId);
        const isParcel = String(tableId).startsWith('P-');
        if (isParcel) {
            delete tablesRef.current[tableId];
            setTables({ ...tablesRef.current });
            await deleteTableFirebase(tableId);
            return;
        }

        const table = tablesRef.current[tableId];
        if (!table) return;

        const updatedTable = {
            id: tableId,
            orders: [],
            total: 0
        };

        // Instant local update
        const newlyUpdatedTables = { ...tablesRef.current, [tableId]: updatedTable };
        tablesRef.current = newlyUpdatedTables;
        setTables(newlyUpdatedTables);

        await updateTable(tableId, updatedTable);
    }, [flushTableSync]);

    const addNewParcelOrder = useCallback(async () => {
        const existingParcelIds = Object.keys(tablesRef.current)
            .filter(id => String(id).startsWith('P-'))
            .map(id => Number(id.replace('P-', '')))
            .filter(n => !isNaN(n));

        const idSet = new Set(existingParcelIds);
        let candidate = 1;
        while (idSet.has(candidate)) {
            candidate++;
        }
        const newParcelId = `P-${candidate}`;
        const newParcel = {
            id: newParcelId,
            type: 'takeaway',
            orders: [{ id: `order-${Date.now()}-1`, items: [], total: 0 }],
            total: 0
        };
        const newlyUpdatedTables = { ...tablesRef.current, [newParcelId]: newParcel };
        tablesRef.current = newlyUpdatedTables;
        setTables(newlyUpdatedTables);
        await updateTable(newParcelId, newParcel);
        return newParcelId;
    }, []);

    const toggleItemParcel = useCallback(async (tableId, orderId, itemId) => {
        const table = tablesRef.current[tableId];
        if (!table || !table.orders) return;

        const updatedOrders = table.orders.map(order => {
            if (order.id !== orderId) return order;
            return {
                ...order,
                items: (order.items || []).map(it => {
                    if (it.id !== itemId) return it;
                    return { ...it, isParcel: !it.isParcel };
                })
            };
        });

        const updatedTable = { ...table, orders: updatedOrders };
        const newlyUpdatedTables = { ...tablesRef.current, [tableId]: updatedTable };
        tablesRef.current = newlyUpdatedTables;
        setTables(newlyUpdatedTables);
        syncTableDebounced(tableId, updatedTable);
    }, [syncTableDebounced]);

    const addNewTable = useCallback(async (customId) => {
        const existingTableIds = Object.keys(tablesRef.current).map(Number).filter(n => !isNaN(n));
        let newTableId;
        if (customId !== undefined && customId !== null && String(customId).trim() !== '') {
            newTableId = Number(customId);
        } else {
            const idSet = new Set(existingTableIds);
            let candidate = 1;
            while (idSet.has(candidate)) {
                candidate++;
            }
            newTableId = candidate;
        }

        if (isNaN(newTableId) || newTableId <= 0) {
            throw new Error('Please enter a valid table number');
        }

        const newTable = {
            id: newTableId,
            orders: [],
            total: 0
        };
        await updateTable(newTableId, newTable);
        return newTableId;
    }, []);

    const deleteTable = useCallback(async (tableId) => {
        await flushTableSync(tableId);
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
    }, [flushTableSync]);

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
        addNewParcelOrder,
        toggleItemParcel,
        flushTableSync,
        tablesRef
    };
};
