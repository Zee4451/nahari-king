import React from 'react';
import styles from '../InventoryBOM.module.css';

const MetricsCards = ({ currentInventoryValue, totalSpent, totalUtilized, totalWasted }) => {
    return (
        <div className={styles['metrics-grid'] || 'metrics-grid'}>
            <div className={styles['metric-card'] || 'metric-card'}>
                <div className={styles['metric-title'] || 'metric-title'}>Current Inventory Value</div>
                <div className={styles['metric-value'] || 'metric-value'}>₹{currentInventoryValue.toFixed(2)}</div>
                <div className={styles['metric-subtitle'] || 'metric-subtitle'}>Total locked in stock today</div>
            </div>
            <div className={`${styles['metric-card'] || 'metric-card'} ${styles['highlight-blue'] || 'highlight-blue'}`}>
                <div className={styles['metric-title'] || 'metric-title'}>Stock Received (Inflow)</div>
                <div className={styles['metric-value'] || 'metric-value'}>₹{totalSpent.toFixed(2)}</div>
                <div className={styles['metric-subtitle'] || 'metric-subtitle'}>Total purchases in period</div>
            </div>
            <div className={`${styles['metric-card'] || 'metric-card'} ${styles['highlight-success'] || 'highlight-success'}`}>
                <div className={styles['metric-title'] || 'metric-title'}>Cost of Goods Produced</div>
                <div className={styles['metric-value'] || 'metric-value'}>₹{totalUtilized.toFixed(2)}</div>
                <div className={styles['metric-subtitle'] || 'metric-subtitle'}>Ingredients consumed by recipes</div>
            </div>
            <div className={`${styles['metric-card'] || 'metric-card'} ${styles['highlight-danger'] || 'highlight-danger'}`}>
                <div className={styles['metric-title'] || 'metric-title'}>Lost to Wastage</div>
                <div className={styles['metric-value'] || 'metric-value'}>₹{totalWasted.toFixed(2)}</div>
                <div className={styles['metric-subtitle'] || 'metric-subtitle'}>Spoiled/expired tracking</div>
            </div>
        </div>
    );
};

export default MetricsCards;
