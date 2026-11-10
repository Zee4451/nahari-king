import QRCode from 'qrcode';
import { getRandomReview } from './reviewGenerator';

/**
 * Formats a raw timestamp or Firestore document ID into a clean 6-digit Bill Reference
 */
export const formatBillNumber = (rawId) => {
    if (!rawId) return String(Math.floor(100000 + Math.random() * 900000));
    const str = String(rawId).replace(/[^a-zA-Z0-9]/g, '');
    if (str.length <= 6) return str.toUpperCase();
    return str.slice(-6).toUpperCase();
};

/**
 * Encodes order details into a URL-safe, WhatsApp-safe Base64 string.
 * Minifies keys and avoids underscores '_' which WhatsApp turns into italics!
 */
export const encodeReceiptData = (receipt) => {
    try {
        if (!receipt) return '';
        // Minify keys to produce ultra-compact payload
        const minified = {
            b: receipt.billNo,
            t: receipt.tableId,
            o: receipt.orderType,
            i: (receipt.items || []).map(it => [
                it.name,
                Number(it.price) || 0,
                Number(it.quantity) || 1,
                it.isParcel ? 1 : 0
            ]),
            ds: Number(receipt.dineInSubtotal) || 0,
            ps: Number(receipt.parcelSubtotal) || 0,
            tot: Number(receipt.total) || 0,
            pm: receipt.paymentMethod || 'Cash',
            ts: receipt.timestamp || ''
        };

        const json = JSON.stringify(minified);
        const utf8Bytes = new TextEncoder().encode(json);
        let binary = '';
        for (let i = 0; i < utf8Bytes.length; i++) {
            binary += String.fromCharCode(utf8Bytes[i]);
        }
        // Use '.' instead of '_' so WhatsApp markdown won't parse it as italics!
        return btoa(binary)
            .replace(/\+/g, '-')
            .replace(/\//g, '.')
            .replace(/=+$/, '');
    } catch (e) {
        console.error('Error encoding receipt data:', e);
        return '';
    }
};

/**
 * Decodes URL-safe Base64 string back into receipt object.
 * Robust against trailing dashes or spaces attached by chat apps.
 */
export const decodeReceiptData = (encodedStr) => {
    try {
        if (!encodedStr) return null;
        let clean = String(encodedStr).trim().replace(/[-]+$/, '');
        let base64 = clean
            .replace(/-/g, '+')
            .replace(/[\._]/g, '/')
            .replace(/ /g, '+');

        // Restore padding
        while (base64.length % 4 !== 0) {
            base64 += '=';
        }

        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        const json = new TextDecoder().decode(bytes);
        const parsed = JSON.parse(json);

        // Normalize minified schema
        if (parsed.b !== undefined && parsed.i !== undefined) {
            return {
                billNo: parsed.b,
                tableId: parsed.t,
                orderType: parsed.o,
                items: (parsed.i || []).map(arr => ({
                    name: arr[0],
                    price: arr[1],
                    quantity: arr[2],
                    isParcel: !!arr[3]
                })),
                dineInSubtotal: parsed.ds || 0,
                parcelSubtotal: parsed.ps || 0,
                total: parsed.tot || 0,
                paymentMethod: parsed.pm || 'Cash',
                timestamp: parsed.ts || ''
            };
        }

        return parsed;
    } catch (e) {
        console.error('Error decoding receipt data:', e);
        return null;
    }
};

/**
 * Generates the full digital receipt link.
 * PREFERS clean short URL with ?id= when document ID exists (ultra-safe for WhatsApp).
 * ALWAYS uses the live production URL if running on localhost,
 * so that mobile phones scanning the QR code from the laptop screen can actually reach the page!
 */
export const getDigitalReceiptUrl = (receiptData) => {
    let origin = 'https://nahari-king.vercel.app';
    if (typeof window !== 'undefined' && window.location.origin) {
        const host = window.location.hostname;
        // If not localhost or 127.0.0.1, use current origin
        if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
            origin = window.location.origin;
        }
    }

    if (!receiptData) return `${origin}/receipt`;

    const payload = encodeReceiptData(receiptData);
    const docId = receiptData.docId || receiptData.id;

    // Include both docId and compact payload so it works instantly for unauthenticated customers
    // while also referencing the exact Firestore database record!
    if (docId) {
        return `${origin}/receipt?id=${encodeURIComponent(docId)}&d=${payload}`;
    }

    // Compact payload fallback
    return `${origin}/receipt?d=${payload}`;
};

