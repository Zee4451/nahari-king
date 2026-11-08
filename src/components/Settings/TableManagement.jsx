import React, { useState, useMemo } from 'react';
import styles from './TableManagement.module.css';
import {
  Armchair,
  Flame,
  CheckCircle2,
  IndianRupee,
  Search,
  Plus,
  Trash2,
  RotateCcw,
  Check,
  X
} from 'lucide-react';

/**
 * Accurately determines if a table is occupied.
 * A table is ONLY occupied if:
 * 1. Running total > 0
 * OR
 * 2. It has actual food items ordered with quantity > 0
 *
 * An empty table with a blank draft ticket { items: [], total: 0 } is AVAILABLE, not occupied.
 */
export const isTableOccupied = (table) => {
  if (!table) return false;

  // 1. If running total is greater than 0, customer is dining
  if ((Number(table.total) || 0) > 0) return true;

  // 2. Check if any order ticket has actual food items
  if (Array.isArray(table.orders) && table.orders.length > 0) {
    return table.orders.some((order) => {
      if ((Number(order.total) || 0) > 0) return true;
      if (Array.isArray(order.items) && order.items.length > 0) {
        return order.items.some((item) => (Number(item.quantity) || 0) > 0);
      }
      return false;
    });
  }

  return false;
};

/**
 * Returns the total count of food items actually ordered on a table
 */
export const getActiveItemCount = (table) => {
  if (!table || !Array.isArray(table.orders)) return 0;
  return table.orders.reduce((total, order) => {
    if (!Array.isArray(order.items)) return total;
    return total + order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }, 0);
};

/**
 * Returns the count of active order tickets (tickets that have items or total > 0)
 */
export const getActiveOrderCount = (table) => {
  if (!table || !Array.isArray(table.orders)) return 0;
  return table.orders.filter((order) => {
    if ((Number(order.total) || 0) > 0) return true;
    if (Array.isArray(order.items) && order.items.length > 0) {
      return order.items.some((item) => (Number(item.quantity) || 0) > 0);
    }
    return false;
  }).length;
};

