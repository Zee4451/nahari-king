import React, { useState, useEffect, useMemo } from 'react';
import { useTableContext } from '../../context/TableContext';
import { addHistory as addHistoryFirebase } from '../../services/firebaseService';
import { getPaymentMethods } from '../../services/shiftService';
import {
    generateReceiptQRCode,
    openWhatsAppReceipt,
    getDigitalReceiptUrl
} from '../../utils/receiptHelper';
import {
    MessageSquare,
    QrCode,
    CheckCircle2,
    Copy,
    Check,
    ArrowRight,
    UtensilsCrossed,
    ShoppingBag
} from 'lucide-react';

const CheckoutModal = () => {
    const { checkoutModal, setCheckoutModal, clearOrder, clearTable } = useTableContext();
    const [paymentMethods, setPaymentMethods] = useState(['Cash', 'UPI']);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [customerPhone, setCustomerPhone] = useState('');
    const [showQRCode, setShowQRCode] = useState(false);
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [copiedLink, setCopiedLink] = useState(false);
    const [completedStep, setCompletedStep] = useState(false);
    const [completedReceipt, setCompletedReceipt] = useState(null);

    useEffect(() => {
        const loadMethods = async () => {
            const methods = await getPaymentMethods();
            if (methods) setPaymentMethods(methods);
        };
        if (checkoutModal.isOpen) {
            loadMethods();
            setShowQRCode(false);
            setCompletedStep(false);
            setCompletedReceipt(null);
            setCustomerPhone('');
            setCopiedLink(false);
        }
    }, [checkoutModal.isOpen]);

    // Calculate dine-in vs parcel subtotals if available
    const { dineInSubtotal, parcelSubtotal, billItems, hasBothSubtotals, targetTableId } = useMemo(() => {
        let dine = 0;
        let parcel = 0;
        const items = [];
        const ordersToCheck = checkoutModal.type === 'order'
            ? [checkoutModal.itemsToClear?.orderToClear].filter(Boolean)
            : (checkoutModal.itemsToClear?.table?.orders || []);

        ordersToCheck.forEach(order => {
            (order?.items || []).forEach(item => {
                const isParcel = item.isParcel || String(item.id).endsWith('_parcel') || String(checkoutModal.targetId || checkoutModal.targetTableId).startsWith('P-');
                const sub = (Number(item.price) || 0) * (Number(item.quantity) || 0);
                if (isParcel) {
                    parcel += sub;
                } else {
                    dine += sub;
                }
                items.push({
                    id: item.id,
                    name: item.name,
                    price: Number(item.price) || 0,
                    quantity: Number(item.quantity) || 0,
                    isParcel
                });
            });
        });

        const target = checkoutModal.type === 'order'
            ? checkoutModal.targetTableId
            : checkoutModal.targetId;

        return {
            dineInSubtotal: dine,
            parcelSubtotal: parcel,
            billItems: items,
            hasBothSubtotals: dine > 0 && parcel > 0,
            targetTableId: target
        };
    }, [checkoutModal]);

    // Live receipt data for sharing / QR
    const receiptData = useMemo(() => {
        return {
            billNo: Math.floor(100000 + Math.random() * 900000),
            tableId: targetTableId,
            orderType: hasBothSubtotals ? 'dine-in + parcel' : (parcelSubtotal > 0 ? 'takeaway' : 'dine-in'),
            items: billItems,
            dineInSubtotal,
            parcelSubtotal,
            total: checkoutModal.total,
            paymentMethod: 'Paid',
            timestamp: new Date().toLocaleString('en-IN')
        };
    }, [targetTableId, hasBothSubtotals, parcelSubtotal, dineInSubtotal, billItems, checkoutModal.total]);

    // Generate QR Code when modal opens or toggle activated
    useEffect(() => {
        if (checkoutModal.isOpen) {
            generateReceiptQRCode(receiptData).then(url => {
                if (url) setQrCodeUrl(url);
            });
        }
    }, [checkoutModal.isOpen, receiptData]);

    if (!checkoutModal.isOpen) return null;

    const handleSendWhatsApp = () => {
        const activeData = completedReceipt || receiptData;
        openWhatsAppReceipt(activeData, customerPhone);
    };

    const handleCopyLink = () => {
        const activeData = completedReceipt || receiptData;
        const link = getDigitalReceiptUrl(activeData);
        if (navigator.clipboard) {
            navigator.clipboard.writeText(link).then(() => {
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
            });
        }
    };

    const handleClose = () => {
        setCheckoutModal({ isOpen: false, type: null, targetId: null, targetTableId: null, total: 0, itemsToClear: null });
        setCompletedStep(false);
        setCompletedReceipt(null);
    };

    const handleCheckoutSubmit = async (paymentMethod) => {
        if (isSubmitting) return;
        const { type, targetId, targetTableId: tgtTableId, itemsToClear } = checkoutModal;

        setIsSubmitting(true);
        try {
            const finalReceipt = {
                ...receiptData,
                paymentMethod,
                timestamp: new Date().toLocaleString('en-IN')
            };

            if (type === 'order') {
                const { orderToClear } = itemsToClear;
                const isParcel = String(tgtTableId).startsWith('P-') || orderToClear.isTakeaway;
                const finalOrderType = isParcel
                    ? 'takeaway'
                    : (hasBothSubtotals ? 'dine-in + parcel' : (parcelSubtotal > 0 ? 'takeaway' : 'dine-in'));

                const historyEntry = {
                    billNo: receiptData.billNo,
                    tableId: tgtTableId,
                    orderType: finalOrderType,
                    dineInSubtotal,
                    parcelSubtotal,
                    orders: [orderToClear],
                    total: orderToClear.total,
                    paymentMethod,
                    customerPhone: customerPhone.trim() || null,
                    timestamp: new Date().toLocaleString()
                };

                await addHistoryFirebase(historyEntry);
                clearOrder(tgtTableId, targetId);
            } else if (type === 'table') {
                const { table } = itemsToClear;
                const isParcel = String(targetId).startsWith('P-') || table.type === 'takeaway';
                const finalOrderType = isParcel
                    ? 'takeaway'
                    : (hasBothSubtotals ? 'dine-in + parcel' : (parcelSubtotal > 0 ? 'takeaway' : 'dine-in'));

                const historyEntry = {
                    id: Date.now().toString(),
                    billNo: receiptData.billNo,
                    tableId: targetId,
                    orderType: finalOrderType,
                    dineInSubtotal,
                    parcelSubtotal,
                    orders: table.orders,
                    total: table.total,
                    paymentMethod,
                    customerPhone: customerPhone.trim() || null,
                    timestamp: new Date().toLocaleString()
                };

                await addHistoryFirebase(historyEntry);
                clearTable(targetId);
            }

            // Switch to success view showing the completed receipt with QR & WhatsApp
            setCompletedReceipt(finalReceipt);
            setCompletedStep(true);
        } catch (error) {
            console.error("Checkout error:", error);
            alert("Checkout failed. Please check your connection and try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '100%', padding: '1.5rem' }}>
                {completedStep ? (
                    /* POST-PAYMENT SUCCESS VIEW WITH DIGITAL RECEIPT & QR */
                    <div style={{ textAlign: 'center' }}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            backgroundColor: '#dcfce7',
                            color: '#16a34a',
                            marginBottom: '0.75rem'
                        }}>
                            <CheckCircle2 size={36} strokeWidth={2.5} />
                        </div>

                        <h3 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800, color: '#0f172a' }}>
                            Payment Successful!
                        </h3>
                        <p style={{ margin: '4px 0 1rem 0', color: '#64748b', fontSize: '0.9rem' }}>
                            Settled <strong>₹{checkoutModal.total.toFixed(2)}</strong> via <strong>{completedReceipt?.paymentMethod}</strong>
                        </p>

                        {/* Customer Digital QR Code Box */}
                        <div style={{
                            backgroundColor: '#f8fafc',
                            border: '1.5px dashed #cbd5e1',
                            borderRadius: '14px',
                            padding: '1.25rem 1rem',
                            marginBottom: '1.25rem'
                        }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155', marginBottom: '0.5rem' }}>
                                📷 Customer Scan to View E-Receipt
                            </div>

                            {qrCodeUrl && (
                                <img
                                    src={qrCodeUrl}
                                    alt="Digital Receipt QR Code"
                                    style={{
                                        width: '180px',
                                        height: '180px',
                                        borderRadius: '8px',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                                    }}
                                />
                            )}

                            <p style={{ margin: '6px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                                Scan with any mobile camera or Google Lens
                            </p>
                            <div style={{ marginTop: '6px' }}>
                                <a
                                    href={getDigitalReceiptUrl(completedReceipt || receiptData)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        fontSize: '0.78rem',
                                        color: '#2563eb',
                                        fontWeight: 600,
                                        textDecoration: 'underline'
                                    }}
                                >
                                    🔗 Open Digital Receipt in New Tab
                                </a>
                            </div>
                        </div>

                        {/* WhatsApp Sharing Row */}
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
                            <input
                                type="tel"
                                placeholder="Customer Mobile (e.g. 9876543210)"
                                value={customerPhone}
                                onChange={(e) => setCustomerPhone(e.target.value)}
                                style={{
                                    flex: 1,
                                    padding: '0.6rem 0.8rem',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.9rem'
                                }}
                            />
                            <button
                                type="button"
                                onClick={handleSendWhatsApp}
                                style={{
                                    backgroundColor: '#22c55e',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    padding: '0.6rem 1rem',
                                    fontWeight: 700,
                                    fontSize: '0.88rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    cursor: 'pointer'
                                }}
                            >
                                <MessageSquare size={16} />
                                <span>Send WhatsApp</span>
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                type="button"
                                onClick={handleCopyLink}
                                style={{
                                    flex: 1,
                                    padding: '0.65rem 1rem',
                                    backgroundColor: '#f1f5f9',
                                    color: '#334155',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '8px',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}
                            >
                                {copiedLink ? <Check size={16} style={{ color: '#16a34a' }} /> : <Copy size={16} />}
                                <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleClose}
                                style={{
                                    flex: 1,
                                    padding: '0.65rem 1rem',
                                    backgroundColor: '#2563eb',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '0.95rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px'
                                }}
                            >
                                <span>Done</span>
                                <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                ) : (
                    /* PRE-PAYMENT CHECKOUT VIEW WITH TOTALS, DIGITAL E-BILL & PAYMENT METHODS */
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#1e293b' }}>
                                Settle Bill: {String(targetTableId).startsWith('P-') ? `Takeaway ${targetTableId}` : `Table ${targetTableId}`}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setShowQRCode(!showQRCode)}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '4px 10px',
                                    borderRadius: '6px',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    backgroundColor: showQRCode ? '#dbeafe' : '#f1f5f9',
                                    color: showQRCode ? '#1d4ed8' : '#475569',
                                    border: '1px solid #cbd5e1',
                                    cursor: 'pointer'
                                }}
                            >
                                <QrCode size={14} />
                                <span>{showQRCode ? 'Hide QR' : 'Show QR'}</span>
                            </button>
                        </div>

                        {/* Total Display */}
                        <div style={{ textAlign: 'center', margin: '0.75rem 0 1.25rem 0', backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Total Amount to Settle</div>
                            <div className="total-amount" style={{ fontSize: '2.4rem', fontWeight: 900, color: '#16a34a', marginTop: '2px', lineHeight: 1.1 }}>
                                ₹{checkoutModal.total.toFixed(2)}
                            </div>
                            {hasBothSubtotals && (
                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    marginTop: '8px',
                                    padding: '3px 10px',
                                    background: '#ffffff',
                                    borderRadius: '20px',
                                    border: '1px solid #e2e8f0',
                                    fontSize: '0.78rem',
                                    fontWeight: 600
                                }}>
                                    <span style={{ color: '#2563eb' }}>🍽️ Dine: ₹{dineInSubtotal.toFixed(2)}</span>
                                    <span style={{ color: '#cbd5e1' }}>•</span>
                                    <span style={{ color: '#ea580c' }}>🛍️ Pack: ₹{parcelSubtotal.toFixed(2)}</span>
                                </div>
                            )}
                        </div>

                        {/* Optional QR Code Box */}
                        {showQRCode && (
                            <div style={{
                                backgroundColor: '#f8fafc',
                                border: '1.5px dashed #3b82f6',
                                borderRadius: '12px',
                                padding: '1rem',
                                textAlign: 'center',
                                marginBottom: '1.25rem',
                                animation: 'fadeIn 0.2s ease-in'
                            }}>
                                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1d4ed8', marginBottom: '6px' }}>
                                    Scan with Phone Camera to View Live Bill
                                </div>
                                {qrCodeUrl && (
                                    <img
                                        src={qrCodeUrl}
                                        alt="Bill QR"
                                        style={{ width: '160px', height: '160px', borderRadius: '6px', margin: '0 auto' }}
                                    />
                                )}
                                <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                    <button
                                        type="button"
                                        onClick={handleCopyLink}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#2563eb',
                                            fontSize: '0.78rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            textDecoration: 'underline'
                                        }}
                                    >
                                        {copiedLink ? '✓ Receipt Link Copied!' : '📋 Copy Link'}
                                    </button>
                                    <a
                                        href={getDigitalReceiptUrl(receiptData)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            color: '#2563eb',
                                            fontSize: '0.78rem',
                                            fontWeight: 600,
                                            textDecoration: 'underline'
                                        }}
                                    >
                                        🔗 Test Open
                                    </a>
                                </div>
                            </div>
                        )}

                        {/* Customer Mobile for WhatsApp */}
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                                📲 Send Digital Bill to WhatsApp (Optional)
                            </label>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <input
                                    type="tel"
                                    placeholder="Enter 10-digit customer mobile"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    style={{
                                        flex: 1,
                                        padding: '0.55rem 0.75rem',
                                        borderRadius: '8px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '0.88rem'
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={handleSendWhatsApp}
                                    style={{
                                        backgroundColor: '#22c55e',
                                        color: '#ffffff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        padding: '0.55rem 0.9rem',
                                        fontWeight: 700,
                                        fontSize: '0.82rem',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    <MessageSquare size={14} />
                                    <span>WhatsApp</span>
                                </button>
                            </div>
                        </div>

                        {/* Payment Method Selector */}
                        <h4 style={{ margin: '0 0 0.65rem 0', color: '#475569', fontSize: '0.9rem', fontWeight: 700 }}>
                            Select Payment Method to Settle:
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.65rem', marginBottom: '1rem' }}>
                            {paymentMethods.map(method => (
                                <button
                                    key={method}
                                    type="button"
                                    onClick={() => handleCheckoutSubmit(method)}
                                    className="primary-btn"
                                    disabled={isSubmitting}
                                    style={{
                                        minHeight: '48px',
                                        fontSize: '1.05rem',
                                        fontWeight: '700',
                                        borderRadius: '10px',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        ...(method === 'Cash' ? { background: 'linear-gradient(135deg, #16a34a, #15803d)' } : { background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' })
                                    }}
                                >
                                    {isSubmitting ? 'Processing...' : method}
                                </button>
                            ))}
                        </div>

                        <button
                            type="button"
                            onClick={handleClose}
                            className="secondary-btn"
                            disabled={isSubmitting}
                            style={{
                                minHeight: '40px',
                                width: '100%',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                borderRadius: '8px'
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CheckoutModal;
