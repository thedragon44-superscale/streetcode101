import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('customer'); // New state for role selection
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isRegistering ? '/auth/register' : '/admin/login';
    const requestBody = isRegistering ? { username, email, password, role } : { username, password };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }

      if (isRegistering) {
        toast.success('Account created successfully! Check your email.');
        setIsRegistering(false);
        setPassword('');
      } else {
        // Save the secure token to the browser
        localStorage.setItem('pidrop_token', data.access_token);
        
        // Route everyone back to the main storefront
        navigate('/');
      }
    } catch (err) {
      setError(err.message);
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

      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200">
        <h2 className="text-2xl font-black text-slate-900 mb-6">
          {isRegistering ? 'Create Account' : 'Sign-In'}
        </h2>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-bold mb-4 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Username</label>
            <input 
              type="text" 
              required 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          
          {isRegistering && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">Email Address</label>
              <input 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          )}

          {isRegistering && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">How do you want to hustle?</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
              >
                <option value="customer">I'm just here to cop drops (Customer)</option>
                <option value="vendor">I want to sell physical gear (Vendor)</option>
                <option value="service_provider">I want to book appointments (Service Provider)</option>
              </select>
            </div>
          )}

          <div>
            <div className="flex justify-between items-end mb-1">
              <label className="block text-sm font-bold text-slate-700">Password</label>
              {!isRegistering && (
                <Link to="/forgot-password" className="text-xs font-bold text-cyan-600 hover:text-cyan-700 hover:underline">
                  Forgot Password?
                </Link>
              )}
            </div>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500 pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                title={showPassword ? "Hide password" : "Show password"}
              >
                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-3 rounded-xl shadow-md transition-all active:scale-[0.98] disabled:opacity-50 mt-2"
          >
            {loading ? 'Processing...' : (isRegistering ? 'Create your 101 account' : 'Sign In')}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-200 text-center">
          <p className="text-sm text-slate-600 mb-3">
            {isRegistering ? 'Already have an account?' : 'New to Street Code 101?'}
          </p>
          <button 
            type="button"
            onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 rounded-xl shadow-sm transition-all border border-slate-300"
          >
            {isRegistering ? 'Sign in to existing account' : 'Create your 101 account'}
          </button>
        </div>
      </div>
    </div>
  );
}
