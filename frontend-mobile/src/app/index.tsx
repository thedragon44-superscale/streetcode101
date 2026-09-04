import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  ActivityIndicator, 
  Dimensions, 
  Modal,
  RefreshControl
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCart } from '../context/CartContext';
import Header from '../components/Header';

const API_BASE = "https://streetcode101.com/api";
const { width } = Dimensions.get('window');

const CATEGORIES = [
  { id: 'All', label: 'All Drops' },
  { id: 'mens-clothing', label: "Men's Clothing" },
  { id: 'womens-clothing', label: "Women's Clothing" },
  { id: 'mens-shoes', label: "Men's Shoes" },
  { id: 'womens-shoes', label: "Women's Shoes" },
  { id: 'mens-jewelry', label: "Men's Jewelry" },
  { id: 'womens-jewelry', label: "Women's Jewelry" },
  { id: 'accessories', label: 'Accessories' },
  { id: 'electronics', label: 'Electronics' },
  { id: 'uncategorized', label: 'New Arrivals' }
];

export default function StorefrontScreen() {
  const router = useRouter();
  const { addToCart } = useCart();
  
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);

  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isCloseToBottom = ({ layoutMeasurement, contentOffset, contentSize }: any) => {
    const paddingToBottom = 150;
    return layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchProducts();
    setRefreshing(false);
  }, [selectedCategory]);

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory]);

  const fetchProducts = async () => {
    setLoading(true);
    setPage(0);
    try {
      const res = await fetch(`${API_BASE}/products?offset=0&limit=20&category=${selectedCategory}`);
      const data = await res.json();
      const productList = Array.isArray(data) ? data : (data.items || data.products || []);
      
      setProducts(productList);
      setHasMore(productList.length === 20);
    } catch (err) {
      console.error("Failed to fetch live drops:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (isFetchingMore || !hasMore) return;
    setIsFetchingMore(true);
    const nextPage = page + 1;
    
    try {
      const res = await fetch(`${API_BASE}/products?offset=${nextPage * 20}&limit=20&category=${selectedCategory}`);
      const data = await res.json();
      const newProducts = Array.isArray(data) ? data : (data.items || data.products || []);
      
      setProducts(prev => [...prev, ...newProducts]);
      setHasMore(newProducts.length === 20);
      setPage(nextPage);
    } catch (err) {
      console.error("Failed to load more products:", err);
    } finally {
      setIsFetchingMore(false);
    }
  };

  const featuredProduct = selectedCategory === 'All' ? products.find(p => p.is_featured) : null;

  return (
    <View style={styles.mainContainer}>
      
      {/* CUSTOM HEADER PLACED SECURELY INSIDE THE PAGE */}
      <Header />

      <View style={styles.subHeader}>
        <TouchableOpacity 
          style={styles.dropdownToggle} 
          onPress={() => setIsCategoryMenuOpen(true)}
        >
          <Text style={styles.dropdownToggleText}>
            {CATEGORIES.find(c => c.id === selectedCategory)?.label || 'All Drops'}
          </Text>
          <Text style={styles.dropdownIcon}>{isCategoryMenuOpen ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        <Text style={styles.resultText}>
          Showing <Text style={styles.resultCount}>{products.length}</Text> results
        </Text>
      </View>

      <Modal visible={isCategoryMenuOpen} transparent={true} animationType="fade">
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsCategoryMenuOpen(false)}
        >
          <View style={styles.dropdownMenu}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.dropdownItem,
                    selectedCategory === cat.id && styles.dropdownItemActive
                  ]}
                  onPress={() => {
                    setSelectedCategory(cat.id);
                    setIsCategoryMenuOpen(false);
                  }}
                >
                  <Text style={[
                    styles.dropdownItemText,
                    selectedCategory === cat.id && styles.dropdownItemTextActive
                  ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <ScrollView 
        style={styles.scrollContainer} 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f97316" />}
        onScroll={({ nativeEvent }) => {
          if (isCloseToBottom(nativeEvent) && hasMore && !isFetchingMore) {
            loadMore();
          }
        }}
        scrollEventThrottle={400}
      >
        
        {loading ? (
          <View style={styles.centerElements}>
            <ActivityIndicator size="large" color="#f97316" />
          </View>
        ) : (
          <>
            {featuredProduct && (
              <View style={styles.heroCard}>
                <View style={styles.heroMetadataRow}>
                  <View style={styles.heroPill}>
                    <Text style={styles.heroPillText}>[101_LIVE_VAULT]</Text>
                  </View>
                  <Text style={styles.heroCuratedText}>
                    CURATED DROP // <Text style={styles.heroInStockText}>{featuredProduct.in_stock ? 'IN STOCK' : 'LIVE'}</Text>
                  </Text>
                </View>

                <Text style={styles.heroTitle}>{featuredProduct.title?.toUpperCase()}</Text>
                <Text style={styles.heroDescription} numberOfLines={3}>
                  {featuredProduct.description || "EXCLUSIVE VAULT DROP. LIMITED QUANTITIES AVAILABLE."}
                </Text>

                <View style={styles.heroButtonRow}>
                  <TouchableOpacity 
                    style={styles.heroPrimaryButton}
                    onPress={() => router.push(`/product/${featuredProduct.sku}`)}
                  >
                    <Text style={styles.heroPrimaryButtonText}>EXPLORE DROP</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.heroImageWrapper}>
                  <View style={styles.heroFeaturedTag}>
                     <Text style={styles.heroFeaturedTagText}>FEATURED_ITEM</Text>
                  </View>
                  <Image 
                    source={{ uri: featuredProduct.image_url || 'https://streetcode101.com/favicon.ico' }} 
                    style={styles.heroImage}
                    resizeMode="cover"
                  />
                </View>
              </View>
            )}

            <View style={styles.gridContainer}>
              {products.map((product, index) => {
                const priceStr = parseFloat(product.price || '0').toFixed(2);
                const [dollars, cents] = priceStr.split('.');

                return (
                  <View key={product.sku || index} style={styles.gridCard}>
                    
                    <TouchableOpacity 
                      style={styles.gridImageContainer}
                      onPress={() => router.push(`/product/${product.sku}`)}
                    >
                      <Image 
                        source={{ uri: product.image_url || 'https://streetcode101.com/favicon.ico' }} 
                        style={styles.gridImage}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                    
                    <View style={styles.gridDetails}>
                      <TouchableOpacity onPress={() => router.push(`/product/${product.sku}`)}>
                        <Text style={styles.gridTitle} numberOfLines={2}>{product.title}</Text>
                      </TouchableOpacity>
                      
                      <View style={styles.priceContainer}>
                        <Text style={styles.priceSymbol}>$</Text>
                        <Text style={styles.priceDollars}>{dollars}</Text>
                        <Text style={styles.priceCents}>{cents}</Text>
                      </View>
                      
                      <Text style={styles.stockStatus}>
                        {product.in_stock ? '🟢 Authentic Drop' : '🔴 Sold Out'}
                      </Text>
                      
                      <TouchableOpacity 
                        style={[styles.addToCartButton, !product.in_stock && styles.addToCartDisabled]}
                        disabled={!product.in_stock}
                        onPress={() => addToCart(product)}
                      >
                        <Text style={styles.addToCartText}>
                          {product.in_stock ? 'ADD TO CART' : 'OUT OF STOCK'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>

            {hasMore && products.length > 0 && (
              <View style={styles.paginationContainer}>
                {isFetchingMore ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <ActivityIndicator size="small" color="#f97316" />
                    <Text style={styles.loadMoreText}>LOADING NEXT 20...</Text>
                  </View>
                ) : null}
              </View>
            )}

            {!hasMore && products.length > 0 && (
              <Text style={styles.endOfCatalogText}>End of catalog.</Text>
            )}

            {products.length === 0 && !loading && (
              <Text style={styles.emptyText}>No drops found for this category.</Text>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: '#f1f5f9' },
  scrollContainer: { flex: 1 },
  centerElements: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  content: { padding: 15, paddingBottom: 50 },
  
  subHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', zIndex: 50 },
  dropdownToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dropdownToggleText: { fontSize: 14, fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', letterSpacing: 1 },
  dropdownIcon: { fontSize: 10, color: '#64748b' },
  resultText: { color: '#64748b', fontSize: 12, fontWeight: '500' },
  resultCount: { fontWeight: 'bold', color: '#0f172a' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start' },
  dropdownMenu: { backgroundColor: 'white', marginTop: 55, marginHorizontal: 20, borderRadius: 12, maxHeight: '60%', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 15, overflow: 'hidden' },
  dropdownItem: { paddingVertical: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  dropdownItemActive: { backgroundColor: '#fff7ed' },
  dropdownItemText: { fontSize: 14, fontWeight: 'bold', color: '#475569' },
  dropdownItemTextActive: { color: '#ea580c' },
  
  heroCard: { backgroundColor: '#020617', borderRadius: 24, padding: 25, marginBottom: 30, borderWidth: 1, borderColor: '#1e293b' },
  heroMetadataRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, flexWrap: 'wrap', gap: 10 },
  heroPill: { backgroundColor: 'rgba(30, 58, 138, 0.4)', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 99, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.3)' },
  heroPillText: { color: '#60a5fa', fontWeight: 'bold', fontSize: 10, letterSpacing: 1 },
  heroCuratedText: { color: '#64748b', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },
  heroInStockText: { color: '#f97316' },
  heroTitle: { color: 'white', fontSize: 32, fontWeight: '900', letterSpacing: -0.5, marginBottom: 10 },
  heroDescription: { color: '#94a3b8', fontSize: 14, lineHeight: 22, marginBottom: 25 },
  heroButtonRow: { flexDirection: 'row', gap: 10, marginBottom: 25 },
  heroPrimaryButton: { backgroundColor: '#f97316', flex: 1, paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  heroPrimaryButtonText: { color: '#000', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  heroImageWrapper: { width: '100%', height: 250, backgroundColor: '#0f172a', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#1e293b' },
  heroFeaturedTag: { position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(2, 6, 23, 0.8)', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6, zIndex: 10, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.3)' },
  heroFeaturedTagText: { color: '#60a5fa', fontSize: 9, fontWeight: 'bold', letterSpacing: 1 },
  heroImage: { width: '100%', height: '100%' },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridCard: { width: (width - 40) / 2, backgroundColor: 'white', borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 10, overflow: 'hidden' },
  gridImageContainer: { width: '100%', aspectRatio: 1, backgroundColor: '#f8fafc', padding: 10, justifyContent: 'center', alignItems: 'center' },
  gridImage: { width: '100%', height: '100%' },
  gridDetails: { padding: 10, flex: 1, justifyContent: 'space-between' },
  gridTitle: { fontSize: 13, fontWeight: 'bold', color: '#0f172a', marginBottom: 5 },
  priceContainer: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 5 },
  priceSymbol: { fontSize: 10, fontWeight: '600', color: '#0f172a', marginTop: 2 },
  priceDollars: { fontSize: 20, fontWeight: '900', color: '#0f172a' },
  priceCents: { fontSize: 10, fontWeight: '600', color: '#0f172a', marginTop: 2 },
  stockStatus: { fontSize: 9, textTransform: 'uppercase', color: '#94a3b8', fontWeight: 'bold', marginBottom: 15, letterSpacing: 0.5 },
  addToCartButton: { backgroundColor: '#0f172a', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  addToCartDisabled: { backgroundColor: '#e2e8f0' },
  addToCartText: { color: 'white', fontWeight: '900', fontSize: 10, letterSpacing: 1 },
  
  paginationContainer: { paddingVertical: 20, alignItems: 'center' },
  loadMoreButton: { backgroundColor: 'white', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1' },
  loadMoreDisabled: { opacity: 0.5 },
  loadMoreText: { color: '#0f172a', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
  endOfCatalogText: { textAlign: 'center', color: '#94a3b8', marginTop: 20, fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase' },
  emptyText: { textAlign: 'center', color: '#64748b', marginTop: 50 }
});
