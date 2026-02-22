import React from 'react';
import styles from '../InventoryBOM.module.css';

const CategoryBreakdown = ({ categoricalData, aggregateItemSales }) => {
    return (
        <>
            {/* Categorical Breakdown */}
            <div className={styles['analytics-card'] || 'analytics-card'}>
                <h3>Category Breakdown (₹)</h3>
                {Object.keys(categoricalData).length === 0 ? (
                    <p className={styles['empty-state'] || 'empty-state'}>No data in this period.</p>
                ) : (
                    <div className={styles['table-responsive-wrapper'] || 'table-responsive-wrapper'}>
                        <table className={styles['data-table'] || 'data-table'}>
                            <thead>
                                <tr>
                                    <th>Category</th>
                                    <th style={{ color: 'var(--primary-color)' }}>Spent</th>
                                    <th style={{ color: 'var(--success-color)' }}>Utilized</th>
                                    <th style={{ color: 'var(--danger-color)' }}>Wasted</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(categoricalData).map(([cat, sums]) => (
                                    <tr key={cat}>
                                        <td><span className={styles['category-badge'] || 'category-badge'}>{cat}</span></td>
                                        <td>₹{sums.spent.toFixed(2)}</td>
                                        <td>₹{sums.utilized.toFixed(2)}</td>
                                        <td>₹{sums.wasted.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Item Sales Breakdown */}
            <div className={styles['analytics-card'] || 'analytics-card'}>
                <h3>Item Sales Breakdown</h3>
                {aggregateItemSales.length === 0 ? (
                    <p className={styles['empty-state'] || 'empty-state'}>No items sold in this period.</p>
                ) : (
                    <div className={styles['table-responsive-wrapper'] || 'table-responsive-wrapper'}>
                        <table className={styles['data-table'] || 'data-table'}>
                            <thead>
                                <tr>
                                    <th>Item Name</th>
                                    <th>Quantity Sold</th>
                                    <th style={{ color: 'var(--primary-color)' }}>Revenue (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {aggregateItemSales.map(item => (
                                    <tr key={item.name}>
                                        <td><strong>{item.name}</strong></td>
                                        <td>{item.qty}</td>
                                        <td>₹{item.revenue.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
};

export default CategoryBreakdown;
