import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useTableContext } from '../context/TableContext';
import { useMenu } from '../hooks/useMenu';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

const TableSection = () => {
  // Consume Contexts
  const {
    tables,
    currentTable,
    setCurrentTable,
    addOrderToTable,
    addItemToOrder,
    updateItemQuantity,
    clearTable,
    clearOrder,
    removeOrder,
    addNewTable,
    deleteTable,
    initiateCheckoutOrder,
    initiateCheckoutTable
  } = useTableContext();

  const { menuItems } = useMenu();

  const currentTableData = tables[currentTable] || {
    id: currentTable,
    orders: [],
    total: 0
  };

  // Track if we've already created an order for this table during this session
  const lastTableRef = useRef(currentTable);

  useEffect(() => {
    if (currentTableData.orders.length === 0) {
      const timer = setTimeout(() => {
        addOrderToTable(currentTable);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [currentTable, currentTableData.orders.length, addOrderToTable]);

  useEffect(() => {
    if (lastTableRef.current !== currentTable && currentTableData.orders.length === 0) {
      addOrderToTable(currentTable);
    }
    lastTableRef.current = currentTable;
  }, [currentTable, currentTableData.orders.length, addOrderToTable]);

  const handleAddOrder = () => addOrderToTable(currentTable);

  const handleQuantityChange = (orderId, menuItemId, newQuantity) => {
    const menuItem = menuItems.find(item => item.id === menuItemId);
    if (!menuItem) return;

    const table = tables[currentTable];
    const order = table.orders.find(ord => ord.id === orderId);
    if (!order) return;

    const existingItem = order.items.find(item => item.id === menuItemId);

    if (newQuantity <= 0) {
      if (existingItem) updateItemQuantity(currentTable, orderId, menuItemId, 0);
      return;
    }

    if (!existingItem) {
      addItemToOrder(currentTable, orderId, menuItem);
      if (newQuantity > 1) {
        updateItemQuantity(currentTable, orderId, menuItemId, newQuantity);
      }
    } else {
      updateItemQuantity(currentTable, orderId, menuItemId, newQuantity);
    }
  };

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

  // Get all table IDs sorted
  const allTableIds = useMemo(() => {
    return Object.keys(tables).map(Number).sort((a, b) => a - b);
  }, [tables]);

  const getTableStatus = (tableId) => {
    const table = tables[tableId];
    if (!table) return 'empty';

    const hasActiveOrders = table.orders.length > 0 && table.total > 0;
    const hasEmptyOrders = table.orders.length > 0 && table.total === 0;

    if (currentTable === tableId && hasActiveOrders) return 'current-active';
    if (currentTable === tableId && hasEmptyOrders) return 'current-empty';
    if (currentTable === tableId) return 'current';
    if (hasActiveOrders) return 'has-orders';
    if (hasEmptyOrders) return 'has-empty-orders';
    return 'empty';
  };

  // Drag and Drop ordering logic inside order items
  const ORDER_ITEM_TYPE = 'ORDER_ITEM';

  const moveItemInOrder = async (orderId, fromIndex, toIndex) => {
    const table = tables[currentTable];
    if (!table) return;
    const orderIndex = table.orders.findIndex(order => order.id === orderId);
    if (orderIndex === -1) return;
    const order = table.orders[orderIndex];
    const newItems = [...order.items];
    const [movedItem] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, movedItem);
    for (let i = 0; i < newItems.length; i++) {
      if (i < order.items.length) {
        await updateItemQuantity(currentTable, orderId, newItems[i].id, newItems[i].quantity);
      }
    }
  };

  const OrderItemRow = ({ item, order, index }) => {
    const [{ isDragging }, drag] = useDrag({
      type: ORDER_ITEM_TYPE,
      item: { index, orderId: order.id },
      collect: (monitor) => ({ isDragging: monitor.isDragging() }),
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
            onClick={() => handleQuantityChange(order.id, item.id, item.quantity - 1)}
          >
            -
          </button>
          <span className="quantity">{item.quantity}</span>
          <button
            className="quantity-btn plus"
            onClick={() => handleQuantityChange(order.id, item.id, item.quantity + 1)}
          >
            +
          </button>
          <span className="item-total">₹{(item.price * item.quantity).toFixed(2)}</span>
        </div>
      </div>
    );
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="table-section">
        <div className="table-switcher">
          <div className="table-switcher-controls">
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
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

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
                      Checkout
                    </button>
                    <button
                      className="remove-order-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveOrder(order.id);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </h3>

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
                              onClick={() => handleQuantityChange(order.id, menuItem.id, Math.max(0, quantity - 1))}
                            >
                              -
                            </button>
                            <span className="quantity">{quantity}</span>
                            <button
                              className="quantity-btn plus"
                              onClick={() => handleQuantityChange(order.id, menuItem.id, quantity + 1)}
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
            ))}

            <div className="add-order-section">
              <button className="add-order-btn" onClick={handleAddOrder}>
                Add New Order
              </button>
            </div>
          </div>
        </div>

        <div className="table-actions">
          <button
            className="clear-table-btn"
            onClick={handleClearTable}
            disabled={currentTableData.total === 0}
          >
            Checkout Table
          </button>
          <button
            className="delete-table-btn-action"
            onClick={() => {
              if (window.confirm(`Are you sure you want to delete Table ${currentTable}? This will remove all orders from this table.`)) {
                deleteTable(currentTable);
              }
            }}
          >
            Delete Table
          </button>
        </div>
      </div>
    </DndProvider>
  );
};

export default TableSection;