import { db } from '../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where
} from 'firebase/firestore';

// Collection references
const tablesCollection = collection(db, 'tables');
const historyCollection = collection(db, 'history');
const menuItemsCollection = collection(db, 'menuItems');

// Get all tables data
export const getAllTables = async () => {
  try {
    const tablesSnapshot = await getDocs(tablesCollection);
    const tables = {};
    tablesSnapshot.forEach((doc) => {
      tables[doc.id] = doc.data();
    });
    return tables;
  } catch (error) {
    console.error('Error getting tables:', error);
    return {};
  }
};

// Subscribe to real-time tables updates
export const subscribeToTables = (callback) => {
  return onSnapshot(tablesCollection, (snapshot) => {
    const tables = {};
    snapshot.forEach((doc) => {
      tables[doc.id] = doc.data();
    });
    callback(tables);
  });
};

// Get specific table data
export const getTable = async (tableId) => {
  try {
    // Validate tableId is a string
    if (typeof tableId !== 'string' && typeof tableId !== 'number') {
      console.error('Invalid tableId:', tableId);
      return null;
    }
    
    // Convert to string if it's a number
    const stringTableId = String(tableId);
    
    const tableDoc = await getDoc(doc(tablesCollection, stringTableId));
    return tableDoc.exists() ? tableDoc.data() : null;
  } catch (error) {
    console.error('Error getting table:', error);
    return null;
  }
};

// Update or create table
export const updateTable = async (tableId, tableData) => {
  try {
    // Validate tableId is a string
    if (typeof tableId !== 'string' && typeof tableId !== 'number') {
      console.error('Invalid tableId:', tableId);
      return;
    }
    
    // Convert to string if it's a number
    const stringTableId = String(tableId);
    
    // Validate tableData is an object
    if (typeof tableData !== 'object' || tableData === null) {
      console.error('Invalid tableData:', tableData);
      return;
    }
    
    await setDoc(doc(tablesCollection, stringTableId), tableData);
  } catch (error) {
    console.error('Error updating table:', error);
  }
};

// Delete table
export const deleteTable = async (tableId) => {
  try {
    // Validate tableId is a string
    if (typeof tableId !== 'string' && typeof tableId !== 'number') {
      console.error('Invalid tableId:', tableId);
      return;
    }
    
    // Convert to string if it's a number
    const stringTableId = String(tableId);
    
    await deleteDoc(doc(tablesCollection, stringTableId));
  } catch (error) {
    console.error('Error deleting table:', error);
  }
};

// Get all history
export const getAllHistory = async () => {
  try {
    const historySnapshot = await getDocs(
      query(historyCollection, orderBy('timestamp', 'desc'))
    );
    const history = [];
    historySnapshot.forEach((doc) => {
      history.push({ id: doc.id, ...doc.data() });
    });
    return history;
  } catch (error) {
    console.error('Error getting history:', error);
    return [];
  }
};

// Subscribe to real-time history updates
export const subscribeToHistory = (callback) => {
  if (typeof callback !== 'function') {
    console.error('Callback must be a function');
    return () => {};
  }
  
  return onSnapshot(
    query(historyCollection, orderBy('timestamp', 'desc')),
    (snapshot) => {
      const history = [];
      snapshot.forEach((doc) => {
        history.push({ id: doc.id, ...doc.data() });
      });
      callback(history);
    }
  );
};

// Add history entry
export const addHistory = async (historyData) => {
  try {
    // Validate historyData is an object
    if (typeof historyData !== 'object' || historyData === null) {
      console.error('Invalid historyData:', historyData);
      return;
    }
    
    const historyId = Date.now().toString();
    await setDoc(doc(historyCollection, historyId), historyData);
  } catch (error) {
    console.error('Error adding history:', error);
  }
};

// Delete history
export const deleteHistory = async (historyId) => {
  try {
    // Validate historyId is a string
    if (typeof historyId !== 'string' && typeof historyId !== 'number') {
      console.error('Invalid historyId:', historyId);
      return;
    }
    
    // Convert to string if it's a number
    const stringHistoryId = String(historyId);
    
    await deleteDoc(doc(historyCollection, stringHistoryId));
  } catch (error) {
    console.error('Error deleting history:', error);
  }
};

// Clear all history
export const clearAllHistory = async () => {
  try {
    const historySnapshot = await getDocs(historyCollection);
    const deletePromises = historySnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error clearing history:', error);
  }
};

// MENU ITEMS FUNCTIONS

// Get all menu items
export const getAllMenuItems = async () => {
  try {
    const menuItemsSnapshot = await getDocs(
      query(menuItemsCollection, orderBy('sequence', 'asc'))
    );
    const menuItems = [];
    menuItemsSnapshot.forEach((doc) => {
      menuItems.push({ id: doc.id, ...doc.data() });
    });
    return menuItems;
  } catch (error) {
    console.error('Error getting menu items:', error);
    return [];
  }
};

