import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  TextInput, ActivityIndicator, Alert, Modal, KeyboardAvoidingView, Platform, RefreshControl 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header'; // Assuming you have your header here

const API_BASE = "https://streetcode101.com/api";

export default function ServicesScreen() {
  const router = useRouter();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Booking Modal State
  const [activeBooking, setActiveBooking] = useState<any>(null);
  const [bookingDetails, setBookingDetails] = useState<any>({});
  const [scheduledStart, setScheduledStart] = useState('');
  const [jobAddress, setJobAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await fetchServices();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const res = await fetch(`${API_BASE}/services`);
      if (res.ok) {
        const data = await res.json();
        setServices(data);
      }
    } catch (err) {
      Alert.alert("Error", "Failed to load services.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenBooking = async (service: any) => {
    const token = await SecureStore.getItemAsync('pidrop_token');
    if (!token) {
      Alert.alert("Authentication Required", "You must be logged in to book a service.", [
        { text: "Cancel", style: "cancel" },
        { text: "Log In", onPress: () => router.push('/login') }
      ]);
      return;
    }
    setActiveBooking(service);
    setBookingDetails({});
    setScheduledStart('');
    setJobAddress('');
  };

  const submitBooking = async () => {
    if (!scheduledStart) return Alert.alert('Error', 'Please enter a preferred date and time.');
    
    setIsSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync('pidrop_token');
      const payload = {
        service_id: activeBooking.id,
        scheduled_start: scheduledStart, // Expecting standard date string format for now
        job_address: activeBooking.service_type === 'in_person' ? jobAddress : null,
        booking_details: bookingDetails 
      };

      const res = await fetch(`${API_BASE}/appointments`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (res.ok) {
        Alert.alert('Success', `Escrow Locked! ${activeBooking.price.toFixed(2)} SC deducted.`);
        setActiveBooking(null);
      } else {
        Alert.alert('Booking Failed', data.detail || 'Check your wallet balance.');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error during booking.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderDynamicFields = (title: string) => {
    const isMechanic = title.includes('Change') || title.includes('Brake') || title.includes('Alternator') || title.includes('Diagnostics');
    const isBeauty = title.includes('Hair') || title.includes('Trim') || title.includes('Cut') || title.includes('Braiding');

    if (isMechanic) {
      return (
        <View style={styles.dynamicContainer}>
          <View style={styles.row}>
            <TextInput style={[styles.input, {flex: 1, marginRight: 5}]} placeholder="Year" placeholderTextColor="#94a3b8" onChangeText={t => setBookingDetails({...bookingDetails, year: t})} />
            <TextInput style={[styles.input, {flex: 1, marginHorizontal: 5}]} placeholder="Make" placeholderTextColor="#94a3b8" onChangeText={t => setBookingDetails({...bookingDetails, make: t})} />
            <TextInput style={[styles.input, {flex: 1, marginLeft: 5}]} placeholder="Model" placeholderTextColor="#94a3b8" onChangeText={t => setBookingDetails({...bookingDetails, model: t})} />
          </View>
          <TextInput style={[styles.input, styles.textArea]} multiline placeholder="Describe symptoms or required parts..." placeholderTextColor="#94a3b8" onChangeText={t => setBookingDetails({...bookingDetails, symptoms: t})} />
        </View>
      );
    }
    if (isBeauty) {
      return (
        <View style={styles.dynamicContainer}>
          <TextInput style={styles.input} placeholder="Requested Style / Specifics" placeholderTextColor="#94a3b8" onChangeText={t => setBookingDetails({...bookingDetails, style: t})} />
          <TextInput style={[styles.input, styles.textArea]} multiline placeholder="Any allergies to products or notes?" placeholderTextColor="#94a3b8" onChangeText={t => setBookingDetails({...bookingDetails, notes: t})} />
        </View>
      );
    }
    return (
      <View style={styles.dynamicContainer}>
        <TextInput style={[styles.input, styles.textArea]} multiline placeholder="Project details, links, or specific requests..." placeholderTextColor="#94a3b8" onChangeText={t => setBookingDetails({...bookingDetails, description: t})} />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Header />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0891b2" />}
      >
        <View style={styles.headerBox}>
          <Text style={styles.pageTitle}>SERVICE CATALOG</Text>
          <Text style={styles.pageSub}>Hire verified professionals. Funds held securely in Escrow until the job is done.</Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color="#0891b2" style={{marginTop: 50}} />
        ) : services.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No services published yet.</Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {services.map(service => (
              <View key={service.id} style={styles.serviceCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeBadgeText}>{service.service_type === 'in_person' ? 'ON-SITE' : 'REMOTE'}</Text>
                  </View>
                  <Text style={styles.priceText}>{service.price.toFixed(2)} SC</Text>
                </View>
                
                <Text style={styles.serviceTitle}>{service.title}</Text>
                <Text style={styles.providerText}>By @{service.provider_username}</Text>
                <Text style={styles.descriptionText} numberOfLines={3}>{service.description}</Text>
                
                <TouchableOpacity style={styles.bookBtn} onPress={() => handleOpenBooking(service)}>
                  <Text style={styles.bookBtnText}>BOOK SERVICE</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* DYNAMIC BOOKING MODAL */}
      <Modal visible={!!activeBooking} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{width: '100%'}}>
            <View style={styles.modalContent}>
              
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>LOCK ESCROW</Text>
                <TouchableOpacity onPress={() => setActiveBooking(null)}><Text style={styles.modalClose}>✕</Text></TouchableOpacity>
              </View>
              
              <ScrollView style={{padding: 20}}>
                <View style={styles.serviceSummaryBox}>
                  <Text style={styles.summaryTitle}>{activeBooking?.title}</Text>
                  <Text style={styles.summaryProvider}>Provider: @{activeBooking?.provider_username}</Text>
                  <View style={styles.totalBox}>
                    <Text style={styles.totalLabel}>Total Due:</Text>
                    <Text style={styles.totalAmount}>{activeBooking?.price.toFixed(2)} SC</Text>
                  </View>
                </View>

                <Text style={styles.label}>PREFERRED DATE & TIME</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="e.g. Tomorrow at 2 PM" 
                  placeholderTextColor="#94a3b8" 
                  value={scheduledStart} 
                  onChangeText={setScheduledStart} 
                />

                {activeBooking?.service_type === 'in_person' && (
                  <View style={{marginTop: 15}}>
                    <Text style={styles.label}>SERVICE LOCATION (FULL ADDRESS)</Text>
                    <TextInput 
                      style={styles.input} 
                      placeholder="123 Main St, City, ST 12345" 
                      placeholderTextColor="#94a3b8" 
                      value={jobAddress} 
                      onChangeText={setJobAddress} 
                    />
                  </View>
                )}

                <View style={styles.divider}>
                  <Text style={styles.dividerText}>PROJECT DETAILS</Text>
                </View>

                {activeBooking && renderDynamicFields(activeBooking.title)}

                <TouchableOpacity 
                  style={[styles.submitBtn, isSubmitting && {opacity: 0.7}]} 
                  onPress={submitBooking}
                  disabled={isSubmitting}
                >
                  <Text style={styles.submitBtnText}>{isSubmitting ? 'PROCESSING...' : 'CONFIRM & LOCK FUNDS'}</Text>
                </TouchableOpacity>
                <View style={{height: 40}} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContent: { padding: 15, paddingBottom: 50 },
  headerBox: { marginBottom: 20 },
  pageTitle: { fontSize: 24, fontWeight: '900', color: '#0f172a', letterSpacing: 1 },
  pageSub: { fontSize: 13, fontWeight: '600', color: '#64748b', marginTop: 5, lineHeight: 20 },
  emptyCard: { backgroundColor: 'white', padding: 40, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', marginTop: 20 },
  emptyText: { color: '#94a3b8', fontWeight: 'bold' },
  
  grid: { gap: 15 },
  serviceCard: { backgroundColor: 'white', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  typeBadge: { backgroundColor: '#cffafe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  typeBadgeText: { color: '#0891b2', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  priceText: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  serviceTitle: { fontSize: 20, fontWeight: '900', color: '#0f172a', marginBottom: 4 },
  providerText: { fontSize: 12, fontWeight: 'bold', color: '#94a3b8', marginBottom: 15 },
  descriptionText: { fontSize: 13, color: '#475569', lineHeight: 20, marginBottom: 20 },
  bookBtn: { backgroundColor: '#0f172a', padding: 15, borderRadius: 12, alignItems: 'center' },
  bookBtnText: { color: 'white', fontWeight: '900', fontSize: 12, letterSpacing: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a', letterSpacing: 1 },
  modalClose: { fontSize: 20, color: '#94a3b8', fontWeight: 'bold' },
  
  serviceSummaryBox: { marginBottom: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  summaryTitle: { fontSize: 18, fontWeight: '900', color: '#0f172a' },
  summaryProvider: { fontSize: 12, color: '#64748b', fontWeight: '600', marginTop: 4 },
  totalBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff7ed', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#ffedd5', marginTop: 15 },
  totalLabel: { color: '#9a3412', fontWeight: 'bold', fontSize: 12 },
  totalAmount: { color: '#9a3412', fontWeight: '900', fontSize: 18 },

  label: { fontSize: 10, fontWeight: '900', color: '#64748b', letterSpacing: 1, marginBottom: 8 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 15, color: '#0f172a', fontSize: 14, fontWeight: '600' },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  
  divider: { marginVertical: 20, borderBottomWidth: 1, borderBottomColor: '#cffafe', paddingBottom: 8 },
  dividerText: { fontSize: 10, fontWeight: '900', color: '#0891b2', letterSpacing: 1 },
  
  dynamicContainer: { gap: 15 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  
  submitBtn: { backgroundColor: '#0891b2', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 25 },
  submitBtnText: { color: 'white', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
});