/**
 * Generates a high-quality DataURL QR code for a given receipt
 */
export const generateReceiptQRCode = async (receiptData) => {
    const url = getDigitalReceiptUrl(receiptData);
    try {
        return await QRCode.toDataURL(url, {
            width: 280,
            margin: 2,
            errorCorrectionLevel: 'M',
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        });
    } catch (err) {
        console.error('Failed to generate receipt QR code:', err);
        return null;
    }
};

/**
 * Retrieves the stored Google Review URL from localStorage, or returns default fallback
 */
export const getStoredGoogleReviewUrl = () => {
    if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('nahari_king_google_review_url');
        if (stored) return stored;
    }
    return 'https://www.google.com/maps/search/?api=1&query=Nahari+King';
};

/**
 * Formats a clean WhatsApp text receipt with e-bill link & Google Review link
 */
export const formatWhatsAppReceiptText = (receiptData, digitalReceiptUrl, reviewUrl) => {
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
    if (billNo) lines.push(`🧾 *Bill Ref:* #${formatBillNumber(billNo)}`);
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
    lines.push(`💰 *GRAND TOTAL: ₹${Number(total).toFixed(2)}*`);
    lines.push(`------------------------------------`);

    if (digitalReceiptUrl) {
        lines.push(`📄 *View Official Digital Receipt:*`);
        lines.push(digitalReceiptUrl);
        lines.push(``);
    }

    const reviewLink = reviewUrl || getStoredGoogleReviewUrl();
    if (reviewLink) {
        lines.push(`⭐ *Loved our Nihari? Rate us on Google:*`);
        lines.push(reviewLink);
        lines.push(``);
        const quickReview = getRandomReview(items, isParcel);
        lines.push(`💡 _No time to type? Just copy & paste this review:_`);
        lines.push(`"${quickReview}"`);
        lines.push(``);
    }

    if (digitalReceiptUrl || reviewLink) {
        lines.push(`_(Tip: If links are not clickable, please reply "Hi" or save this contact to activate)_`);
        lines.push(`------------------------------------`);
    }

    lines.push(`Thank you for dining at Nahari King! 🙏`);
    lines.push(`Please visit us again! ✨`);

    return lines.join('\n');
};

/**
 * Formats a dedicated, polite WhatsApp Review Request message with ready-to-paste review
 */
export const formatWhatsAppReviewRequestText = (reviewUrl, items = [], isParcel = false) => {
    const link = reviewUrl || getStoredGoogleReviewUrl();
    const readyReview = getRandomReview(items, isParcel);
    let lines = [];
    lines.push(`🍽️ *NAHARI KING* 🍽️`);
    lines.push(`*Authentic Nalli Nihari & Mughlai Cuisine*`);
    lines.push(`------------------------------------`);
    lines.push(`Dear Guest, thank you for dining with us! 🙏`);
    lines.push(`We hope you loved your food and had a memorable experience.`);
    lines.push(``);
    lines.push(`⭐ *Loved the Nihari? Please rate us 5 stars on Google:*`);
    lines.push(link);
    lines.push(``);
    lines.push(`💡 _Too lazy to type? Copy & paste this 5-star review:_`);
    lines.push(`"${readyReview}"`);
    lines.push(``);
    lines.push(`Your review takes just 5 seconds and means the world to our team! ❤️`);
    lines.push(`------------------------------------`);
    lines.push(`_Nahari King Team_ ✨`);
    return lines.join('\n');
};

/**
 * Opens WhatsApp Click-to-Chat with pre-filled receipt
 */
export const openWhatsAppReceipt = (receiptData, customerPhone = '', reviewUrl) => {
    const receiptUrl = getDigitalReceiptUrl(receiptData);
    const message = formatWhatsAppReceiptText(receiptData, receiptUrl, reviewUrl);
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

/**
 * Opens WhatsApp Click-to-Chat with pre-filled dedicated Review Request
 */
export const openWhatsAppReviewRequest = (customerPhone = '', reviewUrl, items = [], isParcel = false) => {
    const message = formatWhatsAppReviewRequestText(reviewUrl, items, isParcel);
    const cleanPhone = String(customerPhone || '').replace(/\D/g, '');

    let targetPhone = cleanPhone;
    if (cleanPhone.length === 10) {
        targetPhone = `91${cleanPhone}`;
    }

    let waUrl;
    if (targetPhone.length >= 10) {
        waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
    } else {
        waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    }

    window.open(waUrl, '_blank', 'noopener,noreferrer');
};
