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
  where,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';

// Import performance monitoring utilities
import { monitorFirebaseOperation, monitorFirestoreListener } from '../utils/performanceMonitor';

// Collection references
const tablesCollection = collection(db, 'tables');
const historyCollection = collection(db, 'history');
const menuItemsCollection = collection(db, 'menuItems');

// Get all tables data with performance monitoring
export const getAllTables = async () => {
  try {
    return await monitorFirebaseOperation('getAllTables', async () => {
      const tablesSnapshot = await getDocs(tablesCollection);
      const tables = {};
      tablesSnapshot.forEach((doc) => {
        tables[doc.id] = doc.data();
      });
      return tables;
    });
  } catch (error) {
    console.error('Error getting tables:', error);
    return {};
  }
};

// Subscribe to real-time tables updates
export const subscribeToTables = (callback) => {
  const unsubscribe = onSnapshot(tablesCollection, (snapshot) => {
    const tables = {};
    snapshot.forEach((doc) => {
      tables[doc.id] = doc.data();
    });
    callback(tables);
  });
  
  // Return wrapped unsubscribe for performance monitoring
  return monitorFirestoreListener('tables_subscription', unsubscribe);
};

// Get specific table data with performance monitoring
export const getTable = async (tableId) => {
  try {
    // Validate tableId is a string
    if (typeof tableId !== 'string' && typeof tableId !== 'number') {
      console.error('Invalid tableId:', tableId);
      return null;
    }
    
    // Convert to string if it's a number
    const stringTableId = String(tableId);
    
    return await monitorFirebaseOperation('getTable', async () => {
      const tableDoc = await getDoc(doc(tablesCollection, stringTableId));
      return tableDoc.exists() ? tableDoc.data() : null;
    });
  } catch (error) {
    console.error('Error getting table:', error);
    return null;
  }
};

// Update or create table with performance monitoring
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
    
    // Monitor the operation
    await monitorFirebaseOperation('updateTable', async () => {
      await setDoc(doc(tablesCollection, stringTableId), tableData);
    });
  } catch (error) {
    console.error('Error updating table:', error);
  }
};

// Delete table with performance monitoring
export const deleteTable = async (tableId) => {
  try {
    // Validate tableId is a string
    if (typeof tableId !== 'string' && typeof tableId !== 'number') {
      console.error('Invalid tableId:', tableId);
      return;
    }
    
    // Convert to string if it's a number
    const stringTableId = String(tableId);
    
    // Monitor the operation
    await monitorFirebaseOperation('deleteTable', async () => {
      await deleteDoc(doc(tablesCollection, stringTableId));
    });
  } catch (error) {
    console.error('Error deleting table:', error);
  }
};

