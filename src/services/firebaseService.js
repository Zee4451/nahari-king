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
  limit,
  startAfter
} from 'firebase/firestore';

// Import performance monitoring utilities
import { monitorFirebaseOperation, monitorFirestoreListener } from '../utils/performanceMonitor';

// Collection references
const tablesCollection = collection(db, 'tables');
const historyCollection = collection(db, 'history');
const menuItemsCollection = collection(db, 'menuItems');

// Cache implementation for better performance
const cache = new Map();
const CACHE_TTL = 120000; // Increase to 2 minutes cache TTL for better hit rate

// Cache statistics for debugging
const cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0
};

// Cache helper functions
const getCached = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    cacheStats.hits++;
    console.log(`Cache HIT for ${key}: ${cacheStats.hits} hits, ${cacheStats.misses} misses`);
    return cached.data;
  }
  cacheStats.misses++;
  if (cached) {
    console.log(`Cache EXPIRED for ${key}`);
    cache.delete(key);
  } else {
    console.log(`Cache MISS for ${key}`);
  }
  return null;
};

const setCached = (key, data) => {
  cacheStats.sets++;
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
  console.log(`Cache SET for ${key}. Total entries: ${cache.size}`);
};

// Export cache statistics for debugging
export const getCacheStats = () => ({ ...cacheStats });
export const clearAllCache = () => {
  cache.clear();
  cacheStats.hits = 0;
  cacheStats.misses = 0;
  cacheStats.sets = 0;
  console.log('All cache cleared');
};

// Manual cache clearing utility
export const clearCacheByPattern = (pattern) => {
  clearCache(pattern);
};

const clearCache = (pattern) => {
  console.log(`clearCache called with pattern: ${pattern || 'ALL'}`);
  
  if (pattern) {
    let clearedCount = 0;
    for (const key of cache.keys()) {
      if (key.includes(pattern)) {
        cache.delete(key);
        clearedCount++;
      }
    }
    console.log(`Cleared ${clearedCount} cache entries matching pattern: ${pattern}`);
  } else {
    const size = cache.size;
    cache.clear();
    console.log(`Cleared all ${size} cache entries`);
  }
};

// Connection state management
let isOnline = navigator.onLine;
let connectionListeners = [];

console.log(`Initial connection state: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

const updateConnectionState = (state) => {
  console.log(`Connection state changing from ${isOnline ? 'ONLINE' : 'OFFLINE'} to ${state ? 'ONLINE' : 'OFFLINE'}`);
  isOnline = state;
  connectionListeners.forEach(callback => callback(state));
};

// Monitor connection changes
if (typeof window !== 'undefined') {
  console.log('Setting up connection state monitors');
  
  window.addEventListener('online', () => {
    console.log('Browser went ONLINE');
    updateConnectionState(true);
  });
  
  window.addEventListener('offline', () => {
    console.log('Browser went OFFLINE');
    updateConnectionState(false);
  });
}

// Export connection state utilities
export const getConnectionState = () => {
  console.log(`getConnectionState called: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
  return isOnline;
};

export const onConnectionStateChange = (callback) => {
  console.log('onConnectionStateChange called');
  connectionListeners.push(callback);
  return () => {
    connectionListeners = connectionListeners.filter(cb => cb !== callback);
  };
};

