/**
 * reviewGenerator.js
 * Generates smart, order-aware 5-star reviews for Nahari King customers
 * so they don't have to type anything on Google Reviews.
 */

export const PRAISE_TAGS = [
    { id: 'tender', label: '🥩 Melt-in-mouth Meat', text: 'Meat was fall-apart tender and succulent.' },
    { id: 'gravy', label: '🌶️ Rich Nalli Gravy', text: 'The bone marrow gravy and spicy roghan were deeply flavorful.' },
    { id: 'roti', label: '🔥 Hot Khamiri Roti', text: 'Hot, fluffy Khamiri rotis complemented the Nihari perfectly.' },
    { id: 'service', label: '⚡ Fast & Polite Service', text: 'Staff was courteous and service was quick.' },
    { id: 'authentic', label: '👑 Authentic Mughlai Taste', text: 'Truly authentic old-Delhi style Mughlai flavors.' },
    { id: 'hygiene', label: '✨ Clean & Fresh', text: 'Clean ambiance, freshly prepared food, and great portions.' }
];

export const getSmartReviews = (items = [], isParcel = false) => {
    const itemNames = (items || []).map(i => (typeof i === 'string' ? i : i.name || '')).filter(Boolean);
    const hasNihari = itemNames.some(n => /nihari|nalli/i.test(n)) || itemNames.length === 0;
    const hasRoti = itemNames.some(n => /roti|khamiri|naan/i.test(n));
    const hasBiryani = itemNames.some(n => /biryani|rice/i.test(n));

    const reviews = [];

    if (isParcel) {
        reviews.push(
            "Ordered takeaway and the packaging was top-notch—completely spill-proof and steaming hot. The Nalli Nihari tasted just as rich and mouthwatering as dining in. Outstanding quality and authentic Mughlai flavor! 5/5 ⭐⭐⭐⭐⭐"
        );
    }

    if (hasNihari && hasRoti) {
        reviews.push(
            "The Nalli Nihari here is an absolute masterpiece! Meat was super tender, falling right off the bone, and the rich spicy marrow gravy paired with piping hot Khamiri roti was heavenly. Best Nihari in town! ⭐⭐⭐⭐⭐"
        );
        reviews.push(
            "Hands down the best Nihari I've had in years! Slow-cooked to perfection, deeply aromatic gravy, and fresh hot rotis. Generous portions and very reasonable prices. Must-visit for every food lover! 5/5"
        );
    } else if (hasNihari) {
        reviews.push(
            "Incredible Nalli Nihari! Tender meat, authentic aromatic spices, and rich flavorful gravy. You can genuinely taste the slow-cooking process in every bite. Highly recommend Nahari King! ⭐⭐⭐⭐⭐"
        );
        reviews.push(
            "Authentic Mughlai taste at its finest. The Nihari was flavorful, juicy, and rich without being greasy. Top quality ingredients and prompt service. 5/5 stars!"
        );
    }

    if (hasBiryani) {
        reviews.push(
            "Loved the food at Nahari King! The Biryani had amazing fragrance, long grain rice, and perfectly spiced succulent meat. Everything was freshly made and flavorful. 10/10 experience!"
        );
    }

    reviews.push(
        "Super delicious and genuine Mughlai food! The spices and tenderness of the meat are spot-on. Warm, hospitable service and wonderful hospitality. Will definitely be coming back often! ⭐⭐⭐⭐⭐"
    );

    reviews.push(
        "Authentic flavours, top-tier taste, and great consistency every single visit. If you want genuine slow-cooked Nihari with rich marrow, Nahari King is the go-to spot! 5/5 stars"
    );

    return reviews;
};

export const getRandomReview = (items = [], isParcel = false) => {
    const list = getSmartReviews(items, isParcel);
    return list[Math.floor(Math.random() * list.length)];
};
