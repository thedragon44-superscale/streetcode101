import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useCart } from './CartContext';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from './CheckoutForm';

const API_BASE = 'http://127.0.0.1:8000/api';
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export default function Navbar({ showSearch = false, searchQuery, setSearchQuery }) {
  const { cart, removeFromCart, clearCart, isCartOpen, setIsCartOpen, cartItemCount, cartTotal } = useCart();
  const [currentUser, setCurrentUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // To highlight the active tab on the mobile bottom nav
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  // Checkout Fields
  const [checkoutEmail, setCheckoutEmail] = useState('');
  const [checkoutName, setCheckoutName] = useState('');
  const [checkoutStreet, setCheckoutStreet] = useState('');
  const [checkoutCity, setCheckoutCity] = useState('');
  const [checkoutState, setCheckoutState] = useState('');
  const [checkoutZip, setCheckoutZip] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  // Fetch Stripe PaymentIntent automatically when the Cart is opened
  useEffect(() => {
    if (isCartOpen && cartTotal > 0) {
      fetch(`${API_BASE}/create-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: cartTotal })
      })
      .then(res => res.json())
      .then(data => {
        if (data.clientSecret) setClientSecret(data.clientSecret);
      })
      .catch(err => console.error('Stripe error:', err));
    }
  }, [isCartOpen, cartTotal]);

  // Authenticate user on load globally
  useEffect(() => {
    const token = localStorage.getItem('pidrop_token');
    if (token) {
      fetch(`${API_BASE}/profile/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) {
          setCurrentUser(data);
          setCheckoutEmail(prev => prev || data.email || '');
        }
      })
      .catch(err => console.log('Auth check failed:', err));
    }
  }, []);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);

    const fullShippingAddress = `${checkoutName} | ${checkoutStreet}, ${checkoutCity}, ${checkoutState} ${checkoutZip}`;

    try {
      for (const item of cart) {
        const response = await fetch(`${API_BASE}/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sku: item.sku,
            quantity: item.cart_quantity || 1,  // <-- FIXED THIS LINE
            customer_email: checkoutEmail,
            shipping_address: fullShippingAddress
          })
        });
        if (!response.ok) throw new Error(`Failed to process ${item.title}`);
      }
      
      toast.success('Order placed successfully! Check your email for tracking.');
      clearCart();
      setIsCartOpen(false);
    } catch (err) {
      toast.error(`Checkout failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-slate-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 flex-shrink-0 hover:text-orange-400 transition-colors">
            <img src="/streetbook_logo.png" alt="Street Code 101" className="h-10 w-10 object-cover rounded-md shadow-sm" />
            <span className="text-xl font-black tracking-tight hidden md:block uppercase">Street Code <span className="text-orange-500">101</span></span>
          </Link>

          {/* Optional Search Bar (Only shows on Storefront) */}
          <div className="flex-1 max-w-3xl flex justify-center px-4">
            {showSearch && (
              <div className="flex w-full max-w-xl">
                <input 
                  type="text" 
                  placeholder="Search catalog..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-800 text-white placeholder-slate-400 border border-slate-700 rounded-l-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm font-medium transition-all"
                />
                <button className="bg-orange-500 hover:bg-orange-600 px-6 py-2 rounded-r-xl text-white transition-colors flex items-center justify-center border border-orange-500">
                  <i className="fa-solid fa-magnifying-glass"></i>
                </button>
              </div>
            )}
          </div>
          
          {/* Right Navigation (Hidden on Mobile, Replaced by Bottom Nav) */}
          <div className="hidden sm:flex items-center gap-6 flex-shrink-0">
            <Link to="/feed" className="text-sm font-bold text-slate-300 hover:text-white transition-colors mt-1">
              Social Feed
            </Link>

            {currentUser ? (
              <>
                {currentUser.username === 'admin' && (
                  <Link to="/admin" className="text-sm font-black text-orange-400 hover:text-orange-300 transition-colors mt-1">
                    Admin Console
                  </Link>
                )}
                <Link to="/inbox" className="text-sm font-bold text-slate-300 hover:text-white transition-colors mt-1">
                  Inbox
                </Link>
                <Link to="/profile/me" className="flex items-center gap-2 hover:text-orange-400 transition-colors">
                  <img src={currentUser.profile_image_url} alt="Avatar" className="w-8 h-8 rounded-full border border-slate-600 object-cover" />
                  <div className="text-sm font-bold">
                    <span className="block text-xs font-normal text-slate-400">Hello, @{currentUser.username}</span>
                    Your Profile
                  </div>
                </Link>
              </>
            ) : (
              <Link to="/login" className="text-sm font-bold hover:text-orange-400 transition-colors">
                <span className="block text-xs font-normal text-slate-400">Hello, Sign in</span>
                Account & Admin
              </Link>
            )}
            
            <button onClick={() => setIsCartOpen(true)} className="flex items-center gap-1 hover:text-orange-400 transition-colors">
              <div className="relative">
                <i className="fa-solid fa-cart-shopping text-2xl"></i>
                {cartItemCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-orange-500 text-slate-900 rounded-full w-5 h-5 flex items-center justify-center text-xs font-black">
                    {cartItemCount}
                  </span>
                )}
              </div>
              <span className="font-bold mt-2">Cart</span>
            </button>
          </div>
        </div>
      </header>

      {/* --- MOBILE BOTTOM NAVIGATION BAR --- */}
      <div className="sm:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 z-50 flex items-center justify-around h-16 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <Link to="/" className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive('/') ? 'text-orange-500' : 'text-slate-400 hover:text-slate-900'}`}>
          <i className="fa-solid fa-house text-xl"></i>
          <span className="text-[10px] font-bold tracking-wide">Home</span>
        </Link>
        
        <Link to="/feed" className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive('/feed') ? 'text-orange-500' : 'text-slate-400 hover:text-slate-900'}`}>
          <i className="fa-solid fa-layer-group text-xl"></i>
          <span className="text-[10px] font-bold tracking-wide">Feed</span>
        </Link>
        
        <button onClick={() => setIsCartOpen(true)} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isCartOpen ? 'text-orange-500' : 'text-slate-400 hover:text-slate-900'}`}>
          <div className="relative">
            <i className="fa-solid fa-cart-shopping text-xl"></i>
            {cartItemCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-orange-500 text-slate-900 rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-black border-2 border-white box-content">
                {cartItemCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold tracking-wide">Cart</span>
        </button>

        <Link to={currentUser ? "/profile/me" : "/login"} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive('/profile/me') ? 'text-orange-500' : 'text-slate-400 hover:text-slate-900'}`}>
          {currentUser ? (
             <img src={currentUser.profile_image_url} alt="Profile" className={`w-6 h-6 rounded-full object-cover border-2 ${isActive('/profile/me') ? 'border-orange-500' : 'border-transparent'}`} />
          ) : (
            <i className="fa-regular fa-user text-xl"></i>
          )}
          <span className="text-[10px] font-bold tracking-wide">{currentUser ? 'Profile' : 'Sign In'}</span>
        </Link>
      </div>

      {/* Mobile Spacer to prevent content from hiding behind the bottom bar */}
      <div className="h-16 sm:hidden"></div>

      {/* --- CART SLIDE-OUT MODAL (Global) --- */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] transition-opacity" onClick={() => setIsCartOpen(false)} />
      )}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-[480px] bg-white z-[101] shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${isCartOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
          <h2 className="text-xl font-black text-slate-900">Your Cart</h2>
          <button onClick={() => setIsCartOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold text-xl p-2">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {cart.length === 0 ? (
            <div className="text-center text-slate-500 mt-10">
              <span className="text-4xl mb-4 block">🛒</span>
              Your Street Cart is empty.
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map(item => (
                <div key={item.sku} className="flex gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                  <img src={item.image_url} alt={item.title} className="w-20 h-20 object-contain mix-blend-multiply bg-slate-50 border border-slate-100 rounded-md" />
                  <div className="flex-1">
                    <h3 className="font-bold text-sm text-slate-900 line-clamp-2">{item.title}</h3>
                    <p className="text-slate-900 font-black text-lg mt-1">${item.price.toFixed(2)}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded-md shadow-sm">Qty: {item.quantity}</span>
                      <button type="button" onClick={() => removeFromCart(item.sku)} className="text-xs font-bold text-red-500 hover:text-red-700 hover:underline">Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="border-t border-slate-200 p-6 bg-white shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] z-10 overflow-y-auto max-h-[60vh]">
            <div className="flex justify-between items-center mb-4">
              <span className="text-slate-900 font-bold">Subtotal ({cartItemCount} items):</span>
              <span className="text-2xl font-black text-slate-900">${cartTotal.toFixed(2)}</span>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-wide">Shipping Info</h3>
                <div className="space-y-2">
                  <input type="email" placeholder="Email Address *" value={checkoutEmail} onChange={(e) => setCheckoutEmail(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-600 text-sm font-medium" />
                  <input type="text" placeholder="Full Name *" value={checkoutName} onChange={(e) => setCheckoutName(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-600 text-sm font-medium" />
                  <input type="text" placeholder="Street Address *" value={checkoutStreet} onChange={(e) => setCheckoutStreet(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-600 text-sm font-medium" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="City *" value={checkoutCity} onChange={(e) => setCheckoutCity(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-600 text-sm font-medium" />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" placeholder="State *" value={checkoutState} onChange={(e) => setCheckoutState(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-600 text-sm font-medium uppercase" maxLength={2} />
                      <input type="text" placeholder="ZIP *" value={checkoutZip} onChange={(e) => setCheckoutZip(e.target.value)} className="w-full px-3 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-cyan-600 text-sm font-medium" />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-2 uppercase tracking-wide">Payment Details</h3>
                {clientSecret ? (
                  <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <CheckoutForm onSuccess={handleCheckout} />
                  </Elements>
                ) : (
                  <div className="w-full px-4 py-4 rounded-xl border border-slate-300 bg-slate-50 flex items-center justify-center text-slate-500 font-bold text-sm">
                    <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> Initializing Secure Checkout...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
