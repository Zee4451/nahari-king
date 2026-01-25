import React, { useState, useEffect, useMemo, memo } from 'react';
import { List } from 'react-window';
import NavigationBar from './NavigationBar';
import { getAllHistory, subscribeToHistory } from '../services/firebaseService';

const HistoryPage = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe = null;
    
    const loadHistory = async () => {
      setLoading(true);
      try {
        // Subscribe to real-time history updates
        unsubscribe = subscribeToHistory((updatedHistory) => {
          setHistory(updatedHistory);
          setLoading(false);
        });
      } catch (error) {
        console.error('Error loading history:', error);
        setLoading(false);
      }
    };

    loadHistory();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Memoized history item component for virtual scrolling
  const HistoryItem = memo(({ index, style, data }) => {
    const { historyItems } = data;
    const entry = historyItems[index];
    
    return (
      <div style={style} className="history-item-virtual">
        <div className="history-header-row">
          <div className="history-info">
            <span className="table-number">Table {entry.tableId}</span>
            <span className="timestamp">{entry.timestamp}</span>
            <span className="total-amount">₹{entry.total}</span>
          </div>
          <div className="history-actions">
            <button 
              className="restore-btn" 
              onClick={() => alert(`Restore order for Table ${entry.tableId}`)}
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
    );
  });

  // Memoized data for virtual list
  const virtualListData = useMemo(() => ({
    historyItems: history
  }), [history]);

  if (loading) {
    return (
      <div className="history-page">
        <NavigationBar currentPage="history" />
        <div className="page-content">
          <div className="loading">Loading history...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="history-page">
      <NavigationBar currentPage="history" />
      <div className="page-content">
        <div className="history-header">
          <h1>Order History</h1>
          <div className="history-stats">
            <span>Total Entries: {history.length}</span>
          </div>
        </div>
        
        {history.length === 0 ? (
          <div className="no-history">
            <p>No order history yet.</p>
          </div>
        ) : (
          <div className="history-list-virtual">
            <List
              height={600}
              itemCount={history.length}
              itemSize={200}
              itemData={virtualListData}
              overscanCount={5}
            >
              {HistoryItem}
            </List>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(HistoryPage);