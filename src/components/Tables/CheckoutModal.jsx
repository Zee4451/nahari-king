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

    const handleCheckoutSubmit = async (paymentMethod) => {
        if (isSubmitting) return;
        const { type, targetId, targetTableId, itemsToClear } = checkoutModal;

        setIsSubmitting(true);
        try {
            if (type === 'order') {
                const { orderToClear } = itemsToClear;
                const historyEntry = {
                    tableId: targetTableId,
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
                const historyEntry = {
                    id: Date.now().toString(),
                    tableId: targetId,
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
                    <div style={{ fontSize: '1.1rem', color: '#666' }}>Total Amount</div>
                    <div className="total-amount" style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>
                        ₹{checkoutModal.total.toFixed(2)}
                    </div>
                </div>

                <h4 style={{ textAlign: 'center', color: '#666', marginBottom: '1rem' }}>Select Payment Method</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    {paymentMethods.map(method => (
                        <button
                            key={method}
                            onClick={() => handleCheckoutSubmit(method)}
                            className="primary-btn"
                            style={method === 'Cash' ? { background: 'linear-gradient(135deg, #28a745, #218838)' } : {}}
                        >
                            {method}
                        </button>
                    ))}
                </div>

                <button
                    onClick={() => setCheckoutModal({ isOpen: false, type: null, targetId: null, targetTableId: null, total: 0, itemsToClear: null })}
                    className="secondary-btn"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default CheckoutModal;
