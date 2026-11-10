import React, { useState, useEffect, useMemo, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import NavigationBar from './NavigationBar';
import { subscribeToHistory, updateTable, deleteHistory } from '../services/firebaseService';
import { Timestamp } from 'firebase/firestore';
import {
  Search,
  Calendar,
  X,
  RefreshCw,
  ShoppingBag,
  UtensilsCrossed,
  Printer,
  Share2,
  ExternalLink,
  Phone,
  Banknote,
  Smartphone,
  CreditCard,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Trash2,
  Star
} from 'lucide-react';
import { getDigitalReceiptUrl, openWhatsAppReceipt, openWhatsAppReviewRequest, formatBillNumber } from '../utils/receiptHelper';
import './HistoryPage.css';

/**
 * Safely parses varied Firebase / JS timestamp formats into a JavaScript Date
 */
const parseTimestampToDate = (timestamp) => {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'number') return new Date(timestamp);
  if (timestamp instanceof Timestamp || (typeof timestamp === 'object' && timestamp.seconds !== undefined)) {
    return new Date(timestamp.seconds * 1000);
  }
  if (typeof timestamp === 'string') {
    const num = Number(timestamp);
    if (!isNaN(num) && num > 1000000000000) return new Date(num);

    const parsed = new Date(timestamp);
    if (!isNaN(parsed.getTime())) return parsed;

    // Handle DD/MM/YYYY, HH:MM:SS format
    const match = timestamp.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:,\s*(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (match) {
      const [, day, month, year, hours = 0, mins = 0, secs = 0] = match;
      return new Date(year, month - 1, day, hours, mins, secs);
    }
  }
  return null;
};

/**
 * Formats timestamp to readable localized string
 */
const formatTimestamp = (timestamp) => {
  const d = parseTimestampToDate(timestamp);
  if (!d) return String(timestamp || '');
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

/**
 * Extracts and consolidates all items from an order history entry
 */
const getConsolidatedItems = (entry) => {
  const rawItems = [];
  if (Array.isArray(entry.items) && entry.items.length > 0) {
    rawItems.push(...entry.items);
  }
  if (Array.isArray(entry.orders)) {
    entry.orders.forEach((ord) => {
      if (Array.isArray(ord.items)) {
        ord.items.forEach((it) => {
          if (it && it.name && (Number(it.quantity) || 0) > 0) {
            rawItems.push(it);
          }
        });
      }
    });
  }

  const map = new Map();
  rawItems.forEach((it) => {
    const isParcel = Boolean(it.isParcel || String(it.id).endsWith('_parcel'));
    const key = `${it.name}_${isParcel ? 'parcel' : 'dine'}`;
    const qty = Number(it.quantity) || 0;
    const price = Number(it.price) || 0;

    if (map.has(key)) {
      const existing = map.get(key);
      existing.quantity += qty;
    } else {
      map.set(key, {
        id: it.id || key,
        name: it.name,
        price,
        quantity: qty,
        isParcel
      });
    }
  });

  return Array.from(map.values());
};

const HistoryPage = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('all'); // 'all' | 'today' | 'yesterday' | 'week'
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'dine-in' | 'takeaway'
  const [paymentFilter, setPaymentFilter] = useState('all'); // 'all' | 'Cash' | 'UPI'
  const [expandedCards, setExpandedCards] = useState(new Set());
  const navigate = useNavigate();

  const handleReopenOrder = async (entry) => {
    const isParcel = String(entry.tableId).startsWith('P-') || entry.orderType === 'takeaway';
    const label = isParcel ? `Takeaway Order #${String(entry.tableId).replace('P-', '')}` : `Table ${entry.tableId}`;

    const confirmMessage = `Reopen ${label} to remove the extra item and correct the bill?\n\nThis will restore the order to your live POS screen and remove this outdated bill from history so you don't get duplicate sales.`;
    if (!window.confirm(confirmMessage)) return;

    try {
      const tableId = String(entry.tableId);
      const restoredOrders = (Array.isArray(entry.orders) && entry.orders.length > 0)
        ? entry.orders
        : [{ id: 1, items: entry.items || [], total: Number(entry.total) || 0 }];

      const restoredTable = {
        id: tableId,
        type: isParcel ? 'takeaway' : 'dine-in',
        orders: restoredOrders,
        total: Number(entry.total) || 0
      };

      // 1. Restore order to live table in POS
      await updateTable(tableId, restoredTable);

      // 2. Delete outdated bill from history to avoid duplicate entries & inflated revenue
      const histId = entry.id || entry.docId;
      if (histId) {
        await deleteHistory(histId);
      }

      alert(`${label} restored to POS screen! You can now remove the extra item and re-settle.`);
      navigate('/tables');
    } catch (err) {
      console.error('Error reopening order:', err);
      alert('Could not reopen order. Please try again.');
    }
  };

  const handleDeleteHistory = async (entry) => {
    const isParcel = String(entry.tableId).startsWith('P-') || entry.orderType === 'takeaway';
    const label = isParcel ? `Takeaway Order #${String(entry.tableId).replace('P-', '')}` : `Table ${entry.tableId}`;
    const amount = Number(entry.total || 0).toFixed(2);

    const confirmMessage = `Are you sure you want to permanently delete this bill from history?\n\n${label} — ₹${amount} (${formatTimestamp(entry.timestamp)})\n\nThis will remove it from Order History and update total sales.`;
    if (!window.confirm(confirmMessage)) return;

    try {
      const histId = entry.id || entry.docId;
      if (histId) {
        await deleteHistory(histId);
      }
    } catch (err) {
      console.error('Error deleting history entry:', err);
      alert('Failed to delete history entry. Please try again.');
    }
  };

  // Real-time subscription to Firebase order history
  useEffect(() => {
    let unsubscribe = null;
    setLoading(true);

    try {
      unsubscribe = subscribeToHistory((updatedHistory) => {
        setHistory(updatedHistory || []);
        setLoading(false);
      });
    } catch (err) {
      console.error('Error in subscribeToHistory:', err);
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const toggleExpand = (id) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Filtered orders list
  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
    const weekStart = todayStart - 7 * 24 * 60 * 60 * 1000;

    return history.filter((entry) => {
      const entryDate = parseTimestampToDate(entry.timestamp) || parseTimestampToDate(entry.id);
      const entryTime = entryDate ? entryDate.getTime() : null;

      // 1. Date Filter
      if (entryTime) {
        if (dateFilter === 'today' && (entryTime < todayStart || entryTime >= todayEnd)) {
          return false;
        }
        if (dateFilter === 'yesterday' && (entryTime < yesterdayStart || entryTime >= todayStart)) {
          return false;
        }
        if (dateFilter === 'week' && entryTime < weekStart) {
          return false;
        }
      }

      // 2. Order Type Filter
      const isTakeaway = String(entry.tableId).startsWith('P-') || entry.orderType === 'takeaway';
      const isDineIn = !String(entry.tableId).startsWith('P-') && entry.orderType !== 'takeaway';

      if (typeFilter === 'dine-in' && !isDineIn) return false;
      if (typeFilter === 'takeaway' && !isTakeaway && entry.orderType !== 'dine-in + parcel') return false;

      // 3. Payment Filter
      if (paymentFilter !== 'all') {
        const pay = String(entry.paymentMethod || 'Cash').toLowerCase();
        if (!pay.includes(paymentFilter.toLowerCase())) return false;
      }

      // 4. Search Query (Table, Phone, or Dish Name)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const tableMatch = String(entry.tableId || '').toLowerCase().includes(q);
        const phoneMatch = String(entry.customerPhone || '').toLowerCase().includes(q);
        const billMatch = String(entry.id || '').toLowerCase().includes(q);

        const items = getConsolidatedItems(entry);
        const itemMatch = items.some((it) => it.name.toLowerCase().includes(q));

        if (!tableMatch && !phoneMatch && !billMatch && !itemMatch) {
          return false;
        }
      }

      return true;
    });
  }, [history, dateFilter, typeFilter, paymentFilter, searchQuery]);

  // Aggregate Metrics for currently filtered orders
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let cashRevenue = 0;
    let upiRevenue = 0;
    let parcelRevenue = 0;

    filteredOrders.forEach((entry) => {
      const tot = Number(entry.total) || 0;
      totalRevenue += tot;

      const pay = String(entry.paymentMethod || 'Cash').toLowerCase();
      if (pay.includes('cash')) {
        cashRevenue += tot;
      } else if (pay.includes('upi')) {
        upiRevenue += tot;
      }

      parcelRevenue += Number(entry.parcelSubtotal) || 0;
    });

    return {
      count: filteredOrders.length,
      totalRevenue,
      cashRevenue,
      upiRevenue,
      parcelRevenue
    };
  }, [filteredOrders]);

  return (
    <div className="history-page-wrapper">
      <NavigationBar currentPage="history" />

      <div className="history-container">
        {/* Header & Stats Card */}
        <div className="history-header-card">
          <div className="history-title-row">
            <div className="history-title-left">
              <h1>Completed Order History</h1>
              <span className="history-badge-count">{stats.count} Orders</span>
            </div>
            {history.length > 0 && dateFilter !== 'all' && (
              <button
                type="button"
                className="history-filter-pill"
                onClick={() => setDateFilter('all')}
                style={{ fontSize: '0.75rem' }}
              >
                View All Time ({history.length})
              </button>
            )}
          </div>

          {/* Aggregate Revenue Statistics */}
          <div className="history-stats-grid">
            <div className="history-stat-box">
              <span className="history-stat-label">Total Revenue</span>
              <span className="history-stat-value highlight-green">
                ₹{stats.totalRevenue.toFixed(2)}
              </span>
            </div>
            <div className="history-stat-box">
              <span className="history-stat-label">💵 Cash Collected</span>
              <span className="history-stat-value">
                ₹{stats.cashRevenue.toFixed(2)}
              </span>
            </div>
            <div className="history-stat-box">
              <span className="history-stat-label">📱 UPI Collected</span>
              <span className="history-stat-value highlight-blue">
                ₹{stats.upiRevenue.toFixed(2)}
              </span>
            </div>
            <div className="history-stat-box">
              <span className="history-stat-label">🛍️ Parcel Revenue</span>
              <span className="history-stat-value highlight-orange">
                ₹{stats.parcelRevenue.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Filters & Search Toolbar */}
        <div className="history-filters-card">
          {/* Search Row */}
          <div className="history-search-row">
            <div className="history-search-box">
              <Search size={16} className="history-search-icon" />
              <input
                type="text"
                className="history-search-input"
                placeholder="Search by Table (e.g. 1, P-1), Dish name, or Customer phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="history-clear-search-btn"
                  onClick={() => setSearchQuery('')}
                  title="Clear search"
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Date Filter Pills */}
          <div className="history-chips-row">
            <span className="history-chip-label">Date:</span>
            <button
              type="button"
              className={`history-filter-pill ${dateFilter === 'today' ? 'active-green' : ''}`}
              onClick={() => setDateFilter('today')}
            >
              Today
            </button>
            <button
              type="button"
              className={`history-filter-pill ${dateFilter === 'yesterday' ? 'active' : ''}`}
              onClick={() => setDateFilter('yesterday')}
            >
              Yesterday
            </button>
            <button
              type="button"
              className={`history-filter-pill ${dateFilter === 'week' ? 'active' : ''}`}
              onClick={() => setDateFilter('week')}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              className={`history-filter-pill ${dateFilter === 'all' ? 'active' : ''}`}
              onClick={() => setDateFilter('all')}
            >
              All Time
            </button>
          </div>

          {/* Type & Payment Filter Row */}
          <div className="history-chips-row">
            <span className="history-chip-label">Type:</span>
            <button
              type="button"
              className={`history-filter-pill ${typeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setTypeFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`history-filter-pill ${typeFilter === 'dine-in' ? 'active-blue' : ''}`}
              onClick={() => setTypeFilter('dine-in')}
            >
              🍽️ Dine-In
            </button>
            <button
              type="button"
              className={`history-filter-pill ${typeFilter === 'takeaway' ? 'active-orange' : ''}`}
              onClick={() => setTypeFilter('takeaway')}
            >
              🛍️ Takeaway / Parcel
            </button>

            <span className="history-chip-label" style={{ marginLeft: '8px' }}>Payment:</span>
            <button
              type="button"
              className={`history-filter-pill ${paymentFilter === 'all' ? 'active' : ''}`}
              onClick={() => setPaymentFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`history-filter-pill ${paymentFilter === 'Cash' ? 'active-green' : ''}`}
              onClick={() => setPaymentFilter('Cash')}
            >
              💵 Cash
            </button>
            <button
              type="button"
              className={`history-filter-pill ${paymentFilter === 'UPI' ? 'active-blue' : ''}`}
              onClick={() => setPaymentFilter('UPI')}
            >
              📱 UPI
            </button>
          </div>
        </div>

        {/* Loading Indicator */}
        {loading ? (
          <div className="history-empty-state">
            <RefreshCw size={32} className="spin-animation" style={{ color: '#2563eb', margin: '0 auto 12px' }} />
            <p className="history-empty-title">Loading order history...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="history-empty-state">
            <div className="history-empty-icon">🧾</div>
            <h3 className="history-empty-title">No Orders Found</h3>
            <p className="history-empty-subtitle">
              {searchQuery || dateFilter !== 'all' || typeFilter !== 'all' || paymentFilter !== 'all'
                ? 'No completed orders match the selected filters. Try changing or resetting the filters.'
                : 'Completed bills will appear here automatically when orders are settled.'}
            </p>
            {(searchQuery || dateFilter !== 'all' || typeFilter !== 'all' || paymentFilter !== 'all') && (
              <button
                type="button"
                className="history-filter-pill active"
                onClick={() => {
                  setSearchQuery('');
                  setDateFilter('all');
                  setTypeFilter('all');
                  setPaymentFilter('all');
                }}
                style={{ marginTop: '1rem', display: 'inline-block' }}
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          /* Cards List (Natural flow with mobile safe padding) */
          <div className="history-cards-list">
            {filteredOrders.map((entry) => {
              const isParcel = String(entry.tableId).startsWith('P-') || entry.orderType === 'takeaway';
              const items = getConsolidatedItems(entry);
              const isExpanded = expandedCards.has(entry.id);
              const displayedItems = isExpanded ? items : items.slice(0, 3);
              const hasMoreItems = items.length > 3;

              const dineInSub = Number(entry.dineInSubtotal) || 0;
              const parcelSub = Number(entry.parcelSubtotal) || 0;
              const hasBothSubtotals = dineInSub > 0 && parcelSub > 0;

              // Build normalized receipt object for digital receipt & WhatsApp actions
              const cleanBillNo = formatBillNumber(entry.billNo || entry.id);
              const receiptData = {
                id: entry.id || entry.docId,
                docId: entry.docId || entry.id,
                billNo: cleanBillNo,
                tableId: entry.tableId,
                orderType: entry.orderType || (isParcel ? 'takeaway' : 'dine-in'),
                items,
                dineInSubtotal: dineInSub,
                parcelSubtotal: parcelSub,
                total: Number(entry.total) || 0,
                paymentMethod: entry.paymentMethod || 'Cash',
                timestamp: formatTimestamp(entry.timestamp)
              };

              const digitalReceiptUrl = getDigitalReceiptUrl(receiptData);

              return (
                <div key={entry.id || Math.random()} className="history-order-card">
                  {/* Card Header */}
                  <div className="history-card-header">
                    <div className="history-card-header-left">
                      <div className="history-card-badges">
                        <span className={`history-table-pill ${isParcel ? 'takeaway' : 'dine-in'}`}>
                          {isParcel ? (
                            <>
                              <ShoppingBag size={13} />
                              <span>Takeaway #{String(entry.tableId).replace('P-', '')}</span>
                            </>
                          ) : (
                            <>
                              <UtensilsCrossed size={13} />
                              <span>Table {entry.tableId}</span>
                            </>
                          )}
                        </span>

                        <span
                          className={`history-pay-badge ${
                            String(entry.paymentMethod).toLowerCase().includes('upi')
                              ? 'upi'
                              : String(entry.paymentMethod).toLowerCase().includes('card')
                              ? 'card'
                              : 'cash'
                          }`}
                        >
                          {String(entry.paymentMethod).toLowerCase().includes('upi') ? (
                            <Smartphone size={12} />
                          ) : (
                            <Banknote size={12} />
                          )}
                          <span>{entry.paymentMethod || 'Cash'}</span>
                        </span>

                        {entry.orderType === 'dine-in + parcel' && (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: '#ea580c',
                              background: '#fff7ed',
                              padding: '2px 7px',
                              borderRadius: '4px',
                              border: '1px solid #fed7aa'
                            }}
                          >
                            Dine + Pack
                          </span>
                        )}
                      </div>

                      <div className="history-card-time">
                        <Calendar size={13} />
                        <span>{formatTimestamp(entry.timestamp)}</span>
                      </div>
                    </div>

                    <div className="history-card-header-right">
                      <span className="history-card-total">
                        ₹{Number(entry.total || 0).toFixed(2)}
                      </span>
                      <span className="history-card-ref">
                        Ref: #{cleanBillNo}
                      </span>
                    </div>
                  </div>

                  {/* Sub-info Row: Subtotals & Customer Phone */}
                  {(hasBothSubtotals || entry.customerPhone) && (
                    <div className="history-card-subinfo">
                      {hasBothSubtotals ? (
                        <div className="history-subtotals-breakdown">
                          <span className="history-subtotal-item dine">
                            🍽️ Dine-In: ₹{dineInSub.toFixed(2)}
                          </span>
                          <span style={{ color: '#cbd5e1' }}>•</span>
                          <span className="history-subtotal-item parcel">
                            🛍️ Parcel: ₹{parcelSub.toFixed(2)}
                          </span>
                        </div>
                      ) : <div />}

                      {entry.customerPhone && (
                        <div className="history-customer-phone">
                          <Phone size={12} />
                          <span>{entry.customerPhone}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Itemized List */}
                  <div className="history-card-body">
                    <div className="history-items-header">
                      <span>Items Ordered ({items.length})</span>
                      <span>Total</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {displayedItems.map((item, idx) => (
                        <div key={item.id || idx} className="history-item-row-compact">
                          <div className="history-item-title-col">
                            <span className="history-item-name-text">{item.name}</span>
                            {item.isParcel && !isParcel && (
                              <span className="history-item-parcel-chip">🛍️ Pack</span>
                            )}
                          </div>
                          <span className="history-item-qty-col">×{item.quantity}</span>
                          <span className="history-item-amt-col">
                            ₹{(Number(item.price || 0) * Number(item.quantity || 0)).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {hasMoreItems && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(entry.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#2563eb',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          padding: '6px 0 0 0',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {isExpanded ? (
                          <>
                            <span>Show Less</span>
                            <ChevronUp size={14} />
                          </>
                        ) : (
                          <>
                            <span>Show {items.length - 3} more items</span>
                            <ChevronDown size={14} />
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Action Buttons Row */}
                  <div className="history-card-footer">
                    <button
                      type="button"
                      onClick={() => handleReopenOrder(entry)}
                      className="history-action-btn edit"
                      title="Reopen order to remove mistaken items and correct bill"
                    >
                      <RotateCcw size={14} />
                      <span>Reopen & Fix</span>
                    </button>

                    <a
                      href={digitalReceiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="history-action-btn primary"
                      title="Open full digital bill in new tab"
                    >
                      <ExternalLink size={14} />
                      <span>View Bill</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => openWhatsAppReceipt(receiptData, entry.customerPhone || '')}
                      className="history-action-btn whatsapp"
                      title="Send WhatsApp receipt to customer (includes Google Review link)"
                    >
                      <Share2 size={14} />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openWhatsAppReviewRequest(entry.customerPhone || '', null, items, isParcel)}
                      className="history-action-btn review"
                      title="Send Google Review invitation on WhatsApp"
                    >
                      <Star size={14} fill="#f59e0b" stroke="#d97706" />
                      <span>Ask Review</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        window.open(digitalReceiptUrl, '_blank');
                      }}
                      className="history-action-btn"
                      title="Print receipt"
                    >
                      <Printer size={14} />
                      <span>Print</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteHistory(entry)}
                      className="history-action-btn delete"
                      title="Delete this bill from history"
                    >
                      <Trash2 size={14} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(HistoryPage);
