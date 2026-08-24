import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

export default function EmailCaptureModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [discountCode, setDiscountCode] = useState('');

  useEffect(() => {
    const isDismissed = localStorage.getItem('101_ledger_dismissed');
    if (!isDismissed) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('101_ledger_dismissed', 'true');
    setIsOpen(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      if (!res.ok) throw new Error('Network error. Try again.');
      
      const data = await res.json();
      setDiscountCode(data.code);
      setIsSuccess(true);
      localStorage.setItem('101_ledger_dismissed', 'true');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(discountCode);
    toast.success('Code copied to clipboard!');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-950 border border-slate-800 shadow-2xl rounded-2xl w-full max-w-md overflow-hidden relative">
        <button onClick={handleDismiss} className="absolute top-4 right-4 text-slate-500 hover:text-orange-500 transition-colors z-10">✕</button>
        
        <div className="p-8 text-center">
          <img src="/dragon_logo.png" alt="101 Logo" className="w-16 h-16 mx-auto mb-4 object-contain opacity-80" onError={(e) => e.target.style.display='none'} />
          
          {!isSuccess ? (
            <>
              <h2 className="text-2xl font-black text-white uppercase tracking-widest font-heading mb-2">
                JOIN THE <span className="text-orange-500">[101_LEDGER]</span>
              </h2>
              <p className="text-slate-400 font-mono text-xs leading-relaxed mb-6">
                Enter your email to unlock 10% off your first vault pull.
              </p>
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <input 
                  type="email" 
                  required 
                  placeholder="EMAIL ADDRESS" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:border-orange-500 font-mono text-sm text-white placeholder-slate-600 text-center uppercase tracking-wider" 
                />
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-orange-500 hover:bg-orange-400 disabled:bg-slate-700 text-slate-950 font-black py-3 rounded-lg shadow-md transition-colors uppercase tracking-widest text-sm"
                >
                  {isSubmitting ? 'ENCRYPTING...' : 'SECURE ACCESS'}
                </button>
              </form>
            </>
          ) : (
            <div className="animate-fade-in">
              <h2 className="text-xl font-black text-emerald-400 uppercase tracking-widest font-heading mb-2">
                ACCESS GRANTED
              </h2>
              <p className="text-slate-400 font-mono text-xs mb-6">Your authorization code is ready.</p>
              
              <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 mb-6 flex items-center justify-between">
                <span className="text-xl font-mono font-black text-white">{discountCode}</span>
                <button onClick={copyToClipboard} className="text-orange-500 hover:text-orange-400 font-bold text-xs uppercase tracking-wider border border-orange-500/30 px-3 py-1.5 rounded-md bg-orange-500/10">
                  COPY
                </button>
              </div>

              <Link 
                to={`/login?email=${encodeURIComponent(email)}`} 
                onClick={() => setIsOpen(false)}
                className="block w-full border border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-slate-950 font-black py-3 rounded-lg transition-colors uppercase tracking-widest text-sm"
              >
                CREATE SECURE ACCOUNT
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
