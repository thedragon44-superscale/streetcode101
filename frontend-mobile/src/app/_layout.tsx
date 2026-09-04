import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context'; 
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Drawer } from 'expo-router/drawer';
import * as SecureStore from 'expo-secure-store';
import { useRouter, usePathname } from 'expo-router';
import { StripeProvider } from '@stripe/stripe-react-native';
import { CartProvider } from '../context/CartContext';
import CartModal from '../components/CartModal';

const API_BASE = "https://streetcode101.com/api";
const STRIPE_PUBLISHABLE_KEY = "pk_test_YOUR_STRIPE_PUBLISHABLE_KEY";

function CustomDrawerContent() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetchProfile();
  }, [pathname]);

  const fetchProfile = async () => {
    try {
      const token = await SecureStore.getItemAsync('pidrop_token');
      if (token) {
        const res = await fetch(`${API_BASE}/profile/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          setUser(await res.json());
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error("Failed to load profile for drawer", err);
      setUser(null);
    }
  };

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('pidrop_token');
    Alert.alert("Disconnected", "You have been logged out.");
    setUser(null);
    router.replace('/');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0f172a' }}>
      <TouchableOpacity 
        style={styles.drawerHeader}
        onPress={() => user ? router.push('/profile/me') : router.push('/login')}
      >
        <Image 
          source={user?.profile_image_url ? { uri: user.profile_image_url } : require('../../assets/images/sb.png')} 
          style={styles.avatarPlaceholder} 
        />
        <View style={styles.profileTextContainer}>
          <Text style={styles.username}>@{user?.username?.toUpperCase() || 'GUEST'}</Text>
          <Text style={styles.balance}>{user?.wallet_balance?.toFixed(2) || '0.00'} SC</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.routeList}>
        {/* PUBLIC ROUTES (Always Visible) */}
        <TouchableOpacity 
          style={[styles.drawerItem, pathname === '/' && styles.drawerItemActive]} 
          onPress={() => router.push('/')}
        >
          <Text style={[styles.drawerItemText, pathname === '/' && styles.drawerItemTextActive]}>
            STOREFRONT
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.drawerItem, pathname === '/services' && styles.drawerItemActive]} 
          onPress={() => router.push('/services')}
        >
          <Text style={[styles.drawerItemText, pathname === '/services' && styles.drawerItemTextActive]}>
            SERVICE CATALOG
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.drawerItem, pathname === '/feed' && styles.drawerItemActive]} 
          onPress={() => router.push('/feed')}
        >
          <Text style={[styles.drawerItemText, pathname === '/feed' && styles.drawerItemTextActive]}>
            SOCIAL FEED
          </Text>
        </TouchableOpacity>

        {/* AUTHENTICATED ROUTES (Visible Only if Logged In) */}
        {user && (
          <>
            <TouchableOpacity 
              style={[styles.drawerItem, pathname === '/inbox' && styles.drawerItemActive]} 
              onPress={() => router.push('/inbox')}
            >
              <Text style={[styles.drawerItemText, pathname === '/inbox' && styles.drawerItemTextActive]}>
                INBOX
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.drawerItem, pathname === '/wallet' && styles.drawerItemActive]} 
              onPress={() => router.push('/wallet')}
            >
              <Text style={[styles.drawerItemText, pathname === '/wallet' && styles.drawerItemTextActive]}>
                MY WALLET
              </Text>
            </TouchableOpacity>

            {user?.role === 'vendor' && (
              <TouchableOpacity 
                style={[styles.drawerItem, pathname === '/vendor' && styles.drawerItemActive]} 
                onPress={() => router.push('/vendor')}
              >
                <Text style={[styles.drawerItemText, pathname === '/vendor' && styles.drawerItemTextActive, {color: '#f97316'}]}>
                  VENDOR DASH
                </Text>
              </TouchableOpacity>
            )}

            {user?.role === 'service_provider' && (
              <TouchableOpacity 
                style={[styles.drawerItem, pathname === '/provider-dashboard' && styles.drawerItemActive]} 
                onPress={() => router.push('/provider-dashboard')}
              >
                <Text style={[styles.drawerItemText, pathname === '/provider-dashboard' && styles.drawerItemTextActive, {color: '#06b6d4'}]}>
                  SERVICE DASH
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}
        {/* ADMIN ROUTE */}
        {user?.username === 'admin' && (
          <TouchableOpacity 
            style={[styles.drawerItem, pathname === '/admin' && styles.drawerItemActive]} 
            onPress={() => router.push('/admin')}
          >
            <Text style={[styles.drawerItemText, pathname === '/admin' && styles.drawerItemTextActive]}>
              ADMIN CONSOLE
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* DYNAMIC BOTTOM ACTION BUTTON */}
      {user ? (
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>[→ DISCONNECT</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={() => router.push('/login')} style={styles.loginButton}>
          <Text style={styles.loginText}>[→ LOGIN / REGISTER</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

export default function RootLayout() {
  return (
    <CartProvider>
      <StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Drawer 
            drawerContent={() => <CustomDrawerContent />}
            screenOptions={{
              headerShown: false,
              drawerStyle: { backgroundColor: '#0f172a', width: '80%' },
            }}
          >
            <Drawer.Screen name="index" />
            <Drawer.Screen name="explore" />
            <Drawer.Screen name="feed" />
            
            {/* ROUTES MANAGED BY CUSTOM DRAWER UI */}
            <Drawer.Screen name="services" options={{ drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="vendor" options={{ drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="provider-dashboard" options={{ drawerItemStyle: { display: 'none' } }} />
            
            <Drawer.Screen name="inbox" options={{ drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="wallet" options={{ drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="admin" options={{ drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="login" options={{ drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="profile/[username]" options={{ drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="search" options={{ drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="cart" options={{ drawerItemStyle: { display: 'none' } }} />
            <Drawer.Screen name="chat/[username]" options={{ drawerItemStyle: { display: 'none' } }} />
          </Drawer>
          <CartModal />
        </GestureHandlerRootView>
      </StripeProvider>
    </CartProvider>
  );
}

const styles = StyleSheet.create({
  drawerHeader: { flexDirection: 'row', padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1e293b', marginBottom: 20, marginTop: 10 },
  avatarPlaceholder: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#1e293b', borderWidth: 2, borderColor: '#f97316', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#f97316', fontWeight: 'bold' },
  profileTextContainer: { marginLeft: 15 },
  username: { color: 'white', fontWeight: 'bold', fontSize: 16, letterSpacing: 1 },
  balance: { color: '#f97316', fontWeight: 'bold', fontSize: 14 },
  routeList: { flex: 1, paddingHorizontal: 15 },
  drawerItem: { paddingVertical: 15, paddingHorizontal: 20, borderRadius: 10, marginBottom: 5 },
  drawerItemActive: { backgroundColor: '#1e293b', borderLeftWidth: 3, borderLeftColor: '#f97316' },
  drawerItemText: { color: '#94a3b8', fontWeight: 'bold', fontSize: 13, letterSpacing: 1 },
  drawerItemTextActive: { color: 'white' },
  logoutButton: { padding: 25, borderTopWidth: 1, borderTopColor: '#1e293b' },
  logoutText: { color: '#94a3b8', fontWeight: 'bold', fontSize: 12, letterSpacing: 1 },
  loginButton: { padding: 25, borderTopWidth: 1, borderTopColor: '#1e293b', backgroundColor: '#f97316' },
  loginText: { color: '#000', fontWeight: '900', fontSize: 12, letterSpacing: 1 }
});
