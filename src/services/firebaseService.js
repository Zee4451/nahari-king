// Firebase Service Layer
// ================================================
// Core service layer for Firebase Firestore operations
// Provides comprehensive data management for the restaurant management system
//
// Key Features:
// - Real-time data synchronization with Firestore
// - Performance monitoring and optimization
// - Data caching with time-based expiration
// - Batch operations for improved efficiency
// - Error handling and retry mechanisms
// - Type-safe data operations
//
// Architecture Notes:
// - Uses Firestore as the primary database
// - Implements caching layer to reduce Firebase reads
// - Leverages real-time listeners for instant UI updates
// - Includes performance monitoring for optimization insights

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
  startAfter,
  increment
} from 'firebase/firestore';

// Helper for local date keys
export const getLocalDateString = (d = new Date()) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Import performance monitoring utilities
import { monitorFirebaseOperation, monitorFirestoreListener } from '../utils/performanceMonitor';
import { getCurrentShift } from './shiftService';

// Collection references
const tablesCollection = collection(db, 'tables');
const historyCollection = collection(db, 'history');
const menuItemsCollection = collection(db, 'menuItems');



// Caching Layer
// ================================================
// Implements in-memory caching to reduce Firebase read operations
// and improve application performance
//
// Cache Configuration:
// - Duration: 3 minutes (180,000ms) for optimal balance
// - Storage: In-memory Map for fast access
// - Expiration: Time-based invalidation
// - Statistics: Hit/miss tracking for performance monitoring

const cache = new Map();
const CACHE_TTL = 180000; // 3 minutes cache TTL for better hit rate

// Cache performance statistics
const cacheStats = {
  hits: 0,    // Number of successful cache retrievals
  misses: 0,  // Number of cache misses (expired/missing)
  sets: 0     // Number of cache writes
};

// Pending operations tracking to prevent duplicate requests
const pendingOperations = new Map();

/**
 * Retrieve cached data if it exists and is still valid
 * @param {string} key - Cache key
 * @returns {any|null} Cached data or null if not found/expired
 */
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

/**
 * Store data in cache with timestamp
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 */
const setCached = (key, data) => {
  cacheStats.sets++;
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
};

