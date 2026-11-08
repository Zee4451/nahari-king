import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useTableContext } from '../context/TableContext';
import { useMenu } from '../hooks/useMenu';
import { bulkUpdateMenuItems, subscribeToCategories } from '../services/firebaseService';
import CategoryIcon from './Common/CategoryIcon';
import {
  Lightbulb,
  Check,
  Plus,
  Minus,
  Trash2,
  UtensilsCrossed,
  IndianRupee,
  ChevronUp,
  X,
  Receipt,
  RotateCcw,
  Armchair,
  Printer,
  ShoppingBag,
  Package
} from 'lucide-react';
import KotPrintModal from './Tables/KotPrintModal';

// Smart category resolver & icon helpers
const getItemCategory = (item) => {
  if (!item) return 'Main Course';
  if (item.category && item.category.trim() !== '') {
    return item.category.trim();
  }
  const name = (item.name || '').toLowerCase();
  if (name.includes('nalli') || name.includes('nihari')) return 'Nalli Nihari';
  if (name.includes('roti') || name.includes('naan') || name.includes('kulcha') || name.includes('paratha')) return 'Roti';
  if (name.includes('biryani') || name.includes('rice') || name.includes('pulao')) return 'Biryani & Rice';
  if (name.includes('beverage') || name.includes('chai') || name.includes('tea') || name.includes('coke') || name.includes('drink') || name.includes('water') || name.includes('lassi') || name.includes('pepsi') || name.includes('soda')) return 'Beverages';
  if (name.includes('kabab') || name.includes('kebab') || name.includes('tikka') || name.includes('starter') || name.includes('fry')) return 'Starters';
  if (name.includes('dessert') || name.includes('kheer') || name.includes('halwa') || name.includes('sweet')) return 'Dessert';
  return 'Main Course';
};

const getCategoryIcon = (category) => {
  const cat = (category || '').toLowerCase();
  if (cat.includes('nihari') || cat.includes('nalli')) return '🍲';
  if (cat.includes('roti') || cat.includes('bread') || cat.includes('naan')) return '🫓';
  if (cat.includes('biryani') || cat.includes('rice')) return '🍚';
  if (cat.includes('beverage') || cat.includes('drink') || cat.includes('tea') || cat.includes('chai') || cat.includes('coke')) return '🥤';
  if (cat.includes('starter') || cat.includes('kebab') || cat.includes('tikka') || cat.includes('kabab')) return '🍢';
  if (cat.includes('dessert') || cat.includes('sweet') || cat.includes('kheer')) return '🍨';
  return '🍽️';
};

const parseItemId = (rawId) => {
  const isParcel = String(rawId).endsWith('_parcel');
  const baseId = isParcel ? String(rawId).slice(0, -7) : String(rawId);
  return { baseId, isParcel };
};

const makeItemId = (baseId, isParcel) => {
  const cleanBaseId = String(baseId).replace('_parcel', '');
  return isParcel ? `${cleanBaseId}_parcel` : cleanBaseId;
};

