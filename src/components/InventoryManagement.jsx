import React, { useState, useEffect } from 'react';
import { 
  getAllInventoryItems,
  subscribeToInventoryItems,
  subscribeToPurchaseRecords,
  subscribeToUsageLogs,
  subscribeToWasteEntries,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  recordPurchase,
  recordUsage,
  recordWaste,
  getLowStockItems,
  getOutOfStockItems,
  calculateTotalExpenses,
  // Enhanced reporting functions
  findExistingInventoryItem,
  getItemUsageRecordsByDateRange,
  getItemPurchaseRecordsByDateRange,
  getCategoryUsageReport,
  getSupplierPerformanceReport,
  getInventoryTurnoverReport,
  // Firebase data access functions
  getAllPurchaseRecords,
  getAllUsageLogs,
  getAllWasteEntries
} from '../services/firebaseService';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

const InventoryManagement = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [inventoryItems, setInventoryItems] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [outOfStockItems, setOutOfStockItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [operationLoading, setOperationLoading] = useState({});
  
  // Enhanced reporting state
  const [reportType, setReportType] = useState('usage');
  const [reportCategory, setReportCategory] = useState('dairy');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  
  // Export & Clean state
  const [exportLoading, setExportLoading] = useState(false);
  const [cleanLoading, setCleanLoading] = useState(false);
  const [exportFormat, setExportFormat] = useState('excel');
  const [exportDateRange, setExportDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [purchaseRecords, setPurchaseRecords] = useState([]);
  const [usageLogs, setUsageLogs] = useState([]);
  const [wasteEntries, setWasteEntries] = useState([]);
  
  const [newItem, setNewItem] = useState({
    name: '',
    category: '',
    unit: '',
    supplier: '',
    minThreshold: 10
  });
  
  const [purchaseData, setPurchaseData] = useState({
    itemId: '',
    quantity: '',
    unitCost: '',
    supplier: '',
    notes: ''
  });
  
  const [usageData, setUsageData] = useState({
    itemId: '',
    quantity: '',
    reason: 'cooking'
  });
  
  const [wasteData, setWasteData] = useState({
    itemId: '',
    quantity: '',
    reason: '',
    notes: ''
  });
  
  const [expensePeriod, setExpensePeriod] = useState('month');
  const [totalExpenses, setTotalExpenses] = useState(0);

  // Load inventory data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Load inventory items
        const items = await getAllInventoryItems();
        setInventoryItems(items);
        
        // Load low stock items
        const lowStock = await getLowStockItems();
        setLowStockItems(lowStock);
        
        // Load out of stock items
        const outOfStock = await getOutOfStockItems();
        setOutOfStockItems(outOfStock);
        
        // Load expense data
        await loadExpenseData();
      } catch (error) {
        console.error('Error loading inventory data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
    
    // Set up real-time listener for inventory items
    const unsubscribeInventory = subscribeToInventoryItems((items) => {
      setInventoryItems(items);
      // Also reload expense data when inventory changes (due to purchases)
      loadExpenseData();
    });
    
    // Set up real-time listener for purchase records
    const unsubscribePurchases = subscribeToPurchaseRecords((records) => {
      // Reload expense data when purchase records change
      loadExpenseData();
    });
    
    return () => {
      unsubscribeInventory();
      unsubscribePurchases();
    };
  }, [expensePeriod]); // Add expensePeriod as dependency to reload when period changes

  // Load expense data based on selected period
  const loadExpenseData = async () => {
    try {
      const now = new Date();
      let startDate;
      
      switch (expensePeriod) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter':
          startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
          break;
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }
      
      const expenses = await calculateTotalExpenses(startDate, now);
      setTotalExpenses(expenses);
    } catch (error) {
      console.error('Error loading expense data:', error);
    }
  };

  // Load data for export functionality
  const loadExportData = async () => {
    try {
      setExportLoading(true);
      
      // Load all data for export
      const [purchases, usage, waste] = await Promise.all([
        getAllPurchaseRecords(),
        getAllUsageLogs(),
        getAllWasteEntries()
      ]);
      
      setPurchaseRecords(purchases);
      setUsageLogs(usage);
      setWasteEntries(waste);
      
    } catch (error) {
      console.error('Error loading export data:', error);
      alert('Failed to load data for export');
    } finally {
      setExportLoading(false);
    }
  };

  // Export data to Excel
  const exportToExcel = async () => {
    try {
      setExportLoading(true);
      
      // Load fresh data
      await loadExportData();
      
      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Format data for export
      const formattedInventory = inventoryItems.map(item => ({
        'Item ID': item.id,
        'Name': item.name,
        'Category': item.category,
        'Unit': item.unit,
        'Supplier': item.supplier,
        'Current Stock': item.currentStock,
        'Min Threshold': item.minThreshold,
        'Total Purchased': item.totalPurchased,
        'Total Used': item.totalUsed,
        'Total Wasted': item.totalWasted,
        'Created At': item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleString() : '',
        'Updated At': item.updatedAt ? new Date(item.updatedAt.seconds * 1000).toLocaleString() : ''
      }));
      
      const formattedPurchases = purchaseRecords.map(record => ({
        'Record ID': record.id,
        'Item ID': record.itemId,
        'Item Name': record.itemName,
        'Quantity': record.quantity,
        'Unit Cost': record.unitCost,
        'Total Cost': record.totalCost,
        'Supplier': record.supplier,
        'Notes': record.notes,
        'Date': record.timestamp ? new Date(record.timestamp.seconds * 1000).toLocaleDateString() : ''
      }));
      
      const formattedUsage = usageLogs.map(log => ({
        'Log ID': log.id,
        'Item ID': log.itemId,
        'Item Name': log.itemName,
        'Quantity': log.quantity,
        'Reason': log.reason,
        'Date': log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleDateString() : ''
      }));
      
      const formattedWaste = wasteEntries.map(entry => ({
        'Entry ID': entry.id,
        'Item ID': entry.itemId,
        'Item Name': entry.itemName,
        'Quantity': entry.quantity,
        'Reason': entry.reason,
        'Notes': entry.notes,
        'Date': entry.timestamp ? new Date(entry.timestamp.seconds * 1000).toLocaleDateString() : ''
      }));
      
      // Create worksheets
      const inventorySheet = XLSX.utils.json_to_sheet(formattedInventory);
      const purchasesSheet = XLSX.utils.json_to_sheet(formattedPurchases);
      const usageSheet = XLSX.utils.json_to_sheet(formattedUsage);
      const wasteSheet = XLSX.utils.json_to_sheet(formattedWaste);
      
      // Add worksheets to workbook
      XLSX.utils.book_append_sheet(wb, inventorySheet, 'Inventory Items');
      XLSX.utils.book_append_sheet(wb, purchasesSheet, 'Purchase Records');
      XLSX.utils.book_append_sheet(wb, usageSheet, 'Usage Logs');
      XLSX.utils.book_append_sheet(wb, wasteSheet, 'Waste Entries');
      
      // Generate filename
      const filename = `inventory_export_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      // Export file
      XLSX.writeFile(wb, filename);
      
      alert('Data exported successfully to Excel!');
      
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export data to Excel');
    } finally {
      setExportLoading(false);
    }
  };

  // Export data to PDF
  const exportToPDF = async () => {
    try {
      setExportLoading(true);
      
      // Load fresh data
      await loadExportData();
      
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(20);
      doc.text('Inventory & Expense Data Export', 20, 20);
      doc.setFontSize(12);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, 30);
      
      let yPos = 40;
      
      // Inventory Items Section
      doc.setFontSize(16);
      doc.text('Inventory Items', 20, yPos);
      yPos += 10;
      
      doc.setFontSize(10);
      inventoryItems.forEach((item, index) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.text(`${index + 1}. ${item.name}`, 20, yPos);
        doc.text(`Category: ${item.category}`, 30, yPos + 5);
        doc.text(`Stock: ${item.currentStock} ${item.unit}`, 30, yPos + 10);
        doc.text(`Supplier: ${item.supplier}`, 30, yPos + 15);
        yPos += 25;
      });
      
      // Purchase Records Section
      doc.addPage();
      yPos = 20;
      doc.setFontSize(16);
      doc.text('Purchase Records', 20, yPos);
      yPos += 10;
      
      doc.setFontSize(10);
      purchaseRecords.forEach((record, index) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.text(`${index + 1}. ${record.itemName}`, 20, yPos);
        doc.text(`Quantity: ${record.quantity} ${record.unit}`, 30, yPos + 5);
        doc.text(`Cost: ₹${record.totalCost}`, 30, yPos + 10);
        doc.text(`Supplier: ${record.supplier}`, 30, yPos + 15);
        doc.text(`Date: ${record.timestamp ? new Date(record.timestamp.seconds * 1000).toLocaleDateString() : ''}`, 30, yPos + 20);
        yPos += 30;
      });
      
      // Usage Logs Section
      doc.addPage();
      yPos = 20;
      doc.setFontSize(16);
      doc.text('Usage Logs', 20, yPos);
      yPos += 10;
      
      doc.setFontSize(10);
      usageLogs.forEach((log, index) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.text(`${index + 1}. ${log.itemName}`, 20, yPos);
        doc.text(`Quantity: ${log.quantity} ${log.unit}`, 30, yPos + 5);
        doc.text(`Reason: ${log.reason}`, 30, yPos + 10);
        doc.text(`Date: ${log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleDateString() : ''}`, 30, yPos + 15);
        yPos += 25;
      });
      
      // Waste Entries Section
      doc.addPage();
      yPos = 20;
      doc.setFontSize(16);
      doc.text('Waste Entries', 20, yPos);
      yPos += 10;
      
      doc.setFontSize(10);
      wasteEntries.forEach((entry, index) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.text(`${index + 1}. ${entry.itemName}`, 20, yPos);
        doc.text(`Quantity: ${entry.quantity} ${entry.unit}`, 30, yPos + 5);
        doc.text(`Reason: ${entry.reason}`, 30, yPos + 10);
        doc.text(`Notes: ${entry.notes}`, 30, yPos + 15);
        doc.text(`Date: ${entry.timestamp ? new Date(entry.timestamp.seconds * 1000).toLocaleDateString() : ''}`, 30, yPos + 20);
        yPos += 30;
      });
      
      // Save the PDF
      const filename = `inventory_export_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
      
      alert('Data exported successfully to PDF!');
      
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      alert('Failed to export data to PDF');
    } finally {
      setExportLoading(false);
    }
  };

  // Handle export based on selected format
  const handleExport = async () => {
    if (exportFormat === 'excel') {
      await exportToExcel();
    } else {
      await exportToPDF();
    }
  };

  // Clean exported data
  const cleanData = async () => {
    if (!window.confirm('Are you sure you want to delete all inventory and expense data? This action cannot be undone.')) {
      return;
    }
    
    if (!window.confirm('This will permanently delete ALL inventory items, purchase records, usage logs, and waste entries. Please confirm this is what you want to do.')) {
      return;
    }
    
    try {
      setCleanLoading(true);
      
      // In a real implementation, you would call Firebase functions to delete the data
      // For now, we'll show a simulation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      alert('Data cleaning simulation completed. In a production environment, this would permanently delete all data.');
      
      // Reload data to reflect changes
      const loadData = async () => {
        setLoading(true);
        try {
          const items = await getAllInventoryItems();
          setInventoryItems(items);
          await loadExpenseData();
        } catch (error) {
          console.error('Error reloading data:', error);
        } finally {
          setLoading(false);
        }
      };
      
      loadData();
      
    } catch (error) {
      console.error('Error cleaning data:', error);
      alert('Failed to clean data');
    } finally {
      setCleanLoading(false);
    }
  };

  // Enhanced reporting functions
  const generateReport = async () => {
    setReportLoading(true);
    try {
      const startDate = customStartDate ? new Date(customStartDate) : new Date(new Date().setDate(new Date().getDate() - 30));
      const endDate = customEndDate ? new Date(customEndDate) : new Date();
      
      let data;
      switch (reportType) {
        case 'usage':
          data = await getCategoryUsageReport(reportCategory, startDate, endDate);
          break;
        case 'supplier':
          data = await getSupplierPerformanceReport(startDate, endDate);
          break;
        case 'turnover':
          data = await getInventoryTurnoverReport(startDate, endDate);
          break;
        default:
          data = null;
      }
      
      setReportData(data);
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report');
    } finally {
      setReportLoading(false);
    }
  };

  // Enhanced add item function with duplicate prevention
  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItem.name || !newItem.category || !newItem.unit) {
      alert('Please fill in all required fields');
      return;
    }
    
    const operationKey = 'addItem';
    setOperationLoading(prev => ({ ...prev, [operationKey]: true }));
    
    try {
      // Check for existing item to prevent duplicates
      const existingItem = await findExistingInventoryItem(newItem.name, newItem.category);
      if (existingItem) {
        alert(`Item "${newItem.name}" already exists in ${newItem.category} category`);
        return;
      }
      
      await addInventoryItem(newItem);
      setNewItem({
        name: '',
        category: '',
        unit: '',
        supplier: '',
        minThreshold: 10
      });
      // Show success message
      setTimeout(() => alert('Inventory item added successfully!'), 100);
    } catch (error) {
      console.error('Error adding inventory item:', error);
      alert('Failed to add inventory item');
    } finally {
      setOperationLoading(prev => ({ ...prev, [operationKey]: false }));
    }
  };

  // Handle recording purchase with optimistic update
  const handleRecordPurchase = async (e) => {
    e.preventDefault();
    if (!purchaseData.itemId || !purchaseData.quantity || !purchaseData.unitCost) {
      alert('Please fill in all required fields');
      return;
    }
    
    const operationKey = 'recordPurchase';
    setOperationLoading(prev => ({ ...prev, [operationKey]: true }));
    
    // Optimistic update - update UI immediately
    const purchaseAmount = parseFloat(purchaseData.quantity) * parseFloat(purchaseData.unitCost);
    const optimisticTotalExpenses = totalExpenses + purchaseAmount;
    setTotalExpenses(optimisticTotalExpenses);
    
    try {
      const purchaseRecord = {
        itemId: purchaseData.itemId,
        quantity: parseFloat(purchaseData.quantity),
        unitCost: parseFloat(purchaseData.unitCost),
        totalCost: purchaseAmount,
        supplier: purchaseData.supplier,
        notes: purchaseData.notes
      };
      
      await recordPurchase(purchaseRecord);
      setPurchaseData({
        itemId: '',
        quantity: '',
        unitCost: '',
        supplier: '',
        notes: ''
      });
      
      // Refresh expense data after recording purchase
      await loadExpenseData();
      // Show success message
      setTimeout(() => alert('Purchase recorded successfully!'), 100);
    } catch (error) {
      console.error('Error recording purchase:', error);
      // Revert optimistic update on error
      setTotalExpenses(totalExpenses);
      alert('Failed to record purchase');
    } finally {
      setOperationLoading(prev => ({ ...prev, [operationKey]: false }));
    }
  };

  // Handle recording usage
  const handleRecordUsage = async (e) => {
    e.preventDefault();
    if (!usageData.itemId || !usageData.quantity) {
      alert('Please fill in all required fields');
      return;
    }
    
    const operationKey = 'recordUsage';
    setOperationLoading(prev => ({ ...prev, [operationKey]: true }));
    
    try {
      const usageRecord = {
        itemId: usageData.itemId,
        quantity: parseFloat(usageData.quantity),
        reason: usageData.reason
      };
      
      await recordUsage(usageRecord);
      setUsageData({
        itemId: '',
        quantity: '',
        reason: 'cooking'
      });
      // Show success message
      setTimeout(() => alert('Usage recorded successfully!'), 100);
    } catch (error) {
      console.error('Error recording usage:', error);
      alert('Failed to record usage');
    } finally {
      setOperationLoading(prev => ({ ...prev, [operationKey]: false }));
    }
  };

  // Handle recording waste
  const handleRecordWaste = async (e) => {
    e.preventDefault();
    if (!wasteData.itemId || !wasteData.quantity || !wasteData.reason) {
      alert('Please fill in all required fields');
      return;
    }
    
    const operationKey = 'recordWaste';
    setOperationLoading(prev => ({ ...prev, [operationKey]: true }));
    
    try {
      const wasteRecord = {
        itemId: wasteData.itemId,
        quantity: parseFloat(wasteData.quantity),
        reason: wasteData.reason,
        notes: wasteData.notes
      };
      
      await recordWaste(wasteRecord);
      setWasteData({
        itemId: '',
        quantity: '',
        reason: '',
        notes: ''
      });
      // Show success message
      setTimeout(() => alert('Waste recorded successfully!'), 100);
    } catch (error) {
      console.error('Error recording waste:', error);
      alert('Failed to record waste');
    } finally {
      setOperationLoading(prev => ({ ...prev, [operationKey]: false }));
    }
  };

  return (
    <div className="inventory-management">
      <h2>Inventory & Expenses</h2>
      
      {/* Loading overlay */}
      {loading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Loading inventory data...</p>
        </div>
      )}
      
      {/* Tab Navigation */}
      <div className="settings-tabs">
        <button 
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button 
          className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          Inventory
        </button>
        <button 
          className={`tab-btn ${activeTab === 'purchases' ? 'active' : ''}`}
          onClick={() => setActiveTab('purchases')}
        >
          Purchases
        </button>
        <button 
          className={`tab-btn ${activeTab === 'usage' ? 'active' : ''}`}
          onClick={() => setActiveTab('usage')}
        >
          Usage
        </button>
        <button 
          className={`tab-btn ${activeTab === 'waste' ? 'active' : ''}`}
          onClick={() => setActiveTab('waste')}
        >
          Waste
        </button>
        <button 
          className={`tab-btn ${activeTab === 'expenses' ? 'active' : ''}`}
          onClick={() => setActiveTab('expenses')}
        >
          Expenses
        </button>
        <button 
          className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          Reports
        </button>
        <button 
          className={`tab-btn ${activeTab === 'export' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('export');
            loadExportData();
          }}
        >
          Export & Clean
        </button>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="settings-section">
          <h3>Inventory Dashboard</h3>
          
          <div className="dashboard-stats">
            <div className="stat-card">
              <h4>Total Items</h4>
              <p className="stat-value">{inventoryItems.length}</p>
            </div>
            <div className="stat-card">
              <h4>Low Stock Items</h4>
              <p className="stat-value warning">{lowStockItems.length}</p>
            </div>
            <div className="stat-card">
              <h4>Out of Stock Items</h4>
              <p className="stat-value error">{outOfStockItems.length}</p>
            </div>
            <div className="stat-card">
              <h4>Total Expenses ({expensePeriod})</h4>
              <p className="stat-value">₹{totalExpenses.toFixed(2)}</p>
            </div>
          </div>
          
          <div className="dashboard-sections">
            <div className="dashboard-section">
              <h4>Low Stock Items</h4>
              {lowStockItems.length > 0 ? (
                <div className="items-grid">
                  {lowStockItems.map(item => (
                    <div key={item.id} className="item-card warning">
                      <h5>{item.name}</h5>
                      <p>Stock: {item.currentStock} {item.unit}</p>
                      <p>Min: {item.minThreshold} {item.unit}</p>
                      <p>Supplier: {item.supplier}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p>All items are well-stocked!</p>
              )}
            </div>
            
            <div className="dashboard-section">
              <h4>Out of Stock Items</h4>
              {outOfStockItems.length > 0 ? (
                <div className="items-grid">
                  {outOfStockItems.map(item => (
                    <div key={item.id} className="item-card error">
                      <h5>{item.name}</h5>
                      <p>Stock: {item.currentStock} {item.unit}</p>
                      <p>Supplier: {item.supplier}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No items are out of stock!</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Export & Clean Tab */}
      {activeTab === 'export' && (
        <div className="settings-section">
          <h3>Export & Clean Data</h3>
          
          <div className="export-controls">
            <div className="export-section">
              <h4>Export Data</h4>
              <p>Export your inventory and expense data for backup or analysis purposes.</p>
              
              <div className="export-options">
                <div className="form-group">
                  <label>Export Format:</label>
                  <select 
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value)}
                    className="form-control"
                  >
                    <option value="excel">Excel (.xlsx)</option>
                    <option value="pdf">PDF</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Date Range:</label>
                  <div className="date-range-inputs">
                    <input
                      type="date"
                      value={exportDateRange.startDate}
                      onChange={(e) => setExportDateRange(prev => ({...prev, startDate: e.target.value}))}
                      placeholder="Start Date"
                    />
                    <span>to</span>
                    <input
                      type="date"
                      value={exportDateRange.endDate}
                      onChange={(e) => setExportDateRange(prev => ({...prev, endDate: e.target.value}))}
                      placeholder="End Date"
                    />
                  </div>
                </div>
                
                <button 
                  onClick={handleExport}
                  className="export-btn"
                  disabled={exportLoading}
                >
                  {exportLoading ? 'Exporting...' : `Export to ${exportFormat.toUpperCase()}`}
                </button>
              </div>
            </div>
            
            <div className="clean-section">
              <h4>Clean Data</h4>
              <div className="warning-box">
                <h5>⚠️ Warning: This action is irreversible</h5>
                <p>This will permanently delete all inventory items, purchase records, usage logs, and waste entries from the database. Please ensure you have exported your data before proceeding.</p>
              </div>
              
              <button 
                onClick={cleanData}
                className="clean-btn"
                disabled={cleanLoading}
              >
                {cleanLoading ? 'Cleaning...' : 'Delete All Data'}
              </button>
            </div>
            
            <div className="data-summary">
              <h4>Data Summary</h4>
              <div className="summary-stats">
                <div className="stat-card">
                  <h5>Inventory Items</h5>
                  <p>{inventoryItems.length}</p>
                </div>
                <div className="stat-card">
                  <h5>Purchase Records</h5>
                  <p>{purchaseRecords.length}</p>
                </div>
                <div className="stat-card">
                  <h5>Usage Logs</h5>
                  <p>{usageLogs.length}</p>
                </div>
                <div className="stat-card">
                  <h5>Waste Entries</h5>
                  <p>{wasteEntries.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <div className="settings-section">
          <h3>Manage Inventory Items</h3>
          
          <div className="add-item-form">
            <h4>Add New Inventory Item</h4>
            <form onSubmit={handleAddItem} className="form-row">
              <input
                type="text"
                placeholder="Item Name"
                value={newItem.name}
                onChange={(e) => setNewItem({...newItem, name: e.target.value})}
                required
              />
              <select
                value={newItem.category}
                onChange={(e) => setNewItem({...newItem, category: e.target.value})}
                required
              >
                <option value="">Select Category</option>
                <option value="vegetables">Vegetables</option>
                <option value="meat">Meat</option>
                <option value="spices">Spices</option>
                <option value="dairy">Dairy</option>
                <option value="grains">Grains</option>
                <option value="oil">Oil & Fats</option>
                <option value="beverages">Beverages</option>
                <option value="packaging">Packaging</option>
                <option value="supplies">Supplies</option>
              </select>
              <input
                type="text"
                placeholder="Unit (kg, g, L, pcs)"
                value={newItem.unit}
                onChange={(e) => setNewItem({...newItem, unit: e.target.value})}
                required
              />
              <input
                type="text"
                placeholder="Supplier"
                value={newItem.supplier}
                onChange={(e) => setNewItem({...newItem, supplier: e.target.value})}
              />
              <input
                type="number"
                placeholder="Min Threshold"
                value={newItem.minThreshold}
                onChange={(e) => setNewItem({...newItem, minThreshold: parseInt(e.target.value)})}
                min="0"
              />
              <button 
                type="submit" 
                className="add-btn"
                disabled={operationLoading.addItem}
              >
                {operationLoading.addItem ? 'Adding...' : 'Add Item'}
              </button>
            </form>
          </div>

          <div className="inventory-list">
            <h4>Current Inventory</h4>
            {inventoryItems.length === 0 ? (
              <p>No inventory items found. Add some items above.</p>
            ) : (
              <div className="items-grid">
                {inventoryItems.map(item => (
                  <div key={item.id} className="inventory-card">
                    <h5>{item.name}</h5>
                    <p><strong>Category:</strong> {item.category}</p>
                    <p><strong>Current Stock:</strong> {item.currentStock} {item.unit}</p>
                    <p><strong>Supplier:</strong> {item.supplier || 'N/A'}</p>
                    <div className="stock-indicator">
                      <span className={`stock-badge ${
                        item.currentStock === 0 ? 'danger' : 
                        item.currentStock <= item.minThreshold ? 'warning' : 'success'
                      }`}>
                        {item.currentStock === 0 ? 'OUT OF STOCK' : 
                         item.currentStock <= item.minThreshold ? 'LOW STOCK' : 'IN STOCK'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Purchases Tab */}
      {activeTab === 'purchases' && (
        <div className="settings-section">
          <h3>Record Purchases</h3>
          
          <div className="purchase-form">
            <h4>New Purchase</h4>
            <form onSubmit={handleRecordPurchase} className="form-row">
              <select
                value={purchaseData.itemId}
                onChange={(e) => setPurchaseData({...purchaseData, itemId: e.target.value})}
                required
              >
                <option value="">Select Item</option>
                {inventoryItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} (Current: {item.currentStock} {item.unit})
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="Quantity"
                value={purchaseData.quantity}
                onChange={(e) => setPurchaseData({...purchaseData, quantity: e.target.value})}
                min="0.01"
                step="0.01"
                required
              />
              <input
                type="number"
                placeholder="Unit Cost (₹)"
                value={purchaseData.unitCost}
                onChange={(e) => setPurchaseData({...purchaseData, unitCost: e.target.value})}
                min="0.01"
                step="0.01"
                required
              />
              <input
                type="text"
                placeholder="Supplier"
                value={purchaseData.supplier}
                onChange={(e) => setPurchaseData({...purchaseData, supplier: e.target.value})}
              />
              <input
                type="text"
                placeholder="Notes"
                value={purchaseData.notes}
                onChange={(e) => setPurchaseData({...purchaseData, notes: e.target.value})}
              />
              <button 
                type="submit" 
                className="add-btn"
                disabled={operationLoading.recordPurchase}
              >
                {operationLoading.recordPurchase ? 'Recording...' : 'Record Purchase'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Usage Tab */}
      {activeTab === 'usage' && (
        <div className="settings-section">
          <h3>Record Usage</h3>
          
          <div className="usage-form">
            <h4>Record Item Usage</h4>
            <form onSubmit={handleRecordUsage} className="form-row">
              <select
                value={usageData.itemId}
                onChange={(e) => setUsageData({...usageData, itemId: e.target.value})}
                required
              >
                <option value="">Select Item</option>
                {inventoryItems
                  .filter(item => item.currentStock > 0)
                  .map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.currentStock} {item.unit} available)
                    </option>
                  ))}
              </select>
              <input
                type="number"
                placeholder="Quantity Used"
                value={usageData.quantity}
                onChange={(e) => setUsageData({...usageData, quantity: e.target.value})}
                min="0.01"
                step="0.01"
                required
              />
              <select
                value={usageData.reason}
                onChange={(e) => setUsageData({...usageData, reason: e.target.value})}
              >
                <option value="cooking">Cooking</option>
                <option value="preparation">Preparation</option>
                <option value="production">Production</option>
                <option value="other">Other</option>
              </select>
              <button 
                type="submit" 
                className="add-btn"
                disabled={operationLoading.recordUsage}
              >
                {operationLoading.recordUsage ? 'Recording...' : 'Record Usage'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Waste Tab */}
      {activeTab === 'waste' && (
        <div className="settings-section">
          <h3>Record Waste</h3>
          
          <div className="waste-form">
            <h4>Record Waste/Discard</h4>
            <form onSubmit={handleRecordWaste} className="form-row">
              <select
                value={wasteData.itemId}
                onChange={(e) => setWasteData({...wasteData, itemId: e.target.value})}
                required
              >
                <option value="">Select Item</option>
                {inventoryItems
                  .filter(item => item.currentStock > 0)
                  .map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.currentStock} {item.unit} available)
                    </option>
                  ))}
              </select>
              <input
                type="number"
                placeholder="Quantity Wasted"
                value={wasteData.quantity}
                onChange={(e) => setWasteData({...wasteData, quantity: e.target.value})}
                min="0.01"
                step="0.01"
                required
              />
              <select
                value={wasteData.reason}
                onChange={(e) => setWasteData({...wasteData, reason: e.target.value})}
                required
              >
                <option value="">Select Reason</option>
                <option value="expired">Expired</option>
                <option value="spoiled">Spoiled</option>
                <option value="damaged">Damaged</option>
                <option value="over-prepared">Over Prepared</option>
                <option value="accidental">Accidental Loss</option>
                <option value="other">Other</option>
              </select>
              <input
                type="text"
                placeholder="Additional Notes"
                value={wasteData.notes}
                onChange={(e) => setWasteData({...wasteData, notes: e.target.value})}
              />
              <button 
                type="submit" 
                className="add-btn"
                disabled={operationLoading.recordWaste}
              >
                {operationLoading.recordWaste ? 'Recording...' : 'Record Waste'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Expenses Tab */}
      {activeTab === 'expenses' && (
        <div className="settings-section">
          <h3>Expense Reports</h3>
          
          <div className="expense-controls">
            <div className="form-row">
              <select
                value={expensePeriod}
                onChange={(e) => {
                  setExpensePeriod(e.target.value);
                  loadExpenseData();
                }}
              >
                <option value="week">Last Week</option>
                <option value="month">Last Month</option>
                <option value="quarter">Last 3 Months</option>
                <option value="halfYear">Last 6 Months</option>
                <option value="year">Last Year</option>
              </select>
            </div>
          </div>

          <div className="expense-summary">
            <div className="stat-card large">
              <h4>Total Expenses ({expensePeriod})</h4>
              <p className="stat-value large">₹{totalExpenses.toFixed(2)}</p>
            </div>
          </div>

          <div className="expense-breakdown">
            <h4>Expense Categories</h4>
            <div className="category-list">
              {inventoryItems
                .filter(item => item.totalPurchased > 0)
                .sort((a, b) => (b.totalPurchased * (b.unitCost || 0)) - (a.totalPurchased * (a.unitCost || 0)))
                .slice(0, 10)
                .map(item => {
                  const totalCost = item.totalPurchased * (item.unitCost || 0);
                  const percentage = totalExpenses > 0 ? (totalCost / totalExpenses * 100) : 0;
                  return (
                    <div key={item.id} className="category-item">
                      <div className="category-info">
                        <span className="category-name">{item.name}</span>
                        <span className="category-amount">₹{totalCost.toFixed(2)}</span>
                      </div>
                      <div className="progress-bar">
                        <div 
                          className="progress-fill" 
                          style={{width: `${percentage}%`}}
                        ></div>
                      </div>
                      <span className="category-percent">{percentage.toFixed(1)}%</span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="settings-section">
          <h3>Inventory Reports</h3>
          
          <div className="report-controls">
            <div className="form-row">
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
              >
                <option value="usage">Category Usage Report</option>
                <option value="supplier">Supplier Performance</option>
                <option value="turnover">Inventory Turnover</option>
              </select>
              
              {reportType === 'usage' && (
                <select
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value)}
                >
                  <option value="dairy">Dairy</option>
                  <option value="vegetables">Vegetables</option>
                  <option value="meat">Meat</option>
                  <option value="spices">Spices</option>
                  <option value="grains">Grains</option>
                  <option value="oil">Oil & Fats</option>
                  <option value="beverages">Beverages</option>
                  <option value="packaging">Packaging</option>
                  <option value="supplies">Supplies</option>
                </select>
              )}
              
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                placeholder="Start Date"
              />
              
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                placeholder="End Date"
              />
              
              <button 
                onClick={generateReport}
                className="add-btn"
                disabled={reportLoading}
              >
                {reportLoading ? 'Generating...' : 'Generate Report'}
              </button>
            </div>
          </div>

          {reportData && (
            <div className="report-results">
              <h4>Report Results</h4>
              
              {reportType === 'usage' && (
                <div className="usage-report">
                  <h5>Category: {reportCategory}</h5>
                  <p>Period: {reportData.startDate.toLocaleDateString()} - {reportData.endDate.toLocaleDateString()}</p>
                  <p>Total Usage: {reportData.totalUsage.toFixed(2)} units</p>
                  <p>Total Purchases: {reportData.totalPurchases.toFixed(2)} units</p>
                  <p>Total Waste: {reportData.totalWaste.toFixed(2)} units</p>
                  
                  <div className="report-items">
                    <h6>Item Details:</h6>
                    {reportData.items.map(item => (
                      <div key={item.id} className="report-item">
                        <h6>{item.name}</h6>
                        <p>Usage: {item.totalUsage.toFixed(2)} {item.unit}</p>
                        <p>Purchases: {item.totalPurchases.toFixed(2)} {item.unit}</p>
                        <p>Waste: {item.totalWaste.toFixed(2)} {item.unit}</p>
                        {item.usageBySupplier && (
                          <div className="supplier-breakdown">
                            <h6>By Supplier:</h6>
                            {Object.entries(item.usageBySupplier).map(([supplier, data]) => (
                              <p key={supplier}>
                                {supplier}: Used {data.used.toFixed(2)}, Purchased {data.purchased.toFixed(2)}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {reportType === 'supplier' && (
                <div className="supplier-report">
                  <h5>Supplier Performance Report</h5>
                  <div className="report-table">
                    <table>
                      <thead>
                        <tr>
                          <th>Supplier</th>
                          <th>Total Purchases</th>
                          <th>Total Amount (₹)</th>
                          <th>Unique Items</th>
                          <th>Avg Order Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.map(supplier => (
                          <tr key={supplier.supplier}>
                            <td>{supplier.supplier}</td>
                            <td>{supplier.totalPurchases}</td>
                            <td>₹{supplier.totalAmount.toFixed(2)}</td>
                            <td>{supplier.uniqueItems}</td>
                            <td>₹{supplier.averageOrderValue.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              {reportType === 'turnover' && (
                <div className="turnover-report">
                  <h5>Inventory Turnover Report</h5>
                  <div className="report-items">
                    {reportData.map(item => (
                      <div key={item.id} className="report-item">
                        <h6>{item.name}</h6>
                        <p>Turnover Ratio: {item.turnoverRatio.toFixed(2)}</p>
                        <p>Usage: {item.totalUsage.toFixed(2)} {item.unit}</p>
                        <p>Purchases: {item.totalPurchases.toFixed(2)} {item.unit}</p>
                        <p>Average Inventory: {item.averageInventory.toFixed(2)} {item.unit}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default InventoryManagement;