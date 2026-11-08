import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { decodeReceiptData, openWhatsAppReceipt, formatBillNumber } from '../utils/receiptHelper';
import { Printer, Share2, CheckCircle2, ArrowLeft } from 'lucide-react';
import './DigitalReceiptPage.css';

const DigitalReceiptPage = () => {
    const [searchParams] = useSearchParams();
    const [receipt, setReceipt] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        let payload = searchParams.get('d');
        if (!payload && typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            payload = urlParams.get('d');
            if (!payload && window.location.hash) {
                const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
                payload = hashParams.get('d');
            }
        }

        if (!payload) {
            setError('No receipt data found in link. Please ask the cashier to scan or share again.');
            return;
        }

        const data = decodeReceiptData(payload);
        if (!data) {
            setError('Could not decode receipt details. Please scan the QR code again.');
            return;
        }

        setReceipt(data);
    }, [searchParams]);

    if (error) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f8fafc',
                padding: '1.5rem',
                fontFamily: 'system-ui, -apple-system, sans-serif'
            }}>
                <div style={{
                    maxWidth: '420px',
                    width: '100%',
                    backgroundColor: '#ffffff',
                    padding: '2rem',
                    borderRadius: '16px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>⚠️</div>
                    <h2 style={{ fontSize: '1.25rem', color: '#1e293b', marginBottom: '0.5rem', fontWeight: 700 }}>
                        Receipt Not Found
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
                        {error}
                    </p>
                    <Link
                        to="/login"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: '#2563eb',
                            color: '#ffffff',
                            padding: '0.65rem 1.25rem',
                            borderRadius: '8px',
                            fontWeight: 600,
                            textDecoration: 'none',
                            fontSize: '0.9rem'
                        }}
                    >
                        <ArrowLeft size={16} />
                        Go to Home
                    </Link>
                </div>
            </div>
        );
    }

    if (!receipt) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
                <p style={{ color: '#64748b', fontWeight: 500 }}>Loading receipt...</p>
            </div>
        );
    }

    const {
        billNo,
        tableId,
        orderType,
        items = [],
        dineInSubtotal = 0,
        parcelSubtotal = 0,
        total = 0,
        paymentMethod = 'Cash',
        timestamp
    } = receipt;

    const isParcel = String(tableId).startsWith('P-') || orderType === 'takeaway';
    const hasBothSubtotals = dineInSubtotal > 0 && parcelSubtotal > 0;

    return (
        <div className="digital-receipt-wrapper" style={{
            minHeight: '100vh',
            backgroundColor: '#f1f5f9',
            padding: '1.5rem 1rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            {/* Top Action Bar (Print / Share) */}
            <div className="receipt-top-bar no-print" style={{
                maxWidth: '440px',
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem'
            }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
                    Official Digital Receipt
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        type="button"
                        onClick={() => window.print()}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: '#ffffff',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        <Printer size={15} />
                        <span>Print</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => openWhatsAppReceipt(receipt)}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            backgroundColor: '#22c55e',
                            color: '#ffffff',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '0.82rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        <Share2 size={15} />
                        <span>Share</span>
                    </button>
                </div>
            </div>

            {/* Receipt Card (Paper Slip Aesthetic) */}
            <div id="printable-digital-receipt" className="printable-receipt-card" style={{
                maxWidth: '440px',
                width: '100%',
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
                border: '1px solid #e2e8f0',
                overflow: 'hidden'
            }}>
                {/* Header Band */}
                <div className="receipt-header-band" style={{
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    padding: '1.5rem 1.25rem',
                    textAlign: 'center'
                }}>
                    <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.5px' }}>
                        NAHARI KING
                    </h1>
                    <div className="receipt-header-subtitle" style={{ fontSize: '0.82rem', color: '#94a3b8', marginTop: '4px' }}>
                        Authentic Nalli Nihari & Mughlai Cuisine
                    </div>
                    <div className="receipt-paid-badge" style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        backgroundColor: 'rgba(34, 197, 94, 0.2)',
                        color: '#4ade80',
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        marginTop: '12px'
                    }}>
                        <CheckCircle2 size={14} />
                        <span>PAID IN FULL</span>
                    </div>
                </div>

                {/* Metadata Row */}
                <div className="receipt-meta-box" style={{
                    padding: '1rem 1.25rem',
                    borderBottom: '1px dashed #cbd5e1',
                    backgroundColor: '#fafafa',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    fontSize: '0.82rem'
                }}>
                    <div>
                        <span style={{ color: '#64748b' }}>Order For: </span>
                        <strong style={{ color: '#0f172a' }}>
                            {isParcel ? `Takeaway (${tableId})` : `Table ${tableId}`}
                        </strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ color: '#64748b' }}>Payment: </span>
                        <strong style={{ color: '#16a34a' }}>{paymentMethod}</strong>
                    </div>
                    <div>
                        <span style={{ color: '#64748b' }}>Date: </span>
                        <span style={{ color: '#334155' }}>
                            {timestamp || new Date().toLocaleDateString('en-IN')}
                        </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ color: '#64748b' }}>Bill Ref: </span>
                        <span style={{ color: '#334155', fontFamily: 'monospace', fontWeight: 700 }}>
                            #{formatBillNumber(billNo)}
                        </span>
                    </div>
                </div>

                {/* Itemized List */}
                <div style={{ padding: '1.25rem' }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr auto auto',
                        gap: '8px',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        color: '#64748b',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        paddingBottom: '8px',
                        borderBottom: '1px solid #e2e8f0'
                    }}>
                        <span>Item</span>
                        <span style={{ textAlign: 'center', minWidth: '40px' }}>Qty</span>
                        <span style={{ textAlign: 'right', minWidth: '60px' }}>Amount</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '10px' }}>
                        {items.map((it, idx) => {
                            const isItemParcel = it.isParcel || String(it.id).endsWith('_parcel');
                            const itemAmt = ((Number(it.price) || 0) * (Number(it.quantity) || 0)).toFixed(2);
                            return (
                                <div key={it.id || idx} style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr auto auto',
                                    gap: '8px',
                                    alignItems: 'center',
                                    fontSize: '0.9rem'
                                }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: 600, color: '#1e293b' }}>{it.name}</span>
                                        {isItemParcel && !isParcel && (
                                            <span style={{ fontSize: '0.72rem', color: '#ea580c', fontWeight: 600 }}>
                                                🛍️ Pack for home
                                            </span>
                                        )}
                                    </div>
                                    <span style={{ textAlign: 'center', color: '#475569', fontWeight: 600, minWidth: '40px' }}>
                                        ×{it.quantity}
                                    </span>
                                    <span style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a', minWidth: '60px' }}>
                                        ₹{itemAmt}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Subtotals & Grand Total */}
                    <div style={{
                        marginTop: '1.25rem',
                        paddingTop: '1rem',
                        borderTop: '1px dashed #cbd5e1',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        fontSize: '0.88rem'
                    }}>
                        {hasBothSubtotals && (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2563eb', fontWeight: 600 }}>
                                    <span>🍽️ Dine-In Subtotal</span>
                                    <span>₹{dineInSubtotal.toFixed(2)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ea580c', fontWeight: 600 }}>
                                    <span>🛍️ Takeaway Parcel</span>
                                    <span>₹{parcelSubtotal.toFixed(2)}</span>
                                </div>
                                <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '4px 0' }} />
                            </>
                        )}
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'baseline',
                            marginTop: '4px'
                        }}>
                            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                                Total Paid
                            </span>
                            <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#16a34a' }}>
                                ₹{Number(total).toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Footer Note */}
                <div style={{
                    backgroundColor: '#fafafa',
                    padding: '1rem',
                    textAlign: 'center',
                    borderTop: '1px solid #f1f5f9',
                    fontSize: '0.8rem',
                    color: '#64748b'
                }}>
                    <p style={{ margin: '0 0 4px 0', fontWeight: 600, color: '#334155' }}>
                        Thank you for visiting Nahari King!
                    </p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8' }}>
                        Fresh, slow-cooked Nihari served with love.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default DigitalReceiptPage;
