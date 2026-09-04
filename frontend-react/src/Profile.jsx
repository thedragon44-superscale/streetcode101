import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from './Navbar';
import { useCart } from './CartContext';

const API_BASE = `${import.meta.env.VITE_API_URL}/api`;

const SERVICE_COMPLIANCE = {
  mobile_mechanic: "I agree to use the GPS check-in system, assume all liability for vehicular damage, parts, and tools while on a client's property, and accept the standard 5% escrow fee.",
  hair_beauty: "I confirm that I maintain sanitary tools, hold local grooming certifications, agree to use GPS check-in, and accept the standard 5% escrow fee.",
  home_service: "I agree to use the GPS check-in system, respect client property, assume full financial responsibility for on-site damage or theft, and accept the 5% escrow fee.",
  web_development: "I agree to deliver functional code remotely, submit valid proof-of-delivery via the platform, avoid malicious exploits, and accept the 5% escrow fee.",
  graphic_design: "I guarantee all artwork is original or properly licensed, agree to submit proof-of-delivery remotely, avoid copyright infringement, and accept the 5% escrow fee."
};

export default function Profile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const { clearCart } = useCart();
  
  // --- CORE STATE ---
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [clientAppointments, setClientAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // --- PROFILE SETTINGS STATE ---
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [newBio, setNewBio] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [emailOptIn, setEmailOptIn] = useState(false);

  // --- REVIEWS & COMMERCE STATE ---
  const [reviews, setReviews] = useState([]);
  const [providerServices, setProviderServices] = useState([]);
  const [activeProfileTab, setActiveProfileTab] = useState('timeline'); // 'timeline', 'reviews', 'catalog', 'services'
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewPayload, setReviewPayload] = useState({ target_username: '', appointment_id: null, rating: 5, text: '' });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  // --- NEW POST STATE ---
  const [showListingForm, setShowListingForm] = useState(false);
  const [postType, setPostType] = useState('text');
  const [listingTitle, setListingTitle] = useState('');
  const [listingDesc, setListingDesc] = useState('');
  const [listingPrice, setListingPrice] = useState('');
  const [listingFile, setListingFile] = useState(null);
  const [isSubmittingListing, setIsSubmittingListing] = useState(false);

  // --- COMMENT & EDIT STATE ---
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [postComments, setPostComments] = useState([]);
  const [commentInput, setCommentInput] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [editingPostId, setEditingPostId] = useState(null);
  const [editPayload, setEditPayload] = useState({ title: '', description: '', price: '' });

  // --- ONBOARDING MODAL STATE ---
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showKycModal, setShowKycModal] = useState(false);
  const [upgradeRole, setUpgradeRole] = useState(''); 
  const [onboardingData, setOnboardingData] = useState({
    primaryTrade: '', operatingHours: 'Standard 9-5',
    vendorName: '', merchCategory: 'Apparel', fulfillmentModel: 'Direct Shipping',
    zipCode: '', city: '', state: '',
    complianceAgreed: false
  });
  const [isLookingUpZip, setIsLookingUpZip] = useState(false);

  const token = localStorage.getItem('pidrop_token');
  const isMyProfile = username === 'me';

  
