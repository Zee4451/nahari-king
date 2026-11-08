import React, { useState, useEffect } from 'react';
import { useTableContext } from '../../context/TableContext';
import { addHistory as addHistoryFirebase } from '../../services/firebaseService';
import { getPaymentMethods } from '../../services/shiftService';

const CheckoutModal = () => {
    const { checkoutModal, setCheckoutModal, clearOrder, clearTable } = useTableContext();
    const [paymentMethods, setPaymentMethods] = useState(['Cash', 'UPI']);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const loadMethods = async () => {
            const methods = await getPaymentMethods();
            if (methods) setPaymentMethods(methods);
        };
        if (checkoutModal.isOpen) {
            loadMethods();
        }
    }, [checkoutModal.isOpen]);

    if (!checkoutModal.isOpen) return null;

    // Calculate dine-in vs parcel subtotals if available
    let dineInSubtotal = 0;
    let parcelSubtotal = 0;
    const ordersToCheck = checkoutModal.type === 'order'
        ? [checkoutModal.itemsToClear?.orderToClear].filter(Boolean)
        : (checkoutModal.itemsToClear?.table?.orders || []);

    ordersToCheck.forEach(order => {
        (order?.items || []).forEach(item => {
            const isParcel = item.isParcel || String(item.id).endsWith('_parcel') || String(checkoutModal.targetId || checkoutModal.targetTableId).startsWith('P-');
            const sub = (Number(item.price) || 0) * (Number(item.quantity) || 0);
            if (isParcel) {
                parcelSubtotal += sub;
            } else {
                dineInSubtotal += sub;
            }
        });
    });

    const hasBothSubtotals = dineInSubtotal > 0 && parcelSubtotal > 0;

    const handleCheckoutSubmit = async (paymentMethod) => {
        if (isSubmitting) return;
        const { type, targetId, targetTableId, itemsToClear } = checkoutModal;

        setIsSubmitting(true);
        try {
            if (type === 'order') {
                const { orderToClear } = itemsToClear;
                const isParcel = String(targetTableId).startsWith('P-') || orderToClear.isTakeaway;
                const finalOrderType = isParcel
                    ? 'takeaway'
                    : (hasBothSubtotals ? 'dine-in + parcel' : (parcelSubtotal > 0 ? 'takeaway' : 'dine-in'));

                const historyEntry = {
                    tableId: targetTableId,
                    orderType: finalOrderType,
                    dineInSubtotal,
                    parcelSubtotal,
                    orders: [orderToClear],
                    total: orderToClear.total,
                    paymentMethod,
                    timestamp: new Date().toLocaleString()
                };
                // Wait for network confirmation before clearing UI
                await addHistoryFirebase(historyEntry);
                clearOrder(targetTableId, targetId);
            } else if (type === 'table') {
                const { table } = itemsToClear;
                const isParcel = String(targetId).startsWith('P-') || table.type === 'takeaway';
                const finalOrderType = isParcel
                    ? 'takeaway'
                    : (hasBothSubtotals ? 'dine-in + parcel' : (parcelSubtotal > 0 ? 'takeaway' : 'dine-in'));

                const historyEntry = {
                    id: Date.now().toString(),
                    tableId: targetId,
                    orderType: finalOrderType,
                    dineInSubtotal,
                    parcelSubtotal,
                    orders: table.orders,
                    total: table.total,
                    paymentMethod,
                    timestamp: new Date().toLocaleString()
                };
                // Wait for network confirmation before clearing UI
                await addHistoryFirebase(historyEntry);
                clearTable(targetId);
            }

            // Close modal only on success
            setCheckoutModal({ isOpen: false, type: null, targetId: null, targetTableId: null, total: 0, itemsToClear: null });
        } catch (error) {
            console.error("Checkout error:", error);
            alert("Checkout failed. Please check your connection and try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h3>Checkout Summary</h3>
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                    <div style={{ fontSize: '1rem', color: '#64748b', fontWeight: '500' }}>Total Amount to Pay</div>
                    <div className="total-amount" style={{ fontSize: '2.5rem', fontWeight: '800', color: '#00c853', marginTop: '0.25rem' }}>
                        ₹{checkoutModal.total.toFixed(2)}
                    </div>
                    {hasBothSubtotals && (
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '10px',
                            marginTop: '0.5rem',
                            padding: '5px 12px',
                            background: '#f8fafc',
                            borderRadius: '20px',
                            border: '1px solid #e2e8f0',
                            fontSize: '0.8rem',
                            fontWeight: '600'
                        }}>
                            <span style={{ color: '#2563eb' }}>🍽️ Dine-In: ₹{dineInSubtotal.toFixed(2)}</span>
                            <span style={{ color: '#cbd5e1' }}>•</span>
                            <span style={{ color: '#ea580c' }}>🛍️ Parcel: ₹{parcelSubtotal.toFixed(2)}</span>
                        </div>
                    )}
                </div>

                <h4 style={{ textAlign: 'center', color: '#475569', marginBottom: '0.85rem', fontSize: '1.05rem', fontWeight: '600' }}>
                    Select Payment Method
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                    {paymentMethods.map(method => (
                        <button
                            key={method}
                            onClick={() => handleCheckoutSubmit(method)}
                            className="primary-btn"
                            disabled={isSubmitting}
                            style={{
                                minHeight: '52px',
                                fontSize: '1.15rem',
                                fontWeight: '700',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                ...(method === 'Cash' ? { background: 'linear-gradient(135deg, #28a745, #218838)' } : {})
                            }}
                        >
                            {isSubmitting ? 'Processing...' : method}
                        </button>
                    ))}
                </div>

                <button
                    onClick={() => setCheckoutModal({ isOpen: false, type: null, targetId: null, targetTableId: null, total: 0, itemsToClear: null })}
                    className="secondary-btn"
                    disabled={isSubmitting}
                    style={{
                        minHeight: '44px',
                        width: '100%',
                        fontSize: '0.95rem',
                        fontWeight: '600',
                        borderRadius: '8px'
                    }}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default CheckoutModal;
