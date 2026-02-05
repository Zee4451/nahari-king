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
  serverTimestamp,
  Timestamp,
  limit,
  startAfter
} from 'firebase/firestore';

// Import performance monitoring utilities
import { monitorFirebaseOperation, monitorFirestoreListener } from '../utils/performanceMonitor';

// Collection references
const tablesCollection = collection(db, 'tables');
const historyCollection = collection(db, 'history');
const menuItemsCollection = collection(db, 'menuItems');

// Inventory collection references
const inventoryItemsCollection = collection(db, 'inventory_items');
const purchaseRecordsCollection = collection(db, 'purchase_records');
const usageLogsCollection = collection(db, 'usage_logs');
const wasteEntriesCollection = collection(db, 'waste_entries');

// Cache implementation for better performance
const cache = new Map();
const CACHE_TTL = 180000; // Increase to 3 minutes cache TTL for better hit rate

// Cache statistics
const cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0
};

// Pending operations to prevent duplicate requests
const pendingOperations = new Map();

// Cache helper functions
const getCached = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    cacheStats.hits++;
    return cached.data;
  }
  cacheStats.misses++;
  if (cached) {
    cache.delete(key);
  }
  return null;
};

const setCached = (key, data) => {
  cacheStats.sets++;
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
};

// Debounce helper for preventing excessive Firebase calls
const debounceOperation = (operationKey, operationFn, delay = 100) => {
  return new Promise((resolve, reject) => {
    // Clear any pending timeout for this operation
    if (pendingOperations.has(operationKey)) {
      clearTimeout(pendingOperations.get(operationKey));
    }
    
    // Store the latest operation to apply when timeout completes
    const timeoutId = setTimeout(async () => {
      try {
        const result = await operationFn();
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        pendingOperations.delete(operationKey);
      }
    }, delay);
    
    pendingOperations.set(operationKey, timeoutId);
  });
};

// Export cache statistics
export const getCacheStats = () => ({ ...cacheStats });
export const clearAllCache = () => {
  cache.clear();
  cacheStats.hits = 0;
  cacheStats.misses = 0;
  cacheStats.sets = 0;
};

// Manual cache clearing utility
export const clearCacheByPattern = (pattern) => {
  clearCache(pattern);
};

const clearCache = (pattern) => {
  if (pattern) {
    let clearedCount = 0;
    for (const key of cache.keys()) {
      if (key.includes(pattern)) {
        cache.delete(key);
        clearedCount++;
      }
    }
  } else {
    const size = cache.size;
    cache.clear();
  }
};

// Connection state management
let isOnline = navigator.onLine;
let connectionListeners = [];

const updateConnectionState = (state) => {
  isOnline = state;
  connectionListeners.forEach(callback => callback(state));
};

// Monitor connection changes
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    updateConnectionState(true);
  });
  
  window.addEventListener('offline', () => {
    updateConnectionState(false);
  });
}

// Export connection state utilities
export const getConnectionState = () => {
  return isOnline;
};

export const onConnectionStateChange = (callback) => {
  connectionListeners.push(callback);
  return () => {
    connectionListeners = connectionListeners.filter(cb => cb !== callback);
  };
};

