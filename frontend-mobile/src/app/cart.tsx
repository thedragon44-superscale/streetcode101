import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, FlatList, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '../context/CartContext';
import * as SecureStore from 'expo-secure-store';

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { cart, removeFromCart, updateQuantity, cartTotal, clearCart } = useCart();
  const [currentUserToken, setCurrentUserToken] = React.useState<string | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      const verifyCartOwner = async () => {
        const token = await SecureStore.getItemAsync('pidrop_token');
        // If the token changed since the last time the cart was opened, wipe it
        if (currentUserToken !== null && currentUserToken !== token) {
          if (clearCart) clearCart();
        }
        setCurrentUserToken(token);
      };
      verifyCartOwner();
    }, [currentUserToken])
  );

  const renderCartItem = ({ item }: { item: any }) => {
    const quantity = item.cart_quantity || 1;
    const priceStr = parseFloat(item.price || '0').toFixed(2);

    return (
      <View style={styles.cartItem}>
        <Image 
          source={{ uri: item.image_url || 'https://streetcode101.com/favicon.ico' }} 
          style={styles.itemImage} 
        />
        
        <View style={styles.itemDetails}>
          <Text style={styles.itemTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.itemPrice}>${priceStr}</Text>
          
          <View style={styles.quantityControls}>
            <TouchableOpacity 
              style={styles.quantityBtn} 
              onPress={() => updateQuantity(item.sku, quantity - 1)}
            >
              <Text style={styles.quantityBtnText}>-</Text>
            </TouchableOpacity>
            
            <Text style={styles.quantityText}>{quantity}</Text>
            
            <TouchableOpacity 
              style={styles.quantityBtn} 
              onPress={() => updateQuantity(item.sku, quantity + 1)}
            >
              <Text style={styles.quantityBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.deleteButton} 
          onPress={() => removeFromCart(item.sku)}
        >
          <Ionicons name="close" size={20} color="#94a3b8" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 20) }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#f97316" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>YOUR <Text style={styles.headerTitleHighlight}>CART</Text></Text>
        <View style={{ width: 24 }} />
      </View>

      {cart.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cart-outline" size={64} color="#334155" style={styles.ghostIcon} />
          <Text style={styles.emptyText}>NO ITEMS IN VAULT.</Text>
          <TouchableOpacity 
            style={styles.returnButton} 
            onPress={() => router.push('/')}
          >
            <Text style={styles.returnButtonText}>BROWSE DROPS</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <FlatList
            data={cart}
            keyExtractor={(item, index) => item.sku || index.toString()}
            renderItem={renderCartItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TOTAL:</Text>
              <Text style={styles.totalAmount}>${(cartTotal || 0).toFixed(2)}</Text>
            </View>

            <TouchableOpacity 
              style={styles.checkoutButton}
              onPress={() => router.push('/checkout')}
            >
              <Ionicons name="lock-closed" size={16} color="#000" />
              <Text style={styles.checkoutButtonText}>SECURE CHECKOUT</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 15, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  backButton: { padding: 5 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: 'white', letterSpacing: 2 },
  headerTitleHighlight: { color: '#f97316' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  ghostIcon: { marginBottom: 20 },
  emptyText: { color: '#64748b', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 14, marginBottom: 30, letterSpacing: 1 },
  returnButton: { backgroundColor: '#1e293b', paddingVertical: 12, paddingHorizontal: 25, borderRadius: 8, borderWidth: 1, borderColor: '#334155' },
  returnButtonText: { color: '#f97316', fontWeight: 'bold', fontSize: 12, letterSpacing: 1 },
  listContent: { padding: 15, gap: 15 },
  cartItem: { flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#334155', position: 'relative' },
  itemImage: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#0f172a' },
  itemDetails: { flex: 1, marginLeft: 15, justifyContent: 'space-between', paddingRight: 30 },
  itemTitle: { color: '#e2e8f0', fontWeight: 'bold', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  itemPrice: { color: '#60a5fa', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: 'bold', fontSize: 14, marginTop: 5 },
  quantityControls: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 6, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#334155', marginTop: 10 },
  quantityBtn: { paddingHorizontal: 12, paddingVertical: 4 },
  quantityBtnText: { color: '#94a3b8', fontSize: 16, fontWeight: 'bold' },
  quantityText: { color: 'white', fontSize: 12, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', paddingHorizontal: 5 },
  deleteButton: { position: 'absolute', top: 10, right: 10, padding: 5, backgroundColor: '#0f172a', borderRadius: 6 },
  footer: { backgroundColor: '#0f172a', borderTopWidth: 1, borderTopColor: '#1e293b', padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 20 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  totalLabel: { color: 'white', fontWeight: '900', fontSize: 14, letterSpacing: 2 },
  totalAmount: { color: '#f97316', fontSize: 24, fontWeight: '900', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  checkoutButton: { backgroundColor: '#f97316', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 12, gap: 8 },
  checkoutButtonText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 1 }
});
