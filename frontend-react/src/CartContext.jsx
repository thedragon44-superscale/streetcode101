import { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const CartContext = createContext();
const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // 1. Load Cart on Mount (from DB if logged in, else localStorage)
  useEffect(() => {
    const token = localStorage.getItem('pidrop_token');
    if (token) {
      fetch(`${API_BASE}/cart`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        setCart(data);
        setIsInitialized(true);
      })
      .catch(err => {
        console.error('Failed to load secure cart', err);
        setIsInitialized(true);
      });
    } else {
      const localCart = localStorage.getItem('sc101_cart');
      if (localCart) setCart(JSON.parse(localCart));
      setIsInitialized(true);
    }
  }, []);

  // 2. Sync Cart on Change (to DB if logged in, always to localStorage)
  useEffect(() => {
    if (!isInitialized) return; // Don't sync before we've loaded!

    // Always keep a local backup for guest users
    localStorage.setItem('sc101_cart', JSON.stringify(cart));

    const token = localStorage.getItem('pidrop_token');
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
  }, [cart, isInitialized]);

  const addToCart = (product) => {
    setCart(prev => {
      const existing = prev.find(item => item.sku === product.sku);
      if (existing) {
        toast.success('Increased quantity in cart!');
        return prev.map(item => 
          item.sku === product.sku 
            ? { ...item, cart_quantity: (item.cart_quantity || 1) + 1 } 
            : item
        );
      }
      toast.success('Added to secure cart!');
      return [...prev, { ...product, cart_quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  const removeFromCart = (sku) => {
    setCart(prev => prev.filter(item => item.sku !== sku));
  };

  const updateQuantity = (sku, quantity) => {
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
      isCartOpen, 
      setIsCartOpen,
      cartTotal,
      cartItemCount
    }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
