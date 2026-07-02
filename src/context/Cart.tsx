import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase/supabase';
import { useAuth } from './Auth';
import { getProductImageUri } from '../utils/productImages';

type CartItem = {
  id?: string;
  product_id: string;
  sku: string;
  title: string;
  price: number;
  quantity: number;
  image_url?: string;
};

type CartContextValue = {
  items: CartItem[];
  loading: boolean;
  addItem: (item: Omit<CartItem, 'quantity'>, qty?: number) => Promise<void>;
  updateQuantity: (product_id: string, sku: string, qty: number) => Promise<void>;
  removeItem: (product_id: string, sku: string) => Promise<void>;
  clear: () => Promise<void>;
  total: number;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadCart(userId: string) {
    const { data, error } = await supabase
      .from('cart_items')
      .select('id, product_id, sku, quantity, products(title, price, images)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const mapped = ((data as Array<Record<string, unknown>>) || []).map((row) => {
      const product = row.products as
        | { title?: unknown; price?: unknown; images?: unknown }
        | Array<{ title?: unknown; price?: unknown; images?: unknown }>
        | null;
      const resolvedProduct = Array.isArray(product) ? product[0] : product;
      const title = typeof resolvedProduct?.title === 'string' ? resolvedProduct.title : 'Product';
      const priceNumber =
        typeof resolvedProduct?.price === 'number'
          ? resolvedProduct.price
          : parseFloat(String(resolvedProduct?.price ?? 0)) || 0;

      return {
        id: typeof row.id === 'string' ? row.id : undefined,
        product_id: String(row.product_id ?? ''),
        sku: String(row.sku ?? ''),
        quantity: Number(row.quantity ?? 1) || 1,
        title,
        price: priceNumber,
        image_url: getProductImageUri(resolvedProduct?.images) || undefined,
      };
    });

    setItems(mapped.filter((item) => item.product_id));
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      if (!user?.id) {
        if (mounted) {
          setItems([]);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      try {
        await loadCart(user.id);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void bootstrap();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  async function addItem(item: Omit<CartItem, 'quantity'>, qty = 1) {
    if (!user?.id) throw new Error('You must be logged in to add items to cart.');
    const safeSku = item.sku || '';
    const existing = items.find((i) => i.product_id === item.product_id && i.sku === safeSku);
    const nextQty = (existing?.quantity || 0) + Math.max(1, qty);

    const { error } = await supabase.from('cart_items').upsert(
      {
        user_id: user.id,
        product_id: item.product_id,
        sku: safeSku,
        quantity: nextQty,
      },
      { onConflict: 'user_id,product_id,sku' }
    );

    if (error) throw new Error(error.message);
    await loadCart(user.id);
  }

  async function updateQuantity(product_id: string, sku: string, qty: number) {
    if (!user?.id) throw new Error('You must be logged in to update cart items.');
    if (qty <= 0) {
      await removeItem(product_id, sku);
      return;
    }

    const { error } = await supabase
      .from('cart_items')
      .update({ quantity: qty })
      .eq('user_id', user.id)
      .eq('product_id', product_id)
      .eq('sku', sku);
    if (error) throw new Error(error.message);
    await loadCart(user.id);
  }

  async function removeItem(product_id: string, sku: string) {
    if (!user?.id) throw new Error('You must be logged in to remove cart items.');
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', user.id)
      .eq('product_id', product_id)
      .eq('sku', sku);
    if (error) throw new Error(error.message);
    await loadCart(user.id);
  }

  async function clear() {
    if (!user?.id) throw new Error('You must be logged in to clear cart.');
    const { error } = await supabase.from('cart_items').delete().eq('user_id', user.id);
    if (error) throw new Error(error.message);
    setItems([]);
  }

  const total = useMemo(() => items.reduce((s, it) => s + it.price * it.quantity, 0), [items]);

  return (
    <CartContext.Provider value={{ items, loading, addItem, updateQuantity, removeItem, clear, total }}>
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
