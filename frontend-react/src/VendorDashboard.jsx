import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from './Navbar';
import toast from 'react-hot-toast';

export default function VendorDashboard() {
  // We will replace this with a fetch to /api/vendor/dashboard in the next phase
  const [metrics] = useState({
    availableBalance: 450.00,
    escrowBalance: 120.50,
    totalSales: 24,
  });

  const [orders, setOrders] = useState([
    {
      id: 'ORD-101-8X9P',
      productName: 'Mechanical Keyboard (Red Switches)',
      buyerUsername: 'garvmarcos',
      shippingAddress: 'Garv Marcos | 123 ATX Ave, Austin, TX 78701',
      date: '2026-08-28',
      price: 120.50,
      status: 'pending',
      escrowStatus: 'locked',
      trackingNumber: ''
    },
    {
      id: 'ORD-101-4K2M',
      productName: 'Vintage Denim Jacket',
      buyerUsername: 'streetwear_king',
      shippingAddress: 'John Doe | 456 Fashion St, New York, NY 10001',
      date: '2026-08-25',
      price: 85.00,
      status: 'shipped',
      escrowStatus: 'released',
      trackingNumber: '1Z9999999999999999'
    }
  ]);

  const [trackingInputs, setTrackingInputs] = useState({});

  const handleTrackingChange = (orderId, val) => {
    setTrackingInputs(prev => ({ ...prev, [orderId]: val }));
  };

  const submitTracking = (orderId) => {
    const trackingNo = trackingInputs[orderId];
    if (!trackingNo || trackingNo.trim() === '') {
      return toast.error('Enter a valid tracking number.');
    }
    
    // UI Mock Update - We will connect this to the Escrow Release endpoint next
    setOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        return { ...o, status: 'shipped', escrowStatus: 'released', trackingNumber: trackingNo };
      }
      return o;
    }));
    
    toast.success(`Tracking added! Escrow released for ${orderId}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20 flex flex-col">
      <Navbar />

      <main className="max-w-5xl mx-auto px-4 py-10 w-full animate-fade-in">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tight text-slate-900">Vendor Console</h1>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Manage Drops & Escrow</p>
          </div>
          <Link to="/profile/me" className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm">
            View Public Profile
          </Link>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/10 rounded-bl-full -mr-4 -mt-4"></div>
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Available Wallet</span>
            <span className="text-4xl font-black text-slate-900">{metrics.availableBalance.toFixed(2)} <span className="text-lg text-slate-400">SC</span></span>
          </div>

          <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 shadow-md flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/20 rounded-bl-full -mr-4 -mt-4"></div>
            <span className="text-xs font-black text-cyan-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <i className="fa-solid fa-lock"></i> Locked in Escrow
            </span>
            <span className="text-4xl font-black text-white">{metrics.escrowBalance.toFixed(2)} <span className="text-lg text-slate-500">SC</span></span>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Total Orders</span>
            <span className="text-4xl font-black text-slate-900">{metrics.totalSales}</span>
          </div>
        </div>

        {/* Orders & Fulfillment Section */}
        <h2 className="text-xl font-black uppercase tracking-wide text-slate-900 mb-4">Fulfillment Queue</h2>
        
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {orders.length === 0 ? (
            <div className="p-10 text-center text-slate-500 font-bold uppercase tracking-widest text-sm">
              No orders yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {orders.map(order => (
                <div key={order.id} className="p-6 flex flex-col lg:flex-row gap-6 hover:bg-slate-50 transition-colors">
                  
                  {/* Order Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-black bg-slate-100 text-slate-600 px-2 py-1 rounded uppercase tracking-wider">{order.id}</span>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{order.date}</span>
                    </div>
                    <h3 className="font-black text-slate-900 text-lg uppercase tracking-tight">{order.productName}</h3>
                    <p className="text-sm font-bold text-cyan-600 mb-3">Buyer: @{order.buyerUsername}</p>
                    
                    <div className="bg-slate-100 p-3 rounded-xl border border-slate-200">
                      <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Shipping Destination</span>
                      <span className="text-sm font-medium text-slate-700">{order.shippingAddress}</span>
                    </div>
                  </div>

                  {/* Financials & Fulfillment Action */}
                  <div className="lg:w-1/3 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-100 pt-4 lg:pt-0 lg:pl-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Payout</span>
                        <span className="text-xl font-black text-slate-900">{order.price.toFixed(2)} SC</span>
                      </div>
                      
                      {order.escrowStatus === 'locked' ? (
                        <span className="bg-orange-100 text-orange-600 border border-orange-200 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                          <i className="fa-solid fa-lock"></i> Escrow
                        </span>
                      ) : (
                        <span className="bg-emerald-100 text-emerald-600 border border-emerald-200 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                          <i className="fa-solid fa-check-double"></i> Released
                        </span>
                      )}
                    </div>

                    {order.status === 'pending' ? (
                      <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Input Tracking to Release Funds</label>
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            placeholder="e.g. 1Z9999..."
                            value={trackingInputs[order.id] || ''}
                            onChange={(e) => handleTrackingChange(order.id, e.target.value)}
                            className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-bold focus:ring-2 focus:ring-orange-500 focus:outline-none placeholder-slate-400"
                          />
                          <button 
                            onClick={() => submitTracking(order.id)}
                            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors shadow-sm"
                          >
                            Submit
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-500 shrink-0">
                          <i className="fa-solid fa-box-open"></i>
                        </div>
                        <div>
                          <span className="block text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-0.5">Shipped via {order.trackingNumber.startsWith('1Z') ? 'UPS' : 'USPS'}</span>
                          <span className="text-xs font-bold text-slate-700 tracking-wide">{order.trackingNumber}</span>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
