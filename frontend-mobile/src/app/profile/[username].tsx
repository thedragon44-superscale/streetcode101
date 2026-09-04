import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, 
  TextInput, ActivityIndicator, Alert, Dimensions, Modal, KeyboardAvoidingView, Platform 
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { useCart } from '../../context/CartContext';
import { Ionicons } from '@expo/vector-icons';
import Header from '../../components/Header';

const API_BASE = "https://streetcode101.com/api";
const { width } = Dimensions.get('window');

const SERVICE_COMPLIANCE: any = {
  mobile_mechanic: "I agree to use the GPS check-in system, assume all liability for vehicular damage, parts, and tools, and accept the standard 5% escrow fee.",
  hair_beauty: "I confirm that I maintain sanitary tools, hold local grooming certifications, agree to use GPS check-in, and accept the standard 5% escrow fee.",
  home_service: "I agree to use the GPS check-in system, respect client property, assume full financial responsibility for damage, and accept the 5% escrow fee.",
  web_development: "I agree to deliver functional code remotely, submit valid proof-of-delivery, avoid malicious exploits, and accept the 5% escrow fee.",
  graphic_design: "I guarantee all artwork is original, agree to submit proof-of-delivery remotely, avoid copyright infringement, and accept the 5% escrow fee."
};

const parseMentions = (text: string) => {
  if (!text) return null;
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? <Text key={i} style={styles.mentionText}>{part}</Text> : <Text key={i}>{part}</Text>
  );
};

