import React, { useState, useEffect } from 'react';
import { 
  View, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  StyleSheet, 
  Platform, 
  Text, 
  ScrollView, 
  Keyboard 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useNavigation } from 'expo-router';
import { useCart } from '../context/CartContext';

const API_BASE = "https://streetcode101.com/api";

export default function Header() {
  const [searchQuery, setSearchQuery] = useState('');
  const [globalResults, setGlobalResults] = useState({ products: [], users: [] });
  const [showDropdown, setShowDropdown] = useState(false);
  
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  
  const { cart } = useCart();
  const cartItemCount = cart?.length || 0;

  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      setShowDropdown(true);
      const delayFn = setTimeout(() => {
        fetch(`${API_BASE}/search?q=${encodeURIComponent(searchQuery)}`)
          .then(res => res.ok ? res.json() : { products: [], users: [] })
          .then(data => setGlobalResults(data || { products: [], users: [] }))
          .catch(err => console.error("Autocomplete failed:", err));
      }, 300);

      return () => clearTimeout(delayFn);
    } else {
      setShowDropdown(false);
      setGlobalResults({ products: [], users: [] });
    }
  }, [searchQuery]);

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      setShowDropdown(false);
      Keyboard.dismiss();
      router.push({ pathname: '/search', params: { q: searchQuery } });
    }
  };

  const handleResultTap = (path: string) => {
    setShowDropdown(false);
    setSearchQuery('');
    Keyboard.dismiss();
    router.push(path as any);
  };

  const hasNoResults = globalResults.products.length === 0 && globalResults.users.length === 0;

  return (
    <View style={[
      styles.headerContainer, 
      { paddingTop: Math.max(insets.top, 20) + 15 } // Increased top spacing
    ]}>
      
      {/* LEFT: Notifications & Cart (Swapped to balance the right menu) */}
      <View style={styles.leftSection}>
        <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/notifications')}>
          <Ionicons name="notifications" size={26} color="#f59e0b" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/cart')}>
          <View>
            <Ionicons name="cart" size={28} color="#94a3b8" />
            {cartItemCount > 0 && (
              <View style={styles.badgeContainer}>
                <Text style={styles.badgeText}>{cartItemCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* MIDDLE: Interactive Search Bar (Taller) */}
      <View style={styles.searchSection}>
        <TextInput
          style={styles.searchInput}
          placeholder="SEARCH VAULT..."
          placeholderTextColor="#64748b"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={handleSearchSubmit}
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearchSubmit}>
          <Ionicons name="search" size={18} color="#f97316" />
        </TouchableOpacity>
      </View>

      {/* RIGHT: Hamburger Menu & Logo Bundled */}
      <TouchableOpacity 
        style={styles.menuBundle} 
        onPress={() => (navigation as any).openDrawer()}
      >
        <Ionicons name="menu" size={30} color="#94a3b8" />
        <View style={styles.logoWrapper}>
          <Image 
            source={require('../../assets/images/streetbook_logo.png')} 
            style={styles.logoImage}
            resizeMode="cover"
          />
        </View>
      </TouchableOpacity>

      {/* ABSOLUTE DROPDOWN: Autocomplete Results */}
      {showDropdown && (
        <View style={[styles.dropdownContainer, { top: Math.max(insets.top, 20) + 75 }]}>
          <ScrollView 
            keyboardShouldPersistTaps="always" 
            style={styles.dropdownScroll}
          >
            {hasNoResults && searchQuery.length > 1 ? (
              <Text style={styles.noResultsText}>NO RESULTS FOUND</Text>
            ) : (
              <>
                {globalResults.users.length > 0 && (
                  <View style={styles.resultGroup}>
                    <Text style={styles.groupTitle}>COMMUNITY MEMBERS</Text>
                    {globalResults.users.slice(0, 4).map((user: any) => (
                      <TouchableOpacity 
                        key={user.username} 
                        style={styles.resultItem}
                        onPress={() => handleResultTap(`/profile/${user.username}`)}
                      >
                        <Image 
                          source={{ uri: user.profile_image_url || 'https://streetcode101.com/favicon.ico' }} 
                          style={styles.resultAvatar} 
                        />
                        <Text style={styles.resultText}>@{user.username}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {globalResults.products.length > 0 && (
                  <View style={[styles.resultGroup, globalResults.users.length > 0 && styles.groupBorderTop]}>
                    <Text style={[styles.groupTitle, { color: '#f97316' }]}>VAULT DROPS</Text>
                    {globalResults.products.slice(0, 6).map((product: any) => (
                      <TouchableOpacity 
                        key={product.sku} 
                        style={styles.resultItem}
                        onPress={() => handleResultTap(`/product/${product.sku}`)}
                      >
                        <Image 
                          source={{ uri: product.image_url || 'https://streetcode101.com/favicon.ico' }} 
                          style={styles.resultImage} 
                        />
                        <View style={styles.resultDetails}>
                          <Text style={styles.resultText} numberOfLines={1}>{product.title}</Text>
                          <Text style={styles.resultPrice}>${parseFloat(product.price || '0').toFixed(2)}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    paddingHorizontal: 15,
    paddingBottom: 20, // Increased for a larger header presence
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    width: '100%',
    zIndex: 9999, 
  },
  
  leftSection: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  iconButton: { padding: 4, position: 'relative' },
  badgeContainer: { position: 'absolute', top: -6, right: -8, backgroundColor: '#ea580c', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 1.5, borderColor: '#0f172a' },
  badgeText: { color: 'white', fontSize: 10, fontWeight: '900' },

  searchSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 15,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    height: 44, // Taller search bar
  },
  searchInput: { flex: 1, color: '#60a5fa', fontSize: 13, fontWeight: 'bold', paddingHorizontal: 14, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  searchButton: { paddingHorizontal: 14, borderLeftWidth: 1, borderLeftColor: '#334155', height: '100%', alignItems: 'center', justifyContent: 'center' },
  
  menuBundle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 2,
  },
  logoWrapper: { 
    width: 42, // Larger logo
    height: 42, 
    backgroundColor: '#1e293b', 
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: '#334155', 
    overflow: 'hidden' 
  },
  logoImage: { width: '100%', height: '100%' },

  /* Autocomplete Dropdown Styles */
  dropdownContainer: {
    position: 'absolute',
    left: 15,
    right: 15,
    backgroundColor: '#020617',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 15,
    overflow: 'hidden',
  },
  dropdownScroll: { flexGrow: 0 },
  noResultsText: { color: '#64748b', textAlign: 'center', padding: 20, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: 'bold', fontSize: 12 },
  resultGroup: { paddingBottom: 5 },
  groupBorderTop: { borderTopWidth: 1, borderTopColor: '#1e293b', marginTop: 5, paddingTop: 5 },
  groupTitle: { color: '#06b6d4', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, paddingHorizontal: 15, paddingVertical: 10, backgroundColor: '#0f172a' },
  resultItem: { flexDirection: 'row', alignItems: 'center', padding: 12, paddingHorizontal: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(30, 41, 59, 0.5)' },
  resultAvatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: '#475569' },
  resultImage: { width: 40, height: 40, borderRadius: 6, backgroundColor: '#0f172a' },
  resultDetails: { flex: 1, marginLeft: 12, justifyContent: 'center' },
  resultText: { color: '#e2e8f0', fontWeight: 'bold', fontSize: 13, textTransform: 'uppercase' },
  resultPrice: { color: '#60a5fa', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: 'bold', fontSize: 11, marginTop: 2 },
});
