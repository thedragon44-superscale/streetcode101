import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, TextInput, ActivityIndicator, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';

const API_BASE = "https://streetcode101.com/api";

export default function InboxScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      fetchInbox();
    }, [])
  );

  const fetchInbox = async () => {
    try {
      const token = await SecureStore.getItemAsync('pidrop_token');
      if (!token) {
        setError('Please sign in to view your inbox.');
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE}/inbox`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load inbox');
      
      const data = await res.json();
      setConversations(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      fetch(`${API_BASE}/search?q=${encodeURIComponent(searchQuery)}`)
        .then(res => res.ok ? res.json() : { users: [] })
        .then(data => setSearchResults(data.users || []))
        .catch(err => console.error("Search failed:", err));
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  return (
    <View style={styles.container}>
      <Header />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleContainer}>
          <Text style={styles.pageTitle}>INBOX</Text>
          <Text style={styles.pageSubtitle}>Direct messages and vendor support.</Text>
        </View>

        {/* User Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users to message..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
        </View>

        {/* Search Results Dropdown */}
        {searchQuery.trim().length > 0 && (
          <View style={styles.searchResultsBox}>
            {searchResults.length > 0 ? (
              searchResults.map(user => (
                <TouchableOpacity 
                  key={user.username}
                  style={styles.searchResultItem}
                  onPress={() => router.push(`/chat/${user.username}`)}
                >
                  <Image source={{ uri: user.profile_image_url || 'https://streetcode101.com/favicon.ico' }} style={styles.searchAvatar} />
                  <Text style={styles.searchText}>@{user.username}</Text>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={styles.noResultsText}>No users found.</Text>
            )}
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {loading ? (
          <ActivityIndicator size="large" color="#f97316" style={{ marginTop: 50 }} />
        ) : !error && conversations.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="mail-open-outline" size={64} color="#334155" />
            <Text style={styles.emptyTitle}>Your inbox is empty.</Text>
            <Text style={styles.emptySubtitle}>When you message vendors or support, conversations will appear here.</Text>
          </View>
        ) : (
          <View style={styles.conversationList}>
            {conversations.map((conv, idx) => (
              <TouchableOpacity 
                key={`${conv.contact}-${idx}`}
                style={styles.convCard}
                onPress={() => router.push(`/chat/${conv.contact}`)}
              >
                <View style={styles.avatarPlaceholder}>
                  {conv.contact === 'admin' ? (
                    <Ionicons name="headset" size={20} color="#94a3b8" />
                  ) : (
                    <Text style={styles.avatarInitial}>{conv.contact.charAt(0).toUpperCase()}</Text>
                  )}
                </View>
                
                <View style={styles.convDetails}>
                  <View style={styles.convHeader}>
                    <Text style={styles.convName} numberOfLines={1}>
                      {conv.contact === 'admin' ? 'Street Code 101 Support' : `@${conv.contact}`}
                    </Text>
                    <Text style={styles.convDate}>
                      {new Date(conv.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </Text>
                  </View>
                  <Text style={styles.convMessage} numberOfLines={1}>
                    {conv.is_sender ? <Text style={styles.youPrefix}>You: </Text> : null}
                    {conv.last_message}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 15, paddingBottom: 40 },
  titleContainer: { marginBottom: 20 },
  pageTitle: { fontSize: 28, fontWeight: '900', color: 'white', letterSpacing: 1 },
  pageSubtitle: { fontSize: 13, color: '#94a3b8', fontWeight: '500', marginTop: 4 },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 15, height: 45, marginBottom: 20, zIndex: 10 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, color: 'white', fontSize: 14, fontWeight: '500' },
  searchResultsBox: { backgroundColor: '#1e293b', borderRadius: 12, borderWidth: 1, borderColor: '#334155', marginTop: -10, marginBottom: 20, overflow: 'hidden' },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#0f172a' },
  searchAvatar: { width: 32, height: 32, borderRadius: 16, marginRight: 12, backgroundColor: '#0f172a' },
  searchText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  noResultsText: { color: '#64748b', textAlign: 'center', padding: 15, fontWeight: '500' },
  errorBox: { backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', marginBottom: 20 },
  errorText: { color: '#ef4444', fontWeight: 'bold', textAlign: 'center' },
  emptyState: { alignItems: 'center', backgroundColor: '#1e293b', padding: 40, borderRadius: 20, borderWidth: 1, borderColor: '#334155', marginTop: 20 },
  emptyTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginTop: 15, marginBottom: 5 },
  emptySubtitle: { color: '#64748b', textAlign: 'center', fontSize: 13, lineHeight: 20 },
  conversationList: { gap: 10 },
  convCard: { flexDirection: 'row', backgroundColor: '#1e293b', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#334155', alignItems: 'center' },
  avatarPlaceholder: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#475569', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  avatarInitial: { color: '#94a3b8', fontSize: 18, fontWeight: '900' },
  convDetails: { flex: 1 },
  convHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 },
  convName: { color: 'white', fontWeight: 'bold', fontSize: 15, flex: 1, marginRight: 10 },
  convDate: { color: '#64748b', fontSize: 11, fontWeight: 'bold' },
  convMessage: { color: '#94a3b8', fontSize: 13, fontWeight: '500' },
  youPrefix: { color: '#64748b' }
});
