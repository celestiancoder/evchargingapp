import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { chargingAlgorithm, BookingResult } from '@/services/algorithm.service';
import { bookingService, BayStatus } from '@/services/booking.service';
import { getStationById, getSlotDisplayName } from '@/config/stations';

const convertToIsoDate = (timeStr: string) => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
};

export default function BookingResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [result, setResult] = useState<BookingResult | null>(null);
  const [bays, setBays] = useState<BayStatus[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [isLoadingBays, setIsLoadingBays] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const serviceType = params.serviceType as string;
  const stationId = params.stationId as string;
  const arrivalTime = params.arrivalTime as string;
  const departureTime = params.departureTime as string;
  const currentSoc = params.currentSoc as string;
  const targetSoc = params.targetSoc as string;
  const vehicleId = params.vehicleId as string;
  const batteryCapacity = Number(params.batteryCapacityMah || 2200);
  const selectedBayAmps = Number(params.selectedBayAmps || 2.5);

  useEffect(() => {
    if (!arrivalTime || !departureTime) return;

    let calcResult: BookingResult;
    if (serviceType === 'charging') {
      calcResult = chargingAlgorithm.calculateChargeAndPark(arrivalTime, departureTime, Number(currentSoc), Number(targetSoc),selectedBayAmps,batteryCapacity);
    } else {
      calcResult = chargingAlgorithm.calculateParkingOnly(arrivalTime, departureTime);
    }
    setResult(calcResult);

    const fetchBays = async () => {
      try {
        setIsLoadingBays(true);
        const startIso = convertToIsoDate(calcResult.startTime);
        const endIso = convertToIsoDate(calcResult.endTime);
        
        const bayStatuses = await bookingService.getAllBayStatuses(startIso, endIso);
        if (stationId) {
          const station = getStationById(stationId);
          if (station) {
            const stationSlotNames = station.slots.map(s => s.dbName);
            const filteredBays = bayStatuses.filter(bay => stationSlotNames.includes(bay.name));
            setBays(filteredBays);
            return;
          }
        }
        setBays(bayStatuses);
      } catch (err) {
        Alert.alert('Error', 'Could not load real-time bay availability.');
      } finally {
        setIsLoadingBays(false);
      }
    };

    fetchBays();
  }, [serviceType, stationId, arrivalTime, departureTime, currentSoc, targetSoc]);

const handleBaySelect = (bay: BayStatus) => {
  setSelectedSlotId(bay.id);

  let calcResult: BookingResult;
  if (serviceType === 'charging') {
    calcResult = chargingAlgorithm.calculateChargeAndPark(
      arrivalTime, 
      departureTime, 
      Number(currentSoc), 
      Number(targetSoc),
      bay.maxOutputAmps,
      batteryCapacity,
    );
  } else {
    calcResult = chargingAlgorithm.calculateParkingOnly(arrivalTime, departureTime);
  }
  setResult(calcResult);
};

  const handleConfirm = async () => {
    if (!result || !selectedSlotId) {
      Alert.alert('Selection Required', 'Please choose an available bay first.');
      return;
    }

    try {
      setIsSubmitting(true);

      const overallStartIso = convertToIsoDate(result.startTime); 
      const overallEndIso = convertToIsoDate(result.endTime);     

      const chargeStartIso = result.chargeStartTime ? convertToIsoDate(result.chargeStartTime) : null; 
      const chargeEndIso = result.chargeEndTime ? convertToIsoDate(result.chargeEndTime) : null;

      const createdBooking=await bookingService.createBooking({
        vehicleId: vehicleId,
        serviceType: serviceType,
        startTime: overallStartIso,
        endTime: overallEndIso,
        chargeStartTime: chargeStartIso,
        chargeEndTime: chargeEndIso,
        slotId: selectedSlotId, 
        targetSoc: result.serviceType === 'charging' ? Number(targetSoc) : undefined,
        totalCost: result.totalCost,
      });

      Alert.alert(
        'Success', 
        'Your reservation has been confirmed!',
        [{ text: 'OK', onPress: () => router.replace({
            pathname: '/(root)/live-session',
            params: { bookingId: createdBooking.id }
          }) 
         }]
      );

    } catch (error: any) {
      Alert.alert('Booking Error', error.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity disabled={isSubmitting} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={isSubmitting ? "#9CA3AF" : "#374151"} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {result?.serviceType === 'charging' ? 'Optimal Charging Slot' : 'Parking Reservation'}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {result ? (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons 
                name={result.serviceType === 'charging' ? "flash" : "car"} 
                size={24} 
                color={result.serviceType === 'charging' ? "#F59E0B" : "#2563EB"} 
              />
              <Text style={styles.cardTitle}>
                {result.serviceType === 'charging' ? 'Smart Optimized Pick' : 'Standard Parking'}
              </Text>
            </View>

            {result.isPartial && (
              <View style={styles.warningBox}>
                <Ionicons name="warning" size={16} color="#B45309" />
                <Text style={styles.warningText}>
                  Not enough parked time for a full charge. Recommending partial charge.
                </Text>
              </View>
            )}

            <View style={styles.row}>
              <Text style={styles.label}>Facility Stay:</Text>
              <Text style={styles.value}>{result.startTime} - {result.endTime}</Text>
            </View>
            
            {result.serviceType === 'charging' && (
              <>
                <View style={styles.row}>
                  <Text style={styles.label}>Active Charge Window:</Text>
                  <Text style={styles.valueHighlight}>{result.chargeStartTime} - {result.chargeEndTime}</Text>
                </View>

                <View style={styles.row}>
                  <Text style={styles.label}>Target SOC Achieved:</Text>
                  <Text style={styles.value}>{result.achievedSoc}%</Text>
                </View>
              </>
            )}

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Select a Charging Bay</Text>
            {isLoadingBays ? (
              <ActivityIndicator size="small" color="#2563EB" style={{ marginVertical: 12 }} />
            ) : (
              <View style={styles.gridContainer}>
                {bays.map((bay) => {
                  const isSelected = selectedSlotId === bay.id;
                  return (
                    <TouchableOpacity
                      key={bay.id}
                      disabled={!bay.isAvailable || isSubmitting}
                      style={[
                        styles.bayGridItem,
                        !bay.isAvailable && styles.bayOccupied,
                        isSelected && styles.baySelected
                      ]}
                      onPress={() => handleBaySelect(bay)}
                    >
                      <Text style={[
                        styles.bayText,
                        !bay.isAvailable && styles.bayTextOccupied,
                        isSelected && styles.bayTextSelected
                      ]}>
                        {getSlotDisplayName(bay.name)}
                      </Text>
                      <Text style={{ fontSize: 9, color: bay.isAvailable ? '#6B7280' : '#EF4444' }}>
                        {bay.isAvailable ? (isSelected ? 'Selected' : 'Open') : 'Booked'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <View style={styles.divider} />

            <View style={styles.receiptContainer}>
              <Text style={styles.receiptTitle}>Fare Breakdown</Text>
              
              {result.serviceType === 'charging' && (
                <View style={styles.receiptRow}>
                  <Text style={styles.receiptLabel}>Smart Charging ({result.chargingMinutesNeeded} mins)</Text>
                  <Text style={styles.receiptValue}>${result.chargingCost.toFixed(2)}</Text>
                </View>
              )}
              
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>
                  {result.serviceType === 'charging' ? 'Idle Parking Fee' : 'Parking Fee'}
                </Text>
                <Text style={styles.receiptValue}>${result.parkingCost.toFixed(2)}</Text>
              </View>

              <View style={styles.receiptTotalRow}>
                <Text style={styles.costLabel}>Total Estimate</Text>
                <Text style={styles.costValue}>${result.totalCost.toFixed(2)}</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.button, (!selectedSlotId || isSubmitting) && styles.buttonDisabled]} 
              onPress={handleConfirm}
              disabled={isSubmitting || !selectedSlotId}
            >
              {isSubmitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>Confirm Booking</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Calculating best option...</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  content: { flex: 1, padding: 16 },
  card: { backgroundColor: '#ffffff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginLeft: 8 },
  warningBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF3C7', padding: 12, borderRadius: 8, marginBottom: 16 },
  warningText: { color: '#B45309', fontSize: 12, marginLeft: 8, flex: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  label: { fontSize: 14, color: '#6B7280' },
  value: { fontSize: 14, fontWeight: '600', color: '#111827' },
  valueHighlight: { fontSize: 14, fontWeight: '700', color: '#059669' },
  divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 10 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  bayGridItem: { width: '48%', backgroundColor: '#F3F4F6', padding: 12, borderRadius: 8, marginBottom: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  bayOccupied: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  baySelected: { backgroundColor: '#DBEAFE', borderColor: '#3B82F6' },
  bayText: { fontSize: 14, fontWeight: '600', color: '#111827' },
  bayTextOccupied: { color: '#DC2626' },
  bayTextSelected: { color: '#1D4ED8' },
  receiptContainer: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 16, marginBottom: 8 },
  receiptTitle: { fontSize: 12, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 0.5 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  receiptLabel: { fontSize: 14, color: '#4B5563' },
  receiptValue: { fontSize: 14, color: '#111827', fontWeight: '500' },
  receiptTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  costLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },
  costValue: { fontSize: 24, fontWeight: '900', color: '#10B981' },
  button: { backgroundColor: '#000000', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 24, height: 50, justifyContent: 'center' },
  buttonDisabled: { backgroundColor: '#A1A1AA' },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  loadingContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  loadingText: { textAlign: 'center', marginTop: 16, color: '#6B7280', fontSize: 16 }
});