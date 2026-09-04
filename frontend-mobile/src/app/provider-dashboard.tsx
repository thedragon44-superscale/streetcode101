import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  ActivityIndicator, 
  Alert, 
  Platform,
  KeyboardAvoidingView
} from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import Header from '../components/Header';

const API_BASE = "https://streetcode101.com/api";

const CURATED_SERVICES: Record<string, any> = {
  mobile_mechanic: { label: "Mobile Mechanic / Auto Repair", type: "in_person", compliance: "I assume all liability for vehicular damage, parts, and tools." },
  hair_beauty: { label: "Hair & Beauty / Barber", type: "in_person", compliance: "I confirm I maintain sanitary tools and hold necessary grooming certifications." },
  home_service: { label: "Home Services & Cleaning", type: "in_person", compliance: "I respect client property and assume full financial responsibility for on-site damage." },
  web_development: { label: "Web & App Development", type: "remote", compliance: "I agree to deliver functional code remotely and avoid malicious exploits." },
  graphic_design: { label: "Graphic Design & Digital Art", type: "remote", compliance: "I guarantee all artwork is original or properly licensed." }
};

const PREDEFINED_TITLES: Record<string, string[]> = {
  mobile_mechanic: ["Oil Change", "Brake Pad Replacement", "Diagnostics / Inspection", "Battery Replacement", "A/C Recharge", "Alternator Replacement"],
  hair_beauty: ["Men's Haircut & Fade", "Women's Cut & Style", "Beard Trim & Lineup", "Braiding", "Coloring / Highlights"],
  home_service: ["Standard House Cleaning", "Deep Cleaning", "Lawn Mowing & Edging", "Plumbing Diagnostics", "Furniture Assembly"],
  web_development: ["Landing Page Creation", "Full Stack Web App", "Bug Fixes / Maintenance", "UI/UX Redesign", "E-commerce Setup"],
  graphic_design: ["Logo Design", "Social Media Kit", "Stream Overlay Package", "Custom Illustration", "Brand Identity Guide"]
};

