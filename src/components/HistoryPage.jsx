import React, { useState, useEffect } from 'react';
import NavigationBar from './NavigationBar';

const HistoryPage = () => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem('nalliNihariHistory');
      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        // Ensure parsedHistory is an array
        setHistory(Array.isArray(parsedHistory) ? parsedHistory : []);
      } else {
        setHistory([]);
      }
    } catch (error) {
      console.error('Error loading history:', error);
      setHistory([]);
    }
  }, []);

  const clearHistory = () => {
    if (window.confirm('Are you sure you want to clear all history? This cannot be undone.')) {
      localStorage.removeItem('nalliNihariHistory');
      setHistory([]);
    }
  };

  const restoreOrder = (historyEntry) => {
    if (!historyEntry || !historyEntry.tableId || !historyEntry.orders) {
      alert('Invalid history entry');
      return;
    }
    
    if (window.confirm(`Restore order for Table ${historyEntry.tableId}?`)) {
      try {
        // Get current tables
        const currentTables = JSON.parse(localStorage.getItem('nalliNihariTables') || '{}');
        
        // Add the restored order to the table
        const table = currentTables[historyEntry.tableId] || {
          id: historyEntry.tableId,
          orders: [],
          total: 0
        };
        
        // Add the orders from history
        const ordersToAdd = Array.isArray(historyEntry.orders) ? historyEntry.orders : [];
        const restoredOrders = [...table.orders, ...ordersToAdd];
        const newTotal = restoredOrders.reduce((sum, order) => {
          return sum + (order && typeof order.total === 'number' ? order.total : 0);
        }, 0);
        
        const updatedTables = {
          ...currentTables,
          [historyEntry.tableId]: {
            ...table,
            orders: restoredOrders,
            total: newTotal
          }
        };
        
        localStorage.setItem('nalliNihariTables', JSON.stringify(updatedTables));
        
        // Remove from history
        const updatedHistory = history.filter(item => item.id !== historyEntry.id);
        localStorage.setItem('nalliNihariHistory', JSON.stringify(updatedHistory));
        setHistory(updatedHistory);
        
        alert(`Order restored to Table ${historyEntry.tableId}`);
      } catch (error) {
        console.error('Error restoring order:', error);
        alert('Error restoring order');
      }
    }
  };

  return (
    <div className="history-page">
      <NavigationBar currentPage="history" />
      <div className="page-content">
        <div className="history-header">
          <h1>Order History</h1>
          {history.length > 0 && (
            <button className="clear-history-btn" onClick={clearHistory}>
              Clear All History
            </button>
          )}
        </div>
        
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
                    <span className="table-number">Table {entry.tableId || 'N/A'}</span>
                    <span className="timestamp">{entry.timestamp || 'N/A'}</span>
                    <span className="total-amount">₹{typeof entry.total === 'number' ? entry.total.toFixed(2) : '0.00'}</span>
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
                  {entry.orders && Array.isArray(entry.orders) ? (
                    entry.orders.map((order, orderIndex) => (
                      <div key={orderIndex} className="history-order">
                        <h4>Order {orderIndex + 1}</h4>
                        <div className="history-items">
                          {order.items && Array.isArray(order.items) ? (
                            order.items.map((item, itemIndex) => (
                              <div key={itemIndex} className="history-item-row">
                                <span className="item-name">{item.name}</span>
                                <span className="item-qty">x{item.quantity}</span>
                                <span className="item-price">₹{(item.price * item.quantity).toFixed(2)}</span>
                              </div>
                            ))
                          ) : (
                            <div className="no-items">No items in order</div>
                          )}
                        </div>
                        <div className="order-total">Order Total: ₹{order.total ? order.total.toFixed(2) : '0.00'}</div>
                      </div>
                    ))
                  ) : (
                    <div className="no-orders">No orders in history entry</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;