// Get all tables data with performance monitoring and caching
export const getAllTables = async () => {
  try {
    // Check cache first
    const cachedData = getCached('tables');
    if (cachedData && isOnline) {
      return cachedData;
    }
    
    return await monitorFirebaseOperation('getAllTables', async () => {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firebase timeout')), 60000)
      );
      
      const firebasePromise = getDocs(tablesCollection);
      const tablesSnapshot = await Promise.race([firebasePromise, timeoutPromise]);
      
      const tables = {};
      tablesSnapshot.forEach((doc) => {
        // Only include necessary fields to reduce payload
        const data = doc.data();
        tables[doc.id] = {
          id: data.id,
          orders: Array.isArray(data.orders) ? data.orders : [],
          total: typeof data.total === 'number' ? data.total : 0,
          timestamp: data.timestamp
        };
      });
      
      // Cache the result
      setCached('tables', tables);
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

// Update or create table with performance monitoring, caching, and batch optimization
export const updateTable = async (tableId, tableData) => {
  try {
    // Check connection state before proceeding
    if (!isOnline) {
      console.warn('Device is offline, cannot update table');
      return;
    }
    
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
    
    // Debounce rapid updates to prevent excessive Firebase calls
    if (!updateTable._pendingUpdates) {
      updateTable._pendingUpdates = {};
    }
    
    // Clear any pending timeout for this table
    if (updateTable._pendingUpdates[stringTableId]) {
      clearTimeout(updateTable._pendingUpdates[stringTableId]);
    }
    
    // Store the latest data to apply when timeout completes
    updateTable._pendingUpdates[stringTableId] = tableData;
    
    // Create a small delay to debounce rapid updates
    await new Promise(resolve => {
      updateTable._pendingUpdates[stringTableId] = setTimeout(async () => {
        try {
          // Clear relevant cache entries
          clearCache('tables');
          
          // Monitor the operation
          await monitorFirebaseOperation('updateTable', async () => {
            // Add timeout to prevent hanging
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Firebase timeout')), 60000)
            );
            
            const firebasePromise = setDoc(doc(tablesCollection, stringTableId), tableData);
            await Promise.race([firebasePromise, timeoutPromise]);
          });
        } catch (error) {
          console.error('Error updating table:', error);
        } finally {
          // Clean up the pending update reference
          delete updateTable._pendingUpdates[stringTableId];
        }
      }, 50); // 50ms debounce period
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

// Add a history entry with performance monitoring
export const addHistory = async (historyEntry) => {
  try {
    console.log('Adding history entry:', historyEntry);
    
    // Validate historyEntry is an object
    if (typeof historyEntry !== 'object' || historyEntry === null) {
      console.error('Invalid historyEntry:', historyEntry);
      return false;
    }
    
    const historyId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    
    // Monitor the operation
    await monitorFirebaseOperation('addHistory', async () => {
      await setDoc(doc(historyCollection, historyId), {
        ...historyEntry,
        timestamp: serverTimestamp()
      });
    });
    
    console.log('History entry added successfully with ID:', historyId);
    return true;
  } catch (error) {
    console.error('Error adding history:', error);
    return false;
  }
};

// Batch update tables for better performance
export const batchUpdateTables = async (tablesUpdates) => {
  try {
    // Validate input
    if (!Array.isArray(tablesUpdates) || tablesUpdates.length === 0) {
      console.error('Invalid tablesUpdates array:', tablesUpdates);
      return false;
    }
    
    return await monitorFirebaseOperation('batchUpdateTables', async () => {
      const batch = writeBatch(db);
      
      tablesUpdates.forEach(({ tableId, tableData }) => {
        if (tableId && tableData) {
          const stringTableId = String(tableId);
          const docRef = doc(tablesCollection, stringTableId);
          batch.set(docRef, tableData);
        }
      });
      
      await batch.commit();
      
      // Clear cache after batch update
      clearCache('tables');
      
      return true;
    });
  } catch (error) {
    console.error('Error in batch update tables:', error);
    return false;
  }
};

// Batch add history entries
export const batchAddHistory = async (historyEntries) => {
  try {
    // Validate input
    if (!Array.isArray(historyEntries) || historyEntries.length === 0) {
      console.error('Invalid historyEntries array:', historyEntries);
      return false;
    }
    
    return await monitorFirebaseOperation('batchAddHistory', async () => {
      const batch = writeBatch(db);
      
      historyEntries.forEach((entry) => {
        if (entry) {
          const historyId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
          const docRef = doc(historyCollection, historyId);
          batch.set(docRef, {
            ...entry,
            timestamp: serverTimestamp()
          });
        }
      });
      
      await batch.commit();
      return true;
    });
  } catch (error) {
    console.error('Error in batch add history:', error);
    return false;
  }
};

// Optimized get specific tables (for partial loading)
export const getTablesByIds = async (tableIds) => {
  try {
    if (!Array.isArray(tableIds) || tableIds.length === 0) {
      return {};
    }
    
    // Check cache first
    const cacheKey = `tables_${tableIds.sort().join('_')}`;
    const cachedData = getCached(cacheKey);
    if (cachedData && isOnline) {
      return cachedData;
    }
    
    return await monitorFirebaseOperation('getTablesByIds', async () => {
      const tables = {};
      
      // Process in batches to avoid hitting limits
      const batchSize = 10;
      for (let i = 0; i < tableIds.length; i += batchSize) {
        const batchIds = tableIds.slice(i, i + batchSize);
        const promises = batchIds.map(id => getDoc(doc(tablesCollection, String(id))));
        const docs = await Promise.all(promises);
        
        docs.forEach((docSnap, index) => {
          if (docSnap.exists()) {
            tables[batchIds[index]] = docSnap.data();
          }
        });
      }
      
      // Cache the result
      setCached(cacheKey, tables);
      return tables;
    });
  } catch (error) {
    console.error('Error getting specific tables:', error);
    return {};
  }
};
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

// Get all menu items with performance monitoring and caching
export const getAllMenuItems = async () => {
  try {
    // Check cache first
    const cachedData = getCached('menuItems');
    if (cachedData && isOnline) {
      return cachedData;
    }
    
    return await monitorFirebaseOperation('getAllMenuItems', async () => {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firebase timeout')), 30000)
      );
      
      const firebasePromise = getDocs(query(menuItemsCollection, orderBy('sequence', 'asc')));
      const menuItemsSnapshot = await Promise.race([firebasePromise, timeoutPromise]);
      
      const menuItems = [];
      menuItemsSnapshot.forEach((doc) => {
        // Only include necessary fields to reduce payload
        const data = doc.data();
        menuItems.push({ 
          id: doc.id, 
          name: data.name || '',
          price: typeof data.price === 'number' ? data.price : 0,
          available: data.available !== undefined ? data.available : true,
          sequence: typeof data.sequence === 'number' ? data.sequence : 0,
          category: data.category || ''
        });
      });
      
      // Cache the result
      setCached('menuItems', menuItems);
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
    console.log('updateMenuItem called with:', { menuItemId, menuItemData, currentVersion });
    
    // Validate menuItemId is a string
    if (typeof menuItemId !== 'string' && typeof menuItemId !== 'number') {
      console.error('Invalid menuItemId:', menuItemId);
      return false;
    }
    
    // Convert to string if it's a number
    const stringMenuItemId = String(menuItemId);
    console.log('Using document ID:', stringMenuItemId);
    
    // Validate menuItemData is an object
    if (typeof menuItemData !== 'object' || menuItemData === null) {
      console.error('Invalid menuItemData:', menuItemData);
      return false;
    }
    
    // Log the data being sent
    console.log('Updating with data:', {
      ...menuItemData,
      version: currentVersion + 1,
      updatedAt: 'serverTimestamp()'
    });
    
    // Monitor the operation
    await monitorFirebaseOperation('updateMenuItem', async () => {
      await updateDoc(doc(menuItemsCollection, stringMenuItemId), {
        ...menuItemData,
        version: currentVersion + 1,
        updatedAt: serverTimestamp()
      });
    });
    
    console.log('Update successful for item:', menuItemId);
    return true; // Return success
  } catch (error) {
    console.error('Error updating menu item:', error);
    console.error('Error details:', {
      menuItemId,
      menuItemData,
      currentVersion,
      errorMessage: error.message,
      errorStack: error.stack
    });
    return false; // Return failure
  }
};

// Delete a menu item with performance monitoring
export const deleteMenuItem = async (menuItemId) => {
  try {
    // Validate menuItemId is a string
    if (typeof menuItemId !== 'string' && typeof menuItemId !== 'number') {
      console.error('Invalid menuItemId:', menuItemId);
      return false;
    }
    
    // Convert to string if it's a number
    const stringMenuItemId = String(menuItemId);
    
    // Monitor the operation
    await monitorFirebaseOperation('deleteMenuItem', async () => {
      await deleteDoc(doc(menuItemsCollection, stringMenuItemId));
    });
    
    return true; // Return success
  } catch (error) {
    console.error('Error deleting menu item:', error);
    return false; // Return failure
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
  } catch (error) {
    console.error('Error bulk updating menu items:', error);
    throw error; // Re-throw to allow caller to handle
  }
};

// Toggle menu item availability with proper return value
export const toggleMenuItemAvailability = async (menuItemId, currentAvailability, currentVersion = 0) => {
  try {
    // Validate menuItemId is a string
    if (typeof menuItemId !== 'string' && typeof menuItemId !== 'number') {
      console.error('Invalid menuItemId:', menuItemId);
      return false;
    }
    
    // Convert to string if it's a number
    const stringMenuItemId = String(menuItemId);
    
    // Validate currentAvailability is a boolean
    if (typeof currentAvailability !== 'boolean') {
      console.error('Invalid currentAvailability:', currentAvailability);
      return false;
    }
    
    await updateDoc(doc(menuItemsCollection, stringMenuItemId), { 
      available: !currentAvailability,
      version: currentVersion + 1,
      updatedAt: serverTimestamp()
    });
    
    return true; // Return success
  } catch (error) {
    console.error('Error toggling menu item availability:', error);
    return false; // Return failure
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
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
};

// Get paged tables data for pagination
export const getPagedTables = async (lastDoc = null, pageSize = 10) => {
  try {
    let q = query(tablesCollection, orderBy('__name__'), limit(pageSize));
    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }
    
    const tablesSnapshot = await getDocs(q);
    const tables = {};
    tablesSnapshot.forEach((doc) => {
      tables[doc.id] = {
        id: doc.id,
        orders: doc.data().orders || [],
        total: doc.data().total || 0,
        ...doc.data()
      };
    });
    
    const lastVisible = tablesSnapshot.docs[tablesSnapshot.docs.length - 1];
    
    return { tables, lastVisible };
  } catch (error) {
    console.error('Error getting paged tables:', error);
    return { tables: {}, lastVisible: null };
  }
};

// Get paged menu items data for pagination
export const getPagedMenuItems = async (lastDoc = null, pageSize = 10) => {
  try {
    let q = query(menuItemsCollection, orderBy('sequence'), limit(pageSize));
    if (lastDoc) {
      q = query(q, startAfter(lastDoc));
    }
    
    const menuItemsSnapshot = await getDocs(q);
    const menuItems = [];
    menuItemsSnapshot.forEach((doc) => {
      const data = doc.data();
      menuItems.push({
        id: doc.id,
        name: data.name,
        price: data.price,
        available: data.available,
        sequence: data.sequence,
        ...data
      });
    });
    
    const lastVisible = menuItemsSnapshot.docs[menuItemsSnapshot.docs.length - 1];
    
    return { menuItems, lastVisible };
  } catch (error) {
    console.error('Error getting paged menu items:', error);
    return { menuItems: [], lastVisible: null };
  }
};

// Get specific fields for menu items to reduce payload
export const getMenuItemsSelective = async (fields = ['name', 'price', 'available', 'sequence']) => {
  try {
    // Check cache first
    const cacheKey = `menuItems_${fields.join('_')}`;
    const cachedData = getCached(cacheKey);
    if (cachedData && isOnline) {
      return cachedData;
    }
    
    const menuItemsSnapshot = await getDocs(query(menuItemsCollection, orderBy('sequence', 'asc')));
    const menuItems = [];
    
    menuItemsSnapshot.forEach((doc) => {
      const data = doc.data();
      const item = { id: doc.id };
      
      fields.forEach(field => {
        item[field] = data[field];
      });
      
      menuItems.push(item);
    });
    
    // Cache the result
    setCached(cacheKey, menuItems);
    
    return menuItems;
  } catch (error) {
    console.error('Error getting selective menu items:', error);
    return [];
  }
};

// ==================== ENHANCED INVENTORY MANAGEMENT FUNCTIONS ====================

// Enhanced function to check if inventory item already exists (prevent duplicates)
export const findExistingInventoryItem = async (itemName, category) => {
  try {
    const q = query(
      inventoryItemsCollection,
      where('name', '==', itemName.toLowerCase().trim()),
      where('category', '==', category)
    );
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
    return null;
  } catch (error) {
    console.error('Error finding existing inventory item:', error);
    return null;
  }
};

// Enhanced add inventory item with duplicate prevention
export const addInventoryItem = async (itemData) => {
  try {
    // Check if item already exists to prevent duplicates
    const existingItem = await findExistingInventoryItem(itemData.name, itemData.category);
    if (existingItem) {
      console.log('Item already exists:', existingItem.name);
      return existingItem.id; // Return existing item ID
    }
    
    const newItem = {
      ...itemData,
      name: itemData.name.toLowerCase().trim(), // Normalize name for consistency
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      currentStock: 0,
      totalPurchased: 0,
      totalUsed: 0,
      totalWasted: 0,
      // Enhanced fields for better tracking
      suppliers: [], // Array to track all suppliers who have supplied this item
      firstPurchaseDate: null,
      lastPurchaseDate: null
    };
    
    const docRef = doc(inventoryItemsCollection);
    await setDoc(docRef, newItem);
    return docRef.id;
  } catch (error) {
    console.error('Error adding inventory item:', error);
    throw error;
  }
};

// Enhanced record purchase with supplier tracking
export const recordPurchase = async (purchaseData) => {
  try {
    // Ensure we have required fields
    if (!purchaseData.itemId || !purchaseData.quantity || !purchaseData.unitCost) {
      throw new Error('Missing required purchase data fields');
    }
    
    const purchaseRecord = {
      ...purchaseData,
      timestamp: serverTimestamp(),
      type: 'purchase',
      // Enhanced tracking fields
      purchaseDate: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
      supplier: purchaseData.supplier || 'Unknown',
      notes: purchaseData.notes || ''
    };
    
    const docRef = doc(purchaseRecordsCollection);
    await setDoc(docRef, purchaseRecord);
    
    // Update inventory item with supplier information
    const itemRef = doc(db, 'inventory_items', purchaseData.itemId);
    const itemSnap = await getDoc(itemRef);
    if (itemSnap.exists()) {
      const currentItem = itemSnap.data();
      const purchaseAmount = parseFloat(purchaseData.quantity);
      
      // Update supplier tracking
      const suppliers = Array.isArray(currentItem.suppliers) ? [...currentItem.suppliers] : [];
      const supplierName = purchaseData.supplier || 'Unknown';
      
      if (!suppliers.includes(supplierName)) {
        suppliers.push(supplierName);
      }
      
      // Update dates
      const today = new Date();
      const firstPurchaseDate = currentItem.firstPurchaseDate || today;
      const lastPurchaseDate = today;
      
      await updateDoc(itemRef, {
        currentStock: currentItem.currentStock + purchaseAmount,
        totalPurchased: currentItem.totalPurchased + purchaseAmount,
        suppliers: suppliers,
        firstPurchaseDate: firstPurchaseDate,
        lastPurchaseDate: lastPurchaseDate,
        updatedAt: serverTimestamp()
      });
    }
    
    return docRef.id;
  } catch (error) {
    console.error('Error recording purchase:', error);
    throw error;
  }
};

// ==================== REPORTING AND ANALYTICS FUNCTIONS ====================

// Get usage records for an item within a specific date range
export const getItemUsageRecordsByDateRange = async (itemId, startDate, endDate) => {
  try {
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);
    
    const q = query(
      usageLogsCollection,
      where('itemId', '==', itemId),
      where('timestamp', '>=', startTimestamp),
      where('timestamp', '<=', endTimestamp),
      orderBy('timestamp', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const records = [];
    snapshot.forEach((doc) => {
      records.push({ id: doc.id, ...doc.data() });
    });
    return records;
  } catch (error) {
    console.error('Error getting usage records by date range:', error);
    throw error;
  }
};

// Get purchase records for an item within a specific date range
export const getItemPurchaseRecordsByDateRange = async (itemId, startDate, endDate) => {
  try {
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);
    
    const q = query(
      purchaseRecordsCollection,
      where('itemId', '==', itemId),
      where('timestamp', '>=', startTimestamp),
      where('timestamp', '<=', endTimestamp),
      orderBy('timestamp', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const records = [];
    snapshot.forEach((doc) => {
      records.push({ id: doc.id, ...doc.data() });
    });
    return records;
  } catch (error) {
    console.error('Error getting purchase records by date range:', error);
    throw error;
  }
};

// Get waste records for an item within a specific date range
export const getItemWasteRecordsByDateRange = async (itemId, startDate, endDate) => {
  try {
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);
    
    const q = query(
      wasteEntriesCollection,
      where('itemId', '==', itemId),
      where('timestamp', '>=', startTimestamp),
      where('timestamp', '<=', endTimestamp),
      orderBy('timestamp', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const records = [];
    snapshot.forEach((doc) => {
      records.push({ id: doc.id, ...doc.data() });
    });
    return records;
  } catch (error) {
    console.error('Error getting waste records by date range:', error);
    throw error;
  }
};

// Generate comprehensive usage report for a category within date range
export const getCategoryUsageReport = async (category, startDate, endDate) => {
  try {
    // First get all inventory items in the category
    const itemsQuery = query(
      inventoryItemsCollection,
      where('category', '==', category)
    );
    const itemsSnapshot = await getDocs(itemsQuery);
    
    const report = {
      category: category,
      startDate: startDate,
      endDate: endDate,
      items: [],
      totalUsage: 0,
      totalPurchases: 0,
      totalWaste: 0
    };
    
    for (const doc of itemsSnapshot.docs) {
      const item = { id: doc.id, ...doc.data() };
      
      if (!item || !item.id) continue; // Skip invalid items
      
      // Get usage records for this item
      let usageRecords = [];
      let purchaseRecords = [];
      let wasteRecords = [];
      
      try {
        usageRecords = await getItemUsageRecordsByDateRange(item.id, startDate, endDate);
        purchaseRecords = await getItemPurchaseRecordsByDateRange(item.id, startDate, endDate);
        wasteRecords = await getItemWasteRecordsByDateRange(item.id, startDate, endDate);
      } catch (error) {
        console.error(`Error fetching records for item ${item.id}:`, error);
        continue; // Skip this item if we can't get its records
      }
      
      // Calculate totals
      const totalUsage = Array.isArray(usageRecords) ? 
        usageRecords.reduce((sum, record) => sum + (record.quantity || 0), 0) : 0;
      const totalPurchases = Array.isArray(purchaseRecords) ? 
        purchaseRecords.reduce((sum, record) => sum + (record.quantity || 0), 0) : 0;
      const totalWaste = Array.isArray(wasteRecords) ? 
        wasteRecords.reduce((sum, record) => sum + (record.quantity || 0), 0) : 0;
      
      if (totalUsage > 0 || totalPurchases > 0 || totalWaste > 0) {
        report.items.push({
          ...item,
          usageRecords,
          purchaseRecords,
          wasteRecords,
          totalUsage,
          totalPurchases,
          totalWaste,
          usageBySupplier: groupBySupplier(purchaseRecords, usageRecords)
        });
        
        report.totalUsage += totalUsage;
        report.totalPurchases += totalPurchases;
        report.totalWaste += totalWaste;
      }
    }
    
    return report;
  } catch (error) {
    console.error('Error generating category usage report:', error);
    throw error;
  }
};

// Helper function to group usage by supplier
const groupBySupplier = (purchaseRecords, usageRecords) => {
  const supplierUsage = {};
  
  // Group purchases by supplier
  if (Array.isArray(purchaseRecords)) {
    purchaseRecords.forEach(record => {
      const supplier = record.supplier || 'Unknown';
      if (!supplierUsage[supplier]) {
        supplierUsage[supplier] = {
          purchased: 0,
          used: 0,
          waste: 0
        };
      }
      supplierUsage[supplier].purchased += record.quantity || 0;
    });
  }
  
  // For simplicity, we'll distribute usage proportionally based on purchases
  // In a more advanced system, you might track actual usage by supplier
  const totalPurchased = Array.isArray(purchaseRecords) ? 
    purchaseRecords.reduce((sum, record) => sum + (record.quantity || 0), 0) : 0;
  
  if (totalPurchased > 0 && Array.isArray(usageRecords)) {
    usageRecords.forEach(record => {
      const usageAmount = record.quantity || 0;
      if (Array.isArray(purchaseRecords)) {
        purchaseRecords.forEach(purchase => {
          const supplier = purchase.supplier || 'Unknown';
          const proportion = (purchase.quantity || 0) / totalPurchased;
          supplierUsage[supplier].used += usageAmount * proportion;
        });
      }
    });
  }
  
  return supplierUsage;
};

// Get supplier performance report
export const getSupplierPerformanceReport = async (startDate, endDate) => {
  try {
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);
    
    // Get all purchase records in date range
    const q = query(
      purchaseRecordsCollection,
      where('timestamp', '>=', startTimestamp),
      where('timestamp', '<=', endTimestamp),
      orderBy('timestamp', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const supplierData = {};
    
    snapshot.forEach((doc) => {
      const record = doc.data();
      if (!record) return; // Skip if record is null/undefined
      
      const supplier = record.supplier || 'Unknown';
      
      if (!supplierData[supplier]) {
        supplierData[supplier] = {
          totalPurchases: 0,
          totalAmount: 0,
          items: new Set(),
          firstPurchase: record.timestamp,
          lastPurchase: record.timestamp
        };
      }
      
      supplierData[supplier].totalPurchases += 1;
      supplierData[supplier].totalAmount += record.totalCost || 0;
      if (record.itemId) {
        supplierData[supplier].items.add(record.itemId);
      }
      
      if (record.timestamp && supplierData[supplier].firstPurchase && 
          record.timestamp.toMillis() < supplierData[supplier].firstPurchase.toMillis()) {
        supplierData[supplier].firstPurchase = record.timestamp;
      }
      if (record.timestamp && supplierData[supplier].lastPurchase && 
          record.timestamp.toMillis() > supplierData[supplier].lastPurchase.toMillis()) {
        supplierData[supplier].lastPurchase = record.timestamp;
      }
    });
    
    // Convert to array format
    const report = Object.entries(supplierData).map(([supplier, data]) => ({
      supplier,
      totalPurchases: data.totalPurchases,
      totalAmount: data.totalAmount,
      uniqueItems: data.items.size,
      firstPurchase: data.firstPurchase && typeof data.firstPurchase.toDate === 'function' ? 
                    data.firstPurchase.toDate() : new Date(),
      lastPurchase: data.lastPurchase && typeof data.lastPurchase.toDate === 'function' ? 
                   data.lastPurchase.toDate() : new Date(),
      averageOrderValue: data.totalPurchases > 0 ? data.totalAmount / data.totalPurchases : 0
    }));
    
    return report.sort((a, b) => (b.totalAmount || 0) - (a.totalAmount || 0));
  } catch (error) {
    console.error('Error generating supplier performance report:', error);
    throw error;
  }
};

// Get inventory turnover report
export const getInventoryTurnoverReport = async (startDate, endDate) => {
  try {
    const items = await getAllInventoryItems();
    if (!Array.isArray(items)) {
      throw new Error('Failed to fetch inventory items');
    }
    const report = [];
    
    for (const item of items) {
      if (!item || !item.id) continue; // Skip invalid items
      
      // Get usage and purchase data for the period
      let usageRecords = [];
      let purchaseRecords = [];
      
      try {
        usageRecords = await getItemUsageRecordsByDateRange(item.id, startDate, endDate);
        purchaseRecords = await getItemPurchaseRecordsByDateRange(item.id, startDate, endDate);
      } catch (error) {
        console.error(`Error fetching records for item ${item.id}:`, error);
        continue; // Skip this item if we can't get its records
      }
      
      const totalUsage = Array.isArray(usageRecords) ? 
        usageRecords.reduce((sum, record) => sum + (record.quantity || 0), 0) : 0;
      const totalPurchases = Array.isArray(purchaseRecords) ? 
        purchaseRecords.reduce((sum, record) => sum + (record.quantity || 0), 0) : 0;
      
      // Calculate average inventory (simplified method)
      const averageInventory = ((item.currentStock || 0) + ((item.currentStock || 0) - totalUsage + totalPurchases)) / 2;
      
      // Calculate turnover ratio
      const turnoverRatio = averageInventory > 0 ? totalUsage / averageInventory : 0;
      
      if (totalUsage > 0 || totalPurchases > 0) {
        report.push({
          ...item,
          totalUsage,
          totalPurchases,
          averageInventory,
          turnoverRatio,
          usageRecords,
          purchaseRecords
        });
      }
    }
    
    return report.sort((a, b) => (b.turnoverRatio || 0) - (a.turnoverRatio || 0));
  } catch (error) {
    console.error('Error generating inventory turnover report:', error);
    throw error;
  }
};

// ==================== BASIC INVENTORY FUNCTIONS ====================

// Get all inventory items with caching and performance optimization
export const getAllInventoryItems = async () => {
  try {
    // Check cache first
    const cachedData = getCached('inventory_items');
    if (cachedData && isOnline) {
      return cachedData;
    }
    
    return await monitorFirebaseOperation('getAllInventoryItems', async () => {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firebase timeout')), 30000)
      );
      
      const firebasePromise = getDocs(inventoryItemsCollection);
      const snapshot = await Promise.race([firebasePromise, timeoutPromise]);
      
      const items = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      
      // Cache the result
      setCached('inventory_items', items);
      return items;
    });
  } catch (error) {
    console.error('Error getting inventory items:', error);
    return []; // Return empty array instead of throwing to prevent cascading failures
  }
};

// Subscribe to inventory items updates with optimized handling
export const subscribeToInventoryItems = (callback) => {
  // Debounce rapid updates to prevent UI thrashing
  let lastCallbackTime = 0;
  const DEBOUNCE_DELAY = 100; // 100ms debounce
  
  return onSnapshot(
    inventoryItemsCollection,
    (snapshot) => {
      const now = Date.now();
      if (now - lastCallbackTime < DEBOUNCE_DELAY) {
        return; // Skip rapid updates
      }
      lastCallbackTime = now;
      
      const items = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      
      // Clear relevant cache
      clearCache('inventory_items');
      callback(items);
    },
    (error) => {
      console.error('Error subscribing to inventory items:', error);
    }
  );
};

// Subscribe to purchase records updates with optimized handling
export const subscribeToPurchaseRecords = (callback) => {
  // Debounce rapid updates to prevent UI thrashing
  let lastCallbackTime = 0;
  const DEBOUNCE_DELAY = 150; // 150ms debounce for purchase records
  
  return onSnapshot(
    purchaseRecordsCollection,
    (snapshot) => {
      const now = Date.now();
      if (now - lastCallbackTime < DEBOUNCE_DELAY) {
        return; // Skip rapid updates
      }
      lastCallbackTime = now;
      
      const records = [];
      snapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() });
      });
      
      callback(records);
    },
    (error) => {
      console.error('Error subscribing to purchase records:', error);
    }
  );
};

// Update inventory item
export const updateInventoryItem = async (itemId, updateData) => {
  try {
    const itemRef = doc(db, 'inventory_items', itemId);
    await updateDoc(itemRef, {
      ...updateData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating inventory item:', error);
    throw error;
  }
};

// Delete inventory item
export const deleteInventoryItem = async (itemId) => {
  try {
    const itemRef = doc(db, 'inventory_items', itemId);
    await deleteDoc(itemRef);
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    throw error;
  }
};

// Record inventory usage
export const recordUsage = async (usageData) => {
  try {
    const usageRecord = {
      ...usageData,
      timestamp: serverTimestamp(),
      type: 'usage'
    };
    
    const docRef = doc(usageLogsCollection);
    await setDoc(docRef, usageRecord);
    
    // Update inventory item stock
    const itemRef = doc(db, 'inventory_items', usageData.itemId);
    const itemSnap = await getDoc(itemRef);
    if (itemSnap.exists()) {
      const currentItem = itemSnap.data();
      const newStock = currentItem.currentStock - usageData.quantity;
      await updateDoc(itemRef, {
        currentStock: Math.max(0, newStock),
        totalUsed: currentItem.totalUsed + usageData.quantity,
        updatedAt: serverTimestamp()
      });
    }
    
    return docRef.id;
  } catch (error) {
    console.error('Error recording usage:', error);
    throw error;
  }
};

// Record inventory waste
export const recordWaste = async (wasteData) => {
  try {
    const wasteRecord = {
      ...wasteData,
      timestamp: serverTimestamp(),
      type: 'waste'
    };
    
    const docRef = doc(wasteEntriesCollection);
    await setDoc(docRef, wasteRecord);
    
    // Update inventory item stock
    const itemRef = doc(db, 'inventory_items', wasteData.itemId);
    const itemSnap = await getDoc(itemRef);
    if (itemSnap.exists()) {
      const currentItem = itemSnap.data();
      const newStock = currentItem.currentStock - wasteData.quantity;
      await updateDoc(itemRef, {
        currentStock: Math.max(0, newStock),
        totalWasted: currentItem.totalWasted + wasteData.quantity,
        updatedAt: serverTimestamp()
      });
    }
    
    return docRef.id;
  } catch (error) {
    console.error('Error recording waste:', error);
    throw error;
  }
};

// Get purchase records for an item
export const getItemPurchaseRecords = async (itemId) => {
  try {
    const q = query(
      purchaseRecordsCollection,
      where('itemId', '==', itemId),
      orderBy('timestamp', 'desc')
    );
    const snapshot = await getDocs(q);
    const records = [];
    snapshot.forEach((doc) => {
      records.push({ id: doc.id, ...doc.data() });
    });
    return records;
  } catch (error) {
    console.error('Error getting purchase records:', error);
    throw error;
  }
};

// Get usage records for an item
export const getItemUsageRecords = async (itemId) => {
  try {
    const q = query(
      usageLogsCollection,
      where('itemId', '==', itemId),
      orderBy('timestamp', 'desc')
    );
    const snapshot = await getDocs(q);
    const records = [];
    snapshot.forEach((doc) => {
      records.push({ id: doc.id, ...doc.data() });
    });
    return records;
  } catch (error) {
    console.error('Error getting usage records:', error);
    throw error;
  }
};

// Get waste records for an item
export const getItemWasteRecords = async (itemId) => {
  try {
    const q = query(
      wasteEntriesCollection,
      where('itemId', '==', itemId),
      orderBy('timestamp', 'desc')
    );
    const snapshot = await getDocs(q);
    const records = [];
    snapshot.forEach((doc) => {
      records.push({ id: doc.id, ...doc.data() });
    });
    return records;
  } catch (error) {
    console.error('Error getting waste records:', error);
    throw error;
  }
};

// Get all expense records for a date range with caching
export const getExpenseRecords = async (startDate, endDate) => {
  try {
    // Create cache key based on date range
    const cacheKey = `expense_records_${startDate.getTime()}_${endDate.getTime()}`;
    const cachedData = getCached(cacheKey);
    if (cachedData && isOnline) {
      return cachedData;
    }
    
    // Convert JavaScript dates to Firestore timestamps
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);
    
    const q = query(
      purchaseRecordsCollection,
      where('timestamp', '>=', startTimestamp),
      where('timestamp', '<=', endTimestamp),
      orderBy('timestamp', 'desc')
    );
    
    const snapshot = await getDocs(q);
    const records = [];
    snapshot.forEach((doc) => {
      records.push({ id: doc.id, ...doc.data() });
    });
    
    // Cache the result for 2 minutes (shorter since it's time-sensitive)
    setCached(cacheKey, records);
    return records;
  } catch (error) {
    console.error('Error getting expense records:', error);
    throw error;
  }
};

// Calculate total expenses for a period with caching
export const calculateTotalExpenses = async (startDate, endDate) => {
  try {
    // Create cache key based on date range
    const cacheKey = `total_expenses_${startDate.getTime()}_${endDate.getTime()}`;
    const cachedData = getCached(cacheKey);
    if (cachedData && isOnline) {
      return cachedData;
    }
    
    const records = await getExpenseRecords(startDate, endDate);
    const total = records.reduce((sum, record) => sum + (record.totalCost || 0), 0);
    
    // Cache the result for 2 minutes
    setCached(cacheKey, total);
    return total;
  } catch (error) {
    console.error('Error calculating total expenses:', error);
    throw error;
  }
};

// Get low stock items (items below minimum threshold)
export const getLowStockItems = async (threshold = 10) => {
  try {
    const q = query(
      inventoryItemsCollection,
      where('currentStock', '<=', threshold),
      where('currentStock', '>', 0)
    );
    const snapshot = await getDocs(q);
    const items = [];
    snapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() });
    });
    return items;
  } catch (error) {
    console.error('Error getting low stock items:', error);
    throw error;
  }
};

// Get out of stock items
export const getOutOfStockItems = async () => {
  try {
    const q = query(
      inventoryItemsCollection,
      where('currentStock', '==', 0)
    );
    const snapshot = await getDocs(q);
    const items = [];
    snapshot.forEach((doc) => {
      items.push({ id: doc.id, ...doc.data() });
    });
    return items;
  } catch (error) {
    console.error('Error getting out of stock items:', error);
    throw error;
  }
};

// Get all purchase records (for export)
export const getAllPurchaseRecords = async () => {
  try {
    const snapshot = await getDocs(purchaseRecordsCollection);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting all purchase records:', error);
    throw error;
  }
};

// Get all usage logs (for export)
export const getAllUsageLogs = async () => {
  try {
    const snapshot = await getDocs(usageLogsCollection);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting all usage logs:', error);
    throw error;
  }
};

// Get all waste entries (for export)
export const getAllWasteEntries = async () => {
  try {
    const snapshot = await getDocs(wasteEntriesCollection);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error getting all waste entries:', error);
    throw error;
  }
};

// Subscribe to real-time purchase records updates


// Subscribe to real-time usage logs updates
export const subscribeToUsageLogs = (callback) => {
  if (typeof callback !== 'function') {
    console.error('Callback must be a function');
    return () => {};
  }
  
  const unsubscribe = onSnapshot(usageLogsCollection, (snapshot) => {
    const logs = [];
    snapshot.forEach((doc) => {
      logs.push({
        id: doc.id,
        ...doc.data()
      });
    });
    callback(logs);
  });
  
  return unsubscribe;
};

// Subscribe to real-time waste entries updates
export const subscribeToWasteEntries = (callback) => {
  if (typeof callback !== 'function') {
    console.error('Callback must be a function');
    return () => {};
  }
  
  const unsubscribe = onSnapshot(wasteEntriesCollection, (snapshot) => {
    const entries = [];
    snapshot.forEach((doc) => {
      entries.push({
        id: doc.id,
        ...doc.data()
      });
    });
    callback(entries);
  });
  
  return unsubscribe;
};
