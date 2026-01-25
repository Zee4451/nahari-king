import React, { useState, useEffect, useRef } from 'react';
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

const TablesPage = () => {
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
  
  // Monitor connection state changes
  useEffect(() => {
    const unsubscribe = onConnectionStateChange((state) => {
      setIsOnline(state);
      if (state) {
        console.log('Connection restored');
      } else {
        console.log('Connection lost');
      }
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
        
        // Subscribe to real-time history updates
        historyUnsubscribe = subscribeToHistory((updatedHistory) => {
          setHistory(updatedHistory);
        });
        
        // Load menu items from Firebase
        try {
          console.log('Loading menu items...');
          // Load menu items from Firebase
          const firebaseMenuItems = await getAllMenuItems();
          console.log('Firebase menu items:', firebaseMenuItems);
          
          if (firebaseMenuItems.length > 0) {
            // Use Firebase data if it exists
            console.log('Using Firebase menu items');
            setMenuItems(firebaseMenuItems.filter(item => item.available));
          } else {
            console.log('No Firebase menu items found, keeping default items');
            // If no Firebase data exists, try to migrate from localStorage if available
            const savedMenuItems = localStorage.getItem('nalliNihariMenuItems');
            console.log('LocalStorage menu items:', savedMenuItems);
            
            if (savedMenuItems) {
              const parsedItems = JSON.parse(savedMenuItems);
              const availableItems = parsedItems.filter(item => item.available);
              console.log('Using localStorage menu items');
              setMenuItems(availableItems);
            }
            // If no localStorage either, keep the default items that were set in useState
          }
        } catch (error) {
          console.error('Error loading menu items:', error);
          // Fallback to localStorage if Firebase fails
          const savedMenuItems = localStorage.getItem('nalliNihariMenuItems');
          if (savedMenuItems) {
            setMenuItems(JSON.parse(savedMenuItems).filter(item => item.available));
          }
        }
        
        // Subscribe to real-time menu items updates
        menuItemsUnsubscribe = subscribeToMenuItems((updatedMenuItems) => {
          console.log('Menu items updated:', updatedMenuItems);
          if (updatedMenuItems.length > 0) {
            setMenuItems(updatedMenuItems.filter(item => item.available));
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

  // Function to add a new order to a table
  const addOrderToTable = async (tableId) => {
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
  };

  // Function to add item to an order
  const addItemToOrder = async (tableId, orderId, menuItem) => {
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
  };

  // Function to update item quantity
  const updateItemQuantity = async (tableId, orderId, itemId, newQuantity) => {
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
  };

  // Function to clear a specific order
  const clearOrder = async (tableId, orderId) => {
    const table = tablesRef.current[tableId];
    if (!table) return;
    
    const orderToClear = table.orders.find(order => order.id === orderId);
    
    // Save to history if the order has items
    if (orderToClear && orderToClear.total > 0) {
      const historyEntry = {
        tableId,
        orders: [orderToClear], // Save just this order
        total: orderToClear.total,
        timestamp: new Date().toLocaleString()
      };
      
      await addHistoryFirebase(historyEntry);
    }
    
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
  };
  
  // Function to remove a specific order
  const removeOrder = async (tableId, orderId) => {
    const table = tablesRef.current[tableId];
    if (!table) return;
    
    const updatedOrders = table.orders.filter(order => order.id !== orderId);
    
    const updatedTable = {
      ...table,
      orders: updatedOrders,
      total: updatedOrders.reduce((sum, order) => sum + order.total, 0)
    };
    
    await updateTable(tableId, updatedTable);
  };

  // Function to clear a table (save to history and remove from active) with batch optimization
  const clearTable = async (tableId) => {
    const table = tablesRef.current[tableId];
    if (!table) return;
    
    if (table.orders.length === 0 || table.total === 0) {
      // If table is empty, just reset it
      const updatedTable = {
        id: tableId,
        orders: [],
        total: 0
      };
      
      await updateTable(tableId, updatedTable);
      return;
    }
    
    // Save to history using batch operation for better performance
    const historyEntry = {
      id: Date.now().toString(), // Add unique ID for React key
      tableId,
      orders: table.orders,
      total: table.total,
      timestamp: new Date().toLocaleString()
    };
    
    // Use batch operation if multiple entries need to be saved
    await addHistoryFirebase(historyEntry);
    
    // Reset table
    const updatedTable = {
      ...table,
      orders: [],
      total: 0
    };
    
    await updateTable(tableId, updatedTable);
  };

  // Function to add a new table
  const addNewTable = async () => {
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
  };

  // Function to delete a table with batch optimization
  const deleteTable = async (tableId) => {
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
            timestamp: new Date().toLocaleString()
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
  };

  // Function to clear history with batch optimization
  const clearHistory = async () => {
    if (window.confirm('Are you sure you want to clear all history? This cannot be undone.')) {
      await clearAllHistory();
    }
  };

  // Function to restore order with connection awareness
  const restoreOrder = async (historyEntry) => {
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
      
      alert(`Order restored to Table ${historyEntry.tableId}`);
    }
  };

  const toggleHistory = () => {
    setShowHistory(!showHistory);
  };
  
  // Show connection status indicator
  const ConnectionIndicator = () => (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      padding: '8px 12px',
      borderRadius: '4px',
      fontSize: '14px',
      fontWeight: 'bold',
      zIndex: 1000,
      backgroundColor: isOnline ? '#4CAF50' : '#f44336',
      color: 'white',
      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
    }}>
      {isOnline ? 'ONLINE' : 'OFFLINE'}
    </div>
  );

  return (
    <div className="tables-page">
      <NavigationBar currentPage="tables" />
      <ConnectionIndicator />
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
                <button className="history-toggle-btn" onClick={toggleHistory}>
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
                            <span className="timestamp">{entry.timestamp}</span>
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
    </div>
  );
};

export default TablesPage;