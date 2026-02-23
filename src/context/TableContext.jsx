import React, { createContext, useContext, useState } from 'react';
import { useTables } from '../hooks/useTables';

const TableContext = createContext();

export const useTableContext = () => useContext(TableContext);

export const TableProvider = ({ children }) => {
    const tableData = useTables();
    const [currentTable, setCurrentTable] = useState(1);

    const [checkoutModal, setCheckoutModal] = useState({
        isOpen: false,
        type: null,
        targetId: null,
        targetTableId: null,
        total: 0,
        itemsToClear: null
    });

    const initiateCheckoutOrder = (tableId, orderId) => {
        const table = tableData.tablesRef.current[tableId];
        const orderToClear = table?.orders.find(o => o.id === orderId);
        if (orderToClear && orderToClear.total > 0) {
            setCheckoutModal({
                isOpen: true,
                type: 'order',
                targetId: orderId,
                targetTableId: tableId,
                total: orderToClear.total,
                itemsToClear: { orderToClear, table }
            });
        } else {
            tableData.clearOrder(tableId, orderId);
        }
    };

    const initiateCheckoutTable = (tableId) => {
        const table = tableData.tablesRef.current[tableId];
        if (table && table.orders.length > 0 && table.total > 0) {
            setCheckoutModal({
                isOpen: true,
                type: 'table',
                targetId: tableId,
                targetTableId: tableId,
                total: table.total,
                itemsToClear: { table }
            });
        } else {
            tableData.clearTable(tableId);
        }
    };

    const value = {
        ...tableData,
        currentTable,
        setCurrentTable,
        checkoutModal,
        setCheckoutModal,
        initiateCheckoutOrder,
        initiateCheckoutTable
    };

    return (
        <TableContext.Provider value={value}>
            {children}
        </TableContext.Provider>
    );
};
