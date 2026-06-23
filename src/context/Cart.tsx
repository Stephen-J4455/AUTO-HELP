import React, { createContext, useContext, useState } from 'react';

type CartItem = {
  product_id: string;
  sku?: string;
  title: string;
  price: number;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>, qty?: number) => void;
  removeItem: (product_id: string, sku?: string) => void;
  clear: () => void;
  total: number;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  function addItem(item: Omit<CartItem, 'quantity'>, qty = 1) {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.product_id === item.product_id && i.sku === item.sku);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
        return next;
      }
      return [...prev, { ...item, quantity: qty }];
    });
  }

  function removeItem(product_id: string, sku?: string) {
    setItems((prev) => prev.filter((i) => !(i.product_id === product_id && i.sku === sku)));
  }

  function clear() {
    setItems([]);
  }

  const total = items.reduce((s, it) => s + it.price * it.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clear, total }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

export type { CartItem };
