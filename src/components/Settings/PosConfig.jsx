import React, { useState, useEffect } from 'react';
import styles from '../SettingsPage.module.css';
import { getPaymentMethods, updatePaymentMethods } from '../../services/shiftService';
import { generateDataExport, downloadJsonFile } from '../../utils/exportUtils';
import { performFactoryReset } from '../../utils/clearUtils';
import { importDataToFirestore } from '../../utils/importUtils';

const PosConfig = () => {
    const [paymentMethods, setPaymentMethods] = useState(['Cash', 'UPI']);
    const [newPaymentMethod, setNewPaymentMethod] = useState('');
    const [isUpdatingMethods, setIsUpdatingMethods] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // Import State
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState('');

    // Factory Reset State
    const [isResetting, setIsResetting] = useState(false);
    const [resetChallenge, setResetChallenge] = useState('');
    const [resetProgress, setResetProgress] = useState('');
    const [resetError, setResetError] = useState('');

    const handleExportData = async () => {
        setIsExporting(true);
        try {
            const data = await generateDataExport();
            const dateStr = new Date().toISOString().split('T')[0];
            downloadJsonFile(data, `nalli_nihari_export_${dateStr}.json`);
        } catch (error) {
            alert('Failed to export data. Please check the console for details.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleImportData = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Reset the input so the same file can be selected again if needed
        event.target.value = null;

        if (!window.confirm(`Warning: Importing data will overwrite existing documents with the same IDs. Are you sure you want to proceed?`)) {
            return;
        }

        setIsImporting(true);
        setImportProgress('Reading file...');

        try {
            const reader = new FileReader();

            // Set up our promise manually since FileReader is callback based
            const fileContent = await new Promise((resolve, reject) => {
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(new Error("Error reading file"));
                reader.readAsText(file);
            });

            await importDataToFirestore(fileContent, (msg) => {
                setImportProgress(msg);
            });

            setTimeout(() => {
                setImportProgress('Import Finished!');
                window.location.reload(); // Refresh to show new data
            }, 1500);

        } catch (error) {
            console.error(error);
            alert(`Import Failed: ${error.message}`);
            setImportProgress('');
        } finally {
            setIsImporting(false);
        }
    };

    const handleFactoryReset = async () => {
        if (resetChallenge !== 'DELETE EVERYTHING') {
            alert('Invalid confirmation string.');
            return;
        }

        setIsResetting(true);
        setResetError('');
        try {
            await performFactoryReset(
                (msg) => setResetProgress(msg),
                () => setResetProgress('Reset Complete! Reloading...'),
                (err) => setResetError(err)
            );
        } catch (error) {
            console.error('Factory reset failed', error);
        } finally {
            setIsResetting(false);
            setResetChallenge('');
        }
    };

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

            <div className={styles['analytics-card'] || 'analytics-card'} style={{ maxWidth: '600px', backgroundColor: 'var(--card-bg)', marginTop: '2rem' }}>
                <h3>Data Management</h3>
                <p className={styles['metric-subtitle'] || 'metric-subtitle'} style={{ marginBottom: '1rem' }}>
                    Export all your POS data including inventory, menus, and sales history. This will download a JSON file to your device.
                </p>

                <button
                    className={styles['primary-btn'] || 'primary-btn'}
                    style={{ backgroundColor: '#0056b3' }}
                    onClick={handleExportData}
                    disabled={isExporting}
                >
                    {isExporting ? 'Exporting...' : 'Export All Data'}
                </button>
            </div>

            <div className={styles['analytics-card'] || 'analytics-card'} style={{ maxWidth: '600px', backgroundColor: 'var(--card-bg)', marginTop: '2rem' }}>
                <h3>Import Data</h3>
                <p className={styles['metric-subtitle'] || 'metric-subtitle'} style={{ marginBottom: '1rem' }}>
                    Restore POS data from a previous JSON export file. This handles recovering accidentally deleted menus, tables, and settings.
                </p>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    {/* Hidden file input controlled by the button */}
                    <input
                        type="file"
                        accept=".json"
                        id="import-backup-file"
                        style={{ display: 'none' }}
                        onChange={handleImportData}
                        disabled={isImporting}
                    />
                    <label
                        htmlFor="import-backup-file"
                        className={styles['primary-btn'] || 'primary-btn'}
                        style={{
                            backgroundColor: '#28a745',
                            cursor: isImporting ? 'not-allowed' : 'pointer',
                            opacity: isImporting ? 0.7 : 1,
                            margin: 0
                        }}
                    >
                        {isImporting ? 'Importing...' : 'Select Backup File'}
                    </label>

                    {importProgress && (
                        <span style={{ fontSize: '0.85rem', color: 'var(--primary-color)' }}>
                            {importProgress}
                        </span>
                    )}
                </div>
            </div>

            <div className={styles['analytics-card'] || 'analytics-card'} style={{ maxWidth: '600px', backgroundColor: '#fff3f3', border: '1px solid #dc3545', marginTop: '2rem' }}>
                <h3 style={{ color: '#dc3545' }}>⚠️ DANGER ZONE: Factory Reset</h3>
                <p className={styles['metric-subtitle'] || 'metric-subtitle'} style={{ marginBottom: '1rem', color: '#c82333' }}>
                    This action will permanently delete sales history, inventory, shift data, and metrics. Active tables and menu setups will NOT be deleted. You will be forced to download a data backup before deletion.
                </p>

                <div style={{ padding: '15px', backgroundColor: '#ffdede', borderRadius: '4px', marginBottom: '15px' }}>
                    <p style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: '#dc3545' }}>Type <strong>DELETE EVERYTHING</strong> in the box below to proceed:</p>
                    <input
                        type="text"
                        value={resetChallenge}
                        onChange={e => setResetChallenge(e.target.value)}
                        placeholder="Type DELETE EVERYTHING"
                        className={styles['form-input'] || 'form-input'}
                        style={{ border: '1px solid #dc3545', marginBottom: '10px' }}
                        disabled={isResetting}
                    />

                    {resetProgress && <div style={{ fontSize: '0.85rem', color: '#0056b3', marginTop: '5px' }}>Status: {resetProgress}</div>}
                    {resetError && <div style={{ fontSize: '0.85rem', color: '#dc3545', marginTop: '5px' }}>Error: {resetError}</div>}

                    <button
                        className={styles['delete-btn'] || 'delete-btn'}
                        style={{ width: '100%', padding: '10px' }}
                        onClick={handleFactoryReset}
                        disabled={resetChallenge !== 'DELETE EVERYTHING' || isResetting}
                    >
                        {isResetting ? 'Wiping Database...' : 'CLEAR ALL APP DATA'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PosConfig;
