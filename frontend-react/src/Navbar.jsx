import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useCart } from './CartContext';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from './CheckoutForm';

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export default function Navbar({ showSearch = false, searchQuery, setSearchQuery, searchResults = [] }) {
  const { cart, removeFromCart, updateQuantity, clearCart, isCartOpen, setIsCartOpen, cartItemCount, cartTotal } = useCart();
  const [currentUser, setCurrentUser] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // To highlight the active tab on the mobile bottom nav
  const location = useLocation();
  const isActive = (path) => location.pathname === path;

  // Checkout Fields
  const [checkoutEmail, setCheckoutEmail] = useState('');
  const [checkoutName, setCheckoutName] = useState('');
  const [checkoutStreet, setCheckoutStreet] = useState('');
  const [checkoutApt, setCheckoutApt] = useState('');
  const [checkoutCity, setCheckoutCity] = useState('');
  const [checkoutState, setCheckoutState] = useState('');
  const [checkoutZip, setCheckoutZip] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  // Dynamic Discount Calculation
  const vaultDiscount = currentUser?.discount_percent || 0;
  const discountMultiplier = 1 - (vaultDiscount / 100);
  const finalTotal = cartTotal * discountMultiplier;

  // Fetch Stripe PaymentIntent automatically using the DISCOUNTED total
  useEffect(() => {
    if (isCartOpen && finalTotal > 0) {
      fetch(`${API_BASE}/create-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: finalTotal })
      })
      .then(res => res.json())
      .then(data => {
        if (data.clientSecret) setClientSecret(data.clientSecret);
      })
      .catch(err => console.error('Stripe error:', err));
    }
  }, [isCartOpen, finalTotal]);

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

    const aptString = checkoutApt ? ` ${checkoutApt}` : '';
    const fullShippingAddress = `${checkoutName} | ${checkoutStreet}${aptString}, ${checkoutCity}, ${checkoutState} ${checkoutZip}`;

    try {
      for (const item of cart) {
        const response = await fetch(`${API_BASE}/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sku: item.sku,
            quantity: item.cart_quantity || 1,
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
      <header className="sticky top-0 z-50 bg-slate-950 text-white shadow-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 flex-shrink-0 hover:text-orange-500 transition-colors">
            <img src="/streetbook_logo.png" alt="Street Code 101" className="h-10 w-10 object-cover rounded-md shadow-sm border border-slate-800" />
            <span className="text-xl font-black tracking-tight hidden md:block uppercase font-heading">
              STREET CODE <span className="text-orange-500">101</span>
            </span>
          </Link>

          {/* Search Bar */}
          <div className="flex-1 max-w-3xl flex justify-center px-4">
            {showSearch && (
              <div className="flex w-full max-w-xl relative">
                <input 
                  type="text" 
                  placeholder="SEARCH VAULT..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-900 text-blue-400 placeholder-slate-600 border border-slate-800 rounded-l-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs font-mono font-bold transition-all uppercase tracking-wider"
                />
                <button className="bg-slate-800 hover:bg-slate-700 px-6 py-2 rounded-r-xl text-blue-400 transition-colors flex items-center justify-center border border-slate-800 border-l-0">
                  <i className="fa-solid fa-magnifying-glass"></i>
                </button>

                {/* Auto-fill Search Dropdown */}
                {searchQuery.trim().length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 rounded-xl shadow-2xl border border-slate-800 overflow-hidden z-50 flex flex-col">
                    {searchResults.slice(0, 5).map(item => (
                      <Link 
                        key={item.sku} 
                        to={`/product/${item.sku}`}
                        onClick={() => setSearchQuery('')}
                        className="flex items-center gap-3 p-3 hover:bg-slate-800 border-b border-slate-800/50 last:border-0 transition-colors text-left group"
                      >
                        <img src={item.image_url} alt={item.title} className="w-10 h-10 object-cover rounded-md bg-slate-950 border border-slate-800" />
                        <div className="flex-1 overflow-hidden">
                          <h4 className="text-sm font-bold text-slate-200 truncate group-hover:text-orange-500 transition-colors">{item.title}</h4>
                          <p className="text-xs text-blue-400 font-mono">${item.price.toFixed(2)}</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Right Navigation */}
          <div className="hidden sm:flex items-center gap-6 flex-shrink-0">
            <Link to="/feed" className="text-xs font-mono font-bold text-slate-400 hover:text-blue-400 transition-colors uppercase tracking-widest">
              SOCIAL FEED
            </Link>

            {currentUser ? (
              <>
                {currentUser.username === 'admin' && (
                  <Link to="/admin" className="text-xs font-mono font-bold text-orange-500 hover:text-orange-400 transition-colors uppercase tracking-widest border border-orange-500/30 px-3 py-1.5 rounded-md bg-orange-500/10">
                    ADMIN CONSOLE
                  </Link>
                )}
                <Link to="/inbox" className="text-xs font-mono font-bold text-slate-400 hover:text-blue-400 transition-colors uppercase tracking-widest">
                  SECURE INBOX
                </Link>
                <Link to="/profile/me" className="flex items-center gap-2 hover:text-orange-500 transition-colors">
                  <img src={currentUser.profile_image_url} alt="Avatar" className="w-8 h-8 rounded-full border border-slate-700 object-cover" />
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-right">
                    <span className="block text-[9px] text-blue-400">LOGGED IN</span>
                    @{currentUser.username}
                  </div>
                </Link>
              </>
            ) : (
              <Link to="/login" className="text-xs font-mono font-bold text-orange-500 hover:text-orange-400 transition-colors uppercase tracking-widest border border-orange-500/30 px-3 py-1.5 rounded-md bg-orange-500/10">
                ACCESS VAULT
              </Link>
            )}
            
            <button onClick={() => setIsCartOpen(true)} className="flex items-center gap-1 hover:text-orange-500 transition-colors bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-md">
              <div className="relative">
                <i className="fa-solid fa-cart-shopping text-lg text-slate-300"></i>
                {cartItemCount > 0 && (
                  <span className="absolute -top-2 -right-3 bg-orange-500 text-slate-950 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-black font-mono">
                    {cartItemCount}
                  </span>
                )}
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* --- MOBILE BOTTOM NAVIGATION BAR --- */}
      <div className="sm:hidden fixed bottom-0 left-0 w-full bg-slate-950 border-t border-slate-800 z-50 flex items-center justify-around h-16 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.5)]">
        <Link to="/" className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive('/') ? 'text-orange-500' : 'text-slate-500 hover:text-blue-400'}`}>
          <i className="fa-solid fa-house text-xl"></i>
          <span className="text-[10px] font-bold tracking-wide font-mono uppercase">Home</span>
        </Link>
        
        <Link to="/feed" className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive('/feed') ? 'text-orange-500' : 'text-slate-500 hover:text-blue-400'}`}>
          <i className="fa-solid fa-layer-group text-xl"></i>
          <span className="text-[10px] font-bold tracking-wide font-mono uppercase">Feed</span>
        </Link>
        
        <button onClick={() => setIsCartOpen(true)} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isCartOpen ? 'text-orange-500' : 'text-slate-500 hover:text-blue-400'}`}>
          <div className="relative">
            <i className="fa-solid fa-cart-shopping text-xl"></i>
            {cartItemCount > 0 && (
              <span className="absolute -top-1.5 -right-2 bg-orange-500 text-slate-950 rounded-full w-4 h-4 flex items-center justify-center text-[9px] font-black font-mono border-2 border-slate-950 box-content">
                {cartItemCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold tracking-wide font-mono uppercase">Cart</span>
        </button>

        <Link to={currentUser ? "/profile/me" : "/login"} className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive('/profile/me') ? 'text-orange-500' : 'text-slate-500 hover:text-blue-400'}`}>
          {currentUser ? (
             <img src={currentUser.profile_image_url} alt="Profile" className={`w-6 h-6 rounded-full object-cover border-2 ${isActive('/profile/me') ? 'border-orange-500' : 'border-transparent'}`} />
          ) : (
            <i className="fa-solid fa-user-astronaut text-xl"></i>
          )}
          <span className="text-[10px] font-bold tracking-wide font-mono uppercase">{currentUser ? 'Profile' : 'Log In'}</span>
        </Link>
      </div>

      <div className="h-16 sm:hidden bg-slate-950"></div>

      {/* --- CART SLIDE-OUT MODAL --- */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] transition-opacity" onClick={() => setIsCartOpen(false)} />
      )}
      <div className={`fixed top-0 right-0 h-full w-full sm:w-[500px] bg-slate-950 z-[101] shadow-[-10px_0_50px_rgba(0,0,0,0.5)] transform transition-transform duration-300 ease-in-out flex flex-col border-l border-slate-800 ${isCartOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        <div className="px-6 py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <h2 className="text-xl font-black text-white uppercase tracking-widest font-heading">
            YOUR <span className="text-orange-500">CART</span>
          </h2>
          <button onClick={() => setIsCartOpen(false)} className="text-slate-500 hover:text-orange-500 font-bold text-xl transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 bg-slate-900/50">
          {cart.length === 0 ? (
            <div className="text-center text-slate-500 mt-20 font-mono text-sm">
              <i className="fa-solid fa-ghost text-4xl mb-4 block text-slate-700"></i>
              NO ITEMS IN VAULT.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {cart.map(item => (
                <div key={item.sku} className="relative flex gap-4 bg-slate-900 p-3 rounded-xl border border-slate-800 shadow-sm group hover:border-blue-500/50 transition-colors">
                  <button 
                    onClick={() => removeFromCart(item.sku)} 
                    className="absolute top-2 right-2 z-10 w-6 h-6 bg-slate-800 hover:bg-orange-500 text-slate-400 hover:text-slate-950 rounded-md flex items-center justify-center transition-colors text-xs"
                  >✕</button>

                  <img src={item.image_url} alt={item.title} className="w-20 h-20 object-cover rounded-lg bg-slate-950 border border-slate-800" />
                  
                  <div className="flex flex-col flex-1 justify-between py-1">
                    <h3 className="font-bold text-xs text-slate-200 uppercase pr-6 leading-relaxed">{item.title}</h3>
                    
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-blue-400 font-mono font-bold text-sm">${item.price.toFixed(2)}</p>
                      
                      <div className="flex items-center bg-slate-950 border border-slate-800 rounded-md">
                        <button onClick={() => updateQuantity(item.sku, (item.cart_quantity || 1) - 1)} className="px-2 py-1 text-slate-400 hover:text-white">-</button>
                        <span className="px-2 font-mono text-xs text-white">{item.cart_quantity || 1}</span>
                        <button onClick={() => updateQuantity(item.sku, (item.cart_quantity || 1) + 1)} className="px-2 py-1 text-slate-400 hover:text-white">+</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="border-t border-slate-800 p-6 bg-slate-950 shadow-2xl z-10 overflow-y-auto max-h-[60vh]">
            
            {/* Discount Calculation Display */}
            <div className="flex justify-between items-center mb-2 font-mono text-sm text-slate-400">
              <span>SUBTOTAL:</span>
              <span>${cartTotal.toFixed(2)}</span>
            </div>
            
            {vaultDiscount > 0 && (
              <div className="flex justify-between items-center mb-2 font-mono text-xs text-emerald-400 font-bold bg-emerald-950/30 p-2 rounded-md border border-emerald-900/50">
                <span>[101_VAULT_DISCOUNT]</span>
                <span>-{vaultDiscount}%</span>
              </div>
            )}

            <div className="flex justify-between items-center mb-6 pt-2 border-t border-slate-800">
              <span className="text-white font-black uppercase tracking-widest text-sm">TOTAL:</span>
              <span className="text-2xl font-black text-orange-500 font-mono">${finalTotal.toFixed(2)}</span>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-xs font-mono font-bold text-blue-400 mb-3 uppercase tracking-widest">SHIPPING MANIFEST</h3>
                <div className="space-y-3">
                  <input type="email" placeholder="EMAIL ADDRESS *" value={checkoutEmail} onChange={(e) => setCheckoutEmail(e.target.value)} className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg focus:outline-none focus:border-orange-500 font-mono text-xs text-white placeholder-slate-600" />
                  <input type="text" placeholder="FULL NAME *" value={checkoutName} onChange={(e) => setCheckoutName(e.target.value)} className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg focus:outline-none focus:border-orange-500 font-mono text-xs text-white placeholder-slate-600" />
                  <div className="flex gap-2">
                    <input type="text" placeholder="STREET ADDRESS *" value={checkoutStreet} onChange={(e) => setCheckoutStreet(e.target.value)} className="flex-1 px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg focus:outline-none focus:border-orange-500 font-mono text-xs text-white placeholder-slate-600" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input type="text" placeholder="CITY *" value={checkoutCity} onChange={(e) => setCheckoutCity(e.target.value)} className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg focus:outline-none focus:border-orange-500 font-mono text-xs text-white placeholder-slate-600" />
                    <input type="text" placeholder="ZIP *" value={checkoutZip} onChange={(e) => setCheckoutZip(e.target.value)} className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-lg focus:outline-none focus:border-orange-500 font-mono text-xs text-white placeholder-slate-600" />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-mono font-bold text-blue-400 mb-3 uppercase tracking-widest">SECURE PAYMENT</h3>
                {clientSecret ? (
                  <Elements stripe={stripePromise} options={{ 
                    clientSecret, 
                    appearance: { theme: 'night', variables: { colorPrimary: '#f97316', colorBackground: '#0f172a' } }
                  }}>
                    <CheckoutForm onSuccess={handleCheckout} />
                  </Elements>
                ) : (
                  <div className="w-full px-4 py-6 rounded-lg border border-slate-800 bg-slate-900 flex items-center justify-center text-orange-500 font-mono font-bold text-xs">
                    <i className="fa-solid fa-circle-notch fa-spin mr-2"></i> INITIALIZING STRIPE SECURE...
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
