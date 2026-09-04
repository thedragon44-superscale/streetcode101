import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import Header from '../components/Header';

const API_BASE = "https://streetcode101.com/api"; 

export default function WalletScreen() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      // Pull the real token from encrypted device storage!
      const token = await SecureStore.getItemAsync('pidrop_token');
      
      if (!token) {
        Alert.alert("Not Logged In", "Please log in to view your wallet.");
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE}/profile/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.ok) {
        setUser(await res.json());
      } else {
        Alert.alert('Session Expired', 'Please log in again.');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to load wallet data');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyIdentity = () => {
    router.push('/kyc');
  };

  return (
    <View style={styles.container}>
      
      {/* CUSTOM HEADER PINNED TO THE TOP */}
      <Header />

      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="large" color="#f97316" style={styles.loader} />
        ) : !user ? (
          <Text style={styles.errorText}>Unauthorized - Please Log In</Text>
        ) : (
          <>
            <View style={styles.balanceCard}>
              <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
              <Text style={styles.balanceAmount}>{user.wallet_balance?.toFixed(2) || '0.00'} SC</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Withdraw Funds</Text>
              
              {user.is_verified ? (
                <View style={styles.unlockedBox}>
                   <Text style={styles.unlockedText}>Withdrawals Unlocked!</Text>
                </View>
              ) : (
                <View style={styles.lockedBox}>
                  <Text style={styles.lockedText}>Cashouts are restricted until your identity is verified by Stripe.</Text>
                  <TouchableOpacity style={styles.verifyButton} onPress={handleVerifyIdentity}>
                    <Text style={styles.verifyButtonText}>Verify Identity via Camera</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { flex: 1, padding: 20 },
  loader: { flex: 1, justifyContent: 'center' },
  errorText: { color: 'red', textAlign: 'center', marginTop: 50 },
  balanceCard: { backgroundColor: '#1e293b', padding: 25, borderRadius: 15, alignItems: 'center', marginBottom: 30 },
  balanceLabel: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold', letterSpacing: 1, marginBottom: 5 },
  balanceAmount: { color: 'white', fontSize: 40, fontWeight: 'bold' },
  section: { backgroundColor: '#1e293b', padding: 20, borderRadius: 15 },
  sectionTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  lockedBox: { alignItems: 'center', padding: 15 },
  lockedText: { color: '#94a3b8', textAlign: 'center', marginBottom: 20 },
  verifyButton: { backgroundColor: '#f97316', paddingVertical: 15, paddingHorizontal: 30, borderRadius: 10, width: '100%', alignItems: 'center' },
  verifyButtonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  unlockedBox: { alignItems: 'center', padding: 15 },
  unlockedText: { color: '#10b981', fontWeight: 'bold' }
});
