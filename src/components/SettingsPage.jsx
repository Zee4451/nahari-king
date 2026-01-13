import React, { useState, useEffect } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import NavigationBar from './NavigationBar';

const SettingsPage = () => {
  // Define item types for drag and drop
  const ITEM_TYPE = 'MENU_ITEM';
  
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
  
  // Drag source and drop target for menu items
  const MenuItemRow = ({ item, index }) => {
    const [{ isDragging }, drag] = useDrag({
      type: ITEM_TYPE,
      item: { index },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    });

    const [, drop] = useDrop({
      accept: ITEM_TYPE,
      hover: (draggedItem) => {
        if (draggedItem.index !== index) {
          moveItem(draggedItem.index, index);
          draggedItem.index = index;
        }
      },
    });

    return (
      <tr ref={(node) => drag(drop(node))} style={{ opacity: isDragging ? 0.5 : 1 }}>
        <td>{item.sequence}</td>
        <td>{item.id}</td>
        <td>{item.name}</td>
        <td>₹{item.price}</td>
        <td>
          <span className={`availability ${item.available ? 'available' : 'unavailable'}`}>
            {item.available ? '✓ Available' : '✗ Unavailable'}
          </span>
        </td>
        <td>
          <button 
            className="export-btn" 
            onClick={() => startEdit(item)}
            disabled={editingId}
          >
            Edit
          </button>
          <button 
            className="export-btn" 
            onClick={() => toggleAvailability(item.id)}
          >
            {item.available ? 'Hide' : 'Show'}
          </button>
          <button 
            className="danger-btn" 
            onClick={() => deleteMenuItem(item.id)}
            disabled={editingId}
          >
            Delete
          </button>
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

  return (
    <DndProvider backend={HTML5Backend}>
    <div className="settings-page">
      <NavigationBar currentPage="settings" />
      <div className="page-content">
        <h1>Settings</h1>
        
        {/* Menu Item Management Section */}
        <div className="settings-section">
          <h2>Menu Item Management</h2>
          
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
        
        <div className="settings-section">
          <h2>Data Management</h2>
          
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
        
        <div className="settings-section">
          <h2>About</h2>
          <div className="about-content">
            <p><strong>Nalli Nihari Table Management System</strong></p>
            <p>A fast, lightweight, production-ready POS system for restaurants.</p>
            <p>Version: 1.0.0</p>
            <p>Local data storage using browser's LocalStorage</p>
          </div>
        </div>
      </div>
    </div>
    </DndProvider>
  );
};

export default SettingsPage;