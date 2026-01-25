import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import NavigationBar from './NavigationBar';
import UserManagement from './UserManagement';
import { 
  getAllTables,
  subscribeToTables,
  updateTable,
  deleteTable as deleteTableFirebase,
  getAllMenuItems,
  subscribeToMenuItems,
  addMenuItem as addMenuItemFirebase,
  updateMenuItem as updateMenuItemFirebase,
  deleteMenuItem as deleteMenuItemFirebase,
  bulkUpdateMenuItems,
  toggleMenuItemAvailability,
  updateMenuItemWithVersion,
  retryWithBackoff
} from '../services/firebaseService';
import { useRenderPerformance, useFunctionPerformance, monitorFirebaseOperation } from '../utils/performanceMonitor';

const SettingsPage = () => {
  // Define item types for drag and drop
  const ITEM_TYPE = 'MENU_ITEM';
  
  // State for managing tables
  const [tables, setTables] = useState({});
  
  // Function to add a new table
  const addNewTable = async () => {
    // Get all existing table IDs and find the highest one
    const existingTableIds = Object.keys(tables).map(Number);
    const newTableId = existingTableIds.length > 0 ? Math.max(...existingTableIds) + 1 : 11; // Start from 11 if no tables exist
    const newTable = {
      id: newTableId,
      orders: [],
      total: 0
    };
    
    await updateTable(newTableId, newTable);
  };
  
  // Function to delete a table
  const deleteTable = async (tableId) => {
    if (window.confirm(`Are you sure you want to delete Table ${tableId}? This will remove all orders from this table.`)) {
      await deleteTableFirebase(tableId);
    }
  };
  
  // State for managing menu items
  const [menuItems, setMenuItems] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [newItem, setNewItem] = useState({
    name: '',
    price: '',
    available: true,
    category: ''
  });
  
  // State for UI management
  const [activeTab, setActiveTab] = useState('menu'); // 'menu', 'tables', 'users'
  const [draggedItem, setDraggedItem] = useState(null);
  
  // Initialize the app
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load tables from Firebase
        const firebaseTables = await getAllTables();
        setTables(firebaseTables);
        
        // Subscribe to real-time tables updates
        const unsubscribeTables = subscribeToTables((updatedTables) => {
          setTables(updatedTables);
        });
        
        // Load menu items from Firebase
        const firebaseMenuItems = await getAllMenuItems();
        setMenuItems(firebaseMenuItems);
        
        // Subscribe to real-time menu items updates
        const unsubscribeMenuItems = subscribeToMenuItems((updatedMenuItems) => {
          setMenuItems(updatedMenuItems);
        });
        
        // Cleanup subscriptions on unmount
        return () => {
          unsubscribeTables();
          unsubscribeMenuItems();
        };
      } catch (error) {
        console.error('Error initializing app:', error);
      }
    };
    
    const cleanup = initializeApp();
    return () => {
      if (cleanup && typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, []);
  
  // Drag and drop handlers for menu items
  const moveMenuItem = useCallback(async (dragIndex, hoverIndex) => {
    const draggedItemLocal = menuItems[dragIndex];
    const newMenuItems = [...menuItems];
    
    // Remove the dragged item
    newMenuItems.splice(dragIndex, 1);
    // Insert it at the hovered position
    newMenuItems.splice(hoverIndex, 0, draggedItemLocal);
    
    // Update sequences
    const updatedItems = newMenuItems.map((item, index) => ({
      ...item,
      sequence: index + 1
    }));
    
    setMenuItems(updatedItems);
    
    // Update in Firebase with retry mechanism
    try {
      await retryWithBackoff(() => bulkUpdateMenuItems(updatedItems));
    } catch (error) {
      console.error('Error updating menu item positions:', error);
      // Revert to original state on failure
      setMenuItems(menuItems);
    }
  }, [menuItems]);
  
  // Add new menu item
  const addMenuItem = async () => {
    if (!newItem.name || !newItem.price) {
      alert('Please enter both name and price');
      return;
    }
    
    const menuItemData = {
      name: newItem.name,
      price: parseFloat(newItem.price),
      available: newItem.available,
      category: newItem.category || 'Main Course',
      sequence: menuItems.length + 1
    };
    
    try {
      const newId = await addMenuItemFirebase(menuItemData);
      if (newId) {
        setMenuItems([...menuItems, { id: newId, ...menuItemData }]);
        setNewItem({ name: '', price: '', available: true, category: '' });
      }
    } catch (error) {
      console.error('Error adding menu item:', error);
      alert('Failed to add menu item. Please try again.');
    }
  };
  
  // Update menu item
  const updateMenuItem = async () => {
    if (!editingItem.name || !editingItem.price) {
      alert('Please enter both name and price');
      return;
    }
    
    try {
      await updateMenuItemFirebase(editingItem.id, {
        name: editingItem.name,
        price: parseFloat(editingItem.price),
        available: editingItem.available,
        category: editingItem.category
      });
      setMenuItems(menuItems.map(item => 
        item.id === editingItem.id ? editingItem : item
      ));
      setEditingItem(null);
    } catch (error) {
      console.error('Error updating menu item:', error);
      alert('Failed to update menu item. Please try again.');
    }
  };
  
  // Delete menu item
  const deleteMenuItem = async (itemId) => {
    if (window.confirm('Are you sure you want to delete this menu item?')) {
      try {
        await deleteMenuItemFirebase(itemId);
        setMenuItems(menuItems.filter(item => item.id !== itemId));
      } catch (error) {
        console.error('Error deleting menu item:', error);
        alert('Failed to delete menu item. Please try again.');
      }
    }
  };
  
  // Toggle menu item availability
  const toggleAvailability = async (itemId, currentAvailability) => {
    try {
      await toggleMenuItemAvailability(itemId, currentAvailability);
      setMenuItems(menuItems.map(item => 
        item.id === itemId 
          ? { ...item, available: !currentAvailability }
          : item
      ));
    } catch (error) {
      console.error('Error toggling availability:', error);
    }
  };
  
  // Draggable item component
  const DraggableMenuItem = ({ item, index }) => {
    const [{ isDragging }, drag] = useDrag({
      type: ITEM_TYPE,
      item: { id: item.id, index },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    });
    
    const [, drop] = useDrop({
      accept: ITEM_TYPE,
      hover: (draggedItem, monitor) => {
        if (!monitor.isOver({ shallow: true })) return;
        if (draggedItem.index !== index) {
          moveMenuItem(draggedItem.index, index);
          draggedItem.index = index;
        }
      },
    });
    
    return (
      <div
        ref={(node) => drag(drop(node))}
        className={`menu-item ${isDragging ? 'dragging' : ''} ${!item.available ? 'unavailable' : ''}`}
        style={{ opacity: isDragging ? 0.5 : 1 }}
      >
        <div className="item-handle">⋮⋮</div>
        <div className="item-details">
          <div className="item-name">{item.name}</div>
          <div className="item-category">{item.category}</div>
          <div className="item-price">₹{item.price}</div>
        </div>
        <div className="item-actions">
          <button 
            className={`availability-toggle ${item.available ? 'available' : 'unavailable'}`}
            onClick={() => toggleAvailability(item.id, item.available)}
          >
            {item.available ? '✓' : '✗'}
          </button>
          <button 
            className="edit-btn"
            onClick={() => setEditingItem({...item})}
          >
            Edit
          </button>
          <button 
            className="delete-btn"
            onClick={() => deleteMenuItem(item.id)}
          >
            Delete
          </button>
        </div>
      </div>
    );
  };
  
  return (
    <DndProvider backend={HTML5Backend}>
      <div className="settings-page">
        <NavigationBar currentPage="settings" />
        <div className="page-content">
          <h1>Settings</h1>
          
          {/* Tab Navigation */}
          <div className="settings-tabs">
            <button 
              className={`tab-btn ${activeTab === 'menu' ? 'active' : ''}`}
              onClick={() => setActiveTab('menu')}
            >
              Menu Management
            </button>
            <button 
              className={`tab-btn ${activeTab === 'tables' ? 'active' : ''}`}
              onClick={() => setActiveTab('tables')}
            >
              Table Management
            </button>
            <button 
              className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => setActiveTab('users')}
            >
              User Management
            </button>
          </div>
          
          {/* Menu Management Tab */}
          {activeTab === 'menu' && (
            <div className="settings-section">
              <h2>Menu Management</h2>
              
              {/* Add New Item Form */}
              <div className="add-item-form">
                <h3>Add New Menu Item</h3>
                <div className="form-row">
                  <input
                    type="text"
                    placeholder="Item Name"
                    value={newItem.name}
                    onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                  />
                  <input
                    type="number"
                    placeholder="Price"
                    step="0.01"
                    value={newItem.price}
                    onChange={(e) => setNewItem({...newItem, price: e.target.value})}
                  />
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                  >
                    <option value="">Select Category</option>
                    <option value="Appetizer">Appetizer</option>
                    <option value="Main Course">Main Course</option>
                    <option value="Dessert">Dessert</option>
                    <option value="Beverage">Beverage</option>
                  </select>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={newItem.available}
                      onChange={(e) => setNewItem({...newItem, available: e.target.checked})}
                    />
                    Available
                  </label>
                  <button className="add-btn" onClick={addMenuItem}>
                    Add Item
                  </button>
                </div>
              </div>
              
              {/* Edit Item Form */}
              {editingItem && (
                <div className="edit-item-form">
                  <h3>Edit Menu Item</h3>
                  <div className="form-row">
                    <input
                      type="text"
                      placeholder="Item Name"
                      value={editingItem.name}
                      onChange={(e) => setEditingItem({...editingItem, name: e.target.value})}
                    />
                    <input
                      type="number"
                      placeholder="Price"
                      step="0.01"
                      value={editingItem.price}
                      onChange={(e) => setEditingItem({...editingItem, price: e.target.value})}
                    />
                    <select
                      value={editingItem.category}
                      onChange={(e) => setEditingItem({...editingItem, category: e.target.value})}
                    >
                      <option value="Appetizer">Appetizer</option>
                      <option value="Main Course">Main Course</option>
                      <option value="Dessert">Dessert</option>
                      <option value="Beverage">Beverage</option>
                    </select>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={editingItem.available}
                        onChange={(e) => setEditingItem({...editingItem, available: e.target.checked})}
                      />
                      Available
                    </label>
                    <button className="save-btn" onClick={updateMenuItem}>
                      Save Changes
                    </button>
                    <button className="cancel-btn" onClick={() => setEditingItem(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              
              {/* Menu Items List */}
              <div className="menu-items-list">
                <h3>Menu Items (Drag to reorder)</h3>
                {menuItems.length === 0 ? (
                  <p>No menu items found. Add some items above.</p>
                ) : (
                  menuItems.map((item, index) => (
                    <DraggableMenuItem key={item.id} item={item} index={index} />
                  ))
                )}
              </div>
            </div>
          )}
          
          {/* Table Management Tab */}
          {activeTab === 'tables' && (
            <div className="settings-section">
              <h2>Table Management</h2>
              <div className="tables-management">
                <div className="table-actions">
                  <button className="add-table-btn" onClick={addNewTable}>
                    Add New Table
                  </button>
                </div>
                
                <div className="tables-grid">
                  {Object.entries(tables).map(([tableId, tableData]) => (
                    <div key={tableId} className="table-card">
                      <h3>Table {tableId}</h3>
                      <p>Orders: {tableData.orders?.length || 0}</p>
                      <p>Total: ₹{tableData.total || 0}</p>
                      <button 
                        className="delete-table-btn"
                        onClick={() => deleteTable(tableId)}
                      >
                        Delete Table
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* User Management Tab */}
          {activeTab === 'users' && (
            <div className="settings-section">
              <UserManagement />
            </div>
          )}
        </div>
      </div>
    </DndProvider>
  );
};

export default SettingsPage;