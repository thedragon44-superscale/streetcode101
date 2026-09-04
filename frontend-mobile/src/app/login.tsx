import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  Alert, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';

const API_BASE = "https://streetcode101.com/api";

export default function LoginScreen() {
  const router = useRouter();

  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('customer');

  const handleAuth = async () => {
    if (!username.trim() || !password.trim()) {
      return Alert.alert("Missing Fields", "Please enter your username and password.");
    }

    if (isRegistering && !email.trim()) {
      return Alert.alert("Missing Fields", "Please enter a valid email address.");
    }

    setLoading(true);

    try {
      // Matching web logic exactly: /admin/login for auth, /auth/register for new accounts
      const endpoint = isRegistering ? '/auth/register' : '/admin/login';
      const requestBody = isRegistering 
        ? { username: username.trim(), email: email.trim(), password, role } 
        : { username: username.trim(), password };

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || data.message || "Authentication failed.");
      }

      if (isRegistering) {
        Alert.alert("Account Created", "Welcome to Street Code 101. Please sign in.");
        setIsRegistering(false);
        setPassword('');
      } else {
        const token = data.access_token || data.token;
        if (!token) throw new Error("No authorization token returned from server.");
        
        await SecureStore.setItemAsync('pidrop_token', token);
        Alert.alert("CONNECTED", `Welcome back, @${username}!`, [
          { text: "OK", onPress: () => router.replace('/') }
        ]);
      }

    } catch (err: any) {
      Alert.alert("Authentication Error", err.message || "Unable to connect to vault backend.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header />

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        
        <View style={styles.authCard}>
          
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {isRegistering ? 'INITIALIZE ACCOUNT' : 'AUTHENTICATE'}
            </Text>
            <Text style={styles.cardSubtitle}>
              {isRegistering 
                ? 'Join the Street Code 101 ledger to trade and comment.' 
                : 'Access your wallet, inbox, and private drops.'}
            </Text>
          </View>

          <View style={styles.toggleContainer}>
            <TouchableOpacity 
              style={[styles.toggleBtn, !isRegistering && styles.toggleBtnActive]}
              onPress={() => setIsRegistering(false)}
            >
              <Text style={[styles.toggleText, !isRegistering && styles.toggleTextActive]}>LOG IN</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.toggleBtn, isRegistering && styles.toggleBtnActive]}
              onPress={() => setIsRegistering(true)}
            >
              <Text style={[styles.toggleText, isRegistering && styles.toggleTextActive]}>REGISTER</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>USERNAME</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={18} color="#64748b" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="enter_username"
                placeholderTextColor="#475569"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {isRegistering && (
            <>
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={18} color="#64748b" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="user@streetcode101.com"
                    placeholderTextColor="#475569"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>HOW DO YOU WANT TO HUSTLE?</Text>
                <View style={styles.roleContainer}>
                  {(['customer', 'vendor', 'service_provider'] as const).map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.roleBtn, role === r && styles.roleBtnActive]}
                      onPress={() => setRole(r)}
                    >
                      <Text style={[styles.roleText, role === r && styles.roleTextActive]}>
                        {r === 'customer' ? 'COP DROPS' : r === 'vendor' ? 'SELL GEAR' : 'SERVICES'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}

          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>PASSWORD</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color="#64748b" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="••••••••••••"
                placeholderTextColor="#475569"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons 
                  name={showPassword ? "eye-off-outline" : "eye-outline"} 
                  size={18} 
                  color="#64748b" 
                />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.submitButton, loading && styles.submitDisabled]} 
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Ionicons name="key-outline" size={18} color="#000" />
                <Text style={styles.submitButtonText}>
                  {isRegistering ? 'CREATE LEDGER IDENTITY' : 'CONNECT TO VAULT'}
                </Text>
              </>
            )}
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scrollContent: { padding: 20, justifyContent: 'center', minHeight: '80%' },
  authCard: { backgroundColor: '#1e293b', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#334155', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 10 },
  cardHeader: { marginBottom: 20 },
  cardTitle: { fontSize: 20, fontWeight: '900', color: 'white', letterSpacing: 1.5, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  cardSubtitle: { fontSize: 12, color: '#94a3b8', marginTop: 6, lineHeight: 18 },
  toggleContainer: { flexDirection: 'row', backgroundColor: '#0f172a', borderRadius: 12, padding: 4, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  toggleBtnActive: { backgroundColor: '#f97316' },
  toggleText: { fontSize: 11, fontWeight: '900', color: '#64748b', letterSpacing: 1 },
  toggleTextActive: { color: '#000' },
  formGroup: { marginBottom: 16 },
  inputLabel: { color: '#60a5fa', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 6, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 10, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 12, height: 46 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: 'white', fontSize: 14, fontWeight: '500' },
  roleContainer: { flexDirection: 'row', gap: 8 },
  roleBtn: { flex: 1, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  roleBtnActive: { borderColor: '#60a5fa', backgroundColor: 'rgba(96, 165, 250, 0.1)' },
  roleText: { color: '#64748b', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  roleTextActive: { color: '#60a5fa' },
  submitButton: { backgroundColor: '#f97316', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 15, borderRadius: 12, marginTop: 10, gap: 8 },
  submitDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#000', fontWeight: '900', fontSize: 12, letterSpacing: 1 }
});
