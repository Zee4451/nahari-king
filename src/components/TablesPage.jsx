import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import NavigationBar from './NavigationBar';
import TableSection from './TableSection';
import {
  getAllTables,
  subscribeToTables,
  updateTable,
  deleteTable as deleteTableFirebase,
  getAllHistory,
  subscribeToHistory,
  addHistory as addHistoryFirebase,
  clearAllHistory,
  getAllMenuItems,
  subscribeToMenuItems,
  batchUpdateTables,
  batchAddHistory,
  getTablesByIds,
  getConnectionState,
  onConnectionStateChange,
  getPagedTables,
  getPagedMenuItems,
  getMenuItemsSelective
} from '../services/firebaseService';
import { Timestamp } from 'firebase/firestore'; // Add this import for timestamp handling
import { getPaymentMethods } from '../services/shiftService';

const TablesPage = () => {
  // Helper function to format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';

    // If it's a Firestore Timestamp object
    if (timestamp instanceof Timestamp) {
      return new Date(timestamp.seconds * 1000).toLocaleString();
    }

    // If it's already a Date object
    if (timestamp instanceof Date) {
      return timestamp.toLocaleString();
    }

    // If it's already a string
    if (typeof timestamp === 'string') {
      return timestamp;
    }

    // If it's an object with seconds and nanoseconds (Firestore Timestamp)
    if (typeof timestamp === 'object' && timestamp.seconds !== undefined) {
      return new Date(timestamp.seconds * 1000).toLocaleString();
    }

    return String(timestamp);
  };

  // Initialize with default tables 1-10
  const tablesRef = useRef({});

  const [menuItems, setMenuItems] = useState([]); // Add missing state

  const [tables, setTables] = useState(() => {
    // Create default tables 1-10
    const defaultTables = {};
    for (let i = 1; i <= 10; i++) {
      defaultTables[i] = {
        id: i,
        orders: [],
        total: 0
      };
    }
    tablesRef.current = defaultTables;
    return defaultTables;
  });

  const [currentTable, setCurrentTable] = useState(1);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initComplete, setInitComplete] = useState(false);
  const [isOnline, setIsOnline] = useState(getConnectionState());

  // Checkout Modal State
  const [paymentMethods, setPaymentMethods] = useState(['Cash', 'UPI']);
  const [checkoutModal, setCheckoutModal] = useState({
    isOpen: false,
    type: null,
    targetId: null,
    targetTableId: null,
    total: 0,
    itemsToClear: null
  });

  // Memoize functions to prevent unnecessary re-renders
  const addOrderToTable = useCallback(async (tableId) => {
    const table = tablesRef.current[tableId];
    if (!table) return;

    // Generate new order ID based on current order count
    const newOrderId = table.orders.length > 0
      ? Math.max(...table.orders.map(order => order.id)) + 1
      : 1;
    const newOrder = {
      id: newOrderId,
      items: [],
      total: 0
    };

    const updatedTable = {
      ...table,
      orders: [...table.orders, newOrder],
      id: tableId
    };

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
      // Item already exists, increase quantity
      updatedItems = [...order.items];
      updatedItems[existingItemIndex] = {
        ...updatedItems[existingItemIndex],
        quantity: updatedItems[existingItemIndex].quantity + 1
      };
    } else {
      // New item, add with quantity 1
      updatedItems = [
        ...order.items,
        {
          ...menuItem,
          quantity: 1
        }
      ];
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
      // Remove item if quantity is 0
      updatedItems = order.items.filter(item => item.id !== itemId);
    } else {
      // Update quantity
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

    await updateTable(tableId, updatedTable);
  }, []);

  const clearOrder = useCallback(async (tableId, orderId) => {
    console.log('Clearing order:', orderId, 'from table:', tableId);
    const table = tablesRef.current[tableId];
    if (!table) {
      console.log('Table not found:', tableId);
      return;
    }

    const orderToClear = table.orders.find(order => order.id === orderId);
    console.log('Order to clear:', orderToClear);

    // Save to history if the order has items
    if (orderToClear && orderToClear.total > 0) {
      setCheckoutModal({
        isOpen: true,
        type: 'order',
        targetId: orderId,
        targetTableId: tableId,
        total: orderToClear.total,
        itemsToClear: { orderToClear, table }
      });
    } else {
      const updatedOrders = table.orders.map(order => {
        if (order.id === orderId) {
          return {
            ...order,
            items: [],
            total: 0
          };
        }
        return order;
      });

      const updatedTable = {
        ...table,
        orders: updatedOrders,
        total: updatedOrders.reduce((sum, order) => sum + order.total, 0)
      };

      await updateTable(tableId, updatedTable);
    }
  }, []);

  const removeOrder = useCallback(async (tableId, orderId) => {
    const table = tablesRef.current[tableId];
    if (!table) return;

    const updatedOrders = table.orders.filter(order => order.id !== orderId);

    const updatedTable = {
      ...table,
      orders: updatedOrders,
      total: updatedOrders.reduce((sum, order) => sum + order.total, 0)
    };

    await updateTable(tableId, updatedTable);
  }, []);

  const clearTable = useCallback(async (tableId) => {
    console.log('Clearing table:', tableId);
    const table = tablesRef.current[tableId];
    if (!table) {
      console.log('Table not found:', tableId);
      return;
    }

    if (table.orders.length === 0 || table.total === 0) {
      console.log('Table is already empty:', tableId);
      // If table is empty, just reset it
      const updatedTable = {
        id: tableId,
        orders: [],
        total: 0
      };

      await updateTable(tableId, updatedTable);
      return;
    }

    console.log('Initiating checkout for table:', tableId, 'with orders:', table.orders);

    setCheckoutModal({
      isOpen: true,
      type: 'table',
      targetId: tableId,
      targetTableId: tableId,
      total: table.total,
      itemsToClear: { table }
    });
  }, []);

  const addNewTable = useCallback(async () => {
    // Get all existing table IDs and find the highest one
    const existingTableIds = Object.keys(tablesRef.current).map(Number);
    const newTableId = existingTableIds.length > 0 ? Math.max(...existingTableIds) + 1 : 11; // Start from 11 if no tables exist
    const newTable = {
      id: newTableId,
      orders: [],
      total: 0
    };

    await updateTable(newTableId, newTable);
    setCurrentTable(newTableId);
  }, []);

  const deleteTable = useCallback(async (tableId) => {
    if (window.confirm(`Are you sure you want to delete Table ${tableId}? This will remove all orders from this table.`)) {
      // Clean up orders before deletion - save non-empty orders to history
      const table = tablesRef.current[tableId];
      if (table && table.orders.length > 0) {
        // Filter out non-empty orders to save to history
        const nonEmptyOrders = table.orders.filter(order => order.total > 0);

        // If there are non-empty orders, save them to history
        if (nonEmptyOrders.length > 0) {
          const historyEntry = {
            id: Date.now().toString(), // Add unique ID for React key
            tableId,
            orders: nonEmptyOrders,
            total: table.total,
            timestamp: new Date().toLocaleString() // Use properly formatted timestamp
          };

          await addHistoryFirebase(historyEntry);
        }
      }

      await deleteTableFirebase(tableId);

      // If the current table is being deleted, switch to the first available table
      if (currentTable === tableId) {
        const remainingTableIds = Object.keys(tablesRef.current).filter(id => id !== tableId).map(Number).sort((a, b) => a - b);
        if (remainingTableIds.length > 0) {
          setCurrentTable(remainingTableIds[0]);
        } else {
          // If no tables remain, create a new one
          const newTableId = 1;
          const newTable = {
            id: newTableId,
            orders: [],
            total: 0
          };

          await updateTable(newTableId, newTable);
          setCurrentTable(newTableId);
        }
      }
    }
  }, [currentTable]);

  const clearHistory = useCallback(async () => {
    if (window.confirm('Are you sure you want to clear all history? This cannot be undone.')) {
      await clearAllHistory();
    }
  }, []);

  const restoreOrder = useCallback(async (historyEntry) => {
    if (!isOnline) {
      alert('You are currently offline. Please connect to restore orders.');
      return;
    }

    if (window.confirm(`Restore order for Table ${historyEntry.tableId}?`)) {
      const currentTableData = tablesRef.current[historyEntry.tableId] || {
        id: historyEntry.tableId,
        orders: [],
        total: 0
      };

      // Add the orders from history
      // Instead of just concatenating, we need to create new orders with unique IDs
      const newOrderOffset = currentTableData.orders.length;
      const restoredOrders = historyEntry.orders.map((order, index) => ({
        ...order,
        id: currentTableData.orders.length + index + 1 // Generate new unique IDs
      }));

      const allOrders = [...currentTableData.orders, ...restoredOrders];
      const newTotal = allOrders.reduce((sum, order) => sum + order.total, 0);

      const updatedTable = {
        ...currentTableData,
        orders: allOrders,
        total: newTotal
      };

      await updateTable(historyEntry.tableId, updatedTable);
    }
  }, [isOnline]);

  // Monitor connection state changes
  useEffect(() => {
    const unsubscribe = onConnectionStateChange((state) => {
      setIsOnline(state);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let tablesUnsubscribe = null;
    let historyUnsubscribe = null;
    let menuItemsUnsubscribe = null;

    const initializeApp = async () => {
      try {
        // Initialize default tables if needed
        const existingTables = await getAllTables();

        if (Object.keys(existingTables).length === 0) {
          // Create default tables 1-10 if none exist
          for (let i = 1; i <= 10; i++) {
            const defaultTable = {
              id: i,
              orders: [],
              total: 0
            };
            await updateTable(i, defaultTable);
          }
        }

        // Subscribe to real-time tables updates
        tablesUnsubscribe = subscribeToTables((updatedTables) => {
          setTables(updatedTables);
          tablesRef.current = updatedTables; // Keep ref in sync
        });

        // Load POS payment methods
        const methods = await getPaymentMethods();
        if (methods) setPaymentMethods(methods);

        // Load history from Firebase
        try {
          const firebaseHistory = await getAllHistory();
          console.log('Initial history loaded:', firebaseHistory);
          setHistory(firebaseHistory);
        } catch (error) {
          console.error('Error loading initial history:', error);
        }

        // Subscribe to real-time history updates
        historyUnsubscribe = subscribeToHistory((updatedHistory) => {
          console.log('History updated:', updatedHistory);
          setHistory(updatedHistory);
        });

        // Subscribe to real-time menu items updates with proper error handling
        menuItemsUnsubscribe = subscribeToMenuItems((updatedMenuItems) => {
          try {
            // Filter for available items and sort by sequence
            const availableItems = updatedMenuItems
              .filter(item => item.available !== false)
              .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

            setMenuItems(availableItems);
          } catch (error) {
            console.error('Error processing menu items update:', error);
          }
        });

        setLoading(false);
        setInitComplete(true);
      } catch (error) {
        console.error('Error initializing app:', error);
        setLoading(false);
        setInitComplete(true);
      }
    };

    initializeApp();

    // Cleanup subscriptions
    return () => {
      if (tablesUnsubscribe) tablesUnsubscribe();
      if (historyUnsubscribe) historyUnsubscribe();
      if (menuItemsUnsubscribe) menuItemsUnsubscribe();
    };
  }, []);

  const toggleHistory = useCallback(() => {
    console.log('Toggling history. Current state:', showHistory);
    setShowHistory(!showHistory);
  }, [showHistory]);

  const handleCheckoutSubmit = async (paymentMethod) => {
    const { type, targetId, targetTableId, itemsToClear } = checkoutModal;

    if (type === 'order') {
      const { orderToClear, table } = itemsToClear;
      const historyEntry = {
        tableId: targetTableId,
        orders: [orderToClear],
        total: orderToClear.total,
        paymentMethod,
        timestamp: new Date().toLocaleString()
      };
      await addHistoryFirebase(historyEntry);

      const updatedOrders = table.orders.map(order =>
        (order.id === targetId) ? { ...order, items: [], total: 0 } : order
      );

      const updatedTable = {
        ...table,
        orders: updatedOrders,
        total: updatedOrders.reduce((sum, order) => sum + order.total, 0)
      };

      await updateTable(targetTableId, updatedTable);
    } else if (type === 'table') {
      const { table } = itemsToClear;
      const historyEntry = {
        id: Date.now().toString(),
        tableId: targetId,
        orders: table.orders,
        total: table.total,
        paymentMethod,
        timestamp: new Date().toLocaleString()
      };

      await addHistoryFirebase(historyEntry);

      const updatedTable = {
        ...table,
        orders: [],
        total: 0
      };

      await updateTable(targetId, updatedTable);
    }

    setCheckoutModal({ isOpen: false, type: null, targetId: null, targetTableId: null, total: 0, itemsToClear: null });
  };

  return (
    <div className="tables-page">
      <NavigationBar currentPage="tables" />
      {loading || !initComplete ? (
        <div className="page-content" style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="loading-spinner"></div>
          <p>Loading application...</p>
        </div>
      ) : (
        <div className="page-content">
          <TableSection
            tables={tables}
            currentTable={currentTable}
            setCurrentTable={setCurrentTable}
            menuItems={menuItems}
            addOrderToTable={addOrderToTable}
            addItemToOrder={addItemToOrder}
            updateItemQuantity={updateItemQuantity}
            clearTable={clearTable}
            clearOrder={clearOrder}
            removeOrder={removeOrder}
            addNewTable={addNewTable}
            deleteTable={deleteTable}
          />

          {/* Collapsible History Section */}
          <div className="history-section">
            <div className="history-header">
              <div className="history-toggle">
                <button
                  className="history-toggle-btn"
                  onClick={(e) => {
                    console.log('History button clicked');
                    e.stopPropagation();
                    toggleHistory();
                  }}
                >
                  Order History {showHistory ? '▲' : '▼'} ({history.length})
                </button>
                {showHistory && history.length > 0 && (
                  <button className="clear-history-btn" onClick={clearHistory}>
                    Clear All History
                  </button>
                )}
              </div>
            </div>

            {showHistory && (
              <div className="history-content">
                {history.length === 0 ? (
                  <div className="no-history">
                    <p>No order history yet.</p>
                  </div>
                ) : (
                  <div className="history-list">
                    {[...history].reverse().map((entry) => (
                      <div key={entry.id} className="history-item">
                        <div className="history-header-row">
                          <div className="history-info">
                            <span className="table-number">Table {entry.tableId}</span>
                            <span className="timestamp">{formatTimestamp(entry.timestamp)}</span>
                            <span className="total-amount">₹{entry.total}</span>
                          </div>
                          <div className="history-actions">
                            <button
                              className="restore-btn"
                              onClick={() => restoreOrder(entry)}
                            >
                              Restore
                            </button>
                          </div>
                        </div>

                        <div className="history-orders">
                          {entry.orders.map((order, orderIndex) => (
                            <div key={`${entry.id}-${orderIndex}`} className="history-order">
                              <h4>Order {orderIndex + 1}</h4>
                              <div className="history-items">
                                {order.items.map((item, itemIndex) => (
                                  <div key={`${entry.id}-${orderIndex}-${itemIndex}`} className="history-item-row">
                                    <span className="item-name">{item.name}</span>
                                    <span className="item-qty">x{item.quantity}</span>
                                    <span className="item-price">₹{(item.price * item.quantity).toFixed(2)}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="order-total">Order Total: ₹{order.total.toFixed(2)}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {checkoutModal.isOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Checkout Summary</h3>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: '1.1rem', color: '#666' }}>Total Amount</div>
              <div className="total-amount" style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>
                ₹{checkoutModal.total.toFixed(2)}
              </div>
            </div>

            <h4 style={{ textAlign: 'center', color: '#666', marginBottom: '1rem' }}>Select Payment Method</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              {paymentMethods.map(method => (
                <button
                  key={method}
                  onClick={() => handleCheckoutSubmit(method)}
                  className="primary-btn"
                  style={method === 'Cash' ? { background: 'linear-gradient(135deg, #28a745, #218838)' } : {}}
                >
                  {method}
                </button>
              ))}
            </div>

            <button
              onClick={() => setCheckoutModal({ isOpen: false, type: null, targetId: null, targetTableId: null, total: 0, itemsToClear: null })}
              className="secondary-btn"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default TablesPage;