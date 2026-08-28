import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Navbar from './Navbar';
import toast from 'react-hot-toast';
import { parseMentions } from './utils';

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

export default function Feed() {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Comment Section State
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [postComments, setPostComments] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Mention Auto-complete State
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (showMentionDropdown && mentionQuery.trim().length > 0) {
      fetch(`${API_BASE}/search?q=${encodeURIComponent(mentionQuery)}`)
        .then(res => res.json())
        .then(data => setMentionSuggestions(data.users || []))
        .catch(err => console.error(err));
    } else {
      setMentionSuggestions([]);
    }
  }, [mentionQuery, showMentionDropdown]);

  const handleCommentChange = (e) => {
    const val = e.target.value;
    setCommentInput(val);

    // Track the cursor to see if we are currently typing a mention
    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    const mentionMatch = textBeforeCursor.match(/@([a-zA-Z0-9_]*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setShowMentionDropdown(true);
    } else {
      setShowMentionDropdown(false);
    }
  };

  const handleSelectMention = (username) => {
    if (inputRef.current) {
      const cursor = inputRef.current.selectionStart;
      const textBeforeCursor = commentInput.slice(0, cursor);
      const textAfterCursor = commentInput.slice(cursor);
      
      // Replace the raw @text with the full @username
      const newTextBefore = textBeforeCursor.replace(/@([a-zA-Z0-9_]*)$/, `@${username} `);
      setCommentInput(newTextBefore + textAfterCursor);
    } else {
      const newValue = commentInput.replace(/@([a-zA-Z0-9_]*)$/, `@${username} `);
      setCommentInput(newValue);
    }
    
    setShowMentionDropdown(false);
    inputRef.current?.focus();
  };

  const handleToggleComments = async (postId) => {
    if (activeCommentPostId === postId) {
      setActiveCommentPostId(null);
      return;
    }
    setActiveCommentPostId(postId);
    setPostComments([]); 
    try {
      const res = await fetch(`${API_BASE}/posts/${postId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setPostComments(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePostComment = async (e, postId) => {
    e.preventDefault();
    const token = localStorage.getItem('pidrop_token');
    if (!token) return toast.error('You must be logged in to comment!');
    if (!commentInput.trim()) return;

    setIsSubmittingComment(true);
    try {
      const res = await fetch(`${API_BASE}/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: commentInput })
      });
      if (!res.ok) throw new Error('Failed to post comment');
      const newComment = await res.json();
      
      setPostComments([...postComments, newComment]);
      setCommentInput('');
      
      setFeed(prevFeed => prevFeed.map(p => 
        p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p
      ));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmittingComment(false);
    }
  };

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

  const handleLike = async (postId) => {
    const token = localStorage.getItem('pidrop_token');
    if (!token) return toast.error('You must be logged in to like drops!');
    
    try {
      const res = await fetch(`${API_BASE}/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to like post');
      const data = await res.json();
      
      // Instantly update the UI so it feels lightning fast
      setFeed(prevFeed => prevFeed.map(p => {
        if (p.id === postId) {
          return { ...p, likes_count: data.liked ? (p.likes_count || 0) + 1 : (p.likes_count || 1) - 1 };
        }
        return p;
      }));
    } catch (err) {
      toast.error(err.message);
    }
  };

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
                
                <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">{parseMentions(post.description)}</p>
                
                {/* Engagement Bar */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                  <div className="flex gap-4">
                    <button onClick={() => handleLike(post.id)} className="flex items-center gap-1.5 text-slate-500 hover:text-orange-500 transition-colors text-sm font-bold active:scale-90">
                      <i className="fa-solid fa-heart"></i> {post.likes_count || 0}
                    </button>
                    <button onClick={() => handleToggleComments(post.id)} className={`flex items-center gap-1.5 transition-colors text-sm font-bold ${activeCommentPostId === post.id ? 'text-cyan-600' : 'text-slate-500 hover:text-cyan-600'}`}>
                      <i className="fa-solid fa-comment"></i> {post.comments_count || 0}
                    </button>
                  </div>
                  <Link to={`/chat/${post.username}`} className="text-slate-400 hover:text-cyan-700 font-bold transition-all flex items-center gap-1.5 text-[10px] uppercase tracking-widest">
                    <i className="fa-solid fa-paper-plane"></i> Message
                  </Link>
                </div>
              </div>

              {/* Expandable Comment Section */}
              {activeCommentPostId === post.id && (
                <div className="bg-slate-50 p-5 border-t border-slate-200">
                  <div className="max-h-48 overflow-y-auto space-y-3 mb-4 pr-2">
                    {postComments.length === 0 ? (
                      <div className="text-xs text-slate-400 font-bold uppercase tracking-wider text-center py-4">No comments yet.</div>
                    ) : (
                      postComments.map((c) => (
                        <div key={c.id} className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-black text-slate-900">@{c.username}</span>
                            <span className="text-[10px] text-slate-400 font-bold">{new Date(c.created_at).toLocaleDateString()}</span>
                          </div>
                          <p className="text-sm text-slate-700 font-medium">{parseMentions(c.text)}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="relative">
                    {/* Mention Dropdown Menu */}
                    {showMentionDropdown && mentionSuggestions.length > 0 && (
                      <div className="absolute bottom-full left-0 mb-2 w-64 bg-white border border-slate-200 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.1)] overflow-hidden z-50 animate-fade-in">
                        {mentionSuggestions.map(u => (
                          <button
                            key={u.username}
                            type="button"
                            onClick={() => handleSelectMention(u.username)}
                            className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors text-left"
                          >
                            <img src={u.profile_image_url} alt={u.username} className="w-8 h-8 rounded-full object-cover border border-slate-200 bg-slate-100" />
                            <span className="text-sm font-bold text-slate-900">@{u.username}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    
                    <form onSubmit={(e) => handlePostComment(e, post.id)} className="flex gap-2">
                      <input 
                        ref={inputRef}
                        type="text" 
                        placeholder="Add a comment..." 
                        value={commentInput} 
                        onChange={handleCommentChange}
                        className="flex-1 px-4 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                        required
                        autoComplete="off"
                      />
                      <button disabled={isSubmittingComment} type="submit" className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 disabled:opacity-50 transition-all shadow-sm">
                        Post
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
