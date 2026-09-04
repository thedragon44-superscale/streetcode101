import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  Image, Modal, TextInput, Alert 
} from 'react-native';
import { useCart } from '../context/CartContext';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CartModal() {
  const { cart, removeFromCart, updateQuantity, isCartOpen, setIsCartOpen, cartTotal } = useCart();
  
  // Local state for the Promo Input field mimicking your web logic
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<{code: string, discount_percent: number} | null>(null);

  // Hardcoded vault discount for now (can pull from Auth Context later)
  const vaultDiscount = 0; 
  const activePromoDiscount = appliedPromo ? appliedPromo.discount_percent : 0;
  const totalDiscountPercent = vaultDiscount + activePromoDiscount;
  const discountMultiplier = 1 - (totalDiscountPercent / 100);
  const finalTotal = cartTotal * discountMultiplier;

  const handleApplyPromo = () => {
    if (promoInput.toUpperCase() === 'MIDNIGHT20') {
      setAppliedPromo({ code: 'MIDNIGHT20', discount_percent: 20 });
      setPromoInput('');
    } else {
      Alert.alert("Invalid Code", "That promo code does not exist.");
    }
  };

  return (
    <Modal visible={isCartOpen} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <SafeAreaView style={styles.cartContainer}>
          
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>YOUR <Text style={styles.headerTitleOrange}>CART</Text></Text>
            <TouchableOpacity onPress={() => setIsCartOpen(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Cart Items List */}
          <ScrollView style={styles.cartList}>
            {cart.length === 0 ? (
              <Text style={styles.emptyText}>NO ITEMS IN VAULT.</Text>
            ) : (
              cart.map((item) => (
                <View key={item.sku} style={styles.cartItem}>
                  <Image source={{ uri: item.image_url || 'https://streetcode101.com/favicon.ico' }} style={styles.itemImage} />
                  
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemTitle} numberOfLines={2}>{item.title?.toUpperCase()}</Text>
                    <Text style={styles.itemPrice}>${Number(item.price).toFixed(2)}</Text>
                    
                    {/* Quantity Controls */}
                    <View style={styles.quantityBox}>
                      <TouchableOpacity onPress={() => updateQuantity(item.sku, (item.cart_quantity || 1) - 1)} style={styles.qtyBtn}>
                        <Text style={styles.qtyBtnText}>-</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyText}>{item.cart_quantity || 1}</Text>
                      <TouchableOpacity onPress={() => updateQuantity(item.sku, (item.cart_quantity || 1) + 1)} style={styles.qtyBtn}>
                        <Text style={styles.qtyBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity onPress={() => removeFromCart(item.sku)} style={styles.removeBtn}>
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>

          {/* Footer / Checkout Section */}
          {cart.length > 0 && (
            <View style={styles.footer}>
              <View style={styles.subtotalRow}>
                <Text style={styles.summaryText}>SUBTOTAL:</Text>
                <Text style={styles.summaryText}>${cartTotal.toFixed(2)}</Text>
              </View>

              {/* Promo Input */}
              {!appliedPromo ? (
                <View style={styles.promoRow}>
                  <TextInput 
                    style={styles.promoInput} 
                    placeholder="PROMO CODE" 
                    placeholderTextColor="#475569"
                    value={promoInput}
                    onChangeText={setPromoInput}
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity onPress={handleApplyPromo} style={styles.applyBtn}>
                    <Text style={styles.applyBtnText}>APPLY</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.activePromoBox}>
                  <Text style={styles.activePromoText}>[{appliedPromo.code}]</Text>
                  <Text style={styles.activePromoText}>-{appliedPromo.discount_percent}%</Text>
                  <TouchableOpacity onPress={() => setAppliedPromo(null)}><Text style={styles.removePromoText}>✕</Text></TouchableOpacity>
                </View>
              )}

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>TOTAL:</Text>
                <Text style={styles.totalAmount}>${finalTotal.toFixed(2)}</Text>
              </View>

              <TouchableOpacity style={styles.checkoutBtn}>
                <Text style={styles.checkoutBtnText}>PROCEED TO SECURE CHECKOUT</Text>
              </TouchableOpacity>
            </View>
          )}

        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  cartContainer: { backgroundColor: '#020617', height: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
  headerTitleOrange: { color: '#f97316' },
  closeBtn: { padding: 5 },
  closeBtnText: { color: '#94a3b8', fontSize: 20, fontWeight: 'bold' },

  cartList: { flex: 1, padding: 20 },
  emptyText: { color: '#475569', textAlign: 'center', marginTop: 50, fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  
  cartItem: { flexDirection: 'row', backgroundColor: '#0f172a', borderRadius: 12, padding: 10, marginBottom: 15, borderWidth: 1, borderColor: '#1e293b' },
  itemImage: { width: 80, height: 80, borderRadius: 8, backgroundColor: '#020617' },
  itemDetails: { flex: 1, paddingLeft: 15, justifyContent: 'space-between' },
  itemTitle: { color: 'white', fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5 },
  itemPrice: { color: '#60a5fa', fontWeight: 'bold', fontSize: 14, marginTop: 5 },
  
  quantityBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#020617', alignSelf: 'flex-start', borderRadius: 6, borderWidth: 1, borderColor: '#1e293b', marginTop: 5 },
  qtyBtn: { paddingHorizontal: 12, paddingVertical: 4 },
  qtyBtnText: { color: '#94a3b8', fontWeight: 'bold', fontSize: 16 },
  qtyText: { color: 'white', fontSize: 12, fontWeight: 'bold', paddingHorizontal: 5 },
  
  removeBtn: { position: 'absolute', top: 5, right: 5, padding: 5 },
  removeBtnText: { color: '#64748b', fontSize: 12 },

  footer: { padding: 20, backgroundColor: '#0f172a', borderTopWidth: 1, borderTopColor: '#1e293b' },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  summaryText: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },
  
  promoRow: { flexDirection: 'row', gap: 10, marginBottom: 15 },
  promoInput: { flex: 1, backgroundColor: '#020617', borderWidth: 1, borderColor: '#1e293b', borderRadius: 8, paddingHorizontal: 15, color: 'white', fontSize: 12, fontWeight: 'bold' },
  applyBtn: { backgroundColor: '#1e293b', paddingHorizontal: 20, justifyContent: 'center', borderRadius: 8 },
  applyBtnText: { color: '#cbd5e1', fontWeight: 'bold', fontSize: 12 },
  
  activePromoBox: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(249, 115, 22, 0.1)', borderWidth: 1, borderColor: 'rgba(249, 115, 22, 0.3)', padding: 10, borderRadius: 8, marginBottom: 15 },
  activePromoText: { color: '#f97316', fontWeight: 'bold', fontSize: 12 },
  removePromoText: { color: '#f97316', paddingLeft: 10 },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderTopWidth: 1, borderTopColor: '#1e293b', paddingTop: 15 },
  totalLabel: { color: 'white', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  totalAmount: { color: '#f97316', fontSize: 24, fontWeight: '900' },

  checkoutBtn: { backgroundColor: '#f97316', paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  checkoutBtnText: { color: '#000', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
});
