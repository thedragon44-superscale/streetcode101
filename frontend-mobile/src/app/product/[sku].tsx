import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCart } from '../../context/CartContext';
import { SafeAreaView } from 'react-native-safe-area-context';

const API_BASE = "https://streetcode101.com/api";
const { width } = Dimensions.get('window');

export default function ProductDetailScreen() {
  const { sku } = useLocalSearchParams<{ sku: string }>();
  const router = useRouter();
  const { addToCart } = useCart();

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Variant States replicating web logic
  const [selectedColor, setSelectedColor] = useState('Default');
  const [selectedSize, setSelectedSize] = useState('OS');
  const [currentVariant, setCurrentVariant] = useState<any>(null);

  useEffect(() => {
    fetchProduct();
  }, [sku]);

  const fetchProduct = async () => {
    try {
      const res = await fetch(`${API_BASE}/products/${sku}`);
      if (!res.ok) throw new Error('Product not found');
      const data = await res.json();
      
      setProduct(data);
      
      if (data.variants && data.variants.length > 0) {
        const initial = data.variants[0];
        setSelectedColor(initial.color);
        setSelectedSize(initial.size);
        setCurrentVariant(initial);
      }
    } catch (err) {
      Alert.alert("Error", "Product could not be loaded.");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (product?.variants?.length > 0) {
      const matched = product.variants.find((v: any) => v.color === selectedColor && v.size === selectedSize);
      if (matched) setCurrentVariant(matched);
    }
  }, [selectedColor, selectedSize, product]);

  const handleAddToCart = () => {
    const itemToCart = currentVariant ? {
      ...product,
      sku: currentVariant.variant_sku,
      price: currentVariant.price,
      image_url: currentVariant.image_url,
      title: selectedColor !== 'Default' ? `${product.title} (${selectedColor} / ${selectedSize})` : product.title
    } : product;
    
    addToCart(itemToCart);
  };

  if (loading || !product) {
    return (
      <View style={styles.centerElements}>
        <ActivityIndicator size="large" color="#f97316" />
      </View>
    );
  }

  const hasVariants = product?.variants?.length > 0;
  const availableColors = hasVariants ? [...new Set(product.variants.map((v: any) => v.color))] : [];
  const availableSizes = hasVariants ? [...new Set(product.variants.filter((v: any) => v.color === selectedColor).map((v: any) => v.size))] : [];
  
  const displayPrice = currentVariant ? currentVariant.price : product?.price || 0;
  const displayImage = currentVariant ? currentVariant.image_url : product?.image_url;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      
      {/* Header Back Button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← BACK</Text>
        </TouchableOpacity>
        <Text style={styles.headerSku} numberOfLines={1}>{product.title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Main Image Viewer */}
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: displayImage || 'https://streetcode101.com/favicon.ico' }} 
            style={styles.mainImage}
            resizeMode="contain"
          />
        </View>

        {/* Product Info Box */}
        <View style={styles.detailsContainer}>
          <Text style={styles.title}>{product.title}</Text>
          <View style={styles.authBadge}>
            <Text style={styles.authBadgeText}>🛡️ STREET CODE 101 AUTHENTICATED DROP</Text>
          </View>

          <Text style={styles.price}>${Number(displayPrice).toFixed(2)}</Text>

          {/* Variant Selectors */}
          {hasVariants && (product.variants.length > 1 || availableColors[0] !== 'Default') && (
            <View style={styles.variantsBox}>
              
              {/* Color Picker */}
              {(availableColors.length > 1 || availableColors[0] !== 'Default') && (
                <View style={styles.selectorGroup}>
                  <Text style={styles.selectorLabel}>COLOR: <Text style={styles.selectorLabelHighlight}>{selectedColor}</Text></Text>
                  <View style={styles.pillContainer}>
                    {availableColors.map((color: any) => (
                      <TouchableOpacity 
                        key={color}
                        onPress={() => {
                          setSelectedColor(color);
                          const sizesForColor = product.variants.filter((v: any) => v.color === color).map((v: any) => v.size);
                          if (sizesForColor.length > 0 && !sizesForColor.includes(selectedSize)) {
                            setSelectedSize(sizesForColor[0]);
                          }
                        }}
                        style={[styles.pillBtn, selectedColor === color && styles.pillBtnActive]}
                      >
                        <Text style={[styles.pillBtnText, selectedColor === color && styles.pillBtnTextActive]}>{color}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Size Picker */}
              {(availableSizes.length > 1 || availableSizes[0] !== 'OS') && (
                <View style={styles.selectorGroup}>
                  <Text style={styles.selectorLabel}>SIZE: <Text style={styles.selectorLabelHighlight}>{selectedSize}</Text></Text>
                  <View style={styles.pillContainer}>
                    {availableSizes.map((size: any) => (
                      <TouchableOpacity 
                        key={size}
                        onPress={() => setSelectedSize(size)}
                        style={[styles.pillBtn, selectedSize === size && styles.pillBtnActive]}
                      >
                        <Text style={[styles.pillBtnText, selectedSize === size && styles.pillBtnTextActive]}>{size}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Description */}
          <View style={styles.descriptionBox}>
            <Text style={styles.descTitle}>ABOUT THIS DROP</Text>
            <Text style={styles.descText}>{product.description}</Text>
            <Text style={styles.descList}>• Premium materials sourced for peak streetwear performance.</Text>
            <Text style={styles.descList}>• Backed by the Street Code 101 authenticity guarantee.</Text>
            <Text style={styles.descSku}>SKU: {product.sku}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky Buy Button Footer */}
      <View style={styles.stickyFooter}>
        {product.in_stock ? (
          <Text style={styles.stockStatusGreen}>🟢 IN STOCK</Text>
        ) : (
          <Text style={styles.stockStatusRed}>🔴 OUT OF STOCK</Text>
        )}
        
        <TouchableOpacity 
          style={[styles.buyBtn, !product.in_stock && styles.buyBtnDisabled]}
          disabled={!product.in_stock}
          onPress={handleAddToCart}
        >
          <Text style={styles.buyBtnText}>{product.in_stock ? 'ADD TO CART' : 'UNAVAILABLE'}</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  centerElements: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' },
  scrollContent: { paddingBottom: 120 },
  
  header: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  backBtn: { backgroundColor: '#f1f5f9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginRight: 15 },
  backBtnText: { fontWeight: '900', fontSize: 10, letterSpacing: 1, color: '#0f172a' },
  headerSku: { flex: 1, fontSize: 12, fontWeight: 'bold', color: '#64748b' },

  imageContainer: { width: '100%', height: width, backgroundColor: '#f8fafc', padding: 20 },
  mainImage: { width: '100%', height: '100%' },

  detailsContainer: { padding: 20 },
  title: { fontSize: 24, fontWeight: '900', color: '#0f172a', marginBottom: 10, lineHeight: 30 },
  
  authBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 20 },
  authBadgeText: { fontSize: 10, fontWeight: '900', color: '#475569', letterSpacing: 1 },
  
  price: { fontSize: 40, fontWeight: '900', color: '#0f172a', marginBottom: 25 },

  variantsBox: { marginBottom: 25 },
  selectorGroup: { marginBottom: 20 },
  selectorLabel: { fontSize: 12, fontWeight: '900', color: '#0f172a', letterSpacing: 1, marginBottom: 10 },
  selectorLabelHighlight: { color: '#f97316' },
  pillContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  pillBtn: { borderWidth: 2, borderColor: '#e2e8f0', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, backgroundColor: 'white' },
  pillBtnActive: { borderColor: '#f97316', backgroundColor: '#fff7ed' },
  pillBtnText: { fontSize: 14, fontWeight: 'bold', color: '#64748b' },
  pillBtnTextActive: { color: '#ea580c' },

  descriptionBox: { backgroundColor: '#f8fafc', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#f1f5f9' },
  descTitle: { fontSize: 12, fontWeight: '900', color: '#0f172a', letterSpacing: 1, marginBottom: 10 },
  descText: { fontSize: 14, color: '#475569', lineHeight: 22, marginBottom: 15 },
  descList: { fontSize: 14, color: '#475569', lineHeight: 22, marginBottom: 5, fontWeight: '500' },
  descSku: { fontSize: 10, color: '#94a3b8', fontFamily: 'monospace', marginTop: 15, fontWeight: 'bold' },

  stickyFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', padding: 20, borderTopWidth: 1, borderTopColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 10 },
  stockStatusGreen: { fontSize: 12, fontWeight: '900', color: '#059669', letterSpacing: 1 },
  stockStatusRed: { fontSize: 12, fontWeight: '900', color: '#dc2626', letterSpacing: 1 },
  
  buyBtn: { backgroundColor: '#0f172a', paddingHorizontal: 30, paddingVertical: 15, borderRadius: 12 },
  buyBtnDisabled: { backgroundColor: '#cbd5e1' },
  buyBtnText: { color: 'white', fontWeight: '900', fontSize: 14, letterSpacing: 1 }
});
