import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = "https://streetcode101.com/api";

type CartItem = {
  sku: string;
  price: number;
  cart_quantity?: number;
  [key: string]: any;
};

type CartContextType = {
  cart: CartItem[];
  addToCart: (product: CartItem) => void;
  removeFromCart: (sku: string) => void;
  updateQuantity: (sku: string, quantity: number) => void;
  clearCart: () => void;
  reloadCart: () => Promise<void>;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
  cartTotal: number;
  cartItemCount: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const reloadCart = async () => {
    try {
      const token = await SecureStore.getItemAsync('pidrop_token');
      if (token) {
        const res = await fetch(`${API_BASE}/cart`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setCart(data);
        }
      } else {
        const localCart = await AsyncStorage.getItem('sc101_cart');
        if (localCart) setCart(JSON.parse(localCart));
      }
    } catch (err) {
      console.error('Failed to load secure cart', err);
    } finally {
      setIsInitialized(true);
    }
  };

  // 1. Load Cart on Mount (from DB if logged in, else AsyncStorage)
  useEffect(() => {
    reloadCart();
  }, []);

  // 2. Sync Cart on Change (to DB if logged in, always to AsyncStorage)
  useEffect(() => {
    if (!isInitialized) return; 

    const syncCart = async () => {
      // Always keep a local backup for guest users
      await AsyncStorage.setItem('sc101_cart', JSON.stringify(cart));

      const token = await SecureStore.getItemAsync('pidrop_token');
      if (token) {
        const syncData = {
          items: cart.map(item => ({
            sku: item.sku,
            quantity: item.cart_quantity || 1
          }))
        };

        // Silently sync to PostgreSQL in the background
        fetch(`${API_BASE}/cart/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(syncData)
        }).catch(err => console.error('Failed to sync cart to DB', err));
      }
    };

    syncCart();
  }, [cart, isInitialized]);

  const addToCart = (product: CartItem) => {
    setCart(prev => {
      const existing = prev.find(item => item.sku === product.sku);
      if (existing) {
        // Replaces react-hot-toast with native Alert
        Alert.alert("Updated", "Increased quantity in cart!");
        return prev.map(item => 
          item.sku === product.sku 
            ? { ...item, cart_quantity: (item.cart_quantity || 1) + 1 } 
            : item
        );
      }
      Alert.alert("Success", "Added to secure cart!");
      return [...prev, { ...product, cart_quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (sku: string) => {
    setCart(prev => prev.filter(item => item.sku !== sku));
  };

  const updateQuantity = (sku: string, quantity: number) => {
    if (quantity < 1) return removeFromCart(sku);
    setCart(prev => prev.map(item => 
      item.sku === sku ? { ...item, cart_quantity: quantity } : item
    ));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Calculate totals factoring in potential quantities
  const cartTotal = cart.reduce((total, item) => total + (item.price * (item.cart_quantity || 1)), 0);
  const cartItemCount = cart.reduce((count, item) => count + (item.cart_quantity || 1), 0);

  return (
    <CartContext.Provider value={{ 
      cart, 
      addToCart, 
      removeFromCart, 
      updateQuantity,
      clearCart,
      reloadCart,
      isCartOpen, 
      setIsCartOpen,
      cartTotal,
      cartItemCount
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
