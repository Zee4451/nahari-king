import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styles from './SettingsPage.module.css';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import NavigationBar from './NavigationBar';
import UserManagement from './UserManagement';
import PosConfig from './Settings/PosConfig';

import Form from './Reusable/Form';
import { useApiOperation } from '../hooks/useApiOperations';
import {
  getAllTables,
  subscribeToTables,
  updateTable,
  deleteTable as deleteTableFirebase,
} from '../services/firebaseService';
import { useRenderPerformance, useFunctionPerformance, monitorFirebaseOperation } from '../utils/performanceMonitor';
import MenuManagement from './Settings/MenuManagement';
import TableManagement from './Settings/TableManagement';

const SettingsPage = () => {
  // Define item types for drag and drop
  const ITEM_TYPE = 'MENU_ITEM';

  // State for managing tables
  const [tables, setTables] = useState({});

  // Function to add a new table
  const addNewTable = async (customId) => {
    const existingTableIds = Object.keys(tables).map(Number).filter(n => !isNaN(n));
    let newTableId;
    if (customId !== undefined && customId !== null && String(customId).trim() !== '') {
      newTableId = Number(customId);
    } else {
      // Smart gap fill: find lowest missing positive integer starting from 1
      const idSet = new Set(existingTableIds);
      let candidate = 1;
      while (idSet.has(candidate)) {
        candidate++;
      }
      newTableId = candidate;
    }

    if (isNaN(newTableId) || newTableId <= 0) {
      throw new Error('Please enter a valid table number');
    }

    if (tables[newTableId]) {
      throw new Error('Table ' + newTableId + ' already exists');
    }

    const newTable = {
      id: newTableId,
      orders: [],
      total: 0
    };

    await updateTable(newTableId, newTable);
    return newTableId;
  };

  const deleteTable = async (tableId) => {
    if (window.confirm(`Are you sure you want to delete Table ${tableId}? This will remove all orders from this table.`)) {
      await deleteTableFirebase(tableId);
    }
  };

  // Function to clear all orders from a table to make it available
  const clearTable = async (tableId) => {
    const cleared = {
      id: tableId,
      orders: [],
      total: 0
    };
    await updateTable(tableId, cleared);
  };

  // State for managing menu items

  // State for UI management
  const [activeTab, setActiveTab] = useState('menu'); // 'menu', 'tables', 'users', 'pos_config'
  const [draggedItem, setDraggedItem] = useState(null);

  // Initialize the app with proper real-time subscriptions
  useEffect(() => {
    let unsubscribeTables = () => {};
    try {
      unsubscribeTables = subscribeToTables((updatedTables) => {
        setTables(updatedTables);
      });
    } catch (error) {
      console.error('Error subscribing to tables in SettingsPage:', error);
    }

    return () => {
      try {
        if (typeof unsubscribeTables === 'function') {
          unsubscribeTables();
        }
      } catch (e) {
        console.warn('Error unsubscribing tables in SettingsPage:', e);
      }
    };
  }, []);



  return (
    <DndProvider backend={HTML5Backend}>
      <div className={styles['settings-page'] || 'settings-page'}>
        <NavigationBar currentPage="settings" />
        <div className={styles['page-content-wrapper'] || 'page-content-wrapper'}>
          <div className={styles['page-content'] || 'page-content'}>
            <h1>Settings</h1>

            {/* Tab Navigation */}
            <div className={styles['settings-tabs'] || 'settings-tabs'}>
              <button
                className={`${styles['tab-btn'] || 'tab-btn'} ${activeTab === 'menu' ? (styles.active || 'active') : ''}`}
                onClick={() => setActiveTab('menu')}
              >
                Menu Management
              </button>
              <button
                className={`${styles['tab-btn'] || 'tab-btn'} ${activeTab === 'tables' ? (styles.active || 'active') : ''}`}
                onClick={() => setActiveTab('tables')}
              >
                Table Management
              </button>

              <button
                className={`${styles['tab-btn'] || 'tab-btn'} ${activeTab === 'users' ? (styles.active || 'active') : ''}`}
                onClick={() => setActiveTab('users')}
              >
                User Management
              </button>
              <button
                className={`${styles['tab-btn'] || 'tab-btn'} ${activeTab === 'pos_config' ? (styles.active || 'active') : ''}`}
                onClick={() => setActiveTab('pos_config')}
              >
                POS Configuration
              </button>
            </div>

            {/* Menu Management Tab */}
            {activeTab === 'menu' && (
              <MenuManagement />
            )}

            {/* Table Management Tab */}
            {activeTab === 'tables' && (
              <div className={styles['settings-section'] || 'settings-section'}>
                <TableManagement
                  tables={tables}
                  addNewTable={addNewTable}
                  deleteTable={deleteTable}
                  clearTable={clearTable}
                />
              </div>
            )}



            {/* User Management Tab */}
            {activeTab === 'users' && (
              <div className={styles['settings-section'] || 'settings-section'}>
                <UserManagement />
              </div>
            )}

            {/* POS Config Tab */}
            {activeTab === 'pos_config' && (
              <PosConfig />
            )}
          </div>
        </div>
      </div>
    </DndProvider >
  );
};

export default SettingsPage;