import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

const API_BASE = "https://streetcode101.com/api";

export default function VendorDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  // Dashboard State
  const [metrics, setMetrics] = useState({ availableBalance: 0, escrowBalance: 0, totalSales: 0 });
  const [orders, setOrders] = useState<any[]>([]);
  
  // Action State
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});
  const [cashoutAmount, setCashoutAmount] = useState('');
  const [zelleContact, setZelleContact] = useState('');
  const [isCashingOut, setIsCashingOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync('pidrop_token');
      if (!storedToken) return router.replace('/login');
      setToken(storedToken);

      const res = await fetch(`${API_BASE}/vendor/dashboard`, {
        headers: { 'Authorization': `Bearer ${storedToken}` }
      });
      const data = await res.json();
      
      if (res.ok) {
        setMetrics({
          availableBalance: data.availableBalance,
          escrowBalance: data.escrowBalance,
          totalSales: data.totalSales
        });
        setOrders(data.orders || []);
      }
    } catch (err) {
      Alert.alert("Error", "Failed to load vendor dashboard.");
    } finally {
      setLoading(false);
    }
  };

  const submitTracking = async (orderId: string, rawId: number) => {
    const trackingNo = trackingInputs[orderId];
    if (!trackingNo || trackingNo.trim() === '') {
      return Alert.alert('Error', 'Enter a valid tracking number.');
    }
    
    try {
      const res = await fetch(`${API_BASE}/vendor/orders/${rawId}/ship`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ tracking_number: trackingNo })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to release escrow');
      
      // Optimistic UI Update
      setOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, status: 'shipped', escrowStatus: 'released', trackingNumber: trackingNo } : o
      ));
      
      const orderPayout = orders.find(o => o.id === orderId)?.price || 0;
      setMetrics(prev => ({
        ...prev,
        availableBalance: prev.availableBalance + orderPayout,
        escrowBalance: prev.escrowBalance - orderPayout
      }));
      
      Alert.alert("Success", `Tracking sent & Escrow Released!`);
    } catch(err: any) {
      Alert.alert("Error", err.message);
    }
  };

  const handleCashout = async () => {
    const amount = parseFloat(cashoutAmount);
    if (!amount || amount < 10) return Alert.alert("Error", "Minimum cashout is 10 SC.");
    if (amount > metrics.availableBalance) return Alert.alert("Error", "Insufficient balance.");
    if (!zelleContact.trim()) return Alert.alert("Error", "Zelle contact is required.");

    setIsCashingOut(true);
    try {
      const res = await fetch(`${API_BASE}/vendor/cashout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ amount_coins: amount, zelle_contact: zelleContact })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Cashout failed');
      
      Alert.alert("Success", "Cashout requested successfully!");
      setMetrics(prev => ({ ...prev, availableBalance: prev.availableBalance - amount }));
      setCashoutAmount('');
      setZelleContact('');
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setIsCashingOut(false);
    }
  };

  const taxAmount = (parseFloat(cashoutAmount || '0') * 0.05).toFixed(2);
  const payoutAmount = (parseFloat(cashoutAmount || '0') * 0.95).toFixed(2);

  if (loading) {
    return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#f97316" /></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>VENDOR CONSOLE</Text>
          <Text style={styles.headerSub}>Manage Drops & Escrow</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/profile')} style={styles.profileBtn}>
          <Text style={styles.profileBtnText}>PROFILE</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
      >
        
        {/* Metrics Grid */}
        <View style={styles.metricRow}>
          <View style={[styles.metricCard, {flex: 1, marginRight: 10}]}>
            <Text style={styles.metricLabel}>Available Wallet</Text>
            <Text style={styles.metricValue}>{metrics.availableBalance.toFixed(2)} <Text style={styles.metricUnit}>SC</Text></Text>
          </View>
          <View style={[styles.metricCardDark, {flex: 1}]}>
            <Text style={styles.metricLabelCyan}>🔒 Escrow</Text>
            <Text style={styles.metricValueWhite}>{metrics.escrowBalance.toFixed(2)} <Text style={styles.metricUnitDark}>SC</Text></Text>
          </View>
        </View>
        
        <View style={[styles.metricCard, {marginBottom: 20}]}>
          <Text style={styles.metricLabel}>Total Orders</Text>
          <Text style={styles.metricValue}>{metrics.totalSales}</Text>
        </View>

        {/* Fulfillment Queue */}
        <Text style={styles.sectionTitle}>FULFILLMENT QUEUE</Text>
        
        {orders.length === 0 ? (
          <Text style={styles.emptyText}>No orders yet.</Text>
        ) : (
          orders.map(order => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderIdBadge}>{order.id}</Text>
                <Text style={styles.orderDate}>{order.date}</Text>
              </View>
              
              <Text style={styles.productName}>{order.productName}</Text>
              <Text style={styles.buyerText}>Buyer: @{order.buyerUsername}</Text>
              
              <View style={styles.addressBox}>
                <Text style={styles.addressLabel}>SHIPPING DESTINATION</Text>
                <Text style={styles.addressText}>{order.shippingAddress}</Text>
              </View>

              <View style={styles.payoutRow}>
                <View>
                  <Text style={styles.payoutLabel}>PAYOUT</Text>
                  <Text style={styles.payoutAmount}>{order.price.toFixed(2)} SC</Text>
                </View>
                {order.escrowStatus === 'locked' ? (
                  <View style={styles.escrowBadge}><Text style={styles.escrowBadgeText}>🔒 ESCROW</Text></View>
                ) : (
                  <View style={styles.releasedBadge}><Text style={styles.releasedBadgeText}>✓ RELEASED</Text></View>
                )}
              </View>

              {order.status === 'pending' ? (
                <View style={styles.trackingContainer}>
                  <Text style={styles.trackingLabel}>INPUT TRACKING TO RELEASE FUNDS</Text>
                  <View style={styles.trackingInputRow}>
                    <TextInput 
                      style={styles.trackingInput}
                      placeholder="e.g. 1Z9999..."
                      value={trackingInputs[order.id] || ''}
                      onChangeText={(val) => setTrackingInputs(prev => ({ ...prev, [order.id]: val }))}
                    />
                    <TouchableOpacity style={styles.submitBtn} onPress={() => submitTracking(order.id, order.rawId)}>
                      <Text style={styles.submitBtnText}>SUBMIT</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.shippedContainer}>
                  <Text style={styles.shippedLabel}>SHIPPED VIA {order.trackingNumber?.startsWith('1Z') ? 'UPS' : 'USPS'}</Text>
                  <Text style={styles.shippedNumber}>{order.trackingNumber}</Text>
                </View>
              )}
            </View>
          ))
        )}

        {/* Fiat Offramp */}
        <Text style={[styles.sectionTitle, {marginTop: 10}]}>FIAT OFFRAMP</Text>
        <View style={styles.offrampCard}>
          <Text style={styles.offrampTitle}>CONVERT TO USD VIA ZELLE</Text>
          <Text style={styles.offrampDesc}>Withdraw your available StreetCoins. The platform retains a 5% infrastructure tax.</Text>

          <Text style={styles.inputLabel}>ZELLE EMAIL OR PHONE</Text>
          <TextInput 
            style={styles.textInputFull}
            placeholder="name@email.com"
            value={zelleContact}
            onChangeText={setZelleContact}
            keyboardType="email-address"
          />

          <Text style={styles.inputLabel}>AMOUNT TO WITHDRAW (MIN 10 SC)</Text>
          <TextInput 
            style={styles.textInputFull}
            placeholder="0.00"
            value={cashoutAmount}
            onChangeText={setCashoutAmount}
            keyboardType="numeric"
          />

          <View style={styles.taxBox}>
            <View style={styles.taxRow}><Text style={styles.taxText}>Requested</Text><Text style={styles.taxText}>{parseFloat(cashoutAmount || '0').toFixed(2)} SC</Text></View>
            <View style={styles.taxRow}><Text style={styles.taxTextRed}>Platform Tax (5%)</Text><Text style={styles.taxTextRed}>-{taxAmount} SC</Text></View>
            <View style={styles.divider} />
            <View style={styles.taxRow}><Text style={styles.totalText}>Total Payout</Text><Text style={styles.totalAmountGreen}>${payoutAmount} USD</Text></View>
          </View>

          <TouchableOpacity style={styles.cashoutBtn} onPress={handleCashout} disabled={isCashingOut}>
            <Text style={styles.cashoutBtnText}>{isCashingOut ? 'PROCESSING...' : 'REQUEST CASHOUT'}</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  scrollContent: { padding: 15, paddingBottom: 50 },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a', letterSpacing: 1 },
  headerSub: { fontSize: 10, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginTop: 2 },
  profileBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  profileBtnText: { fontSize: 10, fontWeight: '900', color: '#475569', letterSpacing: 1 },

  metricRow: { flexDirection: 'row', marginBottom: 10 },
  metricCard: { backgroundColor: 'white', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  metricLabel: { fontSize: 10, fontWeight: '900', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  metricValue: { fontSize: 28, fontWeight: '900', color: '#0f172a' },
  metricUnit: { fontSize: 14, color: '#94a3b8' },
  
  metricCardDark: { backgroundColor: '#0f172a', padding: 20, borderRadius: 16 },
  metricLabelCyan: { fontSize: 10, fontWeight: '900', color: '#06b6d4', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  metricValueWhite: { fontSize: 28, fontWeight: '900', color: 'white' },
  metricUnitDark: { fontSize: 14, color: '#64748b' },

  sectionTitle: { fontSize: 14, fontWeight: '900', color: '#0f172a', letterSpacing: 1, marginBottom: 15, marginTop: 5 },
  emptyText: { textAlign: 'center', color: '#94a3b8', marginTop: 20, fontStyle: 'italic', fontWeight: 'bold' },

  orderCard: { backgroundColor: 'white', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 15 },
  orderHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  orderIdBadge: { backgroundColor: '#f1f5f9', color: '#475569', fontSize: 10, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  orderDate: { fontSize: 10, fontWeight: 'bold', color: '#94a3b8' },
  productName: { fontSize: 16, fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', marginBottom: 2 },
  buyerText: { fontSize: 12, fontWeight: 'bold', color: '#0284c7', marginBottom: 15 },
  
  addressBox: { backgroundColor: '#f1f5f9', padding: 10, borderRadius: 8, marginBottom: 15 },
  addressLabel: { fontSize: 10, fontWeight: '900', color: '#94a3b8', marginBottom: 2 },
  addressText: { fontSize: 12, fontWeight: '600', color: '#334155' },

  payoutRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  payoutLabel: { fontSize: 10, fontWeight: '900', color: '#94a3b8', marginBottom: 2 },
  payoutAmount: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  escrowBadge: { backgroundColor: '#ffedd5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#fed7aa' },
  escrowBadgeText: { color: '#ea580c', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  releasedBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#bbf7d0' },
  releasedBadgeText: { color: '#166534', fontSize: 10, fontWeight: '900', letterSpacing: 1 },

  trackingContainer: { marginTop: 5 },
  trackingLabel: { fontSize: 10, fontWeight: '900', color: '#64748b', marginBottom: 8 },
  trackingInputRow: { flexDirection: 'row', gap: 10 },
  trackingInput: { flex: 1, backgroundColor: 'white', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, paddingHorizontal: 12, fontSize: 14, fontWeight: 'bold' },
  submitBtn: { backgroundColor: '#0f172a', paddingHorizontal: 20, justifyContent: 'center', borderRadius: 8 },
  submitBtnText: { color: 'white', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  
  shippedContainer: { backgroundColor: '#ecfdf5', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#d1fae5' },
  shippedLabel: { fontSize: 10, fontWeight: '900', color: '#059669', marginBottom: 2 },
  shippedNumber: { fontSize: 14, fontWeight: 'bold', color: '#334155' },

  offrampCard: { backgroundColor: 'white', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20 },
  offrampTitle: { fontSize: 14, fontWeight: '900', color: '#0f172a', letterSpacing: 1, marginBottom: 5 },
  offrampDesc: { fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 20 },
  inputLabel: { fontSize: 10, fontWeight: '900', color: '#94a3b8', letterSpacing: 1, marginBottom: 5 },
  textInputFull: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, padding: 12, fontSize: 14, fontWeight: 'bold', marginBottom: 15 },
  
  taxBox: { backgroundColor: '#f8fafc', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20 },
  taxRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  taxText: { fontSize: 12, fontWeight: 'bold', color: '#64748b' },
  taxTextRed: { fontSize: 12, fontWeight: 'bold', color: '#ef4444' },
  divider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 8 },
  totalText: { fontSize: 14, fontWeight: '900', color: '#0f172a', textTransform: 'uppercase' },
  totalAmountGreen: { fontSize: 16, fontWeight: '900', color: '#10b981' },
  
  cashoutBtn: { backgroundColor: '#0f172a', padding: 15, borderRadius: 12, alignItems: 'center' },
  cashoutBtnText: { color: 'white', fontWeight: '900', fontSize: 12, letterSpacing: 1 }
});
