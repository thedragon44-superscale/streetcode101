import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from './Navbar';

const API_BASE = 'http://127.0.0.1:8000/api';

export default function Inbox() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  // --- SKELETON LOADER ---
  if (loading) return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-10 w-full space-y-4 animate-pulse">
        <div className="h-10 w-48 bg-slate-200 rounded-lg mb-8"></div>
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
      
      {/* Global Navbar */}
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-8 w-full flex-1">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Inbox</h1>
          <p className="text-slate-500 text-sm font-medium mt-1">Direct messages and vendor support.</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl font-bold border border-red-200 text-center mb-8">
            ⚠️ {error}
          </div>
        )}

        {!loading && !error && conversations.length === 0 && (
          <div className="text-center text-slate-500 mt-10 p-10 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <i className="fa-solid fa-inbox text-5xl mb-4 opacity-40"></i>
            <p className="font-bold text-lg text-slate-700">Your inbox is empty.</p>
            <p className="text-sm mt-2">When you message vendors or support, conversations will appear here.</p>
          </div>
        )}

        <div className="space-y-3">
          {conversations.map((conv) => (
            <Link 
              key={conv.contact} 
              to={`/chat/${conv.contact}`}
              className="block bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:shadow-md hover:border-orange-300 transition-all group"
            >
              <div className="flex items-center gap-4">
                
                {/* Dynamic Avatar */}
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
