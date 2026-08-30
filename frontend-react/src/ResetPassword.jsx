import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // If there's no token in the URL, they shouldn't be here
  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md text-center border border-slate-200">
          <div className="text-red-500 text-5xl mb-4"><i className="fa-solid fa-triangle-exclamation"></i></div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Invalid Link</h2>
          <p className="text-slate-500 text-sm mb-6">The password reset link is invalid or missing.</p>
          <Link to="/forgot-password" className="bg-slate-900 text-white font-bold py-3 px-6 rounded-xl inline-block">Request a new link</Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to reset password');
      }

      toast.success('Password updated successfully! You can now sign in.');
      navigate('/login');
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
        <h2 className="text-2xl font-black text-slate-900 mb-2">Create New Password</h2>
        <p className="text-slate-500 text-sm font-medium mb-6">Enter a new, strong password for your account.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">New Password</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                required 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
              >
                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={loading || newPassword.length < 4}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-3 rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50 mt-2"
          >
            {loading ? 'Saving...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
