import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

export default function Admin() {
  const navigate = useNavigate();
  const [token, setToken] = useState(localStorage.getItem('pidrop_token'));

  // --- DASHBOARD STATE ---
  const [activeTab, setActiveTab] = useState('dashboard');
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

  // ==========================================
  // API FETCHING LOGIC
  // ==========================================
  const fetchData = async () => {
    try {
      const [ordersRes, productsRes, feedRes, promosRes, usersRes] = await Promise.all([
        fetch(`${API_BASE}/orders`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/products`),
        fetch(`${API_BASE}/listings/feed`),
        fetch(`${API_BASE}/admin/promos`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/admin/users`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (ordersRes.status === 401) return handleLogout();

      setOrders(await ordersRes.json());
      setProducts(await productsRes.json());
      setSocialFeed(await feedRes.json());
      setPromos(promosRes.ok ? await promosRes.json() : []);
      setUsers(usersRes.ok ? await usersRes.json() : []);
    } catch (err) {
      console.error("Error fetching data:", err);
    }
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

  const handleDeleteListing = async (id) => {
    if (window.confirm(`Delete this user listing?`)) {
      try {
        const response = await fetch(`${API_BASE}/admin/listings/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to delete listing');
        toast.success(`Listing removed from feed.`);
        fetchData(); 
      } catch (err) { toast.error(err.message); }
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
      
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl z-10">
        <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-center gap-3">
          <img src="/sb.png" alt="101 Token" className="h-10 w-10 object-cover rounded-full shadow-lg" />
          <span className="text-xl font-black text-white tracking-tight uppercase">Admin Console</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => navigate('/')} className="w-full text-left px-4 py-3 rounded-xl font-bold transition-all text-cyan-400 hover:bg-slate-800 hover:text-cyan-300 mb-4 border border-slate-700/50 bg-slate-800/50">
            🏪 Back to Storefront
          </button>
          <button onClick={() => setActiveTab('dashboard')} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'dashboard' ? 'bg-cyan-500/10 text-cyan-400' : 'hover:bg-slate-800 hover:text-white'}`}>
            📊 Dashboard
          </button>
          <button onClick={() => setActiveTab('orders')} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'orders' ? 'bg-orange-500/10 text-orange-500' : 'hover:bg-slate-800 hover:text-white'} flex justify-between items-center`}>
            <span>📦 Orders</span>
            {pendingOrdersCount > 0 && <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">{pendingOrdersCount}</span>}
          </button>
          <button onClick={() => setActiveTab('products')} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'products' ? 'bg-orange-500/10 text-orange-500' : 'hover:bg-slate-800 hover:text-white'}`}>
            🏷️ Products
          </button>
          <button onClick={() => setActiveTab('social')} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'social' ? 'bg-purple-500/10 text-purple-400' : 'hover:bg-slate-800 hover:text-white'}`}>
            👥 Social Feed
          </button>
          <button onClick={() => setActiveTab('promos')} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'promos' ? 'bg-emerald-500/10 text-emerald-400' : 'hover:bg-slate-800 hover:text-white'}`}>
            🎟️ Promos
          </button>
          <button onClick={() => setActiveTab('community')} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'community' ? 'bg-blue-500/10 text-blue-400' : 'hover:bg-slate-800 hover:text-white'}`}>
            🌍 Community
          </button>
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button onClick={handleLogout} className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg transition-all text-sm">
            Log Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto relative">
        
        {/* --- DASHBOARD VIEW --- */}
        {activeTab === 'dashboard' && (
          <div className="animate-fade-in">
            <header className="mb-8">
              <h1 className="text-3xl font-black text-slate-900">Command Center</h1>
              <p className="text-slate-500 mt-1 font-medium">High-level storefront metrics.</p>
            </header>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <div className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">Total Revenue</div>
                <div className="text-4xl font-black text-slate-900">${totalRevenue.toFixed(2)}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <div className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">Pending Orders</div>
                <div className="text-4xl font-black text-orange-500">{pendingOrdersCount}</div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <div className="text-slate-500 text-sm font-bold uppercase tracking-wider mb-2">Total Products</div>
                <div className="text-4xl font-black text-cyan-600">{products.length}</div>
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

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-sm text-slate-600">
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

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-sm text-slate-600">
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
              <p className="text-slate-500 mt-1 font-medium">Monitor and remove peer-to-peer vendor listings.</p>
            </header>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-800 uppercase text-xs font-black tracking-wider">
                  <tr>
                    <th className="px-6 py-5">User</th>
                    <th className="px-6 py-5">Listing Details</th>
                    <th className="px-6 py-5">Price</th>
                    <th className="px-6 py-5 text-right">Kill Switch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {socialFeed.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img src={item.user_avatar} alt={item.username} className="w-8 h-8 rounded-full border border-slate-200" />
                          <span className="font-bold text-slate-900">@{item.username}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 flex items-center gap-4">
                        <img src={item.image_url} alt={item.title} className="w-12 h-12 rounded-lg object-cover border border-slate-200 bg-slate-100" />
                        <div>
                          <div className="font-bold text-slate-900 text-base">{item.title}</div>
                          <div className="text-xs text-slate-500 truncate w-48">{item.description}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-black text-slate-900 text-base">${item.price.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end">
                          <button onClick={() => handleDeleteListing(item.id)} className="bg-red-50 hover:bg-red-500 text-red-500 hover:text-white px-4 py-2 rounded-lg transition-all font-bold text-xs uppercase tracking-wider flex items-center gap-2">
                            <i className="fa-solid fa-trash"></i> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {socialFeed.length === 0 && (
                <div className="text-center py-20 text-slate-400 font-medium">No user listings currently active.</div>
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
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-sm text-slate-600">
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

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-sm text-slate-600">
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

    </div>
  );
}
