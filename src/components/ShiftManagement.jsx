import React, { useState, useEffect } from 'react';
import NavigationBar from './NavigationBar';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { getCurrentShift, startShift, addPayout, closeShift, getPaymentMethods } from '../services/shiftService';

const ShiftManagement = () => {
    const [loading, setLoading] = useState(true);
    const [shiftData, setShiftData] = useState(null);
    const [paymentMethods, setPaymentMethods] = useState([]);

    // Forms state
    const [openingCashStr, setOpeningCashStr] = useState('');
    const [payoutAmount, setPayoutAmount] = useState('');
    const [payoutReason, setPayoutReason] = useState('');
    const [expectedCashOverrides, setExpectedCashOverrides] = useState(''); // Just for display/calc
    const [actualClosingCash, setActualClosingCash] = useState('');
    const [showCloseModal, setShowCloseModal] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        let unsubscribe = null;

        const loadShift = async () => {
            try {
                const methods = await getPaymentMethods();
                setPaymentMethods(methods || ['Cash', 'UPI']);

                const shift = await getCurrentShift();
                if (shift) {
                    setShiftData(shift);
                    // Hook up realtime listener
                    unsubscribe = onSnapshot(doc(db, 'shifts', shift.id), (docSnap) => {
                        if (docSnap.exists()) {
                            setShiftData({ id: docSnap.id, ...docSnap.data() });
                        }
                    });
                } else {
                    setShiftData(null);
                }
            } catch (err) {
                console.error("Failed to load shift:", err);
            } finally {
                setLoading(false);
            }
        };

        loadShift();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    const handleStartShift = async () => {
        if (!openingCashStr || isNaN(openingCashStr)) return;
        setIsSubmitting(true);
        try {
            const newShift = await startShift(Number(openingCashStr));
            setShiftData(newShift);

            // Re-mount logic handles attaching the event listener, but for immediate UI:
            window.location.reload();
        } catch (err) {
            console.error(err);
            alert("Error starting shift");
        }
        setIsSubmitting(false);
    };

    const handleAddPayout = async () => {
        if (!payoutAmount || isNaN(payoutAmount) || !payoutReason.trim() || !shiftData) return;
        setIsSubmitting(true);
        try {
            await addPayout(shiftData.id, Number(payoutAmount), payoutReason.trim(), 'expense');
            setPayoutAmount('');
            setPayoutReason('');
            alert('Payout logged successfully! Expected Cash has been reduced.');
        } catch (err) {
            console.error(err);
            alert("Error logging payout");
        }
        setIsSubmitting(false);
    };

    const handleCloseShift = async () => {
        if (!actualClosingCash || isNaN(actualClosingCash) || !shiftData) return;
        setIsSubmitting(true);
        try {
            await closeShift(shiftData.id, Number(actualClosingCash));
            setShowCloseModal(false);
            alert(`Shift Closed! Remaining Discrepancy logged: ₹${Math.abs(shiftData.calculatedTotals.expectedCash - Number(actualClosingCash))}`);
            window.location.reload();
        } catch (err) {
            console.error(err);
            alert("Error closing shift");
        }
        setIsSubmitting(false);
    };

    if (loading) {
        return (
            <div className="tables-page">
                <NavigationBar currentPage="shift" />
                <div style={{ padding: '2rem', textAlign: 'center' }}>Loading Shift Data...</div>
            </div>
        );
    }

    if (!shiftData || shiftData.status !== 'open') {
        return (
            <div className="tables-page">
                <NavigationBar currentPage="shift" />
                <div className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
                    <div className="analytics-card" style={{ width: '100%', maxWidth: '500px', textAlign: 'center' }}>
                        <h2>No Active Shift</h2>
                        <p className="metric-subtitle">You must open a shift to track the cash drawer.</p>

                        <div style={{ marginTop: '2rem', textAlign: 'left' }}>
                            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Opening Cash in Drawer (₹)</label>
                            <input
                                type="number"
                                className="form-input"
                                placeholder="e.g. 5000"
                                value={openingCashStr}
                                onChange={e => setOpeningCashStr(e.target.value)}
                            />
                            <button
                                className="primary-btn"
                                style={{ width: '100%', marginTop: '1rem', padding: '1rem', fontSize: '1.1rem' }}
                                onClick={handleStartShift}
                                disabled={isSubmitting || !openingCashStr}
                            >
                                {isSubmitting ? 'Starting...' : 'Start Shift'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const { calculatedTotals, payouts } = shiftData;

    return (
        <div className="tables-page">
            <NavigationBar currentPage="shift" />

            <div className="page-content">
                <div className="page-header">
                    <h1>Active Shift Management</h1>
                    <button
                        className="delete-btn"
                        style={{ padding: '0.8rem 1.5rem', fontSize: '1.1rem' }}
                        onClick={() => setShowCloseModal(true)}
                    >
                        End Shift
                    </button>
                </div>

                <div className="metrics-grid">
                    <div className="metric-card" style={{ background: 'var(--success-color)', color: 'white' }}>
                        <div className="metric-title" style={{ color: 'rgba(255,255,255,0.8)' }}>Gross Revenue</div>
                        <div className="metric-value">₹{(calculatedTotals?.totalRevenue || 0).toFixed(2)}</div>
                    </div>

                    <div className="metric-card" style={{ border: '2px solid var(--primary-color)' }}>
                        <div className="metric-title">Expected Cash In Drawer</div>
                        <div className="metric-value" style={{ color: 'var(--primary-color)' }}>₹{(calculatedTotals?.expectedCash || 0).toFixed(2)}</div>
                        <div className="metric-subtitle">Opening + Cash Sales - Payouts</div>
                    </div>
                </div>

                <div className="responsive-grid-2">
                    {/* Payment Breakdown */}
                    <div className="analytics-card">
                        <h3>Sales Breakdown by Payment Method</h3>
                        <div style={{ marginTop: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                                <span>Cash Sales</span>
                                <span style={{ fontWeight: 'bold' }}>₹{(calculatedTotals?.cashSales || 0).toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                                <span>UPI Sales</span>
                                <span style={{ fontWeight: 'bold' }}>₹{(calculatedTotals?.upiSales || 0).toFixed(2)}</span>
                            </div>

                            {paymentMethods.filter(m => m !== 'Cash' && m !== 'UPI').map(method => {
                                const val = Object.entries(calculatedTotals?.paymentMethodBreakdown || {}).find(([k]) => k === method)?.[1] || 0;
                                return (
                                    <div key={method} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                                        <span>{method} Sales</span>
                                        <span style={{ fontWeight: 'bold' }}>₹{Number(val).toFixed(2)}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    {/* Petty Cash / Payouts */}
                    <div className="analytics-card">
                        <h3>Log Payout (Petty Cash/Vendors)</h3>
                        <p className="metric-subtitle mb-4">Taking cash out of the drawer for supplies? Log it here to keep your "Expected Cash" accurate.</p>

                        <div className="responsive-flex-row">
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Reason (e.g. Tomatoes)"
                                style={{ flex: 2, margin: 0 }}
                                value={payoutReason}
                                onChange={e => setPayoutReason(e.target.value)}
                            />
                            <input
                                type="number"
                                className="form-input"
                                placeholder="₹ Amount"
                                style={{ flex: 1, margin: 0 }}
                                value={payoutAmount}
                                onChange={e => setPayoutAmount(e.target.value)}
                            />
                            <button
                                className="primary-btn"
                                onClick={handleAddPayout}
                                disabled={isSubmitting || !payoutAmount || !payoutReason}
                            >
                                Log
                            </button>
                        </div>

                        <div style={{ maxHeight: '150px', overflowY: 'auto', marginTop: '1rem' }}>
                            {payouts && payouts.length > 0 ? [...payouts].reverse().map((p, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                    <span>{p.reason}</span>
                                    <span style={{ color: 'var(--danger-color)' }}>-₹{p.amount}</span>
                                </div>
                            )) : (
                                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>No payouts logged in this shift.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* End Shift Modal */}
            {showCloseModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3 style={{ color: 'var(--danger-color)' }}>End Current Shift</h3>
                        <p style={{ color: 'var(--text-secondary)' }}>Count the physical cash in the drawer and enter the exact amount below. This will be compared against the expected cash to calculate discrepancy.</p>

                        <div style={{ margin: '1.5rem 0', background: 'var(--page-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <span>Expected Cash</span>
                                <span style={{ fontWeight: 'bold' }}>₹{(calculatedTotals?.expectedCash || 0).toFixed(2)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                <span>Total Payouts Logged</span>
                                <span>₹{payouts?.reduce((acc, p) => acc + Number(p.amount), 0).toFixed(2) || '0.00'}</span>
                            </div>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Actual Physical Cash (₹)</label>
                            <input
                                type="number"
                                className="form-input"
                                placeholder="e.g. 12500"
                                style={{ fontSize: '1.2rem', padding: '12px' }}
                                value={actualClosingCash}
                                onChange={e => setActualClosingCash(e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button
                                className="secondary-btn"
                                style={{ flex: 1 }}
                                onClick={() => setShowCloseModal(false)}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                className="primary-btn"
                                style={{ flex: 2, background: 'var(--danger-color)' }}
                                onClick={handleCloseShift}
                                disabled={isSubmitting || !actualClosingCash}
                            >
                                Confirm Ending Shift
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ShiftManagement;
