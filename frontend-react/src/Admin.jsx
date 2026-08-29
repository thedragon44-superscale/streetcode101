import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

export default function Admin() {
  const navigate = useNavigate();
  const [token, setToken] = useState(localStorage.getItem('pidrop_token'));

  // --- DASHBOARD STATE ---
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [socialFeed, setSocialFeed] = useState([]);
  const [promos, setPromos] = useState([]);
  const [users, setUsers] = useState([]);
  const [orderFilter, setOrderFilter] = useState('all');

  // --- PROMO GENERATION STATE ---
  const [baseWord, setBaseWord] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [isGeneratingPromo, setIsGeneratingPromo] = useState(false);

  // --- ADMIN EMAIL MODAL STATE ---
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailTarget, setEmailTarget] = useState(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // --- MODAL STATE ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cjSku, setCjSku] = useState('');
  const [editingProduct, setEditingProduct] = useState({
    sku: '', title: '', price: '', description: '', category: ''
  });

  // --- DELETE POST MODAL STATE ---
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [postToDelete, setPostToDelete] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeletingPost, setIsDeletingPost] = useState(false);

  const [analytics, setAnalytics] = useState({ total_circulation: 0, escrow_liability: 0, total_revenue_usd: 0 });

  // ==========================================
  // API FETCHING LOGIC
  // ==========================================
  const fetchData = async () => {
    try {
      const [ordersRes, productsRes, feedRes, promosRes, usersRes, analyticsRes] = await Promise.all([
        fetch(`${API_BASE}/orders`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/products`),
        fetch(`${API_BASE}/posts/feed`),
        fetch(`${API_BASE}/admin/promos`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/admin/users`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/admin/analytics`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (ordersRes.status === 401) return handleLogout();

      setOrders(await ordersRes.json());
      setProducts(await productsRes.json());
      setSocialFeed(await feedRes.json());
      setPromos(promosRes.ok ? await promosRes.json() : []);
      setUsers(usersRes.ok ? await usersRes.json() : []);
      setAnalytics(analyticsRes.ok ? await analyticsRes.json() : { total_circulation: 0, escrow_liability: 0, total_revenue_usd: 0 });
      
      const cashoutsRes = await fetch(`${API_BASE}/admin/cashouts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (cashoutsRes.ok) setCashouts(await cashoutsRes.json());
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  const [cashouts, setCashouts] = useState([]);

  const fetchCashouts = async () => {
    const res = await fetch(`${API_BASE}/admin/cashouts`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) setCashouts(await res.json());
  };

  // ==========================================
  // PROMO HANDLERS
  // ==========================================
  const handleGeneratePromo = async (e) => {
    e.preventDefault();
    if (!baseWord || !discountPercent) return;
    setIsGeneratingPromo(true);
    try {
      const res = await fetch(`${API_BASE}/admin/promos`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_word: baseWord, discount_percent: parseFloat(discountPercent) })
      });
      if (!res.ok) throw new Error('Failed to generate promo');
      const data = await res.json();
      setPromos([data, ...promos]);
      setBaseWord('');
      setDiscountPercent('');
      toast.success(`Generated: ${data.code}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsGeneratingPromo(false);
    }
  };

  const handleTogglePromo = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/admin/promos/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to toggle promo');
      const data = await res.json();
      setPromos(promos.map(p => p.id === id ? data.promo : p));
      toast.success(data.message);
    } catch (err) {
      toast.error(err.message);
    }
  };

  useEffect(() => {
    const currentToken = localStorage.getItem('pidrop_token');
    if (!currentToken) return navigate('/login');

    fetch(`${API_BASE}/profile/me`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Auth failed');
        return res.json();
      })
      .then(data => {
        if (data.username !== 'admin') navigate('/');
        else fetchData();
      })
      .catch(() => {
        localStorage.removeItem('pidrop_token');
        navigate('/login');
      });
  }, [navigate]);

  // ==========================================
  // METRICS CALCULATIONS
  // ==========================================
  const totalRevenue = orders.reduce((sum, order) => {
    const prod = products.find(p => p.sku === order.sku);
    return sum + (prod ? prod.price * order.quantity : 0);
  }, 0);

  const pendingOrdersCount = orders.filter(o => o.status === 'processing').length;
  const filteredOrders = orderFilter === 'all' ? orders : orders.filter(o => o.status === orderFilter);

  // ==========================================
  // EVENT HANDLERS
  // ==========================================
  const handleUpdateUserDiscount = async (username, newDiscount) => {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${username}/discount`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ discount_percent: parseFloat(newDiscount) })
      });
      if (!res.ok) throw new Error('Failed to update discount');
      toast.success(`Updated discount for @${username}`);
      fetchData();
    } catch (err) { toast.error(err.message); }
  };

  const handleSendAdminEmail = async (e) => {
    e.preventDefault();
    if (!emailSubject || !emailBody) return;
    setIsSendingEmail(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users/${emailTarget.username}/email`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: emailSubject, body: emailBody })
      });
      if (!res.ok) throw new Error('Failed to dispatch email');
      toast.success('Email dispatched successfully.');
      setIsEmailModalOpen(false);
      setEmailSubject('');
      setEmailBody('');
    } catch (err) { toast.error(err.message); } finally { setIsSendingEmail(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem('pidrop_token');
    setToken(null);
    navigate('/login');
  };

  const handleEditProduct = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE}/admin/products/${editingProduct.sku}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProduct)
      });
      if (!response.ok) throw new Error('Failed to update product');
      toast.success('Product updated successfully!');
      fetchData(); 
      setIsEditModalOpen(false);
    } catch (err) { toast.error(err.message); }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const response = await fetch(`${API_BASE}/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (response.status === 401) return handleLogout();
      if (!response.ok) throw new Error('Failed to update status');
      toast.success(`Order #${orderId} status updated!`);
      fetchData(); 
      if (newStatus === 'shipped') setTimeout(fetchData, 4000);
    } catch (err) { toast.error(err.message); }
  };

  const handleDeleteProduct = async (sku) => {
    if (window.confirm(`Are you sure you want to delete ${sku}? This is permanent.`)) {
      try {
        const response = await fetch(`${API_BASE}/products/${sku}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to delete product');
        toast.success(`Product ${sku} deleted.`);
        fetchData(); 
      } catch (err) { toast.error(err.message); }
    }
  };

  const handleToggleFeatured = async (sku) => {
    try {
      const response = await fetch(`${API_BASE}/admin/products/${sku}/featured`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to set featured product');
      toast.success(`Featured drop updated!`);
      fetchData();
    } catch (err) { toast.error(err.message); }
  };

  const handleDeletePostClick = (id, username, titleOrDesc) => {
    setPostToDelete({ id, username, titleOrDesc });
    setDeleteReason('');
    setIsDeleteModalOpen(true);
  };

  const confirmDeletePost = async (e) => {
    e.preventDefault();
    if (!deleteReason.trim()) return toast.error('You must provide a reason to notify the user.');
    setIsDeletingPost(true);

    try {
      // 1. Delete the post
      const delRes = await fetch(`${API_BASE}/posts/${postToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!delRes.ok) throw new Error('Failed to delete post');

      // 2. Automatically notify the user
      const snippet = postToDelete.titleOrDesc.length > 30 ? postToDelete.titleOrDesc.substring(0, 30) + '...' : postToDelete.titleOrDesc;
      const emailBody = `Yo @${postToDelete.username},\n\nYour recent post ("${snippet}") was removed from the community timeline by a moderator.\n\nReason: ${deleteReason}\n\nPlease review the community guidelines.`;
      
      await fetch(`${API_BASE}/admin/users/${postToDelete.username}/email`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: '⚠️ Post Removed by Moderator', body: emailBody })
      });

      toast.success(`Post deleted and @${postToDelete.username} was notified.`);
      setIsDeleteModalOpen(false);
      fetchData(); 
    } catch (err) { 
      toast.error(err.message); 
    } finally {
      setIsDeletingPost(false);
    }
  };
  const handleResyncAll = async () => {
    if (!window.confirm("Are you sure? This will update all products.")) return;
    setIsSyncing(true);
    try {
      const response = await fetch(`${API_BASE}/admin/resync-all-variants`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to resync');
      toast.success(data.message);
      fetchData();
    } catch (err) { toast.error(err.message); } finally { setIsSyncing(false); }
  };

  const handleSyncCJ = async () => {
    if (!cjSku.trim()) return toast.error('Please enter a CJ SKU first!');
    setIsSyncing(true);
    try {
      const response = await fetch(`${API_BASE}/admin/sync-cj`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: cjSku })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to sync with CJ');
      toast.success(data.message);
      setCjSku(''); 
      fetchData(); 
      if (data.product) {
        setEditingProduct(data.product);
        setIsEditModalOpen(true);
      }
    } catch (err) { toast.error(err.message); } finally { setIsSyncing(false); }
  };

  if (!token) return null;

  return (
    <div className="h-screen bg-slate-50 flex flex-col md:flex-row font-sans overflow-hidden">
      
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] md:hidden transition-opacity" 
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out z-[100] w-64 bg-[#0f1115] text-slate-300 flex flex-col shadow-2xl border-r border-slate-800/50`}>
        <div className="p-6 bg-[#0f1115] flex items-center justify-between gap-3 pt-8 pb-6">
          <div className="flex items-center gap-3">
            <img src="/sb.png" alt="101 Token" className="h-8 w-8 object-cover rounded-full shadow-lg" />
            <span className="text-lg font-black text-white tracking-tight uppercase">Console</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white text-xl">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
        
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto pb-10">
          <button onClick={() => { navigate('/'); setIsMobileMenuOpen(false); }} className="w-full text-left px-4 py-3 rounded-full font-bold transition-all text-slate-300 hover:bg-white/5 hover:text-white mb-6 border border-slate-700/50 flex items-center gap-3 text-sm shadow-sm">
            <i className="fa-solid fa-store w-5 text-center"></i> Storefront
          </button>

          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 mb-2 mt-4">Overview</div>
          <button onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 rounded-full font-bold transition-all flex items-center gap-3 text-sm ${activeTab === 'dashboard' ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
            <i className="fa-solid fa-chart-pie w-5 text-center"></i> Dashboard
          </button>

          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 mb-2 mt-6">Commerce</div>
          <button onClick={() => { setActiveTab('orders'); setIsMobileMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 rounded-full font-bold transition-all flex justify-between items-center text-sm ${activeTab === 'orders' ? 'bg-orange-500/10 text-orange-400' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
            <div className="flex items-center gap-3"><i className="fa-solid fa-box-open w-5 text-center"></i> Orders</div>
            {pendingOrdersCount > 0 && <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full">{pendingOrdersCount}</span>}
          </button>
          <button onClick={() => { setActiveTab('products'); setIsMobileMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 rounded-full font-bold transition-all flex items-center gap-3 text-sm ${activeTab === 'products' ? 'bg-orange-500/10 text-orange-400' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
            <i className="fa-solid fa-tags w-5 text-center"></i> Products
          </button>
          <button onClick={() => { setActiveTab('cashouts'); setIsMobileMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 rounded-full font-bold transition-all flex justify-between items-center text-sm ${activeTab === 'cashouts' ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
            <div className="flex items-center gap-3"><i className="fa-solid fa-money-bill-transfer w-5 text-center"></i> Cashouts</div>
            {cashouts.filter(c => c.status === 'pending').length > 0 && <span className="bg-emerald-500 text-slate-900 text-[10px] font-black px-2 py-0.5 rounded-full">{cashouts.filter(c => c.status === 'pending').length}</span>}
          </button>

          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 mb-2 mt-6">Community</div>
          <button onClick={() => { setActiveTab('social'); setIsMobileMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 rounded-full font-bold transition-all flex items-center gap-3 text-sm ${activeTab === 'social' ? 'bg-purple-500/10 text-purple-400' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
            <i className="fa-solid fa-users-viewfinder w-5 text-center"></i> Social Feed
          </button>
          <button onClick={() => { setActiveTab('community'); setIsMobileMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 rounded-full font-bold transition-all flex items-center gap-3 text-sm ${activeTab === 'community' ? 'bg-blue-500/10 text-blue-400' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
            <i className="fa-solid fa-globe w-5 text-center"></i> Roster
          </button>
          
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4 mb-2 mt-6">Marketing</div>
          <button onClick={() => { setActiveTab('promos'); setIsMobileMenuOpen(false); }} className={`w-full text-left px-4 py-2.5 rounded-full font-bold transition-all flex items-center gap-3 text-sm ${activeTab === 'promos' ? 'bg-pink-500/10 text-pink-400' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
            <i className="fa-solid fa-ticket w-5 text-center"></i> Promos
          </button>
        </nav>
        
        <div className="p-4 bg-[#0f1115] border-t border-slate-800/50">
          <button onClick={handleLogout} className="w-full px-4 py-3 hover:bg-white/5 text-slate-400 hover:text-white font-bold rounded-full transition-all text-sm flex items-center justify-center gap-2">
            <i className="fa-solid fa-arrow-right-from-bracket"></i> Log Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative bg-slate-50 h-screen">
        
        {/* Mobile Navbar Header */}
        <div className="md:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <img src="/sb.png" alt="Logo" className="w-8 h-8 rounded-full" />
            <span className="font-black text-slate-900 tracking-tight uppercase">Admin</span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(true)} 
            className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center text-slate-700 transition-colors"
          >
            <i className="fa-solid fa-bars"></i>
          </button>
        </div>

        {/* Content Wrapper */}
        <div className="p-4 md:p-8 pb-24">
        
        {/* --- DASHBOARD VIEW --- */}
        {activeTab === 'dashboard' && (
          <div className="animate-fade-in">
            <header className="mb-8">
              <h1 className="text-3xl font-black text-slate-900">Command Center</h1>
              <p className="text-slate-500 mt-1 font-medium">High-level storefront and economy metrics.</p>
            </header>
            
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Storefront Operations</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-bl-full"></div>
                <div className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">Storefront Sales (Gross)</div>
                <div className="text-4xl font-black text-slate-900">${totalRevenue.toFixed(2)}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <div className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">Fulfillment Queue</div>
                <div className="text-4xl font-black text-orange-500">{pendingOrdersCount} <span className="text-sm text-slate-400">pending</span></div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <div className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">Active Catalog</div>
                <div className="text-4xl font-black text-cyan-600">{products.length} <span className="text-sm text-slate-400">products</span></div>
              </div>
            </div>

            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Digital Economy Health</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-md flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-500/20 rounded-bl-full"></div>
                <div className="text-cyan-500 text-sm font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><i className="fa-solid fa-coins"></i> Circulating StreetCoin</div>
                <div className="text-4xl font-black text-white">{analytics.total_circulation.toFixed(2)} <span className="text-lg text-slate-500">SC</span></div>
              </div>
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-md flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-orange-500/20 rounded-bl-full"></div>
                <div className="text-orange-400 text-sm font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><i className="fa-solid fa-lock"></i> Locked in Escrow</div>
                <div className="text-4xl font-black text-white">{analytics.escrow_liability.toFixed(2)} <span className="text-lg text-slate-500">SC</span></div>
              </div>
              <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-200 shadow-sm flex flex-col justify-center">
                <div className="text-emerald-700 text-sm font-bold uppercase tracking-wider mb-2 flex items-center gap-2"><i className="fa-solid fa-sack-dollar"></i> Platform Tax Revenue (5%)</div>
                <div className="text-4xl font-black text-emerald-600">${analytics.total_revenue_usd.toFixed(2)} <span className="text-lg text-emerald-400">USD</span></div>
              </div>
            </div>
          </div>
        )}

        {/* --- ORDERS VIEW --- */}
        {activeTab === 'orders' && (
          <div className="animate-fade-in">
            <header className="mb-6 flex flex-col md:flex-row md:justify-between md:items-end gap-4">
              <div>
                <h1 className="text-3xl font-black text-slate-900">Order Ledger</h1>
                <p className="text-slate-500 mt-1 font-medium">Manage and fulfill customer orders.</p>
              </div>
              <div className="flex bg-slate-200 p-1 rounded-xl">
                {['all', 'processing', 'shipped', 'cancelled'].map(status => (
                  <button 
                    key={status} 
                    onClick={() => setOrderFilter(status)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${orderFilter === status ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </header>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-800 uppercase text-xs font-black tracking-wider">
                  <tr>
                    <th className="px-6 py-5">Order ID</th>
                    <th className="px-6 py-5">Customer Details</th>
                    <th className="px-6 py-5">Item (SKU)</th>
                    <th className="px-6 py-5">Status & Tracking</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-black text-slate-900 text-base">#{order.id}</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">{order.customer_email}</div>
                        <div className="text-xs text-slate-500 mt-1 leading-relaxed max-w-[200px]">{order.shipping_address}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded inline-block font-bold border border-slate-200 mb-2">{order.sku}</div>
                        <div className="text-xs font-black text-slate-500 bg-slate-100 w-fit px-2 py-0.5 rounded-full">Qty: {order.quantity}</div>
                      </td>
                      <td className="px-6 py-4">
                        <select 
                          className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-2 focus:ring-orange-500 block w-full p-2.5 font-bold cursor-pointer shadow-sm" 
                          defaultValue={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                        >
                          <option value="processing">⏳ Processing</option>
                          <option value="shipped">📦 Shipped</option>
                          <option value="cancelled">🚫 Cancelled</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredOrders.length === 0 && (
                <div className="text-center py-20 text-slate-400 font-medium">No orders found for this filter.</div>
              )}
            </div>
          </div>
        )}

        {/* --- PRODUCTS VIEW --- */}
        {activeTab === 'products' && (
          <div className="animate-fade-in">
            <header className="mb-8 flex justify-between items-end">
              <div>
                <h1 className="text-3xl font-black text-slate-900">Inventory</h1>
                <p className="text-slate-500 mt-1 font-medium">Manage your storefront products.</p>
              </div>
              <div className="flex gap-3">
                <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
                  <input 
                    type="text" 
                    value={cjSku}
                    onChange={(e) => setCjSku(e.target.value)}
                    placeholder="Enter CJ SKU..."
                    className="px-3 py-2 border-none text-sm focus:ring-0 font-medium w-48 bg-transparent text-slate-700 placeholder-slate-400 uppercase tracking-wider"
                  />
                  <button onClick={handleSyncCJ} disabled={isSyncing} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold px-6 py-2 rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 text-xs tracking-widest uppercase">
                    {isSyncing ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-cloud-arrow-down"></i>}
                    Import SKU
                  </button>
                </div>
              </div>
            </header>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-800 uppercase text-xs font-black tracking-wider">
                  <tr>
                    <th className="px-6 py-5">Product Info</th>
                    <th className="px-6 py-5">SKU</th>
                    <th className="px-6 py-5">Price (Margin)</th>
                    <th className="px-6 py-5">Status</th>
                    <th className="px-6 py-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((product) => {
                    // Calculate Profit Margin based on your 2.5x markup model
                    const baseCost = product.price / 2.5;
                    const profit = product.price - baseCost;

                    return (
                      <tr key={product.sku} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 flex items-center gap-4">
                          <button 
                            onClick={() => handleToggleFeatured(product.sku)}
                            className={`text-xl transition-all hover:scale-125 ${product.is_featured ? 'text-yellow-400 drop-shadow-md' : 'text-slate-300 hover:text-yellow-200'}`}
                            title="Set as Featured Drop"
                          >
                            <i className="fa-solid fa-crown"></i>
                          </button>
                          <img src={product.image_url} alt={product.title} className="w-12 h-12 rounded-lg object-cover border border-slate-200 bg-slate-100" />
                          <button onClick={() => { setEditingProduct(product); setIsEditModalOpen(true); }} className="font-bold text-slate-900 text-base hover:text-orange-500 hover:underline text-left transition-colors">
                            {product.title}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded font-bold border border-slate-200">{product.sku}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-black text-slate-900 text-base">${product.price.toFixed(2)}</div>
                          <div className="text-xs font-bold text-emerald-600 mt-0.5">
                            +${profit.toFixed(2)} Profit
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${product.in_stock ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-red-500'}`}></span>
                            <span className={`text-xs font-black uppercase tracking-widest ${product.in_stock ? 'text-emerald-600' : 'text-red-600'}`}>
                              {product.in_stock ? 'Active' : 'Empty'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end">
                            <button onClick={() => handleDeleteProduct(product.sku)} className="text-slate-300 hover:text-red-500 hover:bg-red-50 w-8 h-8 rounded-lg transition-all flex items-center justify-center active:scale-90" title="Delete Product">
                              <i className="fa-solid fa-xmark text-lg"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {products.length === 0 && (
                <div className="text-center py-20 text-slate-400 font-medium">No products in inventory.</div>
              )}
            </div>

            {products.length > 0 && (
              <div className="mt-8 flex justify-end">
                <button onClick={handleResyncAll} disabled={isSyncing} className="bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white font-mono text-xs font-bold uppercase tracking-widest px-6 py-3 rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 border border-slate-800">
                  {isSyncing ? <i className="fa-solid fa-circle-notch fa-spin"></i> : <i className="fa-solid fa-rotate-right"></i>}
                  {isSyncing ? 'SYNCING...' : 'RESYNC ALL VARIANTS'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* --- SOCIAL FEED MODERATION VIEW --- */}
        {activeTab === 'social' && (
          <div className="animate-fade-in">
            <header className="mb-8">
              <h1 className="text-3xl font-black text-slate-900">Feed Moderation</h1>
              <p className="text-slate-500 mt-1 font-medium">Monitor and remove posts from the community timeline.</p>
            </header>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-800 uppercase text-xs font-black tracking-wider">
                  <tr>
                    <th className="px-6 py-5">User</th>
                    <th className="px-6 py-5">Post Type</th>
                    <th className="px-6 py-5">Content Snapshot</th>
                    <th className="px-6 py-5 text-right">Kill Switch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {socialFeed.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={item.user_avatar} alt={item.username} className="w-8 h-8 rounded-full border border-slate-200 object-cover" />
                          <span className="font-bold text-slate-900">@{item.username}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${item.post_type === 'vendor_drop' ? 'bg-orange-100 text-orange-700' : item.post_type === 'image' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-700'}`}>
                          {item.post_type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 flex items-center gap-4">
                        {item.post_type !== 'text' && item.image_url && (
                          <img src={item.image_url} alt="Post media" className="w-10 h-10 rounded-lg object-cover border border-slate-200 bg-slate-100 flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          {item.title && <div className="font-bold text-slate-900 text-sm truncate w-48">{item.title}</div>}
                          <div className="text-xs text-slate-500 truncate w-48">{item.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end">
                          <button onClick={() => handleDeletePostClick(item.id, item.username, item.title || item.description)} className="bg-red-50 hover:bg-red-500 text-red-500 hover:text-white px-4 py-2 rounded-lg transition-all font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm">
                            <i className="fa-solid fa-trash"></i> Delete & Notify
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {socialFeed.length === 0 && (
                <div className="text-center py-20 text-slate-400 font-medium">No posts currently active in the timeline.</div>
              )}
            </div>
          </div>
        )}

        {/* --- PROMOS VIEW --- */}
        {activeTab === 'promos' && (
          <div className="animate-fade-in">
            <header className="mb-8">
              <h1 className="text-3xl font-black text-slate-900">Promo Engine</h1>
              <p className="text-slate-500 mt-1 font-medium">Generate and manage secure 16-digit discount codes.</p>
            </header>

            {/* Generator Form */}
            <form onSubmit={handleGeneratePromo} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8 flex flex-col md:flex-row gap-4 items-end">
              <div className="w-full md:w-1/2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">Base Word (Max 10)</label>
                <input 
                  type="text" 
                  maxLength="10"
                  required 
                  value={baseWord}
                  onChange={(e) => setBaseWord(e.target.value.toUpperCase())}
                  placeholder="e.g. WINTER" 
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 font-mono text-sm uppercase" 
                />
              </div>
              <div className="w-full md:w-1/4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">Discount %</label>
                <input 
                  type="number" 
                  min="1" 
                  max="100"
                  required 
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  placeholder="15" 
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 font-mono text-sm" 
                />
              </div>
              <div className="w-full md:w-1/4">
                <button 
                  type="submit" 
                  disabled={isGeneratingPromo || !baseWord || !discountPercent}
                  className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-black py-3 px-4 rounded-xl shadow-md transition-all active:scale-[0.98] uppercase tracking-wider h-[46px] whitespace-nowrap"
                >
                  {isGeneratingPromo ? 'Generating...' : 'Generate Key'}
                </button>
              </div>
            </form>

            {/* Promos Ledger */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-800 uppercase text-xs font-black tracking-wider">
                  <tr>
                    <th className="px-6 py-5">Access Code</th>
                    <th className="px-6 py-5">Discount</th>
                    <th className="px-6 py-5">Usages</th>
                    <th className="px-6 py-5">Status</th>
                    <th className="px-6 py-5 text-right">Kill Switch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {promos.map((promo) => (
                    <tr key={promo.id} className={`transition-colors ${promo.is_active ? 'hover:bg-slate-50' : 'bg-slate-50/50 opacity-75'}`}>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm bg-slate-100 text-slate-900 px-3 py-1.5 rounded-lg font-bold border border-slate-200">
                          {promo.code}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-black text-emerald-600 text-base">
                        {promo.discount_percent}% OFF
                      </td>
                      <td className="px-6 py-4 font-bold text-slate-700">
                        {promo.usage_count}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-xs font-black uppercase tracking-widest px-2 py-1 rounded-full ${promo.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {promo.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleTogglePromo(promo.id)} 
                          className={`w-12 h-6 rounded-full flex items-center p-1 transition-colors shadow-inner ${promo.is_active ? 'bg-emerald-500 justify-end' : 'bg-slate-400 justify-start'}`}
                        >
                          <div className="w-4 h-4 bg-white rounded-full shadow-md"></div>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {promos.length === 0 && (
                <div className="text-center py-20 text-slate-400 font-medium">No promo codes generated yet.</div>
              )}
            </div>
          </div>
        )}

        {/* --- COMMUNITY VIEW --- */}
        {activeTab === 'community' && (
          <div className="animate-fade-in">
            <header className="mb-8">
              <h1 className="text-3xl font-black text-slate-900">Community Roster</h1>
              <p className="text-slate-500 mt-1 font-medium">Manage registered accounts and VIP discounts.</p>
            </header>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-x-auto">
              <table className="w-full min-w-[700px] text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-800 uppercase text-xs font-black tracking-wider">
                  <tr>
                    <th className="px-6 py-5">User</th>
                    <th className="px-6 py-5">Email</th>
                    <th className="px-6 py-5">Base Vault Discount</th>
                    <th className="px-6 py-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 flex items-center gap-3">
                        <img src={user.profile_image_url} alt={user.username} className="w-8 h-8 rounded-full border border-slate-200 object-cover" />
                        <span className="font-bold text-slate-900">@{user.username}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-mono text-xs">{user.email}</td>
                      <td className="px-6 py-4">
                        <input 
                          type="number" 
                          min="0" max="100" 
                          defaultValue={user.discount_percent}
                          onBlur={(e) => {
                            if (e.target.value != user.discount_percent) handleUpdateUserDiscount(user.username, e.target.value);
                          }}
                          className="w-20 px-2 py-1 border border-slate-200 rounded text-slate-900 font-bold focus:border-orange-500 focus:outline-none"
                        /> <span className="text-xs font-bold text-slate-500">%</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => navigate(`/chat/${user.username}`)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold text-xs transition-colors">
                            Message
                          </button>
                          <button 
                            onClick={() => { setEmailTarget(user); setIsEmailModalOpen(true); }} 
                            className="bg-orange-50 hover:bg-orange-500 text-orange-600 hover:text-white px-3 py-1.5 rounded-lg font-bold text-xs transition-colors"
                          >
                            Email
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && (
                <div className="text-center py-20 text-slate-400 font-medium">No community members registered yet.</div>
              )}
            </div>
          </div>
        )}

        {/* --- CASHOUTS VIEW --- */}
        {activeTab === 'cashouts' && (
          <div className="animate-fade-in">
            <header className="mb-8">
              <h1 className="text-3xl font-black text-slate-900">Fiat Offramp Queue</h1>
              <p className="text-slate-500 mt-1 font-medium">Review and fulfill vendor cashout requests via Zelle.</p>
            </header>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6">
              {cashouts.length === 0 ? (
                <div className="text-center py-10 text-slate-400 font-medium">No pending cashouts.</div>
              ) : (
                <div className="space-y-4">
                  {cashouts.map(req => (
                    <div key={req.id} className="bg-slate-50 p-5 rounded-xl border border-slate-200 flex flex-col md:flex-row justify-between md:items-center gap-4">
                      <div>
                        <span className="text-orange-600 font-black uppercase text-sm block tracking-widest mb-1">@{req.username}</span>
                        <span className="text-slate-600 font-bold text-sm block">Zelle Contact: <span className="text-slate-900">{req.zelle_contact}</span></span>
                        <div className="text-emerald-600 font-black text-xl mt-2">${req.usd_payout.toFixed(2)} USD Payout</div>
                        <div className="text-slate-400 text-xs font-bold uppercase mt-1">Requested: {req.amount_coins.toFixed(2)} SC (5% Tax Applied)</div>
                      </div>
                      <div className="flex shrink-0">
                        {req.status === 'pending' ? (
                          <button 
                            onClick={async () => {
                              if (!window.confirm(`Did you successfully send $${req.usd_payout.toFixed(2)} to ${req.zelle_contact} via Zelle?`)) return;
                              try {
                                const res = await fetch(`${API_BASE}/admin/cashouts/${req.id}/approve`, {
                                  method: 'POST',
                                  headers: { 'Authorization': `Bearer ${token}` }
                                });
                                if (!res.ok) throw new Error("Failed to approve");
                                toast.success("Cashout fulfilled. Coins burned.");
                                fetchCashouts();
                              } catch (err) {
                                toast.error(err.message);
                              }
                            }}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-colors active:scale-95 shadow-sm"
                          >
                            Mark Fulfilled
                          </button>
                        ) : (
                          <span className="text-slate-400 font-black text-xs uppercase bg-slate-200 px-4 py-2 rounded-xl border border-slate-300">Fulfilled</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </main>

      {/* --- EDIT PRODUCT MODAL --- */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-xl font-black text-slate-900">Edit Product</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold text-xl p-2">✕</button>
            </div>
            
            <form onSubmit={handleEditProduct} className="p-6 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-2 flex items-center gap-3">
                <span className="text-2xl">🔒</span>
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase">Editing SKU</div>
                  <div className="font-mono font-black text-slate-800">{editingProduct.sku}</div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Title</label>
                <input required type="text" value={editingProduct.title} onChange={e => setEditingProduct({...editingProduct, title: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 font-medium" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cover Image URL</label>
                <input required type="text" value={editingProduct.image_url || ''} onChange={e => setEditingProduct({...editingProduct, image_url: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 font-medium text-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Price ($)</label>
                  <input required type="number" step="0.01" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Category</label>
                  <select required value={editingProduct.category} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 font-medium bg-white">
                    <option value="uncategorized">Uncategorized</option>
                    <option value="mens-clothing">Men's Clothing</option>
                    <option value="womens-clothing">Women's Clothing</option>
                    <option value="mens-shoes">Men's Shoes</option>
                    <option value="womens-shoes">Women's Shoes</option>
                    <option value="mens-jewelry">Men's Jewelry</option>
                    <option value="womens-jewelry">Women's Jewelry</option>
                    <option value="accessories">Accessories</option>
                    <option value="electronics">Electronics</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Description</label>
                <textarea required value={editingProduct.description} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 font-medium" rows="3"></textarea>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-3 rounded-xl shadow-lg transition-all active:scale-[0.98]">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DIRECT EMAIL MODAL --- */}
      {isEmailModalOpen && emailTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-xl font-black text-slate-900">Email @{emailTarget.username}</h2>
              <button onClick={() => setIsEmailModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold text-xl p-2">✕</button>
            </div>
            <form onSubmit={handleSendAdminEmail} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Subject</label>
                <input required type="text" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Message Body</label>
                <textarea required value={emailBody} onChange={e => setEmailBody(e.target.value)} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500" rows="5"></textarea>
              </div>
              <button type="submit" disabled={isSendingEmail} className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-black py-3 rounded-xl shadow-lg transition-all">
                {isSendingEmail ? 'Dispatching...' : 'Send Secure Email'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- DELETE POST MODAL --- */}
      {isDeleteModalOpen && postToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-xl font-black text-slate-900">Delete Post by @{postToDelete.username}</h2>
              <button onClick={() => setIsDeleteModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold text-xl p-2">✕</button>
            </div>
            <form onSubmit={confirmDeletePost} className="p-6 space-y-4">
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-bold border border-red-100">
                ⚠️ This will permanently delete the post and email the user.
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Reason for Deletion (Emailed to User)</label>
                <textarea required value={deleteReason} onChange={e => setDeleteReason(e.target.value)} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-red-500 font-medium" rows="3" placeholder="e.g. Violation of community guidelines regarding..."></textarea>
              </div>
              <button type="submit" disabled={isDeletingPost} className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-black py-3 rounded-xl shadow-lg transition-all active:scale-[0.98]">
                {isDeletingPost ? 'Deleting...' : 'Delete & Notify'}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
