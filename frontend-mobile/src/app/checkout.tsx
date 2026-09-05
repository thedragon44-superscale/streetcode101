import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { useCart } from '../context/CartContext';

const API_BASE = "https://streetcode101.com/api";

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cart, cartTotal, clearCart, reloadCart } = useCart();

  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [userEmail, setUserEmail] = useState('');
  
  const [shippingName, setShippingName] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingState, setShippingState] = useState('');
  const [shippingZip, setShippingZip] = useState('');
  
  const [promoCode, setPromoCode] = useState('');
  const [activeDiscountPercent, setActiveDiscountPercent] = useState(0);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);

  useEffect(() => {
    fetchWalletBalance();
  }, []);

  const fetchWalletBalance = async () => {
    try {
      const token = await SecureStore.getItemAsync('pidrop_token');
      if (!token) {
        Alert.alert("Authentication Required", "Please log in to proceed to checkout.");
        router.replace('/login');
        return;
      }

      const res = await fetch(`${API_BASE}/profile/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.status === 401) {
        await SecureStore.deleteItemAsync('pidrop_token');
        Alert.alert("Session Expired", "Please log in again.");
        router.replace('/login');
        return;
      }

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Server Error ${res.status}: ${errText}`);
      }
      
      const data = await res.json();
      setWalletBalance(data.wallet_balance || 0);
      setUserEmail(data.email || 'user@streetcode101.com'); 
      
      if (data.discount_percent && data.discount_percent > 0) {
        setActiveDiscountPercent(data.discount_percent);
      }
      
    } catch (err: any) {
      console.error("Checkout Auth Error:", err);
      Alert.alert("Connection Error", err.message || "Failed to reach the server.");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleValidatePromo = async () => {
    if (!promoCode.trim()) return;
    setIsValidatingPromo(true);
    
    try {
      const res = await fetch(`${API_BASE}/validate-promo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Invalid or expired code.");
      
      setActiveDiscountPercent(prev => prev + data.discount_percent);
      Alert.alert("Access Granted", `${data.discount_percent}% discount applied to the vault payload.`);
    } catch (err: any) {
      Alert.alert("Denied", err.message);
      setPromoCode('');
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const handleStreetCoinCheckout = async () => {
    if (!shippingName || !shippingAddress || !shippingCity || !shippingState || !shippingZip) {
      return Alert.alert("Error", "All shipping fields are required.");
    }
    
    const token = await SecureStore.getItemAsync('pidrop_token');
    if (!token) return router.replace('/login');

    setIsProcessing(true);
    
    const formattedShipping = `${shippingName}\n${shippingAddress}\n${shippingCity}, ${shippingState} ${shippingZip}`;
    
    const payload = {
      items: cart.map(item => ({ sku: item.sku, quantity: item.cart_quantity || 1 })),
      promo_code: promoCode || null,
      customer_email: userEmail || 'user@streetcode101.com', 
      shipping_address: formattedShipping
    };

    try {
      const res = await fetch(`${API_BASE}/checkout/streetcoin`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to secure escrow lock.");
      
      Alert.alert(
        "Escrow Secured", 
        "Your order has been paid. The funds are locked in the Master Escrow Vault until the vendor ships your drop.",
        [{ text: "OK", onPress: () => {
          clearCart();
          reloadCart(); // Wipe the cloud cart
          router.replace('/');
        }}]
      );
      
    } catch (err: any) {
      Alert.alert("Transaction Failed", err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const finalTotal = cartTotal * (1 - (activeDiscountPercent / 100));
  const hasInsufficientFunds = walletBalance < finalTotal;

  if (loading) {
    return (
      <View style={[styles.container, styles.centerBox]}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#f97316" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>SECURE <Text style={styles.headerTitleHighlight}>CHECKOUT</Text></Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* WALLET STATUS */}
        <View style={styles.walletCard}>
          <View style={styles.walletRow}>
            <Ionicons name="wallet" size={24} color="#f97316" />
            <Text style={styles.walletLabel}>STREETCOIN BALANCE</Text>
          </View>
          <Text style={styles.walletAmount}>{walletBalance.toFixed(2)} SC</Text>
          {hasInsufficientFunds && (
            <View style={styles.warningPill}>
              <Text style={styles.warningText}>⚠️ Insufficient funds. Please top up your wallet via the web dashboard.</Text>
            </View>
          )}
        </View>

        {/* ORDER SUMMARY */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>ESCROW PAYLOAD</Text>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Base Ledger Total</Text>
              <Text style={styles.summaryValue}>{cartTotal.toFixed(2)} SC</Text>
            </View>
            
            {activeDiscountPercent > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelHighlight}>Network Discount ({activeDiscountPercent}%)</Text>
                <Text style={styles.summaryValueHighlight}>-{(cartTotal * (activeDiscountPercent / 100)).toFixed(2)} SC</Text>
              </View>
            )}

            <View style={[styles.summaryRow, styles.summaryTotalRow]}>
              <Text style={styles.summaryTotalLabel}>FINAL ESCROW LOCK</Text>
              <Text style={styles.summaryTotalValue}>{finalTotal.toFixed(2)} SC</Text>
            </View>
          </View>
        </View>

        {/* PROMO ENGINE */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>ENCRYPTED PROMO</Text>
          <View style={styles.promoRow}>
            <TextInput
              style={styles.promoInput}
              placeholder="ENTER VAULT KEY"
              placeholderTextColor="#64748b"
              autoCapitalize="characters"
              value={promoCode}
              onChangeText={setPromoCode}
            />
            <TouchableOpacity 
              style={[styles.promoBtn, (!promoCode.trim() || isValidatingPromo) && styles.promoBtnDisabled]}
              onPress={handleValidatePromo}
              disabled={!promoCode.trim() || isValidatingPromo}
            >
              <Text style={styles.promoBtnText}>{isValidatingPromo ? '...' : 'APPLY'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SHIPPING FORM */}
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>SHIPPING LOGISTICS</Text>
          <View style={styles.formContainer}>
            <TextInput style={styles.inputField} placeholder="Full Name" placeholderTextColor="#64748b" value={shippingName} onChangeText={setShippingName} />
            <TextInput style={styles.inputField} placeholder="Street Address (Apt / Suite)" placeholderTextColor="#64748b" value={shippingAddress} onChangeText={setShippingAddress} />
            
            <View style={styles.rowInputs}>
              <TextInput style={[styles.inputField, {flex: 2}]} placeholder="City" placeholderTextColor="#64748b" value={shippingCity} onChangeText={setShippingCity} />
              <View style={{width: 10}} />
              <TextInput style={[styles.inputField, {flex: 1}]} placeholder="State" placeholderTextColor="#64748b" maxLength={2} autoCapitalize="characters" value={shippingState} onChangeText={setShippingState} />
            </View>
            
            <TextInput style={styles.inputField} placeholder="ZIP Code" placeholderTextColor="#64748b" keyboardType="numeric" maxLength={5} value={shippingZip} onChangeText={setShippingZip} />
          </View>
        </View>

      </ScrollView>

      {/* FIXED BOTTOM ACTION BAR */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
        <TouchableOpacity 
          style={[styles.checkoutBtn, (hasInsufficientFunds || isProcessing) && styles.checkoutBtnDisabled]}
          onPress={handleStreetCoinCheckout}
          disabled={hasInsufficientFunds || isProcessing}
        >
          <Ionicons name={hasInsufficientFunds ? "lock-closed" : "shield-checkmark"} size={20} color={hasInsufficientFunds ? "#94a3b8" : "black"} />
          <Text style={[styles.checkoutBtnText, hasInsufficientFunds && {color: '#94a3b8'}]}>
            {isProcessing ? 'INITIATING...' : hasInsufficientFunds ? 'INSUFFICIENT FUNDS' : 'AUTHORIZE ESCROW LOCK'}
          </Text>
        </TouchableOpacity>
      </View>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  centerBox: { justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: 'white', letterSpacing: 2 },
  headerTitleHighlight: { color: '#f97316' },
  
  scrollContent: { padding: 15, paddingBottom: 40 },
  
  walletCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#334155', marginBottom: 25 },
  walletRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  walletLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  walletAmount: { color: 'white', fontSize: 32, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  warningPill: { backgroundColor: '#fee2e2', padding: 10, borderRadius: 8, marginTop: 15 },
  warningText: { color: '#ef4444', fontSize: 12, fontWeight: 'bold' },

  sectionBlock: { marginBottom: 25 },
  sectionTitle: { color: '#64748b', fontSize: 12, fontWeight: '900', letterSpacing: 1.5, marginBottom: 10, marginLeft: 5 },
  
  summaryBox: { backgroundColor: '#020617', borderRadius: 12, padding: 15, borderWidth: 1, borderColor: '#1e293b' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { color: '#94a3b8', fontSize: 14, fontWeight: 'bold' },
  summaryValue: { color: 'white', fontSize: 14, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  summaryLabelHighlight: { color: '#34d399', fontSize: 14, fontWeight: 'bold' },
  summaryValueHighlight: { color: '#34d399', fontSize: 14, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  summaryTotalRow: { borderTopWidth: 1, borderTopColor: '#1e293b', paddingTop: 15, marginTop: 5, marginBottom: 0 },
  summaryTotalLabel: { color: 'white', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  summaryTotalValue: { color: '#f97316', fontSize: 18, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  promoRow: { flexDirection: 'row', gap: 10 },
  promoInput: { flex: 1, backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 12, paddingHorizontal: 15, color: 'white', fontSize: 14, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  promoBtn: { backgroundColor: '#0ea5e9', paddingHorizontal: 20, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  promoBtnDisabled: { backgroundColor: '#334155' },
  promoBtnText: { color: 'white', fontWeight: '900', letterSpacing: 1 },

  formContainer: { gap: 12 },
  inputField: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', borderRadius: 12, paddingHorizontal: 15, paddingVertical: 14, color: 'white', fontSize: 14, fontWeight: '500' },
  rowInputs: { flexDirection: 'row' },

  bottomBar: { backgroundColor: '#0f172a', borderTopWidth: 1, borderTopColor: '#1e293b', padding: 20 },
  checkoutBtn: { backgroundColor: '#f97316', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderRadius: 12, gap: 10 },
  checkoutBtnDisabled: { backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155' },
  checkoutBtnText: { color: 'black', fontWeight: '900', fontSize: 14, letterSpacing: 1 }
});
