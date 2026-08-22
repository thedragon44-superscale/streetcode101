import Footer from './Footer';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from './CartContext';
import Navbar from './Navbar';
import toast from 'react-hot-toast';

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

export default function Storefront() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // --- GLOBAL CART ---
  const { addToCart } = useCart();

  // --- SUPPORT MODAL STATE ---
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [supportMsg, setSupportMsg] = useState('');
  const [isSendingSupport, setIsSendingSupport] = useState(false);

  // --- SEARCH & CATEGORY STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
  const categories = [
    { id: 'All', label: 'All Drops' },
    { id: 'mens-clothing', label: "Men's Clothing" },
    { id: 'womens-clothing', label: "Women's Clothing" },
    { id: 'mens-shoes', label: "Men's Shoes" },
    { id: 'womens-shoes', label: "Women's Shoes" },
    { id: 'mens-jewelry', label: "Men's Jewelry" },
    { id: 'womens-jewelry', label: "Women's Jewelry" },
    { id: 'accessories', label: 'Accessories' },
    { id: 'electronics', label: 'Electronics' },
    { id: 'uncategorized', label: 'New Arrivals' }
  ];

  // --- CURRENT USER STATE (For Support Chat) ---
  const [currentUser, setCurrentUser] = useState(null);

  // Authenticate user on load for the support widget
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
        }
      })
      .catch(err => console.log('Auth check failed:', err));
    }
  }, []);

  // Fetch product catalog
  useEffect(() => {
    fetch(`${API_BASE}/products`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch catalog');
        return res.json();
      })
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          product.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSendSupport = async (e) => {
    e.preventDefault();
    setIsSendingSupport(true);
    try {
      const token = localStorage.getItem('pidrop_token');
      const response = await fetch(`${API_BASE}/support/message`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: supportMsg })
      });
      if (!response.ok) throw new Error('Failed to send message');
      toast.success('Message sent! An operator will email you shortly.');
      setSupportMsg('');
      setIsSupportOpen(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSendingSupport(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800">
      
      {/* Global Navbar with Search Enabled */}
      <Navbar showSearch={true} searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchResults={filteredProducts} />

      {/* --- PROFESSIONAL SUB-HEADER / CATEGORY NAV --- */}
      <div className="bg-white border-b border-slate-200 sticky top-[65px] z-[90] shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          {/* Minimalist Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsCategoryMenuOpen(!isCategoryMenuOpen)}
              className="flex items-center gap-2 text-slate-800 font-black hover:text-orange-500 transition-colors py-1 focus:outline-none"
            >
              <i className="fa-solid fa-bars text-lg"></i>
              <span className="uppercase tracking-widest text-sm">
                {categories.find(c => c.id === selectedCategory)?.label || 'All Drops'}
              </span>
              <i className={`fa-solid fa-chevron-down text-xs ml-1 transition-transform ${isCategoryMenuOpen ? 'rotate-180' : ''}`}></i>
            </button>

            {isCategoryMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsCategoryMenuOpen(false)}></div>
                <div className="absolute left-0 mt-3 w-[90vw] sm:w-[480px] bg-white border border-slate-200 shadow-2xl z-[999] rounded-xl overflow-hidden p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto overflow-x-hidden">
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setSelectedCategory(cat.id);
                          setIsCategoryMenuOpen(false);
                        }}
                        className={`block w-full text-left px-4 py-2.5 text-sm font-bold rounded-lg transition-colors ${
                          selectedCategory === cat.id
                            ? 'text-orange-600 bg-orange-50 border border-orange-200 shadow-sm'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent hover:border-slate-200'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Results text */}
          <div className="text-xs text-slate-500 font-medium">
            Showing <span className="font-bold text-slate-900">{filteredProducts.length}</span> results
            {searchQuery && <span> for "<span className="text-slate-900 font-bold">{searchQuery}</span>"</span>}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-6">
        
        {/* --- HIGH-FASHION FEATURED DROP BANNER --- */}
        {selectedCategory === 'All' && !searchQuery && (() => {
          const featuredProduct = products.find(p => p.is_featured);
          return (
          <div className="relative z-0 mb-10 rounded-3xl overflow-hidden bg-slate-950 text-white p-8 md:p-12 border border-slate-800 shadow-[0_0_50px_rgba(249,115,22,0.1)] flex flex-col md:flex-row items-center justify-between gap-8">
            
            {/* Dual Ambient Glows */}
            <div className="absolute -top-24 -left-24 w-72 h-72 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="max-w-xl z-10">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-bold tracking-widest text-blue-400 uppercase bg-blue-950/80 px-3 py-1 rounded-full border border-blue-800/50">
                  [101_LIVE_VAULT]
                </span>
                <span className="text-xs font-mono text-slate-400">
                  CURATED DROP // <span className="text-orange-500 font-bold">{featuredProduct && featuredProduct.in_stock ? 'IN STOCK' : 'LIVE'}</span>
                </span>
              </div>

              <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tight mt-4 font-heading leading-none">
                {featuredProduct ? (
                  <span className="line-clamp-2">{featuredProduct.title}</span>
                ) : (
                  <>STREET CODE <span className="text-orange-500">101</span></>
                )}
              </h1>
              
              <p className="text-slate-400 mt-4 text-sm md:text-base font-mono leading-relaxed line-clamp-3">
                {featuredProduct 
                  ? featuredProduct.description || "EXCLUSIVE VAULT DROP. LIMITED QUANTITIES AVAILABLE."
                  : "AUTHENTICATED DROPS & PEER-TO-PEER LEDGER. LOG IN TO YOUR PROFILE TO UNLOCK VAULT DISCOUNTS."}
              </p>

              <div className="mt-8 flex flex-wrap gap-4 font-mono">
                <Link to={featuredProduct ? `/product/${featuredProduct.sku}` : "#catalog"} className="bg-orange-500 hover:bg-orange-600 text-slate-950 font-black px-8 py-4 rounded-xl shadow-[0_0_20px_rgba(249,115,22,0.4)] transition-all active:scale-95 text-xs uppercase tracking-widest">
                  EXPLORE DROP
                </Link>
                <Link to="/feed" className="bg-slate-900 hover:bg-slate-800 text-blue-400 font-bold px-8 py-4 rounded-xl border border-blue-500/30 transition-all text-xs uppercase tracking-widest">
                  SOCIAL FEED
                </Link>
              </div>
            </div>

            {/* Showcase Image Frame */}
            <div className="relative z-10 w-full md:w-auto flex justify-center">
              <div className="relative w-56 h-56 md:w-64 md:h-64 rounded-2xl bg-slate-900 border border-slate-800 p-3 flex items-center justify-center shadow-2xl group hover:border-orange-500/50 transition-all bg-white/5">
                <span className="absolute top-3 left-3 z-20 px-2.5 py-1 bg-slate-950/90 backdrop-blur-md text-[10px] font-mono text-blue-400 border border-blue-500/30 rounded-md">
                  FEATURED_ITEM
                </span>
                <img 
                  src={featuredProduct ? featuredProduct.image_url : '/streetbook_logo.png'} 
                  alt="Featured Drop" 
                  className={`w-full h-full rounded-xl group-hover:scale-105 transition-transform duration-300 ${featuredProduct ? 'object-contain mix-blend-screen' : 'object-cover'}`} 
                />
              </div>
            </div>
          </div>
        )})()}

        

        {/* --- SKELETON LOADING GRID --- */}
        {loading && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col animate-pulse">
                <div className="p-4 bg-slate-200 aspect-square w-full" />
                <div className="p-4 flex flex-col gap-3 flex-1">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                  <div className="h-6 bg-slate-200 rounded w-1/3 mt-2" />
                  <div className="h-8 bg-slate-200 rounded-full w-full mt-auto" />
                </div>
              </div>
            ))}
          </div>
        )}
        {error && <div className="bg-red-100 border border-red-300 text-red-700 p-4 rounded-xl font-bold text-center mb-8">⚠️ Error: {error}</div>}

        {!loading && !error && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredProducts.map((product) => (
              <div key={product.sku} className="bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col group hover:shadow-lg transition-shadow">
                <Link to={`/product/${product.sku}`} className="p-4 flex items-center justify-center bg-slate-50 aspect-square cursor-pointer">
                  <img src={product.image_url} alt={product.title} className="w-full h-full object-contain mix-blend-multiply group-hover:scale-105 transition-transform" />
                </Link>
                <div className="p-4 flex flex-col flex-1">
                  <Link to={`/product/${product.sku}`}>
                    <h2 className="text-slate-900 font-medium line-clamp-2 leading-snug hover:text-orange-600 cursor-pointer">{product.title}</h2>
                  </Link>
                  <div className="flex items-start mt-2">
                    <span className="text-xs font-medium text-slate-900 mt-1">$</span>
                    <span className="text-2xl font-black text-slate-900">{Math.floor(product.price)}</span>
                    <span className="text-xs font-medium text-slate-900 mt-1">{(product.price % 1).toFixed(2).substring(2)}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-2 font-mono uppercase tracking-wider">
                    {product.in_stock ? '🟢 Authentic Drop' : '🔴 Sold Out'}
                  </div>
                  {!product.in_stock && <span className="text-red-600 text-xs font-bold mt-1">Currently unavailable.</span>}
                  <div className="mt-auto pt-4">
                    <button 
                      disabled={!product.in_stock}
                      onClick={() => addToCart(product)}
                      className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-black uppercase tracking-wider py-3 rounded-xl shadow-sm transition-all active:scale-95"
                    >
                      {product.in_stock ? 'Add to cart' : 'Out of Stock'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            
            {filteredProducts.length === 0 && (
              <div className="col-span-full py-10 text-center text-slate-500">
                No products found matching your search criteria.
              </div>
            )}
          </div>
        )}

        {/* Floating Admin Support Button & Modal */}
        {currentUser && currentUser.username !== 'admin' && (
          <>
            <button 
              onClick={() => setIsSupportOpen(!isSupportOpen)}
              className="fixed bottom-20 right-6 bg-cyan-600 text-white w-14 h-14 rounded-full shadow-2xl hover:bg-cyan-500 hover:scale-110 transition-transform z-50 flex items-center justify-center border-2 border-white"
              title="Chat with Operator"
            >
              <i className={`fa-solid ${isSupportOpen ? 'fa-xmark' : 'fa-headset'} text-2xl`}></i>
            </button>

            {/* Support Widget Modal */}
            <div className={`fixed bottom-40 right-6 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col transform transition-all duration-300 origin-bottom-right ${isSupportOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}>
              <div className="bg-slate-900 text-white p-4 flex gap-3 items-center">
                <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-sm"><i className="fa-solid fa-robot"></i></div>
                <div>
                  <h3 className="font-black text-sm leading-tight">Operator Support</h3>
                  <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">Online</span>
                </div>
              </div>
              
              <div className="p-4 bg-slate-50 h-48 overflow-y-auto flex flex-col gap-3">
                <div className="bg-slate-200 p-3 rounded-xl rounded-tl-sm self-start max-w-[85%] text-slate-800 text-xs font-medium leading-relaxed">
                  Yo @{currentUser.username}! Need help with tracking an order or sourcing a specific drop? Leave a message and our team will get right back to you.
                </div>
              </div>
              
              <form onSubmit={handleSendSupport} className="p-3 border-t border-slate-100 bg-white flex gap-2">
                <input 
                  type="text" 
                  value={supportMsg} 
                  onChange={(e) => setSupportMsg(e.target.value)}
                  placeholder="Type your message..." 
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                  required
                />
                <button disabled={isSendingSupport} type="submit" className="bg-cyan-600 text-white w-10 rounded-xl hover:bg-cyan-700 disabled:opacity-50 flex items-center justify-center shadow-sm">
                  {isSendingSupport ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-paper-plane"></i>}
                </button>
              </form>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
