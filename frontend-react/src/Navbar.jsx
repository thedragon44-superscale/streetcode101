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
  
  // Notification State
  const [notifications, setNotifications] = useState([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.is_read).length;

  // State for the new Global Search Engine
  const [globalResults, setGlobalResults] = useState({ products: [], users: [] });
  
  // Fetch global search results from backend dynamically
  useEffect(() => {
    if (searchQuery && searchQuery.trim().length > 0) {
      fetch(`${API_BASE}/search?q=${encodeURIComponent(searchQuery)}`)
        .then(res => res.ok ? res.json() : { products: [], users: [] })
        .then(data => setGlobalResults(data))
        .catch(err => console.error("Search failed:", err));
    } else {
      setGlobalResults({ products: [], users: [] });
    }
  }, [searchQuery]);
  
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

  // Promo Code State
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);

  // Dynamic Discount Calculation (Forces UI to reflect math instantly)
  const vaultDiscount = currentUser?.discount_percent || 0;
  const activePromoDiscount = appliedPromo ? appliedPromo.discount_percent : 0;
  const totalDiscountPercent = vaultDiscount + activePromoDiscount;
  const discountMultiplier = 1 - (totalDiscountPercent / 100);
  const finalTotal = cartTotal * discountMultiplier;

  // Fetch Stripe PaymentIntent securely from the backend
  useEffect(() => {
    if (isCartOpen && cart.length > 0) {
      const token = localStorage.getItem('pidrop_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const payload = {
        items: cart.map(item => ({ sku: item.sku, quantity: item.cart_quantity || 1 })),
        promo_code: appliedPromo ? appliedPromo.code : null
      };

      fetch(`${API_BASE}/create-payment-intent`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to create payment intent');
        return data;
      })
      .then(data => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        }
      })
      .catch(err => console.error('Stripe error:', err.message));
    } else {
      setClientSecret('');
    }
  }, [isCartOpen, cart, appliedPromo]);

  const handleApplyPromo = async () => {
    if (!promoInput.trim()) return;
    setIsApplyingPromo(true);
    try {
      const res = await fetch(`${API_BASE}/validate-promo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoInput })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Invalid code');
      
      setAppliedPromo(data);
      toast.success('Promo code applied!');
      setPromoInput('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsApplyingPromo(false);
    }
  };

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
          
          fetch(`${API_BASE}/notifications`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          .then(res => res.ok ? res.json() : [])
          .then(notifs => setNotifications(notifs))
          .catch(err => console.log('Failed to fetch notifications:', err));
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

  const handleStreetCoinCheckout = async () => {
    if (cart.length === 0) return;
    setIsSubmitting(true);

    const aptString = checkoutApt ? ` ${checkoutApt}` : '';
    const fullShippingAddress = `${checkoutName} | ${checkoutStreet}${aptString}, ${checkoutCity}, ${checkoutState} ${checkoutZip}`;
    const token = localStorage.getItem('pidrop_token');

    try {
      const response = await fetch(`${API_BASE}/checkout/streetcoin`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          items: cart.map(item => ({ sku: item.sku, quantity: item.cart_quantity || 1 })),
          promo_code: appliedPromo ? appliedPromo.code : null,
          customer_email: checkoutEmail,
          shipping_address: fullShippingAddress
        })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'StreetCoin checkout failed');
      
      toast.success('Escrow secured! Order placed successfully.');
      
      // Optimistically update wallet balance in UI
      setCurrentUser(prev => ({
        ...prev,
        wallet_balance: prev.wallet_balance - finalTotal
      }));
      
      clearCart();
      setIsCartOpen(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-[9999] bg-slate-950 text-white shadow-2xl border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 flex-shrink-0 hover:text-orange-500 transition-colors">
            <img src="/streetbook_logo.png" alt="Street Code 101" className="h-10 w-10 object-cover rounded-md shadow-sm border border-slate-800" />
            <span className="text-xl font-black tracking-tight hidden md:block uppercase font-heading">
              STREET CODE <span className="text-orange-500">101</span>
            </span>
          </Link>

          {/* Enhanced Search Bar */}
          <div className="flex-1 w-full flex justify-center px-6 sm:px-10">
            {showSearch && (
              <div className="flex w-full max-w-3xl relative group">
                <input 
                  type="text" 
                  placeholder="SEARCH VAULT..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-5 py-2.5 bg-slate-900/80 text-blue-400 placeholder-slate-500 border border-slate-700 rounded-l-xl focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm font-mono font-bold transition-all uppercase tracking-wider group-hover:bg-slate-900 shadow-inner"
                />
                <button className="bg-slate-800 hover:bg-slate-700 px-6 py-2.5 rounded-r-xl text-orange-500 transition-colors flex items-center justify-center border border-slate-700 border-l-0 shadow-sm">
                  <i className="fa-solid fa-magnifying-glass"></i>
                </button>

                {/* Auto-fill Search Dropdown */}
                {searchQuery.trim().length > 0 && (
                  <div className="absolute top-[110%] left-0 right-0 bg-slate-950 rounded-xl shadow-[0_30px_60px_rgba(0,0,0,0.9)] border border-slate-700 overflow-hidden z-[99999] flex flex-col max-h-[70vh] overflow-y-auto">
                    
                    {/* Community Members Section */}
                    {globalResults.users.length > 0 && (
                      <div className="border-b border-slate-800/50">
                        <div className="px-4 py-2 bg-slate-900 text-[10px] font-black text-cyan-500 uppercase tracking-widest">Community Members</div>
                        {globalResults.users.slice(0, 4).map(user => (
                          <Link 
                            key={user.username} 
                            to={`/profile/${user.username}`}
                            onClick={() => setSearchQuery('')}
                            className="flex items-center gap-4 p-3 bg-slate-950 hover:bg-slate-800 border-b border-slate-800/50 last:border-0 transition-colors text-left group"
                          >
                            <img src={user.profile_image_url} alt={user.username} className="w-10 h-10 object-cover rounded-full bg-slate-900 border border-slate-700 shadow-sm" />
                            <div className="flex-1 overflow-hidden">
                              <h4 className="text-sm font-bold text-slate-100 truncate group-hover:text-cyan-400 transition-colors">@{user.username}</h4>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}

                    {/* Vault Drops Section */}
                    {globalResults.products.length > 0 && (
                      <div>
                        <div className="px-4 py-2 bg-slate-900 text-[10px] font-black text-orange-500 uppercase tracking-widest">Vault Drops</div>
                        {globalResults.products.slice(0, 6).map(item => (
                          <Link 
                            key={item.sku} 
                            to={`/product/${item.sku}`}
                            onClick={() => setSearchQuery('')}
                            className="flex items-center gap-4 p-3 bg-slate-950 hover:bg-slate-800 border-b border-slate-800/50 last:border-0 transition-colors text-left group"
                          >
                            <img src={item.image_url} alt={item.title} className="w-12 h-12 object-cover rounded-md bg-slate-900 border border-slate-800 shadow-sm" />
                            <div className="flex-1 overflow-hidden">
                              <h4 className="text-sm font-bold text-slate-100 truncate group-hover:text-orange-500 transition-colors">{item.title}</h4>
                              <p className="text-xs text-blue-400 font-mono mt-0.5">${item.price.toFixed(2)}</p>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}

                    {/* No Results Fallback */}
                    {globalResults.users.length === 0 && globalResults.products.length === 0 && (
                      <div className="p-4 bg-slate-950 text-center text-slate-500 font-mono text-xs">NO RESULTS FOUND</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Right Navigation */}
          <div className="hidden sm:flex items-center gap-6 flex-shrink-0">
            <Link to="/feed" className="text-xs font-mono font-bold text-slate-400 hover:text-orange-500 transition-colors uppercase tracking-widest">
              FEED
            </Link>

            {currentUser ? (
              <>
                <Link to="/inbox" className="text-xs font-mono font-bold text-slate-400 hover:text-orange-500 transition-colors uppercase tracking-widest">
                  INBOX
                </Link>

                {/* Notification Bell Dropdown */}
                <div className="relative flex items-center h-full">
                  <button onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className="relative text-slate-400 hover:text-orange-500 transition-colors px-2 flex items-center h-full">
                    <i className="fa-solid fa-bell text-xl"></i>
                    {unreadCount > 0 && (
                      <span className="absolute top-[-5px] right-[-5px] bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-black font-mono shadow-md border-2 border-slate-950 box-content">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Dropdown Panel */}
                  {isNotificationsOpen && (
                    <div className="absolute top-full mt-5 right-0 w-80 bg-slate-950 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-slate-700 overflow-hidden flex flex-col max-h-[60vh] z-[99999]">
                      <div className="px-5 py-4 bg-slate-900 border-b border-slate-800 flex justify-between items-center">
                        <span className="text-xs font-black text-cyan-500 uppercase tracking-widest leading-none block pt-1">Notifications</span>
                      </div>
                      <div className="overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center text-slate-500 font-mono text-xs">NO NEW ALERTS</div>
                        ) : (
                          notifications.map(n => (
                            <Link key={n.id} to={`/post/${n.post_id}`} onClick={() => setIsNotificationsOpen(false)} className={`p-4 border-b border-slate-800/50 flex gap-3 items-start hover:bg-slate-800 transition-colors ${n.is_read ? 'opacity-50' : 'bg-slate-900/30'}`}>
                              <div className="text-orange-500 mt-0.5 text-sm">
                                <i className={`fa-solid ${(n.action || '').includes('liked') ? 'fa-heart' : 'fa-comment'}`}></i>
                              </div>
                              <div>
                                <p className="text-xs text-slate-300 font-medium leading-relaxed">
                                  <span className="font-bold text-white">@{n.actor_username}</span> {n.action || 'interacted with your post'}
                                </p>
                                <span className="text-[9px] text-slate-500 font-bold uppercase mt-1 block">{n.created_at ? new Date(n.created_at).toLocaleDateString() : 'Just now'}</span>
                              </div>
                            </Link>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {currentUser.username === 'admin' && (
                  <Link to="/admin" className="text-xs font-mono font-bold text-orange-500 hover:text-orange-400 transition-colors uppercase tracking-widest border border-orange-500/30 px-3 py-1.5 rounded-md bg-orange-500/10">
                    ADMIN
                  </Link>
                )}
                <Link to="/profile/me" className="flex items-center gap-2 hover:text-orange-500 transition-colors ml-2 pl-2 border-l border-slate-800">
                  <img src={currentUser.profile_image_url} alt="Avatar" className="w-8 h-8 rounded-full border border-slate-700 object-cover" />
                  <div className="text-xs font-mono font-bold uppercase tracking-wider text-left">
                    @{currentUser.username}
                  </div>
                </Link>
              </>
            ) : (
              <Link to="/login" className="text-xs font-mono font-bold text-slate-950 bg-orange-500 hover:bg-orange-400 transition-colors uppercase tracking-widest px-4 py-2 rounded-md shadow-sm ml-2">
                LOG IN
              </Link>
            )}
            
            <button onClick={() => setIsCartOpen(true)} className="flex items-center gap-1 hover:text-orange-500 transition-colors px-2">
              <div className="relative">
                <i className="fa-solid fa-cart-shopping text-xl text-slate-300 transition-colors hover:text-orange-500"></i>
                {cartItemCount > 0 && (
                  <span className="absolute -top-2 -right-3 bg-orange-500 text-slate-950 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-black font-mono shadow-md">
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

        {currentUser && (
          <Link to="/inbox" className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive('/inbox') || location.pathname.startsWith('/chat') ? 'text-orange-500' : 'text-slate-500 hover:text-blue-400'}`}>
            <i className="fa-solid fa-envelope text-xl"></i>
            <span className="text-[10px] font-bold tracking-wide font-mono uppercase">Inbox</span>
          </Link>
        )}
        
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
        
        {/* Mobile Admin Link (Only visible if Master Admin) */}
        {currentUser?.username === 'admin' && (
          <Link to="/admin" className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${isActive('/admin') ? 'text-orange-500' : 'text-orange-500/50 hover:text-orange-400'}`}>
            <i className="fa-solid fa-screwdriver-wrench text-xl"></i>
            <span className="text-[10px] font-bold tracking-wide font-mono uppercase">Admin</span>
          </Link>
        )}
      </div>

      <div className="h-16 sm:hidden bg-slate-950"></div>

      {/* --- CART SLIDE-OUT MODAL --- */}
      {isCartOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[10000] transition-opacity" onClick={() => setIsCartOpen(false)} />
      )}
      <div className={`fixed top-0 right-0 h-[100dvh] w-full sm:w-[500px] bg-slate-950 z-[10001] shadow-[-10px_0_50px_rgba(0,0,0,0.5)] transform transition-transform duration-300 ease-in-out flex flex-col border-l border-slate-800 ${isCartOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        <div className="px-6 pt-14 pb-5 sm:py-5 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <h2 className="text-xl font-black text-white uppercase tracking-widest font-heading">
            YOUR <span className="text-orange-500">CART</span>
          </h2>
          <button onClick={() => setIsCartOpen(false)} className="text-slate-500 hover:text-orange-500 font-bold text-2xl p-2 transition-colors">✕</button>
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

            {/* Promo Code Input UI */}
            {!appliedPromo ? (
              <div className="flex gap-2 mb-3 mt-3">
                <input 
                  type="text" 
                  placeholder="PROMO CODE" 
                  value={promoInput} 
                  onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg focus:outline-none focus:border-orange-500 font-mono text-xs text-white uppercase" 
                />
                <button 
                  onClick={handleApplyPromo}
                  disabled={isApplyingPromo || !promoInput}
                  className="bg-slate-800 hover:bg-orange-500 text-slate-300 hover:text-slate-950 px-4 py-2 rounded-lg font-bold text-xs transition-colors disabled:opacity-50"
                >
                  {isApplyingPromo ? '...' : 'APPLY'}
                </button>
              </div>
            ) : (
              <div className="flex justify-between items-center mb-3 mt-3 font-mono text-xs text-orange-400 font-bold bg-orange-950/30 p-2 rounded-md border border-orange-900/50">
                <span>[{appliedPromo.code}]</span>
                <span>-{appliedPromo.discount_percent}%</span>
                <button onClick={() => setAppliedPromo(null)} className="text-slate-400 hover:text-white ml-2 transition-colors">✕</button>
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
                
                {/* --- STREETCOIN ESCROW BUTTON --- */}
                {currentUser && (
                  <div className="mb-6 bg-slate-900 border border-orange-500/30 rounded-xl p-4 shadow-lg">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Wallet Balance</span>
                      <span className="text-sm font-black text-orange-500 font-mono">{currentUser.wallet_balance?.toFixed(2) || '0.00'} SC</span>
                    </div>
                    <button
                      onClick={handleStreetCoinCheckout}
                      disabled={isSubmitting || (currentUser.wallet_balance || 0) < finalTotal}
                      className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-black py-4 rounded-xl transition-all active:scale-[0.98] uppercase tracking-wider flex items-center justify-center gap-2"
                    >
                      <i className="fa-solid fa-coins"></i> 
                      {isSubmitting ? 'PROCESSING...' : 'PAY WITH STREETCOIN'}
                    </button>
                    {(currentUser.wallet_balance || 0) < finalTotal && (
                      <div className="text-[10px] text-red-400 font-bold mt-2 text-center uppercase tracking-widest">
                        INSUFFICIENT BALANCE. TOP UP PROFILE.
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-3 mb-6">
                  <div className="flex-1 h-px bg-slate-800"></div>
                  <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">OR PAY WITH CARD</div>
                  <div className="flex-1 h-px bg-slate-800"></div>
                </div>

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
