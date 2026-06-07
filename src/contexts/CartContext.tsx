import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { CartItem, DataBundle } from "@/lib/data";

interface CartContextType {
  items: CartItem[];
  addItem: (networkId: string, networkName: string, bundle: DataBundle, phoneNumber: string, effectivePrice: number, wholesalePrice: number, storeId?: string | null) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "donmac_cart";

function loadCart(): CartItem[] {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = (networkId: string, networkName: string, bundle: DataBundle, phoneNumber: string, effectivePrice: number, wholesalePrice: number, storeId?: string | null) => {
    const newItem: CartItem = {
      id: `${Date.now()}-${Math.random()}`,
      network: networkName,
      networkId,
      bundle,
      phoneNumber,
      effectivePrice,
      wholesalePrice,
      storeId,
    };
    setItems((prev) => [...prev, newItem]);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => setItems([]);

  const total = items.reduce((sum, item) => sum + item.effectivePrice, 0);
  const itemCount = items.length;

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, clearCart, total, itemCount }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