// Get all tables data with performance monitoring and caching
export const getAllTables = async () => {
  try {
    console.log('getAllTables called');
    
    // Check cache first
    const cachedData = getCached('tables');
    if (cachedData && isOnline) {
      console.log('Returning cached tables data');
      return cachedData;
    }
    
    console.log('Cache miss - fetching from Firebase');
    
    return await monitorFirebaseOperation('getAllTables', async () => {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firebase timeout')), 10000)
      );
      
      const firebasePromise = getDocs(tablesCollection);
      const tablesSnapshot = await Promise.race([firebasePromise, timeoutPromise]);
      
      const tables = {};
      tablesSnapshot.forEach((doc) => {
        // Only include necessary fields to reduce payload
        const data = doc.data();
        tables[doc.id] = {
          id: data.id,
          orders: data.orders || [],
          total: data.total || 0,
          ...data // Include any other fields
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
  console.log('subscribeToTables called');
  
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
    console.log(`getTable called for table ${tableId}`);
    
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
    console.log(`updateTable called for table ${tableId}`);
    
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
    
    // Clear relevant cache entries
    console.log('Clearing tables cache before update');
    clearCache('tables');
    
    // Monitor the operation
    await monitorFirebaseOperation('updateTable', async () => {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firebase timeout')), 3000)
      );
      
      const firebasePromise = setDoc(doc(tablesCollection, stringTableId), tableData);
      await Promise.race([firebasePromise, timeoutPromise]);
    });
  } catch (error) {
    console.error('Error updating table:', error);
  }
};

// Delete table with performance monitoring
export const deleteTable = async (tableId) => {
  try {
    console.log(`deleteTable called for table ${tableId}`);
    
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
    console.log('getAllHistory called');
    
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
  console.log('subscribeToHistory called');
  
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

// Add history entry with performance monitoring and optimized writes
export const addHistory = async (historyData) => {
  try {
    console.log('addHistory called');
    
    // Validate historyData is an object
    if (typeof historyData !== 'object' || historyData === null) {
      console.error('Invalid historyData:', historyData);
      return;
    }
    
    const historyId = Date.now().toString();
    
    // Monitor the operation
    await monitorFirebaseOperation('addHistory', async () => {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firebase timeout')), 2000)
      );
      
      const firebasePromise = setDoc(doc(historyCollection, historyId), {
        ...historyData,
        timestamp: serverTimestamp()
      });
      await Promise.race([firebasePromise, timeoutPromise]);
    });
  } catch (error) {
    console.error('Error adding history:', error);
  }
};

// Batch update tables for better performance
export const batchUpdateTables = async (tablesUpdates) => {
  try {
    console.log(`batchUpdateTables called with ${tablesUpdates.length} updates`);
    
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
      console.log('Clearing tables cache after batch update');
      clearCache('tables');
      
      console.log(`Successfully updated ${tablesUpdates.length} tables in batch`);
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
    console.log(`batchAddHistory called with ${historyEntries.length} entries`);
    
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
      console.log(`Successfully added ${historyEntries.length} history entries in batch`);
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
    console.log(`getTablesByIds called with ${tableIds.length} table IDs`);
    
    if (!Array.isArray(tableIds) || tableIds.length === 0) {
      return {};
    }
    
    // Check cache first
    const cacheKey = `tables_${tableIds.sort().join('_')}`;
    const cachedData = getCached(cacheKey);
    if (cachedData && isOnline) {
      console.log('Returning cached specific tables data');
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
    console.log(`deleteHistory called for history ${historyId}`);
    
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
    console.log('clearAllHistory called');
    
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
    console.log('getAllMenuItems called');
    
    // Check cache first
    const cachedData = getCached('menuItems');
    if (cachedData && isOnline) {
      console.log('Returning cached menu items data');
      return cachedData;
    }
    
    console.log('Cache miss - fetching from Firebase');
    
    return await monitorFirebaseOperation('getAllMenuItems', async () => {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Firebase timeout')), 5000)
      );
      
      const firebasePromise = getDocs(query(menuItemsCollection, orderBy('sequence', 'asc')));
      const menuItemsSnapshot = await Promise.race([firebasePromise, timeoutPromise]);
      
      const menuItems = [];
      menuItemsSnapshot.forEach((doc) => {
        // Only include necessary fields to reduce payload
        const data = doc.data();
        menuItems.push({ 
          id: doc.id, 
          name: data.name,
          price: data.price,
          available: data.available,
          sequence: data.sequence,
          category: data.category,
          ...data // Include any other fields
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
  console.log('subscribeToMenuItems called');
  
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
    console.log(`updateMenuItem called for item ${menuItemId}`);
    
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
    console.log(`deleteMenuItem called for item ${menuItemId}`);
    
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
    console.log(`updateMenuItemSequence called for item ${menuItemId}`);
    
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
    console.log(`bulkUpdateMenuItems called with ${menuItems.length} items`);
    
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
    console.log(`toggleMenuItemAvailability called for item ${menuItemId}`);
    
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
    console.log(`updateMenuItemWithVersion called for item ${menuItemId}`);
    
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
  console.log('retryWithBackoff called');
  
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
      console.log('Returning cached selective menu items data');
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
