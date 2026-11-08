import React from 'react';
import {
  Soup,
  UtensilsCrossed,
  Flame,
  Beef,
  Coffee,
  IceCream,
  Salad,
  ChefHat,
  Pizza,
  Sandwich,
  Package,
  Sparkles,
  Utensils,
  Layers,
  Tag,
  Cake,
  Wine,
  Fish
} from 'lucide-react';

/**
 * Curated list of restaurant category icons for the picker modal
 */
export const CURATED_CATEGORY_ICONS = [
  { id: 'soup', label: 'Nihari / Gravy', Icon: Soup, color: '#ea580c', bg: '#fff7ed' },
  { id: 'bread', label: 'Roti / Naan', Icon: UtensilsCrossed, color: '#d97706', bg: '#fefce8' },
  { id: 'meat', label: 'Biryani / Rice', Icon: Beef, color: '#e11d48', bg: '#fff1f2' },
  { id: 'flame', label: 'Kabab / Tandoor', Icon: Flame, color: '#dc2626', bg: '#fef2f2' },
  { id: 'beverage', label: 'Tea / Drinks', Icon: Coffee, color: '#0d9488', bg: '#f0fdfa' },
  { id: 'dessert', label: 'Desserts', Icon: IceCream, color: '#db2777', bg: '#fdf2f8' },
  { id: 'salad', label: 'Salads & Sides', Icon: Salad, color: '#059669', bg: '#ecfdf5' },
  { id: 'chef', label: 'Chef Specials', Icon: ChefHat, color: '#4f46e5', bg: '#eef2ff' },
  { id: 'snack', label: 'Rolls & Fast Food', Icon: Sandwich, color: '#ca8a04', bg: '#fefce8' },
  { id: 'combo', label: 'Thali & Combos', Icon: Package, color: '#0284c7', bg: '#f0f9ff' },
  { id: 'star', label: 'House Signature', Icon: Sparkles, color: '#f59e0b', bg: '#fffbeb' },
  { id: 'general', label: 'General / Other', Icon: Utensils, color: '#64748b', bg: '#f8fafc' },
];

/**
 * Resolves a category string or emoji or icon id to the appropriate Lucide Icon and theme colors
 */
export function getCategoryIconMeta(nameOrIcon) {
  if (!nameOrIcon) {
    return { Icon: Utensils, color: '#64748b', bg: '#f8fafc' };
  }

  const str = String(nameOrIcon).toLowerCase().trim();

  // 1. Direct match by ID
  const directMatch = CURATED_CATEGORY_ICONS.find(c => c.id === str);
  if (directMatch) return directMatch;

  // 2. Emoji or text match for Nihari / Soup / Gravy
  if (str.includes('🍲') || str.includes('nihari') || str.includes('nalli') || str.includes('soup') || str.includes('curry') || str.includes('gravy') || str.includes('dal') || str.includes('daal') || str.includes('🥘')) {
    return { Icon: Soup, color: '#ea580c', bg: '#fff7ed' };
  }

  // 3. Roti / Naan / Bread
  if (str.includes('🫓') || str.includes('roti') || str.includes('naan') || str.includes('kulcha') || str.includes('paratha') || str.includes('bread') || str.includes('chapati')) {
    return { Icon: UtensilsCrossed, color: '#d97706', bg: '#fefce8' };
  }

  // 4. Biryani / Rice / Pulao / Chicken / Mutton / Meat
  if (str.includes('🍚') || str.includes('biryani') || str.includes('rice') || str.includes('pulao') || str.includes('meat') || str.includes('chicken') || str.includes('mutton') || str.includes('beef') || str.includes('🍗') || str.includes('🍖')) {
    return { Icon: Beef, color: '#e11d48', bg: '#fff1f2' };
  }

  // 5. Starters / Kabab / Tikka / Tandoor
  if (str.includes('🍢') || str.includes('kabab') || str.includes('kebab') || str.includes('tikka') || str.includes('tandoor') || str.includes('starter') || str.includes('fry') || str.includes('grill') || str.includes('fire')) {
    return { Icon: Flame, color: '#dc2626', bg: '#fef2f2' };
  }

  // 6. Beverages / Tea / Chai / Drinks
  if (str.includes('🥤') || str.includes('☕') || str.includes('tea') || str.includes('chai') || str.includes('coffee') || str.includes('drink') || str.includes('coke') || str.includes('beverage') || str.includes('shake') || str.includes('lassi') || str.includes('water')) {
    return { Icon: Coffee, color: '#0d9488', bg: '#f0fdfa' };
  }

  // 7. Desserts / Sweets
  if (str.includes('🍨') || str.includes('kheer') || str.includes('halwa') || str.includes('dessert') || str.includes('sweet') || str.includes('ice cream') || str.includes('gulab') || str.includes('cake')) {
    return { Icon: IceCream, color: '#db2777', bg: '#fdf2f8' };
  }

  // 8. Salads / Healthy / Raita
  if (str.includes('🥗') || str.includes('salad') || str.includes('raita') || str.includes('green') || str.includes('chutney')) {
    return { Icon: Salad, color: '#059669', bg: '#ecfdf5' };
  }

  // 9. All / Overall
  if (str === 'all' || str === '🍽️ all' || str.includes('all items')) {
    return { Icon: Layers, color: '#3b82f6', bg: '#eff6ff' };
  }

  // Default fallback
  return { Icon: Utensils, color: '#64748b', bg: '#f8fafc' };
}

/**
 * CategoryIcon Component: Renders clean Lucide SVG icon with consistent styling
 */
export default function CategoryIcon({
  name,
  size = 18,
  className = '',
  style = {},
  showBadge = false,
  badgeSize = 34
}) {
  const meta = getCategoryIconMeta(name);
  const IconComponent = meta.Icon;

  if (showBadge) {
    return (
      <span
        className={`category-icon-badge ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: `${badgeSize}px`,
          height: `${badgeSize}px`,
          borderRadius: '10px',
          backgroundColor: meta.bg,
          color: meta.color,
          flexShrink: 0,
          ...style
        }}
      >
        <IconComponent size={size} strokeWidth={2.2} />
      </span>
    );
  }

  return (
    <span
      className={`category-icon-inline ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: meta.color,
        verticalAlign: 'middle',
        ...style
      }}
    >
      <IconComponent size={size} strokeWidth={2.2} />
    </span>
  );
}
