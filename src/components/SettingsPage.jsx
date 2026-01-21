import React, { useState, useEffect } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import NavigationBar from './NavigationBar';
import { 
  getAllTables,
  subscribeToTables,
  updateTable,
  deleteTable as deleteTableFirebase
} from '../services/firebaseService';

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
    alert(`Table ${newTableId} added successfully!`);
  };

  // Function to delete a table
  const deleteTable = async (tableId) => {
    if (window.confirm(`Are you sure you want to delete Table ${tableId}? This will remove all orders from this table.`)) {
      await deleteTableFirebase(tableId);
      alert(`Table ${tableId} deleted successfully!`);
    }
  };
  
  // Load tables on component mount
  useEffect(() => {
    const loadTables = async () => {
      const loadedTables = await getAllTables();
      setTables(loadedTables);
    };
    
    loadTables();
    
    // Subscribe to real-time updates
    const unsubscribe = subscribeToTables((updatedTables) => {
      setTables(updatedTables);
    });
    
    // Cleanup subscription
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);
  
  // Function to move an item from one position to another
  const moveItem = (fromIndex, toIndex) => {
    const newMenuItems = [...menuItems];
    const [movedItem] = newMenuItems.splice(fromIndex, 1);
    newMenuItems.splice(toIndex, 0, movedItem);
    
    // Update sequence numbers based on new positions
    const updatedMenuItems = newMenuItems.map((item, index) => ({
      ...item,
      sequence: index + 1
    }));
    
    setMenuItems(updatedMenuItems);
  };
  
  // Function to move item up in sequence
  const moveItemUp = (currentIndex) => {
    if (currentIndex > 0) {
      moveItem(currentIndex, currentIndex - 1);
    }
  };
  
  // Function to move item down in sequence
  const moveItemDown = (currentIndex) => {
    if (currentIndex < menuItems.length - 1) {
      moveItem(currentIndex, currentIndex + 1);
    }
  };
  
  // Function to move item to specific position
  const moveToPosition = (currentIndex, newPosition) => {
    const clampedPosition = Math.max(0, Math.min(menuItems.length - 1, newPosition - 1));
    if (currentIndex !== clampedPosition) {
      moveItem(currentIndex, clampedPosition);
    }
  };
  
  // Toggle reorder mode
  const toggleReorderMode = () => {
    setReorderMode(!reorderMode);
    setEditingId(null); // Exit edit mode when entering reorder mode
  };
  // Menu items state
  const [menuItems, setMenuItems] = useState([
    { id: 'khameeriRoti', name: 'Khameeri Roti', price: 10, available: true, sequence: 1 },
    { id: 'butterKhameeriRoti', name: 'Butter Khameeri Roti', price: 15, available: true, sequence: 2 },
    { id: 'nalliNihariHalf', name: 'Nalli Nihari Half', price: 160, available: true, sequence: 3 },
    { id: 'nalliNihariFull', name: 'Nalli Nihari Full', price: 300, available: true, sequence: 4 },
    { id: 'amulButterTadka', name: 'Amul Butter Tadka', price: 40, available: true, sequence: 5 },
    { id: 'waterBottle', name: 'Water Bottle', price: 10, available: true, sequence: 6 },
    { id: 'nalli', name: 'Nalli (Bone Marrow)', price: 50, available: true, sequence: 7 },
    { id: 'extraSoup', name: 'Extra Soup', price: 25, available: true, sequence: 8 },
  ]);
  
  // Form state for adding/editing menu items
  const [newMenuItem, setNewMenuItem] = useState({
    id: '',
    name: '',
    price: '',
    available: true,
    sequence: 0
  });
  
  const [editingId, setEditingId] = useState(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [activeTab, setActiveTab] = useState('menu');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Load menu items from localStorage on component mount
  useEffect(() => {
    const savedMenuItems = localStorage.getItem('nalliNihariMenuItems');
    if (savedMenuItems) {
      const parsedItems = JSON.parse(savedMenuItems);
      // If sequence property doesn't exist, assign default sequence values
      const itemsWithSequence = parsedItems.map((item, index) => ({
        ...item,
        sequence: item.sequence !== undefined ? item.sequence : index + 1
      }));
      setMenuItems(itemsWithSequence);
    }
  }, []);
  
  // Log state changes for debugging
  useEffect(() => {
    console.log('mobileMenuOpen state changed to:', mobileMenuOpen);
  }, [mobileMenuOpen]);
  
  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (mobileMenuOpen && window.innerWidth <= 768) {
        console.log('Click outside detected, closing menu');
        setMobileMenuOpen(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [mobileMenuOpen]);
  
  // Save menu items to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('nalliNihariMenuItems', JSON.stringify(menuItems));
    
    // Dispatch a custom event to notify other components of the update
    window.dispatchEvent(new CustomEvent('menuItemsUpdated'));
  }, [menuItems]);
  
  const clearAllData = () => {
    if (window.confirm('Are you sure you want to clear ALL data? This will remove all tables, orders, and history.')) {
      localStorage.removeItem('nalliNihariTables');
      localStorage.removeItem('nalliNihariHistory');
      window.location.reload();
    }
  };

  const exportData = () => {
    const tables = JSON.parse(localStorage.getItem('nalliNihariTables') || '{}');
    const history = JSON.parse(localStorage.getItem('nalliNihariHistory') || '[]');
    
    const data = {
      tables,
      history,
      menuItems,
      exportedAt: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'nalli-nihari-data.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importData = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target.result);
          
          if (importedData.tables) {
            localStorage.setItem('nalliNihariTables', JSON.stringify(importedData.tables));
          }
          
          if (importedData.history) {
            localStorage.setItem('nalliNihariHistory', JSON.stringify(importedData.history));
          }
          
          if (importedData.menuItems) {
            localStorage.setItem('nalliNihariMenuItems', JSON.stringify(importedData.menuItems));
            setMenuItems(importedData.menuItems);
          }
          
          alert('Data imported successfully! The page will reload.');
          window.location.reload();
        } catch (error) {
          alert('Error importing data. Please check the file format.');
        }
      };
      reader.readAsText(file);
    }
  };
  
  // CREATE: Add a new menu item
  const addMenuItem = (e) => {
    e.preventDefault();
    
    if (!newMenuItem.name.trim() || !newMenuItem.price) {
      alert('Please fill in all fields');
      return;
    }
    
    // Generate a unique ID if not provided
    const id = newMenuItem.id || newMenuItem.name.toLowerCase().replace(/\s+/g, '');
    
    // Calculate the sequence number for the new item (append to end)
    const sequence = menuItems.length > 0 ? Math.max(...menuItems.map(item => item.sequence)) + 1 : 1;
    
    const newItem = {
      id,
      name: newMenuItem.name.trim(),
      price: parseFloat(newMenuItem.price),
      available: newMenuItem.available,
      sequence
    };
    
    // Check if item with this ID already exists
    if (menuItems.some(item => item.id === id)) {
      alert('An item with this ID already exists. Please use a different name or ID.');
      return;
    }
    
    setMenuItems([...menuItems, newItem]);
    
    // Reset form
    setNewMenuItem({
      id: '',
      name: '',
      price: '',
      available: true,
      sequence: 0
    });
    
    alert('Menu item added successfully!');
  };
  
  // UPDATE: Prepare form for editing a menu item
  const startEdit = (item) => {
    setNewMenuItem({
      id: item.id,
      name: item.name,
      price: item.price.toString(),
      available: item.available,
      sequence: item.sequence
    });
    setEditingId(item.id);
  };
  
  // UPDATE: Save changes to a menu item
  const updateMenuItem = (e) => {
    e.preventDefault();
    
    if (!newMenuItem.name.trim() || !newMenuItem.price) {
      alert('Please fill in all fields');
      return;
    }
    
    const updatedItems = menuItems.map(item => {
      if (item.id === editingId) {
        return {
          id: newMenuItem.id,
          name: newMenuItem.name.trim(),
          price: parseFloat(newMenuItem.price),
          available: newMenuItem.available,
          sequence: item.sequence // Preserve the sequence when updating
        };
      }
      return item;
    });
    
    setMenuItems(updatedItems);
    
    // Reset form and editing state
    setNewMenuItem({
      id: '',
      name: '',
      price: '',
      available: true,
      sequence: 0
    });
    setEditingId(null);
    
    alert('Menu item updated successfully!');
  };
  
  // DELETE: Remove a menu item
  const deleteMenuItem = (id) => {
    if (window.confirm('Are you sure you want to delete this menu item?')) {
      setMenuItems(menuItems.filter(item => item.id !== id));
      alert('Menu item deleted successfully!');
    }
  };
  
  // CANCEL: Cancel editing
  const cancelEdit = () => {
    setNewMenuItem({
      id: '',
      name: '',
      price: '',
      available: true,
      sequence: 0
    });
    setEditingId(null);
  };
  
  // Menu item row component with reordering controls
  const MenuItemRow = ({ item, index }) => {
    const sortedMenuItems = menuItems.slice().sort((a, b) => a.sequence - b.sequence);
    const currentIndex = sortedMenuItems.findIndex(menuItem => menuItem.id === item.id);
    
    return (
      <tr>
        <td data-label="Seq">{item.sequence}</td>
        <td data-label="ID">{item.id}</td>
        <td data-label="Name">{item.name}</td>
        <td data-label="Price">₹{item.price}</td>
        <td data-label="Available">
          <span className={`availability ${item.available ? 'available' : 'unavailable'}`}>
            {item.available ? '✓ Available' : '✗ Unavailable'}
          </span>
        </td>
        <td data-label="Actions" className="actions-cell">
          {reorderMode ? (
            <div className="reorder-controls">
              <button 
                className="reorder-btn up-btn" 
                onClick={() => moveItemUp(currentIndex)}
                disabled={currentIndex === 0}
                title="Move Up"
              >
                ↑
              </button>
              <button 
                className="reorder-btn down-btn" 
                onClick={() => moveItemDown(currentIndex)}
                disabled={currentIndex === menuItems.length - 1}
                title="Move Down"
              >
                ↓
              </button>
              <input
                type="number"
                className="position-input"
                min="1"
                max={menuItems.length}
                value={item.sequence}
                onChange={(e) => moveToPosition(currentIndex, parseInt(e.target.value) || 1)}
                title="Set Position"
              />
            </div>
          ) : (
            <>
              <button 
                className="export-btn" 
                onClick={() => startEdit(item)}
                disabled={editingId || reorderMode}
              >
                Edit
              </button>
              <button 
                className="export-btn" 
                onClick={() => toggleAvailability(item.id)}
                disabled={reorderMode}
              >
                {item.available ? 'Hide' : 'Show'}
              </button>
              <button 
                className="danger-btn" 
                onClick={() => deleteMenuItem(item.id)}
                disabled={editingId || reorderMode}
              >
                Delete
              </button>
            </>
          )}
        </td>
      </tr>
    );
  };
  
  // Toggle availability of a menu item
  const toggleAvailability = (id) => {
    setMenuItems(menuItems.map(item => 
      item.id === id ? { ...item, available: !item.available } : item
    ));
  };

  const tabs = [
    { id: 'menu', label: 'Menu Items', icon: '📋' },
    { id: 'tables', label: 'Tables', icon: '🪑' },
    { id: 'data', label: 'Data', icon: '💾' },
    { id: 'about', label: 'About', icon: 'ℹ️' }
  ];
  
  const renderActiveTabContent = () => {
    switch(activeTab) {
      case 'menu':
        return (
          <div className="tab-content">
            <div className="setting-item">
              <h3>{editingId ? 'Edit Menu Item' : 'Add New Menu Item'}</h3>
              <form onSubmit={editingId ? updateMenuItem : addMenuItem}>
                <div className="form-group">
                  <label htmlFor="itemId">Item ID:</label>
                  <input
                    type="text"
                    id="itemId"
                    value={newMenuItem.id}
                    onChange={(e) => setNewMenuItem({...newMenuItem, id: e.target.value})}
                    placeholder="Auto-generated if empty"
                    disabled={editingId} // Disable ID field when editing
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="itemName">Item Name:</label>
                  <input
                    type="text"
                    id="itemName"
                    value={newMenuItem.name}
                    onChange={(e) => setNewMenuItem({...newMenuItem, name: e.target.value})}
                    placeholder="Enter item name"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="itemPrice">Price:</label>
                  <input
                    type="number"
                    id="itemPrice"
                    value={newMenuItem.price}
                    onChange={(e) => setNewMenuItem({...newMenuItem, price: e.target.value})}
                    placeholder="Enter price"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                
                <div className="form-group checkbox-group">
                  <label htmlFor="itemAvailable">Available:</label>
                  <input
                    type="checkbox"
                    id="itemAvailable"
                    checked={newMenuItem.available}
                    onChange={(e) => setNewMenuItem({...newMenuItem, available: e.target.checked})}
                  />
                </div>
                
                <div className="form-actions">
                  <button type="submit" className="export-btn">
                    {editingId ? 'Update Item' : 'Add Item'}
                  </button>
                  {editingId && (
                    <button type="button" className="danger-btn" onClick={cancelEdit}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
            
            <div className="setting-item">
              <h3>Existing Menu Items</h3>
              <div className="menu-mode-controls">
                <button 
                  className={`mode-toggle-btn ${reorderMode ? 'reorder-active' : 'edit-active'}`}
                  onClick={toggleReorderMode}
                >
                  {reorderMode ? 'Exit Reorder Mode' : 'Enter Reorder Mode'}
                </button>
                {reorderMode && (
                  <span className="mode-description">
                    Tap ↑↓ arrows or enter position numbers to reorder items
                  </span>
                )}
              </div>
              <div className="menu-items-list">
                {menuItems.length === 0 ? (
                  <p>No menu items found. Add some items above.</p>
                ) : (
                  <table className="menu-items-table">
                    <thead>
                      <tr>
                        <th>Seq</th>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Price</th>
                        <th>Available</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {menuItems
                        .slice()
                        .sort((a, b) => a.sequence - b.sequence) // Sort by sequence
                        .map((item, index) => (
                        <MenuItemRow key={item.id} item={item} index={index} />
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        );
      case 'tables':
        return (
          <div className="tab-content">
            <div className="setting-item">
              <h3>Add New Table</h3>
              <p>Create a new table in the system. Tables will be numbered sequentially.</p>
              <button 
                className="export-btn" 
                onClick={async () => {
                  // Limit the number of tables to prevent performance issues
                  const allTableIds = Object.keys(tables).map(Number).sort((a, b) => a - b);
                  if (allTableIds.length >= 50) {
                    alert('Maximum number of tables reached (50). Please delete unused tables before adding more.');
                    return;
                  }
                  
                  // Confirm before adding a new table
                  if (window.confirm('Are you sure you want to add a new table?')) {
                    await addNewTable();
                  }
                }}
              >
                Add New Table
              </button>
            </div>
            
            <div className="setting-item">
              <h3>Current Tables</h3>
              <p>Manage existing tables in the system:</p>
              <div className="table-management-list">
                {Object.keys(tables).length === 0 ? (
                  <p>No tables found. Add a table above.</p>
                ) : (
                  <table className="tables-table">
                    <thead>
                      <tr>
                        <th>Table Number</th>
                        <th>Orders Count</th>
                        <th>Total Amount</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(tables)
                        .sort(([a], [b]) => parseInt(a) - parseInt(b))
                        .map(([tableId, tableData]) => (
                          <tr key={tableId}>
                            <td>{tableId}</td>
                            <td>{tableData.orders.length}</td>
                            <td>₹{tableData.total.toFixed(2)}</td>
                            <td>
                              <button 
                                className="danger-btn" 
                                onClick={() => {
                                  if (window.confirm(`Are you sure you want to delete Table ${tableId}? This will remove all orders from this table.`)) {
                                    deleteTable(parseInt(tableId));
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        );
      case 'data':
        return (
          <div className="tab-content">
            <div className="setting-item">
              <h3>Export Data</h3>
              <p>Export all tables, order history, and menu items to a JSON file.</p>
              <button className="export-btn" onClick={exportData}>
                Export Data
              </button>
            </div>
            
            <div className="setting-item">
              <h3>Import Data</h3>
              <p>Import tables, order history, and menu items from a JSON file.</p>
              <input 
                type="file" 
                accept=".json" 
                onChange={importData} 
                className="import-input"
              />
            </div>
            
            <div className="setting-item">
              <h3>Clear All Data</h3>
              <p>Remove all tables, orders, history, and menu items. This cannot be undone.</p>
              <button className="danger-btn" onClick={clearAllData}>
                Clear All Data
              </button>
            </div>
          </div>
        );
      case 'about':
        return (
          <div className="tab-content">
            <div className="about-content">
              <p><strong>Nalli Nihari Table Management System</strong></p>
              <p>A fast, lightweight, production-ready POS system for restaurants.</p>
              <p>Version: 1.0.0</p>
              <p>Local data storage using browser's LocalStorage</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };
  
  return (
    <DndProvider backend={HTML5Backend}>
    <div className="settings-page">
      <NavigationBar currentPage="settings" />
      <div className="settings-layout">
        <div className="sidebar-nav">
          <div className="sidebar-header">
            <h2>Settings</h2>
            <button 
              className="hamburger-btn"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Hamburger clicked! Current state:', mobileMenuOpen);
                const newState = !mobileMenuOpen;
                console.log('Setting state to:', newState);
                setMobileMenuOpen(newState);
              }}
              onTouchStart={(e) => {
                console.log('Touch start detected');
              }}
              aria-label="Toggle navigation menu"
              type="button"
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
          <nav className={`nav-menu ${mobileMenuOpen ? 'open' : ''}`}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`nav-link ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  setMobileMenuOpen(false); // Close menu on selection
                }}
              >
                <span className="nav-icon">{tab.icon}</span>
                <span className="nav-text">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
        
        <div className="main-content">
          <div className="page-content">
            <div className="tab-header">
              <h1>{tabs.find(tab => tab.id === activeTab)?.label} Settings</h1>
            </div>
            {renderActiveTabContent()}
          </div>
        </div>
      </div>
    </div>
    </DndProvider>
  );
};

export default SettingsPage;