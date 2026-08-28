import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { parseMentions } from './utils';

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

export default function Post() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const token = localStorage.getItem('pidrop_token');

  useEffect(() => {
    const fetchPostData = async () => {
      try {
        const postRes = await fetch(`${API_BASE}/posts/${id}`);
        if (!postRes.ok) throw new Error('Post not found');
        setPost(await postRes.json());

        const commentsRes = await fetch(`${API_BASE}/posts/${id}/comments`);
        if (commentsRes.ok) setComments(await commentsRes.json());
      } catch (err) {
        toast.error(err.message);
        navigate('/feed');
      } finally {
        setLoading(false);
      }
    };
    fetchPostData();
  }, [id, navigate]);

  const handleLike = async () => {
    if (!token) return toast.error('Log in to like posts!');
    try {
      const res = await fetch(`${API_BASE}/posts/${id}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to like');
      const data = await res.json();
      setPost(prev => ({ ...prev, likes_count: data.liked ? prev.likes_count + 1 : prev.likes_count - 1 }));
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!token) return toast.error('Log in to comment!');
    if (!commentInput.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/posts/${id}/comments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: commentInput })
      });
      if (!res.ok) throw new Error('Failed to post comment');
      const newComment = await res.json();
      setComments([...comments, newComment]);
      setPost(prev => ({ ...prev, comments_count: prev.comments_count + 1 }));
      setCommentInput('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <div className="max-w-2xl mx-auto w-full p-8 mt-10 bg-slate-200 animate-pulse rounded-3xl h-96"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20 flex flex-col">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-10 w-full animate-fade-in">
        <Link to="/feed" className="text-sm font-bold text-slate-400 hover:text-orange-500 transition-colors mb-6 inline-block">
          <i className="fa-solid fa-arrow-left mr-2"></i> Back to Feed
        </Link>
        
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200">
          <div className="flex items-center gap-4 mb-6">
            <Link to={`/profile/${post.username}`}>
              <img src={post.user_avatar} alt={post.username} className="w-12 h-12 rounded-full border border-slate-200 object-cover shadow-sm hover:scale-105 transition-transform" />
            </Link>
            <div>
              <Link to={`/profile/${post.username}`} className="font-black text-lg text-slate-900 hover:text-cyan-600 transition-colors">
                @{post.username}
              </Link>
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                {new Date(post.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>

          {post.post_type !== 'text' && post.image_url && (
            <img src={post.image_url} alt="Post media" className="w-full h-auto max-h-[500px] object-cover rounded-2xl mb-6 bg-slate-50 border border-slate-100" />
          )}

          {post.post_type === 'vendor_drop' && post.title && (
            <div className="flex justify-between items-start mb-3">
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-wide">{post.title}</h2>
              {post.price && <span className="text-2xl font-black text-emerald-600">${post.price.toFixed(2)}</span>}
            </div>
          )}

          <p className="text-slate-800 text-lg leading-relaxed whitespace-pre-wrap mb-8 font-medium">
            {parseMentions(post.description)}
          </p>

          <div className="flex gap-6 pt-4 border-t border-slate-100 mb-8">
            <button onClick={handleLike} className="flex items-center gap-2 text-slate-500 hover:text-orange-500 transition-colors font-black text-lg active:scale-90">
              <i className="fa-solid fa-heart"></i> {post.likes_count}
            </button>
            <div className="flex items-center gap-2 text-cyan-600 font-black text-lg">
              <i className="fa-solid fa-comment"></i> {post.comments_count}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Comments</h3>
            {comments.length === 0 ? (
              <div className="text-center p-6 bg-slate-50 rounded-2xl border border-slate-100 text-slate-400 font-bold text-sm">Be the first to comment.</div>
            ) : (
              comments.map(c => (
                <div key={c.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div className="flex justify-between items-center mb-1">
                    <Link to={`/profile/${c.username}`} className="text-xs font-black text-slate-900 hover:text-cyan-600 transition-colors">@{c.username}</Link>
                    <span className="text-[10px] text-slate-400 font-bold">{new Date(c.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm text-slate-700 font-medium">{parseMentions(c.text)}</p>
                </div>
              ))
            )}

            <form onSubmit={handlePostComment} className="mt-6 flex gap-3">
              <input type="text" placeholder="Add a comment..." value={commentInput} onChange={(e) => setCommentInput(e.target.value)} className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-cyan-500 font-medium text-sm" required />
              <button type="submit" disabled={isSubmitting} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-sm hover:bg-slate-800 disabled:opacity-50 transition-all shadow-md">Post</button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
