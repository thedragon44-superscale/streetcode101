import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from './Navbar';

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

export default function Inbox() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('pidrop_token');
    if (!token) {
      setError('Please sign in to view your inbox.');
      setLoading(false);
      return;
    }

    fetch(`${API_BASE}/inbox`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load inbox');
        return res.json();
      })
      .then(data => {
        setConversations(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Global User Search API
  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      fetch(`${API_BASE}/search?q=${encodeURIComponent(searchQuery)}`)
        .then(res => res.ok ? res.json() : { users: [] })
        .then(data => setSearchResults(data.users || []))
        .catch(err => console.error("Search failed:", err));
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  // --- SKELETON LOADER ---
  if (loading) return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-10 w-full space-y-4 animate-pulse">
        <div className="h-10 w-48 bg-slate-200 rounded-lg mb-8"></div>
        <div className="h-12 w-full bg-slate-200 rounded-2xl mb-8"></div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-200 rounded-full flex-shrink-0"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-200 rounded w-1/4"></div>
              <div className="h-3 bg-slate-200 rounded w-3/4"></div>
            </div>
          </div>
        ))}
      </main>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-8 w-full flex-1">
        <div className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Inbox</h1>
          <p className="text-slate-500 text-sm font-medium mt-1">Direct messages and vendor support.</p>
        </div>

        {/* META-Style Search Bar */}
        <div className="mb-8 relative z-10">
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users to message..."
              className="w-full bg-white border border-slate-200 text-slate-900 placeholder-slate-400 rounded-2xl pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 transition-all shadow-sm font-medium"
            />
          </div>
          
          {/* Search Dropdown */}
          {searchQuery.trim().length > 0 && (
            <div className="absolute top-[110%] left-0 right-0 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 max-h-64 overflow-y-auto">
              {searchResults.length > 0 ? (
                searchResults.map(user => (
                  <Link 
                    key={user.username}
                    to={`/chat/${user.username}`}
                    className="flex items-center gap-3 p-3 hover:bg-slate-50 border-b border-slate-50 last:border-0 transition-colors"
                  >
                    <img src={user.profile_image_url} alt={user.username} className="w-10 h-10 rounded-full object-cover border border-slate-200 bg-slate-100" />
                    <span className="font-bold text-slate-900">@{user.username}</span>
                  </Link>
                ))
              ) : (
                <div className="p-4 text-center text-slate-500 text-sm font-medium">No users found.</div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl font-bold border border-red-200 text-center mb-8">
            ⚠️ {error}
          </div>
        )}

        {!loading && !error && conversations.length === 0 && (
          <div className="text-center text-slate-500 mt-4 p-10 bg-white rounded-3xl border border-slate-200 shadow-sm relative z-0">
            <i className="fa-solid fa-inbox text-5xl mb-4 opacity-40"></i>
            <p className="font-bold text-lg text-slate-700">Your inbox is empty.</p>
            <p className="text-sm mt-2">When you message vendors or support, conversations will appear here.</p>
          </div>
        )}

        <div className="space-y-3 relative z-0">
          {conversations.map((conv) => (
            <Link 
              key={conv.contact} 
              to={`/chat/${conv.contact}`}
              className="block bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:shadow-md hover:border-orange-300 transition-all group"
            >
              <div className="flex items-center gap-4">
                
                <div className="w-12 h-12 bg-slate-100 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 font-black text-lg group-hover:bg-orange-100 group-hover:text-orange-600 transition-colors">
                  {conv.contact === 'admin' ? <i className="fa-solid fa-headset"></i> : conv.contact.charAt(0).toUpperCase()}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-bold text-slate-900 truncate">
                      {conv.contact === 'admin' ? 'Street Code 101 Support' : `@${conv.contact}`}
                    </h3>
                    <span className="text-xs text-slate-400 font-medium whitespace-nowrap ml-2">
                      {new Date(conv.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 truncate font-medium">
                    {conv.is_sender ? <span className="text-slate-400 mr-1">You:</span> : null}
                    {conv.last_message}
                  </p>
                </div>

              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
