import React, { createContext, useContext, useMemo, useState } from 'react';

// Cart item shape: { menuItem: { id, name, pricePaise, isVeg, ... }, partner: { id, name, ... }, qty }
// All monetary values stored in paise (integer). Divide by 100 for rupee display.
const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]); // { menuItem, partner, qty }
  const [isPlus, setIsPlus] = useState(false);

  const add = (menuItem, partner) => {
    setItems(prev => {
      const existing = prev.find(i => i.menuItem.id === menuItem.id);
      if (existing) {
        return prev.map(i =>
          i.menuItem.id === menuItem.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, { menuItem, partner, qty: 1 }];
    });
  };

  const updateQty = (menuItemId, qty) => {
    setItems(prev =>
      qty <= 0
        ? prev.filter(i => i.menuItem.id !== menuItemId)
        : prev.map(i => i.menuItem.id === menuItemId ? { ...i, qty } : i)
    );
  };

  const clear = () => setItems([]);

  // ── Pricing (all in paise) ──────────────────────────────────────────────────

  const subtotalPaise = useMemo(
    () => items.reduce((s, i) => s + i.menuItem.pricePaise * i.qty, 0),
    [items]
  );

  const deliveryFeePaise = items.length === 0 ? 0 : (isPlus ? 0 : 3900);
  const platformFeePaise = items.length === 0 ? 0 : 900;
  const gstPaise        = Math.round(subtotalPaise * 0.05);
  const totalPaise      = subtotalPaise + deliveryFeePaise + platformFeePaise + gstPaise;

  // Rupee helpers for display (rounded to whole rupees).
  const subtotal    = Math.round(subtotalPaise    / 100);
  const deliveryFee = Math.round(deliveryFeePaise / 100);
  const platformFee = Math.round(platformFeePaise / 100);
  const gst         = Math.round(gstPaise         / 100);
  const total       = Math.round(totalPaise       / 100);

  const value = {
    items, add, updateQty, clear,
    isPlus, setIsPlus,
    // Rupee values for display
    subtotal, deliveryFee, platformFee, gst, total,
    // Paise values for the order POST
    subtotalPaise, totalPaise,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
};
