import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from './Navbar';
import { useCart } from './CartContext';

const API_BASE = 'http://127.0.0.1:8000/api';

export default function Profile() {
  const { username } = useParams(); // 'me' or an actual username
  const navigate = useNavigate();
  const { clearCart } = useCart();
  
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Edit Bio State
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [newBio, setNewBio] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // New Listing State
  const [showListingForm, setShowListingForm] = useState(false);
  const [listingTitle, setListingTitle] = useState('');
  const [listingDesc, setListingDesc] = useState('');
  const [listingPrice, setListingPrice] = useState('');
  const [listingFile, setListingFile] = useState(null);
  const [isSubmittingListing, setIsSubmittingListing] = useState(false);

  const token = localStorage.getItem('pidrop_token');
  const isMyProfile = username === 'me';

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
        
        // Once we know the actual username, fetch their wall listings!
        return fetch(`${API_BASE}/profile/${data.username}/listings`);
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

  const handleCreateListing = async (e) => {
    e.preventDefault();
    setIsSubmittingListing(true);
    
    const formData = new FormData();
    formData.append('title', listingTitle);
    formData.append('description', listingDesc);
    formData.append('price', listingPrice);
    if (listingFile) formData.append('file', listingFile);

    try {
      const response = await fetch(`${API_BASE}/profile/me/listings`, {
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

  const handleLogout = () => {
    localStorage.removeItem('pidrop_token');
    clearCart();
    navigate('/login');
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
            <div className="text-center sm:text-left">
              <h1 className="text-3xl font-black text-slate-900">@{profile.username}</h1>
              <p className="text-sm font-bold text-cyan-600 mt-1 uppercase tracking-widest">
                {profile.username === 'admin' ? 'Master Admin' : 'Verified Vendor'}
              </p>

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
              </div>
            </div>
          </div>
        </div>

        {/* Vendor Listings Wall */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide">Vendor Listings</h2>
            {isMyProfile && profile.username !== 'admin' && (
              <button 
                onClick={() => setShowListingForm(!showListingForm)}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition active:scale-95"
              >
                {showListingForm ? 'Cancel' : '+ New Listing'}
              </button>
            )}
          </div>

          {/* New Listing Form */}
          {showListingForm && (
            <form onSubmit={handleCreateListing} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 mb-8 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Item Title</label>
                <input required type="text" value={listingTitle} onChange={(e)=>setListingTitle(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-orange-500 font-medium" placeholder="e.g. Mechanical Keyboard" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Price ($)</label>
                <input required type="number" min="1" step="0.01" value={listingPrice} onChange={(e)=>setListingPrice(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-orange-500 font-medium" placeholder="45.00" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                <textarea required value={listingDesc} onChange={(e)=>setListingDesc(e.target.value)} className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-orange-500 font-medium" rows="3" placeholder="Condition, specs, etc." />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Product Photo</label>
                <input type="file" accept="image/*" onChange={(e)=>setListingFile(e.target.files[0])} className="w-full p-2 border border-slate-300 rounded-xl text-sm font-medium bg-slate-50" />
              </div>
              <button disabled={isSubmittingListing} type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-md transition disabled:opacity-50 active:scale-95">
                {isSubmittingListing ? 'Uploading...' : 'Post to Wall'}
              </button>
            </form>
          )}

          {/* Feed of Listings */}
          <div className="space-y-4">
            {listings.length === 0 ? (
              <div className="text-center p-10 bg-white rounded-3xl border border-slate-200 border-dashed text-slate-500 font-medium shadow-sm">
                No items listed yet.
              </div>
            ) : (
              listings.map(item => (
                <div key={item.id} className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4 hover:shadow-md transition">
                  <img src={item.image_url} alt={item.title} className="w-full sm:w-32 h-32 object-cover rounded-2xl bg-slate-50 border border-slate-100 flex-shrink-0" />
                  <div className="flex flex-col flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-bold text-slate-900 truncate pr-4">{item.title}</h3>
                      <span className="text-xl font-black text-emerald-600">${item.price.toFixed(2)}</span>
                    </div>
                    <p className="text-sm text-slate-500 line-clamp-2 mb-3 leading-relaxed font-medium">{item.description}</p>
                    <div className="mt-auto text-xs text-slate-400 font-bold uppercase tracking-wider">
                      Posted on {new Date(item.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