export default function ProviderDashboardScreen() {
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'schedule' | 'create'>('schedule');
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  // Form State
  const [selectedCategory, setSelectedCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchProfileAndSchedule();
  }, [activeTab]);

  const fetchProfileAndSchedule = async () => {
    setLoading(true);
    try {
      const token = await SecureStore.getItemAsync('pidrop_token');
      if (!token) return router.replace('/login');

      // 1. Get Profile to lock category
      const profRes = await fetch(`${API_BASE}/profile/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (profRes.ok) {
        const profData = await profRes.json();
        setProfile(profData);
        if (profData.primary_trade) {
          setSelectedCategory(profData.primary_trade);
        }
      }

      // 2. Get Schedule if tab is active
      if (activeTab === 'schedule') {
        const apptRes = await fetch(`${API_BASE}/provider/appointments`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (apptRes.ok) setAppointments(await apptRes.json());
      }
    } catch (error) {
      Alert.alert("Error", "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateListing = async () => {
    if (!selectedCategory || !agreed || !title) {
      return Alert.alert("Required", "Complete all fields and agree to terms.");
    }

    setIsSubmitting(true);
    try {
      const token = await SecureStore.getItemAsync('pidrop_token');
      const categoryData = CURATED_SERVICES[selectedCategory];

      const payload = {
        title,
        description,
        price: parseFloat(price),
        service_type: categoryData.type,
      };

      const response = await fetch(`${API_BASE}/services`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.detail || 'Failed to create listing');
      
      Alert.alert("Success", "Service published to the Vault!");
      setTitle(''); 
      setDescription(''); 
      setPrice(''); 
      setAgreed(false);
      setActiveTab('schedule');
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckIn = async (appointmentId: number) => {
    try {
      Alert.alert("GPS Check-In", "Acquiring location coordinates...");
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return Alert.alert("Permission Denied", "Location access is required for on-site check-ins.");
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = location.coords;

      const token = await SecureStore.getItemAsync('pidrop_token');
      const response = await fetch(`${API_BASE}/appointments/${appointmentId}/check-in`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ actual_lat: latitude, actual_long: longitude })
      });
      
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.detail || 'Check-in failed');
      
      Alert.alert("Success", "Checked in successfully!");
      fetchProfileAndSchedule();
    } catch (error: any) {
      Alert.alert("Check-In Error", error.message);
    }
  };

  const handleComplete = async (appointmentId: number) => {
    try {
      const token = await SecureStore.getItemAsync('pidrop_token');
      const response = await fetch(`${API_BASE}/appointments/${appointmentId}/complete`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ proof_of_delivery_url: null }) 
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to complete job');
      }
      
      Alert.alert("Job Finished", "Marked complete. Awaiting client confirmation.");
      fetchProfileAndSchedule();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Header />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Header Area */}
        <View style={styles.dashboardHeader}>
          <Text style={styles.pageTitle}>SERVICE DASH</Text>
          
          <View style={styles.tabContainer}>
            <TouchableOpacity 
              style={[styles.tabBtn, activeTab === 'schedule' && styles.tabBtnActive]}
              onPress={() => setActiveTab('schedule')}
            >
              <Text style={[styles.tabText, activeTab === 'schedule' && styles.tabTextActive]}>SCHEDULE</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.tabBtn, activeTab === 'create' && styles.tabBtnActive]}
              onPress={() => setActiveTab('create')}
            >
              <Text style={[styles.tabText, activeTab === 'create' && styles.tabTextActive]}>ADD SERVICE</Text>
            </TouchableOpacity>
          </View>
        </View>

        {loading ? (
          <View style={styles.centerElements}>
             <ActivityIndicator size="large" color="#06b6d4" />
          </View>
        ) : (
          <>
            {/* --- CREATE SERVICE TAB --- */}
            {activeTab === 'create' && (
              <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View style={styles.formCard}>
                  
                  {/* Category Selection */}
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>YOUR REGISTERED TRADE</Text>
                    {profile?.primary_trade ? (
                      <View style={styles.lockedTradeBox}>
                        <Text style={styles.lockedTradeText}>
                          {CURATED_SERVICES[profile.primary_trade]?.label || profile.primary_trade}
                        </Text>
                        <Ionicons name="lock-closed" size={16} color="#0891b2" />
                      </View>
                    ) : (
                      <Text style={styles.errorText}>No primary trade found on your profile.</Text>
                    )}
                  </View>

                  {/* Compliance Agreement */}
                  {selectedCategory && (
                    <View style={styles.complianceBox}>
                      <View style={styles.complianceHeader}>
                        <Ionicons name="scale-outline" size={16} color="#d97706" />
                        <Text style={styles.complianceTitle}>COMPLIANCE AGREEMENT</Text>
                      </View>
                      <Text style={styles.complianceText}>{CURATED_SERVICES[selectedCategory].compliance}</Text>
                      
                      <TouchableOpacity 
                        style={styles.checkboxRow} 
                        onPress={() => setAgreed(!agreed)}
                      >
                        <View style={[styles.checkbox, agreed && styles.checkboxActive]} />
                        <Text style={styles.checkboxLabel}>I have read and agree to these terms.</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Dynamic Form */}
                  <View style={[styles.dynamicForm, !agreed && styles.fadedForm]}>
                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>SERVICE TITLE</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                        {selectedCategory && PREDEFINED_TITLES[selectedCategory].map(t => (
                          <TouchableOpacity 
                            key={t} 
                            style={[styles.titlePill, title === t && styles.titlePillActive]}
                            onPress={() => agreed && setTitle(t)}
                          >
                            <Text style={[styles.titlePillText, title === t && styles.titlePillTextActive]}>{t}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>BASE PRICE (SC)</Text>
                      <TextInput
                        style={styles.input}
                        keyboardType="numeric"
                        placeholder="150.00"
                        placeholderTextColor="#94a3b8"
                        value={price}
                        onChangeText={setPrice}
                        editable={agreed}
                      />
                    </View>

                    <View style={styles.inputGroup}>
                      <Text style={styles.label}>DESCRIPTION / DELIVERABLES</Text>
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        multiline
                        placeholder="Detail exactly what the client gets..."
                        placeholderTextColor="#94a3b8"
                        value={description}
                        onChangeText={setDescription}
                        editable={agreed}
                      />
                    </View>

                    <TouchableOpacity 
                      style={[styles.submitBtn, (!agreed || isSubmitting) && styles.submitBtnDisabled]}
                      onPress={handleCreateListing}
                      disabled={!agreed || isSubmitting}
                    >
                      {isSubmitting ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.submitBtnText}>LIST SERVICE ON VAULT</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                </View>
              </KeyboardAvoidingView>
            )}

            {/* --- SCHEDULE TAB --- */}
            {activeTab === 'schedule' && (
              <View>
                {appointments.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons name="calendar-outline" size={48} color="#334155" />
                    <Text style={styles.emptyText}>No active appointments found.</Text>
                  </View>
                ) : (
                  <View style={styles.scheduleList}>
                    {appointments.map((appt) => (
                      <View key={appt.id} style={styles.apptCard}>
                        
                        <View style={styles.apptHeader}>
                          <View style={styles.statusBadge}>
                            <Text style={styles.statusBadgeText}>{appt.status.replace('_', ' ')}</Text>
                          </View>
                          <Text style={styles.escrowText}>{appt.escrow_amount.toFixed(2)} SC</Text>
                        </View>

                        <Text style={styles.clientName}>Client: @{appt.client_username}</Text>
                        <Text style={styles.timeText}>
                          {new Date(appt.scheduled_start).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </Text>
                        
                        {appt.job_address && (
                          <View style={styles.locationRow}>
                            <Ionicons name="location-outline" size={14} color="#64748b" />
                            <Text style={styles.locationText}>{appt.job_address}</Text>
                          </View>
                        )}

                        <View style={styles.actionRow}>
                          {appt.status === 'locked' && (
                            <TouchableOpacity onPress={() => handleCheckIn(appt.id)} style={styles.actionBtnPrimary}>
                              <Ionicons name="navigate-outline" size={14} color="#fff" />
                              <Text style={styles.actionBtnPrimaryText}>CHECK IN (GPS)</Text>
                            </TouchableOpacity>
                          )}
                          {appt.status === 'checked_in' && (
                            <TouchableOpacity onPress={() => handleComplete(appt.id)} style={styles.actionBtnSuccess}>
                              <Ionicons name="checkmark-circle-outline" size={14} color="#fff" />
                              <Text style={styles.actionBtnPrimaryText}>COMPLETE JOB</Text>
                            </TouchableOpacity>
                          )}
                          {appt.status === 'pending_confirmation' && (
                            <View style={styles.actionBtnWarning}>
                              <Text style={styles.actionBtnWarningText}>AWAITING CLIENT</Text>
                            </View>
                          )}
                          {appt.status === 'released' && (
                            <View style={styles.actionBtnPaid}>
                              <Text style={styles.actionBtnSuccessText}>PAID</Text>
                            </View>
                          )}
                        </View>

                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scrollContent: { padding: 15, paddingBottom: 50 },
  centerElements: { padding: 50, alignItems: 'center' },
  
  dashboardHeader: { flexDirection: 'column', gap: 15, marginBottom: 20 },
  pageTitle: { fontSize: 28, fontWeight: '900', color: 'white', letterSpacing: 1 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 10, padding: 4, borderWidth: 1, borderColor: '#334155' },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: 'white' },
  tabText: { fontSize: 11, fontWeight: '900', color: '#94a3b8', letterSpacing: 1 },
  tabTextActive: { color: '#0f172a' },

  formCard: { backgroundColor: '#1e293b', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#334155' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 10, fontWeight: '900', color: '#64748b', letterSpacing: 1, marginBottom: 8 },
  lockedTradeBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(6, 182, 212, 0.1)', borderWidth: 1, borderColor: '#06b6d4', padding: 15, borderRadius: 12 },
  lockedTradeText: { color: '#06b6d4', fontWeight: '900', fontSize: 12, textTransform: 'uppercase' },
  errorText: { color: '#ef4444', fontSize: 12 },

  complianceBox: { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)', padding: 15, borderRadius: 12, marginBottom: 20 },
  complianceHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  complianceTitle: { color: '#d97706', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  complianceText: { color: '#fbbf24', fontSize: 12, lineHeight: 18, marginBottom: 15 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(245, 158, 11, 0.2)', paddingTop: 15 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: '#d97706', marginRight: 10 },
  checkboxActive: { backgroundColor: '#d97706' },
  checkboxLabel: { color: '#d97706', fontSize: 12, fontWeight: 'bold' },

  dynamicForm: { transitionProperty: 'opacity', transitionDuration: '300ms' },
  fadedForm: { opacity: 0.3 },
  pillScroll: { marginHorizontal: -5 },
  titlePill: { backgroundColor: '#0f172a', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 10, marginHorizontal: 5, borderWidth: 1, borderColor: '#334155' },
  titlePillActive: { backgroundColor: '#0891b2', borderColor: '#06b6d4' },
  titlePillText: { color: '#94a3b8', fontSize: 11, fontWeight: '900' },
  titlePillTextActive: { color: 'white' },
  input: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: '#334155', borderRadius: 12, padding: 15, color: 'white', fontSize: 14, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: '#f97316', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  submitBtnDisabled: { backgroundColor: '#334155' },
  submitBtnText: { color: 'black', fontWeight: '900', fontSize: 12, letterSpacing: 1 },

  emptyCard: { backgroundColor: '#1e293b', padding: 40, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#334155', marginTop: 20 },
  emptyText: { color: '#64748b', fontWeight: 'bold', marginTop: 15 },
  
  scheduleList: { gap: 15 },
  apptCard: { backgroundColor: '#1e293b', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#334155' },
  apptHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  statusBadge: { backgroundColor: 'rgba(6, 182, 212, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#06b6d4' },
  statusBadgeText: { color: '#06b6d4', fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  escrowText: { color: '#10b981', fontSize: 14, fontWeight: '900' },
  clientName: { color: 'white', fontSize: 18, fontWeight: '900', marginBottom: 4 },
  timeText: { color: '#94a3b8', fontSize: 12, fontWeight: '500', marginBottom: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 15 },
  locationText: { color: '#64748b', fontSize: 12 },
  
  actionRow: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#0f172a', paddingTop: 15 },
  actionBtnPrimary: { backgroundColor: '#0f172a', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  actionBtnPrimaryText: { color: 'white', fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  actionBtnSuccess: { backgroundColor: '#059669', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 12, borderRadius: 10 },
  actionBtnSuccessText: { color: 'white', fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  actionBtnWarning: { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderWidth: 1, borderColor: '#d97706', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  actionBtnWarningText: { color: '#d97706', fontWeight: '900', fontSize: 11, letterSpacing: 1 },
  actionBtnPaid: { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 1, borderColor: '#10b981', paddingVertical: 12, borderRadius: 10, alignItems: 'center' }
});
