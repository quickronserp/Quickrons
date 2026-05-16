import React, { createContext, useContext, useMemo, useState } from 'react';

// Lightweight in-memory cart + role state. No persistence — by design for the MVP.
const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]); // { dish, partner, qty }
  const [role, setRole] = useState('customer'); // customer | rider | partner
  const [isPlus, setIsPlus] = useState(false);

  const add = (dish, partner) => {
    setItems(prev => {
      const existing = prev.find(i => i.dish.id === dish.id);
      if (existing) {
        return prev.map(i => i.dish.id === dish.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { dish, partner, qty: 1 }];
    });
  };

  const updateQty = (dishId, qty) => {
    setItems(prev => qty <= 0
      ? prev.filter(i => i.dish.id !== dishId)
      : prev.map(i => i.dish.id === dishId ? { ...i, qty } : i));
  };

  const clear = () => setItems([]);

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.dish.price * i.qty, 0),
    [items]
  );

  // Quickrons commission model — for the receipt breakdown screen.
  const deliveryFee = items.length === 0 ? 0 : (isPlus ? 0 : 39);
  const platformFee = items.length === 0 ? 0 : 9;
  const gst = Math.round(subtotal * 0.05);
  const total = subtotal + deliveryFee + platformFee + gst;

  const value = {
    items, add, updateQty, clear,
    role, setRole,
    isPlus, setIsPlus,
    subtotal, deliveryFee, platformFee, gst, total,
  };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
};