export default function ProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const { clearCart } = useCart();
  
  const [profile, setProfile] = useState<any>(null);
  const [listings, setListings] = useState<any[]>([]);
  const [clientAppointments, setClientAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Profile Settings
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [newBio, setNewBio] = useState('');
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Reviews & Commerce
  const [reviews, setReviews] = useState<any[]>([]);
  const [providerServices, setProviderServices] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('timeline'); 
  
  // Modals & Forms
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewPayload, setReviewPayload] = useState({ target_username: '', appointment_id: 0, rating: 5, text: '' });
  
  // New Post State
  const [showListingForm, setShowListingForm] = useState(false);
  const [postType, setPostType] = useState<'text'|'image'|'vendor_drop'>('text');
  const [listingTitle, setListingTitle] = useState('');
  const [listingDesc, setListingDesc] = useState('');
  const [listingPrice, setListingPrice] = useState('');
  const [listingImage, setListingImage] = useState<any>(null);
  const [isSubmittingListing, setIsSubmittingListing] = useState(false);

  // Edit/Comment State
  const [activeCommentPostId, setActiveCommentPostId] = useState<number | null>(null);
  const [postComments, setPostComments] = useState<any[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editPayload, setEditPayload] = useState({ title: '', description: '', price: '' });

  // Upgrade State
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeRole, setUpgradeRole] = useState(''); 
  const [onboardingData, setOnboardingData] = useState({
    primaryTrade: '', operatingHours: 'Standard 9-5', vendorName: '', merchCategory: 'Apparel', 
    fulfillmentModel: 'Direct Shipping', zipCode: '', city: '', state: '', complianceAgreed: false
  });

  const isMyProfile = username === 'me';

  useFocusEffect(
    React.useCallback(() => {
      fetchProfileData();
    }, [username])
  );

  const fetchProfileData = async () => {
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('pidrop_token');
      
      if (isMyProfile && !token) {
        return router.replace('/login');
      }

      const endpoint = isMyProfile ? '/profile/me' : `/profile/${username}`;
      const headers: any = token ? { 
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-store'
      } : { 
        'Cache-Control': 'no-store' 
      };

      // Append timestamp to forcefully bypass aggressive OS GET caching
      const profileRes = await fetch(`${API_BASE}${endpoint}?t=${Date.now()}`, { headers });
      if (!profileRes.ok) throw new Error('Profile not found');
      const profileData = await profileRes.json();
      
      setProfile(profileData);
      setNewBio(profileData.bio || '');
      setEmailOptIn(profileData.email_opt_in || false);

      const [postsRes, reviewsRes, servicesRes] = await Promise.all([
        fetch(`${API_BASE}/posts/user/${profileData.username}`),
        fetch(`${API_BASE}/reviews/${profileData.username}`),
        fetch(`${API_BASE}/services`)
      ]);

      setListings(postsRes.ok ? await postsRes.json() : []);
      setReviews(reviewsRes.ok ? await reviewsRes.json() : []);
      
      if (servicesRes.ok) {
        const allServices = await servicesRes.json();
        setProviderServices(allServices.filter((s: any) => s.provider_username === profileData.username));
      }

      if (isMyProfile && token) {
        const apptRes = await fetch(`${API_BASE}/client/appointments`, { headers });
        if (apptRes.ok) setClientAppointments(await apptRes.json());
      }
    } catch (err) {
      Alert.alert("Error", "Could not load profile.");
      if (isMyProfile) router.replace('/login');
    } finally {
      setLoading(false);
    }
  };
  // --- ACTIONS ---

  const handleAvatarUpload = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      return Alert.alert("Permission Required", "Please allow access to your photos.");
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], // Needs to be plural 'images' per the new Expo API
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setIsUploading(true);
      try {
        const token = await SecureStore.getItemAsync('pidrop_token');
        const localUri = result.assets[0].uri;
        const filename = localUri.split('/').pop() || 'avatar.jpg';
        const match = /\.(\w+)$/.exec(filename);
        // The new Expo File class implements standard Web APIs natively
        const file = new File(localUri);
        const formData = new FormData();
        formData.append('file', file as any);

        const response = await fetch(`${API_BASE}/profile/me/image`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });

        const data = await response.json();
        if (!response.ok) {
           throw new Error(data.detail || 'Upload failed');
        }
        
        setProfile({ ...profile, profile_image_url: data.profile_image_url });
        Alert.alert("Success", "Avatar updated successfully!");
      } catch (err: any) {
        Alert.alert("Error", err.message);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleToggleFollow = async () => {
    const token = await SecureStore.getItemAsync('pidrop_token');
    if (!token) return Alert.alert("Hold up", "You must be logged in to follow users.");
    
    try {
      const res = await fetch(`${API_BASE}/users/${profile.username}/follow`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to toggle follow status');
      const data = await res.json();
      
      setProfile((prev: any) => ({
        ...prev,
        is_following: data.is_following,
        followers_count: data.is_following ? (prev.followers_count || 0) + 1 : (prev.followers_count || 1) - 1
      }));
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleBioSave = async () => {
    try {
      const token = await SecureStore.getItemAsync('pidrop_token');
      const response = await fetch(`${API_BASE}/profile/me`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio: newBio })
      });
      if (!response.ok) throw new Error('Failed to update bio');
      
      setProfile({ ...profile, bio: newBio });
      setIsEditingBio(false);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleToggleEmail = async () => {
    const newValue = !emailOptIn;
    setEmailOptIn(newValue);
    try {
      const token = await SecureStore.getItemAsync('pidrop_token');
      const res = await fetch(`${API_BASE}/profile/me`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_opt_in: newValue })
      });
      if (!res.ok) throw new Error('Failed to update settings');
      Alert.alert("Settings Updated", newValue ? 'Email alerts enabled!' : 'Email alerts disabled.');
    } catch (err: any) {
      setEmailOptIn(!newValue);
      Alert.alert("Error", err.message);
    }
  };

  const handleCreateListing = async () => {
    if (!listingDesc.trim()) return Alert.alert("Error", "Description is required.");
    if (postType === 'vendor_drop' && (!listingTitle.trim() || !listingPrice.trim())) {
      return Alert.alert("Error", "Title and Price are required for drops.");
    }
    
    setIsSubmittingListing(true);
    try {
      const token = await SecureStore.getItemAsync('pidrop_token');
      const formData = new FormData();
      formData.append('post_type', postType);
      formData.append('description', listingDesc);
      
      if (postType === 'vendor_drop') {
        formData.append('title', listingTitle);
        formData.append('price', listingPrice);
      }
      
      if (listingImage && postType !== 'text') {
        // Bridge directly to FormData with the modern Expo File wrapper
        const file = new File(listingImage.uri);
        formData.append('file', file as any);
      }

      const response = await fetch(`${API_BASE}/posts`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to create listing');
      
      setListings([data.post || data, ...listings]);
      setShowListingForm(false);
      setListingTitle(''); setListingDesc(''); setListingPrice(''); setListingImage(null); setPostType('text');
      Alert.alert("Success", "Listing posted to your wall!");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setIsSubmittingListing(false);
    }
  };

  const pickListingImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], // Needs to be plural 'images' per the new Expo API
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) setListingImage(result.assets[0]);
  };

  const handleDeleteMyPost = async (id: number) => {
    Alert.alert("Delete Post", "Are you sure you want to permanently delete this post?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          const token = await SecureStore.getItemAsync('pidrop_token');
          const res = await fetch(`${API_BASE}/posts/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) throw new Error('Failed to delete post');
          setListings(prev => prev.filter(p => p.id !== id));
        } catch (err: any) {
          Alert.alert("Error", err.message);
        }
      }}
    ]);
  };

  const handleEditSubmit = async (id: number) => {
    try {
      const token = await SecureStore.getItemAsync('pidrop_token');
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
        ...p, title: editPayload.title, description: editPayload.description, 
        price: editPayload.price ? parseFloat(editPayload.price) : p.price 
      } : p));
      
      setEditingPostId(null);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleDisputeJob = async (appointmentId: number) => {
    Alert.alert("Dispute Job", "Freeze escrow and alert Master Admin?", [
      { text: "Cancel", style: "cancel" },
      { text: "Dispute", style: "destructive", onPress: async () => {
        try {
          const token = await SecureStore.getItemAsync('pidrop_token');
          const res = await fetch(`${API_BASE}/appointments/${appointmentId}/dispute`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) throw new Error('Failed to file dispute');
          setClientAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, status: 'disputed' } : a));
          Alert.alert("Disputed", "Escrow frozen.");
        } catch (err: any) {
          Alert.alert("Error", err.message);
        }
      }}
    ]);
  };

  const handleConfirmJob = async (appt: any) => {
    try {
      const token = await SecureStore.getItemAsync('pidrop_token');
      const res = await fetch(`${API_BASE}/appointments/${appt.id}/confirm`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to release funds');
      
      setClientAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, status: 'released' } : a));
      setReviewPayload({ target_username: appt.provider_username, appointment_id: appt.id, rating: 5, text: '' });
      setShowReviewModal(true);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewPayload.text.trim()) return Alert.alert("Required", "Please leave a brief written review.");
    try {
      const token = await SecureStore.getItemAsync('pidrop_token');
      const res = await fetch(`${API_BASE}/reviews`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewPayload)
      });
      if (!res.ok) throw new Error('Failed to submit review');
      
      Alert.alert("Success", "Review published! Trust score updated.");
      setShowReviewModal(false);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handlePostComment = async (postId: number) => {
    if (!commentInput.trim()) return;
    setIsSubmittingComment(true);
    try {
      const token = await SecureStore.getItemAsync('pidrop_token');
      const res = await fetch(`${API_BASE}/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: commentInput })
      });
      if (!res.ok) throw new Error('Failed to post comment');
      const newComment = await res.json();
      
      setPostComments([...postComments, newComment]);
      setCommentInput('');
      setListings(prev => prev.map(p => p.id === postId ? { ...p, comments_count: (p.comments_count || 0) + 1 } : p));
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleToggleComments = async (postId: number) => {
    if (activeCommentPostId === postId) {
      setActiveCommentPostId(null);
      return;
    }
    setActiveCommentPostId(postId);
    setPostComments([]); 
    try {
      const res = await fetch(`${API_BASE}/posts/${postId}/comments`);
      if (res.ok) setPostComments(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const handleLike = async (postId: number) => {
    try {
      const token = await SecureStore.getItemAsync('pidrop_token');
      const res = await fetch(`${API_BASE}/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to like post');
      const data = await res.json();
      setListings(prev => prev.map(p => p.id === postId ? { ...p, likes_count: data.liked ? (p.likes_count || 0) + 1 : (p.likes_count || 1) - 1 } : p));
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleZipLookup = async (zip: string) => {
    setOnboardingData(prev => ({ ...prev, zipCode: zip }));
    if (zip.length === 5) {
      try {
        const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
        if (res.ok) {
          const data = await res.json();
          setOnboardingData(prev => ({ 
            ...prev, city: data.places[0]['place name'], state: data.places[0]['state abbreviation'] 
          }));
        }
      } catch (err) {
        setOnboardingData(prev => ({ ...prev, city: '', state: '' }));
      }
    }
  };

  const handleUpgradeAccount = async () => {
    if (!onboardingData.complianceAgreed) return Alert.alert("Required", "You must agree to the compliance terms.");
    if (upgradeRole === 'service_provider' && !onboardingData.primaryTrade) return Alert.alert("Required", "Please select a primary trade.");
    
    try {
      const token = await SecureStore.getItemAsync('pidrop_token');
      const res = await fetch(`${API_BASE}/profile/upgrade`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_role: upgradeRole, onboarding_data: onboardingData })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to upgrade account');
      
      setProfile((prev: any) => ({ ...prev, role: data.role }));
      setShowUpgradeModal(false);
      Alert.alert("Success", `Welcome to the ${upgradeRole === 'vendor' ? 'Vendor' : 'Service'} Economy!`);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  if (loading || !profile) {
    return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#06b6d4" /></View>;
  }

  const isVendor = profile.role?.includes('vendor');
  const isProvider = profile.role?.includes('service_provider');

  return (
    <View style={styles.container}>
      
      <Header />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.coverPhoto}>
            {isMyProfile && (
              <TouchableOpacity onPress={() => { SecureStore.deleteItemAsync('pidrop_token'); clearCart(); router.replace('/'); }} style={styles.logoutBtn}>
                <Text style={styles.logoutBtnText}>SIGN OUT</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.profileContent}>
            <View style={styles.avatarContainer}>
              <Image source={{ uri: profile.profile_image_url || 'https://streetcode101.com/favicon.ico' }} style={styles.avatar} />
              {isMyProfile && (
                <TouchableOpacity onPress={handleAvatarUpload} disabled={isUploading} style={styles.avatarEditBtn}>
                  {isUploading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.avatarEditIcon}>📷</Text>}
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.profileHeaderRow}>
              <View>
                <Text style={styles.username}>@{profile.username}</Text>
                <Text style={[styles.roleText, profile.username === 'admin' ? {color: '#f97316'} : (isVendor || isProvider) ? {color: '#06b6d4'} : {}]}>
                  {profile.username === 'admin' ? 'Master Admin' : 
                   [isVendor ? 'Verified Vendor' : null, isProvider ? 'Service Provider' : null].filter(Boolean).join(' & ') || 'Community Member'}
                </Text>
              </View>
              
              {!isMyProfile && (
                <TouchableOpacity onPress={handleToggleFollow} style={[styles.followBtn, profile.is_following && styles.followBtnActive]}>
                  <Text style={[styles.followBtnText, profile.is_following && styles.followBtnTextActive]}>{profile.is_following ? 'UNFOLLOW' : 'FOLLOW'}</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{profile.followers_count || 0}</Text>
                <Text style={styles.statLabel}>FOLLOWERS</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{profile.following_count || 0}</Text>
                <Text style={styles.statLabel}>FOLLOWING</Text>
              </View>
            </View>

            {isMyProfile && profile.username !== 'admin' && (!isVendor || !isProvider) && (
              <View style={styles.upgradeBox}>
                <Text style={styles.upgradeTitle}>LEVEL UP YOUR ACCOUNT</Text>
                <View style={styles.upgradeGrid}>
                  {!isVendor && (
                    <TouchableOpacity onPress={() => { setUpgradeRole('vendor'); setShowUpgradeModal(true); }} style={styles.upgradeBtnPurple}>
                      <Text style={styles.upgradeIcon}>📦</Text>
                      <Text style={styles.upgradeBtnText}>BECOME A VENDOR</Text>
                    </TouchableOpacity>
                  )}
                  {!isProvider && (
                    <TouchableOpacity onPress={() => { setUpgradeRole('service_provider'); setShowUpgradeModal(true); }} style={styles.upgradeBtnCyan}>
                      <Text style={styles.upgradeIcon}>💼</Text>
                      <Text style={styles.upgradeBtnText}>OFFER SERVICES</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {(isVendor || isProvider) && (
              <View style={styles.trustScoreRow}>
                <Text style={styles.stars}>
                  {[...Array(5)].map((_, i) => i < Math.round(profile.trust_score || 0) ? '★' : '☆').join('')}
                </Text>
                <View style={styles.trustTextCol}>
                  <Text style={styles.trustScoreText}>{profile.trust_score?.toFixed(1) || '0.0'} <Text style={styles.trustScoreLabel}>TRUST SCORE</Text></Text>
                  <Text style={styles.reviewCountText}>{profile.review_count || 0} Verified Reviews</Text>
                </View>
              </View>
            )}

            <View style={styles.bioSection}>
              <Text style={styles.sectionLabel}>BIO / MANIFESTO</Text>
              {isMyProfile && isEditingBio ? (
                <View>
                  <TextInput style={styles.bioInput} multiline value={newBio} onChangeText={setNewBio} placeholder="Write your manifesto..." />
                  <View style={styles.bioActionRow}>
                    <TouchableOpacity onPress={handleBioSave} style={styles.saveBtn}><Text style={styles.saveBtnText}>SAVE</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => { setIsEditingBio(false); setNewBio(profile.bio); }} style={styles.cancelBtn}><Text style={styles.cancelBtnText}>CANCEL</Text></TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.bioDisplayRow}>
                  <Text style={styles.bioText}>{profile.bio || 'No bio provided yet.'}</Text>
                  {isMyProfile && (
                    <TouchableOpacity onPress={() => setIsEditingBio(true)}><Text style={styles.editIcon}>✏️</Text></TouchableOpacity>
                  )}
                </View>
              )}

              {isMyProfile && (
                <View style={styles.emailToggleRow}>
                  <TouchableOpacity onPress={handleToggleEmail} style={[styles.toggleSwitch, emailOptIn && styles.toggleSwitchOn]}>
                    <View style={[styles.toggleNub, emailOptIn && styles.toggleNubOn]} />
                  </TouchableOpacity>
                  <Text style={styles.emailToggleText}>EMAIL ALERTS: {emailOptIn ? 'ON' : 'OFF'}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* CLIENT APPOINTMENTS */}
        {isMyProfile && clientAppointments.length > 0 && (
          <View style={styles.clientApptsBox}>
            <Text style={styles.sectionLabel}>MY SERVICE BOOKINGS</Text>
            {clientAppointments.map(appt => (
              <View key={appt.id} style={styles.apptCard}>
                <View style={styles.apptHeaderRow}>
                  <View style={[styles.statusBadge, appt.status === 'released' && styles.statusBadgeSuccess]}>
                    <Text style={[styles.statusBadgeText, appt.status === 'released' && styles.statusBadgeTextSuccess]}>{appt.status.replace('_', ' ')}</Text>
                  </View>
                  <Text style={styles.apptEscrow}>{appt.escrow_amount.toFixed(2)} SC</Text>
                </View>
                <Text style={styles.apptProvider}>Provider: @{appt.provider_username}</Text>
                <Text style={styles.apptDate}>Date: {new Date(appt.scheduled_start).toLocaleString()}</Text>

                {(appt.status === 'pending_confirmation' || appt.status === 'checked_in') && (
                  <View style={styles.apptActions}>
                    {appt.status === 'pending_confirmation' && (
                      <TouchableOpacity onPress={() => handleConfirmJob(appt)} style={styles.confirmBtn}>
                        <Text style={styles.confirmBtnText}>CONFIRM & RELEASE</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => handleDisputeJob(appt.id)} style={styles.disputeBtn}>
                      <Text style={styles.disputeBtnText}>DISPUTE</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
          <TouchableOpacity onPress={() => setActiveTab('timeline')} style={[styles.tabBtn, activeTab === 'timeline' && styles.tabBtnActive]}>
            <Text style={[styles.tabBtnText, activeTab === 'timeline' && styles.tabBtnTextActive]}>TIMELINE</Text>
          </TouchableOpacity>
          {(isVendor || isProvider) && (
            <TouchableOpacity onPress={() => setActiveTab('reviews')} style={[styles.tabBtn, activeTab === 'reviews' && styles.tabBtnActive]}>
              <Text style={[styles.tabBtnText, activeTab === 'reviews' && styles.tabBtnTextActive]}>REVIEWS ({reviews.length})</Text>
            </TouchableOpacity>
          )}
          {isVendor && (
            <TouchableOpacity onPress={() => setActiveTab('catalog')} style={[styles.tabBtn, activeTab === 'catalog' && styles.tabBtnActive]}>
              <Text style={[styles.tabBtnText, activeTab === 'catalog' && styles.tabBtnTextActive]}>CATALOG ({listings.filter(p => p.post_type === 'vendor_drop').length})</Text>
            </TouchableOpacity>
          )}
          {isProvider && (
            <TouchableOpacity onPress={() => setActiveTab('services')} style={[styles.tabBtn, activeTab === 'services' && styles.tabBtnActive]}>
              <Text style={[styles.tabBtnText, activeTab === 'services' && styles.tabBtnTextActive]}>SERVICES ({providerServices.length})</Text>
            </TouchableOpacity>
          )}
        </ScrollView>

        {/* --- TAB CONTENTS --- */}
        <View style={styles.tabContent}>
          
          {activeTab === 'timeline' && (
            <View>
              {/* Post Creation Form */}
              {isMyProfile && (
                <View style={styles.newPostBox}>
                  <TouchableOpacity onPress={() => setShowListingForm(!showListingForm)} style={styles.newPostToggle}>
                    <Text style={styles.newPostToggleText}>{showListingForm ? 'CANCEL POST' : '+ NEW POST'}</Text>
                  </TouchableOpacity>
                  
                  {showListingForm && (
                    <View style={styles.newPostForm}>
                      <View style={styles.postTypeRow}>
                        {(isVendor ? ['text', 'image', 'vendor_drop'] : ['text', 'image']).map((t: any) => (
                          <TouchableOpacity key={t} onPress={() => setPostType(t)} style={[styles.postTypeBtn, postType === t && styles.postTypeBtnActive]}>
                            <Text style={[styles.postTypeText, postType === t && styles.postTypeTextActive]}>{t.replace('_', ' ')}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      {postType === 'vendor_drop' && (
                        <View style={{flexDirection:'row', gap:10}}>
                          <TextInput style={[styles.bioInput, {flex:2}]} placeholder="Item Title" value={listingTitle} onChangeText={setListingTitle} />
                          <TextInput style={[styles.bioInput, {flex:1}]} placeholder="Price ($)" value={listingPrice} onChangeText={setListingPrice} keyboardType="numeric" />
                        </View>
                      )}

                      <TextInput style={[styles.bioInput, {minHeight:80, marginTop:10}]} multiline placeholder={postType==='text' ? "What's on your mind?" : "Description"} value={listingDesc} onChangeText={setListingDesc} />

                      {postType !== 'text' && (
                        <TouchableOpacity onPress={pickListingImage} style={styles.imagePickerBtn}>
                          {listingImage ? <Image source={{uri: listingImage.uri}} style={styles.imagePickerPreview} /> : <Text style={styles.imagePickerText}>📷 Select Photo</Text>}
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity onPress={handleCreateListing} disabled={isSubmittingListing} style={styles.saveBtn}>
                        <Text style={styles.saveBtnText}>{isSubmittingListing ? 'POSTING...' : 'POST TO TIMELINE'}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {listings.length === 0 ? (
                <Text style={styles.emptyText}>No posts yet.</Text>
              ) : (
                listings.map(item => (
                  <View key={item.id} style={styles.timelineCard}>
                    {/* Post Edit/Delete Icons */}
                    {isMyProfile && (
                      <View style={styles.postActionsRow}>
                        <TouchableOpacity onPress={() => { setEditingPostId(item.id); setEditPayload({ title: item.title, description: item.description, price: item.price?.toString() }); }}><Ionicons name="pencil" size={16} color="#94a3b8" /></TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteMyPost(item.id)} style={{marginLeft: 15}}><Ionicons name="trash" size={16} color="#ef4444" /></TouchableOpacity>
                      </View>
                    )}

                    {editingPostId === item.id ? (
                      <View style={{padding: 15}}>
                        {item.post_type === 'vendor_drop' && (
                          <View style={{flexDirection:'row', gap:10, marginBottom:10}}>
                            <TextInput style={[styles.bioInput, {flex:2}]} value={editPayload.title} onChangeText={t => setEditPayload({...editPayload, title: t})} />
                            <TextInput style={[styles.bioInput, {flex:1}]} value={editPayload.price} onChangeText={t => setEditPayload({...editPayload, price: t})} keyboardType="numeric" />
                          </View>
                        )}
                        <TextInput style={styles.bioInput} multiline value={editPayload.description} onChangeText={t => setEditPayload({...editPayload, description: t})} />
                        <View style={styles.bioActionRow}>
                          <TouchableOpacity onPress={() => handleEditSubmit(item.id)} style={styles.saveBtn}><Text style={styles.saveBtnText}>SAVE</Text></TouchableOpacity>
                          <TouchableOpacity onPress={() => setEditingPostId(null)} style={styles.cancelBtn}><Text style={styles.cancelBtnText}>CANCEL</Text></TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <>
                        {item.image_url && <Image source={{ uri: item.image_url }} style={styles.timelineImage} resizeMode="cover" />}
                        <View style={styles.timelineBody}>
                          {item.post_type === 'vendor_drop' && (
                            <View style={styles.dropHeader}>
                              <Text style={styles.dropTitle}>{item.title}</Text>
                              {item.price && <Text style={styles.dropPrice}>${item.price.toFixed(2)}</Text>}
                            </View>
                          )}
                          <Text style={styles.timelineText}>{parseMentions(item.description)}</Text>
                          <View style={styles.timelineFooter}>
                            <Text style={styles.timelineDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                            <View style={{flexDirection: 'row', gap: 15}}>
                              <TouchableOpacity onPress={() => handleLike(item.id)}><Text style={styles.timelineLikes}>❤️ {item.likes_count || 0}</Text></TouchableOpacity>
                              <TouchableOpacity onPress={() => handleToggleComments(item.id)}><Text style={styles.timelineLikes}>💬 {item.comments_count || 0}</Text></TouchableOpacity>
                            </View>
                          </View>
                        </View>

                        {/* Comments Block */}
                        {activeCommentPostId === item.id && (
                          <View style={styles.commentsSection}>
                            {postComments.map((c: any) => (
                              <View key={c.id} style={styles.commentBubble}>
                                <Text style={styles.commentUser}>@{c.username} <Text style={styles.commentDate}>{new Date(c.created_at).toLocaleDateString()}</Text></Text>
                                <Text style={styles.commentText}>{c.text}</Text>
                              </View>
                            ))}
                            <View style={{flexDirection:'row', gap: 10, marginTop: 10}}>
                              <TextInput style={[styles.bioInput, {flex: 1, minHeight: 40}]} placeholder="Reply..." value={commentInput} onChangeText={setCommentInput} />
                              <TouchableOpacity onPress={() => handlePostComment(item.id)} style={styles.saveBtn}><Text style={styles.saveBtnText}>POST</Text></TouchableOpacity>
                            </View>
                          </View>
                        )}
                      </>
                    )}
                  </View>
                ))
              )}
            </View>
          )}

          {activeTab === 'reviews' && (
            <View>
              {reviews.length === 0 ? (
                <Text style={styles.emptyText}>No reviews yet.</Text>
              ) : (
                reviews.map(review => (
                  <View key={review.id} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <Image source={{ uri: review.reviewer_avatar || 'https://streetcode101.com/favicon.ico' }} style={styles.reviewAvatar} />
                      <View style={styles.reviewMeta}>
                        <Text style={styles.reviewUser}>@{review.reviewer_username}</Text>
                        <Text style={styles.reviewDate}>{new Date(review.created_at).toLocaleDateString()}</Text>
                      </View>
                      <Text style={styles.stars}>
                        {[...Array(5)].map((_, i) => i < review.rating ? '★' : '☆').join('')}
                      </Text>
                    </View>
                    <Text style={styles.reviewText}>{review.text}</Text>
                  </View>
                ))
              )}
            </View>
          )}

          {activeTab === 'catalog' && (
            <View style={styles.grid}>
              {listings.filter(p => p.post_type === 'vendor_drop').map(item => (
                <TouchableOpacity key={item.id} style={styles.catalogCard} onPress={() => router.push(`/product/${item.sku}`)}>
                  {item.image_url && <Image source={{ uri: item.image_url }} style={styles.catalogImage} />}
                  <Text style={styles.catalogTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.catalogPrice}>${item.price?.toFixed(2)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {activeTab === 'services' && (
            <View>
              {providerServices.map(service => (
                <View key={service.id} style={styles.serviceCard}>
                  <Image source={{ uri: service.image_url }} style={styles.serviceImage} />
                  <View style={styles.serviceBody}>
                    <Text style={styles.serviceTitle}>{service.title}</Text>
                    <Text style={styles.serviceDesc} numberOfLines={2}>{service.description}</Text>
                    <View style={styles.serviceFooter}>
                      <Text style={styles.servicePrice}>{service.price.toFixed(2)} SC</Text>
                      <TouchableOpacity style={styles.bookBtn}><Text style={styles.bookBtnText}>BOOK JOB</Text></TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

        </View>
      </ScrollView>

      {/* --- POST-ESCROW REVIEW MODAL --- */}
      <Modal visible={showReviewModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>RATE YOUR EXPERIENCE</Text>
              <TouchableOpacity onPress={() => setShowReviewModal(false)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>
            <View style={{padding: 20}}>
              <Text style={{textAlign: 'center', marginBottom: 20, fontSize: 30}}>
                {[1,2,3,4,5].map(star => (
                  <Text key={star} onPress={() => setReviewPayload({...reviewPayload, rating: star})} style={{color: star <= reviewPayload.rating ? '#fb923c' : '#e2e8f0'}}>★</Text>
                ))}
              </Text>
              <TextInput style={[styles.bioInput, {minHeight: 100}]} multiline placeholder="Drop a quick review..." value={reviewPayload.text} onChangeText={t => setReviewPayload({...reviewPayload, text: t})} />
              <TouchableOpacity onPress={handleSubmitReview} style={[styles.saveBtn, {marginTop: 20, paddingVertical: 15}]}><Text style={styles.saveBtnText}>PUBLISH REVIEW</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- ONBOARDING MODAL --- */}
      <Modal visible={showUpgradeModal} animationType="slide" transparent={true}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{upgradeRole === 'vendor' ? 'VENDOR ONBOARDING' : 'SERVICE ONBOARDING'}</Text>
              <TouchableOpacity onPress={() => setShowUpgradeModal(false)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              {upgradeRole === 'vendor' ? (
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>STORE BRAND NAME</Text>
                  <TextInput style={styles.textInput} value={onboardingData.vendorName} onChangeText={t => setOnboardingData({...onboardingData, vendorName: t})} placeholder="e.g. My Vault" />
                  
                  <Text style={styles.inputLabel}>ZIP CODE</Text>
                  <TextInput style={styles.textInput} value={onboardingData.zipCode} onChangeText={handleZipLookup} maxLength={5} keyboardType="numeric" placeholder="Enter Base ZIP" />
                  {onboardingData.city ? <Text style={styles.locationText}>📍 {onboardingData.city}, {onboardingData.state}</Text> : null}

                  <TouchableOpacity 
                    style={styles.checkboxRow} 
                    onPress={() => setOnboardingData({...onboardingData, complianceAgreed: !onboardingData.complianceAgreed})}
                  >
                    <View style={[styles.checkbox, onboardingData.complianceAgreed && styles.checkboxActive]} />
                    <Text style={styles.checkboxLabel}>I guarantee all physical items are authentic and legally obtained. I accept the rules of the ledger.</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.formGroup}>
                  <Text style={styles.inputLabel}>PRIMARY TRADE</Text>
                  
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                    {Object.keys(SERVICE_COMPLIANCE).map(trade => (
                      <TouchableOpacity 
                        key={trade} 
                        style={[styles.tradePill, onboardingData.primaryTrade === trade && styles.tradePillActive]}
                        onPress={() => setOnboardingData({...onboardingData, primaryTrade: trade, complianceAgreed: false})}
                      >
                        <Text style={[styles.tradePillText, onboardingData.primaryTrade === trade && styles.tradePillTextActive]}>
                          {trade.replace('_', ' ').toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <Text style={styles.inputLabel}>ZIP CODE</Text>
                  <TextInput style={styles.textInput} value={onboardingData.zipCode} onChangeText={handleZipLookup} maxLength={5} keyboardType="numeric" placeholder="Enter Operating ZIP" />
                  {onboardingData.city ? <Text style={styles.locationText}>📍 {onboardingData.city}, {onboardingData.state}</Text> : null}

                  {onboardingData.primaryTrade ? (
                    <TouchableOpacity 
                      style={styles.checkboxRow} 
                      onPress={() => setOnboardingData({...onboardingData, complianceAgreed: !onboardingData.complianceAgreed})}
                    >
                      <View style={[styles.checkbox, onboardingData.complianceAgreed && styles.checkboxActive]} />
                      <Text style={styles.checkboxLabel}>{SERVICE_COMPLIANCE[onboardingData.primaryTrade]}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )}

              <TouchableOpacity 
                style={[styles.submitModalBtn, !onboardingData.complianceAgreed && styles.submitModalBtnDisabled]}
                disabled={!onboardingData.complianceAgreed}
                onPress={handleUpgradeAccount}
              >
                <Text style={styles.submitModalBtnText}>COMPLETE ONBOARDING</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 50 },
  
  header: { flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  backBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginRight: 15 },
  backBtnText: { fontWeight: '900', fontSize: 10, letterSpacing: 1, color: '#0f172a' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '900', color: '#0f172a', letterSpacing: 1 },

  profileCard: { backgroundColor: 'white', margin: 15, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#e2e8f0' },
  coverPhoto: { height: 100, backgroundColor: '#0f172a' },
  logoutBtn: { position: 'absolute', top: 15, right: 15, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  logoutBtnText: { color: 'white', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  
  profileContent: { padding: 20, paddingTop: 0 },
  avatarContainer: { marginTop: -40, marginBottom: 10, width: 80, height: 80, position: 'relative' },
  avatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 4, borderColor: 'white', backgroundColor: '#f1f5f9' },
  avatarEditBtn: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#0f172a', width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white' },
  avatarEditIcon: { fontSize: 12 },
  
  profileHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  username: { fontSize: 24, fontWeight: '900', color: '#0f172a' },
  roleText: { fontSize: 10, fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
  followBtn: { backgroundColor: '#0f172a', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  followBtnActive: { backgroundColor: '#f1f5f9' },
  followBtnText: { color: 'white', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  followBtnTextActive: { color: '#0f172a' },
  
  statsRow: { flexDirection: 'row', gap: 30, marginTop: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  statBox: { alignItems: 'flex-start' },
  statNumber: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  statLabel: { fontSize: 9, fontWeight: '900', color: '#64748b', letterSpacing: 1 },

  upgradeBox: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 16, marginTop: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  upgradeTitle: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 1, marginBottom: 10 },
  upgradeGrid: { flexDirection: 'row', gap: 10 },
  upgradeBtnPurple: { flex: 1, backgroundColor: 'white', borderWidth: 1, borderColor: '#e9d5ff', padding: 15, borderRadius: 12, alignItems: 'center' },
  upgradeBtnCyan: { flex: 1, backgroundColor: 'white', borderWidth: 1, borderColor: '#cffafe', padding: 15, borderRadius: 12, alignItems: 'center' },
  upgradeIcon: { fontSize: 24, marginBottom: 5 },
  upgradeBtnText: { fontSize: 9, fontWeight: '900', color: '#0f172a', letterSpacing: 1, textAlign: 'center' },

  trustScoreRow: { flexDirection: 'row', alignItems: 'center', gap: 15, marginTop: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  stars: { color: '#fb923c', fontSize: 20, letterSpacing: 2 },
  trustTextCol: { flex: 1 },
  trustScoreText: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  trustScoreLabel: { fontSize: 9, color: '#94a3b8' },
  reviewCountText: { fontSize: 11, fontWeight: 'bold', color: '#64748b', marginTop: 2 },

  bioSection: { marginTop: 20 },
  sectionLabel: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 1, marginBottom: 10 },
  bioDisplayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bioText: { flex: 1, fontSize: 14, color: '#475569', lineHeight: 22 },
  editIcon: { fontSize: 14, marginLeft: 10 },
  bioInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 12, minHeight: 40, textAlignVertical: 'top', fontSize: 14 },
  bioActionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  saveBtn: { backgroundColor: '#10b981', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8, justifyContent:'center', alignItems:'center' },
  saveBtnText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  cancelBtn: { backgroundColor: '#e2e8f0', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8, justifyContent:'center', alignItems:'center' },
  cancelBtnText: { color: '#475569', fontWeight: 'bold', fontSize: 12 },

  emailToggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  toggleSwitch: { width: 40, height: 24, borderRadius: 12, backgroundColor: '#cbd5e1', padding: 2 },
  toggleSwitchOn: { backgroundColor: '#10b981' },
  toggleNub: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'white' },
  toggleNubOn: { transform: [{translateX: 16}] },
  emailToggleText: { fontSize: 10, fontWeight: '900', color: '#64748b', letterSpacing: 1, marginLeft: 10 },

  clientApptsBox: { marginHorizontal: 15, marginBottom: 15 },
  apptCard: { backgroundColor: 'white', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10 },
  apptHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  statusBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  statusBadgeSuccess: { backgroundColor: '#d1fae5' },
  statusBadgeText: { color: '#d97706', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  statusBadgeTextSuccess: { color: '#059669' },
  apptEscrow: { fontWeight: '900', color: '#0f172a' },
  apptProvider: { fontWeight: 'bold', fontSize: 14, color: '#0f172a' },
  apptDate: { fontSize: 12, color: '#64748b', marginTop: 4 },
  apptActions: { flexDirection: 'row', gap: 10, marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  confirmBtn: { flex: 1, backgroundColor: '#10b981', padding: 12, borderRadius: 8, alignItems: 'center' },
  confirmBtnText: { color: 'white', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  disputeBtn: { flex: 1, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fca5a5', padding: 12, borderRadius: 8, alignItems: 'center' },
  disputeBtnText: { color: '#ef4444', fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  newPostBox: { marginBottom: 15 },
  newPostToggle: { backgroundColor: '#f97316', padding: 12, borderRadius: 12, alignItems: 'center' },
  newPostToggleText: { color: 'white', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  newPostForm: { backgroundColor: 'white', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginTop: 10 },
  postTypeRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  postTypeBtn: { flex: 1, padding: 8, borderRadius: 8, backgroundColor: '#f1f5f9', alignItems: 'center' },
  postTypeBtnActive: { backgroundColor: '#0f172a' },
  postTypeText: { fontSize: 10, fontWeight: '900', color: '#64748b', textTransform: 'uppercase' },
  postTypeTextActive: { color: 'white' },
  imagePickerBtn: { height: 100, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  imagePickerText: { color: '#64748b', fontWeight: 'bold', fontSize: 12 },
  imagePickerPreview: { width: '100%', height: '100%', borderRadius: 12 },

  tabsScroll: { paddingHorizontal: 15, marginBottom: 15 },
  tabBtn: { paddingVertical: 10, paddingHorizontal: 15, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: '#0f172a' },
  tabBtnText: { fontSize: 11, fontWeight: '900', color: '#94a3b8', letterSpacing: 1 },
  tabBtnTextActive: { color: '#0f172a' },

  tabContent: { paddingHorizontal: 15 },
  emptyText: { textAlign: 'center', color: '#94a3b8', padding: 30, backgroundColor: 'white', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },

  timelineCard: { backgroundColor: 'white', borderRadius: 16, overflow: 'hidden', marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  postActionsRow: { flexDirection: 'row', justifyContent: 'flex-end', padding: 10, position: 'absolute', right: 0, top: 0, zIndex: 10, backgroundColor: 'rgba(255,255,255,0.8)', borderBottomLeftRadius: 10 },
  timelineImage: { width: '100%', height: 200, backgroundColor: '#f8fafc' },
  timelineBody: { padding: 15 },
  dropHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 },
  dropTitle: { fontSize: 14, fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', flex: 1, paddingRight: 10 },
  dropPrice: { fontSize: 14, fontWeight: '900', color: '#059669' },
  timelineText: { fontSize: 13, color: '#475569', lineHeight: 20 },
  mentionText: { color: '#06b6d4', fontWeight: 'bold' },
  timelineFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  timelineDate: { fontSize: 10, fontWeight: 'bold', color: '#94a3b8' },
  timelineLikes: { fontSize: 10, fontWeight: 'bold', color: '#64748b' },

  commentsSection: { backgroundColor: '#f8fafc', padding: 15, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  commentBubble: { backgroundColor: 'white', padding: 10, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#f1f5f9' },
  commentUser: { fontSize: 10, fontWeight: '900', color: '#0f172a', marginBottom: 2 },
  commentDate: { color: '#94a3b8', fontWeight: 'normal' },
  commentText: { fontSize: 12, color: '#475569' },

  reviewCard: { backgroundColor: 'white', padding: 15, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10, backgroundColor: '#f1f5f9' },
  reviewMeta: { flex: 1 },
  reviewUser: { fontSize: 12, fontWeight: '900', color: '#0f172a' },
  reviewDate: { fontSize: 9, color: '#94a3b8', fontWeight: 'bold' },
  reviewText: { fontSize: 13, color: '#475569', lineHeight: 18 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  catalogCard: { width: (width - 40) / 2, backgroundColor: 'white', borderRadius: 12, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  catalogImage: { width: '100%', aspectRatio: 1, borderRadius: 8, backgroundColor: '#f8fafc', marginBottom: 10 },
  catalogTitle: { fontSize: 11, fontWeight: 'bold', color: '#0f172a', textTransform: 'uppercase' },
  catalogPrice: { fontSize: 14, fontWeight: '900', color: '#059669', marginTop: 5 },

  serviceCard: { flexDirection: 'row', backgroundColor: 'white', borderRadius: 16, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  serviceImage: { width: 80, height: 80, borderRadius: 12, backgroundColor: '#f8fafc', marginRight: 15 },
  serviceBody: { flex: 1, justifyContent: 'space-between' },
  serviceTitle: { fontSize: 12, fontWeight: '900', color: '#0f172a', textTransform: 'uppercase' },
  serviceDesc: { fontSize: 11, color: '#64748b' },
  serviceFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  servicePrice: { fontSize: 12, fontWeight: '900', color: '#059669' },
  bookBtn: { backgroundColor: '#0891b2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  bookBtnText: { color: 'white', fontSize: 9, fontWeight: '900', letterSpacing: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: 'white', borderRadius: 24, maxHeight: '80%', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: '#f8fafc' },
  modalTitle: { fontSize: 14, fontWeight: '900', color: '#0f172a', letterSpacing: 1 },
  modalClose: { fontSize: 18, color: '#94a3b8', fontWeight: 'bold' },
  modalBody: { padding: 20 },
  formGroup: { marginBottom: 20 },
  inputLabel: { fontSize: 10, fontWeight: '900', color: '#64748b', letterSpacing: 1, marginBottom: 5, marginTop: 15 },
  textInput: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 15, fontSize: 14 },
  locationText: { fontSize: 11, fontWeight: 'bold', color: '#0284c7', marginTop: 8, backgroundColor: '#f0f9ff', padding: 8, borderRadius: 6, overflow: 'hidden' },
  
  pillScroll: { marginVertical: 5 },
  tradePill: { backgroundColor: '#f1f5f9', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12, marginRight: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  tradePillActive: { backgroundColor: '#ecfeff', borderColor: '#06b6d4' },
  tradePillText: { fontSize: 10, fontWeight: '900', color: '#64748b' },
  tradePillTextActive: { color: '#0891b2' },

  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 20, backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#cbd5e1', marginRight: 12, marginTop: 2 },
  checkboxActive: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  checkboxLabel: { flex: 1, fontSize: 12, color: '#334155', lineHeight: 18, fontWeight: '500' },

  submitModalBtn: { backgroundColor: '#0f172a', paddingVertical: 18, borderRadius: 12, alignItems: 'center', marginTop: 10, marginBottom: 30 },
  submitModalBtnDisabled: { backgroundColor: '#cbd5e1' },
  submitModalBtnText: { color: 'white', fontWeight: '900', fontSize: 12, letterSpacing: 1 }
});
