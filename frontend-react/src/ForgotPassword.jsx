import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to process request');
      }

      setSubmitted(true);
      toast.success('Reset email sent!');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <Link to="/" className="mb-8 flex items-center gap-3 hover:scale-105 transition-transform">
        <img src="/streetbook_logo.png" alt="Street Code 101 Logo" className="h-20 w-20 object-cover rounded-xl shadow-md border border-slate-200" />
        <span className="text-4xl font-black tracking-tighter text-slate-900 uppercase">Street Code <span className="text-orange-500">101</span></span>
      </Link>

      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-slate-200">
        <h2 className="text-2xl font-black text-slate-900 mb-2">Reset Password</h2>
        
        {submitted ? (
          <div className="text-center py-6">
            <div className="text-emerald-500 text-5xl mb-4"><i className="fa-solid fa-envelope-circle-check"></i></div>
            <p className="text-slate-600 font-medium mb-6">
              If an account exists for <span className="font-bold text-slate-900">{email}</span>, we have sent a password reset link. Please check your inbox.
            </p>
            <Link to="/login" className="text-cyan-600 font-bold hover:underline">Return to Sign In</Link>
          </div>
        ) : (
          <>
            <p className="text-slate-500 text-sm font-medium mb-6">Enter the email address associated with your account, and we will send you a secure link to reset your password.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Email Address</label>
                <input 
                  type="email" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="name@example.com"
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-3 rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50 mt-2"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
            <div className="mt-6 text-center">
              <Link to="/login" className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">
                <i className="fa-solid fa-arrow-left mr-1"></i> Back to Sign In
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
