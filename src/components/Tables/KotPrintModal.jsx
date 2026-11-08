import React, { useRef } from 'react';
import { Printer, X, Check, UtensilsCrossed } from 'lucide-react';
import './KotPrintModal.css';

const KotPrintModal = ({
  isOpen,
  onClose,
  tableId,
  orders = [],
  activeRoundIndex = null, // null means all rounds
  consolidatedItems = []
}) => {
  const printableRef = useRef(null);

  if (!isOpen) return null;

  // Determine items to print based on selection
  const isPrintingAll = activeRoundIndex === null || activeRoundIndex === 'all';
  const targetItems = isPrintingAll
    ? consolidatedItems
    : (orders[activeRoundIndex]?.items || []).filter(it => (it.quantity || 0) > 0);

  const totalCount = targetItems.reduce((s, it) => s + (it.quantity || 0), 0);
  const roundTitle = isPrintingAll
    ? (orders.length > 1 ? `All Rounds (${orders.length})` : 'Order Round 1')
    : `Round ${Number(activeRoundIndex) + 1}`;

  const isParcelTable = String(tableId).startsWith('P-');
  const kotDineInItems = isParcelTable ? [] : targetItems.filter(it => !it.isParcel);
  const kotParcelItems = isParcelTable ? targetItems : targetItems.filter(it => it.isParcel);
  const hasBothTypes = kotDineInItems.length > 0 && kotParcelItems.length > 0;
  const tableDisplay = isParcelTable ? `PARCEL #${String(tableId).replace('P-', '')}` : `TABLE ${tableId}`;
  const orderTypeDisplay = isParcelTable
    ? '*** TAKEAWAY / PARCEL COUNTER ***'
    : `Dine-In (${roundTitle})`;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const timeStr = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const kotNumber = `KOT-${isParcelTable ? 'P' : 'T'}${String(tableId).replace('P-', '')}-${now.getMinutes()}${now.getSeconds()}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="kot-modal-backdrop" onClick={onClose}>
      <div className="kot-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Top Bar (Screen Only) */}
        <div className="kot-modal-header no-print">
          <div className="kot-modal-title">
            <Printer size={20} className="kot-icon" />
            <div>
              <h3>Kitchen Order Ticket (KOT)</h3>
              <p>{tableDisplay} • {roundTitle}</p>
            </div>
          </div>
          <button type="button" className="kot-close-btn" onClick={onClose} title="Close">
            <X size={18} />
          </button>
        </div>

        {/* Printable Thermal Receipt Slip */}
        <div className="kot-preview-scroll">
          <div className="kot-thermal-ticket" ref={printableRef} id="printable-kot-ticket">
            {/* Header */}
            <div className="kot-ticket-header">
              <h2 className="kot-brand">NALLI NIHARI</h2>
              <div className="kot-ticket-type">*** KITCHEN ORDER TICKET (KOT) ***</div>
            </div>

            <div className="kot-divider-double" />

            {/* Meta Details */}
            <div className="kot-meta-grid">
              <div className="kot-meta-row">
                <span className="kot-label">TABLE / COUNTER:</span>
                <span className="kot-val kot-table-val">{tableDisplay}</span>
              </div>
              <div className="kot-meta-row">
                <span className="kot-label">KOT NO:</span>
                <span className="kot-val">{kotNumber}</span>
              </div>
              <div className="kot-meta-row">
                <span className="kot-label">ORDER TYPE:</span>
                <span className="kot-val" style={{ fontWeight: 800 }}>{orderTypeDisplay}</span>
              </div>
              <div className="kot-meta-row">
                <span className="kot-label">DATE & TIME:</span>
                <span className="kot-val">{dateStr} {timeStr}</span>
              </div>
            </div>

            <div className="kot-divider-dashed" />

            {/* Column Headers */}
            <div className="kot-items-table-header">
              <span className="kot-col-qty">QTY</span>
              <span className="kot-col-item">ITEM DESCRIPTION</span>
            </div>

            <div className="kot-divider-solid" />

            {/* Itemized Rows */}
            <div className="kot-items-list">
              {targetItems.length === 0 ? (
                <div className="kot-no-items">
                  <em>No items in this round</em>
                </div>
              ) : hasBothTypes ? (
                <>
                  {/* Dine-In Section */}
                  <div style={{ fontWeight: 900, fontSize: '0.85rem', margin: '4px 0 2px 0', textDecoration: 'underline' }}>
                    🍽️ DINE-IN (SERVE AT TABLE):
                  </div>
                  {kotDineInItems.map((item, idx) => (
                    <div key={item.id || idx} className="kot-item-row">
                      <span className="kot-col-qty">{item.quantity}x</span>
                      <span className="kot-col-item">{item.name}</span>
                    </div>
                  ))}

                  <div className="kot-divider-dashed" style={{ margin: '8px 0' }} />

                  {/* Parcel Section */}
                  <div style={{ fontWeight: 900, fontSize: '0.85rem', margin: '4px 0 2px 0', textDecoration: 'underline' }}>
                    🛍️ TAKEAWAY / PARCEL (PACK IN BOX & BAG):
                  </div>
                  {kotParcelItems.map((item, idx) => (
                    <div key={item.id || idx} className="kot-item-row">
                      <span className="kot-col-qty">{item.quantity}x</span>
                      <span className="kot-col-item">
                        {item.name}
                        <span style={{ display: 'block', fontSize: '0.78rem', fontWeight: 900, color: '#000' }}>
                          [*** PACK / PARCEL ***]
                        </span>
                      </span>
                    </div>
                  ))}
                </>
              ) : (
                targetItems.map((item, idx) => (
                  <div key={item.id || idx} className="kot-item-row">
                    <span className="kot-col-qty">{item.quantity}x</span>
                    <span className="kot-col-item">
                      {item.name}
                      {(item.isParcel || isParcelTable) && (
                        <span style={{ display: 'block', fontSize: '0.78rem', fontWeight: 900, color: '#000' }}>
                          [*** PACK / PARCEL ***]
                        </span>
                      )}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="kot-divider-double" />

            {/* Summary */}
            <div className="kot-footer-summary">
              <div className="kot-total-items-line">
                <span>TOTAL ITEMS:</span>
                <span className="kot-total-count">{totalCount} items</span>
              </div>
            </div>

            <div className="kot-divider-dashed" />

            {/* Instructions Footer */}
            <div className="kot-bottom-instructions">
              <div>{isParcelTable ? 'TAKEAWAY COPY • PACK IN CONTAINER & BAG' : 'KITCHEN COPY • PREPARE IMMEDIATELY'}</div>
              <div>--- End of Ticket ---</div>
            </div>
          </div>
        </div>

        {/* Modal Actions (Screen Only) */}
        <div className="kot-modal-footer no-print">
          <button type="button" className="kot-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="kot-btn-primary"
            onClick={handlePrint}
            disabled={targetItems.length === 0}
          >
            <Printer size={18} />
            <span>Print KOT Ticket</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default KotPrintModal;
