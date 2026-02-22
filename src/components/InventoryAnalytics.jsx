import React, { useState, useEffect, useMemo } from 'react';
import styles from './InventoryBOM.module.css';
import NavigationBar from './NavigationBar';
import { subscribeToInventory, getAnalyticsData } from '../services/inventoryService';
import { getShiftHistory } from '../services/shiftService';
import emailjs from '@emailjs/browser';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import ChronologicalLedger from './Analytics/ChronologicalLedger';
import MetricsCards from './Analytics/MetricsCards';
import CategoryBreakdown from './Analytics/CategoryBreakdown';

const InventoryAnalytics = () => {
    // Top-level state
    const [loading, setLoading] = useState(true);
    const [metricsLoading, setMetricsLoading] = useState(true);
    const [error, setError] = useState('');

    // Report Trigger State
    const [isSendingReport, setIsSendingReport] = useState(false);
    const [reportMessage, setReportMessage] = useState({ text: '', type: '' });

    // Data state
    const [inventory, setInventory] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [usages, setUsages] = useState([]);
    const [wastes, setWastes] = useState([]);
    const [dailyMetrics, setDailyMetrics] = useState([]);

    // Date Range State
    const [datePreset, setDatePreset] = useState('7days');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');



    // Fetch real-time total inventory for current stock value
    useEffect(() => {
        const unsubscribe = subscribeToInventory((items) => {
            setInventory(items);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Fetch historical metric data whenever date range changes
    useEffect(() => {
        const fetchMetrics = async () => {
            setMetricsLoading(true);
            setError('');

            let start = new Date();
            let end = new Date();
            end.setHours(23, 59, 59, 999);

            if (datePreset === 'today') {
                start.setHours(0, 0, 0, 0);
            } else if (datePreset === '7days') {
                start.setDate(start.getDate() - 7);
                start.setHours(0, 0, 0, 0);
            } else if (datePreset === 'thisMonth') {
                start = new Date(start.getFullYear(), start.getMonth(), 1);
            } else if (datePreset === 'custom') {
                if (!customStartDate || !customEndDate) {
                    setMetricsLoading(false);
                    return; // Wait for user to pick both dates
                }
                start = new Date(customStartDate);
                start.setHours(0, 0, 0, 0);
                end = new Date(customEndDate);
                end.setHours(23, 59, 59, 999);
            }

            try {
                const data = await getAnalyticsData(start, end);
                setPurchases(data.purchases);
                setUsages(data.usages);
                setWastes(data.waste);
                setDailyMetrics(data.metricsDocs || []);
                setDailyMetrics(data.metricsDocs || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setMetricsLoading(false);
            }
        };

        fetchMetrics();
    }, [datePreset, customStartDate, customEndDate]);

    // Report Handler
    const handleSendReport = async () => {
        setIsSendingReport(true);
        setReportMessage({ text: '', type: '' });

        let targetDate = new Date();
        if (datePreset === 'custom' && customStartDate) {
            targetDate = new Date(customStartDate);
        } else if (datePreset === 'today') {
            targetDate = new Date();
        }

        // Format YYYY-MM-DD
        const yyyy = targetDate.getFullYear();
        const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
        const dd = String(targetDate.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        try {
            // 1. Fetch daily metrics
            const dailyRef = doc(db, 'daily_metrics', dateStr);
            const dailySnap = await getDoc(dailyRef);

            if (!dailySnap.exists()) {
                setReportMessage({ text: `No data recorded for ${dateStr} yet.`, type: 'info' });
                setIsSendingReport(false);
                return;
            }

            const metrics = dailySnap.data();

            // 2. Format HTML Body
            const totalRevenue = metrics.totalSales || 0;
            const totalOrders = metrics.totalOrders || 0;
            const dineInTables = metrics.dineInTables || 0;
            const onlineTables = totalOrders - dineInTables;
            const totalCOGS = metrics.totalCOGS || 0;
            const totalWastageLoss = metrics.totalWastageLoss || 0;
            const grossProfit = totalRevenue - totalCOGS;

            // Unflatten itemSales dot notation
            const unflattenedItems = {};
            Object.keys(metrics).forEach(k => {
                if (k.startsWith('itemSales.')) {
                    const parts = k.split('.');
                    const safeName = parts[1];
                    const prop = parts[2]; // name, qty, or revenue
                    if (!unflattenedItems[safeName]) {
                        unflattenedItems[safeName] = { name: '', qty: 0, revenue: 0 };
                    }
                    unflattenedItems[safeName][prop] = metrics[k];
                } else if (k === 'itemSales' && typeof metrics[k] === 'object') {
                    // Fallback for properly nested objects
                    Object.assign(unflattenedItems, metrics[k]);
                }
            });

            const itemsArr = Object.values(unflattenedItems).sort((a, b) => (b.qty || 0) - (a.qty || 0));
            let topItemsHtml = itemsArr.length > 0 ? itemsArr.map((item, idx) =>
                `<li>${idx + 1}. ${item.name} — Qty: ${item.qty} | Revenue: &#8377;${(item.revenue || 0).toFixed(2)}</li>`
            ).join("") : "<li>No items sold</li>";

            // 1.5 Fetch shift info for the day
            const startOfDay = new Date(targetDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(targetDate);
            endOfDay.setHours(23, 59, 59, 999);

            const shifts = await getShiftHistory(startOfDay); // returns all shifts after startOfDay
            const dayShifts = shifts.filter(s => s.openingTime && s.openingTime.toDate() <= endOfDay);

            let shiftSummaryHtml = '';
            if (dayShifts.length > 0) {
                let totalExpectedCash = 0;
                let totalActualCash = 0;
                let totalPayouts = 0;
                let totalUPI = 0;
                let customMethodsHtml = '';
                const customMethods = {};

                dayShifts.forEach(s => {
                    const ct = s.calculatedTotals || {};
                    totalExpectedCash += (ct.expectedCash || 0);
                    // If a shift isn't closed yet, actualClosingCash is null. Fallback to 0.
                    totalActualCash += (s.actualClosingCash || 0);
                    totalUPI += (ct.upiSales || 0);

                    const pOuts = s.payouts || [];
                    pOuts.forEach(p => totalPayouts += Number(p.amount || 0));

                    if (ct.paymentMethodBreakdown) {
                        Object.entries(ct.paymentMethodBreakdown).forEach(([method, amt]) => {
                            customMethods[method] = (customMethods[method] || 0) + Number(amt);
                        });
                    }
                });

                Object.entries(customMethods).forEach(([m, amt]) => {
                    customMethodsHtml += `<p><b>${m} Sales:</b> &#8377;${amt.toFixed(2)}</p>`;
                });

                const discrepancy = totalActualCash - totalExpectedCash;
                const discColor = discrepancy < 0 ? 'red' : (discrepancy > 0 ? 'green' : 'black');

                shiftSummaryHtml = `
                    <br/>
                    <h3>Shift & Cash Management</h3>
                    <p><b>Shifts Logged:</b> ${dayShifts.length}</p>
                    <p><b>Total Expected Cash:</b> &#8377;${totalExpectedCash.toFixed(2)}</p>
                    <p><b>Total Physical Cash Counted:</b> &#8377;${totalActualCash.toFixed(2)}</p>
                    <p style="color: ${discColor};"><b>Total Cash Discrepancy:</b> &#8377;${discrepancy.toFixed(2)}</p>
                    <p><b>Total Vendor Payouts:</b> &#8377;${totalPayouts.toFixed(2)}</p>
                    <p><b>Total UPI Sales:</b> &#8377;${totalUPI.toFixed(2)}</p>
                    ${customMethodsHtml}
                `;
            } else {
                shiftSummaryHtml = `
                    <br/>
                    <h3>Shift & Cash Management</h3>
                    <p><i>No shift registers were opened/closed on this date.</i></p>
                 `;
            }

            const htmlBody = `
                <h2>Daily Sales Report – ${dateStr}</h2>
                <hr />
                <h3>Sales Summary</h3>
                <p><b>Total Revenue:</b> &#8377;${totalRevenue.toFixed(2)}</p>
                <p><b>Total Orders:</b> ${totalOrders}</p>
                <p><b>Dine-in Tables:</b> ${dineInTables}</p>
                <p><b>Online Orders:</b> ${onlineTables > 0 ? onlineTables : 0}</p>
                <br/>
                <h3>Item Sales Breakdown</h3>
                <ul>${topItemsHtml}</ul>
                ${shiftSummaryHtml}
                <br/>
                <h3>Profit Snapshot</h3>
                <p><b>Estimated COGS:</b> &#8377;${totalCOGS.toFixed(2)}</p>
                <p><b>Gross Profit:</b> &#8377;${grossProfit.toFixed(2)}</p>
                <p style="color: red;"><b>Reported Wastage Loss:</b> &#8377;${totalWastageLoss.toFixed(2)}</p>
                <br/>
                <p style="color: grey; font-size: 12px;">Auto-generated by Nalli Nihari POS via EmailJS</p>
            `;

            // 3. Send using EmailJS
            const templateParams = {
                subject: `Daily Sales Report – ${dateStr}`,
                message_html: htmlBody,
                date: dateStr
            };

            // Developer Note: Owner must replace these before production!
            const SERVICE_ID = "service_ez8md2s";
            const TEMPLATE_ID = "template_jv2f6sx";
            const PUBLIC_KEY = "wJJ-8VHUbVzl6eVsn";

            await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);
            setReportMessage({ text: `Report sent for ${dateStr} successfully!`, type: 'success' });

        } catch (err) {
            console.error(err);
            setReportMessage({ text: err.text || err.message || 'Failed to send via EmailJS.', type: 'error' });
        } finally {
            setIsSendingReport(false);
            setTimeout(() => setReportMessage({ text: '', type: '' }), 7000); // Clear after 7s
        }
    };

    // Derived Metrics
    const currentInventoryValue = useMemo(() => {
        return inventory.reduce((total, item) => total + (item.currentStock * item.costPerUnit), 0);
    }, [inventory]);

    const totalSpent = useMemo(() => {
        return purchases.reduce((total, p) => total + p.totalCost, 0);
    }, [purchases]);

    const totalUtilized = useMemo(() => {
        return usages.reduce((total, u) => total + u.totalCost, 0);
    }, [usages]);

    const totalWasted = useMemo(() => {
        return wastes.reduce((total, w) => total + w.totalCost, 0);
    }, [wastes]);

    // Categorical Breakdown
    const categoricalData = useMemo(() => {
        const breakdown = {};

        // Map current categories from inventory for easy lookup
        const categoryMap = {};
        inventory.forEach(item => {
            categoryMap[item.id] = item.category || 'other';
        });

        // Tally Purchases (Inflow)
        purchases.forEach(p => {
            const cat = categoryMap[p.inventoryItemId] || 'other';
            if (!breakdown[cat]) breakdown[cat] = { spent: 0, utilized: 0, wasted: 0 };
            breakdown[cat].spent += p.totalCost;
        });

        // Tally Usages (Utilization) - need to loop nested ingredients
        usages.forEach(u => {
            (u.ingredients || []).forEach(ing => {
                const cat = categoryMap[ing.inventoryItemId] || 'other';
                if (!breakdown[cat]) breakdown[cat] = { spent: 0, utilized: 0, wasted: 0 };
                // Calculate estimated cost for this specific ingredient usage
                const cost = ing.quantityUsed * (inventory.find(i => i.id === ing.inventoryItemId)?.costPerUnit || 0);
                breakdown[cat].utilized += cost;
            });
        });

        // Tally Wastes
        wastes.forEach(w => {
            const cat = categoryMap[w.inventoryItemId] || 'other';
            if (!breakdown[cat]) breakdown[cat] = { spent: 0, utilized: 0, wasted: 0 };
            breakdown[cat].wasted += w.totalCost;
        });

        return breakdown;
    }, [purchases, usages, wastes, inventory]);

    // Aggregate Item Sales from Daily Metrics
    const aggregateItemSales = useMemo(() => {
        const itemMap = {};
        dailyMetrics.forEach(metric => {

            // Handle Firestore dot-notation flattening
            Object.keys(metric).forEach(k => {
                if (k.startsWith('itemSales.')) {
                    const parts = k.split('.');
                    const safeName = parts[1];
                    const prop = parts[2]; // name, qty, revenue

                    if (!itemMap[safeName]) itemMap[safeName] = { name: safeName, qty: 0, revenue: 0 };

                    if (prop === 'name') itemMap[safeName].name = metric[k];
                    else if (prop === 'qty') itemMap[safeName].qty += (metric[k] || 0);
                    else if (prop === 'revenue') itemMap[safeName].revenue += (metric[k] || 0);
                }
            });

            // Handle proper nested nested objects just in case
            if (metric.itemSales && typeof metric.itemSales === 'object') {
                Object.values(metric.itemSales).forEach(item => {
                    if (!itemMap[item.name]) {
                        itemMap[item.name] = { name: item.name, qty: 0, revenue: 0 };
                    }
                    itemMap[item.name].qty += item.qty || 0;
                    itemMap[item.name].revenue += item.revenue || 0;
                });
            }
        });
        return Object.values(itemMap).sort((a, b) => b.qty - a.qty);
    }, [dailyMetrics]);

    // Chronological Ledger (combined view)
    const ledger = useMemo(() => {
        const events = [];

        purchases.forEach(p => events.push({
            id: p.id,
            type: 'PURCHASE',
            label: `Purchased: ${p.itemName}`,
            date: p.purchaseDate?.toDate(),
            qty: `+${p.quantity}`,
            value: p.totalCost,
            actor: 'System'
        }));

        usages.forEach(u => events.push({
            id: u.id,
            type: 'PRODUCTION',
            label: `Produced: ${u.quantityProduced || u.targetQuantity} ${u.outputUnit} ${u.recipeName}`,
            date: u.timestamp?.toDate(),
            qty: `-${u.ingredients?.length || 0} ingredients`,
            value: u.totalCost,
            actor: 'System'
        }));

        wastes.forEach(w => events.push({
            id: w.id,
            type: 'WASTE',
            label: `Waste: ${w.itemName} (${w.reason})`,
            date: w.wasteDate?.toDate(),
            qty: `-${w.quantity}`,
            value: w.totalCost,
            actor: 'System'
        }));

        return events.sort((a, b) => {
            const dateA = a.date ? a.date.getTime() : 0;
            const dateB = b.date ? b.date.getTime() : 0;
            return dateB - dateA; // descending
        });
    }, [purchases, usages, wastes]);



    if (loading) {
        return (
            <div className={styles['inventory-page'] || 'inventory-page'}>
                <NavigationBar currentPage="analytics" />
                <div className={styles['inventory-content'] || 'inventory-content'}><div className={styles['loading'] || 'loading'}>Loading Analytics...</div></div>
            </div>
        );
    }

    return (
        <div className={styles['inventory-page'] || 'inventory-page'}>
            <NavigationBar currentPage="analytics" />
            <div className={styles['inventory-content'] || 'inventory-content'}>
                {error && <div className={styles['error-banner'] || 'error-banner'}>{error}</div>}
                {reportMessage.text && (
                    <div className={reportMessage.type === 'error' ? "error-banner" : "success-banner"} style={{ backgroundColor: reportMessage.type === 'info' ? '#e3f2fd' : undefined, color: reportMessage.type === 'info' ? '#0d47a1' : undefined }}>
                        {reportMessage.text}
                    </div>
                )}

                <div className={styles['inventory-header'] || 'inventory-header'}>
                    <div className={styles['page-header'] || 'page-header'}>
                        <h1 style={{ margin: 0 }}>📊 Inventory Analytics</h1>
                        <button
                            className={`${styles['btn'] || 'btn'} ${styles['btn-primary'] || 'btn-primary'}`}
                            onClick={handleSendReport}
                            disabled={isSendingReport}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.2rem', backgroundColor: '#000', color: '#fff', border: 'none', borderRadius: '4px', cursor: isSendingReport ? 'not-allowed' : 'pointer', opacity: isSendingReport ? 0.7 : 1 }}
                        >
                            {isSendingReport ? '⏳ Sending...' : '✉️ Send Daily Report (PDF)'}
                        </button>
                    </div>
                    <div className={`${styles['filter-bar'] || 'filter-bar'} ${styles['no-margin'] || 'no-margin'}`}>
                        <select
                            className={styles['filter-select'] || 'filter-select'}
                            value={datePreset}
                            onChange={(e) => setDatePreset(e.target.value)}
                        >
                            <option value="today">Today</option>
                            <option value="7days">Last 7 Days</option>
                            <option value="thisMonth">This Month</option>
                            <option value="custom">Custom Range</option>
                        </select>
                        {datePreset === 'custom' && (
                            <div className={styles['custom-date-range'] || 'custom-date-range'}>
                                <input
                                    type="date"
                                    className={`${styles['search-input'] || 'search-input'} ${styles['date-picker'] || 'date-picker'}`}
                                    value={customStartDate}
                                    onChange={(e) => setCustomStartDate(e.target.value)}
                                />
                                <span>to</span>
                                <input
                                    type="date"
                                    className={`${styles['search-input'] || 'search-input'} ${styles['date-picker'] || 'date-picker'}`}
                                    value={customEndDate}
                                    onChange={(e) => setCustomEndDate(e.target.value)}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Top Metrics Cards */}
                <MetricsCards
                    currentInventoryValue={currentInventoryValue}
                    totalSpent={totalSpent}
                    totalUtilized={totalUtilized}
                    totalWasted={totalWasted}
                />

                {metricsLoading ? (
                    <div className={styles['loading'] || 'loading'}>Loading period data...</div>
                ) : (
                    <div className={styles['analytics-body'] || 'analytics-body'}>
                        <CategoryBreakdown
                            categoricalData={categoricalData}
                            aggregateItemSales={aggregateItemSales}
                        />

                        {/* Chronological Ledger */}
                        <ChronologicalLedger ledger={ledger} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default InventoryAnalytics;