// Debounce Helper
// ================================================
// Prevents excessive Firebase calls by debouncing rapid operations
// Ensures only the latest operation executes after a delay period
//
// Use Cases:
// - Prevent duplicate rapid updates
// - Reduce unnecessary Firestore writes
// - Improve performance during rapid user interactions
//
// @param {string} operationKey - Unique identifier for the operation
// @param {Function} operationFn - Async function to execute
// @param {number} delay - Delay in milliseconds (default: 100ms)
// @returns {Promise} Resolves with operation result

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
      // Add timeout to prevent hanging, properly clearing it to avoid memory leaks
      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Firebase timeout')), 60000);
      });

      try {
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
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
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
            // Add timeout to prevent hanging, clearing it to avoid memory leaks
            let timeoutId;
            const timeoutPromise = new Promise((_, reject) => {
              timeoutId = setTimeout(() => reject(new Error('Firebase timeout')), 60000);
            });

            try {
              // Use merge: true to avoid completely overwriting the document and losing data 
              // from concurrent updates by other waiters
              const firebasePromise = setDoc(doc(tablesCollection, stringTableId), tableData, { merge: true });
              await Promise.race([firebasePromise, timeoutPromise]);
            } finally {
              if (timeoutId) clearTimeout(timeoutId);
            }
          });
        } catch (error) {
          console.error('Error updating table:', error);
        } finally {
          // Clean up the pending update reference
          delete updateTable._pendingUpdates[stringTableId];
          resolve();
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
    return () => { };
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
      const batch = writeBatch(db);

      const currentShift = await getCurrentShift();
      const shiftId = currentShift ? currentShift.id : null;
      const paymentMethod = historyEntry.paymentMethod || 'Cash';

      batch.set(doc(historyCollection, historyId), {
        ...historyEntry,
        paymentMethod,
        shiftId,
        timestamp: serverTimestamp()
      });

      // --- CLIENT SIDE AGGREGATION MVP ---
      const dateStr = getLocalDateString();
      const dailyRef = doc(db, 'daily_metrics', dateStr);

      const revenue = Number(historyEntry.total) || 0;
      let ordersCount = 0;
      const itemsList = [];
      const extractItems = (obj) => {
        if (!obj) return;
        if (Array.isArray(obj)) {
          obj.forEach(extractItems);
        } else if (typeof obj === 'object') {
          if (obj.name && (obj.price !== undefined || obj.quantity !== undefined)) {
            itemsList.push(obj);
          } else {
            Object.values(obj).forEach(extractItems);
          }
        }
      };

      extractItems(historyEntry);

      if (Array.isArray(historyEntry.orders)) {
        ordersCount = historyEntry.orders.length;
      } else if (itemsList.length > 0) {
        ordersCount = 1;
      }

      const dineInTables = historyEntry.tableId ? 1 : 0;

      const updates = {
        date: dateStr,
        totalSales: increment(revenue),
        totalOrders: increment(ordersCount),
        dineInTables: increment(dineInTables),
        lastUpdated: serverTimestamp()
      };

      for (const item of itemsList) {
        if (!item.name) continue;
        const safeName = item.name.replace(/[^a-zA-Z0-9]/g, "_");
        const qty = Number(item.quantity) || 1;
        const itemRevenue = (Number(item.price) || 0) * qty;

        updates[`itemSales.${safeName}.name`] = item.name;
        updates[`itemSales.${safeName}.qty`] = increment(qty);
        updates[`itemSales.${safeName}.revenue`] = increment(itemRevenue);
      }

      batch.set(dailyRef, updates, { merge: true });

      // --- SHIFT TRACKING ---
      if (shiftId) {
        const shiftRef = doc(db, 'shifts', shiftId);
        const ctUpdates = {
          totalRevenue: increment(revenue)
        };
        if (paymentMethod === 'Cash') {
          ctUpdates.cashSales = increment(revenue);
          ctUpdates.expectedCash = increment(revenue);
        } else {
          ctUpdates.upiSales = increment(revenue);
          const breakdown = {};
          breakdown[paymentMethod] = increment(revenue);
          ctUpdates.paymentMethodBreakdown = breakdown;
        }
        batch.set(shiftRef, { calculatedTotals: ctUpdates }, { merge: true });
      }

      await batch.commit();
      // -----------------------------------
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

      const currentShift = await getCurrentShift();
      const shiftId = currentShift ? currentShift.id : null;

      const dateStr = getLocalDateString();
      const dailyRef = doc(db, 'daily_metrics', dateStr);
      const dailyUpdates = {
        date: dateStr,
        totalSales: increment(0),
        totalOrders: increment(0),
        dineInTables: increment(0),
        lastUpdated: serverTimestamp()
      };

      let hasMetricsToUpdate = false;
      const shiftTotals = { totalRevenue: 0, cashSales: 0, upiSales: 0, breakdown: {} };

      historyEntries.forEach((entry) => {
        if (entry) {
          const paymentMethod = entry.paymentMethod || 'Cash';
          const historyId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
          const docRef = doc(historyCollection, historyId);
          batch.set(docRef, {
            ...entry,
            paymentMethod,
            shiftId,
            timestamp: serverTimestamp()
          });

          // Aggregate metrics for batch
          hasMetricsToUpdate = true;
          const revenue = Number(entry.total) || 0;

          shiftTotals.totalRevenue += revenue;
          if (paymentMethod === 'Cash') {
            shiftTotals.cashSales += revenue;
          } else {
            shiftTotals.upiSales += revenue;
            if (!shiftTotals.breakdown[paymentMethod]) shiftTotals.breakdown[paymentMethod] = 0;
            shiftTotals.breakdown[paymentMethod] += revenue;
          }

          // Replace increment(0) with actual values if we could, but since increment() is a FieldTransform, 
          // we can't easily sum them in memory unless we keep a JS running total. Let's build a JS memory total first.
        }
      });

      // Better approach: Calculate JS memory totals for the entire batch first, then issue ONE increment
      const batchTotals = { sales: 0, orders: 0, tables: 0, items: {} };
      historyEntries.forEach(entry => {
        if (!entry) return;
        batchTotals.sales += (Number(entry.total) || 0);

        let ordersCount = 0;
        const itemsList = [];
        const extractItems = (obj) => {
          if (!obj) return;
          if (Array.isArray(obj)) {
            obj.forEach(extractItems);
          } else if (typeof obj === 'object') {
            if (obj.name && (obj.price !== undefined || obj.quantity !== undefined)) {
              itemsList.push(obj);
            } else {
              Object.values(obj).forEach(extractItems);
            }
          }
        };

        extractItems(entry);

        if (Array.isArray(entry.orders)) {
          ordersCount = entry.orders.length;
        } else if (itemsList.length > 0) {
          ordersCount = 1;
        }

        batchTotals.orders += ordersCount;
        batchTotals.tables += entry.tableId ? 1 : 0;

        for (const item of itemsList) {
          if (!item.name) continue;
          const safeName = item.name.toString().replace(/[^a-zA-Z0-9]/g, "_");
          const qty = Number(item.quantity) || 1;
          const itemRev = (Number(item.price) || 0) * qty;

          if (!batchTotals.items[safeName]) batchTotals.items[safeName] = { name: item.name, qty: 0, rev: 0 };
          batchTotals.items[safeName].qty += qty;
          batchTotals.items[safeName].rev += itemRev;
        }
      });

      if (hasMetricsToUpdate) {
        dailyUpdates.totalSales = increment(batchTotals.sales);
        dailyUpdates.totalOrders = increment(batchTotals.orders);
        dailyUpdates.dineInTables = increment(batchTotals.tables);

        Object.keys(batchTotals.items).forEach(safeName => {
          const item = batchTotals.items[safeName];
          dailyUpdates[`itemSales.${safeName}.name`] = item.name;
          dailyUpdates[`itemSales.${safeName}.qty`] = increment(item.qty);
          dailyUpdates[`itemSales.${safeName}.revenue`] = increment(item.rev);
        });

        batch.set(dailyRef, dailyUpdates, { merge: true });
      }

      // --- SHIFT TRACKING ---
      if (shiftId && shiftTotals.totalRevenue > 0) {
        const shiftRef = doc(db, 'shifts', shiftId);
        const ctUpdates = {
          totalRevenue: increment(shiftTotals.totalRevenue),
          cashSales: increment(shiftTotals.cashSales),
          expectedCash: increment(shiftTotals.cashSales),
          upiSales: increment(shiftTotals.upiSales)
        };

        if (Object.keys(shiftTotals.breakdown).length > 0) {
          const breakdown = {};
          Object.entries(shiftTotals.breakdown).forEach(([method, amt]) => {
            breakdown[method] = increment(amt);
          });
          ctUpdates.paymentMethodBreakdown = breakdown;
        }

        batch.set(shiftRef, { calculatedTotals: ctUpdates }, { merge: true });
      }

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
      // Add timeout to prevent hanging, properly clearing it to avoid memory leaks
      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Firebase timeout')), 30000);
      });

      try {
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
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
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
    return () => { };
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






