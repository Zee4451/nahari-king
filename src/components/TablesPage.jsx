import React, { useState, useEffect, useCallback } from 'react';
import NavigationBar from './NavigationBar';
import TableSection from './TableSection';
import CheckoutModal from './Tables/CheckoutModal';
import { TableProvider, useTableContext } from '../context/TableContext';
import { useMenu } from '../hooks/useMenu';
import {
  getAllHistory,
  subscribeToHistory,
  clearAllHistory,
  getConnectionState,
  onConnectionStateChange,
  updateTable
} from '../services/firebaseService';
import { Timestamp } from 'firebase/firestore';

// Inner component that consumes global state
const TablesPageContent = () => {
  // Helper function to format timestamp
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    if (timestamp instanceof Timestamp) return new Date(timestamp.seconds * 1000).toLocaleString();
    if (timestamp instanceof Date) return timestamp.toLocaleString();
    if (typeof timestamp === 'string') return timestamp;
    if (typeof timestamp === 'object' && timestamp.seconds !== undefined) return new Date(timestamp.seconds * 1000).toLocaleString();
    return String(timestamp);
  };

  const { tablesRef, loading: tableLoading } = useTableContext();
  const { menuItems, loading: menuLoading } = useMenu();

  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isOnline, setIsOnline] = useState(getConnectionState());
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Monitor connection state changes
  useEffect(() => {
    const unsubscribe = onConnectionStateChange((state) => setIsOnline(state));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let historyUnsubscribe = null;
    const initializeHistory = async () => {
      try {
        const firebaseHistory = await getAllHistory();
        setHistory(firebaseHistory);
        historyUnsubscribe = subscribeToHistory((updatedHistory) => {
          setHistory(updatedHistory);
        });
      } catch (error) {
        console.error('Error loading history:', error);
      } finally {
        setLoadingHistory(false);
      }
    };
    initializeHistory();
    return () => {
      if (historyUnsubscribe) historyUnsubscribe();
    };
  }, []);

  const toggleHistory = useCallback(() => {
    setShowHistory(prev => !prev);
  }, []);

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

      await updateTable(historyEntry.tableId, updatedTable); // Write to Firebase
    }
  }, [isOnline, tablesRef]);

  const isLoading = tableLoading || menuLoading || loadingHistory;

  return (
    <div className="tables-page">
      <NavigationBar currentPage="tables" />
      {isLoading ? (
        <div className="page-content" style={{ textAlign: 'center', padding: '2rem' }}>
          <div className="loading-spinner"></div>
          <p>Loading application...</p>
        </div>
      ) : (
        <div className="page-content">
          {/* Note how TableSection takes 0 props now! It pulls everything dynamically from hooks & context */}
          <TableSection />

          {/* Collapsible History Section */}
          <div className="history-section">
            <div className="history-header">
              <div className="history-toggle">
                <button
                  className="history-toggle-btn"
                  onClick={(e) => {
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

      <CheckoutModal />
    </div>
  );
};

// Application entry wrapper
const TablesPage = () => {
  return (
    <TableProvider>
      <TablesPageContent />
    </TableProvider>
  );
};

export default TablesPage;