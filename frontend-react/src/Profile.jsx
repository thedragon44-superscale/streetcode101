import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from './Navbar';
import { useCart } from './CartContext';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from './CheckoutForm';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

export default function Profile() {
  const { username } = useParams(); // 'me' or an actual username
  const navigate = useNavigate();
  const { clearCart } = useCart();
  
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Profile Settings State
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [newBio, setNewBio] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [emailOptIn, setEmailOptIn] = useState(false);

  // New Post State
  const [showListingForm, setShowListingForm] = useState(false);
  const [postType, setPostType] = useState('text'); // 'text', 'image', 'vendor_drop'
  const [listingTitle, setListingTitle] = useState('');
  const [listingDesc, setListingDesc] = useState('');
  const [listingPrice, setListingPrice] = useState('');
  const [listingFile, setListingFile] = useState(null);
  const [isSubmittingListing, setIsSubmittingListing] = useState(false);

  // Comment Section State
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [postComments, setPostComments] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Edit Post State
  const [editingPostId, setEditingPostId] = useState(null);
  const [editPayload, setEditPayload] = useState({ title: '', description: '', price: '' });

  // Wallet State
  const [topUpAmount, setTopUpAmount] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [showTopUpModal, setShowTopUpModal] = useState(false);

  const token = localStorage.getItem('pidrop_token');
  const isMyProfile = username === 'me';

  const handleTopUp = async () => {
    const targetCoins = parseInt(topUpAmount);
    if (!targetCoins || targetCoins < 1) return toast.error('Enter a valid amount');
    
    try {
      const res = await fetch(`${API_BASE}/wallet/topup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ coins: targetCoins })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.detail || 'Top-up failed');
      
      // Native flow: save client secret and open the embedded modal
      setClientSecret(data.clientSecret);
      setShowTopUpModal(true);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleTopUpSuccess = () => {
    setShowTopUpModal(false);
    setClientSecret('');
    
    // Optimistically update the UI balance so it feels instant
    setProfile(prev => ({
      ...prev,
      wallet_balance: (prev.wallet_balance || 0) + parseInt(topUpAmount)
    }));
    setTopUpAmount('');
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
      
      setListings(prev => prev.map(p => 
        p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p
      ));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  useEffect(() => {
    if (isMyProfile && !token) {
      navigate('/login');
      return;
    }

    const endpoint = isMyProfile ? '/profile/me' : `/profile/${username}`;
    const headers = isMyProfile ? { 'Authorization': `Bearer ${token}` } : {};

    fetch(`${API_BASE}${endpoint}`, { headers })
      .then((res) => {
        if (!res.ok) throw new Error('Profile not found or unauthorized');
        return res.json();
      })
      .then((data) => {
        setProfile(data);
        setNewBio(data.bio || '');
        setEmailOptIn(data.email_opt_in || false);
        
        // Once we know the actual username, fetch their wall listings!
        return fetch(`${API_BASE}/posts/user/${data.username}`);
      })
      .then((res) => res.json())
      .then((listingsData) => {
        setListings(listingsData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [username, token, navigate, isMyProfile]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API_BASE}/profile/me/image`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Upload failed');
      
      setProfile({ ...profile, profile_image_url: data.profile_image_url });
      toast.success('Avatar updated successfully!');
    } catch (err) {
      toast.error(`Error uploading avatar: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleBioSave = async () => {
    try {
      const response = await fetch(`${API_BASE}/profile/me`, {
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ bio: newBio })
      });
      if (!response.ok) throw new Error('Failed to update bio');
      
      setProfile({ ...profile, bio: newBio });
      setIsEditingBio(false);
      toast.success('Bio updated!');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleToggleEmail = async () => {
    const newValue = !emailOptIn;
    setEmailOptIn(newValue); // Optimistic UI update
    try {
      const res = await fetch(`${API_BASE}/profile/me`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_opt_in: newValue })
      });
      if (!res.ok) {
        setEmailOptIn(!newValue);
        throw new Error('Failed to update settings');
      }
      toast.success(newValue ? 'Email alerts enabled!' : 'Email alerts disabled.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleCreateListing = async (e) => {
    e.preventDefault();
    setIsSubmittingListing(true);
    
    const formData = new FormData();
    formData.append('post_type', postType);
    formData.append('description', listingDesc);
    
    if (postType === 'vendor_drop') {
      formData.append('title', listingTitle);
      formData.append('price', listingPrice);
    }
    
    if (listingFile && postType !== 'text') {
      formData.append('file', listingFile);
    }

    try {
      const response = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to create listing');
      
      // Instantly inject the new listing at the top of the wall
      setListings([data, ...listings]);
      setShowListingForm(false);
      setListingTitle('');
      setListingDesc('');
      setListingPrice('');
      setListingFile(null);
      toast.success('Listing posted to your wall!');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmittingListing(false);
    }
  };

  const handleToggleFollow = async () => {
    if (!token) return toast.error('You must be logged in to follow users.');
    try {
      const res = await fetch(`${API_BASE}/users/${profile.username}/follow`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to toggle follow status');
      const data = await res.json();
      
      // Instantly update the UI without reloading
      setProfile(prev => ({
        ...prev,
        is_following: data.is_following,
        followers_count: data.is_following ? (prev.followers_count || 0) + 1 : (prev.followers_count || 1) - 1
      }));
      toast.success(data.message);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('pidrop_token');
    clearCart();
    navigate('/login');
  };

  const handleDeleteMyPost = async (id) => {
    if (!window.confirm("Are you sure you want to permanently delete this post?")) return;
    try {
      const res = await fetch(`${API_BASE}/posts/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete post');
      setListings(prev => prev.filter(p => p.id !== id));
      toast.success('Post deleted successfully');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleEditSubmit = async (e, id) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editPayload.title || null,
          description: editPayload.description || null,
          price: editPayload.price ? parseFloat(editPayload.price) : null
        })
      });
      if (!res.ok) throw new Error('Failed to edit post');
      
      setListings(prev => prev.map(p => p.id === id ? { 
        ...p, 
        title: editPayload.title, 
        description: editPayload.description, 
        price: editPayload.price ? parseFloat(editPayload.price) : p.price 
      } : p));
      
      setEditingPostId(null);
      toast.success('Post updated!');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleLike = async (postId) => {
    if (!token) return toast.error('You must be logged in to like drops!');
    try {
      const res = await fetch(`${API_BASE}/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to like post');
      const data = await res.json();
      
      setListings(prev => prev.map(p => {
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
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-10 w-full flex flex-col items-center">
        <div className="w-full h-64 bg-slate-200 animate-pulse rounded-3xl mb-8"></div>
        <div className="w-full h-32 bg-slate-200 animate-pulse rounded-3xl mb-4"></div>
        <div className="w-full h-32 bg-slate-200 animate-pulse rounded-3xl"></div>
      </main>
    </div>
  );

  if (error) return <div className="min-h-screen flex items-center justify-center font-bold text-red-500">Error: {error}</div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 pb-20 flex flex-col">
      
      {/* Global Navbar */}
      <Navbar />

      {/* Profile Card */}
      <main className="max-w-2xl mx-auto px-4 py-10 w-full">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-8 relative">
          
          {/* Header Banner & Sign Out Button */}
          <div className="h-32 bg-gradient-to-r from-cyan-600 to-blue-700 relative">
            {isMyProfile && (
              <button 
                onClick={handleLogout} 
                className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 text-white font-bold py-2 px-4 rounded-xl transition-all backdrop-blur-sm text-sm shadow-sm border border-white/20 flex items-center gap-2"
              >
                <i className="fa-solid fa-right-from-bracket"></i> Sign Out
              </button>
            )}
          </div>
          
          <div className="px-8 pb-8 relative">
            {/* Avatar */}
            <div className="relative -mt-16 mb-4 w-32 h-32 mx-auto sm:mx-0">
              <img 
                src={profile.profile_image_url} 
                alt={profile.username} 
                className="w-full h-full rounded-full object-cover border-4 border-white shadow-lg bg-white"
              />
              {isMyProfile && profile.username !== 'admin' && (
                <label className="absolute bottom-0 right-0 bg-slate-900 text-white p-2 rounded-full cursor-pointer shadow-md hover:bg-orange-500 transition-colors">
                  <i className="fa-solid fa-camera"></i>
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={isUploading} />
                </label>
              )}
            </div>

            {/* Info */}
            <div className="text-center sm:text-left flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                <div>
                  <h1 className="text-3xl font-black text-slate-900">@{profile.username}</h1>
                  <p className="text-sm font-bold text-cyan-600 mt-1 uppercase tracking-widest">
                    {profile.username === 'admin' ? 'Master Admin' : 'Verified Vendor'}
                  </p>
                </div>
                
                {/* Follow Button (Hidden on your own profile) */}
                {!isMyProfile && (
                  <button 
                    onClick={handleToggleFollow}
                    className={`px-6 py-2 rounded-xl text-sm font-bold shadow-sm transition active:scale-95 uppercase tracking-wider ${
                      profile.is_following 
                        ? 'bg-slate-200 text-slate-700 hover:bg-red-100 hover:text-red-600' 
                        : 'bg-slate-900 text-white hover:bg-orange-500'
                    }`}
                  >
                    {profile.is_following ? 'Unfollow' : 'Follow'}
                  </button>
                )}
              </div>

              {/* Network Stats */}
              <div className="flex items-center justify-center sm:justify-start gap-6 mt-4 pb-4 border-b border-slate-100">
                <div className="text-center sm:text-left">
                  <span className="block text-xl font-black text-slate-900">{profile.followers_count || 0}</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Followers</span>
                </div>
                <div className="text-center sm:text-left">
                  <span className="block text-xl font-black text-slate-900">{profile.following_count || 0}</span>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Following</span>
                </div>
              </div>

              {/* --- STREETCOIN WALLET SECTION (Only visible on your own profile) --- */}
              {isMyProfile && (
                <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm mt-6 mb-6 animate-fade-in relative overflow-hidden">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                      <i className="fa-solid fa-coins text-orange-500"></i>
                    </div>
                    <h2 className="text-xl font-black text-slate-900">StreetCoin Wallet</h2>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-6">
                    <span className="text-5xl font-black text-slate-900">
                      {profile.wallet_balance?.toFixed(2) || '0.00'}
                    </span>
                    <span className="text-slate-400 font-bold uppercase tracking-wider mt-3">SC</span>
                  </div>

                  <div className="bg-slate-50 p-4 sm:p-5 rounded-xl border border-slate-200">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                      Purchase Coins (1 SC = $1 USD)
                    </label>
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                      <div className="w-full sm:flex-1 relative">
                        <span className="absolute left-4 top-3.5 text-slate-400 font-black">SC</span>
                        <input
                          type="number"
                          min="1"
                          value={topUpAmount}
                          onChange={(e) => setTopUpAmount(e.target.value)}
                          placeholder="0"
                          className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-orange-500 font-black text-lg bg-white shadow-inner"
                        />
                        
                        {/* Dynamic Surcharge Math Display */}
                        {topUpAmount > 0 && (
                          <div className="absolute -bottom-6 left-1 text-[11px] font-bold text-slate-500 tracking-wide truncate w-[120%]">
                            + ${(((parseInt(topUpAmount) + 0.30) / 0.971) - parseInt(topUpAmount)).toFixed(2)} Fee = <span className="text-slate-900">${((parseInt(topUpAmount) + 0.30) / 0.971).toFixed(2)} Total</span>
                          </div>
                        )}
                      </div>
                      
                      <button
                        onClick={handleTopUp}
                        disabled={!topUpAmount || topUpAmount < 1}
                        className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black py-3 px-8 rounded-xl shadow-md transition-all active:scale-[0.98] uppercase tracking-wider whitespace-nowrap"
                      >
                        Checkout
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Bio / Manifesto</h3>
                
                {isMyProfile && isEditingBio && profile.username !== 'admin' ? (
                  <div className="space-y-3">
                    <textarea 
                      value={newBio}
                      onChange={(e) => setNewBio(e.target.value)}
                      className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-orange-500 text-sm"
                      rows="3"
                    />
                    <div className="flex gap-2">
                      <button onClick={handleBioSave} className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition active:scale-95">Save</button>
                      <button onClick={() => { setIsEditingBio(false); setNewBio(profile.bio); }} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold transition">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="group flex items-start gap-2 justify-center sm:justify-start">
                    <p className="text-slate-600 whitespace-pre-wrap font-medium">{profile.bio || 'No bio provided yet.'}</p>
                    {isMyProfile && profile.username !== 'admin' && (
                      <button onClick={() => setIsEditingBio(true)} className="text-slate-300 hover:text-cyan-600 transition p-1">
                        <i className="fa-solid fa-pen-to-square"></i>
                      </button>
                    )}
                  </div>
                )}

                {/* Email Alert Toggle */}
                {isMyProfile && profile.username !== 'admin' && (
                  <div className="mt-5 pt-5 border-t border-slate-100 flex items-center gap-3 justify-center sm:justify-start">
                    <button 
                      onClick={handleToggleEmail}
                      className={`w-10 h-5 rounded-full flex items-center p-1 transition-colors ${emailOptIn ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'}`}
                    >
                      <div className="w-3.5 h-3.5 bg-white rounded-full shadow-sm"></div>
                    </button>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      {emailOptIn ? 'Email Alerts: ON' : 'Email Alerts: OFF'}
                    </span>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>

        {/* User Timeline */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide">Timeline</h2>
            {isMyProfile && profile.username !== 'admin' && (
              <button 
                onClick={() => setShowListingForm(!showListingForm)}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition active:scale-95"
              >
                {showListingForm ? 'Cancel' : '+ New Post'}
              </button>
            )}
          </div>

          {/* New Post Form */}
          {showListingForm && (
            <form onSubmit={handleCreateListing} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 mb-8 space-y-4">
              
              <div className="flex gap-2 mb-4 bg-slate-100 p-1 rounded-xl">
                <button type="button" onClick={() => setPostType('text')} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${postType === 'text' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Text</button>
                <button type="button" onClick={() => setPostType('image')} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${postType === 'image' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Image</button>
                <button type="button" onClick={() => setPostType('vendor_drop')} className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors ${postType === 'vendor_drop' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Vendor Drop</button>
              </div>

              {postType === 'vendor_drop' && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Item Title</label>
                    <input required type="text" value={listingTitle} onChange={(e)=>setListingTitle(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-orange-500 font-medium" placeholder="e.g. Mechanical Keyboard" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Price ($)</label>
                    <input required type="number" min="1" step="0.01" value={listingPrice} onChange={(e)=>setListingPrice(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-orange-500 font-medium" placeholder="45.00" />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{postType === 'text' ? 'What\'s on your mind?' : 'Description'}</label>
                <textarea required value={listingDesc} onChange={(e)=>setListingDesc(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-orange-500 font-medium" rows="3" placeholder="..." />
              </div>

              {postType !== 'text' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Photo Upload</label>
                  <input required={postType === 'image'} type="file" accept="image/*" onChange={(e)=>setListingFile(e.target.files[0])} className="w-full p-2 border border-slate-300 rounded-xl text-sm font-medium bg-slate-50" />
                </div>
              )}

              <button disabled={isSubmittingListing} type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-md transition disabled:opacity-50 active:scale-95">
                {isSubmittingListing ? 'Posting...' : 'Post to Timeline'}
              </button>
            </form>
          )}

          {/* User's Timeline */}
          <div className="space-y-4">
            {listings.length === 0 ? (
              <div className="text-center p-10 bg-white rounded-3xl border border-slate-200 border-dashed text-slate-500 font-medium shadow-sm">
                No posts yet.
              </div>
            ) : (
              listings.map(item => (
                <div key={item.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition group relative">
                  
                  {/* Floating Action Menu (Only visible on your own profile) */}
                  {isMyProfile && profile?.username !== 'admin' && (
                    <div className="absolute top-4 right-4 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-white p-1 rounded-lg shadow-sm border border-slate-100 z-10">
                      <button onClick={() => {
                        setEditingPostId(item.id);
                        setEditPayload({ title: item.title || '', description: item.description || '', price: item.price || '' });
                      }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-md transition-colors" title="Edit Post">
                        <i className="fa-solid fa-pen"></i>
                      </button>
                      <button onClick={() => handleDeleteMyPost(item.id)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Delete Post">
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-5">
                    {item.post_type !== 'text' && item.image_url && (
                      <img src={item.image_url} alt="Post media" className="w-full sm:w-32 h-32 object-cover rounded-2xl bg-slate-50 border border-slate-100 flex-shrink-0" />
                    )}
                    <div className="flex flex-col flex-1 min-w-0">
                      
                      {/* Editing View vs Normal View */}
                      {editingPostId === item.id ? (
                        <form onSubmit={(e) => handleEditSubmit(e, item.id)} className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-2">
                          {item.post_type === 'vendor_drop' && (
                            <div className="flex gap-2">
                              <input type="text" value={editPayload.title} onChange={e => setEditPayload({...editPayload, title: e.target.value})} className="flex-1 p-2 rounded-xl text-sm border border-slate-300 focus:ring-2 focus:ring-cyan-500" placeholder="Title" required />
                              <input type="number" step="0.01" value={editPayload.price} onChange={e => setEditPayload({...editPayload, price: e.target.value})} className="w-24 p-2 rounded-xl text-sm border border-slate-300 focus:ring-2 focus:ring-cyan-500" placeholder="Price" required />
                            </div>
                          )}
                          <textarea value={editPayload.description} onChange={e => setEditPayload({...editPayload, description: e.target.value})} className="w-full p-3 rounded-xl text-sm border border-slate-300 focus:ring-2 focus:ring-cyan-500" rows="3" required></textarea>
                          <div className="flex gap-2">
                            <button type="submit" className="bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-600 shadow-sm active:scale-95">Save Changes</button>
                            <button type="button" onClick={() => setEditingPostId(null)} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-300 active:scale-95">Cancel</button>
                          </div>
                        </form>
                      ) : (
                        <>
                          {item.post_type === 'vendor_drop' && item.title && (
                            <div className="flex justify-between items-start mb-1 pr-16">
                              <h3 className="font-bold text-slate-900 truncate uppercase tracking-wide">{item.title}</h3>
                              {item.price && <span className="text-lg font-black text-emerald-600">${item.price.toFixed(2)}</span>}
                            </div>
                          )}
                          <p className={`text-slate-800 mb-3 whitespace-pre-wrap pr-4 sm:pr-16 ${item.post_type === 'text' ? 'text-base font-medium' : 'text-sm font-medium'}`}>
                            {item.description}
                          </p>
                        </>
                      )}

                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex gap-4">
                          <button onClick={() => handleLike(item.id)} className="flex items-center gap-1.5 text-slate-500 hover:text-orange-500 transition-colors text-sm font-bold active:scale-90">
                            <i className="fa-solid fa-heart"></i> {item.likes_count || 0}
                          </button>
                          <button onClick={() => handleToggleComments(item.id)} className={`flex items-center gap-1.5 transition-colors text-sm font-bold ${activeCommentPostId === item.id ? 'text-cyan-600' : 'text-slate-500 hover:text-cyan-600'}`}>
                            <i className="fa-solid fa-comment"></i> {item.comments_count || 0}
                          </button>
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2">
                          <span>{new Date(item.created_at).toLocaleDateString()}</span>
                          {item.post_type === 'vendor_drop' && <span className="bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">Drop</span>}
                        </div>
                      </div>
                      
                      {/* Expandable Comment Section */}
                      {activeCommentPostId === item.id && (
                        <div className="mt-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          <div className="max-h-40 overflow-y-auto space-y-2 mb-3 pr-2">
                            {postComments.length === 0 ? (
                              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider text-center py-2">No comments yet.</div>
                            ) : (
                              postComments.map((c) => (
                                <div key={c.id} className="bg-white p-2.5 rounded-xl shadow-sm border border-slate-100">
                                  <div className="flex justify-between items-center mb-0.5">
                                    <span className="text-[10px] font-black text-slate-900">@{c.username}</span>
                                    <span className="text-[9px] text-slate-400 font-bold">{new Date(c.created_at).toLocaleDateString()}</span>
                                  </div>
                                  <p className="text-xs text-slate-700 font-medium">{c.text}</p>
                                </div>
                              ))
                            )}
                          </div>
                          <form onSubmit={(e) => handlePostComment(e, item.id)} className="flex gap-2">
                            <input 
                              type="text" 
                              placeholder="Reply..." 
                              value={commentInput} 
                              onChange={(e) => setCommentInput(e.target.value)}
                              className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 font-medium"
                              required
                            />
                            <button disabled={isSubmittingComment} type="submit" className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-800 disabled:opacity-50 transition-all shadow-sm">
                              Post
                            </button>
                          </form>
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* --- NATIVE STRIPE TOP-UP MODAL --- */}
      {showTopUpModal && clientSecret && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col relative border border-slate-200">
            {/* Header (Pinned to top) */}
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-3xl shrink-0">
              <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                <i className="fa-solid fa-coins text-orange-500"></i> Secure Top-Up
              </h3>
              <button 
                onClick={() => { setShowTopUpModal(false); setClientSecret(''); }}
                className="text-slate-400 hover:text-slate-700 font-bold p-1 transition"
              >
                ✕
              </button>
            </div>
            
            {/* Body (Scrollable) */}
            <div className="p-6 overflow-y-auto">
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutForm onSuccess={handleTopUpSuccess} />
              </Elements>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
