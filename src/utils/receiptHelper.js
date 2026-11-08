import QRCode from 'qrcode';

/**
 * Encodes order details into a URL-safe Base64 string
 */
export const encodeReceiptData = (receipt) => {
    try {
        const json = JSON.stringify(receipt);
        // Encode UTF-8 cleanly
        const utf8Bytes = new TextEncoder().encode(json);
        let binary = '';
        for (let i = 0; i < utf8Bytes.length; i++) {
            binary += String.fromCharCode(utf8Bytes[i]);
        }
        return encodeURIComponent(btoa(binary));
    } catch (e) {
        console.error('Error encoding receipt data:', e);
        return '';
    }
};

/**
 * Decodes URL-safe Base64 string back into receipt object
 */
export const decodeReceiptData = (encodedStr) => {
    try {
        const decoded = decodeURIComponent(encodedStr);
        const binary = atob(decoded);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        const json = new TextDecoder().decode(bytes);
        return JSON.parse(json);
    } catch (e) {
        console.error('Error decoding receipt data:', e);
        return null;
    }
};

/**
 * Generates the full digital receipt link
 */
export const getDigitalReceiptUrl = (receiptData) => {
    const origin = typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : 'https://nahari-king.vercel.app';
    const payload = encodeReceiptData(receiptData);
    return `${origin}/receipt?d=${payload}`;
};

/**
 * Generates a DataURL QR code for a given receipt
 */
export const generateReceiptQRCode = async (receiptData) => {
    const url = getDigitalReceiptUrl(receiptData);
    try {
        return await QRCode.toDataURL(url, {
            width: 260,
            margin: 1,
            color: {
                dark: '#0f172a',
                light: '#ffffff'
            }
        });
    } catch (err) {
        console.error('Failed to generate receipt QR code:', err);
        return null;
    }
};

/**
 * Formats a clean WhatsApp text receipt
 */
export const formatWhatsAppReceiptText = (receiptData, digitalReceiptUrl) => {
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
    } = receiptData;

    const isParcel = String(tableId).startsWith('P-') || orderType === 'takeaway';
    const locationName = isParcel ? `Takeaway Parcel ${tableId}` : `Table ${tableId}`;

    let lines = [];
    lines.push(`🍽️ *NAHARI KING* 🍽️`);
    lines.push(`*Authentic Nalli Nihari & Mughlai*`);
    lines.push(`------------------------------------`);
    if (billNo) lines.push(`🧾 *Bill No:* #${billNo}`);
    lines.push(`📍 *Order:* ${locationName}`);
    lines.push(`📅 *Date:* ${timestamp || new Date().toLocaleString()}`);
    lines.push(`💳 *Payment:* Paid via ${paymentMethod}`);
    lines.push(`------------------------------------`);
    lines.push(`*ITEMS ORDERED:*`);

    items.forEach(it => {
        const isItemParcel = it.isParcel || String(it.id).endsWith('_parcel');
        const itemTotal = ((Number(it.price) || 0) * (Number(it.quantity) || 0)).toFixed(2);
        const tag = isItemParcel && !isParcel ? ' (Parcel)' : '';
        lines.push(`• ${it.quantity}x ${it.name}${tag} - ₹${itemTotal}`);
    });

    lines.push(`------------------------------------`);
    if (dineInSubtotal > 0 && parcelSubtotal > 0) {
        lines.push(`🍽️ Dine-In Subtotal: ₹${dineInSubtotal.toFixed(2)}`);
        lines.push(`🛍️ Takeaway Parcel: ₹${parcelSubtotal.toFixed(2)}`);
    }
    lines.push(`💰 *GRAND TOTAL: ₹${total.toFixed(2)}*`);
    lines.push(`------------------------------------`);

    if (digitalReceiptUrl) {
        lines.push(`📄 *View Official Digital Receipt:*`);
        lines.push(`${digitalReceiptUrl}`);
        lines.push(`------------------------------------`);
    }

    lines.push(`Thank you for dining at Nahari King! 🙏`);
    lines.push(`Please visit us again! ✨`);

    return lines.join('\n');
};

/**
 * Opens WhatsApp Click-to-Chat with pre-filled receipt
 */
export const openWhatsAppReceipt = (receiptData, customerPhone = '') => {
    const receiptUrl = getDigitalReceiptUrl(receiptData);
    const message = formatWhatsAppReceiptText(receiptData, receiptUrl);
    const cleanPhone = String(customerPhone || '').replace(/\D/g, '');

    // Format for India (+91) if 10-digit number is provided
    let targetPhone = cleanPhone;
    if (cleanPhone.length === 10) {
        targetPhone = `91${cleanPhone}`;
    }

    let waUrl;
    if (targetPhone.length >= 10) {
        waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
    } else {
        // Lets cashier choose contact in WhatsApp
        waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    }

    window.open(waUrl, '_blank', 'noopener,noreferrer');
};
