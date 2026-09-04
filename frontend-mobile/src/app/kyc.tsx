import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { presentIdentityVerificationSheet } from '@stripe/stripe-identity-react-native';
import Header from '../components/Header';

const API_BASE = "https://streetcode101.com/api";

export default function KYCScreen() {
  const router = useRouter();
  const [isInitializing, setIsInitializing] = useState(false);

  const startVerification = async () => {
    setIsInitializing(true);
    try {
      const token = await SecureStore.getItemAsync('pidrop_token');
      if (!token) return router.replace('/login');

      // 1. Ask FastAPI for the secure Stripe keys
      const res = await fetch(`${API_BASE}/kyc/create-session`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to initialize scanner');

      // 2. Launch the Native Stripe Camera UI
      const { status, error } = await presentIdentityVerificationSheet({
        sessionId: data.sessionId,
        ephemeralKeySecret: data.ephemeralKeySecret,
      });

      // 3. Handle the Result
      if (status === 'Canceled') {
        Alert.alert("Canceled", "Verification was canceled. You can try again later.");
      } else if (status === 'Failed') {
        Alert.alert("Verification Failed", error?.message || "We could not verify your identity.");
      } else if (status === 'Completed') {
        Alert.alert(
          "Verification Complete", 
          "Your identity has been securely verified! Your account is being upgraded.",
          [{ text: "Awesome", onPress: () => router.push('/profile') }]
        );
        // Note: In a production app, Stripe webhooks will hit your backend to officially update the user's database role.
      }
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header />
      <View style={styles.content}>
        <View style={styles.iconBox}>
          <Text style={{fontSize: 48}}>📸</Text>
        </View>
        
        <Text style={styles.title}>UPGRADE YOUR ACCOUNT</Text>
        <Text style={styles.subtitle}>
          To maintain a secure ecosystem, all Vendors and Service Providers must verify their identity. 
          Have your Government ID ready.
        </Text>

        <View style={styles.securityBox}>
          <Text style={styles.securityTitle}>🔒 BANK-GRADE SECURITY</Text>
          <Text style={styles.securityText}>
            Your ID and facial biometric data are processed directly by Stripe. Street Code 101 never stores or sees your sensitive documents.
          </Text>
        </View>

        <TouchableOpacity 
          style={styles.verifyBtn} 
          onPress={startVerification}
          disabled={isInitializing}
        >
          {isInitializing ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.verifyBtnText}>LAUNCH CAMERA & VERIFY</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center' },
  iconBox: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#e0f2fe', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '900', color: '#0f172a', letterSpacing: 1, marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 22, marginBottom: 30, paddingHorizontal: 10 },
  
  securityBox: { backgroundColor: '#f1f5f9', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 30, width: '100%' },
  securityTitle: { fontSize: 12, fontWeight: '900', color: '#0f172a', letterSpacing: 1, marginBottom: 8 },
  securityText: { fontSize: 12, color: '#475569', lineHeight: 18, fontWeight: 'bold' },

  verifyBtn: { backgroundColor: '#0f172a', width: '100%', padding: 18, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 4 },
  verifyBtnText: { color: 'white', fontWeight: '900', fontSize: 14, letterSpacing: 1 }
});