// Get all history with performance monitoring
export const getAllHistory = async () => {
  try {
    return await monitorFirebaseOperation('getAllHistory', async () => {
      const historySnapshot = await getDocs(
        query(historyCollection, orderBy('timestamp', 'desc'))
      );
      const history = [];
      historySnapshot.forEach((doc) => {
        history.push({ id: doc.id, ...doc.data() });
      });
      return history;
    });
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
  
  const unsubscribe = onSnapshot(
    query(historyCollection, orderBy('timestamp', 'desc')),
    (snapshot) => {
      const history = [];
      snapshot.forEach((doc) => {
        history.push({ id: doc.id, ...doc.data() });
      });
      callback(history);
    }
  );
  
  // Return wrapped unsubscribe for performance monitoring
  return monitorFirestoreListener('history_subscription', unsubscribe);
};

// Add history entry with performance monitoring
export const addHistory = async (historyData) => {
  try {
    // Validate historyData is an object
    if (typeof historyData !== 'object' || historyData === null) {
      console.error('Invalid historyData:', historyData);
      return;
    }
    
    const historyId = Date.now().toString();
    
    // Monitor the operation
    await monitorFirebaseOperation('addHistory', async () => {
      await setDoc(doc(historyCollection, historyId), {
        ...historyData,
        timestamp: serverTimestamp()
      });
    });
  } catch (error) {
    console.error('Error adding history:', error);
  }
};

// Delete history with performance monitoring
export const deleteHistory = async (historyId) => {
  try {
    // Validate historyId is a string
    if (typeof historyId !== 'string' && typeof historyId !== 'number') {
      console.error('Invalid historyId:', historyId);
      return;
    }
    
    // Convert to string if it's a number
    const stringHistoryId = String(historyId);
    
    // Monitor the operation
    await monitorFirebaseOperation('deleteHistory', async () => {
      await deleteDoc(doc(historyCollection, stringHistoryId));
    });
  } catch (error) {
    console.error('Error deleting history:', error);
  }
};

// Clear all history with performance monitoring
export const clearAllHistory = async () => {
  try {
    await monitorFirebaseOperation('clearAllHistory', async () => {
      const historySnapshot = await getDocs(historyCollection);
      const deletePromises = historySnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
    });
  } catch (error) {
    console.error('Error clearing history:', error);
  }
};

// MENU ITEMS FUNCTIONS

// Get all menu items with performance monitoring
export const getAllMenuItems = async () => {
  try {
    return await monitorFirebaseOperation('getAllMenuItems', async () => {
      const menuItemsSnapshot = await getDocs(
        query(menuItemsCollection, orderBy('sequence', 'asc'))
      );
      const menuItems = [];
      menuItemsSnapshot.forEach((doc) => {
        menuItems.push({ id: doc.id, ...doc.data() });
      });
      return menuItems;
    });
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
  
  const unsubscribe = onSnapshot(
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
  
  // Return wrapped unsubscribe for performance monitoring
  return monitorFirestoreListener('menuItems_subscription', unsubscribe);
};

// Add a new menu item with performance monitoring
export const addMenuItem = async (menuItemData) => {
  try {
    // Validate menuItemData is an object
    if (typeof menuItemData !== 'object' || menuItemData === null) {
      console.error('Invalid menuItemData:', menuItemData);
      return null;
    }
    
    const menuItemId = menuItemData.id || Date.now().toString();
    
    // Monitor the operation
    await monitorFirebaseOperation('addMenuItem', async () => {
      await setDoc(doc(menuItemsCollection, menuItemId), {
        ...menuItemData,
        version: 1, // Initialize version
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });
    
    return menuItemId;
  } catch (error) {
    console.error('Error adding menu item:', error);
    return null;
  }
};

// Update a menu item with version tracking
export const updateMenuItem = async (menuItemId, menuItemData, currentVersion = 0) => {
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
    
    // Monitor the operation
    await monitorFirebaseOperation('updateMenuItem', async () => {
      await updateDoc(doc(menuItemsCollection, stringMenuItemId), {
        ...menuItemData,
        version: currentVersion + 1,
        updatedAt: serverTimestamp()
      });
    });
  } catch (error) {
    console.error('Error updating menu item:', error);
  }
};

// Delete a menu item with performance monitoring
export const deleteMenuItem = async (menuItemId) => {
  try {
    // Validate menuItemId is a string
    if (typeof menuItemId !== 'string' && typeof menuItemId !== 'number') {
      console.error('Invalid menuItemId:', menuItemId);
      return;
    }
    
    // Convert to string if it's a number
    const stringMenuItemId = String(menuItemId);
    
    // Monitor the operation
    await monitorFirebaseOperation('deleteMenuItem', async () => {
      await deleteDoc(doc(menuItemsCollection, stringMenuItemId));
    });
  } catch (error) {
    console.error('Error deleting menu item:', error);
  }
};

// Update menu item sequence/position with version tracking
export const updateMenuItemSequence = async (menuItemId, sequence, currentVersion = 0) => {
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
    
    // Monitor the operation
    await monitorFirebaseOperation('updateMenuItemSequence', async () => {
      await updateDoc(doc(menuItemsCollection, stringMenuItemId), { 
        sequence,
        version: currentVersion + 1,
        updatedAt: serverTimestamp()
      });
    });
  } catch (error) {
    console.error('Error updating menu item sequence:', error);
  }
};

// Bulk update menu items (for reordering) - Batched write for better performance
export const bulkUpdateMenuItems = async (menuItems) => {
  try {
    // Validate menuItems is an array
    if (!Array.isArray(menuItems)) {
      console.error('Invalid menuItems array:', menuItems);
      throw new Error('Invalid menuItems array');
    }
    
    // Create a batch write operation
    const batch = writeBatch(db);
    
    // Add all updates to the batch
    menuItems.forEach(item => {
      if (item.id) {
        const docRef = doc(menuItemsCollection, String(item.id));
        batch.update(docRef, {
          sequence: item.sequence,
          name: item.name,
          price: item.price,
          available: item.available,
          version: (item.version || 0) + 1, // Increment version for conflict detection
          updatedAt: serverTimestamp()
        });
      }
    });
    
    // Commit all updates atomically
    await batch.commit();
    console.log(`Successfully updated ${menuItems.length} menu items in batch`);
  } catch (error) {
    console.error('Error bulk updating menu items:', error);
    throw error; // Re-throw to allow caller to handle
  }
};

// Toggle menu item availability with version tracking
export const toggleMenuItemAvailability = async (menuItemId, currentAvailability, currentVersion = 0) => {
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
      available: !currentAvailability,
      version: currentVersion + 1,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error toggling menu item availability:', error);
  }
};

// Update menu item with version checking (optimistic concurrency control)
export const updateMenuItemWithVersion = async (menuItemId, menuItemData, expectedVersion) => {
  try {
    // Validate inputs
    if (typeof menuItemId !== 'string' && typeof menuItemId !== 'number') {
      console.error('Invalid menuItemId:', menuItemId);
      return false;
    }
    
    if (typeof menuItemData !== 'object' || menuItemData === null) {
      console.error('Invalid menuItemData:', menuItemData);
      return false;
    }
    
    if (typeof expectedVersion !== 'number') {
      console.error('Invalid expectedVersion:', expectedVersion);
      return false;
    }
    
    const stringMenuItemId = String(menuItemId);
    
    // First, get current document to check version
    const docRef = doc(menuItemsCollection, stringMenuItemId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      console.error('Document does not exist:', menuItemId);
      return false;
    }
    
    const currentData = docSnap.data();
    
    // Check for version conflict
    if (currentData.version !== expectedVersion) {
      console.warn(`Version conflict for item ${menuItemId}: expected ${expectedVersion}, found ${currentData.version}`);
      return false;
    }
    
    // Update with incremented version
    await updateDoc(docRef, {
      ...menuItemData,
      version: expectedVersion + 1,
      updatedAt: serverTimestamp()
    });
    
    return true;
  } catch (error) {
    console.error('Error updating menu item with version check:', error);
    return false;
  }
};

// Retry mechanism with exponential backoff for conflict resolution
export const retryWithBackoff = async (operation, maxRetries = 3, baseDelay = 100) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // If it's not a retryable error, throw immediately
      if (!error.message?.includes('conflict') && !error.message?.includes('version')) {
        throw error;
      }
      
      // If we've exhausted retries, throw the last error
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff with jitter
      const delay = Math.min(baseDelay * Math.pow(2, attempt), 1000) + Math.random() * 100;
      console.log(`Retry attempt ${attempt + 1}/${maxRetries + 1} in ${delay}ms due to:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};