// Subscribe to real-time menu items updates
export const subscribeToMenuItems = (callback) => {
  if (typeof callback !== 'function') {
    console.error('Callback must be a function');
    return () => {};
  }
  
  return onSnapshot(
    query(menuItemsCollection, orderBy('sequence', 'asc')),
    (snapshot) => {
      const menuItems = [];
      snapshot.forEach((doc) => {
        menuItems.push({ id: doc.id, ...doc.data() });
      });
      callback(menuItems);
    },
    (error) => {
      console.error('Error subscribing to menu items:', error);
    }
  );
};

// Add a new menu item
export const addMenuItem = async (menuItemData) => {
  try {
    // Validate menuItemData is an object
    if (typeof menuItemData !== 'object' || menuItemData === null) {
      console.error('Invalid menuItemData:', menuItemData);
      return null;
    }
    
    const menuItemId = menuItemData.id || Date.now().toString();
    await setDoc(doc(menuItemsCollection, menuItemId), menuItemData);
    return menuItemId;
  } catch (error) {
    console.error('Error adding menu item:', error);
    return null;
  }
};

// Update a menu item
export const updateMenuItem = async (menuItemId, menuItemData) => {
  try {
    // Validate menuItemId is a string
    if (typeof menuItemId !== 'string' && typeof menuItemId !== 'number') {
      console.error('Invalid menuItemId:', menuItemId);
      return;
    }
    
    // Convert to string if it's a number
    const stringMenuItemId = String(menuItemId);
    
    // Validate menuItemData is an object
    if (typeof menuItemData !== 'object' || menuItemData === null) {
      console.error('Invalid menuItemData:', menuItemData);
      return;
    }
    
    await updateDoc(doc(menuItemsCollection, stringMenuItemId), menuItemData);
  } catch (error) {
    console.error('Error updating menu item:', error);
  }
};

// Delete a menu item
export const deleteMenuItem = async (menuItemId) => {
  try {
    // Validate menuItemId is a string
    if (typeof menuItemId !== 'string' && typeof menuItemId !== 'number') {
      console.error('Invalid menuItemId:', menuItemId);
      return;
    }
    
    // Convert to string if it's a number
    const stringMenuItemId = String(menuItemId);
    
    await deleteDoc(doc(menuItemsCollection, stringMenuItemId));
  } catch (error) {
    console.error('Error deleting menu item:', error);
  }
};

// Update menu item sequence/position
export const updateMenuItemSequence = async (menuItemId, sequence) => {
  try {
    // Validate menuItemId is a string
    if (typeof menuItemId !== 'string' && typeof menuItemId !== 'number') {
      console.error('Invalid menuItemId:', menuItemId);
      return;
    }
    
    // Convert to string if it's a number
    const stringMenuItemId = String(menuItemId);
    
    // Validate sequence is a number
    if (typeof sequence !== 'number') {
      console.error('Invalid sequence:', sequence);
      return;
    }
    
    await updateDoc(doc(menuItemsCollection, stringMenuItemId), { sequence });
  } catch (error) {
    console.error('Error updating menu item sequence:', error);
  }
};

// Bulk update menu items (for reordering) - Sequential update to ensure atomicity
export const bulkUpdateMenuItems = async (menuItems) => {
  try {
    // Validate menuItems is an array
    if (!Array.isArray(menuItems)) {
      console.error('Invalid menuItems array:', menuItems);
      throw new Error('Invalid menuItems array');
    }
    
    // Process updates sequentially to ensure atomicity and avoid race conditions
    for (const item of menuItems) {
      if (item.id) {
        await updateDoc(doc(menuItemsCollection, String(item.id)), {
          sequence: item.sequence,
          name: item.name,
          price: item.price,
          available: item.available
        });
      }
    }
    
    console.log('Successfully updated menu item sequences');
  } catch (error) {
    console.error('Error bulk updating menu items:', error);
    throw error; // Re-throw to allow caller to handle
  }
};

// Toggle menu item availability
export const toggleMenuItemAvailability = async (menuItemId, currentAvailability) => {
  try {
    // Validate menuItemId is a string
    if (typeof menuItemId !== 'string' && typeof menuItemId !== 'number') {
      console.error('Invalid menuItemId:', menuItemId);
      return;
    }
    
    // Convert to string if it's a number
    const stringMenuItemId = String(menuItemId);
    
    // Validate currentAvailability is a boolean
    if (typeof currentAvailability !== 'boolean') {
      console.error('Invalid currentAvailability:', currentAvailability);
      return;
    }
    
    await updateDoc(doc(menuItemsCollection, stringMenuItemId), { 
      available: !currentAvailability 
    });
  } catch (error) {
    console.error('Error toggling menu item availability:', error);
  }
};