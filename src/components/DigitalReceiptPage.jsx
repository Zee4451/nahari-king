import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { decodeReceiptData, openWhatsAppReceipt, formatBillNumber } from '../utils/receiptHelper';
import { getHistoryDoc } from '../services/firebaseService';
import { getGoogleReviewUrl } from '../services/shiftService';
import { getSmartReviews, PRAISE_TAGS } from '../utils/reviewGenerator';
import {
    Printer,
    Share2,
    CheckCircle2,
    ArrowLeft,
    Loader2,
    Star,
    ExternalLink,
    Sparkles,
    Shuffle,
    Copy,
    Check
} from 'lucide-react';
import './DigitalReceiptPage.css';

const DigitalReceiptPage = () => {
    const [searchParams] = useSearchParams();
    const [receipt, setReceipt] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [googleReviewUrl, setGoogleReviewUrl] = useState('https://www.google.com/maps/search/?api=1&query=Nahari+King');

    // Smart Review Assistant State
    const [reviewIndex, setReviewIndex] = useState(0);
    const [selectedTags, setSelectedTags] = useState([]);
    const [copiedReview, setCopiedReview] = useState(false);

    useEffect(() => {
        getGoogleReviewUrl()
            .then(url => {
                if (url) setGoogleReviewUrl(url);
            })
            .catch(err => console.warn('Could not load review url:', err));
    }, []);

    useEffect(() => {
        let isMounted = true;

        const loadReceipt = async () => {
            setLoading(true);
            setError(null);

            // 1. Check for Firestore Document ID or bill reference: ?id=... or ?ref=... or ?bill=...
            let docId = searchParams.get('id');
            let billRef = searchParams.get('ref') || searchParams.get('bill');
            let payload = searchParams.get('d');

            if (typeof window !== 'undefined') {
                const urlParams = new URLSearchParams(window.location.search);
                if (!docId) docId = urlParams.get('id');
                if (!billRef) billRef = urlParams.get('ref') || urlParams.get('bill');
                if (!payload) payload = urlParams.get('d');

                if (!docId && !billRef && !payload && window.location.hash) {
                    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
                    docId = hashParams.get('id');
                    billRef = hashParams.get('ref') || hashParams.get('bill');
                    payload = hashParams.get('d');
                }
            }

            // A. Fetch from Firestore by document ID or bill reference (Primary & ultra-reliable)
            if (docId || billRef) {
                try {
                    const docData = await getHistoryDoc(docId || billRef);
                    if (docData && isMounted) {
                        const normalizedItems = [];
                        if (Array.isArray(docData.orders)) {
                            docData.orders.forEach(order => {
                                (order?.items || []).forEach(it => {
                                    const isItemParcel = it.isParcel || String(it.id).endsWith('_parcel');
                                    normalizedItems.push({
                                        id: it.id,
                                        name: it.name,
                                        price: Number(it.price) || 0,
                                        quantity: Number(it.quantity) || 1,
                                        isParcel: isItemParcel
                                    });
                                });
                            });
                        } else if (Array.isArray(docData.items)) {
                            docData.items.forEach(it => {
                                normalizedItems.push({
                                    id: it.id,
                                    name: it.name,
                                    price: Number(it.price) || 0,
                                    quantity: Number(it.quantity) || 1,
                                    isParcel: !!it.isParcel
                                });
                            });
                        }

                        let formattedDate = '';
                        if (docData.timestamp) {
                            if (typeof docData.timestamp?.toDate === 'function') {
                                formattedDate = docData.timestamp.toDate().toLocaleString('en-IN');
                            } else {
                                formattedDate = String(docData.timestamp);
                            }
                        }

                        const normalizedReceipt = {
                            id: docData.id || docData.docId,
                            docId: docData.docId || docData.id,
                            billNo: docData.billNo || docData.id,
                            tableId: docData.tableId,
                            orderType: docData.orderType,
                            items: normalizedItems,
                            dineInSubtotal: Number(docData.dineInSubtotal) || 0,
                            parcelSubtotal: Number(docData.parcelSubtotal) || 0,
                            total: Number(docData.total) || 0,
                            paymentMethod: docData.paymentMethod || 'Paid',
                            timestamp: formattedDate || new Date().toLocaleString('en-IN')
                        };

                        setReceipt(normalizedReceipt);
                        setLoading(false);
                        return;
                    }
                } catch (fetchErr) {
                    console.error('Error fetching receipt from Firestore:', fetchErr);
                }
            }

            // B. Decode Base64 payload if provided (Fallback for offline/instant mode)
            if (payload) {
                const data = decodeReceiptData(payload);
                if (data && isMounted) {
                    setReceipt(data);
                    setLoading(false);
                    return;
                }
            }

            if (isMounted) {
                setLoading(false);
                setError('No receipt data found or the link has expired. Please ask the restaurant to share or scan again.');
            }
        };

        loadReceipt();

        return () => {
            isMounted = false;
        };
    }, [searchParams]);

    if (loading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f8fafc',
                gap: '12px'
            }}>
                <Loader2 size={36} className="animate-spin" style={{ color: '#2563eb' }} />
                <p style={{ color: '#64748b', fontWeight: 600, fontSize: '0.95rem' }}>Loading official digital receipt...</p>
            </div>
        );
    }

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

    // Smart Review Generation
    const smartReviews = useMemo(() => {
        if (!receipt) return [];
        return getSmartReviews(items, isParcel);
    }, [items, isParcel, receipt]);

    const baseReview = smartReviews.length > 0
        ? smartReviews[reviewIndex % smartReviews.length]
        : "The Nalli Nihari here is an absolute masterpiece! Meat was super tender, falling right off the bone, and the rich spicy marrow gravy paired with piping hot Khamiri roti was heavenly. Best Nihari in town! ⭐⭐⭐⭐⭐";

    const fullReviewText = useMemo(() => {
        if (selectedTags.length === 0) return baseReview;
        const tagSentences = selectedTags.map(id => {
            const found = PRAISE_TAGS.find(t => t.id === id);
            return found ? found.text : '';
        }).filter(Boolean).join(' ');
        return `${baseReview} ${tagSentences}`;
    }, [baseReview, selectedTags]);

    const handleToggleTag = (tagId) => {
        setSelectedTags(prev =>
            prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
        );
    };

    const handleShuffleReview = () => {
        if (smartReviews.length > 0) {
            setReviewIndex(prev => (prev + 1) % smartReviews.length);
        }
    };

    const handleCopyAndOpenGoogle = () => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(fullReviewText).catch(() => {});
        }
        setCopiedReview(true);
        setTimeout(() => setCopiedReview(false), 4000);
        window.open(googleReviewUrl, '_blank', 'noopener,noreferrer');
    };

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

            {/* ⭐ Google Review Card (1-Tap Smart Review Assistant) */}
            <div className="google-review-card no-print">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '6px' }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                        <button
                            key={star}
                            type="button"
                            onClick={handleCopyAndOpenGoogle}
                            title="Rate 5 stars on Google"
                            style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                color: '#f59e0b',
                                display: 'inline-flex',
                                transition: 'transform 0.15s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <Star size={24} fill="#f59e0b" stroke="#d97706" />
                        </button>
                    ))}
                </div>

                <h3 style={{
                    margin: '0 0 4px 0',
                    fontSize: '1.08rem',
                    fontWeight: 800,
                    color: '#78350f',
                    letterSpacing: '-0.2px'
                }}>
                    Loved the Nihari? We wrote your review! ✨
                </h3>

                <p style={{
                    margin: '0 0 10px 0',
                    fontSize: '0.82rem',
                    color: '#92400e',
                    lineHeight: 1.4
                }}>
                    Too lazy to type? Tap below to auto-copy this 5-star review and open Google Maps in 5 seconds!
                </p>

                {/* Pre-written Smart Review Bubble */}
                <div className="review-bubble">
                    <div className="review-bubble-header">
                        <span className="review-bubble-label">
                            <Sparkles size={13} color="#d97706" />
                            <span>1-Tap Ready Review</span>
                        </span>
                        <button
                            type="button"
                            className="review-bubble-shuffle-btn"
                            onClick={handleShuffleReview}
                            title="Generate another review variation"
                        >
                            <Shuffle size={12} />
                            <span>Try Another</span>
                        </button>
                    </div>
                    <p className="review-bubble-text">
                        "{fullReviewText}"
                    </p>
                </div>

                {/* Quick 1-Tap Praise Tags */}
                <div className="review-tag-row">
                    {PRAISE_TAGS.map((tag) => {
                        const isSelected = selectedTags.includes(tag.id);
                        return (
                            <button
                                key={tag.id}
                                type="button"
                                className={`review-tag-pill ${isSelected ? 'active' : ''}`}
                                onClick={() => handleToggleTag(tag.id)}
                                title={isSelected ? 'Remove tag' : 'Add tag to review'}
                            >
                                {isSelected ? `✓ ${tag.label}` : `+ ${tag.label}`}
                            </button>
                        );
                    })}
                </div>

                {/* Copied Banner Alert */}
                {copiedReview && (
                    <div className="review-copied-alert">
                        <Check size={16} />
                        <span>✓ Review copied! Just tap 5 stars & paste on Google.</span>
                    </div>
                )}

                {/* Primary Copy & Open Google Button */}
                <button
                    type="button"
                    onClick={handleCopyAndOpenGoogle}
                    className="google-review-btn"
                    style={{ border: 'none', cursor: 'pointer' }}
                >
                    {copiedReview ? <Check size={18} /> : <Copy size={18} />}
                    <span>{copiedReview ? 'Copied! Opening Google Reviews...' : '📋 Copy Review & Open Google Maps (5★)'}</span>
                    <ExternalLink size={16} />
                </button>
            </div>
        </div>
    );
};

export default DigitalReceiptPage;
