import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const API_BASE = "https://streetcode101.com/api";

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { q } = useLocalSearchParams(); 

  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState({ products: [], users: [] });

  useEffect(() => {
    if (q) {
      fetchSearchResults(q as string);
    } else {
      setLoading(false);
    }
  }, [q]);

  const fetchSearchResults = async (query: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data || { products: [], users: [] });
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const hasNoResults = results.products.length === 0 && results.users.length === 0;

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#f97316" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          SEARCH: <Text style={styles.queryText}>"{q}"</Text>
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#f97316" />
          <Text style={styles.loadingText}>SCANNING VAULT...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
          {hasNoResults ? (
            <View style={styles.centerContainer}>
              <Ionicons name="search-outline" size={64} color="#334155" style={{ marginBottom: 20 }} />
              <Text style={styles.emptyText}>NO RESULTS FOUND</Text>
            </View>
          ) : (
            <>
              {results.users.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>COMMUNITY MEMBERS</Text>
                  {results.users.map((user: any) => (
                    <TouchableOpacity 
                      key={user.username} 
                      style={styles.resultCard}
                      onPress={() => router.push(`/profile/${user.username}`)}
                    >
                      <Image 
                        source={{ uri: user.profile_image_url || 'https://streetcode101.com/favicon.ico' }} 
                        style={styles.userAvatar} 
                      />
                      <Text style={styles.usernameText}>@{user.username}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {results.products.length > 0 && (
                <View style={styles.section}>
                  <Text style={[styles.sectionTitle, { color: '#f97316' }]}>VAULT DROPS</Text>
                  {results.products.map((product: any) => (
                    <TouchableOpacity 
                      key={product.sku} 
                      style={styles.resultCard}
                      onPress={() => router.push(`/product/${product.sku}`)}
                    >
                      <Image 
                        source={{ uri: product.image_url || 'https://streetcode101.com/favicon.ico' }} 
                        style={styles.productImage} 
                        resizeMode="cover"
                      />
                      <View style={styles.productDetails}>
                        <Text style={styles.productTitle} numberOfLines={2}>{product.title}</Text>
                        <Text style={styles.productPrice}>${parseFloat(product.price || '0').toFixed(2)}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 14, fontWeight: '900', color: '#64748b', letterSpacing: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  queryText: { color: 'white' },
  scrollContainer: { flex: 1 },
  scrollContent: { padding: 15, paddingBottom: 40 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  loadingText: { color: '#f97316', marginTop: 15, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 2 },
  emptyText: { color: '#64748b', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: 'bold', letterSpacing: 1 },
  section: { marginBottom: 30 },
  sectionTitle: { fontSize: 10, fontWeight: '900', color: '#06b6d4', letterSpacing: 2, marginBottom: 15, paddingLeft: 5 },
  resultCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#334155' },
  userAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#475569' },
  usernameText: { color: 'white', fontWeight: 'bold', fontSize: 14, marginLeft: 15 },
  productImage: { width: 50, height: 50, borderRadius: 8, backgroundColor: '#0f172a' },
  productDetails: { flex: 1, marginLeft: 15, justifyContent: 'center' },
  productTitle: { color: '#e2e8f0', fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' },
  productPrice: { color: '#60a5fa', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: 'bold', fontSize: 12, marginTop: 4 }
});
