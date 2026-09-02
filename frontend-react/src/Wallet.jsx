import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from './CheckoutForm';

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

export default function Wallet() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Top-Up State
  const [topUpAmount, setTopUpAmount] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);

  // Cashout State
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [zelleContact, setZelleContact] = useState('');
  const [isCashingOut, setIsCashingOut] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    const token = localStorage.getItem('pidrop_token');
    try {
      const res = await fetch(`${API_BASE}/profile/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      }
    } catch (err) {
      toast.error('Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  const handleInitializeTopUp = async () => {
    const coins = parseInt(topUpAmount);
    if (!coins || coins <= 0) {
      toast.error('Enter a valid amount of StreetCoin');
      return;
    }
    
    setIsInitializing(true);
    const token = localStorage.getItem('pidrop_token');
    
    try {
      const res = await fetch(`${API_BASE}/wallet/topup`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ coins })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to initialize top-up');
      
      setClientSecret(data.clientSecret);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleTopUpSuccess = () => {
    toast.success('StreetCoin purchased successfully!');
    setClientSecret('');
    setTopUpAmount('');
    // Refresh user data to show new balance
    fetchUserData();
  };

  const handleCashout = async () => {
    const coins = parseFloat(cashoutAmount);
    if (!coins || coins < 10) {
      toast.error('Minimum cashout is 10 SC');
      return;
    }
    if (!zelleContact.trim()) {
      toast.error('Zelle contact is required');
      return;
    }

    setIsCashingOut(true);
    const token = localStorage.getItem('pidrop_token');

    try {
      const res = await fetch(`${API_BASE}/vendor/cashout`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount_coins: coins, zelle_contact: zelleContact })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Cashout failed');
      
      toast.success('Cashout request submitted successfully!');
      setCashoutAmount('');
      setZelleContact('');
      fetchUserData();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsCashingOut(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest">Accessing Vault...</div>;
  if (!user) return <div className="p-8 text-center text-red-500 font-bold uppercase">Unauthorized</div>;

  const canCashout = user.role === 'vendor' || user.role === 'service_provider';

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
      <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Digital Wallet</h1>

      {/* Balance Display */}
      <div className="bg-slate-900 rounded-2xl p-8 border border-slate-800 shadow-xl text-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 to-cyan-500"></div>
        <p className="text-slate-400 font-bold tracking-widest uppercase text-sm mb-2">Available Balance</p>
        <h2 className="text-5xl font-black text-white font-mono">{user.wallet_balance?.toFixed(2) || '0.00'} <span className="text-orange-500 text-3xl">SC</span></h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* TOP UP SECTION */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-4 border-b border-slate-100 pb-3">Top Up Wallet</h3>
          
          {!clientSecret ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Amount to Buy (SC)</label>
                <input 
                  type="number" 
                  min="1"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-orange-500 font-mono text-slate-900" 
                  placeholder="e.g. 50"
                />
              </div>
              <button 
                onClick={handleInitializeTopUp}
                disabled={isInitializing}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-3 rounded-xl transition-all disabled:opacity-50 uppercase tracking-wider"
              >
                {isInitializing ? 'Initializing...' : 'Purchase StreetCoin'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <button 
                onClick={() => setClientSecret('')}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 uppercase tracking-widest mb-2 inline-block"
              >
                ← Cancel Top-Up
              </button>
              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
                <Elements stripe={stripePromise} options={{ 
                  clientSecret, 
                  appearance: { theme: 'night', variables: { colorPrimary: '#f97316', colorBackground: '#0f172a' } }
                }}>
                  <CheckoutForm onSuccess={handleTopUpSuccess} />
                </Elements>
              </div>
            </div>
          )}
        </div>

        {/* CASHOUT SECTION (Conditional) */}
        {canCashout ? (
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-4 border-b border-slate-100 pb-3">Withdraw Funds</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Amount to Cashout (SC)</label>
                <input 
                  type="number" 
                  min="10"
                  max={user.wallet_balance}
                  value={cashoutAmount}
                  onChange={(e) => setCashoutAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-orange-500 font-mono text-slate-900" 
                  placeholder="Minimum 10 SC"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Zelle Email/Phone</label>
                <input 
                  type="text" 
                  value={zelleContact}
                  onChange={(e) => setZelleContact(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-orange-500 font-mono text-slate-900" 
                  placeholder="contact@zelle.com"
                />
              </div>
              <button 
                onClick={handleCashout}
                disabled={isCashingOut}
                className="w-full bg-orange-500 hover:bg-orange-400 text-slate-950 font-black py-3 rounded-xl transition-all disabled:opacity-50 uppercase tracking-wider"
              >
                {isCashingOut ? 'Processing...' : 'Submit Request'}
              </button>
              <p className="text-[10px] text-slate-500 text-center uppercase tracking-widest mt-2">
                Standard 5% platform fee applies to all cashouts.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col items-center justify-center text-center">
            <i className="fa-solid fa-lock text-4xl text-slate-300 mb-4"></i>
            <h3 className="text-sm font-black text-slate-600 uppercase tracking-widest mb-2">Withdrawals Locked</h3>
            <p className="text-xs text-slate-500 font-medium">Cashouts are restricted to verified Vendors and Service Providers.</p>
          </div>
        )}
      </div>
    </div>
  );
}
