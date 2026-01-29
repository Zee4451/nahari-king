import React, { useState, useRef } from 'react';
import { 
  getCategoryUsageReport, 
  getSupplierPerformanceReport, 
  getInventoryTurnoverReport, 
  calculateTotalExpenses,
  getExpenseRecords,
  getItemUsageRecordsByDateRange,
  getItemPurchaseRecordsByDateRange,
  getItemWasteRecordsByDateRange,
  getAllInventoryItems
} from '../services/firebaseService';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const MonthlyReport = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date()
  });
  const reportRef = useRef();

  const generateReport = async () => {
    setIsLoading(true);
    try {
      // Get all necessary data for the report
      const totalExpenses = await calculateTotalExpenses(dateRange.startDate, dateRange.endDate);
      const expenseRecords = await getExpenseRecords(dateRange.startDate, dateRange.endDate);
      const supplierPerformance = await getSupplierPerformanceReport(dateRange.startDate, dateRange.endDate);
      const inventoryTurnover = await getInventoryTurnoverReport(dateRange.startDate, dateRange.endDate);
      const inventoryItems = await getAllInventoryItems();
      
      // Calculate usage and waste for the period
      let totalUsage = 0;
      let totalWaste = 0;
      let totalPurchases = 0;
      
      for (const item of inventoryItems) {
        const usageRecords = await getItemUsageRecordsByDateRange(item.id, dateRange.startDate, dateRange.endDate);
        const wasteRecords = await getItemWasteRecordsByDateRange(item.id, dateRange.startDate, dateRange.endDate);
        const purchaseRecords = await getItemPurchaseRecordsByDateRange(item.id, dateRange.startDate, dateRange.endDate);
        
        totalUsage += usageRecords.reduce((sum, record) => sum + (record.quantity || 0), 0);
        totalWaste += wasteRecords.reduce((sum, record) => sum + (record.quantity || 0), 0);
        totalPurchases += purchaseRecords.reduce((sum, record) => sum + (record.quantity || 0), 0);
      }

      const report = {
        period: `${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}`,
        totalExpenses,
        totalUsage,
        totalWaste,
        totalPurchases,
        expenseRecords,
        supplierPerformance,
        inventoryTurnover,
        inventoryItems
      };

      setReportData(report);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePDF = async () => {
    if (!reportData) {
      alert('Please generate the report first');
      return;
    }

    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(20);
    doc.text('Monthly Inventory & Expense Report', 20, 20);
    
    // Add period
    doc.setFontSize(14);
    doc.text(`Period: ${reportData.period}`, 20, 35);
    
    // Add summary section
    doc.setFontSize(16);
    doc.text('Summary', 20, 50);
    
    doc.setFontSize(12);
    doc.text(`Total Expenses: ₹${reportData.totalExpenses.toFixed(2)}`, 20, 60);
    doc.text(`Total Items Used: ${reportData.totalUsage}`, 20, 70);
    doc.text(`Total Waste: ${reportData.totalWaste}`, 20, 80);
    doc.text(`Total Purchases: ${reportData.totalPurchases}`, 20, 90);
    
    // Add expense records table header
    let yPos = 105;
    doc.setFontSize(14);
    doc.text('Expense Records', 20, yPos);
    yPos += 10;
    
    // Add expense records table
    doc.setFontSize(10);
    doc.text('Item', 20, yPos);
    doc.text('Quantity', 60, yPos);
    doc.text('Unit Cost', 90, yPos);
    doc.text('Total Cost', 120, yPos);
    doc.text('Date', 150, yPos);
    yPos += 5;
    doc.line(15, yPos, 195, yPos); // horizontal line
    yPos += 8;
    
    reportData.expenseRecords.slice(0, 10).forEach(record => {
      doc.text(record.itemName || record.description || 'N/A', 20, yPos);
      doc.text(String(record.quantity || 0), 60, yPos);
      doc.text(`₹${(record.unitCost || 0).toFixed(2)}`, 90, yPos);
      doc.text(`₹${(record.totalCost || 0).toFixed(2)}`, 120, yPos);
      doc.text(record.purchaseDate || 'N/A', 150, yPos);
      yPos += 8;
      
      if (yPos > 270) { // Check if we're near bottom of page
        doc.addPage();
        yPos = 20;
      }
    });
    
    // Add supplier performance section
    doc.addPage();
    yPos = 20;
    doc.setFontSize(14);
    doc.text('Supplier Performance', 20, yPos);
    yPos += 10;
    
    doc.setFontSize(10);
    doc.text('Supplier', 20, yPos);
    doc.text('Total Orders', 60, yPos);
    doc.text('Total Amount', 90, yPos);
    doc.text('Avg Order Value', 130, yPos);
    doc.text('Items Supplied', 170, yPos);
    yPos += 5;
    doc.line(15, yPos, 195, yPos);
    yPos += 8;
    
    reportData.supplierPerformance.slice(0, 10).forEach(supplier => {
      doc.text(supplier.supplier, 20, yPos);
      doc.text(String(supplier.totalPurchases), 60, yPos);
      doc.text(`₹${supplier.totalAmount.toFixed(2)}`, 90, yPos);
      doc.text(`₹${supplier.averageOrderValue.toFixed(2)}`, 130, yPos);
      doc.text(String(supplier.uniqueItems), 170, yPos);
      yPos += 8;
      
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
    });
    
    // Add inventory turnover section
    doc.addPage();
    yPos = 20;
    doc.setFontSize(14);
    doc.text('Inventory Turnover', 20, yPos);
    yPos += 10;
    
    doc.setFontSize(10);
    doc.text('Item', 20, yPos);
    doc.text('Usage', 70, yPos);
    doc.text('Purchases', 100, yPos);
    doc.text('Turnover Ratio', 130, yPos);
    doc.text('Current Stock', 160, yPos);
    yPos += 5;
    doc.line(15, yPos, 195, yPos);
    yPos += 8;
    
    reportData.inventoryTurnover.slice(0, 10).forEach(item => {
      doc.text(item.name || 'N/A', 20, yPos);
      doc.text(String(item.totalUsage || 0), 70, yPos);
      doc.text(String(item.totalPurchases || 0), 100, yPos);
      doc.text(item.turnoverRatio ? item.turnoverRatio.toFixed(2) : '0.00', 130, yPos);
      doc.text(String(item.currentStock || 0), 160, yPos);
      yPos += 8;
      
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
    });
    
    // Save the PDF
    doc.save(`monthly_report_${dateRange.startDate.getFullYear()}-${String(dateRange.startDate.getMonth() + 1).padStart(2, '0')}.pdf`);
  };

  const handleDateChange = (field, value) => {
    const date = new Date(value);
    setDateRange(prev => ({
      ...prev,
      [field]: date
    }));
  };

  return (
    <div className="monthly-report-container">
      <h2>Monthly Inventory & Expense Report</h2>
      
      <div className="report-controls">
        <div className="date-inputs">
          <label>
            Start Date:
            <input
              type="date"
              value={dateRange.startDate.toISOString().split('T')[0]}
              onChange={(e) => handleDateChange('startDate', e.target.value)}
            />
          </label>
          
          <label>
            End Date:
            <input
              type="date"
              value={dateRange.endDate.toISOString().split('T')[0]}
              onChange={(e) => handleDateChange('endDate', e.target.value)}
            />
          </label>
        </div>
        
        <button onClick={generateReport} disabled={isLoading}>
          {isLoading ? 'Generating...' : 'Generate Report'}
        </button>
        
        {reportData && (
          <button onClick={generatePDF}>
            Download PDF Report
          </button>
        )}
      </div>
      
      {isLoading && <div className="loading">Generating report...</div>}
      
      {reportData && (
        <div className="report-preview" ref={reportRef}>
          <h3>Report Preview - {reportData.period}</h3>
          <div className="report-summary">
            <div className="summary-card">
              <h4>Total Expenses</h4>
              <p>₹{reportData.totalExpenses.toFixed(2)}</p>
            </div>
            <div className="summary-card">
              <h4>Total Items Used</h4>
              <p>{reportData.totalUsage}</p>
            </div>
            <div className="summary-card">
              <h4>Total Waste</h4>
              <p>{reportData.totalWaste}</p>
            </div>
            <div className="summary-card">
              <h4>Total Purchases</h4>
              <p>{reportData.totalPurchases}</p>
            </div>
          </div>
          
          <div className="report-details">
            <div className="detail-section">
              <h4>Top Suppliers</h4>
              <ul>
                {reportData.supplierPerformance.slice(0, 5).map((supplier, index) => (
                  <li key={index}>
                    <strong>{supplier.supplier}</strong>: ₹{supplier.totalAmount.toFixed(2)} 
                    ({supplier.totalPurchases} orders)
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="detail-section">
              <h4>Top Consumed Items</h4>
              <ul>
                {reportData.inventoryTurnover
                  .sort((a, b) => (b.totalUsage || 0) - (a.totalUsage || 0))
                  .slice(0, 5)
                  .map((item, index) => (
                    <li key={index}>
                      <strong>{item.name}</strong>: {item.totalUsage || 0} units
                    </li>
                  ))
                }
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyReport;