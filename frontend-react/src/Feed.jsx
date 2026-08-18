import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from './Navbar';
import toast from 'react-hot-toast';

const API_BASE = 'http://127.0.0.1:8000/api';

export default function Feed() {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/listings/feed`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load feed');
        return res.json();
      })
      .then(data => {
        setFeed(data);
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
      <main className="max-w-2xl mx-auto px-4 py-10 w-full space-y-8 animate-pulse">
         {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-slate-200 rounded-full"></div>
                <div className="h-4 bg-slate-200 rounded w-1/3"></div>
              </div>
              <div className="h-64 bg-slate-200 rounded-2xl mb-4 w-full"></div>
              <div className="h-4 bg-slate-200 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-slate-200 rounded w-full"></div>
            </div>
         ))}
      </main>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      
      {/* Global Navbar */}
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Social Feed</h1>
            <p className="text-slate-500 text-sm font-medium mt-1">Live drops from the community ledger.</p>
          </div>
          <Link to="/profile/me" className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-xl shadow-md transition-all active:scale-95 text-sm uppercase tracking-wider hidden sm:block">
            Post a Drop
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl font-bold border border-red-200 text-center mb-8">
            ⚠️ Error: {error}
          </div>
        )}

        {!loading && !error && feed.length === 0 && (
          <div className="text-center text-slate-500 mt-10 p-8 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <i className="fa-solid fa-ghost text-4xl mb-4 opacity-50"></i>
            <p className="font-bold">The feed is empty.</p>
            <p className="text-sm mt-1">Be the first to post a vendor listing!</p>
          </div>
        )}

        <div className="space-y-8">
          {feed.map((post) => (
            <div key={post.id} className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
              
              {/* Post Header */}
              <div className="p-4 flex items-center justify-between border-b border-slate-100">
                <Link to={`/profile/${post.username}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                  <img src={post.user_avatar} alt={post.username} className="w-10 h-10 rounded-full object-cover border border-slate-200 bg-slate-100" />
                  <div>
                    <div className="font-bold text-slate-900 leading-none">@{post.username}</div>
                    <div className="text-xs text-slate-400 mt-1 font-medium">
                      {post.created_at ? new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                    </div>
                  </div>
                </Link>
                <div className="text-2xl font-black text-slate-900">
                  ${post.price.toFixed(2)}
                </div>
              </div>

              {/* Post Image */}
              <div className="w-full bg-slate-50 flex items-center justify-center p-6 border-b border-slate-100">
                <img src={post.image_url} alt={post.title} className="max-h-96 w-full object-contain rounded-xl mix-blend-multiply" />
              </div>

              {/* Post Body */}
              <div className="p-5">
                <h2 className="text-lg font-bold text-slate-900 mb-2">{post.title}</h2>
                <p className="text-slate-600 text-sm leading-relaxed mb-4">{post.description}</p>
                
                <div className="flex gap-3 mt-4">
                  <Link to="/inbox" className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold py-3 rounded-xl shadow-sm transition-all border border-slate-300 flex items-center justify-center gap-2 text-sm uppercase tracking-wider">
                    <i className="fa-solid fa-envelope"></i> Message Vendor
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
