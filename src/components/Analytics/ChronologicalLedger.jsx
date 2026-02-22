import React, { useState, useMemo } from 'react';
import styles from '../InventoryBOM.module.css';

const ChronologicalLedger = ({ ledger }) => {
    const [ledgerPage, setLedgerPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    const totalPages = Math.max(1, Math.ceil(ledger.length / ITEMS_PER_PAGE));

    // Automatically reset page to 1 if the underlying ledger changes entirely
    useMemo(() => {
        setLedgerPage(1);
    }, [ledger]);

    const currentLedger = useMemo(() => {
        const startIndex = (ledgerPage - 1) * ITEMS_PER_PAGE;
        return ledger.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [ledger, ledgerPage]);

    return (
        <div className={styles['analytics-card'] || 'analytics-card'}>
            <h3>Chronological Ledger</h3>
            {ledger.length === 0 ? (
                <p className={styles['empty-state'] || 'empty-state'}>No movements recorded in this period.</p>
            ) : (
                <React.Fragment>
                    <div className={styles['table-responsive-wrapper'] || 'table-responsive-wrapper'}>
                        <table className={styles['data-table'] || 'data-table'}>
                            <thead>
                                <tr>
                                    <th>Date & Time</th>
                                    <th>Type</th>
                                    <th>Description</th>
                                    <th>Movement</th>
                                    <th>Value (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {currentLedger.map(event => (
                                    <tr key={`${event.type}-${event.id}`}>
                                        <td>{event.date ? event.date.toLocaleString() : 'N/A'}</td>
                                        <td>
                                            <span className={`stock-badge ${event.type === 'PURCHASE' ? 'ok' :
                                                event.type === 'PRODUCTION' ? 'low' : 'out'
                                                }`}>{event.type}</span>
                                        </td>
                                        <td>{event.label}</td>
                                        <td className={event.type === 'PURCHASE' ? 'text-success' : 'text-danger'}>
                                            {event.qty}
                                        </td>
                                        <td>₹{event.value?.toFixed(2) || '0.00'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {ledger.length > ITEMS_PER_PAGE && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', padding: '0.5rem 0', borderTop: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Showing {(ledgerPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(ledgerPage * ITEMS_PER_PAGE, ledger.length)} of {ledger.length} entries
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    className={styles['secondary-btn'] || 'secondary-btn'}
                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
                                    onClick={() => setLedgerPage(p => Math.max(1, p - 1))}
                                    disabled={ledgerPage === 1}
                                >
                                    Previous
                                </button>
                                <div style={{ display: 'flex', alignItems: 'center', padding: '0 0.5rem', fontWeight: '500' }}>
                                    {ledgerPage} / {totalPages}
                                </div>
                                <button
                                    className={styles['secondary-btn'] || 'secondary-btn'}
                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }}
                                    onClick={() => setLedgerPage(p => Math.min(totalPages, p + 1))}
                                    disabled={ledgerPage === totalPages}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </React.Fragment>
            )}
        </div>
    );
};

export default ChronologicalLedger;