const DraggableMenuItem = ({
  menuItem,
  orderId,
  quantity,
  isParcelMode = false,
  otherModeQty = 0,
  index,
  onReorder,
  onQuantityChange,
  draggedIndex,
  setDraggedIndex,
  dragOverIndex,
  setDragOverIndex,
  draggedIndexRef
}) => {
  const isDragging = draggedIndex === index;
  const isDragOver = dragOverIndex === index;

  // HTML5 Drag Handlers (Desktop Mouse)
  const handleDragStart = (e) => {
    draggedIndexRef.current = index;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      if (dragOverIndex === index) {
        setDragOverIndex(null);
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    let fromIndex = draggedIndexRef.current;
    if (fromIndex === null || fromIndex === undefined) {
      const data = e.dataTransfer.getData('text/plain');
      if (data !== '') fromIndex = parseInt(data, 10);
    }

    setDraggedIndex(null);
    setDragOverIndex(null);
    draggedIndexRef.current = null;

    if (fromIndex !== null && !isNaN(fromIndex) && fromIndex !== index) {
      onReorder(fromIndex, index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    draggedIndexRef.current = null;
  };

  // Touch Support (Tablets, iPads, Mobile POS) with 300ms Hold-to-Drag
  const touchRef = useRef({ active: false, startX: 0, startY: 0, startIndex: null, isHolding: false });
  const holdTimeoutRef = useRef(null);

  const handleTouchStart = (e) => {
    if (e.target.closest('.item-controls')) return;
    const touch = e.touches[0];
    touchRef.current = {
      active: true,
      startX: touch.clientX,
      startY: touch.clientY,
      startIndex: index,
      isHolding: false
    };

    // User must hold for 300ms before drag activates.
    // This allows natural, fluid vertical scrolling with thumbs on mobile phones!
    holdTimeoutRef.current = setTimeout(() => {
      touchRef.current.isHolding = true;
      draggedIndexRef.current = index;
      setDraggedIndex(index);
      if (window.navigator?.vibrate) {
        window.navigator.vibrate(35);
      }
    }, 300);
  };

  const handleTouchMove = (e) => {
    if (!touchRef.current.active) return;
    const touch = e.touches[0];
    const diffX = Math.abs(touch.clientX - touchRef.current.startX);
    const diffY = Math.abs(touch.clientY - touchRef.current.startY);

    // If user moved thumb before 300ms hold triggered, they are scrolling the page!
    if (!touchRef.current.isHolding) {
      if (diffX > 8 || diffY > 8) {
        clearTimeout(holdTimeoutRef.current);
        touchRef.current.active = false;
      }
      return;
    }

    // Now in drag reorder mode
    if (e.cancelable) e.preventDefault();
    const elem = document.elementFromPoint(touch.clientX, touch.clientY);
    const card = elem?.closest('[data-pos-menu-index]');
    if (card) {
      const targetIndex = Number(card.getAttribute('data-pos-menu-index'));
      if (!isNaN(targetIndex) && targetIndex !== dragOverIndex) {
        setDragOverIndex(targetIndex);
      }
    }
  };

  const handleTouchEnd = () => {
    clearTimeout(holdTimeoutRef.current);
    if (touchRef.current.active && touchRef.current.isHolding) {
      const fromIndex = touchRef.current.startIndex;
      const toIndex = dragOverIndex;

      touchRef.current.active = false;
      touchRef.current.isHolding = false;
      setDraggedIndex(null);
      setDragOverIndex(null);
      draggedIndexRef.current = null;

      if (fromIndex !== null && toIndex !== null && fromIndex !== toIndex) {
        onReorder(fromIndex, toIndex);
      }
    } else {
      touchRef.current.active = false;
      touchRef.current.isHolding = false;
    }
  };

  return (
    <div
      data-pos-menu-index={index}
      draggable="true"
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={`menu-item-quantity draggable-menu-item ${isDragging ? 'is-dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
      title="Hold & drag to rearrange menu position"
    >
      <div className="menu-item-drag-handle" title="Hold & drag to rearrange">
        ⋮⋮
      </div>
      <div className="menu-item-info">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span className="item-name">{menuItem.name}</span>
          {isParcelMode && (
            <span className="card-parcel-indicator" title="Adding to takeaway parcel">🛍️ PACK</span>
          )}
          {otherModeQty > 0 && (
            <span
              className="card-other-qty-badge"
              title={isParcelMode ? `${otherModeQty} ordered for table dining` : `${otherModeQty} packed for home`}
            >
              {isParcelMode ? `🍽️ ${otherModeQty} at table` : `🛍️ ${otherModeQty} packed`}
            </span>
          )}
        </div>
        <span className="item-price">₹{menuItem.price}</span>
      </div>
      <div
        className="item-controls"
        draggable="false"
        onDragStart={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="quantity-btn minus"
          onClick={(e) => {
            e.stopPropagation();
            onQuantityChange(orderId, menuItem.id, Math.max(0, quantity - 1), isParcelMode);
          }}
          disabled={quantity === 0}
        >
          -
        </button>
        <span className="quantity">{quantity}</span>
        <button
          type="button"
          className="quantity-btn plus"
          onClick={(e) => {
            e.stopPropagation();
            onQuantityChange(orderId, menuItem.id, quantity + 1, isParcelMode);
          }}
        >
          +
        </button>
        <span className="item-total">₹{((Number(menuItem.price) || 0) * quantity).toFixed(2)}</span>
      </div>
    </div>
  );
};

// Order Menu Section with Category Pills and Accordion (No Search)
const OrderMenuSection = ({
  order,
  allOrders = [],
  items,
  punchDestination = 'dine-in',
  isParcelTable = false,
  activeOrderIndex = 'all',
  handleQuantityChange,
  handleReorder,
  showOrderSavedToast
}) => {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [layoutMode, setLayoutMode] = useState('tabs'); // 'tabs' or 'accordion'
  const [expandedCategories, setExpandedCategories] = useState({});
  const [configuredCategories, setConfiguredCategories] = useState([]);

  const isParcelMode = isParcelTable || punchDestination === 'parcel';

  const getItemCounts = useCallback((menuItemId) => {
    // 1. Calculate table totals across all rounds
    let tableDineQty = 0;
    let tableParcelQty = 0;

    (allOrders || []).forEach(ord => {
      (ord.items || []).forEach(it => {
        const { baseId, isParcel } = parseItemId(it.id);
        const targetBase = it.menuItemId || baseId;
        if (targetBase === menuItemId) {
          const qty = Number(it.quantity) || 0;
          if (isParcelTable || isParcel || !!it.isParcel) {
            tableParcelQty += qty;
          } else {
            tableDineQty += qty;
          }
        }
      });
    });

    // 2. Calculate quantity in currently active order round
    let roundDineQty = 0;
    let roundParcelQty = 0;

    (order?.items || []).forEach(it => {
      const { baseId, isParcel } = parseItemId(it.id);
      const targetBase = it.menuItemId || baseId;
      if (targetBase === menuItemId) {
        const qty = Number(it.quantity) || 0;
        if (isParcelTable || isParcel || !!it.isParcel) {
          roundParcelQty += qty;
        } else {
          roundDineQty += qty;
        }
      }
    });

    // If viewing All Items, activeQty is table total; if viewing specific round, activeQty is that round's qty
    const isViewingAll = activeOrderIndex === 'all';
    const activeQty = isParcelMode
      ? (isViewingAll ? tableParcelQty : roundParcelQty)
      : (isViewingAll ? tableDineQty : roundDineQty);

    const otherModeQty = isParcelMode ? tableDineQty : tableParcelQty;

    return {
      activeQty,
      otherModeQty,
      tableDineQty,
      tableParcelQty
    };
  }, [order, allOrders, isParcelMode, isParcelTable, activeOrderIndex]);

  useEffect(() => {
    const unsubscribe = subscribeToCategories((cats) => {
      setConfiguredCategories(cats || []);
    });
    return () => unsubscribe();
  }, []);

  // Compute all distinct categories: configured categories first, plus any categories in items
  const categories = useMemo(() => {
    const list = [];
    const seen = new Set();

    // 1. Configured categories from Settings in their sequence
    configuredCategories.forEach(c => {
      if (c && c.name && !seen.has(c.name)) {
        seen.add(c.name);
        list.push(c.name);
      }
    });

    // 2. Any additional categories found in menu items
    items.forEach(it => {
      const cat = getItemCategory(it);
      if (cat && !seen.has(cat)) {
        seen.add(cat);
        list.push(cat);
      }
    });

    return list;
  }, [configuredCategories, items]);

  const resolveCategoryIcon = useCallback((catName) => {
    const found = configuredCategories.find(c => (c.name || '').toLowerCase() === (catName || '').toLowerCase());
    if (found && found.icon) return found.icon;
    return getCategoryIcon(catName);
  }, [configuredCategories]);

  // Count items per category
  const categoryCounts = useMemo(() => {
    const map = {};
    items.forEach(it => {
      const cat = getItemCategory(it);
      map[cat] = (map[cat] || 0) + 1;
    });
    return map;
  }, [items]);

  // Count ordered items per category in this order
  const categoryOrderedCounts = useMemo(() => {
    const map = {};
    if (order && order.items) {
      order.items.forEach(ordItem => {
        const cat = getItemCategory(ordItem);
        map[cat] = (map[cat] || 0) + (ordItem.quantity || 0);
      });
    }
    return map;
  }, [order]);

  const totalOrderedItems = useMemo(() => {
    if (!order || !order.items) return 0;
    return order.items.reduce((sum, i) => sum + (i.quantity || 0), 0);
  }, [order]);

  // Drag states
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const draggedIndexRef = useRef(null);

  const toggleAccordion = (cat) => {
    setExpandedCategories(prev => ({
      ...prev,
      [cat]: prev[cat] === undefined ? false : !prev[cat]
    }));
  };

  // Filtered items for Tabs mode
  const filteredItems = useMemo(() => {
    return items.filter(it => {
      const cat = getItemCategory(it);
      return selectedCategory === 'ALL' || cat === selectedCategory;
    });
  }, [items, selectedCategory]);

  return (
    <div className="order-items">
      {/* Category Nav & Controls */}
      <div className="category-nav-wrapper">
        <div className="category-nav-top-row">
          <div className="category-section-heading">
            <span style={{ fontWeight: 600, fontSize: '0.88rem', color: '#475569' }}>
              Categories:
            </span>
          </div>

          <div className="category-view-toggle">
            <button
              type="button"
              className={`category-view-btn ${layoutMode === 'tabs' ? 'active' : ''}`}
              onClick={() => setLayoutMode('tabs')}
              title="Show one category at a time"
            >
              📂 Category Tabs
            </button>
            <button
              type="button"
              className={`category-view-btn ${layoutMode === 'accordion' ? 'active' : ''}`}
              onClick={() => setLayoutMode('accordion')}
              title="Show all categories as collapsible folders"
            >
              📑 All Folders
            </button>
          </div>
        </div>

        {/* Horizontal Category Pills */}
        <div className="category-pills-row">
          <button
            type="button"
            className={`category-chip ${selectedCategory === 'ALL' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('ALL')}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><CategoryIcon name="all" size={16} /> All</span>
            <span className="category-chip-count">{items.length}</span>
            {totalOrderedItems > 0 && (
              <span className="category-chip-ordered">{totalOrderedItems} in order</span>
            )}
          </button>

          {categories.map((cat) => {
            const count = categoryCounts[cat] || 0;
            const orderedCount = categoryOrderedCounts[cat] || 0;
            const isSelected = selectedCategory === cat;

            return (
              <button
                key={cat}
                type="button"
                className={`category-chip ${isSelected ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><CategoryIcon name={cat} size={16} /> {cat}</span>
                <span className="category-chip-count">{count}</span>
                {orderedCount > 0 && (
                  <span className="category-chip-ordered">{orderedCount} in order</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="menu-reorder-banner">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Lightbulb size={16} style={{ color: '#eab308', flexShrink: 0 }} /> <span><strong>Tip:</strong> Hold & drag (पकड़कर खिसकाएं) any item to customize the menu arrangement</span></span>
        {showOrderSavedToast && <span className="menu-reorder-saved" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Check size={14} /> Menu arrangement saved</span>}
      </div>

      {layoutMode === 'tabs' ? (
        /* Tabs View: Display items for selected category */
        <div>
          <div className="category-section-title">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <CategoryIcon name={selectedCategory} size={18} showBadge badgeSize={30} />
              <span>{selectedCategory === 'ALL' ? 'All Items' : selectedCategory} ({filteredItems.length} items)</span>
            </span>
            {selectedCategory !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedCategory('ALL')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#007bff',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  textDecoration: 'underline'
                }}
              >
                View all categories
              </button>
            )}
          </div>

          {filteredItems.length === 0 ? (
            <div className="empty-category-notice">
              No items found in this category.
            </div>
          ) : (
            <div className="menu-items-grid">
              {filteredItems.map((menuItem) => {
                const masterIndex = items.findIndex(it => it.id === menuItem.id);
                const { activeQty, otherModeQty } = getItemCounts(menuItem.id);

                return (
                  <DraggableMenuItem
                    key={menuItem.id}
                    menuItem={menuItem}
                    orderId={order.id}
                    quantity={activeQty}
                    isParcelMode={isParcelMode}
                    otherModeQty={otherModeQty}
                    index={masterIndex}
                    onReorder={handleReorder}
                    onQuantityChange={handleQuantityChange}
                    draggedIndex={draggedIndex}
                    setDraggedIndex={setDraggedIndex}
                    dragOverIndex={dragOverIndex}
                    setDragOverIndex={setDragOverIndex}
                    draggedIndexRef={draggedIndexRef}
                  />
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Accordion Mode: Expandable folders per category */
        <div>
          {categories.map((cat) => {
            const catItems = items.filter(it => getItemCategory(it) === cat);
            if (catItems.length === 0) return null;

            const isExpanded = expandedCategories[cat] !== false; // default open
            const orderedCount = categoryOrderedCounts[cat] || 0;

            return (
              <div key={cat} className="category-accordion-box">
                <div
                  className="category-accordion-header"
                  onClick={() => toggleAccordion(cat)}
                >
                  <div className="category-accordion-title">
                    <span>{resolveCategoryIcon(cat)}</span>
                    <span>{cat}</span>
                    <span className="category-chip-count">{catItems.length} items</span>
                  </div>
                  <div className="category-accordion-right">
                    {orderedCount > 0 && (
                      <span className="category-chip-ordered">{orderedCount} in order</span>
                    )}
                    <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="category-accordion-body">
                    <div className="menu-items-grid">
                      {catItems.map((menuItem) => {
                        const masterIndex = items.findIndex(it => it.id === menuItem.id);
                        const { activeQty, otherModeQty } = getItemCounts(menuItem.id);

                        return (
                          <DraggableMenuItem
                            key={menuItem.id}
                            menuItem={menuItem}
                            orderId={order.id}
                            quantity={activeQty}
                            isParcelMode={isParcelMode}
                            otherModeQty={otherModeQty}
                            index={masterIndex}
                            onReorder={handleReorder}
                            onQuantityChange={handleQuantityChange}
                            draggedIndex={draggedIndex}
                            setDraggedIndex={setDraggedIndex}
                            dragOverIndex={dragOverIndex}
                            setDragOverIndex={setDragOverIndex}
                            draggedIndexRef={draggedIndexRef}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const TableSection = () => {
  // Consume Contexts
  const {
    tables,
    currentTable,
    setCurrentTable,
    addOrderToTable,
    addItemToOrder,
    updateItemQuantity,
    removeOrder,
    addNewTable,
    deleteTable,
    addNewParcelOrder,
    toggleItemParcel,
    initiateCheckoutOrder,
    initiateCheckoutTable
  } = useTableContext();

  const { menuItems } = useMenu();

  // Local state for immediate, responsive reordering
  const [items, setItems] = useState([]);
  const [showOrderSavedToast, setShowOrderSavedToast] = useState(false);
  const isSavingRef = useRef(false);

  // Sync with Firestore menuItems ONLY when not saving our own reorder
  useEffect(() => {
    if (menuItems && menuItems.length > 0 && !isSavingRef.current) {
      setItems(menuItems);
    }
  }, [menuItems]);

  const handleReorder = useCallback(async (fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex === null || toIndex === null) return;

    setItems((prevItems) => {
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= prevItems.length || toIndex >= prevItems.length) {
        return prevItems;
      }
      const updated = [...prevItems];
      const [movedItem] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, movedItem);

      const withNewSeq = updated.map((item, idx) => ({
        ...item,
        sequence: idx + 1
      }));

      // Lock snapshot sync so Firestore roundtrip doesn't overwrite UI
      isSavingRef.current = true;

      bulkUpdateMenuItems(withNewSeq)
        .then(() => {
          setTimeout(() => {
            isSavingRef.current = false;
          }, 1500);
        })
        .catch((err) => {
          console.error('Error saving reordered menu:', err);
          isSavingRef.current = false;
        });

      return withNewSeq;
    });

    setShowOrderSavedToast(true);
    setTimeout(() => setShowOrderSavedToast(false), 2000);
  }, []);

  const currentTableData = tables[currentTable] || {
    id: currentTable,
    orders: [],
    total: 0
  };

  // Active bill view: 'all' for consolidated running bill, or 0, 1, 2... for specific round
  const [activeOrderIndex, setActiveOrderIndex] = useState('all');
  // State for mobile slide-up bill drawer
  const [isMobileBillOpen, setIsMobileBillOpen] = useState(false);
  // State for Kitchen Order Ticket (KOT) modal
  const [isKotModalOpen, setIsKotModalOpen] = useState(false);

  // Keep activeOrderIndex within bounds when table or orders change
  useEffect(() => {
    if (activeOrderIndex !== 'all') {
      if (currentTableData.orders.length > 0) {
        if (Number(activeOrderIndex) >= currentTableData.orders.length) {
          setActiveOrderIndex('all');
        }
      } else {
        setActiveOrderIndex('all');
      }
    }
  }, [currentTable, currentTableData.orders.length, activeOrderIndex]);

  const effectiveActiveOrder = useMemo(() => {
    if (activeOrderIndex === 'all') {
      const orders = currentTableData.orders || [];
      return orders[orders.length - 1] || orders[0] || { id: 'temp', items: [], total: 0 };
    }
    const idx = Number(activeOrderIndex);
    return currentTableData.orders[idx] || currentTableData.orders[0] || { id: 'temp', items: [], total: 0 };
  }, [currentTableData.orders, activeOrderIndex]);

  // Punch destination: 'dine-in' (eat at table) or 'parcel' (pack for home)
  const [punchDestination, setPunchDestination] = useState('dine-in');

  // Consolidated items for the entire table (combining all order rounds, grouped by menuItem + parcel status)
  const consolidatedTableItems = useMemo(() => {
    const itemMap = new Map();
    if (!currentTableData.orders) return [];

    currentTableData.orders.forEach((order, roundIdx) => {
      if (Array.isArray(order.items)) {
        order.items.forEach((item) => {
          if ((item.quantity || 0) > 0) {
            const isItemParcel = !!item.isParcel || String(item.id).endsWith('_parcel');
            const baseItemId = String(item.id).replace('_parcel', '');
            const key = `${baseItemId}_${isItemParcel ? 'parcel' : 'dinein'}`;

            if (itemMap.has(key)) {
              const existing = itemMap.get(key);
              existing.quantity += item.quantity;
              existing.total += item.price * item.quantity;
              existing.roundSources.push({ orderId: order.id, roundIdx: roundIdx + 1, qty: item.quantity });
            } else {
              itemMap.set(key, {
                ...item,
                baseId: baseItemId,
                isParcel: isItemParcel,
                key,
                total: item.price * item.quantity,
                roundSources: [{ orderId: order.id, roundIdx: roundIdx + 1, qty: item.quantity }]
              });
            }
          }
        });
      }
    });

    return Array.from(itemMap.values());
  }, [currentTableData.orders]);

  const dineInItems = useMemo(() => {
    return consolidatedTableItems.filter(it => !it.isParcel);
  }, [consolidatedTableItems]);

  const parcelItems = useMemo(() => {
    return consolidatedTableItems.filter(it => it.isParcel);
  }, [consolidatedTableItems]);

  const dineInSubtotal = useMemo(() => {
    return dineInItems.reduce((s, it) => s + (it.price * it.quantity), 0);
  }, [dineInItems]);

  const parcelSubtotal = useMemo(() => {
    return parcelItems.reduce((s, it) => s + (it.price * it.quantity), 0);
  }, [parcelItems]);

  const totalTableItemsCount = useMemo(() => {
    return consolidatedTableItems.reduce((s, it) => s + (it.quantity || 0), 0);
  }, [consolidatedTableItems]);

  const handleConsolidatedQuantityChange = useCallback((itemId, newQuantity) => {
    if (newQuantity <= 0) {
      currentTableData.orders.forEach(ord => {
        if (ord.items && ord.items.some(it => it.id === itemId)) {
          updateItemQuantity(currentTable, ord.id, itemId, 0);
        }
      });
      return;
    }

    const consolidated = consolidatedTableItems.find(it => it.id === itemId || it.key === itemId);
    const currentQty = consolidated ? consolidated.quantity : 0;
    const diff = newQuantity - currentQty;

    if (diff > 0) {
      const baseId = String(itemId).replace('_parcel', '');
      const activeItems = items.length > 0 ? items : menuItems;
      const menuItem = activeItems.find(it => it.id === baseId);
      if (!menuItem) return;

      const isParcelItem = String(itemId).endsWith('_parcel');
      const targetItemId = isParcelItem ? `${baseId}_parcel` : baseId;

      const existingInOrder = effectiveActiveOrder.items?.find(it => it.id === targetItemId);

      if (!existingInOrder) {
        const itemToInsert = {
          ...menuItem,
          id: targetItemId,
          menuItemId: baseId,
          isParcel: isParcelItem,
          price: Number(menuItem.price) || 0
        };
        addItemToOrder(currentTable, effectiveActiveOrder.id, itemToInsert);
        if (diff > 1) {
          updateItemQuantity(currentTable, effectiveActiveOrder.id, targetItemId, diff);
        }
      } else {
        updateItemQuantity(currentTable, effectiveActiveOrder.id, targetItemId, (existingInOrder.quantity || 0) + diff);
      }
    } else if (diff < 0) {
      const orderWithItem = [...(currentTableData.orders || [])].reverse().find(ord =>
        ord.items && ord.items.some(it => it.id === itemId && it.quantity > 0)
      );
      if (orderWithItem) {
        const itemInOrd = orderWithItem.items.find(it => it.id === itemId);
        const newOrdQty = Math.max(0, (itemInOrd.quantity || 0) + diff);
        updateItemQuantity(currentTable, orderWithItem.id, itemId, newOrdQty);
      }
    }
  }, [currentTableData.orders, consolidatedTableItems, items, menuItems, effectiveActiveOrder, currentTable, updateItemQuantity, addItemToOrder]);

  const moveItemBetweenDineInAndParcel = useCallback((itemId) => {
    const isCurrentlyParcel = String(itemId).endsWith('_parcel');
    const baseId = String(itemId).replace('_parcel', '');

    const activeItems = items.length > 0 ? items : menuItems;
    const menuItem = activeItems.find(it => it.id === baseId);
    if (!menuItem) return;

    let sourceOrder = null;
    let sourceItem = null;

    for (const ord of currentTableData.orders || []) {
      const it = (ord.items || []).find(i => i.id === itemId && i.quantity > 0);
      if (it) {
        sourceOrder = ord;
        sourceItem = it;
        break;
      }
    }

    if (!sourceOrder || !sourceItem) return;

    // Reduce by 1 from source
    updateItemQuantity(currentTable, sourceOrder.id, itemId, sourceItem.quantity - 1);

    // Add 1 to target
    const targetItemId = isCurrentlyParcel ? baseId : `${baseId}_parcel`;
    const targetItemInOrder = (sourceOrder.items || []).find(i => i.id === targetItemId);

    if (!targetItemInOrder) {
      const itemToInsert = {
        ...menuItem,
        id: targetItemId,
        menuItemId: baseId,
        isParcel: !isCurrentlyParcel,
        price: Number(menuItem.price) || 0
      };
      addItemToOrder(currentTable, sourceOrder.id, itemToInsert);
    } else {
      updateItemQuantity(currentTable, sourceOrder.id, targetItemId, (targetItemInOrder.quantity || 0) + 1);
    }
  }, [currentTableData.orders, items, menuItems, currentTable, updateItemQuantity, addItemToOrder]);

  // Ensure table has at least 1 order round without race conditions
  useEffect(() => {
    if (currentTableData.orders.length === 0) {
      addOrderToTable(currentTable);
    }
  }, [currentTable, currentTableData.orders.length, addOrderToTable]);

  const handleAddOrder = useCallback(() => {
    addOrderToTable(currentTable);
  }, [addOrderToTable, currentTable]);

  const handleQuantityChange = useCallback((orderId, rawItemId, newQuantity, explicitParcel) => {
    const { baseId, isParcel: rawIsParcel } = parseItemId(rawItemId);
    const activeItems = items.length > 0 ? items : menuItems;
    const menuItem = activeItems.find(item => item.id === baseId);
    if (!menuItem) return;

    const table = tables[currentTable];
    if (!table) return;
    const order = (table.orders || []).find(ord => ord.id === orderId);
    if (!order) return;

    const isParcelTable = isParcelId(currentTable);
    const isTargetParcel = explicitParcel !== undefined
      ? !!explicitParcel
      : (rawIsParcel || isParcelTable || punchDestination === 'parcel');

    const targetItemId = makeItemId(baseId, isTargetParcel);
    const existingItem = (order.items || []).find(item => {
      if (item.id === targetItemId || item.id === rawItemId) return true;
      if (isParcelTable) {
        const { baseId: itBase } = parseItemId(item.id);
        return itBase === baseId || item.menuItemId === baseId;
      }
      return false;
    });

    const itemIdToUpdate = existingItem ? existingItem.id : targetItemId;

    if (newQuantity <= 0) {
      if (existingItem) updateItemQuantity(currentTable, orderId, itemIdToUpdate, 0);
      return;
    }

    if (!existingItem) {
      const itemToInsert = {
        ...menuItem,
        id: targetItemId,
        menuItemId: baseId,
        isParcel: isTargetParcel,
        price: Number(menuItem.price) || 0
      };
      addItemToOrder(currentTable, orderId, itemToInsert);
      if (newQuantity > 1) {
        updateItemQuantity(currentTable, orderId, targetItemId, newQuantity);
      }
    } else {
      updateItemQuantity(currentTable, orderId, itemIdToUpdate, newQuantity);
    }
  }, [items, menuItems, tables, currentTable, punchDestination, updateItemQuantity, addItemToOrder]);

  // Use Context `initiateCheckoutOrder` so the Checkout Modal handles the rest
  const handleClearOrder = (orderId) => {
    initiateCheckoutOrder(currentTable, orderId);
  };

  const handleRemoveOrder = (orderId) => {
    if (window.confirm('Are you sure you want to remove this order?')) {
      removeOrder(currentTable, orderId);
    }
  };

  const handleClearTable = () => {
    initiateCheckoutTable(currentTable);
  };

  const handleTableSwitch = (tableId) => {
    setCurrentTable(tableId);
    const table = tables[tableId];
    if (table && table.orders.length === 0) {
      addOrderToTable(tableId);
    }
  };

  const isParcelId = useCallback((id) => {
    return String(id).startsWith('P-') || String(id).toLowerCase().startsWith('parcel');
  }, []);

  // Dine-in table IDs sorted numerically
  const dineInTableIds = useMemo(() => {
    return Object.keys(tables)
      .filter(id => !isParcelId(id))
      .map(Number)
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b);
  }, [tables, isParcelId]);

  // Takeaway / Parcel order IDs sorted by parcel index
  const parcelOrderIds = useMemo(() => {
    return Object.keys(tables)
      .filter(id => isParcelId(id))
      .sort((a, b) => {
        const numA = Number(String(a).replace(/\D/g, '')) || 0;
        const numB = Number(String(b).replace(/\D/g, '')) || 0;
        return numA - numB;
      });
  }, [tables, isParcelId]);

  const [serviceMode, setServiceMode] = useState(() => {
    return isParcelId(currentTable) ? 'takeaway' : 'dine-in';
  });

  // Synchronize serviceMode if currentTable changes externally
  useEffect(() => {
    if (isParcelId(currentTable) && serviceMode !== 'takeaway') {
      setServiceMode('takeaway');
    } else if (!isParcelId(currentTable) && serviceMode !== 'dine-in') {
      setServiceMode('dine-in');
    }
  }, [currentTable, isParcelId, serviceMode]);

  const handleServiceModeChange = async (mode) => {
    setServiceMode(mode);
    if (mode === 'dine-in') {
      if (isParcelId(currentTable)) {
        const firstDine = dineInTableIds[0] || 1;
        handleTableSwitch(firstDine);
      }
    } else {
      if (!isParcelId(currentTable)) {
        if (parcelOrderIds.length > 0) {
          handleTableSwitch(parcelOrderIds[0]);
        } else if (addNewParcelOrder) {
          const newId = await addNewParcelOrder();
          handleTableSwitch(newId);
        }
      }
    }
  };

  // Accurate table occupancy, item count and live total helper
  const tableStatsMap = useMemo(() => {
    const map = {};
    Object.keys(tables || {}).forEach(id => {
      const table = tables[id];
      if (!table) return;
      const total = Number(table.total) || 0;
      let itemCount = 0;
      let hasParcel = false;
      if (Array.isArray(table.orders)) {
        table.orders.forEach(order => {
          if (Array.isArray(order.items)) {
            order.items.forEach(it => {
              const qty = Number(it.quantity) || 0;
              itemCount += qty;
              if (qty > 0 && (it.isParcel || String(it.id).endsWith('_parcel'))) {
                hasParcel = true;
              }
            });
          }
        });
      }
      map[id] = { isOccupied: total > 0 || itemCount > 0, total, itemCount, hasParcel };
    });
    return map;
  }, [tables]);

  const getTableOccupiedInfo = useCallback((tableId) => {
    return tableStatsMap[tableId] || { isOccupied: false, total: 0, itemCount: 0, hasParcel: false };
  }, [tableStatsMap]);

  // Dine-In summary
  const dineInSummary = useMemo(() => {
    let availableCount = 0;
    let occupiedCount = 0;
    let liveRevenue = 0;

    dineInTableIds.forEach(id => {
      const { isOccupied, total } = getTableOccupiedInfo(id);
      if (isOccupied) {
        occupiedCount++;
        liveRevenue += total;
      } else {
        availableCount++;
      }
    });

    return {
      total: dineInTableIds.length,
      availableCount,
      occupiedCount,
      liveRevenue
    };
  }, [dineInTableIds, getTableOccupiedInfo]);

  // Takeaway summary
  const takeawaySummary = useMemo(() => {
    let activeCount = 0;
    let liveRevenue = 0;

    parcelOrderIds.forEach(id => {
      const { isOccupied, total } = getTableOccupiedInfo(id);
      if (isOccupied) {
        activeCount++;
      }
      liveRevenue += total;
    });

    return {
      total: parcelOrderIds.length,
      activeCount,
      liveRevenue
    };
  }, [parcelOrderIds, getTableOccupiedInfo]);

  const currentTableOccupied = useMemo(() => {
    return getTableOccupiedInfo(currentTable);
  }, [currentTable, getTableOccupiedInfo]);

  const displayedItems = items.length > 0 ? items : menuItems;

  return (
    <div className="table-section">
      {/* Modern Table Switcher Bar */}
      <div className="table-switcher">
        {/* Mode Toggle: Dine-In vs Takeaway / Parcel */}
        <div className="pos-mode-toggle-container">
          <div className="pos-mode-toggle-group">
            <button
              type="button"
              className={`pos-mode-pill-btn ${serviceMode === 'dine-in' ? 'active' : ''}`}
              onClick={() => handleServiceModeChange('dine-in')}
            >
              <UtensilsCrossed size={16} strokeWidth={2.4} />
              <span>Dine-In Tables</span>
              <span className="mode-pill-count">{dineInSummary.total}</span>
            </button>

            <button
              type="button"
              className={`pos-mode-pill-btn ${serviceMode === 'takeaway' ? 'active' : ''}`}
              onClick={() => handleServiceModeChange('takeaway')}
            >
              <ShoppingBag size={16} strokeWidth={2.4} />
              <span>Takeaway / Parcel</span>
              {takeawaySummary.activeCount > 0 ? (
                <span className="mode-pill-count parcel-live-count">{takeawaySummary.activeCount} Active</span>
              ) : (
                <span className="mode-pill-count">{parcelOrderIds.length}</span>
              )}
            </button>
          </div>

          {serviceMode === 'takeaway' && (
            <button
              type="button"
              className="pos-btn-new-parcel"
              onClick={async () => {
                if (addNewParcelOrder) {
                  const newId = await addNewParcelOrder();
                  handleTableSwitch(newId);
                }
              }}
              title="Create a new takeaway / parcel order"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>+ New Parcel Order</span>
            </button>
          )}
        </div>

        {/* Dynamic Status Strip */}
        <div className="table-switcher-summary-strip">
          {serviceMode === 'dine-in' ? (
            <>
              <div className="summary-strip-left">
                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                  Dining Tables ({dineInSummary.total})
                </span>
                <span className="summary-strip-badge avail">
                  <span className="pos-table-dot dot-available" /> {dineInSummary.availableCount} Available
                </span>
                <span className="summary-strip-badge occ">
                  <span className="pos-table-dot dot-occupied" /> {dineInSummary.occupiedCount} Occupied
                </span>
              </div>
              {dineInSummary.liveRevenue > 0 && (
                <div style={{ fontWeight: 700, color: '#dc2626', fontSize: '0.85rem' }}>
                  Live Dine-In: ₹{dineInSummary.liveRevenue.toLocaleString('en-IN')}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="summary-strip-left">
                <span style={{ fontWeight: 700, color: '#0f172a' }}>
                  Takeaway / Parcel Orders ({takeawaySummary.total})
                </span>
                <span className="summary-strip-badge occ" style={{ background: '#fff7ed', color: '#c2410c', borderColor: '#fed7aa' }}>
                  <ShoppingBag size={13} /> {takeawaySummary.activeCount} In Preparation
                </span>
              </div>
              {takeawaySummary.liveRevenue > 0 && (
                <div style={{ fontWeight: 700, color: '#ea580c', fontSize: '0.85rem' }}>
                  Live Takeaway: ₹{takeawaySummary.liveRevenue.toLocaleString('en-IN')}
                </div>
              )}
            </>
          )}
        </div>

        {/* Horizontal Scrollable Table Cards */}
        <div className="table-switcher-controls">
          <div className="table-buttons-container">
            <div className="table-buttons">
              {serviceMode === 'dine-in' ? (
                <>
                  {dineInTableIds.map(tableId => {
                    const { isOccupied, total, itemCount, hasParcel } = getTableOccupiedInfo(tableId);
                    const isCurrent = currentTable === tableId;

                    let cardClass = 'pos-table-card';
                    if (isCurrent) {
                      cardClass += isOccupied ? ' status-current-occupied' : ' status-current-available';
                    } else if (isOccupied) {
                      cardClass += ' status-occupied';
                    } else {
                      cardClass += ' status-available';
                    }

                    return (
                      <button
                        key={tableId}
                        type="button"
                        className={cardClass}
                        onClick={() => handleTableSwitch(tableId)}
                        title={`Table ${tableId}: ${isOccupied ? `Occupied (₹${total.toFixed(0)}, ${itemCount} items)` : 'Available'}`}
                      >
                        <div className="pos-table-top">
                          <span className="pos-table-name">
                            T-{tableId}
                            {hasParcel && <span className="pos-table-parcel-pill" title="Has packed parcel items">🛍️</span>}
                          </span>
                          <span className={`pos-table-dot ${isOccupied ? 'dot-occupied' : 'dot-available'}`} />
                        </div>
                        <div className="pos-table-bottom">
                          {isOccupied ? (
                            <span className="pos-table-amount">₹{total > 0 ? total.toFixed(0) : '0'}</span>
                          ) : (
                            <span className="pos-table-vacant">Free</span>
                          )}
                        </div>
                      </button>
                    );
                  })}

                  {/* Quick Add Table Button */}
                  {addNewTable && (
                    <button
                      type="button"
                      className="pos-table-card pos-table-add-card"
                      onClick={async () => {
                        try {
                          const createdId = await addNewTable();
                          handleTableSwitch(createdId);
                        } catch (err) {
                          console.error('Failed to add table:', err);
                        }
                      }}
                      title="Add Table (Fills missing gaps e.g. Table 1)"
                    >
                      <div className="pos-table-top" style={{ justifyContent: 'center' }}>
                        <Plus size={16} strokeWidth={2.5} style={{ color: '#2563eb' }} />
                      </div>
                      <div className="pos-table-bottom" style={{ justifyContent: 'center' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#2563eb' }}>+ Table</span>
                      </div>
                    </button>
                  )}
                </>
              ) : (
                <>
                  {parcelOrderIds.map(parcelId => {
                    const { isOccupied, total, itemCount } = getTableOccupiedInfo(parcelId);
                    const isCurrent = currentTable === parcelId;

                    let cardClass = 'pos-table-card pos-parcel-card';
                    if (isCurrent) {
                      cardClass += ' status-current-parcel';
                    } else if (isOccupied) {
                      cardClass += ' status-active-parcel';
                    } else {
                      cardClass += ' status-empty-parcel';
                    }

                    return (
                      <button
                        key={parcelId}
                        type="button"
                        className={cardClass}
                        onClick={() => handleTableSwitch(parcelId)}
                        title={`Parcel ${parcelId}: ${isOccupied ? `Active (₹${total.toFixed(0)}, ${itemCount} items)` : 'Empty'}`}
                      >
                        <div className="pos-table-top">
                          <span className="pos-table-name">
                            <ShoppingBag size={13} style={{ marginRight: '3px' }} />
                            {parcelId}
                          </span>
                          <span className={`pos-table-dot ${isOccupied ? 'dot-occupied' : 'dot-available'}`} />
                        </div>
                        <div className="pos-table-bottom">
                          {isOccupied ? (
                            <span className="pos-table-amount">₹{total > 0 ? total.toFixed(0) : '0'}</span>
                          ) : (
                            <span className="pos-table-vacant">New</span>
                          )}
                        </div>
                      </button>
                    );
                  })}

                  {/* Add New Parcel Order Card */}
                  {addNewParcelOrder && (
                    <button
                      type="button"
                      className="pos-table-card pos-table-add-card pos-parcel-add-card"
                      onClick={async () => {
                        const newId = await addNewParcelOrder();
                        handleTableSwitch(newId);
                      }}
                      title="Create next Parcel / Takeaway order"
                    >
                      <div className="pos-table-top" style={{ justifyContent: 'center' }}>
                        <Plus size={16} strokeWidth={2.5} style={{ color: '#ea580c' }} />
                      </div>
                      <div className="pos-table-bottom" style={{ justifyContent: 'center' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ea580c' }}>+ Parcel</span>
                      </div>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="current-table-info">
        <div className="table-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h2>{isParcelId(currentTable) ? `Takeaway ${currentTable}` : `Table ${currentTable}`}</h2>
            {isParcelId(currentTable) ? (
              <span className="status-badge-chip occupied" style={{ background: '#fff7ed', color: '#c2410c', borderColor: '#fed7aa' }}>
                <ShoppingBag size={12} /> Takeaway / Parcel
              </span>
            ) : currentTableOccupied.isOccupied ? (
              <span className="status-badge-chip occupied">
                <span className="pos-table-dot dot-occupied" /> Occupied
              </span>
            ) : (
              <span className="status-badge-chip available">
                <span className="pos-table-dot dot-available" /> Available
              </span>
            )}
          </div>
          <div className="table-stats">
            <div className="stat-item">
              <span className="stat-label">Dishes:</span>
              <span className="stat-value">{currentTableOccupied.itemCount} items</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Running Total:</span>
              <span className="stat-value total-amount">₹{currentTableData.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          MODERN SPLIT POS WORKSPACE:
          LEFT: Food Menu Catalog (Rendered ONCE)
          RIGHT: Live Order Bill Cart (Sticky Sidebar)
          ======================================================== */}
      <div className="pos-workspace-grid">

        {/* 1. LEFT COLUMN: Menu Catalog (Single Instance) */}
        <div className="pos-menu-column">
          <OrderMenuSection
            order={effectiveActiveOrder}
            allOrders={currentTableData.orders}
            items={displayedItems}
            punchDestination={punchDestination}
            isParcelTable={isParcelId(currentTable)}
            activeOrderIndex={activeOrderIndex}
            handleQuantityChange={handleQuantityChange}
            handleReorder={handleReorder}
            showOrderSavedToast={showOrderSavedToast}
          />
        </div>

        {/* 2. RIGHT COLUMN: Live Table Bill Cart (Sticky Panel / Drawer) */}
        <div className={`pos-bill-column ${isMobileBillOpen ? 'mobile-drawer-open' : ''}`}>
          {isMobileBillOpen && (
            <div
              className="mobile-bill-backdrop"
              onClick={() => setIsMobileBillOpen(false)}
            />
          )}

          <div className="bill-card">
            {/* Bill Slip Header */}
            <div className="bill-header">
              <div className="bill-title-row">
                <div className="bill-table-badge">
                  {isParcelId(currentTable) ? (
                    <>
                      <ShoppingBag size={19} strokeWidth={2.4} style={{ color: '#ea580c' }} />
                      <span>Takeaway {currentTable} — Parcel Bill</span>
                    </>
                  ) : (
                    <>
                      <Armchair size={19} strokeWidth={2.4} style={{ color: '#2563eb' }} />
                      <span>Table {currentTable} — Running Bill</span>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className={`status-badge-chip ${currentTableOccupied.isOccupied ? 'occupied' : 'available'}`}>
                    <span className={`pos-table-dot ${currentTableOccupied.isOccupied ? 'dot-occupied' : 'dot-available'}`} />
                    {currentTableOccupied.isOccupied ? 'Occupied' : 'Free'}
                  </span>
                  {isMobileBillOpen && (
                    <button
                      type="button"
                      className="bill-close-drawer-btn"
                      onClick={() => setIsMobileBillOpen(false)}
                      title="Close Bill"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              </div>

              {/* Order Round Selector Tabs */}
              <div className="bill-rounds-tabs">
                <button
                  type="button"
                  className={`bill-round-tab ${activeOrderIndex === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveOrderIndex('all')}
                  title="View all ordered dishes across all rounds"
                >
                  <span>All Items</span>
                  <span className="round-pill-amt">{totalTableItemsCount}</span>
                </button>

                {currentTableData.orders.map((ord, idx) => {
                  const isSelected = activeOrderIndex === idx;

                  return (
                    <button
                      key={ord.id || idx}
                      type="button"
                      className={`bill-round-tab ${isSelected ? 'active' : ''}`}
                      onClick={() => setActiveOrderIndex(idx)}
                    >
                      <span>Round {idx + 1}</span>
                      {ord.total > 0 ? (
                        <span className="round-pill-amt">₹{ord.total.toFixed(0)}</span>
                      ) : (
                        <span className="round-pill-empty">0</span>
                      )}
                      {currentTableData.orders.length > 1 && ord.total === 0 && (
                        <span
                          className="round-tab-close"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveOrder(ord.id);
                          }}
                          title="Remove empty round"
                        >
                          ×
                        </span>
                      )}
                    </button>
                  );
                })}

                <button
                  type="button"
                  className="bill-add-round-btn"
                  onClick={async () => {
                    await handleAddOrder();
                    setActiveOrderIndex(currentTableData.orders.length);
                  }}
                  title="Add next order round (e.g. extra rotis/tea)"
                >
                  <Plus size={13} strokeWidth={2.5} />
                  <span>Round</span>
                </button>
              </div>
            </div>

            {/* Bill Items List */}
            <div className="bill-items-list">
              {/* Punch Destination Selector (for Dine-In tables) */}
              {!isParcelId(currentTable) && (
                <div className="bill-punch-destination-toggle">
                  <span className="punch-toggle-label">Adding items to:</span>
                  <div className="punch-toggle-buttons">
                    <button
                      type="button"
                      className={`punch-toggle-btn ${punchDestination === 'dine-in' ? 'active-dine' : ''}`}
                      onClick={() => setPunchDestination('dine-in')}
                    >
                      <UtensilsCrossed size={12} />
                      <span>🍽️ Dine-In (Table)</span>
                    </button>
                    <button
                      type="button"
                      className={`punch-toggle-btn ${punchDestination === 'parcel' ? 'active-parcel' : ''}`}
                      onClick={() => setPunchDestination('parcel')}
                    >
                      <ShoppingBag size={12} />
                      <span>🛍️ Parcel (Home Pack)</span>
                    </button>
                  </div>
                </div>
              )}

              {activeOrderIndex === 'all' ? (
                consolidatedTableItems.length > 0 ? (
                  <>
                    {/* 1. DINE-IN ITEMS SECTION */}
                    {dineInItems.length > 0 && (
                      <div className="bill-partition-section">
                        <div className="bill-partition-header dine-in">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <UtensilsCrossed size={14} style={{ color: '#2563eb' }} />
                            <span>🍽️ DINE-IN (SERVE AT TABLE)</span>
                          </div>
                          <span className="partition-subtotal">₹{dineInSubtotal.toFixed(2)}</span>
                        </div>
                        {dineInItems.map((item) => (
                          <div key={item.key || item.id} className="bill-item-row">
                            <div className="bill-item-main-row">
                              <div className="bill-item-name" title={item.name}>{item.name}</div>
                              <div className="bill-item-total">
                                ₹{(item.price * item.quantity).toFixed(2)}
                              </div>
                            </div>

                            <div className="bill-item-sub-row">
                              <div className="bill-item-subtext">
                                <span className="bill-item-rate">₹{item.price} each</span>
                                {!isParcelId(currentTable) && (
                                  <button
                                    type="button"
                                    className="bill-move-btn to-parcel"
                                    onClick={() => moveItemBetweenDineInAndParcel(item.id)}
                                    title="Pack 1 quantity for home"
                                  >
                                    <ShoppingBag size={11} />
                                    <span>Pack 1x</span>
                                  </button>
                                )}
                              </div>

                              <div className="bill-item-actions">
                                <div className="bill-item-controls">
                                  <button
                                    type="button"
                                    className="bill-qty-btn minus"
                                    onClick={() => handleConsolidatedQuantityChange(item.id, item.quantity - 1)}
                                    title="Decrease"
                                  >
                                    <Minus size={12} strokeWidth={2.5} />
                                  </button>
                                  <span className="bill-qty-display">{item.quantity}</span>
                                  <button
                                    type="button"
                                    className="bill-qty-btn plus"
                                    onClick={() => handleConsolidatedQuantityChange(item.id, item.quantity + 1)}
                                    title="Increase"
                                  >
                                    <Plus size={12} strokeWidth={2.5} />
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  className="bill-remove-item-btn"
                                  onClick={() => handleConsolidatedQuantityChange(item.id, 0)}
                                  title="Remove"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 2. TAKEAWAY / PARCEL ITEMS SECTION */}
                    {parcelItems.length > 0 && (
                      <div className="bill-partition-section" style={{ marginTop: dineInItems.length > 0 ? '1rem' : '0' }}>
                        <div className="bill-partition-header parcel">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <ShoppingBag size={14} style={{ color: '#ea580c' }} />
                            <span>🛍️ TAKEAWAY / PARCEL (PACK FOR HOME)</span>
                          </div>
                          <span className="partition-subtotal" style={{ color: '#c2410c' }}>₹{parcelSubtotal.toFixed(2)}</span>
                        </div>
                        {parcelItems.map((item) => (
                          <div key={item.key || item.id} className="bill-item-row is-parcel-row">
                            <div className="bill-item-main-row">
                              <div className="bill-item-name" title={item.name}>{item.name}</div>
                              <div className="bill-item-total">
                                ₹{(item.price * item.quantity).toFixed(2)}
                              </div>
                            </div>

                            <div className="bill-item-sub-row">
                              <div className="bill-item-subtext">
                                <span className="bill-item-rate">₹{item.price} each</span>
                                <span className="bill-parcel-badge">🛍️ PACK</span>
                                {!isParcelId(currentTable) && (
                                  <button
                                    type="button"
                                    className="bill-move-btn to-dine"
                                    onClick={() => moveItemBetweenDineInAndParcel(item.id)}
                                    title="Serve 1 quantity at table"
                                  >
                                    <UtensilsCrossed size={11} />
                                    <span>Eat 1x</span>
                                  </button>
                                )}
                              </div>

                              <div className="bill-item-actions">
                                <div className="bill-item-controls">
                                  <button
                                    type="button"
                                    className="bill-qty-btn minus"
                                    onClick={() => handleConsolidatedQuantityChange(item.id, item.quantity - 1)}
                                    title="Decrease"
                                  >
                                    <Minus size={12} strokeWidth={2.5} />
                                  </button>
                                  <span className="bill-qty-display">{item.quantity}</span>
                                  <button
                                    type="button"
                                    className="bill-qty-btn plus"
                                    onClick={() => handleConsolidatedQuantityChange(item.id, item.quantity + 1)}
                                    title="Increase"
                                  >
                                    <Plus size={12} strokeWidth={2.5} />
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  className="bill-remove-item-btn"
                                  onClick={() => handleConsolidatedQuantityChange(item.id, 0)}
                                  title="Remove"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bill-empty-state">
                    <div className="bill-empty-icon">
                      <UtensilsCrossed size={34} strokeWidth={1.5} />
                    </div>
                    <p className="bill-empty-title">Running Bill is empty</p>
                    <p className="bill-empty-desc">
                      Tap <strong>+</strong> on any dish in the menu to add it to {isParcelId(currentTable) ? currentTable : `Table ${currentTable}`}.
                    </p>
                  </div>
                )
              ) : (
                effectiveActiveOrder && effectiveActiveOrder.items && effectiveActiveOrder.items.length > 0 ? (
                  effectiveActiveOrder.items.map((item) => (
                    <div key={item.id} className="bill-item-row">
                      <div className="bill-item-main-row">
                        <div className="bill-item-name" title={item.name}>{item.name}</div>
                        <div className="bill-item-total">
                          ₹{(item.price * item.quantity).toFixed(2)}
                        </div>
                      </div>

                      <div className="bill-item-sub-row">
                        <div className="bill-item-subtext">
                          <span className="bill-item-rate">₹{item.price} each</span>
                          {(item.isParcel || isParcelId(currentTable)) && (
                            <span className="bill-parcel-badge">🛍️ PACK</span>
                          )}
                        </div>

                        <div className="bill-item-actions">
                          <div className="bill-item-controls">
                            <button
                              type="button"
                              className="bill-qty-btn minus"
                              onClick={() => handleQuantityChange(effectiveActiveOrder.id, item.id, item.quantity - 1)}
                              title="Decrease"
                            >
                              <Minus size={12} strokeWidth={2.5} />
                            </button>
                            <span className="bill-qty-display">{item.quantity}</span>
                            <button
                              type="button"
                              className="bill-qty-btn plus"
                              onClick={() => handleQuantityChange(effectiveActiveOrder.id, item.id, item.quantity + 1)}
                              title="Increase"
                            >
                              <Plus size={12} strokeWidth={2.5} />
                            </button>
                          </div>

                          <button
                            type="button"
                            className="bill-remove-item-btn"
                            onClick={() => handleQuantityChange(effectiveActiveOrder.id, item.id, 0)}
                            title="Remove from round"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bill-empty-state">
                    <div className="bill-empty-icon">
                      <UtensilsCrossed size={34} strokeWidth={1.5} />
                    </div>
                    <p className="bill-empty-title">Round {Number(activeOrderIndex) + 1} is empty</p>
                    <p className="bill-empty-desc">
                      Tap <strong>+</strong> on any dish in the menu to add it to Round {Number(activeOrderIndex) + 1}.
                    </p>
                  </div>
                )
              )}
            </div>

            {/* Bill Footer & Totals */}
            <div className="bill-footer">
              <div className="bill-receipt-summary-bar">
                <div className="bill-summary-pill-left">
                  <span className="summary-label">Total Items:</span>
                  <strong className="summary-val">
                    {activeOrderIndex === 'all'
                      ? totalTableItemsCount
                      : (effectiveActiveOrder?.items?.reduce((s, it) => s + (it.quantity || 0), 0) || 0)}
                  </strong>
                </div>
                <div className="bill-summary-pill-divider" />
                <div className="bill-summary-pill-right">
                  <span className="summary-label">Subtotal:</span>
                  <strong className="summary-val grand-amt">
                    ₹{(activeOrderIndex === 'all' ? currentTableData.total : (effectiveActiveOrder?.total || 0)).toFixed(2)}
                  </strong>
                </div>
              </div>

              <div className="bill-actions-grid">
                <button
                  type="button"
                  className="btn-bill-print-kot"
                  onClick={() => setIsKotModalOpen(true)}
                  disabled={totalTableItemsCount === 0}
                  title="Print Kitchen Order Ticket (KOT)"
                >
                  <Printer size={17} strokeWidth={2.3} />
                  <span>Print KOT</span>
                </button>

                <button
                  type="button"
                  className="btn-bill-checkout-table"
                  onClick={() => {
                    setIsMobileBillOpen(false);
                    handleClearTable();
                  }}
                  disabled={currentTableData.total === 0}
                  title="Pay & Settle Table Bill"
                >
                  <Receipt size={17} strokeWidth={2.3} />
                  <span>Pay & Settle</span>
                </button>
              </div>

              {activeOrderIndex !== 'all' && effectiveActiveOrder && effectiveActiveOrder.total > 0 && currentTableData.orders.length > 1 && (
                <button
                  type="button"
                  className="btn-bill-checkout-round"
                  onClick={() => {
                    setIsMobileBillOpen(false);
                    handleClearOrder(effectiveActiveOrder.id);
                  }}
                >
                  <Check size={15} /> Pay Round {Number(activeOrderIndex) + 1} Only (₹{effectiveActiveOrder.total.toFixed(0)})
                </button>
              )}

              <div className="bill-secondary-actions">
                <button
                  type="button"
                  className="btn-bill-delete-table"
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to delete Table ${currentTable}? This will remove all orders from this table.`)) {
                      deleteTable(currentTable);
                    }
                  }}
                  title="Delete Table"
                >
                  Delete Table
                </button>
              </div>
            </div>
          </div></div>

      </div>

      {/* Kitchen Order Ticket (KOT) Modal */}
      <KotPrintModal
        isOpen={isKotModalOpen}
        onClose={() => setIsKotModalOpen(false)}
        tableId={currentTable}
        orders={currentTableData.orders}
        activeRoundIndex={activeOrderIndex}
        consolidatedItems={consolidatedTableItems}
      />

      {/* Floating Bottom Bar on Mobile Screens (< 900px) */}
      <div
        className="mobile-floating-bill-bar"
        onClick={() => setIsMobileBillOpen(true)}
        role="button"
        tabIndex={0}
        aria-label="View bill and order summary"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsMobileBillOpen(true);
          }
        }}
      >
        <div className="floating-bar-left">
          <span className="floating-table-badge">Table {currentTable}</span>
          <span className="floating-items-count">
            {currentTableOccupied.itemCount} items
          </span>
        </div>
        <div className="floating-bar-right">
          <span className="floating-total-amt">
            ₹{currentTableData.total.toFixed(2)}
          </span>
          <button
            type="button"
            className="floating-view-bill-btn"
            tabIndex={-1}
            aria-hidden="true"
          >
            <span>View Bill</span>
            <ChevronUp size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TableSection;
