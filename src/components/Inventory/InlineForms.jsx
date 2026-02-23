import React, { useState } from 'react';
import styles from '../InventoryBOM.module.css';

export const InlinePurchaseForm = ({ item, onSubmit, onCancel, onError }) => {
    const [qty, setQty] = useState('');
    const [cost, setCost] = useState(item.costPerUnit || '');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!qty || Number(qty) <= 0) {
            onError('Enter a valid quantity');
            return;
        }
        setSubmitting(true);
        try {
            await onSubmit(item, qty, cost);
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={styles['purchase-inline'] || 'purchase-inline'}>
            <input type="number" placeholder="Qty" value={qty} onChange={e => setQty(e.target.value)} min="0" step="0.1" disabled={submitting} />
            <input type="number" placeholder="₹/unit" value={cost} onChange={e => setCost(e.target.value)} min="0" step="0.01" disabled={submitting} />
            <button className={`${styles['btn-success'] || 'btn-success'} ${styles['btn-sm'] || 'btn-sm'}`} onClick={handleSubmit} disabled={submitting}>{submitting ? '...' : '✓'}</button>
            <button className={`${styles['btn-secondary'] || 'btn-secondary'} ${styles['btn-sm'] || 'btn-sm'}`} onClick={onCancel} disabled={submitting}>✕</button>
        </div>
    );
};

export const InlineWasteForm = ({ item, onSubmit, onCancel, onError }) => {
    const [qty, setQty] = useState('');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!qty || Number(qty) <= 0) {
            onError('Enter a valid quantity');
            return;
        }
        if (Number(qty) > item.currentStock) {
            onError('Cannot waste more quantity than is in stock');
            return;
        }
        setSubmitting(true);
        try {
            await onSubmit(item, qty, reason);
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className={styles['purchase-inline'] || 'purchase-inline'}>
            <input type="number" placeholder="Qty" value={qty} onChange={e => setQty(e.target.value)} min="0" max={item.currentStock} step="0.1" title="Waste Quantity" disabled={submitting} />
            <input type="text" placeholder="Reason" value={reason} onChange={e => setReason(e.target.value)} title="Reason for wasting" disabled={submitting} />
            <button className={`${styles['btn-success'] || 'btn-success'} ${styles['btn-sm'] || 'btn-sm'}`} onClick={handleSubmit} disabled={submitting}>{submitting ? '...' : '✓'}</button>
            <button className={`${styles['btn-secondary'] || 'btn-secondary'} ${styles['btn-sm'] || 'btn-sm'}`} onClick={onCancel} disabled={submitting}>✕</button>
        </div>
    );
};