const TableManagement = ({ tables = {}, addNewTable, deleteTable, clearTable }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('All');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [clearConfirm, setClearConfirm] = useState(null);
  const [isAdding, setIsAdding] = useState(false);

  // Normalize tables object or array into an array of table objects
  const tableList = useMemo(() => {
    if (!tables) return [];
    if (Array.isArray(tables)) return tables;
    return Object.entries(tables).map(([id, data]) => ({
      id: data?.id || id,
      ...data
    }));
  }, [tables]);

  // Calculate accurate summary statistics
  const summaryStats = useMemo(() => {
    const totalTables = tableList.length;
    const occupiedTables = tableList.filter((table) => isTableOccupied(table)).length;
    const availableTables = Math.max(0, totalTables - occupiedTables);
    const totalRevenue = tableList.reduce((sum, table) => sum + (Number(table.total) || 0), 0);

    return {
      totalTables,
      occupiedTables,
      availableTables,
      totalRevenue
    };
  }, [tableList]);

  // Filter and search tables
  const filteredTables = useMemo(() => {
    return tableList
      .filter((table) => {
        const tableIdStr = String(table.id);
        const matchesSearch =
          searchTerm.trim() === '' ||
          tableIdStr.toLowerCase().includes(searchTerm.trim().toLowerCase());
        const occupied = isTableOccupied(table);

        const matchesFilter =
          filter === 'All' ||
          (filter === 'Occupied' && occupied) ||
          (filter === 'Available' && !occupied);

        return matchesSearch && matchesFilter;
      })
      .sort((a, b) => {
        const numA = Number(a.id);
        const numB = Number(b.id);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
        return String(a.id).localeCompare(String(b.id));
      });
  }, [tableList, searchTerm, filter]);

  // Detect missing/deleted table numbers in the sequence (e.g. Table 1 deleted)
  const missingTableNumbers = useMemo(() => {
    const existingSet = new Set(tableList.map((t) => Number(t.id)).filter((n) => !isNaN(n)));
    if (existingSet.size === 0) return [1];
    const max = Math.max(...existingSet, 0);
    const missing = [];
    for (let i = 1; i <= max; i++) {
      if (!existingSet.has(i)) {
        missing.push(i);
      }
    }
    return missing;
  }, [tableList]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [targetTableIdInput, setTargetTableIdInput] = useState('');
  const [addError, setAddError] = useState('');

  const handleOpenAddModal = (suggestedId) => {
    setAddError('');
    if (suggestedId) {
      setTargetTableIdInput(String(suggestedId));
    } else if (missingTableNumbers.length > 0) {
      setTargetTableIdInput(String(missingTableNumbers[0]));
    } else {
      const existingSet = new Set(tableList.map((t) => Number(t.id)).filter((n) => !isNaN(n)));
      const max = existingSet.size > 0 ? Math.max(...existingSet) : 0;
      setTargetTableIdInput(String(max + 1));
    }
    setShowAddModal(true);
  };

  const handleCreateOrRestore = async (tableNum) => {
    const rawVal = tableNum !== undefined ? tableNum : targetTableIdInput;
    const idToCreate = Number(rawVal);
    if (!idToCreate || isNaN(idToCreate) || idToCreate <= 0) {
      setAddError('Please enter a valid positive table number');
      return;
    }

    const alreadyExists = tableList.some(t => Number(t.id) === idToCreate);
    if (alreadyExists) {
      setAddError(`Table ${idToCreate} already exists!`);
      return;
    }

    try {
      setIsAdding(true);
      setAddError('');
      if (addNewTable) {
        await addNewTable(idToCreate);
      }
      setShowAddModal(false);
      setTargetTableIdInput('');
    } catch (err) {
      setAddError(err.message || 'Failed to create table');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteClick = (tableId) => {
    setDeleteConfirm(tableId);
    setClearConfirm(null);
  };

  const confirmDelete = async () => {
    if (deleteConfirm && deleteTable) {
      const idToDelete = deleteConfirm;
      setDeleteConfirm(null);
      await deleteTable(idToDelete);
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  const handleClearClick = (tableId) => {
    setClearConfirm(tableId);
    setDeleteConfirm(null);
  };

  const confirmClear = async () => {
    if (clearConfirm && clearTable) {
      const idToClear = clearConfirm;
      setClearConfirm(null);
      await clearTable(idToClear);
    }
  };

  const cancelClear = () => {
    setClearConfirm(null);
  };

  return (
    <div className={styles.container}>
      {/* Header Title Section */}
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>
            <span className={styles.titleIcon}>
              <Armchair size={26} strokeWidth={2.3} style={{ color: '#2563eb' }} />
            </span>
            Table Management
          </h2>
          <p className={styles.subtitle}>
            Manage dining tables, live occupancy status, and table capacities
          </p>
        </div>
      </div>

      {/* Summary Stats Bar */}
      <div className={styles.statsBar}>
        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconPrimary}`}>
            <Armchair size={22} strokeWidth={2.2} />
          </div>
          <div className={styles.statContent}>
            <h3>Total Tables</h3>
            <p className={styles.statValue}>{summaryStats.totalTables}</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconOccupied}`}>
            <Flame size={22} strokeWidth={2.2} />
          </div>
          <div className={styles.statContent}>
            <h3>Occupied (व्यस्त)</h3>
            <p className={styles.statValue}>{summaryStats.occupiedTables}</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconAvailable}`}>
            <CheckCircle2 size={22} strokeWidth={2.2} />
          </div>
          <div className={styles.statContent}>
            <h3>Available (खाली)</h3>
            <p className={styles.statValue}>{summaryStats.availableTables}</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={`${styles.statIcon} ${styles.statIconRevenue}`}>
            <IndianRupee size={22} strokeWidth={2.4} />
          </div>
          <div className={styles.statContent}>
            <h3>Live Dine-In</h3>
            <p className={styles.statValue}>₹{summaryStats.totalRevenue.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      {/* Alert banner for any missing/deleted table numbers */}
      {missingTableNumbers.length > 0 && (
        <div className={styles.missingTablesAlert}>
          <div className={styles.missingAlertLeft}>
            <RotateCcw size={18} className={styles.missingAlertIcon} />
            <div>
              <span className={styles.missingAlertTitle}>Deleted / Missing Table Detected: </span>
              <strong className={styles.missingAlertText}>
                Table {missingTableNumbers.join(', Table ')}
              </strong>
            </div>
          </div>
          <div className={styles.missingAlertActions}>
            {missingTableNumbers.map((num) => (
              <button
                key={num}
                type="button"
                className={styles.restorePillBtn}
                onClick={() => handleCreateOrRestore(num)}
                disabled={isAdding}
                title={`Instantly restore Table ${num}`}
              >
                <Plus size={14} strokeWidth={2.5} />
                <span>Restore Table {num}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter & Action Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchContainer}>
          <span className={styles.searchIcon}>
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder="Search table number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
          {searchTerm && (
            <button className={styles.clearSearchBtn} onClick={() => setSearchTerm('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className={styles.filterPills}>
          {['All', 'Occupied', 'Available'].map((filterOption) => (
            <button
              key={filterOption}
              className={`${styles.filterPill} ${filter === filterOption ? styles.activeFilter : ''}`}
              onClick={() => setFilter(filterOption)}
            >
              {filterOption}
            </button>
          ))}
        </div>

        <button
          className={styles.addButton}
          onClick={() => handleOpenAddModal()}
          disabled={isAdding}
        >
          <span className={styles.addIcon}>
            <Plus size={16} />
          </span>
          <span>{isAdding ? 'Adding...' : 'Add New Table'}</span>
        </button>
      </div>

      {/* Table Cards Grid */}
      <div className={styles.tableGrid}>
        {filteredTables.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <Armchair size={48} strokeWidth={1.5} style={{ color: '#94a3b8' }} />
            </div>
            <h3>No tables found</h3>
            <p>
              {searchTerm || filter !== 'All'
                ? 'Try adjusting your search or status filter'
                : 'Get started by clicking "Add New Table"'}
            </p>
          </div>
        ) : (
          filteredTables.map((table) => {
            const occupied = isTableOccupied(table);
            const activeItems = getActiveItemCount(table);
            const activeOrders = getActiveOrderCount(table);
            const isConfirmingDelete = deleteConfirm === table.id;
            const isConfirmingClear = clearConfirm === table.id;

            return (
              <div
                key={table.id}
                className={`${styles.tableCard} ${occupied ? styles.cardOccupied : styles.cardAvailable}`}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.cardHeaderLeft}>
                    <div
                      className={`${styles.tableIcon} ${occupied ? styles.tableIconOccupied : styles.tableIconAvailable}`}
                    >
                      <Armchair size={20} strokeWidth={2.2} />
                    </div>
                    <div>
                      <h3 className={styles.tableId}>Table {table.id}</h3>
                      <span className={styles.tableCapacity}>Dining Table</span>
                    </div>
                  </div>
                  <span
                    className={`${styles.statusBadge} ${occupied ? styles.occupiedBadge : styles.availableBadge}`}
                  >
                    <span className={styles.statusDot}></span>
                    {occupied ? 'Occupied' : 'Available'}
                  </span>
                </div>

                <div className={styles.cardContent}>
                  <div className={styles.metricItem}>
                    <span className={styles.metricLabel}>Dine-In Status</span>
                    <span className={`${styles.metricBadge} ${occupied ? styles.metricActive : ''}`}>
                      {occupied
                        ? `${activeItems} items (${activeOrders} order)`
                        : '0 items (Empty)'}
                    </span>
                  </div>

                  <div className={styles.metricItem}>
                    <span className={styles.metricLabel}>Running Total</span>
                    <span className={styles.metricPrice}>
                      ₹{(Number(table.total) || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  {isConfirmingDelete ? (
                    <div className={styles.confirmDelete}>
                      <span className={styles.confirmPrompt}>Delete?</span>
                      <button
                        className={styles.confirmButton}
                        onClick={confirmDelete}
                        title="Confirm Delete"
                      >
                        <Check size={13} /> Yes
                      </button>
                      <button
                        className={styles.cancelButton}
                        onClick={cancelDelete}
                        title="Cancel"
                      >
                        <X size={13} /> No
                      </button>
                    </div>
                  ) : isConfirmingClear ? (
                    <div className={styles.confirmDelete}>
                      <span className={styles.confirmPrompt} style={{ color: '#0284c7' }}>
                        Free table?
                      </span>
                      <button
                        className={styles.confirmButton}
                        onClick={confirmClear}
                        style={{ backgroundColor: '#0284c7' }}
                        title="Confirm Free Table"
                      >
                        <Check size={13} /> Yes
                      </button>
                      <button
                        className={styles.cancelButton}
                        onClick={cancelClear}
                        title="Cancel"
                      >
                        <X size={13} /> No
                      </button>
                    </div>
                  ) : (
                    <>
                      {occupied && clearTable && (
                        <button
                          className={styles.clearButton}
                          onClick={() => handleClearClick(table.id)}
                          title="Free this table and clear active orders"
                        >
                          <RotateCcw size={13} />
                          <span>Free Table</span>
                        </button>
                      )}
                      <button
                        className={styles.deleteButton}
                        onClick={() => handleDeleteClick(table.id)}
                        title="Delete Table"
                      >
                        <Trash2 size={13} />
                        <span>Delete Table</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
      {/* Add / Restore Table Modal */}
      {showAddModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowAddModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Armchair size={20} strokeWidth={2.3} style={{ color: '#2563eb' }} />
                <h3>Add or Restore Table</h3>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setShowAddModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <p className={styles.modalHelpText}>
                Enter the table number you want to create (e.g. 1 to restore Table 1).
              </p>

              <div className={styles.modalInputGroup}>
                <label htmlFor="customTableInput" className={styles.modalLabel}>
                  Table Number:
                </label>
                <input
                  id="customTableInput"
                  type="number"
                  min="1"
                  className={styles.modalInput}
                  value={targetTableIdInput}
                  onChange={(e) => {
                    setTargetTableIdInput(e.target.value);
                    setAddError('');
                  }}
                  placeholder="e.g. 1"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateOrRestore();
                    }
                  }}
                />
              </div>

              {missingTableNumbers.length > 0 && (
                <div className={styles.quickRestoreBox}>
                  <span className={styles.quickRestoreLabel}>Quick Select Missing Gaps:</span>
                  <div className={styles.quickRestoreChips}>
                    {missingTableNumbers.map((mNum) => (
                      <button
                        key={mNum}
                        type="button"
                        className={styles.quickChip}
                        onClick={() => {
                          setTargetTableIdInput(String(mNum));
                          setAddError('');
                        }}
                      >
                        Table {mNum}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {addError && <div className={styles.modalError}>{addError}</div>}
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={styles.modalCancelBtn}
                onClick={() => setShowAddModal(false)}
                disabled={isAdding}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.modalSubmitBtn}
                onClick={() => handleCreateOrRestore()}
                disabled={isAdding || !targetTableIdInput}
              >
                {isAdding ? 'Creating...' : `Create Table ${targetTableIdInput || ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableManagement;
