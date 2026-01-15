import React, { useState, useMemo, useEffect, useRef } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

const TableSection = ({
  tables,
  currentTable,
  setCurrentTable,
  menuItems,
  addOrderToTable,
  addItemToOrder,
  updateItemQuantity,
  clearTable,
  clearOrder,
  removeOrder,
  addNewTable,
  deleteTable
}) => {


  const currentTableData = tables[currentTable] || {
    id: currentTable,
    orders: [],
    total: 0
  };

  // Automatically create an order when a table is selected and has no orders
  useEffect(() => {
    if (currentTableData.orders.length === 0) {
      // Add a small delay to ensure the UI updates properly
      const timer = setTimeout(() => {
        addOrderToTable(currentTable);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [currentTable, currentTableData.orders.length, addOrderToTable]);

  // Track if we've already created an order for this table during this session to prevent duplicates
  const lastTableRef = useRef(currentTable);
  useEffect(() => {
    // If we've switched to a different table and it has no orders, create one
    if (lastTableRef.current !== currentTable && currentTableData.orders.length === 0) {
      addOrderToTable(currentTable);
    }
    lastTableRef.current = currentTable;
  }, [currentTable, currentTableData.orders.length, addOrderToTable]);

  const handleAddOrder = () => {
    addOrderToTable(currentTable);
  };



  const handleQuantityChange = (orderId, menuItemId, newQuantity) => {
    // Find the menu item to get its details
    const menuItem = menuItems.find(item => item.id === menuItemId);
    if (!menuItem) return;
    
    // Get the current order to check if the item exists
    const table = tables[currentTable];
    const order = table.orders.find(ord => ord.id === orderId);
    if (!order) return;
    
    const existingItem = order.items.find(item => item.id === menuItemId);
    
    if (newQuantity <= 0) {
      if (existingItem) {
        // If item exists and new quantity is 0 or less, remove it
        updateItemQuantity(currentTable, orderId, menuItemId, 0);
      }
      // If item doesn't exist and quantity is 0 or less, do nothing
      return;
    }
    
    if (!existingItem) {
      // If item doesn't exist, we need to add it step by step
      // First add it with quantity 1
      addItemToOrder(currentTable, orderId, menuItem);
      
      // If the desired quantity is more than 1, we need to increase it from 1 to the desired value
      if (newQuantity > 1) {
        // Update the quantity to the desired value
        updateItemQuantity(currentTable, orderId, menuItemId, newQuantity);
      }
    } else {
      // Item exists, just update the quantity
      updateItemQuantity(currentTable, orderId, menuItemId, newQuantity);
    }
  };

  const handleClearOrder = (orderId) => {
    // Clear the specific order (history saving is handled in the parent component)
    clearOrder(currentTable, orderId);
  };

  const handleRemoveOrder = (orderId) => {
    if (window.confirm('Are you sure you want to remove this order?')) {
      removeOrder(currentTable, orderId);
    }
  };

  // State to track if we're in reorder mode for an order
  const [reorderMode, setReorderMode] = useState(null);
  
  // Function to move an item within an order
  const moveItemInOrder = async (orderId, fromIndex, toIndex) => {
    const table = tables[currentTable];
    if (!table) return;
    
    const orderIndex = table.orders.findIndex(order => order.id === orderId);
    if (orderIndex === -1) return;
    
    const order = table.orders[orderIndex];
    const newItems = [...order.items];
    const [movedItem] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, movedItem);
    
    const updatedOrders = [...table.orders];
    updatedOrders[orderIndex] = {
      ...order,
      items: newItems,
      total: newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    };
    
    const updatedTable = {
      ...table,
      orders: updatedOrders,
      total: updatedOrders.reduce((sum, order) => sum + order.total, 0)
    };
    
    // Call the parent function to update the table
    // We need to use updateItemQuantity to update the entire order
    // For simplicity, we'll just add and remove items to recreate the order
    for (let i = 0; i < newItems.length; i++) {
      // This is a simplified approach - in practice we'd need to update the order directly
      // Since we can't directly update the order from here, we'll just call updateItemQuantity
      // to trigger a quantity update
      if (i < order.items.length) {
        // Item already existed, update its position by changing quantity to itself
        await updateItemQuantity(currentTable, orderId, newItems[i].id, newItems[i].quantity);
      }
    }
  };
  

  
  // Define item types for drag and drop
  const ORDER_ITEM_TYPE = 'ORDER_ITEM';
  
  // Order item row component with drag-and-drop
  const OrderItemRow = ({ item, order, index, orderIndex: orderIdx }) => {
    const [{ isDragging }, drag] = useDrag({
      type: ORDER_ITEM_TYPE,
      item: { index, orderId: order.id },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    });

    const [, drop] = useDrop({
      accept: ORDER_ITEM_TYPE,
      hover: (draggedItem) => {
        if (draggedItem.orderId === order.id && draggedItem.index !== index) {
          moveItemInOrder(order.id, draggedItem.index, index);
          draggedItem.index = index;
        }
      },
    });

    return (
      <div ref={(node) => drag(drop(node))} className="order-item" style={{ opacity: isDragging ? 0.5 : 1 }}>
        <div className="item-info">
          <span className="item-name">{item.name}</span>
          <span className="item-price">₹{item.price}</span>
        </div>
        <div className="item-controls">
          <button 
            className="quantity-btn minus"
            onClick={() => {
              const newQty = Math.max(0, item.quantity - 1);
              updateItemQuantity(currentTable, order.id, item.id, newQty);
            }}
          >
            -
          </button>
          <span className="quantity">{item.quantity}</span>
          <button 
            className="quantity-btn plus"
            onClick={() => {
              const newQty = item.quantity + 1;
              updateItemQuantity(currentTable, order.id, item.id, newQty);
            }}
          >
            +
          </button>
          <span className="item-total">₹{(item.price * item.quantity).toFixed(2)}</span>
        </div>
      </div>
    );
  };

  const handleClearTable = () => {
    clearTable(currentTable);
  };

  const handleTableSwitch = (tableId) => {
    setCurrentTable(tableId);
    // Automatically create an order if the table doesn't have any orders
    const table = tables[tableId];
    if (table && table.orders.length === 0) {
      addOrderToTable(tableId);
    }
  };

  // Get all table IDs sorted
  const allTableIds = useMemo(() => {
    return Object.keys(tables).map(Number).sort((a, b) => a - b);
  }, [tables]);

  // Determine table status for visual indicators
  const getTableStatus = (tableId) => {
    const table = tables[tableId];
    if (!table) return 'empty';
    
    const hasActiveOrders = table.orders.length > 0 && table.total > 0;
    const hasEmptyOrders = table.orders.length > 0 && table.total === 0;
    
    if (currentTable === tableId && hasActiveOrders) {
      return 'current-active'; // Currently selected with active orders
    } else if (currentTable === tableId && hasEmptyOrders) {
      return 'current-empty'; // Currently selected but empty
    } else if (currentTable === tableId) {
      return 'current'; // Currently selected
    } else if (hasActiveOrders) {
      return 'has-orders'; // Has active orders but not selected
    } else if (hasEmptyOrders) {
      return 'has-empty-orders'; // Has empty orders but not selected
    } else {
      return 'empty'; // No orders
    }
  };

  // Function to scroll the table switcher
  const scrollTables = (direction) => {
    const container = document.querySelector('.table-buttons-container');
    if (container) {
      const scrollAmount = 200; // pixels to scroll
      container.scrollBy({
        left: direction === 'right' ? scrollAmount : -scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
    <div className="table-section">
      {/* Fast Table Switching Bar */}
      <div className="table-switcher">
        <div className="table-switcher-controls">
          <button 
            className="scroll-btn" 
            onClick={() => scrollTables('left')}
          >
            &lt;
          </button>
          <div className="table-buttons-container">
            <div className="table-buttons">
              {allTableIds.map(tableId => (
                <button
                  key={tableId}
                  className={`table-btn ${getTableStatus(tableId)}`}
                  onClick={() => handleTableSwitch(tableId)}
                >
                  {tableId}
                  {tables[tableId] && (
                    <>
                      {tables[tableId].orders.filter(order => order.total > 0).length > 0 && (
                        <span className="order-count">({tables[tableId].orders.filter(order => order.total > 0).length})</span>
                      )}
                      {tables[tableId].orders.filter(order => order.total === 0).length > 0 && (
                        <span className="empty-order-count">(E:{tables[tableId].orders.filter(order => order.total === 0).length})</span>
                      )}
                    </>
                  )}
                  <button 
                    className="delete-table-btn" 
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent triggering table switch
                      deleteTable(tableId);
                    }}
                    title={`Delete Table ${tableId}`}
                  >
                    ×
                  </button>
                </button>
              ))}
            </div>
          </div>
          <button className="add-table-btn" onClick={addNewTable}>+</button>
          <button 
            className="scroll-btn" 
            onClick={() => scrollTables('right')}
          >
            &gt;
          </button>
        </div>
        

      </div>

      
      {/* Current Table Info */}
      <div className="current-table-info">
        <div className="table-header">
          <h2>Table {currentTable}</h2>
          <div className="table-stats">
            <div className="stat-item">
              <span className="stat-label">Orders:</span>
              <span className="stat-value">{currentTableData.orders.length}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total:</span>
              <span className="stat-value total-amount">₹{currentTableData.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Orders in Current Table */}
      <div className="orders-container">
        <div className="orders-list">
          {currentTableData.orders.map((order, orderIndex) => (
            <div key={order.id} className="order-section">
              <h3>
                Order {orderIndex + 1}
                <span className="order-total">₹{order.total.toFixed(2)}</span>
                <div className="order-buttons">
                  <button 
                    className="clear-order-btn"
                    onClick={() => handleClearOrder(order.id)}
                  >
                    Clear
                  </button>
                  <button 
                    className="remove-order-btn"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent triggering table switch
                      handleRemoveOrder(order.id);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </h3>
              <div className="order-items">
                <div className="order-items">
                  <div className="menu-items-grid">
                    {menuItems.map((menuItem) => {
                      const existingItem = order.items.find(item => item.id === menuItem.id);
                      const quantity = existingItem ? existingItem.quantity : 0;
                      
                      return (
                        <div key={menuItem.id} className="menu-item-quantity">
                          <div className="menu-item-info">
                            <span className="item-name">{menuItem.name}</span>
                            <span className="item-price">₹{menuItem.price}</span>
                          </div>
                          <div className="item-controls">
                            <button 
                              className="quantity-btn minus"
                              onClick={() => {
                                const newQty = Math.max(0, quantity - 1);
                                handleQuantityChange(order.id, menuItem.id, newQty);
                              }}
                            >
                              -
                            </button>
                            <span className="quantity">{quantity}</span>
                            <button 
                              className="quantity-btn plus"
                              onClick={() => {
                                const newQty = quantity + 1;
                                handleQuantityChange(order.id, menuItem.id, newQty);
                              }}
                            >
                              +
                            </button>
                            <span className="item-total">₹{(menuItem.price * quantity).toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                

              </div>
            </div>
          ))}
          
          {/* Always show Add Order button for creating additional orders */}
          <div className="add-order-section">
            <button className="add-order-btn" onClick={handleAddOrder}>
              Add New Order
            </button>
          </div>
        </div>
      </div>


      {/* Clear Table Button */}
      <div className="table-actions">
        <button 
          className="clear-table-btn" 
          onClick={handleClearTable}
          disabled={currentTableData.total === 0}
        >
          Clear Table
        </button>
        <button 
          className="delete-table-btn-action" 
          onClick={() => deleteTable(currentTable)}
        >
          Delete Table
        </button>
      </div>
    </div>
    </DndProvider>
  );
};

export default TableSection;