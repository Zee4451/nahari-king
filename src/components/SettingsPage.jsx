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
  };

  // Function to delete a table
  const deleteTable = async (tableId) => {
    if (window.confirm(`Are you sure you want to delete Table ${tableId}? This will remove all orders from this table.`)) {
      await deleteTableFirebase(tableId);
    }
  };

  // State for managing menu items

  // State for UI management
  const [activeTab, setActiveTab] = useState('menu'); // 'menu', 'tables', 'users', 'pos_config'
  const [draggedItem, setDraggedItem] = useState(null);

  // Initialize the app with proper real-time subscriptions
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load tables from Firebase
        const unsubscribeTables = subscribeToTables((updatedTables) => {
          setTables(updatedTables);
        });

        // Cleanup subscriptions on unmount
        return () => {
          unsubscribeTables();
        };
      } catch (error) {
        console.error('Error initializing app:', error);
      }
    };

    const cleanup = initializeApp();
    return () => {
      if (cleanup && typeof cleanup === 'function') {
        cleanup();
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
                className={`tab-btn ${activeTab === 'menu' ? 'active' : ''}`}
                onClick={() => setActiveTab('menu')}
              >
                Menu Management
              </button>
              <button
                className={`tab-btn ${activeTab === 'tables' ? 'active' : ''}`}
                onClick={() => setActiveTab('tables')}
              >
                Table Management
              </button>

              <button
                className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => setActiveTab('users')}
              >
                User Management
              </button>
              <button
                className={`tab-btn ${activeTab === 'pos_config' ? 'active' : ''}`}
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
                <h2>Table Management</h2>
                <div className={styles['tables-management'] || 'tables-management'}>
                  <div className={styles['table-actions'] || 'table-actions'}>
                    <button className={styles['add-table-btn'] || 'add-table-btn'} onClick={addNewTable}>
                      Add New Table
                    </button>
                  </div>

                  <div className={styles['tables-grid'] || 'tables-grid'}>
                    {Object.entries(tables).map(([tableId, tableData]) => (
                      <div key={tableId} className={styles['table-card'] || 'table-card'}>
                        <h3>Table {tableId}</h3>
                        <p>Orders: {tableData.orders?.length || 0}</p>
                        <p>Total: ₹{tableData.total || 0}</p>
                        <button
                          className={styles['delete-table-btn'] || 'delete-table-btn'}
                          onClick={() => deleteTable(tableId)}
                        >
                          Delete Table
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
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