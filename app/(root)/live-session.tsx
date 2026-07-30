import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Animated,
  Easing,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { chargingAlgorithm } from '@/services/algorithm.service';
import { bookingService } from '@/services/booking.service';

interface BookingSession {
  id: string;
  status: 'reserved' | 'active' | 'completed' | 'cancelled';
  current_soc: number;
  target_soc: number;
  is_charging: boolean;
  booking_type: 'charging' | 'parking';
  start_time: string;
  end_time: string;
  charge_start_time?: string;
  charge_end_time?: string;
  total_cost: number;
  slot_id: string;
}

interface CancellationReceipt {
  elapsedMinutes: number;
  chargingCost: number;
  parkingCost: number;
  finalTotalCost: number;
  refundAmount: number;
  isPreStart: boolean;
}

export default function LiveSessionScreen() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  const [booking, setBooking] = useState<BookingSession | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [receipt, setReceipt] = useState<CancellationReceipt | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [v2gData, setV2gData] = useState<any>(null);

  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (booking?.is_charging) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.9,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 1200,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(0.3);
    }
  }, [booking?.is_charging]);

  useEffect(() => {
    if (!bookingId) return;

    const fetchBookingDetails = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('bookings')
          .select('*')
          .eq('id', bookingId)
          .single();

        if (error) throw error;
        setBooking(data);
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to fetch session details.');
      } finally {
        setLoading(false);
      }
    };

    fetchBookingDetails();

    const stored = localStorage.getItem(`v2g_booking_${bookingId}`);
    if (stored) {
      setV2gData(JSON.parse(stored));
    }

    const subscription = supabase
      .channel(`live-session-${bookingId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${bookingId}`,
        },
        (payload) => {
          setBooking(payload.new as BookingSession);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [bookingId]);

  const handleCancelBooking = () => {
    if (!booking) return;

    Alert.alert(
      'Cancel Reservation',
      'Are you sure you want to cancel? If charging is active, power will be stopped immediately and cost recalculated based on elapsed time.',
      [
        { text: 'No, Keep Active', style: 'cancel' },
        {
          text: 'Yes, End & Calculate',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);

              const now = new Date();
              const cancelTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
              
              const startTimeStr = new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
              const endTimeStr = new Date(booking.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
              
              const chargeStartStr = booking.charge_start_time 
                ? new Date(booking.charge_start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) 
                : undefined;
              const chargeEndStr = booking.charge_end_time 
                ? new Date(booking.charge_end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) 
                : undefined;

              const calculatedReceipt = chargingAlgorithm.calculateEarlyCancellation(
                startTimeStr,
                endTimeStr,
                chargeStartStr,
                chargeEndStr,
                cancelTimeStr,
                booking.total_cost,
                booking.booking_type || 'charging'
              );
              await bookingService.cancelBooking(
              booking.id,
              booking.slot_id,
              calculatedReceipt.finalTotalCost
            );
              setReceipt(calculatedReceipt);
              setLoading(false);
              setShowReceiptModal(true);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not cancel booking.');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleCloseReceipt = () => {
    setShowReceiptModal(false);
    router.replace('/(root)/(tabs)');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Processing session...</Text>
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorText}>No active booking found.</Text>
      </SafeAreaView>
    );
  }

  const soc = booking.current_soc ?? 0;
  const isCharging = booking.is_charging;

  const isSessionExpired = new Date() > new Date(booking.end_time);
  const canCancel = (booking.status === 'active' || booking.status === 'reserved') && !isSessionExpired;

  return (
    <View style={styles.container}>
      <View style={[styles.topHeader, isCharging ? styles.bgCharging : styles.bgParking]}>
        {isCharging && (
          <Animated.View style={[styles.animatedGlow, { opacity: pulseAnim }]} />
        )}

        <SafeAreaView edges={['top']} style={styles.topBar}>
          <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>LIVE SESSION</Text>
          <View style={{ width: 40 }} />
        </SafeAreaView>

        <View style={styles.socContainer}>
          <Text style={styles.socNumber}>{soc}%</Text>
          
          <View style={styles.badgeRow}>
            <Ionicons 
              name={isCharging ? "flash" : "car"} 
              size={16} 
              color={isCharging ? "#10B981" : "#A1A1AA"} 
            />
            <Text style={[styles.badgeText, isCharging ? styles.textCharging : styles.textParking]}>
              {isCharging ? 'CHARGING IN PROGRESS' : 'PARKED / IDLE'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomSection}>
        <View style={styles.overviewContainer}>
          <Text style={styles.sectionTitle}>Session Overview</Text>

          <View style={styles.infoGroup}>
            <View style={styles.infoRow}>
              <Text style={styles.label}>Status</Text>
              <Text style={styles.valueBold}>{booking.status.toUpperCase()}</Text>
            </View>
            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.label}>Target Charge</Text>
              <Text style={styles.value}>{booking.target_soc ? `${booking.target_soc}%` : 'N/A'}</Text>
            </View>
            <View style={styles.divider} />

            {booking.charge_start_time && (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Charging Window</Text>
                  <Text style={styles.value}>
                    {new Date(booking.charge_start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {' - '}
                    {new Date(booking.charge_end_time!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={styles.divider} />
              </>
            )}

            <View style={styles.infoRow}>
              <Text style={styles.label}>Reservation Window</Text>
              <Text style={styles.value}>
                {new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {' - '}
                {new Date(booking.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.label}>Estimated Price</Text>
              <Text style={styles.priceValue}>₹{booking.total_cost.toFixed(2)}</Text>
            </View>

            {v2gData && v2gData.v2gEnabled && (
              <>
                <View style={styles.divider} />
                <View style={styles.v2gHeaderRow}>
                  <Ionicons name="flash-outline" size={16} color="#F97316" />
                  <Text style={styles.v2gSectionTitle}>Vehicle-to-Grid (V2G)</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Status</Text>
                  <Text style={styles.v2gValueEnabled}>Enabled</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Estimated Energy Sold</Text>
                  <Text style={styles.value}>{v2gData.energySoldKwh} kWh</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Average Selling Price</Text>
                  <Text style={styles.value}>₹{v2gData.avgSellingPrice}/kWh</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Estimated Revenue</Text>
                  <Text style={styles.v2gRevenueValue}>₹{v2gData.v2gRevenue}</Text>
                </View>
                
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Battery Reserve</Text>
                  <Text style={styles.value}>{v2gData.minBatteryReserve}%</Text>
                </View>
              </>
            )}
          </View>
        </View>

        <SafeAreaView edges={['bottom']} style={styles.buttonGroup}>
          <TouchableOpacity style={styles.actionButton} onPress={() => router.replace('/(root)/(tabs)')}>
            <Text style={styles.actionButtonText}>Back to Home</Text>
          </TouchableOpacity>

          {canCancel && (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelBooking}>
              <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
              <Text style={styles.cancelButtonText}>End & Cancel Session</Text>
            </TouchableOpacity>
          )}
        </SafeAreaView>
      </View>

      <Modal visible={showReceiptModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.receiptCard}>
            <View style={styles.receiptHeader}>
              <View style={styles.receiptIconBg}>
                <Ionicons name="receipt-outline" size={28} color="#000000" />
              </View>
              <Text style={styles.receiptTitle}>Session Settlement</Text>
              <Text style={styles.receiptSubtitle}>
                {receipt?.isPreStart 
                  ? 'Cancelled prior to start time. Fully refunded.' 
                  : 'Prorated charges calculated for active duration.'}
              </Text>
            </View>

            <View style={styles.receiptBody}>
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Elapsed Duration</Text>
                <Text style={styles.receiptValue}>{receipt?.elapsedMinutes} mins</Text>
              </View>
              <View style={styles.receiptDivider} />

              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Prorated Charging</Text>
                <Text style={styles.receiptValue}>₹{receipt?.chargingCost.toFixed(2)}</Text>
              </View>
              <View style={styles.receiptDivider} />

              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>Prorated Parking</Text>
                <Text style={styles.receiptValue}>₹{receipt?.parkingCost.toFixed(2)}</Text>
              </View>
              <View style={styles.receiptDivider} />

              <View style={styles.receiptRowTotal}>
                <Text style={styles.receiptTotalLabel}>Final Amount Billed</Text>
                <Text style={styles.receiptTotalValue}>₹{receipt?.finalTotalCost.toFixed(2)}</Text>
              </View>

              {receipt && receipt.refundAmount > 0 && (
                <View style={styles.refundBadge}>
                  <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                  <Text style={styles.refundText}>
                    Refund Issued: ₹{receipt.refundAmount.toFixed(2)}
                  </Text>
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.doneButton} onPress={handleCloseReceipt}>
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  loadingText: { marginTop: 12, color: '#6B7280' },
  errorText: { color: '#EF4444', fontSize: 16 },

  topHeader: { height: '36%', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 20, position: 'relative', overflow: 'hidden' },
  bgCharging: { backgroundColor: '#064E3B' },
  bgParking: { backgroundColor: '#18181B' },
  animatedGlow: { ...StyleSheet.absoluteFillObject, backgroundColor: '#10B981' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 2, marginTop: 6 },
  iconButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  topBarTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', letterSpacing: 1.5 },
  socContainer: { alignItems: 'center', zIndex: 2, marginBottom: 10 },
  socNumber: { fontSize: 70, fontWeight: '900', color: '#FFFFFF', letterSpacing: -2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, gap: 6, marginTop: 2 },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  textCharging: { color: '#34D399' },
  textParking: { color: '#A1A1AA' },

  bottomSection: { flex: 1, backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 20, justifyContent: 'space-between' },
  overviewContainer: { flexShrink: 1 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#000000', marginBottom: 12 },
  infoGroup: { backgroundColor: '#FAFAFA', borderRadius: 16, borderWidth: 1, borderColor: '#E4E4E7', paddingHorizontal: 16, paddingVertical: 2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  divider: { height: 1, backgroundColor: '#F4F4F5' },
  label: { fontSize: 13, color: '#71717A' },
  value: { fontSize: 13, fontWeight: '500', color: '#000000' },
  valueBold: { fontSize: 13, fontWeight: '700', color: '#000000' },
  priceValue: { fontSize: 15, fontWeight: '800', color: '#000000' },
  v2gHeaderRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 8, gap: 6 },
  v2gSectionTitle: { fontSize: 13, fontWeight: '700', color: '#F97316', textTransform: 'uppercase', letterSpacing: 0.5 },
  v2gValueEnabled: { fontSize: 13, fontWeight: '700', color: '#F97316' },
  v2gRevenueValue: { fontSize: 13, fontWeight: '800', color: '#F97316' },
  
  buttonGroup: { gap: 8, marginTop: 10, paddingBottom: 10 },
  actionButton: { backgroundColor: '#000000', borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  actionButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  cancelButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 14, paddingVertical: 12, gap: 6 },
  cancelButtonText: { color: '#DC2626', fontSize: 14, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.75)', justifyContent: 'center', paddingHorizontal: 20 },
  receiptCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, alignItems: 'center' },
  receiptHeader: { alignItems: 'center', marginBottom: 20 },
  receiptIconBg: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F4F4F5', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  receiptTitle: { fontSize: 20, fontWeight: '800', color: '#000000' },
  receiptSubtitle: { fontSize: 13, color: '#71717A', textAlign: 'center', marginTop: 4, paddingHorizontal: 10 },
  receiptBody: { width: '100%', backgroundColor: '#FAFAFA', borderRadius: 16, borderWidth: 1, borderColor: '#E4E4E7', padding: 16, marginBottom: 20 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  receiptLabel: { fontSize: 14, color: '#71717A' },
  receiptValue: { fontSize: 14, fontWeight: '600', color: '#000000' },
  receiptDivider: { height: 1, backgroundColor: '#E4E4E7', marginVertical: 4 },
  receiptRowTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, marginTop: 4 },
  receiptTotalLabel: { fontSize: 15, fontWeight: '700', color: '#000000' },
  receiptTotalValue: { fontSize: 18, fontWeight: '900', color: '#000000' },
  refundBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECFDF5', borderRadius: 10, paddingVertical: 8, marginTop: 10, gap: 6 },
  refundText: { color: '#065F46', fontSize: 13, fontWeight: '700' },
  doneButton: { width: '100%', backgroundColor: '#000000', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  doneButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});