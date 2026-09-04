import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  ActivityIndicator, Alert, Dimensions, Modal, TextInput, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';

const API_BASE = "https://streetcode101.com/api";
const { width } = Dimensions.get('window');

export default function AdminConsole() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  // Core State
  const [analytics, setAnalytics] = useState({ total_circulation: 0, escrow_liability: 0, total_revenue_usd: 0, treasury_reserve: 0 });
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [vaultTransactions, setVaultTransactions] = useState<any[]>([]);

  // Product Management State
  const [isSyncing, setIsSyncing] = useState(false);
  const [cjSku, setCjSku] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>({
    sku: '', title: '', price: '', description: '', category: 'uncategorized'
  });

  useFocusEffect(
    React.useCallback(() => {
      checkAdminAuth();
    }, [])
  );

  const checkAdminAuth = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync('pidrop_token');
      if (!storedToken) return router.replace('/login');
      
      const res = await fetch(`${API_BASE}/profile/me`, {
        headers: { 'Authorization': `Bearer ${storedToken}` }
      });
      const data = await res.json();
      
      if (data.username !== 'admin') {
        Alert.alert("Unauthorized", "Admin clearance required.");
        return router.replace('/');
      }
      
      setToken(storedToken);
      fetchDashboardData(storedToken);
    } catch (err) {
      router.replace('/login');
    }
  };

  const [cashouts, setCashouts] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [socialFeed, setSocialFeed] = useState<any[]>([]);
  const [feedSearchQuery, setFeedSearchQuery] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [promos, setPromos] = useState<any[]>([]);

  const filteredFeed = socialFeed.filter(item => 
    (item.username || '').toLowerCase().includes(feedSearchQuery.toLowerCase()) || 
    (item.title || '').toLowerCase().includes(feedSearchQuery.toLowerCase()) ||
    (item.description || '').toLowerCase().includes(feedSearchQuery.toLowerCase())
  );

  // Promo Generation State
  const [baseWord, setBaseWord] = useState('');
  const [promoDiscount, setPromoDiscount] = useState('');
  const [isGeneratingPromo, setIsGeneratingPromo] = useState(false);

  // Broadcast State
  const [broadcastSubject, setBroadcastSubject] = useState('');
  const [broadcastImage, setBroadcastImage] = useState('https://images.unsplash.com/photo-1550639525-c97d455acf70?q=80&w=600&auto=format&fit=crop');
  const [broadcastHeadline, setBroadcastHeadline] = useState('');
  const [broadcastPromo, setBroadcastPromo] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isUploadingBroadcastImg, setIsUploadingBroadcastImg] = useState(false);

  // Email / Fund Modal State
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTarget, setEmailTarget] = useState<any>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const [showFundModal, setShowFundModal] = useState(false);
  const [fundTarget, setFundTarget] = useState<any>(null);
  const [fundAmount, setFundAmount] = useState('');
  const [isFunding, setIsFunding] = useState(false);

  // Delete Post State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [postToDelete, setPostToDelete] = useState<any>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeletingPost, setIsDeletingPost] = useState(false);

  const fetchDashboardData = async (authToken: string) => {
    try {
      const [ordersRes, productsRes, analyticsRes, vaultRes, cashoutsRes, disputesRes, feedRes, usersRes, promosRes] = await Promise.all([
        fetch(`${API_BASE}/orders`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
        fetch(`${API_BASE}/products?limit=100`),
        fetch(`${API_BASE}/admin/analytics`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
        fetch(`${API_BASE}/admin/vault/transactions`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
        fetch(`${API_BASE}/admin/cashouts`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
        fetch(`${API_BASE}/admin/disputes`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
        fetch(`${API_BASE}/posts/feed`),
        fetch(`${API_BASE}/admin/users`, { headers: { 'Authorization': `Bearer ${authToken}` } }),
        fetch(`${API_BASE}/admin/promos`, { headers: { 'Authorization': `Bearer ${authToken}` } })
      ]);

      setOrders(await ordersRes.json());
      setProducts(await productsRes.json());
      setAnalytics(analyticsRes.ok ? await analyticsRes.json() : { total_circulation: 0, escrow_liability: 0, total_revenue_usd: 0, treasury_reserve: 0 });
      setVaultTransactions(vaultRes.ok ? await vaultRes.json() : []);
      setCashouts(cashoutsRes.ok ? await cashoutsRes.json() : []);
      setDisputes(disputesRes.ok ? await disputesRes.json() : []);
      setSocialFeed(feedRes.ok ? await feedRes.json() : []);
      setUsers(usersRes.ok ? await usersRes.json() : []);
      setPromos(promosRes.ok ? await promosRes.json() : []);
      
    } catch (err) {
      console.error("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  };

  const pendingOrdersCount = orders.filter(o => o.status === 'processing').length;
  const totalRevenue = orders.reduce((sum, order) => {
    const prod = products.find(p => p.sku === order.sku);
    return sum + (prod ? prod.price * order.quantity : 0);
  }, 0);

  const switchTab = (tab: string) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const handleSyncCJ = async () => {
    if (!cjSku.trim()) return Alert.alert('Error', 'Please enter a CJ SKU first!');
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/admin/sync-cj`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: cjSku })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to sync with CJ');
      Alert.alert("Success", data.message);
      setCjSku(''); 
      fetchDashboardData(token!); 
    } catch (err: any) { Alert.alert("Error", err.message); } 
    finally { setIsSyncing(false); }
  };

  const handleResyncAll = async () => {
    Alert.alert("Confirm Resync", "Update all product variants?", [
      { text: "Cancel", style: "cancel" },
      { text: "Resync", style: "destructive", onPress: async () => {
        setIsSyncing(true);
        try {
          const res = await fetch(`${API_BASE}/admin/resync-all-variants`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.detail || 'Failed to resync');
          Alert.alert("Success", data.message);
          fetchDashboardData(token!);
        } catch (err: any) { Alert.alert("Error", err.message); } 
        finally { setIsSyncing(false); }
      }}
    ]);
  };

  const handleToggleFeatured = async (sku: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/products/${sku}/featured`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to set featured product');
      fetchDashboardData(token!);
    } catch (err: any) { Alert.alert("Error", err.message); }
  };

  const handleBroadcastImageUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setIsUploadingBroadcastImg(true);
      try {
        const file = new File(result.assets[0].uri);
        const formData = new FormData();
        formData.append('file', file as any);
        
        const res = await fetch(`${API_BASE}/admin/upload-image`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Upload failed');
        
        setBroadcastImage(data.url);
      } catch (err: any) {
        Alert.alert("Error", err.message);
      } finally {
        setIsUploadingBroadcastImg(false);
      }
    }
  };

  const handleDeployBroadcast = async () => {
    if (!broadcastSubject || !broadcastHeadline || !broadcastBody || !broadcastImage) {
      return Alert.alert("Error", "Please fill out all required fields.");
    }
    Alert.alert("Confirm Broadcast", "Deploy this email to the entire community ledger?", [
      { text: "Cancel", style: "cancel" },
      { text: "Launch", style: "destructive", onPress: async () => {
        setIsBroadcasting(true);
        try {
          const res = await fetch(`${API_BASE}/admin/broadcast`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
              subject: broadcastSubject,
              image_url: broadcastImage,
              headline: broadcastHeadline,
              body_text: broadcastBody,
              promo_code: broadcastPromo
            })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.detail || 'Broadcast failed');
          
          Alert.alert("Success", data.message);
          setBroadcastSubject('');
          setBroadcastHeadline('');
          setBroadcastBody('');
          setBroadcastPromo('');
        } catch (err: any) {
          Alert.alert("Error", err.message);
        } finally {
          setIsBroadcasting(false);
        }
      }}
    ]);
  };

  const handleDeleteProduct = async (sku: string) => {
    Alert.alert("Confirm Delete", `Are you sure you want to permanently delete ${sku}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          const res = await fetch(`${API_BASE}/products/${sku}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) throw new Error('Failed to delete product');
          fetchDashboardData(token!); 
        } catch (err: any) { Alert.alert("Error", err.message); }
      }}
    ]);
  };

  const handleProductImageUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setIsUploadingImage(true);
      try {
        const file = new File(result.assets[0].uri);
        const formData = new FormData();
        formData.append('file', file as any);
        
        const res = await fetch(`${API_BASE}/admin/upload-image`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Upload failed');
        
        setEditingProduct({ ...editingProduct, image_url: data.url });
      } catch (err: any) {
        Alert.alert("Error", err.message);
      } finally {
        setIsUploadingImage(false);
      }
    }
  };

  const handleEditProduct = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/products/${editingProduct.sku}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProduct)
      });
      if (!res.ok) throw new Error('Failed to update product');
      Alert.alert("Success", "Product updated successfully!");
      fetchDashboardData(token!); 
      setShowEditModal(false);
    } catch (err: any) { Alert.alert("Error", err.message); }
  };

  const handleApproveCashout = (id: number, zelleContact: string, usdPayout: number) => {
    Alert.alert(
      "Fulfill Cashout",
      `Did you successfully send $${usdPayout.toFixed(2)} to ${zelleContact} via Zelle?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Mark Fulfilled", 
          style: "default", 
          onPress: async () => {
            try {
              const res = await fetch(`${API_BASE}/admin/cashouts/${id}/approve`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
              });
              if (!res.ok) throw new Error("Failed to approve cashout");
              Alert.alert("Success", "Cashout fulfilled. Coins burned.");
              fetchDashboardData(token!);
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          }
        }
      ]
    );
  };

  const handleDeletePostClick = (id: number, username: string, titleOrDesc: string) => {
    setPostToDelete({ id, username, titleOrDesc });
    setDeleteReason('');
    setShowDeleteModal(true);
  };

  const confirmDeletePost = async () => {
    if (!deleteReason.trim()) return Alert.alert('Error', 'You must provide a reason to notify the user.');
    setIsDeletingPost(true);

    try {
      const delRes = await fetch(`${API_BASE}/posts/${postToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!delRes.ok) throw new Error('Failed to delete post');

      const snippet = postToDelete.titleOrDesc.length > 30 ? postToDelete.titleOrDesc.substring(0, 30) + '...' : postToDelete.titleOrDesc;
      const emailBody = `Yo @${postToDelete.username},\n\nYour recent post ("${snippet}") was removed from the community timeline by a moderator.\n\nReason: ${deleteReason}\n\nPlease review the community guidelines.`;
      
      await fetch(`${API_BASE}/admin/users/${postToDelete.username}/email`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: '⚠️ Post Removed by Moderator', body: emailBody })
      });

      Alert.alert("Success", `Post deleted and @${postToDelete.username} was notified.`);
      setShowDeleteModal(false);
      fetchDashboardData(token!); 
    } catch (err: any) { 
      Alert.alert("Error", err.message); 
    } finally {
      setIsDeletingPost(false);
    }
  };

  const handleUpdateUserDiscount = async (username: string, newDiscount: string) => {
    try {
      const res = await fetch(`${API_BASE}/admin/users/${username}/discount`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ discount_percent: parseFloat(newDiscount) || 0 })
      });
      if (!res.ok) throw new Error('Failed to update discount');
      fetchDashboardData(token!);
    } catch (err: any) { Alert.alert("Error", err.message); }
  };

  const handleSendAdminEmail = async () => {
    if (!emailSubject || !emailBody) return Alert.alert("Error", "Please fill out all fields.");
    setIsSendingEmail(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users/${emailTarget.username}/email`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: emailSubject, body: emailBody })
      });
      if (!res.ok) throw new Error('Failed to dispatch email');
      Alert.alert("Success", 'Email dispatched successfully.');
      setShowEmailModal(false);
      setEmailSubject('');
      setEmailBody('');
    } catch (err: any) { Alert.alert("Error", err.message); } 
    finally { setIsSendingEmail(false); }
  };

  const handleTransferFunds = async () => {
    if (!fundAmount || isNaN(Number(fundAmount)) || Number(fundAmount) <= 0) return Alert.alert("Error", "Enter a valid amount.");
    setIsFunding(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users/${fundTarget.username}/transfer`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: parseFloat(fundAmount) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to route funds');
      
      Alert.alert("Success", data.message);
      setShowFundModal(false);
      setFundAmount('');
      fetchDashboardData(token!);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setIsFunding(false);
    }
  };

  const handleGeneratePromo = async () => {
    if (!baseWord || !promoDiscount) return Alert.alert("Error", "Fill out both fields.");
    setIsGeneratingPromo(true);
    try {
      const res = await fetch(`${API_BASE}/admin/promos`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_word: baseWord, discount_percent: parseFloat(promoDiscount) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to generate promo');
      
      Alert.alert("Success", `Generated: ${data.code}`);
      setBaseWord('');
      setPromoDiscount('');
      fetchDashboardData(token!);
    } catch (err: any) { Alert.alert("Error", err.message); } 
    finally { setIsGeneratingPromo(false); }
  };

  const handleTogglePromo = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/admin/promos/${id}/toggle`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to toggle promo');
      fetchDashboardData(token!);
    } catch (err: any) { Alert.alert("Error", err.message); }
  };

  const handleResolveDispute = (id: number, resolution: string) => {
    const actionText = resolution === 'refund_client' ? 'refund the client' : 'release to the provider';
    Alert.alert(
      "Resolve Dispute",
      `Are you sure you want to ${actionText}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Confirm", 
          style: "destructive", 
          onPress: async () => {
            try {
              const res = await fetch(`${API_BASE}/admin/disputes/${id}/resolve`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ resolution })
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.detail || "Failed to resolve dispute");
              
              Alert.alert("Success", data.message);
              fetchDashboardData(token!);
            } catch (err: any) {
              Alert.alert("Error", err.message);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#06b6d4" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      
      {/* Mobile Navbar Header */}
      <View style={styles.mobileHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.logoIcon}>🛡️</Text>
          <Text style={styles.headerTitle}>ADMIN</Text>
        </View>
        <TouchableOpacity 
          style={styles.hamburgerBtn}
          onPress={() => setIsMobileMenuOpen(true)}
        >
          <Text style={styles.hamburgerIcon}>☰</Text>
        </TouchableOpacity>
      </View>

      {/* --- CUSTOM ADMIN SIDEBAR OVERLAY --- */}
      <Modal visible={isMobileMenuOpen} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setIsMobileMenuOpen(false)} />
          
          <View style={styles.sidebarMenu}>
            <View style={styles.sidebarHeader}>
              <View style={styles.headerLeft}>
                <Text style={styles.logoIcon}>🛡️</Text>
                <Text style={styles.sidebarTitle}>CONSOLE</Text>
              </View>
              <TouchableOpacity onPress={() => setIsMobileMenuOpen(false)}>
                <Text style={styles.closeIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sidebarScroll}>
              <TouchableOpacity onPress={() => { setIsMobileMenuOpen(false); router.replace('/'); }} style={styles.storefrontBtn}>
                <Text style={styles.storefrontBtnText}>🏪 Storefront</Text>
              </TouchableOpacity>

              <Text style={styles.sidebarCategory}>Overview</Text>
              <TouchableOpacity onPress={() => switchTab('dashboard')} style={[styles.sidebarBtn, activeTab === 'dashboard' && styles.sidebarBtnActive]}>
                <Text style={[styles.sidebarBtnText, activeTab === 'dashboard' && styles.sidebarBtnTextActive]}>📊 Dashboard</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => switchTab('vault')} style={[styles.sidebarBtn, activeTab === 'vault' && styles.sidebarBtnActiveBlue]}>
                <Text style={[styles.sidebarBtnText, activeTab === 'vault' && styles.sidebarBtnTextActiveBlue]}>🏦 Genesis Vault</Text>
              </TouchableOpacity>

              <Text style={styles.sidebarCategory}>Commerce</Text>
              <TouchableOpacity onPress={() => switchTab('orders')} style={[styles.sidebarBtn, activeTab === 'orders' && styles.sidebarBtnActiveOrange]}>
                <Text style={[styles.sidebarBtnText, activeTab === 'orders' && styles.sidebarBtnTextActiveOrange]}>📦 Orders</Text>
                {pendingOrdersCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{pendingOrdersCount}</Text></View>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => switchTab('products')} style={[styles.sidebarBtn, activeTab === 'products' && styles.sidebarBtnActiveOrange]}>
                <Text style={[styles.sidebarBtnText, activeTab === 'products' && styles.sidebarBtnTextActiveOrange]}>🏷️ Products</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => switchTab('cashouts')} style={[styles.sidebarBtn, activeTab === 'cashouts' && styles.sidebarBtnActiveGreen]}>
                <Text style={[styles.sidebarBtnText, activeTab === 'cashouts' && styles.sidebarBtnTextActiveGreen]}>💸 Cashouts</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => switchTab('disputes')} style={[styles.sidebarBtn, activeTab === 'disputes' && styles.sidebarBtnActiveRed]}>
                <Text style={[styles.sidebarBtnText, activeTab === 'disputes' && styles.sidebarBtnTextActiveRed]}>⚖️ Disputes</Text>
              </TouchableOpacity>

              <Text style={styles.sidebarCategory}>Community</Text>
              <TouchableOpacity onPress={() => switchTab('social')} style={[styles.sidebarBtn, activeTab === 'social' && styles.sidebarBtnActivePurple]}>
                <Text style={[styles.sidebarBtnText, activeTab === 'social' && styles.sidebarBtnTextActivePurple]}>📱 Social Feed</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => switchTab('community')} style={[styles.sidebarBtn, activeTab === 'community' && styles.sidebarBtnActiveBlue]}>
                <Text style={[styles.sidebarBtnText, activeTab === 'community' && styles.sidebarBtnTextActiveBlue]}>👥 Roster</Text>
              </TouchableOpacity>

              <Text style={styles.sidebarCategory}>Marketing</Text>
              <TouchableOpacity onPress={() => switchTab('promos')} style={[styles.sidebarBtn, activeTab === 'promos' && styles.sidebarBtnActivePink]}>
                <Text style={[styles.sidebarBtnText, activeTab === 'promos' && styles.sidebarBtnTextActivePink]}>🎟️ Promos</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => switchTab('broadcast')} style={[styles.sidebarBtn, activeTab === 'broadcast' && styles.sidebarBtnActiveRed]}>
                <Text style={[styles.sidebarBtnText, activeTab === 'broadcast' && styles.sidebarBtnTextActiveRed]}>📢 Broadcast</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ScrollView style={styles.contentContainer} contentContainerStyle={{ paddingBottom: 50 }}>
        
        {/* --- 1. DASHBOARD TAB --- */}
        {activeTab === 'dashboard' && (
          <View>
            <Text style={styles.sectionTitle}>COMMAND CENTER</Text>
            
            <View style={styles.metricCardLight}>
              <Text style={styles.metricLabelLight}>Storefront Sales (Gross)</Text>
              <Text style={styles.metricValueDark}>${totalRevenue.toFixed(2)}</Text>
            </View>
            
            <View style={styles.metricCardLight}>
              <Text style={styles.metricLabelLight}>Fulfillment Queue</Text>
              <Text style={styles.metricValueOrange}>{pendingOrdersCount} <Text style={styles.metricSub}>pending</Text></Text>
            </View>

            <Text style={styles.sectionTitle}>DIGITAL ECONOMY</Text>

            <View style={styles.metricCardDark}>
              <Text style={styles.metricLabelCyan}>Circulating StreetCoin</Text>
              <Text style={styles.metricValueWhite}>{analytics.total_circulation.toFixed(2)} <Text style={styles.metricSub}>SC</Text></Text>
            </View>

            <View style={styles.metricCardDark}>
              <Text style={styles.metricLabelOrange}>Locked in Escrow</Text>
              <Text style={styles.metricValueWhite}>{analytics.escrow_liability.toFixed(2)} <Text style={styles.metricSub}>SC</Text></Text>
            </View>

            <View style={styles.metricCardGreen}>
              <Text style={styles.metricLabelGreenDark}>Platform Tax Revenue</Text>
              <Text style={styles.metricValueGreen}>${analytics.total_revenue_usd.toFixed(2)} <Text style={styles.metricSub}>USD</Text></Text>
            </View>
          </View>
        )}

        {/* --- 2. GENESIS VAULT TAB --- */}
        {activeTab === 'vault' && (
          <View>
            <Text style={styles.sectionTitle}>MASTER VAULT</Text>
            
            <View style={styles.vaultCard}>
              <Text style={styles.vaultLabel}>Uncirculated Supply</Text>
              <Text style={styles.vaultAmount}>{analytics.treasury_reserve?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || '0.00'} <Text style={styles.vaultAmountSub}>SC</Text></Text>
            </View>

            <Text style={styles.sectionTitle}>OUTFLOW LEDGER</Text>
            {vaultTransactions.length === 0 ? (
              <Text style={styles.emptyText}>No coins have left the Genesis Vault yet.</Text>
            ) : (
              vaultTransactions.map(tx => (
                <View key={tx.id} style={styles.listCard}>
                  <View style={styles.listRow}>
                    <Text style={styles.listTitle}>@{tx.receiver_username}</Text>
                    <Text style={styles.listAmountGreen}>+{tx.amount.toFixed(2)}</Text>
                  </View>
                  <View style={styles.listRow}>
                    <Text style={styles.listSubText}>TX-{tx.id}</Text>
                    <View style={styles.pillBlue}>
                      <Text style={styles.pillTextBlue}>{tx.transaction_type.replace('_', ' ')}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* --- 3. ORDERS TAB --- */}
        {activeTab === 'orders' && (
          <View>
            <Text style={styles.sectionTitle}>ORDER LEDGER</Text>
            {orders.length === 0 ? (
              <Text style={styles.emptyText}>No orders found.</Text>
            ) : (
              orders.map(order => (
                <View key={order.id} style={styles.listCard}>
                  <View style={styles.listRow}>
                    <Text style={styles.listTitle}>Order #{order.id}</Text>
                    <View style={styles.pillGray}>
                      <Text style={styles.pillTextGray}>{order.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.listSubTextBold}>{order.customer_email}</Text>
                  <Text style={styles.listSubText}>{order.shipping_address}</Text>
                  
                  <View style={styles.orderItemBox}>
                    <Text style={styles.orderSku}>{order.sku}</Text>
                    <Text style={styles.orderQty}>Qty: {order.quantity}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* --- PRODUCTS TAB --- */}
        {activeTab === 'products' && (
          <View>
            <Text style={styles.sectionTitle}>INVENTORY MANAGEMENT</Text>
            
            <View style={styles.metricCardLight}>
              <Text style={styles.metricLabelLight}>IMPORT CJ DROPSHIPPING SKU</Text>
              <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
                <TextInput 
                  style={[styles.textInput, {flex: 1}]}
                  placeholder="Enter CJ SKU..."
                  value={cjSku}
                  onChangeText={setCjSku}
                />
                <TouchableOpacity 
                  style={[styles.actionBtn, {marginBottom: 0, paddingHorizontal: 20}]} 
                  onPress={handleSyncCJ}
                  disabled={isSyncing}
                >
                  <Text style={styles.actionBtnText}>{isSyncing ? 'SYNCING...' : 'IMPORT'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.actionBtnDark} onPress={handleResyncAll} disabled={isSyncing}>
              <Text style={styles.actionBtnTextDark}>{isSyncing ? 'SYNCING...' : 'RESYNC ALL VARIANTS'}</Text>
            </TouchableOpacity>

            {products.map(product => (
              <View key={product.sku} style={[styles.listCard, product.is_featured && {borderColor: '#fbbf24', borderWidth: 2}]}>
                <View style={{flexDirection: 'row', gap: 15}}>
                  <TouchableOpacity onPress={() => handleToggleFeatured(product.sku)}>
                    <Text style={{fontSize: 24}}>{product.is_featured ? '👑' : '📦'}</Text>
                  </TouchableOpacity>
                  <View style={{flex: 1}}>
                    <Text style={styles.listTitle}>{product.title}</Text>
                    <Text style={styles.listSubTextBold}>{product.sku}</Text>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 10}}>
                      <Text style={styles.listAmountGreen}>${product.price.toFixed(2)}</Text>
                      <View style={product.in_stock ? styles.pillGreen : styles.pillRed}>
                        <Text style={product.in_stock ? styles.pillTextGreen : styles.pillTextRed}>
                          {product.in_stock ? 'ACTIVE' : 'EMPTY'}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
                
                <View style={styles.adminActionRow}>
                  <TouchableOpacity 
                    style={styles.transferBtn}
                    onPress={() => { setEditingProduct(product); setShowEditModal(true); }}
                  >
                    <Text style={styles.transferBtnText}>EDIT</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.transferBtn, {backgroundColor: '#fee2e2'}]}
                    onPress={() => handleDeleteProduct(product.sku)}
                  >
                    <Text style={[styles.transferBtnText, {color: '#ef4444'}]}>DELETE</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* --- CASHOUTS TAB --- */}
        {activeTab === 'cashouts' && (
          <View>
            <Text style={styles.sectionTitle}>FIAT OFFRAMP QUEUE</Text>
            
            {cashouts.length === 0 ? (
              <Text style={styles.emptyText}>No pending cashouts.</Text>
            ) : (
              cashouts.map(req => (
                <View key={req.id} style={styles.listCard}>
                  <Text style={[styles.listTitle, {color: '#ea580c', marginBottom: 10}]}>@{req.username}</Text>
                  
                  <View style={styles.statRowDark}>
                    <Text style={styles.listSubTextBold}>Zelle Contact:</Text>
                    <Text style={styles.statValueDark}>{req.zelle_contact}</Text>
                  </View>
                  
                  <View style={styles.statRowDark}>
                    <Text style={styles.listSubTextBold}>Requested SC:</Text>
                    <Text style={styles.statValueDark}>{req.amount_coins.toFixed(2)} SC</Text>
                  </View>

                  <View style={[styles.statRowDark, {borderBottomWidth: 0}]}>
                    <Text style={styles.listSubTextBold}>USD Payout:</Text>
                    <Text style={styles.listAmountGreen}>${req.usd_payout.toFixed(2)}</Text>
                  </View>

                  <View style={{marginTop: 5, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f1f5f9'}}>
                    {req.status === 'pending' ? (
                      <TouchableOpacity 
                        style={[styles.actionBtn, {backgroundColor: '#10b981', marginBottom: 0}]}
                        onPress={() => handleApproveCashout(req.id, req.zelle_contact, req.usd_payout)}
                      >
                        <Text style={styles.actionBtnText}>MARK FULFILLED</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={[styles.pillGray, {alignSelf: 'flex-start'}]}>
                        <Text style={styles.pillTextGray}>FULFILLED</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* --- DISPUTES TAB --- */}
        {activeTab === 'disputes' && (
          <View>
            <Text style={styles.sectionTitle}>ESCROW TRIBUNAL</Text>
            
            {disputes.length === 0 ? (
              <Text style={styles.emptyText}>No active disputes. The ecosystem is at peace.</Text>
            ) : (
              disputes.map(appt => (
                <View key={appt.id} style={[styles.listCard, {borderColor: '#fecaca', borderWidth: 2}]}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
                    <View style={[styles.pillRed, {backgroundColor: '#fef2f2'}]}>
                      <Text style={styles.pillTextRed}>FROZEN ESCROW</Text>
                    </View>
                    <Text style={styles.listSubTextBold}>Appt #{appt.id}</Text>
                  </View>
                  
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', marginVertical: 10}}>
                    <View style={{flex: 1}}>
                      <Text style={styles.inputLabel}>CLIENT</Text>
                      <Text style={styles.listTitle}>@{appt.client_username}</Text>
                    </View>
                    <View style={{flex: 1, alignItems: 'flex-end'}}>
                      <Text style={styles.inputLabel}>PROVIDER</Text>
                      <Text style={styles.listTitle}>@{appt.provider_username}</Text>
                    </View>
                  </View>

                  <View style={styles.statRowDark}>
                    <Text style={styles.listSubTextBold}>Disputed Funds:</Text>
                    <Text style={[styles.listAmountGreen, {color: '#ea580c'}]}>{appt.escrow_amount.toFixed(2)} SC</Text>
                  </View>

                  <View style={{flexDirection: 'row', gap: 10, marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f1f5f9'}}>
                    <TouchableOpacity 
                      style={[styles.actionBtn, {flex: 1, backgroundColor: '#0f172a', marginBottom: 0}]}
                      onPress={() => handleResolveDispute(appt.id, 'refund_client')}
                    >
                      <Text style={styles.actionBtnText}>REFUND CLIENT</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionBtn, {flex: 1, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#10b981', marginBottom: 0}]}
                      onPress={() => handleResolveDispute(appt.id, 'release_provider')}
                    >
                      <Text style={[styles.actionBtnText, {color: '#059669'}]}>PAY PROVIDER</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* --- SOCIAL FEED TAB --- */}
        {activeTab === 'social' && (
          <View>
            <Text style={styles.sectionTitle}>FEED MODERATION</Text>
            
            <View style={styles.metricCardLight}>
              <Text style={styles.inputLabel}>SEARCH POSTS</Text>
              <TextInput 
                style={[styles.textInputFull, { marginBottom: 0 }]} 
                placeholder="Search by username, title, or description..."
                value={feedSearchQuery}
                onChangeText={setFeedSearchQuery}
                autoCapitalize="none"
              />
            </View>

            {filteredFeed.length === 0 ? (
              <Text style={styles.emptyText}>No posts currently active or matching search.</Text>
            ) : (
              filteredFeed.map(item => (
                <View key={item.id} style={styles.listCard}>
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10}}>
                    <Image source={{uri: item.user_avatar || 'https://streetcode101.com/favicon.ico'}} style={{width: 32, height: 32, borderRadius: 16}} />
                    <View style={{flex: 1}}>
                      <Text style={styles.listTitle}>@{item.username}</Text>
                      <View style={[styles.pillGray, {alignSelf: 'flex-start', marginTop: 2}]}>
                        <Text style={styles.pillTextGray}>{item.post_type.replace('_', ' ')}</Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={{flexDirection: 'row', gap: 10, marginBottom: 15}}>
                    {item.post_type !== 'text' && item.image_url && (
                      <Image source={{uri: item.image_url}} style={{width: 60, height: 60, borderRadius: 8, backgroundColor: '#f1f5f9'}} />
                    )}
                    <View style={{flex: 1}}>
                      {item.title ? <Text style={styles.listSubTextBold}>{item.title}</Text> : null}
                      <Text style={styles.listSubText} numberOfLines={3}>{item.description}</Text>
                    </View>
                  </View>

                  <View style={{paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f1f5f9'}}>
                    <TouchableOpacity 
                      style={[styles.actionBtn, {backgroundColor: '#fee2e2', marginBottom: 0}]}
                      onPress={() => handleDeletePostClick(item.id, item.username, item.title || item.description)}
                    >
                      <Text style={[styles.actionBtnText, {color: '#ef4444'}]}>DELETE & NOTIFY USER</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* --- COMMUNITY TAB --- */}
        {activeTab === 'community' && (
          <View>
            <Text style={styles.sectionTitle}>COMMUNITY ROSTER</Text>
            
            {users.length === 0 ? (
              <Text style={styles.emptyText}>No community members registered yet.</Text>
            ) : (
              users.map(user => (
                <View key={user.id} style={styles.listCard}>
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15}}>
                    <Image source={{uri: user.profile_image_url || 'https://streetcode101.com/favicon.ico'}} style={{width: 40, height: 40, borderRadius: 20}} />
                    <View style={{flex: 1}}>
                      <Text style={styles.listTitle}>@{user.username}</Text>
                      <Text style={styles.listSubText}>{user.email}</Text>
                    </View>
                    {user.is_verified && (
                      <View style={styles.pillGreen}>
                        <Text style={styles.pillTextGreen}>✓ KYC</Text>
                      </View>
                    )}
                  </View>

                  <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15}}>
                    <Text style={styles.inputLabel}>VAULT DISCOUNT (%)</Text>
                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 5}}>
                      <TextInput 
                        style={[styles.textInput, {paddingVertical: 5, paddingHorizontal: 10, minWidth: 60, textAlign: 'center'}]}
                        defaultValue={user.discount_percent?.toString()}
                        keyboardType="numeric"
                        onEndEditing={(e) => {
                          if (e.nativeEvent.text !== user.discount_percent?.toString()) {
                            handleUpdateUserDiscount(user.username, e.nativeEvent.text);
                          }
                        }}
                      />
                    </View>
                  </View>
                  
                  <View style={{flexDirection: 'row', gap: 10, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f1f5f9'}}>
                    <TouchableOpacity 
                      style={[styles.actionBtn, {flex: 1, backgroundColor: '#f1f5f9', marginBottom: 0}]}
                      onPress={() => router.push(`/chat/${user.username}`)}
                    >
                      <Text style={[styles.actionBtnText, {color: '#475569'}]}>MESSAGE</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionBtn, {flex: 1, backgroundColor: '#fff7ed', marginBottom: 0}]}
                      onPress={() => { setEmailTarget(user); setShowEmailModal(true); }}
                    >
                      <Text style={[styles.actionBtnText, {color: '#ea580c'}]}>EMAIL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionBtn, {flex: 1, backgroundColor: '#ecfdf5', marginBottom: 0}]}
                      onPress={() => { setFundTarget(user); setShowFundModal(true); }}
                    >
                      <Text style={[styles.actionBtnText, {color: '#059669'}]}>ROUTE SC</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* --- PROMOS TAB --- */}
        {activeTab === 'promos' && (
          <View>
            <Text style={styles.sectionTitle}>PROMO ENGINE</Text>
            
            <View style={styles.metricCardLight}>
              <Text style={styles.metricLabelLight}>GENERATE NEW CODE</Text>
              
              <Text style={[styles.inputLabel, {marginTop: 10}]}>BASE WORD (MAX 10 CHARS)</Text>
              <TextInput 
                style={styles.textInputFull} 
                maxLength={10}
                autoCapitalize="characters"
                placeholder="e.g. WINTER"
                value={baseWord}
                onChangeText={setBaseWord}
              />

              <Text style={styles.inputLabel}>DISCOUNT PERCENT (%)</Text>
              <TextInput 
                style={styles.textInputFull} 
                keyboardType="numeric"
                placeholder="15"
                value={promoDiscount}
                onChangeText={setPromoDiscount}
              />

              <TouchableOpacity 
                style={[styles.actionBtnDark, {marginBottom: 0}]} 
                onPress={handleGeneratePromo}
                disabled={isGeneratingPromo}
              >
                <Text style={styles.actionBtnTextDark}>{isGeneratingPromo ? 'GENERATING...' : 'GENERATE KEY'}</Text>
              </TouchableOpacity>
            </View>

            {promos.length === 0 ? (
              <Text style={styles.emptyText}>No promo codes generated yet.</Text>
            ) : (
              promos.map(promo => (
                <View key={promo.id} style={[styles.listCard, !promo.is_active && {opacity: 0.6}]}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10}}>
                    <View style={[styles.pillGray, {backgroundColor: promo.is_active ? '#dcfce7' : '#fee2e2'}]}>
                      <Text style={[styles.pillTextGray, {color: promo.is_active ? '#166534' : '#b91c1c'}]}>
                        {promo.is_active ? 'ACTIVE' : 'DISABLED'}
                      </Text>
                    </View>
                    <Text style={styles.listSubTextBold}>Usages: {promo.usage_count}</Text>
                  </View>
                  
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                    <View>
                      <Text style={[styles.listTitle, {fontFamily: 'monospace', letterSpacing: 1}]}>{promo.code}</Text>
                      <Text style={[styles.listAmountGreen, {marginTop: 5}]}>{promo.discount_percent}% OFF</Text>
                    </View>
                    <TouchableOpacity 
                      style={[styles.transferBtn, {flex: 0, paddingHorizontal: 20, backgroundColor: promo.is_active ? '#fee2e2' : '#dcfce7'}]}
                      onPress={() => handleTogglePromo(promo.id)}
                    >
                      <Text style={[styles.transferBtnText, {color: promo.is_active ? '#ef4444' : '#10b981'}]}>
                        {promo.is_active ? 'KILL' : 'ACTIVATE'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* --- BROADCAST TAB --- */}
        {activeTab === 'broadcast' && (
          <View>
            <Text style={styles.sectionTitle}>EMAIL BROADCAST</Text>
            
            <View style={styles.metricCardLight}>
              <Text style={styles.inputLabel}>SUBJECT LINE</Text>
              <TextInput 
                style={styles.textInputFull} 
                placeholder="e.g. 🚨 The Midnight Vault is Open"
                value={broadcastSubject}
                onChangeText={setBroadcastSubject}
              />

              <Text style={styles.inputLabel}>HERO IMAGE URL</Text>
              <TextInput 
                style={[styles.textInputFull, {color: '#3b82f6'}]} 
                value={broadcastImage}
                onChangeText={setBroadcastImage}
              />

              <TouchableOpacity onPress={handleBroadcastImageUpload} style={styles.imageUploadBtn}>
                <Text style={styles.imageUploadBtnText}>{isUploadingBroadcastImg ? 'UPLOADING...' : 'UPLOAD NEW IMAGE'}</Text>
              </TouchableOpacity>

              <Text style={styles.inputLabel}>MAIN HEADLINE</Text>
              <TextInput 
                style={styles.textInputFull} 
                placeholder="e.g. EXCLUSIVE NEW DROP"
                value={broadcastHeadline}
                onChangeText={setBroadcastHeadline}
              />

              <Text style={styles.inputLabel}>PROMO CODE (OPTIONAL)</Text>
              <TextInput 
                style={styles.textInputFull} 
                autoCapitalize="characters"
                placeholder="e.g. MIDNIGHT20"
                value={broadcastPromo}
                onChangeText={setBroadcastPromo}
              />

              <Text style={styles.inputLabel}>BODY TEXT</Text>
              <TextInput 
                style={[styles.textInputFull, {minHeight: 100, textAlignVertical: 'top'}]} 
                multiline
                placeholder="Write your email body here..."
                value={broadcastBody}
                onChangeText={setBroadcastBody}
              />

              <TouchableOpacity 
                style={[styles.actionBtnDark, {marginBottom: 0, marginTop: 10}]} 
                onPress={handleDeployBroadcast}
                disabled={isBroadcasting}
              >
                <Text style={styles.actionBtnTextDark}>{isBroadcasting ? 'DEPLOYING...' : 'LAUNCH BROADCAST'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </ScrollView>

      {/* --- EDIT PRODUCT MODAL --- */}
      <Modal visible={showEditModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlayFlex}>
          <View style={styles.modalContentFlex}>
            <View style={styles.modalHeaderFlex}>
              <Text style={styles.modalTitleFlex}>EDIT PRODUCT</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}><Text style={styles.modalCloseFlex}>✕</Text></TouchableOpacity>
            </View>
            
            <ScrollView style={{padding: 20}}>
              <Text style={styles.inputLabel}>TITLE</Text>
              <TextInput style={styles.textInputFull} value={editingProduct.title} onChangeText={t => setEditingProduct({...editingProduct, title: t})} />
              
              <Text style={styles.inputLabel}>PRICE ($)</Text>
              <TextInput style={styles.textInputFull} value={editingProduct.price?.toString()} keyboardType="numeric" onChangeText={t => setEditingProduct({...editingProduct, price: parseFloat(t) || 0})} />
              
              <Text style={styles.inputLabel}>CATEGORY</Text>
              <TextInput style={styles.textInputFull} value={editingProduct.category} onChangeText={t => setEditingProduct({...editingProduct, category: t})} />
              
              <Text style={styles.inputLabel}>DESCRIPTION</Text>
              <TextInput style={[styles.textInputFull, {minHeight: 80}]} multiline value={editingProduct.description} onChangeText={t => setEditingProduct({...editingProduct, description: t})} />
              
              <Text style={styles.inputLabel}>COVER IMAGE</Text>
              <TouchableOpacity onPress={handleProductImageUpload} style={styles.imageUploadBtn}>
                <Text style={styles.imageUploadBtnText}>{isUploadingImage ? 'UPLOADING...' : 'CHANGE IMAGE'}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveModalBtn} onPress={handleEditProduct}>
                <Text style={styles.saveModalBtnText}>SAVE CHANGES</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- DELETE POST MODAL --- */}
      <Modal visible={showDeleteModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlayFlex}>
          <View style={[styles.modalContentFlex, {maxHeight: '70%'}]}>
            <View style={styles.modalHeaderFlex}>
              <Text style={styles.modalTitleFlex}>DELETE POST</Text>
              <TouchableOpacity onPress={() => setShowDeleteModal(false)}><Text style={styles.modalCloseFlex}>✕</Text></TouchableOpacity>
            </View>
            
            <View style={{padding: 20}}>
              <View style={[styles.pillRed, {marginBottom: 15, padding: 10, alignSelf: 'stretch'}]}>
                <Text style={[styles.pillTextRed, {textAlign: 'center'}]}>⚠️ Permanently deletes post & emails user.</Text>
              </View>
              
              <Text style={styles.inputLabel}>REASON FOR DELETION (EMAILED TO USER)</Text>
              <TextInput 
                style={[styles.textInputFull, {minHeight: 80}]} 
                multiline 
                placeholder="e.g. Violation of community guidelines regarding..."
                value={deleteReason} 
                onChangeText={setDeleteReason} 
              />

              <TouchableOpacity style={[styles.saveModalBtn, {backgroundColor: '#ef4444'}]} onPress={confirmDeletePost} disabled={isDeletingPost}>
                <Text style={styles.saveModalBtnText}>{isDeletingPost ? 'DELETING...' : 'CONFIRM DELETE'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- EMAIL USER MODAL --- */}
      <Modal visible={showEmailModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlayFlex}>
          <View style={styles.modalContentFlex}>
            <View style={styles.modalHeaderFlex}>
              <Text style={styles.modalTitleFlex}>EMAIL @{emailTarget?.username}</Text>
              <TouchableOpacity onPress={() => setShowEmailModal(false)}><Text style={styles.modalCloseFlex}>✕</Text></TouchableOpacity>
            </View>
            
            <ScrollView style={{padding: 20}}>
              <Text style={styles.inputLabel}>SUBJECT</Text>
              <TextInput style={styles.textInputFull} value={emailSubject} onChangeText={setEmailSubject} />
              
              <Text style={styles.inputLabel}>MESSAGE BODY</Text>
              <TextInput style={[styles.textInputFull, {minHeight: 120}]} multiline value={emailBody} onChangeText={setEmailBody} />

              <TouchableOpacity style={styles.saveModalBtn} onPress={handleSendAdminEmail} disabled={isSendingEmail}>
                <Text style={styles.saveModalBtnText}>{isSendingEmail ? 'DISPATCHING...' : 'SEND SECURE EMAIL'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- FUND WALLET MODAL --- */}
      <Modal visible={showFundModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlayFlex}>
          <View style={styles.modalContentFlex}>
            <View style={styles.modalHeaderFlex}>
              <Text style={styles.modalTitleFlex}>ROUTE SC TO @{fundTarget?.username}</Text>
              <TouchableOpacity onPress={() => setShowFundModal(false)}><Text style={styles.modalCloseFlex}>✕</Text></TouchableOpacity>
            </View>
            
            <View style={{padding: 20}}>
              <View style={[styles.pillGreen, {marginBottom: 15, padding: 10, alignSelf: 'stretch'}]}>
                <Text style={[styles.pillTextGreen, {textAlign: 'center'}]}>Deducts from personal Admin wallet.</Text>
              </View>

              <Text style={styles.inputLabel}>AMOUNT (SC)</Text>
              <TextInput 
                style={[styles.textInputFull, {fontSize: 24, fontWeight: '900', textAlign: 'center'}]} 
                keyboardType="numeric" 
                value={fundAmount} 
                onChangeText={setFundAmount} 
                placeholder="0.00"
              />

              <TouchableOpacity style={[styles.saveModalBtn, {backgroundColor: '#10b981'}]} onPress={handleTransferFunds} disabled={isFunding}>
                <Text style={styles.saveModalBtnText}>{isFunding ? 'PROCESSING...' : 'CONFIRM TRANSFER'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  
  mobileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', zIndex: 10 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoIcon: { fontSize: 24 },
  headerTitle: { fontWeight: '900', fontSize: 18, color: '#0f172a', letterSpacing: 1 },
  hamburgerBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  hamburgerIcon: { fontSize: 18, color: '#475569', fontWeight: 'bold' },

  modalOverlay: { flex: 1, flexDirection: 'row' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sidebarMenu: { width: '80%', maxWidth: 300, backgroundColor: '#0f1115', position: 'absolute', top: 0, bottom: 0, left: 0, zIndex: 100, shadowColor: '#000', shadowOffset: { width: 5, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 20 },
  sidebarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 40, backgroundColor: '#0f1115' },
  sidebarTitle: { fontWeight: '900', fontSize: 18, color: 'white', letterSpacing: 1 },
  closeIcon: { fontSize: 24, color: '#94a3b8' },
  sidebarScroll: { paddingHorizontal: 15 },
  
  storefrontBtn: { padding: 12, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 20, marginTop: 10 },
  storefrontBtnText: { color: '#cbd5e1', fontWeight: 'bold', textAlign: 'center' },
  
  sidebarCategory: { fontSize: 10, fontWeight: '900', color: '#64748b', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10, marginTop: 15, paddingHorizontal: 10 },
  sidebarBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 15, borderRadius: 30, marginBottom: 5 },
  sidebarBtnText: { color: '#94a3b8', fontWeight: 'bold', fontSize: 14 },
  
  sidebarBtnActive: { backgroundColor: 'rgba(6, 182, 212, 0.1)' },
  sidebarBtnTextActive: { color: '#22d3ee' },
  sidebarBtnActiveBlue: { backgroundColor: 'rgba(59, 130, 246, 0.1)' },
  sidebarBtnTextActiveBlue: { color: '#60a5fa' },
  sidebarBtnActiveOrange: { backgroundColor: 'rgba(249, 115, 22, 0.1)' },
  sidebarBtnTextActiveOrange: { color: '#fb923c' },
  sidebarBtnActiveGreen: { backgroundColor: 'rgba(16, 185, 129, 0.1)' },
  sidebarBtnTextActiveGreen: { color: '#34d399' },
  sidebarBtnActiveRed: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  sidebarBtnTextActiveRed: { color: '#f87171' },
  sidebarBtnActivePurple: { backgroundColor: 'rgba(168, 85, 247, 0.1)' },
  sidebarBtnTextActivePurple: { color: '#c084fc' },
  sidebarBtnActivePink: { backgroundColor: 'rgba(236, 72, 153, 0.1)' },
  sidebarBtnTextActivePink: { color: '#f472b6' },

  badge: { backgroundColor: '#f97316', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  badgeText: { color: 'white', fontSize: 10, fontWeight: 'bold' },

  contentContainer: { padding: 15 },
  sectionTitle: { fontSize: 12, fontWeight: '900', color: '#94a3b8', letterSpacing: 1.5, marginBottom: 15, marginTop: 10 },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 30, fontStyle: 'italic' },

  metricCardLight: { backgroundColor: 'white', padding: 20, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#e2e8f0' },
  metricLabelLight: { fontSize: 12, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginBottom: 5 },
  metricValueDark: { fontSize: 32, fontWeight: '900', color: '#0f172a' },
  metricValueOrange: { fontSize: 32, fontWeight: '900', color: '#f97316' },
  
  metricCardDark: { backgroundColor: '#0f172a', padding: 20, borderRadius: 16, marginBottom: 15 },
  metricLabelCyan: { fontSize: 12, fontWeight: 'bold', color: '#06b6d4', textTransform: 'uppercase', marginBottom: 5 },
  metricLabelOrange: { fontSize: 12, fontWeight: 'bold', color: '#fb923c', textTransform: 'uppercase', marginBottom: 5 },
  metricValueWhite: { fontSize: 32, fontWeight: '900', color: 'white' },
  
  metricCardGreen: { backgroundColor: '#ecfdf5', padding: 20, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: '#a7f3d0' },
  metricLabelGreenDark: { fontSize: 12, fontWeight: 'bold', color: '#047857', textTransform: 'uppercase', marginBottom: 5 },
  metricValueGreen: { fontSize: 32, fontWeight: '900', color: '#059669' },
  
  metricSub: { fontSize: 14, color: '#94a3b8' },

  vaultCard: { backgroundColor: '#1e3a8a', padding: 25, borderRadius: 20, marginBottom: 20 },
  vaultLabel: { fontSize: 12, fontWeight: 'bold', color: '#60a5fa', textTransform: 'uppercase', marginBottom: 10 },
  vaultAmount: { fontSize: 36, fontWeight: '900', color: 'white' },
  vaultAmountSub: { fontSize: 18, color: '#2563eb' },

  listCard: { backgroundColor: 'white', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  listTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  listAmountGreen: { fontSize: 16, fontWeight: '900', color: '#059669' },
  listSubTextBold: { fontSize: 13, fontWeight: 'bold', color: '#475569', marginBottom: 2 },
  listSubText: { fontSize: 12, color: '#64748b' },
  
  orderItemBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f1f5f9', padding: 10, borderRadius: 8, marginTop: 10 },
  orderSku: { fontSize: 12, fontWeight: 'bold', color: '#475569', fontFamily: 'monospace' },
  orderQty: { fontSize: 12, fontWeight: '900', color: '#0f172a' },

  pillBlue: { backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pillTextBlue: { color: '#1d4ed8', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  pillGray: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pillTextGray: { color: '#475569', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },

  placeholderBox: { backgroundColor: 'white', padding: 30, borderRadius: 16, alignItems: 'center', marginTop: 20, borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed' },
  placeholderIcon: { fontSize: 40, marginBottom: 15 },
  placeholderTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', marginBottom: 10 },
  placeholderText: { textAlign: 'center', color: '#64748b', fontSize: 14, lineHeight: 22 },

  textInput: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 10, fontSize: 14 },
  textInputFull: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, fontSize: 14, marginBottom: 15 },
  actionBtn: { backgroundColor: '#0ea5e9', padding: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  actionBtnText: { color: 'white', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  actionBtnDark: { backgroundColor: '#0f172a', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 20 },
  actionBtnTextDark: { color: 'white', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  
  pillGreen: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pillTextGreen: { color: '#166534', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  pillRed: { backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pillTextRed: { color: '#b91c1c', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },

  adminActionRow: { flexDirection: 'row', gap: 10, marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  transferBtn: { flex: 1, backgroundColor: '#f1f5f9', padding: 10, borderRadius: 8, alignItems: 'center' },
  transferBtnText: { color: '#475569', fontWeight: '900', fontSize: 10, letterSpacing: 1 },

  modalOverlayFlex: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContentFlex: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeaderFlex: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitleFlex: { fontSize: 14, fontWeight: '900', color: '#0f172a', letterSpacing: 1 },
  modalCloseFlex: { fontSize: 18, color: '#94a3b8', fontWeight: 'bold' },
  inputLabel: { fontSize: 10, fontWeight: '900', color: '#64748b', letterSpacing: 1, marginBottom: 5 },
  imageUploadBtn: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'dashed', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 20 },
  imageUploadBtnText: { color: '#64748b', fontWeight: 'bold', fontSize: 12 },
  saveModalBtn: { backgroundColor: '#0f172a', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 30 },
  saveModalBtnText: { color: 'white', fontWeight: '900', fontSize: 12, letterSpacing: 1 },

  statRowDark: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  statValueDark: { fontSize: 13, fontWeight: '900', color: '#0f172a' }
});
