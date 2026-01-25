import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import NavigationBar from './NavigationBar';
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
  const moveItem = async (fromIndex, toIndex) => {
    if (!isOnline) {
      alert('You are currently offline. Changes will be synced when you reconnect.');
      return;
    }
    
    // Use debounced version for better performance
    debouncedMoveItem(fromIndex, toIndex);
  };

  // Function to move item up in sequence
  const moveItemUp = async (currentIndex) => {
    if (currentIndex > 0) {
      try {
        await moveItem(currentIndex, currentIndex - 1);
      } catch (error) {
        console.error('Error moving item up:', error);
        throw error;
      }
    }
  };
  
  // Function to move item down in sequence
  const moveItemDown = async (currentIndex) => {
    if (currentIndex < menuItems.length - 1) {
      try {
        await moveItem(currentIndex, currentIndex + 1);
      } catch (error) {
        console.error('Error moving item down:', error);
        throw error;
      }
    }
  };
  
  // Function to move item to specific position
  const moveToPosition = async (currentIndex, newPosition) => {
    const clampedPosition = Math.max(0, Math.min(menuItems.length - 1, newPosition - 1));
    if (currentIndex !== clampedPosition) {
      try {
        await moveItem(currentIndex, clampedPosition);
      } catch (error) {
        console.error('Error moving to position:', error);
        throw error;
      }
    }
  };
  
  // Toggle reorder mode
  const toggleReorderMode = () => {
    setReorderMode(!reorderMode);
    setEditingId(null); // Exit edit mode when entering reorder mode
  };
  
  // Menu items state
  const [menuItems, setMenuItems] = useState([]);
  
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
  const [searchTerm, setSearchTerm] = useState('');
  
  // Connection state awareness
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncPending, setSyncPending] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(Date.now());
  
  // Debounce timer reference
  const debounceTimerRef = React.useRef(null);
  
  // Debounced moveItem function
  const debouncedMoveItem = useCallback((fromIndex, toIndex) => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set new timer
    debounceTimerRef.current = setTimeout(async () => {
      try {
        setSyncPending(true);
        
        const sortedMenuItems = menuItems.slice().sort((a, b) => a.sequence - b.sequence);
        const newMenuItems = [...sortedMenuItems];
        const [movedItem] = newMenuItems.splice(fromIndex, 1);
        newMenuItems.splice(toIndex, 0, movedItem);
        
        // Update sequence numbers based on new positions
        const updatedMenuItems = newMenuItems.map((item, index) => ({
          ...item,
          sequence: index + 1
        }));
        
        // Monitor performance
        await monitorFirebaseOperation('bulkUpdateMenuItems_debounced', async () => {
          await bulkUpdateMenuItems(updatedMenuItems);
        });
        
        setLastSyncTime(Date.now());
        console.log('Debounced menu item sequence updated successfully');
      } catch (error) {
        console.error('Error in debounced moveItem:', error);
        alert('Failed to update item sequence. Please try again.');
      } finally {
        setSyncPending(false);
      }
    }, 300); // 300ms debounce delay
  }, [menuItems]);
  
  // Load menu items from Firebase on component mount and subscribe to real-time updates
  useEffect(() => {
    let unsubscribe = null;
    
    const loadMenuItems = async () => {
      try {
        console.log('SettingsPage: Loading menu items...');
        // First load existing menu items from Firebase
        const firebaseMenuItems = await getAllMenuItems();
        console.log('SettingsPage: Firebase menu items:', firebaseMenuItems);
        
        if (firebaseMenuItems.length > 0) {
          // Use Firebase data if it exists
          console.log('SettingsPage: Using Firebase menu items');
          setMenuItems(firebaseMenuItems);
        } else {
          console.log('SettingsPage: No Firebase menu items found');
          // If no Firebase data exists, migrate from localStorage if available
          const savedMenuItems = localStorage.getItem('nalliNihariMenuItems');
          console.log('SettingsPage: LocalStorage menu items:', savedMenuItems);
          
          if (savedMenuItems) {
            const parsedItems = JSON.parse(savedMenuItems);
            const itemsWithSequence = parsedItems.map((item, index) => ({
              ...item,
              sequence: item.sequence !== undefined ? item.sequence : index + 1,
              id: item.id || `item_${Date.now()}_${index}` // Ensure unique IDs
            }));
            
            // Save to Firebase and update state
            const savePromises = itemsWithSequence.map(item => 
              addMenuItemFirebase(item)
            );
            await Promise.all(savePromises);
            console.log('SettingsPage: Migrated localStorage items to Firebase');
            setMenuItems(itemsWithSequence);
            
            // Clear localStorage after migration
            localStorage.removeItem('nalliNihariMenuItems');
          } else {
            console.log('SettingsPage: No localStorage menu items found, creating defaults');
            // Initialize with default menu items if neither Firebase nor localStorage exists
            const defaultMenuItems = [
              { id: 'khameeriRoti', name: 'Khameeri Roti', price: 10, available: true, sequence: 1 },
              { id: 'butterKhameeriRoti', name: 'Butter Khameeri Roti', price: 15, available: true, sequence: 2 },
              { id: 'nalliNihariHalf', name: 'Nalli Nihari Half', price: 160, available: true, sequence: 3 },
              { id: 'nalliNihariFull', name: 'Nalli Nihari Full', price: 300, available: true, sequence: 4 },
              { id: 'amulButterTadka', name: 'Amul Butter Tadka', price: 40, available: true, sequence: 5 },
              { id: 'waterBottle', name: 'Water Bottle', price: 10, available: true, sequence: 6 },
              { id: 'nalli', name: 'Nalli (Bone Marrow)', price: 50, available: true, sequence: 7 },
              { id: 'extraSoup', name: 'Extra Soup', price: 25, available: true, sequence: 8 },
            ];
            
            const savePromises = defaultMenuItems.map(item => 
              addMenuItemFirebase(item)
            );
            await Promise.all(savePromises);
            console.log('SettingsPage: Created default menu items in Firebase');
            setMenuItems(defaultMenuItems);
          }
        }
      } catch (error) {
        console.error('SettingsPage: Error loading menu items:', error);
        // Fallback to localStorage if Firebase fails
        const savedMenuItems = localStorage.getItem('nalliNihariMenuItems');
        if (savedMenuItems) {
          const parsedItems = JSON.parse(savedMenuItems);
          const itemsWithSequence = parsedItems.map((item, index) => ({
            ...item,
            sequence: item.sequence !== undefined ? item.sequence : index + 1
          }));
          console.log('SettingsPage: Using localStorage fallback');
          setMenuItems(itemsWithSequence);
        }
      }
    };
    
    loadMenuItems();
    
    // Subscribe to real-time updates
    unsubscribe = subscribeToMenuItems((updatedMenuItems) => {
      console.log('SettingsPage: Menu items updated:', updatedMenuItems);
      setMenuItems(updatedMenuItems);
    });
    
    // Cleanup subscription
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log('Connection restored');
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      console.log('Connection lost');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      // Clear debounce timer on unmount
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (mobileMenuOpen && window.innerWidth <= 1200) {
        setMobileMenuOpen(false);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [mobileMenuOpen]);

  // Dispatch a custom event to notify other components of the update
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('menuItemsUpdated'));
  }, [menuItems]);

  // Filter menu items based on search term
  const filteredMenuItems = useMemo(() => {
    if (!searchTerm) return menuItems;
    return menuItems.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [menuItems, searchTerm]);

  const clearAllData = async () => {
    if (window.confirm('Are you sure you want to clear ALL data? This will remove all tables, orders, and history.')) {
      try {
        // Clear localStorage
        localStorage.removeItem('nalliNihariTables');
        localStorage.removeItem('nalliNihariHistory');
        
        // Clear Firebase menu items
        const menuItemsToDelete = await getAllMenuItems();
        const deletePromises = menuItemsToDelete.map(item => 
          deleteMenuItemFirebase(item.id)
        );
        await Promise.all(deletePromises);
        
        window.location.reload();
      } catch (error) {
        console.error('Error clearing data:', error);
        alert('Failed to clear all data. Please try again.');
        throw error;
      }
    }
  };

  const exportData = async () => {
    try {
      const tables = JSON.parse(localStorage.getItem('nalliNihariTables') || '{}');
      const history = JSON.parse(localStorage.getItem('nalliNihariHistory') || '[]');
      
      // Get fresh menu items from Firebase
      const firebaseMenuItems = await getAllMenuItems();
      
      const data = {
        tables,
        history,
        menuItems: firebaseMenuItems,
        exportedAt: new Date().toISOString()
      };
      
      const dataStr = JSON.stringify(data, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = 'nalli-nihari-data.json';
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Failed to export data. Please try again.');
    }
  };

  const importData = async (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const importedData = JSON.parse(e.target.result);
          
          if (importedData.tables) {
            localStorage.setItem('nalliNihariTables', JSON.stringify(importedData.tables));
          }
          
          if (importedData.history) {
            localStorage.setItem('nalliNihariHistory', JSON.stringify(importedData.history));
          }
          
          if (importedData.menuItems) {
            // Import menu items to Firebase
            const menuItemsWithIds = importedData.menuItems.map((item, index) => ({
              ...item,
              id: item.id || `imported_${Date.now()}_${index}`,
              sequence: item.sequence !== undefined ? item.sequence : index + 1
            }));
            
            const savePromises = menuItemsWithIds.map(item => 
              addMenuItemFirebase(item)
            );
            await Promise.all(savePromises);
          }
          
          alert('Data imported successfully! The page will reload.');
          window.location.reload();
        } catch (error) {
          console.error('Error importing data:', error);
          alert('Error importing data. Please check the file format.');
        }
      };
      reader.readAsText(file);
    }
  };
  
  // CREATE: Add a new menu item
  const addMenuItem = async (e) => {
    e.preventDefault();
    
    if (!newMenuItem.name.trim() || !newMenuItem.price) {
      alert('Please fill in all fields');
      return;
    }
    
    // Generate a unique ID if not provided
    const id = newMenuItem.id || newMenuItem.name.toLowerCase().replace(/\s+/g, '') + '_' + Date.now();
    
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
    
    try {
      // Add to Firebase
      const result = await addMenuItemFirebase(newItem);
      if (result) {
        // Reset form
        setNewMenuItem({
          id: '',
          name: '',
          price: '',
          available: true,
          sequence: 0
        });
        
        alert('Menu item added successfully!');
      } else {
        alert('Failed to add menu item. Please try again.');
      }
    } catch (error) {
      console.error('Error adding menu item:', error);
      alert('Failed to add menu item. Please try again.');
      throw error;
    }
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
  
  // Handle form submission (either add or update)
  const handleSubmit = async (e) => {
    try {
      if (editingId) {
        await updateMenuItem(e);
      } else {
        await addMenuItem(e);
      }
    } catch (error) {
      console.error('Error in form submission:', error);
    }
  };
  
  // UPDATE: Save changes to a menu item
  const updateMenuItem = async (e) => {
    e.preventDefault();
    
    if (!newMenuItem.name.trim() || !newMenuItem.price) {
      alert('Please fill in all fields');
      return;
    }
    
    const updatedItem = {
      id: newMenuItem.id,
      name: newMenuItem.name.trim(),
      price: parseFloat(newMenuItem.price),
      available: newMenuItem.available,
      sequence: menuItems.find(item => item.id === editingId)?.sequence || 1
    };
    
    try {
      // Update in Firebase
      await updateMenuItemFirebase(editingId, updatedItem);
      
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
    } catch (error) {
      console.error('Error updating menu item:', error);
      alert('Failed to update menu item. Please try again.');
      throw error;
    }
  };
  
  // DELETE: Remove a menu item
  const deleteMenuItem = async (id) => {
    if (window.confirm('Are you sure you want to delete this menu item?')) {
      try {
        await deleteMenuItemFirebase(id);
        alert('Menu item deleted successfully!');
      } catch (error) {
        console.error('Error deleting menu item:', error);
        alert('Failed to delete menu item. Please try again.');
        throw error;
      }
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
                onClick={async () => {
                  try {
                    await moveItemUp(currentIndex);
                  } catch (error) {
                    console.error('Error moving item up:', error);
                  }
                }}
                disabled={currentIndex === 0}
                title="Move Up"
                aria-label={`Move ${item.name} up in sequence`}
              >
                ↑
              </button>
              <button 
                className="reorder-btn down-btn" 
                onClick={async () => {
                  try {
                    await moveItemDown(currentIndex);
                  } catch (error) {
                    console.error('Error moving item down:', error);
                  }
                }}
                disabled={currentIndex === sortedMenuItems.length - 1}
                title="Move Down"
                aria-label={`Move ${item.name} down in sequence`}
              >
                ↓
              </button>
              <input
                type="number"
                className="position-input"
                min="1"
                max={sortedMenuItems.length}
                value={item.sequence}
                onChange={async (e) => {
                  try {
                    await moveToPosition(currentIndex, parseInt(e.target.value) || 1);
                  } catch (error) {
                    console.error('Error moving to position:', error);
                  }
                }}
                title="Set Position"
                aria-label={`Set position for ${item.name}`}
              />
            </div>
          ) : (
            <>
              <button 
                className="action-btn edit-btn" 
                onClick={() => startEdit(item)}
                disabled={editingId || reorderMode}
                title="Edit item"
                aria-label={`Edit ${item.name}`}
              >
                Edit
              </button>
              <button 
                className={`action-btn ${item.available ? 'hide-btn' : 'show-btn'}`} 
                onClick={async () => {
                  try {
                    await toggleAvailability(item.id);
                  } catch (error) {
                    console.error('Error toggling availability:', error);
                  }
                }}
                disabled={reorderMode}
                title={item.available ? "Hide item" : "Show item"}
                aria-label={`${item.available ? "Hide" : "Show"} ${item.name}`}
              >
                {item.available ? 'Hide' : 'Show'}
              </button>
              <button 
                className="action-btn delete-btn" 
                onClick={async () => {
                  try {
                    await deleteMenuItem(item.id);
                  } catch (error) {
                    console.error('Error deleting menu item:', error);
                  }
                }}
                disabled={editingId || reorderMode}
                title="Delete item"
                aria-label={`Delete ${item.name}`}
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
  const toggleAvailability = async (id) => {
    const item = menuItems.find(item => item.id === id);
    if (item) {
      try {
        await toggleMenuItemAvailability(id, item.available);
      } catch (error) {
        console.error('Error toggling menu item availability:', error);
        alert('Failed to update item availability. Please try again.');
        throw error;
      }
    }
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
              <form onSubmit={handleSubmit} className="menu-form">
                <div className="form-group">
                  <label htmlFor="itemId">Item ID:</label>
                  <input
                    type="text"
                    id="itemId"
                    value={newMenuItem.id}
                    onChange={(e) => setNewMenuItem({...newMenuItem, id: e.target.value})}
                    placeholder="Auto-generated if empty"
                    disabled={editingId} // Disable ID field when editing
                    className="form-control"
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
                    className="form-control"
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
                    className="form-control"
                  />
                </div>
                
                <div className="form-group checkbox-group">
                  <label htmlFor="itemAvailable" className="checkbox-label">
                    Available:
                    <input
                      type="checkbox"
                      id="itemAvailable"
                      checked={newMenuItem.available}
                      onChange={(e) => setNewMenuItem({...newMenuItem, available: e.target.checked})}
                      className="checkbox-control"
                    />
                    <span className="checkmark"></span>
                  </label>
                </div>
                
                <div className="form-actions">
                  <button type="submit" className="btn btn-primary">
                    {editingId ? 'Update Item' : 'Add Item'}
                  </button>
                  {editingId && (
                    <button type="button" className="btn btn-secondary" onClick={cancelEdit}>
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
            
            <div className="setting-item">
              <div className="menu-header">
                <h3>Existing Menu Items</h3>
                <div className="menu-search">
                  <input
                    type="text"
                    placeholder="Search menu items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                    aria-label="Search menu items"
                  />
                </div>
              </div>
              
              <div className="menu-mode-controls">
                <button 
                  className={`mode-toggle-btn ${reorderMode ? 'reorder-active' : 'edit-active'}`}
                  onClick={toggleReorderMode}
                  aria-pressed={reorderMode}
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
                {filteredMenuItems.length === 0 ? (
                  <p className="no-items-message">No menu items found. {searchTerm ? 'Try a different search term.' : 'Add some items above.'}</p>
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
                      {filteredMenuItems
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
                className="btn btn-primary" 
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
                  <p className="no-items-message">No tables found. Add a table above.</p>
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
                                className="btn btn-danger" 
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
              <button className="btn btn-primary" onClick={exportData}>
                Export Data
              </button>
            </div>
            
            <div className="setting-item">
              <h3>Import Data</h3>
              <p>Import tables, order history, and menu items from a JSON file.</p>
              <label className="file-upload-label">
                <input 
                  type="file" 
                  accept=".json" 
                  onChange={importData} 
                  className="file-upload-input"
                  aria-label="Import data from JSON file"
                />
                <span className="btn btn-secondary">Choose File</span>
              </label>
            </div>
            
            <div className="setting-item">
              <h3>Clear All Data</h3>
              <p>Remove all tables, orders, history, and menu items. This cannot be undone.</p>
              <button className="btn btn-danger" onClick={clearAllData}>
                Clear All Data
              </button>
            </div>
          </div>
        );
      case 'about':
        return (
          <div className="tab-content">
            <div className="about-content">
              <h3>About Nalli Nihari POS</h3>
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
            {/* Connection Status Indicators */}
            <div className="connection-status-indicators">
              <div className={`status-indicator ${isOnline ? 'online' : 'offline'}`} 
                   title={isOnline ? 'Connected' : 'Offline'}>
                {isOnline ? '●' : '○'}
              </div>
              {syncPending && (
                <div className="sync-indicator" title="Syncing changes...">
                  ↻
                </div>
              )}
            </div>
            <button 
              className="hamburger-btn"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setMobileMenuOpen(!mobileMenuOpen);
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
                role="tab"
                aria-selected={activeTab === tab.id}
                tabIndex={activeTab === tab.id ? 0 : -1}
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