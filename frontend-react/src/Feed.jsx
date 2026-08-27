import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from './Navbar';
import toast from 'react-hot-toast';

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

export default function Feed() {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/posts/feed`)
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
                    <div className="text-xs text-slate-400 mt-1 font-medium flex items-center gap-2">
                      {post.created_at ? new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                      {post.post_type === 'vendor_drop' && <span className="text-[9px] font-black bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded uppercase">Drop</span>}
                    </div>
                  </div>
                </Link>
                {post.post_type === 'vendor_drop' && post.price && (
                  <div className="text-2xl font-black text-emerald-600">
                    ${post.price.toFixed(2)}
                  </div>
                )}
              </div>

              {/* Conditional Image */}
              {post.post_type !== 'text' && post.image_url && (
                <div className="w-full bg-slate-50 flex items-center justify-center p-6 border-b border-slate-100">
                  <img src={post.image_url} alt="Post media" className="max-h-96 w-full object-contain rounded-xl mix-blend-multiply" />
                </div>
              )}

              {/* Post Body */}
              <div className="p-5">
                {post.post_type === 'vendor_drop' && post.title && (
                  <h2 className="text-lg font-black text-slate-900 mb-2 uppercase tracking-wide">{post.title}</h2>
                )}
                
                <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">{post.description}</p>
                
                <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
                  <Link to="/inbox" className="flex-1 bg-slate-50 hover:bg-slate-100 text-cyan-700 font-bold py-2 rounded-xl transition-all border border-slate-200 flex items-center justify-center gap-2 text-xs uppercase tracking-wider">
                    <i className="fa-solid fa-envelope"></i> Message @{post.username}
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
