import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

export default function Admin() {
  const navigate = useNavigate();
  // --- AUTHENTICATION STATE ---
  const [token, setToken] = useState(localStorage.getItem('pidrop_token'));

  // --- DASHBOARD STATE ---
  const [activeTab, setActiveTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);

  // --- MODAL STATE ---
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [cjSku, setCjSku] = useState('');
  const [newProduct, setNewProduct] = useState({
    sku: '', title: '', price: '', description: '', category: 'mens-clothing', in_stock: true, image: null
  });
  const [editingProduct, setEditingProduct] = useState({
    sku: '', title: '', price: '', description: '', category: ''
  });

  // ==========================================
  // API FETCHING LOGIC
  // ==========================================
  const fetchData = async () => {
    try {
      const [ordersRes, productsRes] = await Promise.all([
        fetch(`${API_BASE}/orders`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_BASE}/products`)
      ]);

      if (ordersRes.status === 401) {
        handleLogout(); // Token expired or invalid!
        return;
      }

      const ordersData = await ordersRes.json();
      const productsData = await productsRes.json();

      setOrders(ordersData);
      setProducts(productsData);
    } catch (err) {
      console.error("Error fetching data:", err);
    }
  };

  // Auth verification & Fetch real data from PostgreSQL
  useEffect(() => {
    const currentToken = localStorage.getItem('pidrop_token');
    
    if (!currentToken) {
      navigate('/login');
      return;
    }

    fetch(`${API_BASE}/profile/me`, {
      headers: { 'Authorization': `Bearer ${currentToken}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Auth failed');
        return res.json();
      })
      .then(data => {
        if (data.username !== 'admin') {
          navigate('/');
        } else {
          fetchData();
        }
      })
      .catch(() => {
        localStorage.removeItem('pidrop_token');
        navigate('/login');
      });
  }, [navigate]);

  // ==========================================
  // EVENT HANDLERS
  // ==========================================
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
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(editingProduct)
      });
      
      if (!response.ok) throw new Error('Failed to update product');
      toast.success('Product updated successfully!');
      fetchData(); 
      setIsEditModalOpen(false);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      const response = await fetch(`${API_BASE}/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.status === 401) return handleLogout();
      if (!response.ok) throw new Error('Failed to update status');

      toast.success(`Order #${orderId} status updated!`);
      fetchData(); // Refresh UI immediately
      
      // If shipped, Celery takes ~3s. Poll DB again after 4s to grab tracking!
      if (newStatus === 'shipped') {
        setTimeout(fetchData, 4000);
      }
    } catch (err) {
      toast.error(err.message);
    }
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
        fetchData(); // Refresh the table!
      } catch (err) {
        toast.error(err.message);
      }
    }
  };

  const handleResyncAll = async () => {
    if (!window.confirm("Are you sure? This will reach out to CJ and update all existing products with their latest variants.")) return;
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
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSyncing(false);
    }
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

      // Instantly pop open the edit modal for the newly imported product!
      if (data.product) {
        setEditingProduct(data.product);
        setIsEditModalOpen(true);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    
    // Prepare data for FastAPI & MinIO (Requires FormData!)
    const formData = new FormData();
    formData.append('sku', newProduct.sku);
    formData.append('title', newProduct.title);
    formData.append('price', newProduct.price);
    formData.append('description', newProduct.description);
    formData.append('category', newProduct.category);
    formData.append('in_stock', newProduct.in_stock);
    if (newProduct.image) {
      formData.append('file', newProduct.image); 
    }

    try {
      const response = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        // Note: Do NOT set Content-Type manually when using FormData! The browser sets it automatically with the file boundary.
        body: formData
      });
      
      if (response.status === 401) return handleLogout();
      if (!response.ok) throw new Error('Failed to upload product to backend');

      const addedProduct = await response.json();

      toast.success('Product successfully added to catalog!');
      fetchData(); // Refresh the table to show the real database entry!
      setNewProduct({ sku: '', title: '', price: '', description: '', category: 'mens-clothing', in_stock: true, image: null });
      setIsAddModalOpen(false);

      // Instantly pop open the edit modal!
      setEditingProduct(addedProduct);
      setIsEditModalOpen(true);
    } catch (err) { 
      toast.error(err.message); 
    }
  };


  // ==========================================
  // RENDER: SECURE ADMIN DASHBOARD
  // ==========================================
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
          <button onClick={() => setActiveTab('orders')} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'orders' ? 'bg-orange-500/10 text-orange-500' : 'hover:bg-slate-800 hover:text-white'}`}>
            📦 Orders
          </button>
          <button onClick={() => setActiveTab('products')} className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'products' ? 'bg-orange-500/10 text-orange-500' : 'hover:bg-slate-800 hover:text-white'}`}>
            🏷️ Products
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
        
        {/* --- ORDERS VIEW --- */}
        {activeTab === 'orders' && (
          <>
            <header className="mb-8 flex justify-between items-end">
              <div>
                <h1 className="text-3xl font-black text-slate-900">Order Ledger</h1>
                <p className="text-slate-500 mt-1 font-medium">Manage and fulfill customer orders.</p>
              </div>
              <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200 font-bold text-slate-700">
                Total Orders: <span className="text-orange-500">{orders.length}</span>
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
                  {orders.map((order) => (
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
                          className="bg-white border border-slate-200 text-slate-700 text-sm rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 block w-full p-2.5 font-bold cursor-pointer shadow-sm" 
                          defaultValue={order.status}
                          onChange={(e) => handleStatusChange(order.id, e.target.value)}
                        >
                          <option value="processing">⏳ Processing</option>
                          <option value="shipped">📦 Shipped</option>
                          <option value="cancelled">🚫 Cancelled</option>
                        </select>
                        {order.tracking_number && (
                          <div className="mt-2 text-xs font-black text-emerald-600 flex items-center gap-1 bg-emerald-50 w-fit px-2 py-1 rounded-md border border-emerald-100">
                            <span>↳</span> {order.tracking_number}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {orders.length === 0 && (
                <div className="text-center py-20 text-slate-400 font-medium">No orders found in the database.</div>
              )}
            </div>
          </>
        )}

        {/* --- PRODUCTS VIEW --- */}
        {activeTab === 'products' && (
          <>
            <header className="mb-8 flex justify-between items-end">
              <div>
                <h1 className="text-3xl font-black text-slate-900">Inventory</h1>
                <p className="text-slate-500 mt-1 font-medium">Manage your storefront products.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={handleResyncAll} disabled={isSyncing} className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50">
                  {isSyncing ? '🔄 Working...' : '🔄 Resync All Variants'}
                </button>
                <div className="flex items-center gap-2">
                  <input 
                    type="text" 
                    value={cjSku}
                    onChange={(e) => setCjSku(e.target.value)}
                    placeholder="Enter CJ SKU..."
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-cyan-500 font-medium w-36"
                  />
                  <button onClick={handleSyncCJ} disabled={isSyncing} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50">
                    {isSyncing ? '🔄 Syncing...' : '⚡ Import SKU'}
                  </button>
                </div>
                <button onClick={() => setIsAddModalOpen(true)} className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg transition-all active:scale-95 flex items-center gap-2">
                  <span>➕</span> Add Product
                </button>
              </div>
            </header>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-800 uppercase text-xs font-black tracking-wider">
                  <tr>
                    <th className="px-6 py-5">Product Info</th>
                    <th className="px-6 py-5">SKU</th>
                    <th className="px-6 py-5">Price</th>
                    <th className="px-6 py-5">Status</th>
                    <th className="px-6 py-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.map((product) => (
                    <tr key={product.sku} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 flex items-center gap-4">
                        <img src={product.image_url} alt={product.title} className="w-12 h-12 rounded-lg object-cover border border-slate-200 bg-slate-100" />
                        <button 
                          onClick={() => {
                            setEditingProduct(product);
                            setIsEditModalOpen(true);
                          }} 
                          className="font-bold text-slate-900 text-base hover:text-orange-500 hover:underline text-left transition-colors"
                        >
                          {product.title}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded font-bold border border-slate-200">{product.sku}</span>
                      </td>
                      <td className="px-6 py-4 font-black text-slate-900 text-base">${product.price.toFixed(2)}</td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-black ${product.in_stock ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                          {product.in_stock ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right flex justify-end gap-2">
                        <button 
                          onClick={() => {
                            setEditingProduct(product);
                            setIsEditModalOpen(true);
                          }} 
                          className="text-slate-500 hover:bg-slate-100 p-2 rounded-lg transition-colors font-bold text-xs"
                        >
                          ✏️ Edit
                        </button>
                        <button onClick={() => handleDeleteProduct(product.sku)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors font-bold text-xs">
                          🗑️ Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {products.length === 0 && (
                <div className="text-center py-20 text-slate-400 font-medium">No products in inventory.</div>
              )}
            </div>
          </>
        )}
      </main>

      {/* --- ADD PRODUCT MODAL --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h2 className="text-xl font-black text-slate-900">Add New Product</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold text-xl p-2">✕</button>
            </div>
            
            <form onSubmit={handleAddProduct} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Title</label>
                  <input required type="text" value={newProduct.title} onChange={e => setNewProduct({...newProduct, title: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 font-medium" placeholder="E.g. Gaming Mouse" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">SKU</label>
                  <input required type="text" value={newProduct.sku} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 font-medium" placeholder="MOU-001" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Price ($)</label>
                  <input required type="number" step="0.01" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 font-medium" placeholder="49.99" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Category</label>
                  <select required value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 font-medium bg-white">
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
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Product Description</label>
                <textarea required value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 font-medium" rows="2" placeholder="Describe the item..."></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Product Image</label>
                <input required type="file" accept="image/*" onChange={e => setNewProduct({...newProduct, image: e.target.files[0]})} className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 font-medium file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-orange-50 file:text-orange-600 hover:file:bg-orange-100 cursor-pointer" />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input type="checkbox" id="in_stock" checked={newProduct.in_stock} onChange={e => setNewProduct({...newProduct, in_stock: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-orange-500 focus:ring-orange-500 cursor-pointer" />
                <label htmlFor="in_stock" className="text-sm font-bold text-slate-700 cursor-pointer">Item is currently in stock</label>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3 rounded-xl shadow-lg transition-all active:scale-[0.98]">
                  Save Product to Database
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

    </div>
  );
}