useEffect(() => {
    if (isMyProfile && !token) {
      navigate('/login');
      return;
    }

    const endpoint = isMyProfile ? '/profile/me' : `/profile/${username}`;
    const headers = isMyProfile ? { 'Authorization': `Bearer ${token}` } : {};

    let fetchedProfileData = null;

    fetch(`${API_BASE}${endpoint}`, { headers })
      .then((res) => {
        if (!res.ok) throw new Error('Profile not found or unauthorized');
        return res.json();
      })
      .then((data) => {
        fetchedProfileData = data;
        setProfile(data);
        setNewBio(data.bio || '');
        setEmailOptIn(data.email_opt_in || false);
        return fetch(`${API_BASE}/posts/user/${data.username}`);
      })
      .then((res) => res.json())
      .then((listingsData) => {
        setListings(listingsData);
        return fetch(`${API_BASE}/reviews/${fetchedProfileData.username}`);
      })
      .then((res) => res.ok ? res.json() : [])
      .then((reviewsData) => {
        setReviews(reviewsData);
        return fetch(`${API_BASE}/services`);
      })
      .then((res) => res.ok ? res.json() : [])
      .then((servicesData) => {
        if (fetchedProfileData) {
          setProviderServices(servicesData.filter(s => s.provider_username === fetchedProfileData.username));
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [username, token, navigate, isMyProfile]);

  useEffect(() => {
    if (isMyProfile && token) {
      fetch(`${API_BASE}/client/appointments`, { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.ok ? res.json() : [])
        .then(data => setClientAppointments(data))
        .catch(err => console.error('Failed to load appointments', err));
    }
  }, [isMyProfile, token]);

  // --- HANDLER FUNCTIONS ---
  const handleZipLookup = async (zip) => {
    setOnboardingData(prev => ({ ...prev, zipCode: zip }));
    if (zip.length === 5) {
      setIsLookingUpZip(true);
      try {
        const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
        if (res.ok) {
          const data = await res.json();
          const city = data.places[0]['place name'];
          const state = data.places[0]['state abbreviation'];
          setOnboardingData(prev => ({ ...prev, city, state }));
          toast.success(`Location found: ${city}, ${state}`, { id: 'zip' });
        } else {
          toast.error('Invalid ZIP code', { id: 'zip' });
          setOnboardingData(prev => ({ ...prev, city: '', state: '' }));
        }
      } catch (err) {
        toast.error('Location lookup failed', { id: 'zip' });
      } finally {
        setIsLookingUpZip(false);
      }
    } else {
      setOnboardingData(prev => ({ ...prev, city: '', state: '' }));
    }
  };

  const handleConfirmJob = async (appt) => {
    try {
      const res = await fetch(`${API_BASE}/appointments/${appt.id}/confirm`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to release funds');
      
      toast.success("Escrow released!");
      setClientAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, status: 'released' } : a));
      
      // Pop the review modal immediately after successful confirmation
      setReviewPayload({ target_username: appt.provider_username, appointment_id: appt.id, rating: 5, text: '' });
      setShowReviewModal(true);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!reviewPayload.text.trim()) return toast.error("Please leave a brief written review.");
    setIsSubmittingReview(true);
    
    try {
      const res = await fetch(`${API_BASE}/reviews`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewPayload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to submit review');
      
      toast.success("Review published! Trust score updated.");
      setShowReviewModal(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsSubmittingReview(false);
    }
  };

const handleDisputeJob = async (appointmentId) => {
    if (!window.confirm("Are you sure you want to dispute this job? This will freeze the escrow and alert the Master Admin.")) return;
    
    try {
      const res = await fetch(`${API_BASE}/appointments/${appointmentId}/dispute`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to file dispute');
      
      toast.error("Dispute filed. Escrow frozen.");
      setClientAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, status: 'disputed' } : a));
    } catch (err) {
      toast.error(err.message);
    }
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
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
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
    setEmailOptIn(newValue);
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

  const handleUpgradeAccount = async (e) => {
    e.preventDefault();
    if (!onboardingData.complianceAgreed) return toast.error("You must agree to the compliance terms.");
    if (upgradeRole === 'service_provider' && !onboardingData.primaryTrade) return toast.error("Please select a primary trade.");
    
    try {
      const res = await fetch(`${API_BASE}/profile/upgrade`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_role: upgradeRole, onboarding_data: onboardingData })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to upgrade account');
      
      setProfile(prev => ({ ...prev, role: data.role }));
      setShowUpgradeModal(false);
      setOnboardingData({ ...onboardingData, complianceAgreed: false });
      toast.success(`Welcome to the ${upgradeRole === 'vendor' ? 'Vendor' : 'Service'} Economy!`);
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
      
      const newPost = data.post ? data.post : data;
      setListings([newPost, ...listings]);
      setShowListingForm(false);
      setListingTitle('');
      setListingDesc('');
      setListingPrice('');
      setListingFile(null);
      setPostType('text');
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

  // --- RENDERING CONDITIONS ---
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
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 py-10 w-full">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-8 relative">
          <div className="h-32 bg-gradient-to-r from-cyan-600 to-blue-700 relative">
            {isMyProfile && (
              <button onClick={handleLogout} className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 text-white font-bold py-2 px-4 rounded-xl transition-all backdrop-blur-sm text-sm shadow-sm border border-white/20 flex items-center gap-2">
                <i className="fa-solid fa-right-from-bracket"></i> Sign Out
              </button>
            )}
          </div>
          
          <div className="px-8 pb-8 relative">
            <div className="relative -mt-16 mb-4 w-32 h-32 mx-auto sm:mx-0">
              <img src={profile.profile_image_url} alt={profile.username} className="w-full h-full rounded-full object-cover border-4 border-white shadow-lg bg-white" />
              {isMyProfile && profile.username !== 'admin' && (
                <label className="absolute bottom-0 right-0 bg-slate-900 text-white p-2 rounded-full cursor-pointer shadow-md hover:bg-orange-500 transition-colors">
                  <i className="fa-solid fa-camera"></i>
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={isUploading} />
                </label>
              )}
            </div>

            <div className="text-center sm:text-left flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                <div>
                  <h1 className="text-3xl font-black text-slate-900">@{profile.username}</h1>
                  <div className="flex items-center gap-3 mt-1">
                    <p className={`text-sm font-bold uppercase tracking-widest ${profile.username === 'admin' ? 'text-orange-500' : profile.role?.includes('vendor') || profile.role?.includes('service_provider') ? 'text-cyan-500' : 'text-slate-500'}`}>
                      {profile.username === 'admin' ? 'Master Admin' : 
                       [
                         profile.role?.includes('vendor') ? 'Verified Vendor' : null,
                         profile.role?.includes('service_provider') ? 'Service Provider' : null
                       ].filter(Boolean).join(' & ') || 'Community Member'}
                    </p>
                    {profile.is_verified ? (
                      <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border border-emerald-200">✓ Verified</span>
                    ) : isMyProfile ? (
                      <button onClick={() => setShowKycModal(true)} className="bg-red-100 text-red-600 hover:bg-red-500 hover:text-white px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border border-red-200 transition-colors shadow-sm">
                        Verify Identity
                      </button>
                    ) : null}
                  </div>
                </div>
                
                {!isMyProfile && (
                  <button onClick={handleToggleFollow} className={`px-6 py-2 rounded-xl text-sm font-bold shadow-sm transition active:scale-95 uppercase tracking-wider ${profile.is_following ? 'bg-slate-200 text-slate-700 hover:bg-red-100 hover:text-red-600' : 'bg-slate-900 text-white hover:bg-orange-500'}`}>
                    {profile.is_following ? 'Unfollow' : 'Follow'}
                  </button>
                )}
                
                <div className="flex flex-col gap-2 mt-4 sm:mt-0">
                  {isMyProfile && profile.role?.includes('vendor') && (
                    <Link to="/vendor" className="px-6 py-2 bg-slate-900 hover:bg-purple-500 text-white rounded-xl text-sm font-bold shadow-sm transition active:scale-95 uppercase tracking-wider flex items-center gap-2">
                      <i className="fa-solid fa-shop"></i> Vendor Console
                    </Link>
                  )}
                  {isMyProfile && profile.role?.includes('service_provider') && (
                    <Link to="/provider-dashboard" className="px-6 py-2 bg-slate-900 hover:bg-cyan-500 text-white rounded-xl text-sm font-bold shadow-sm transition active:scale-95 uppercase tracking-wider flex items-center gap-2">
                      <i className="fa-solid fa-briefcase"></i> Service Dash
                    </Link>
                  )}
                </div>
              </div>

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

              {isMyProfile && profile.username !== 'admin' && (!profile.role?.includes('vendor') || !profile.role?.includes('service_provider')) && (
                <div className="bg-slate-50 p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm mt-6 mb-6">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Level Up Your Account</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {!profile.role?.includes('vendor') && (
                      <button onClick={() => { setUpgradeRole('vendor'); setShowUpgradeModal(true); }} className="bg-white border border-purple-200 hover:border-purple-500 hover:shadow-md p-4 rounded-xl flex flex-col items-center justify-center text-center transition-all group">
                        <i className="fa-solid fa-box-open text-2xl text-purple-300 group-hover:text-purple-500 mb-2 transition-colors"></i>
                        <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Become a Vendor</span>
                        <span className="text-[10px] text-slate-500 font-medium mt-1">Sell physical drops</span>
                      </button>
                    )}
                    {!profile.role?.includes('service_provider') && (
                      <button onClick={() => { setUpgradeRole('service_provider'); setShowUpgradeModal(true); }} className="bg-white border border-cyan-200 hover:border-cyan-500 hover:shadow-md p-4 rounded-xl flex flex-col items-center justify-center text-center transition-all group">
                        <i className="fa-solid fa-briefcase text-2xl text-cyan-300 group-hover:text-cyan-500 mb-2 transition-colors"></i>
                        <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Offer Services</span>
                        <span className="text-[10px] text-slate-500 font-medium mt-1">Join the hustle economy</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {profile.role && (profile.role.includes('vendor') || profile.role.includes('service_provider')) && (
                <div className="mt-6 pb-6 border-b border-slate-100 flex items-center justify-center sm:justify-start gap-4">
                  <div className="flex text-orange-400 text-xl drop-shadow-sm">
                    {[...Array(5)].map((_, i) => (
                      <i key={i} className={`fa-solid fa-star ${i < Math.round(profile.trust_score || 0) ? '' : 'text-slate-200'}`}></i>
                    ))}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="font-black text-slate-900 text-lg leading-none">{profile.trust_score?.toFixed(1) || '0.0'} <span className="text-xs text-slate-400 font-bold uppercase tracking-widest ml-1">Trust Score</span></span>
                    <span className="text-xs font-bold text-slate-500 mt-1">{profile.review_count || 0} Verified Reviews</span>
                  </div>
                </div>
              )}

              <div className="mt-6">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Bio / Manifesto</h3>
                {isMyProfile && isEditingBio && profile.username !== 'admin' ? (
                  <div className="space-y-3">
                    <textarea value={newBio} onChange={(e) => setNewBio(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-orange-500 text-sm" rows="3" />
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

                {isMyProfile && profile.username !== 'admin' && (
                  <div className="mt-5 pt-5 border-t border-slate-100 flex items-center gap-3 justify-center sm:justify-start">
                    <button onClick={handleToggleEmail} className={`w-10 h-5 rounded-full flex items-center p-1 transition-colors ${emailOptIn ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'}`}>
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

        {/* --- CLIENT ACTIVE BOOKINGS --- */}
        {isMyProfile && clientAppointments.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide mb-6">My Service Bookings</h2>
            <div className="space-y-4">
              {clientAppointments.map(appt => (
                <div key={appt.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md mb-2 inline-block ${appt.status === 'released' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}>
                      {appt.status.replace('_', ' ')}
                    </span>
                    <h4 className="font-bold text-slate-900">Provider: @{appt.provider_username}</h4>
                    <p className="text-xs text-slate-500 font-medium mt-1">Date: {new Date(appt.scheduled_start).toLocaleString()}</p>
                    <p className="text-xs font-bold text-slate-700 mt-1">Escrow: {appt.escrow_amount.toFixed(2)} SC</p>
                  </div>
                  
                  {(appt.status === 'pending_confirmation' || appt.status === 'checked_in') && (
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto mt-4 sm:mt-0">
                      {appt.status === 'pending_confirmation' && (
                        <button onClick={() => handleConfirmJob(appt)} className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-sm active:scale-95 uppercase tracking-wider text-sm">
                          Confirm & Release
                        </button>
                      )}
                      <button onClick={() => handleDisputeJob(appt.id)} className="w-full sm:w-auto bg-red-50 hover:bg-red-500 text-red-600 hover:text-white font-bold py-3 px-6 rounded-xl transition-all shadow-sm active:scale-95 uppercase tracking-wider text-sm border border-red-200 hover:border-red-500">
                        Dispute
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* --- PROFILE TABS --- */}
        <div className="flex gap-4 mb-8 border-b border-slate-200 pb-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
          <button 
            onClick={() => setActiveProfileTab('timeline')} 
            className={`text-sm font-black uppercase tracking-widest pb-2 px-2 transition-all ${activeProfileTab === 'timeline' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Timeline
          </button>

          {(profile?.role?.includes('vendor') || profile?.role?.includes('service_provider')) && (
            <button 
              onClick={() => setActiveProfileTab('reviews')} 
              className={`text-sm font-black uppercase tracking-widest pb-2 px-2 transition-all flex items-center gap-2 ${activeProfileTab === 'reviews' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Reviews <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">{reviews.length}</span>
            </button>
          )}

          {profile?.role?.includes('vendor') && (
            <button 
              onClick={() => setActiveProfileTab('catalog')} 
              className={`text-sm font-black uppercase tracking-widest pb-2 px-2 transition-all flex items-center gap-2 ${activeProfileTab === 'catalog' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Catalog <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">{listings.filter(p => p.post_type === 'vendor_drop').length}</span>
            </button>
          )}

          {profile?.role?.includes('service_provider') && (
            <button 
              onClick={() => setActiveProfileTab('services')} 
              className={`text-sm font-black uppercase tracking-widest pb-2 px-2 transition-all flex items-center gap-2 ${activeProfileTab === 'services' ? 'text-slate-900 border-b-2 border-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Services <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">{providerServices.length}</span>
            </button>
          )}
        </div>

        {/* --- REVIEWS VIEW --- */}
        {activeProfileTab === 'reviews' && (
          <div className="animate-fade-in space-y-4">
            {reviews.length === 0 ? (
              <div className="text-center p-10 bg-white rounded-3xl border border-slate-200 border-dashed text-slate-500 font-medium shadow-sm">No reviews yet.</div>
            ) : (
              reviews.map(review => (
                <div key={review.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-start">
                  <img src={review.reviewer_avatar} alt={review.reviewer_username} className="w-12 h-12 rounded-full object-cover border border-slate-200" />
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-bold text-slate-900 block">@{review.reviewer_username}</span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{new Date(review.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex text-orange-400 text-sm">
                        {[...Array(5)].map((_, i) => (
                          <i key={i} className={`fa-solid fa-star ${i < review.rating ? '' : 'text-slate-200'}`}></i>
                        ))}
                      </div>
                    </div>
                    <p className="text-sm font-medium text-slate-700 whitespace-pre-wrap">{review.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* --- CATALOG VIEW --- */}
        {activeProfileTab === 'catalog' && (
          <div className="animate-fade-in grid grid-cols-1 sm:grid-cols-2 gap-4">
            {listings.filter(p => p.post_type === 'vendor_drop').length === 0 ? (
               <div className="col-span-full text-center p-10 bg-white rounded-3xl border border-slate-200 border-dashed text-slate-500 font-medium shadow-sm">No products listed.</div>
            ) : (
              listings.filter(p => p.post_type === 'vendor_drop').map(item => (
                <div key={item.id} className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200 flex flex-col hover:border-orange-200 transition-colors">
                  {item.image_url && <img src={item.image_url} alt={item.title} className="w-full h-40 object-cover rounded-2xl mb-4 bg-slate-50 border border-slate-100" />}
                  <h3 className="font-bold text-slate-900 uppercase tracking-wide truncate">{item.title}</h3>
                  <div className="flex justify-between items-center mt-auto pt-4 border-t border-slate-100">
                    <span className="text-lg font-black text-emerald-600">${item.price?.toFixed(2)}</span>
                    <button className="bg-slate-900 hover:bg-orange-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm uppercase tracking-widest active:scale-95">
                      Buy Drop
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* --- SERVICES VIEW --- */}
        {activeProfileTab === 'services' && (
          <div className="animate-fade-in grid grid-cols-1 gap-4">
            {providerServices.length === 0 ? (
               <div className="text-center p-10 bg-white rounded-3xl border border-slate-200 border-dashed text-slate-500 font-medium shadow-sm">No active services.</div>
            ) : (
              providerServices.map(service => (
                <div key={service.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-5 hover:border-cyan-200 transition-colors">
                  <img src={service.image_url} alt={service.title} className="w-full sm:w-32 h-32 object-cover rounded-2xl border border-slate-100 bg-slate-50" />
                  <div className="flex-1 flex flex-col">
                    <h3 className="font-bold text-slate-900 text-lg uppercase tracking-wide">{service.title}</h3>
                    <p className="text-sm text-slate-500 font-medium mt-1 line-clamp-2">{service.description}</p>
                    <div className="mt-auto pt-4 flex justify-between items-center">
                      <span className="text-lg font-black text-emerald-600">{service.price.toFixed(2)} SC</span>
                      <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm uppercase tracking-widest active:scale-95 flex items-center gap-2">
                         <i className="fa-solid fa-calendar-check"></i> Book Job
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* User Timeline */}
        {activeProfileTab === 'timeline' && (
        <div className="animate-fade-in">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide">Timeline</h2>
            {isMyProfile && profile.username !== 'admin' && (
              <button onClick={() => setShowListingForm(!showListingForm)} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition active:scale-95">
                {showListingForm ? 'Cancel' : '+ New Post'}
              </button>
            )}
          </div>

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
                    <input required type="text" value={listingTitle} onChange={(e)=>setListingTitle(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-orange-500 font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Price ($)</label>
                    <input required type="number" min="1" step="0.01" value={listingPrice} onChange={(e)=>setListingPrice(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-orange-500 font-medium" />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{postType === 'text' ? 'What\'s on your mind?' : 'Description'}</label>
                <textarea required value={listingDesc} onChange={(e)=>setListingDesc(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-orange-500 font-medium" rows="3" />
              </div>

              {postType !== 'text' && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Photo Upload</label>
                  {listingFile ? (
                    <div className="relative w-full h-48 mb-2 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 group shadow-inner">
                      <img src={URL.createObjectURL(listingFile)} alt="Upload preview" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => setListingFile(null)} className="absolute top-3 right-3 bg-slate-900/70 hover:bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm transition-all shadow-md">
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  ) : (
                    <input required={postType === 'image'} type="file" accept="image/*" onChange={(e)=>setListingFile(e.target.files[0])} className="w-full p-2 border border-slate-300 rounded-xl text-sm font-medium bg-slate-50" />
                  )}
                </div>
              )}

              <button disabled={isSubmittingListing} type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-md transition disabled:opacity-50 active:scale-95">
                {isSubmittingListing ? 'Posting...' : 'Post to Timeline'}
              </button>
            </form>
          )}

          <div className="space-y-4">
            {listings.length === 0 ? (
              <div className="text-center p-10 bg-white rounded-3xl border border-slate-200 border-dashed text-slate-500 font-medium shadow-sm">No posts yet.</div>
            ) : (
              listings.map(item => (
                <div key={item.id} className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition group relative">
                  {isMyProfile && profile?.username !== 'admin' && (
                    <div className="absolute top-4 right-4 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity bg-white p-1 rounded-lg shadow-sm border border-slate-100 z-10">
                      <button onClick={() => { setEditingPostId(item.id); setEditPayload({ title: item.title || '', description: item.description || '', price: item.price || '' }); }} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-md transition-colors" title="Edit Post"><i className="fa-solid fa-pen"></i></button>
                      <button onClick={() => handleDeleteMyPost(item.id)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Delete Post"><i className="fa-solid fa-trash"></i></button>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-5">
                    {item.post_type !== 'text' && item.image_url && (
                      <img src={item.image_url} alt="Post media" className="w-full sm:w-32 h-32 object-cover rounded-2xl bg-slate-50 border border-slate-100 flex-shrink-0" />
                    )}
                    <div className="flex flex-col flex-1 min-w-0">
                      {editingPostId === item.id ? (
                        <form onSubmit={(e) => handleEditSubmit(e, item.id)} className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-2">
                          {item.post_type === 'vendor_drop' && (
                            <div className="flex gap-2">
                              <input type="text" value={editPayload.title} onChange={e => setEditPayload({...editPayload, title: e.target.value})} className="flex-1 p-2 rounded-xl text-sm border border-slate-300 focus:ring-2 focus:ring-cyan-500" required />
                              <input type="number" step="0.01" value={editPayload.price} onChange={e => setEditPayload({...editPayload, price: e.target.value})} className="w-24 p-2 rounded-xl text-sm border border-slate-300 focus:ring-2 focus:ring-cyan-500" required />
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
                          <button onClick={() => handleLike(item.id)} className="flex items-center gap-1.5 text-slate-500 hover:text-orange-500 transition-colors text-sm font-bold active:scale-90"><i className="fa-solid fa-heart"></i> {item.likes_count || 0}</button>
                          <button onClick={() => handleToggleComments(item.id)} className={`flex items-center gap-1.5 transition-colors text-sm font-bold ${activeCommentPostId === item.id ? 'text-cyan-600' : 'text-slate-500 hover:text-cyan-600'}`}><i className="fa-solid fa-comment"></i> {item.comments_count || 0}</button>
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2">
                          <span>{new Date(item.created_at).toLocaleDateString()}</span>
                          {item.post_type === 'vendor_drop' && <span className="bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">Drop</span>}
                        </div>
                      </div>
                      
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
                            <input type="text" placeholder="Reply..." value={commentInput} onChange={(e) => setCommentInput(e.target.value)} className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 font-medium" required />
                            <button disabled={isSubmittingComment} type="submit" className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-800 disabled:opacity-50 transition-all shadow-sm">Post</button>
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
        )}
      </main>

      {/* --- POST-ESCROW REVIEW MODAL --- */}
      {showReviewModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col relative overflow-hidden">
            <div className="bg-orange-50 px-6 py-4 flex flex-col items-center border-b border-orange-100 text-center relative">
              <button onClick={() => setShowReviewModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-bold transition">✕</button>
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-orange-200 mb-3">
                <i className="fa-solid fa-handshake text-2xl text-orange-500"></i>
              </div>
              <h3 className="font-black text-xl text-slate-900 uppercase tracking-wide">Rate Your Experience</h3>
              <p className="text-xs font-bold text-slate-500 mt-1">Help @{reviewPayload.target_username} build their Trust Score.</p>
            </div>
            
            <form onSubmit={handleSubmitReview} className="p-6">
              <div className="flex justify-center gap-2 mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button 
                    key={star} 
                    type="button" 
                    onClick={() => setReviewPayload({...reviewPayload, rating: star})}
                    className="text-4xl transition-transform hover:scale-110 focus:outline-none"
                  >
                    <i className={`fa-solid fa-star ${star <= reviewPayload.rating ? 'text-orange-400 drop-shadow-sm' : 'text-slate-200 hover:text-orange-200'}`}></i>
                  </button>
                ))}
              </div>
              
              <div className="mb-6">
                <textarea 
                  required 
                  placeholder="How was the service? Drop a quick review..." 
                  value={reviewPayload.text} 
                  onChange={(e) => setReviewPayload({...reviewPayload, text: e.target.value})} 
                  className="w-full p-4 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-orange-500 font-medium bg-slate-50 resize-none h-32" 
                />
              </div>
              
              <button disabled={isSubmittingReview} type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-xl shadow-lg transition-all active:scale-95 uppercase tracking-widest disabled:opacity-50">
                {isSubmittingReview ? 'Publishing...' : 'Publish Review'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- ONBOARDING MODAL --- */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col relative overflow-hidden">
            <div className={`px-6 py-4 flex items-center justify-between border-b ${upgradeRole === 'vendor' ? 'bg-purple-50 border-purple-100' : 'bg-cyan-50 border-cyan-100'}`}>
              <h3 className={`font-black text-lg flex items-center gap-2 ${upgradeRole === 'vendor' ? 'text-purple-900' : 'text-cyan-900'}`}>
                {upgradeRole === 'vendor' ? <><i className="fa-solid fa-shop"></i> Vendor Onboarding</> : <><i className="fa-solid fa-briefcase"></i> Service Provider Onboarding</>}
              </h3>
              <button onClick={() => { setShowUpgradeModal(false); setOnboardingData({ ...onboardingData, complianceAgreed: false }); }} className="text-slate-400 hover:text-slate-700 font-bold transition">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form onSubmit={handleUpgradeAccount} className="space-y-4">
                
                {upgradeRole === 'vendor' ? (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Store / Brand Name</label>
                      <input type="text" value={onboardingData.vendorName} onChange={e => setOnboardingData({...onboardingData, vendorName: e.target.value})} placeholder={`e.g. ${profile.username}'s Vault`} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 font-medium" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Merch Category</label>
                        <select value={onboardingData.merchCategory} onChange={e => setOnboardingData({...onboardingData, merchCategory: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 font-medium text-sm">
                          <option>Apparel</option><option>Auto Parts</option><option>Electronics</option><option>Digital Goods</option><option>Custom / Handmade</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Fulfillment</label>
                        <select value={onboardingData.fulfillmentModel} onChange={e => setOnboardingData({...onboardingData, fulfillmentModel: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 font-medium text-sm">
                          <option>Direct Shipping</option><option>Local Pickup</option><option>Dropshipped</option>
                        </select>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Base ZIP Code / Origin</label>
                      <input type="text" maxLength="5" placeholder="Enter ZIP" value={onboardingData.zipCode} onChange={(e) => handleZipLookup(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-purple-500 font-medium text-sm" required />
                      
                      {onboardingData.city && (
                        <div className="text-xs font-bold text-purple-600 bg-purple-50 p-2 rounded-lg mt-2 inline-block">
                          <i className="fa-solid fa-map-location-dot mr-2"></i>
                          Operations Based In: {onboardingData.city}, {onboardingData.state}
                        </div>
                      )}
                    </div>

                    <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl mt-4">
                      <p className="text-xs text-purple-900 font-medium leading-relaxed mb-3">I guarantee all physical items are authentic and legally obtained. I understand that selling counterfeit, illegal, or restricted goods will result in immediate permanent account suspension and forfeiture of escrow funds.</p>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={onboardingData.complianceAgreed} onChange={e => setOnboardingData({...onboardingData, complianceAgreed: e.target.checked})} className="w-4 h-4 accent-purple-600 rounded cursor-pointer" />
                        <span className="text-xs font-bold text-purple-900">I agree to these terms.</span>
                      </label>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Primary Trade *</label>
                      <select required value={onboardingData.primaryTrade} onChange={e => setOnboardingData({...onboardingData, primaryTrade: e.target.value, complianceAgreed: false})} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-cyan-500 font-medium text-sm">
                        <option value="" disabled>-- Select your hustle --</option>
                        <option value="mobile_mechanic">Mobile Mechanic / Auto Repair</option>
                        <option value="hair_beauty">Hair & Beauty / Barber</option>
                        <option value="home_service">Home Services & Cleaning</option>
                        <option value="web_development">Web & App Development</option>
                        <option value="graphic_design">Graphic Design & Digital Art</option>
                      </select>
                    </div>
                    
                    <div className="space-y-4 mt-4">
                      <div className="flex gap-4">
                        <div className="w-1/2">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Operating Hours</label>
                          <select value={onboardingData.operatingHours} onChange={e => setOnboardingData({...onboardingData, operatingHours: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-cyan-500 font-medium text-sm">
                            <option>Standard 9-5</option><option>Weekends Only</option><option>Evenings</option><option>24/7 Emergency</option>
                          </select>
                        </div>
                        <div className="w-1/2">
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Base ZIP Code</label>
                          <input type="text" maxLength="5" placeholder="Enter ZIP" value={onboardingData.zipCode} onChange={(e) => handleZipLookup(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-cyan-500 font-medium text-sm" required />
                        </div>
                      </div>
                      
                      {onboardingData.city && (
                        <div className="text-xs font-bold text-cyan-600 bg-cyan-50 p-2 rounded-lg inline-block">
                          <i className="fa-solid fa-map-location-dot mr-2"></i>
                          Service Region: {onboardingData.city}, {onboardingData.state}
                        </div>
                      )}
                    </div>
                    
                    {onboardingData.primaryTrade && (
                      <div className="bg-cyan-50 border border-cyan-200 p-4 rounded-xl mt-4 transition-all">
                        <p className="text-xs text-cyan-900 font-medium leading-relaxed mb-3">
                          {SERVICE_COMPLIANCE[onboardingData.primaryTrade]}
                        </p>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={onboardingData.complianceAgreed} onChange={e => setOnboardingData({...onboardingData, complianceAgreed: e.target.checked})} className="w-4 h-4 accent-cyan-600 rounded cursor-pointer" />
                          <span className="text-xs font-bold text-cyan-900">I agree to these terms.</span>
                        </label>
                      </div>
                    )}
                  </>
                )}

                <button type="submit" disabled={!onboardingData.complianceAgreed} className={`w-full text-white font-black py-4 rounded-xl transition-all uppercase tracking-wider mt-4 disabled:opacity-50 ${upgradeRole === 'vendor' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-cyan-600 hover:bg-cyan-700'}`}>
                  Complete Onboarding
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --- WEB-TO-MOBILE KYC HANDOFF MODAL --- */}
      {showKycModal && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm flex flex-col relative overflow-hidden text-center">
            <div className="bg-slate-900 px-6 py-6 flex flex-col items-center border-b border-slate-800 relative">
              <button onClick={() => setShowKycModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white font-bold transition">✕</button>
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center border border-white/20 mb-3">
                <i className="fa-solid fa-fingerprint text-2xl text-cyan-400"></i>
              </div>
              <h3 className="font-black text-xl text-white uppercase tracking-wide">Secure Verification</h3>
            </div>
            
            <div className="p-8 flex flex-col items-center">
              <p className="text-sm font-medium text-slate-600 mb-6 leading-relaxed">
                Browser cameras compromise security. To complete your biometric KYC and protect the ecosystem, you must use the native Street Code 101 mobile app.
              </p>
              
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-inner mb-6">
                <img 
                  src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://streetcode101.com/download" 
                  alt="Download App QR Code" 
                  className="w-40 h-40 object-contain mix-blend-multiply" 
                />
              </div>
              
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Scan to download the app
              </p>
            </div>
            
            <div className="bg-slate-50 p-4 border-t border-slate-100">
              <button onClick={() => setShowKycModal(false)} className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 rounded-xl transition-all active:scale-95 uppercase tracking-wider text-sm">
                I'll do this later
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
