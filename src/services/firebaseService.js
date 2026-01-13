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