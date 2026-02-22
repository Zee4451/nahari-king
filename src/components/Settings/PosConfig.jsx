import React, { useState, useEffect } from 'react';
import styles from '../SettingsPage.module.css';
import { getPaymentMethods, updatePaymentMethods } from '../../services/shiftService';

const PosConfig = () => {
    const [paymentMethods, setPaymentMethods] = useState(['Cash', 'UPI']);
    const [newPaymentMethod, setNewPaymentMethod] = useState('');
    const [isUpdatingMethods, setIsUpdatingMethods] = useState(false);

    useEffect(() => {
        const loadMethods = async () => {
            try {
                const loadedMethods = await getPaymentMethods();
                setPaymentMethods(loadedMethods || ['Cash', 'UPI']);
            } catch (error) {
                console.error('Error loading payment methods:', error);
            }
        };
        loadMethods();
    }, []);

    const handleAddPaymentMethod = async () => {
        if (!newPaymentMethod.trim()) return;
        const methodStr = newPaymentMethod.trim();
        if (paymentMethods.includes(methodStr)) return;

        setIsUpdatingMethods(true);
        const updatedMethods = [...paymentMethods, methodStr];
        setPaymentMethods(updatedMethods);
        setNewPaymentMethod('');
        try {
            await updatePaymentMethods(updatedMethods);
        } catch (e) {
            setPaymentMethods(paymentMethods); // revert on error
        }
        setIsUpdatingMethods(false);
    };

    const handleRemovePaymentMethod = async (method) => {
        if (method === 'Cash' || method === 'UPI') {
            alert("Cannot remove default payment methods.");
            return;
        }
        setIsUpdatingMethods(true);
        const updatedMethods = paymentMethods.filter(m => m !== method);
        setPaymentMethods(updatedMethods);
        try {
            await updatePaymentMethods(updatedMethods);
        } catch (e) {
            setPaymentMethods(paymentMethods); // revert on error
        }
        setIsUpdatingMethods(false);
    };

    return (
        <div className={styles['settings-section'] || 'settings-section'}>
            <h2>POS Configuration</h2>

            <div className={styles['analytics-card'] || 'analytics-card'} style={{ maxWidth: '600px', backgroundColor: 'var(--card-bg)' }}>
                <h3>Payment Methods</h3>
                <p className={styles['metric-subtitle'] || 'metric-subtitle'} style={{ marginBottom: '1rem' }}>Add or remove custom digital payment methods (e.g. GooglePay, PhonePe). 'Cash' and 'UPI' are mandatory defaults.</p>

                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                    <input
                        type="text"
                        value={newPaymentMethod}
                        onChange={(e) => setNewPaymentMethod(e.target.value)}
                        placeholder="Add new method..."
                        className={styles['form-input'] || 'form-input'}
                        style={{ flex: 1, margin: 0 }}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddPaymentMethod()}
                    />
                    <button
                        className={styles['primary-btn'] || 'primary-btn'}
                        onClick={handleAddPaymentMethod}
                        disabled={isUpdatingMethods || !newPaymentMethod.trim()}
                    >
                        Add
                    </button>
                </div>

                <div className={styles['payment-methods-list'] || 'payment-methods-list'} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {paymentMethods.map(method => (
                        <div key={method} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--page-bg)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                            <span style={{ fontWeight: '500' }}>{method}</span>
                            {(method !== 'Cash' && method !== 'UPI') && (
                                <button
                                    className={styles['delete-btn'] || 'delete-btn'}
                                    onClick={() => handleRemovePaymentMethod(method)}
                                    disabled={isUpdatingMethods}
                                >
                                    Remove
                                </button>
                            )}
                            {(method === 'Cash' || method === 'UPI') && (
                                <span style={{ fontSize: '0.8rem', color: 'var(--primary-color)' }}>Default (Required)</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default PosConfig;
