import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { STATIONS, Station } from '@/config/stations';
import { bookingService, BayStatus } from '@/services/booking.service';

export default function BookingScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'esp32' | 'upcoming'>('all');
  const [bays, setBays] = useState<BayStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchRealtimeSlots();
  }, []);

  const fetchRealtimeSlots = async () => {
    try {
      setLoading(true);
      const now = new Date();
      // Check slot availability for the next hour to represent "current real-time availability"
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      const slotStatuses = await bookingService.getAllBayStatuses(
        now.toISOString(),
        oneHourFromNow.toISOString()
      );
      setBays(slotStatuses);
    } catch (err) {
      console.error('Error loading real-time bay statuses:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStationBaysInfo = (station: Station) => {
    const stationSlotNames = station.slots.map(s => s.dbName);
    const stationBays = bays.filter(bay => stationSlotNames.includes(bay.name));
    const total = station.slots.length;
    const available = stationBays.filter(bay => bay.isAvailable).length;
    return { available, total };
  };

  const filteredStations = STATIONS.filter(station => {
    const matchesSearch =
      station.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      station.address.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'esp32') {
      return station.hasEsp32;
    } else if (filterType === 'upcoming') {
      return !station.hasEsp32;
    }
    return true;
  });

  const handleBook = (stationId: string, serviceType: 'charging' | 'parking') => {
    router.push({
      pathname: '/booking-form' as any,
      params: { stationId, serviceType },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-zinc-50" edges={['top']}>
      <View className="flex-1 px-6 pt-6">
        {/* Title */}
        <View className="mb-6 flex-row justify-between items-center">
          <View>
            <Text className="text-3xl font-extrabold tracking-tight text-zinc-900">
              Charging Hubs
            </Text>
            <Text className="text-sm text-zinc-500 mt-1">
              Select a power station across the city to book your slot
            </Text>
          </View>
          <TouchableOpacity 
            onPress={fetchRealtimeSlots} 
            disabled={loading}
            className="bg-white p-2.5 rounded-full border border-zinc-200"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#6B7280" />
            ) : (
              <Ionicons name="refresh" size={18} color="#4B5563" />
            )}
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-white border border-zinc-200 rounded-2xl px-4 py-3 mb-4">
          <Ionicons name="search" size={20} color="#9CA3AF" className="mr-3" />
          <TextInput
            placeholder="Search by station name or location..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 text-base text-zinc-800"
            placeholderTextColor="#9CA3AF"
          />
          {searchQuery !== '' && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips */}
        <View className="flex-row gap-2 mb-6">
          <TouchableOpacity
            onPress={() => setFilterType('all')}
            className={`px-4 py-2 rounded-full border ${
              filterType === 'all'
                ? 'bg-black border-black'
                : 'bg-white border-zinc-200'
            }`}
          >
            <Text className={`text-xs font-bold ${filterType === 'all' ? 'text-white' : 'text-zinc-600'}`}>
              All Stations
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setFilterType('esp32')}
            className={`px-4 py-2 rounded-full border flex-row items-center gap-1 ${
              filterType === 'esp32'
                ? 'bg-emerald-950 border-emerald-800'
                : 'bg-white border-zinc-200'
            }`}
          >
            <Ionicons name="hardware-chip" size={12} color={filterType === 'esp32' ? '#34D399' : '#4B5563'} />
            <Text className={`text-xs font-bold ${filterType === 'esp32' ? 'text-emerald-400' : 'text-zinc-600'}`}>
              ESP32 Live
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setFilterType('upcoming')}
            className={`px-4 py-2 rounded-full border ${
              filterType === 'upcoming'
                ? 'bg-zinc-800 border-zinc-800'
                : 'bg-white border-zinc-200'
            }`}
          >
            <Text className={`text-xs font-bold ${filterType === 'upcoming' ? 'text-white' : 'text-zinc-600'}`}>
              Upcoming
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stations List */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchRealtimeSlots();
              }}
              tintColor="#10B981"
            />
          }
        >
          {filteredStations.length === 0 ? (
            <View className="items-center justify-center py-20">
              <Ionicons name="navigate-outline" size={48} color="#9CA3AF" />
              <Text className="text-zinc-500 font-bold text-base mt-4">No Stations Found</Text>
              <Text className="text-zinc-400 text-xs text-center mt-1">
                Try searching for another location or clearing your filters
              </Text>
            </View>
          ) : (
            filteredStations.map(station => {
              const { available, total } = getStationBaysInfo(station);
              const allOccupied = available === 0 && !loading;

              return (
                <View
                  key={station.id}
                  className="bg-white border border-zinc-200 rounded-3xl p-5 mb-5 shadow-sm"
                >
                  {/* Station Header info */}
                  <View className="flex-row justify-between items-start mb-3">
                    <View className="flex-1 mr-3">
                      <Text className="font-extrabold text-zinc-900 text-xl">
                        {station.name}
                      </Text>
                      <Text className="text-xs text-zinc-400 mt-1 flex-row items-center">
                        <Ionicons name="location-outline" size={12} color="#9CA3AF" /> {station.address}
                      </Text>
                    </View>

                    {/* ESP32 Status Badge */}
                    <View
                      className={`px-3 py-1 rounded-full flex-row items-center gap-1 ${
                        station.hasEsp32 ? 'bg-emerald-50' : 'bg-zinc-100'
                      }`}
                    >
                      <Ionicons
                        name={station.hasEsp32 ? 'flash' : 'time'}
                        size={12}
                        color={station.hasEsp32 ? '#10B981' : '#6B7280'}
                      />
                      <Text
                        className={`text-[10px] font-bold ${
                          station.hasEsp32 ? 'text-emerald-700' : 'text-zinc-600'
                        }`}
                      >
                        {station.hasEsp32 ? 'ESP32 LIVE' : 'UPCOMING'}
                      </Text>
                    </View>
                  </View>

                  {/* Realtime Bay status line */}
                  <View className="flex-row items-center mb-4 gap-2">
                    <Ionicons name="radio-button-on" size={12} color={allOccupied ? '#EF4444' : '#10B981'} />
                    <Text className="text-xs text-zinc-500 font-semibold">
                      {loading ? (
                        'Checking bays...'
                      ) : (
                        `${available} of ${total} bays available now`
                      )}
                    </Text>
                    <Text className="text-zinc-300">•</Text>
                    <Text className="text-xs text-zinc-400">{station.distance} away</Text>
                  </View>

                  {/* Quick Booking Buttons */}
                  <View className="flex-row gap-2 pt-3 border-t border-zinc-100">
                    <TouchableOpacity
                      onPress={() => handleBook(station.id, 'charging')}
                      className="flex-1 bg-black rounded-2xl py-3 flex-row items-center justify-center gap-1.5"
                      activeOpacity={0.8}
                    >
                      <Ionicons name="flash" size={14} color="white" />
                      <Text className="text-white text-xs font-bold">Book Charging</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleBook(station.id, 'parking')}
                      className="flex-1 bg-zinc-100 border border-zinc-200 rounded-2xl py-3 flex-row items-center justify-center gap-1.5"
                      activeOpacity={0.8}
                    >
                      <Ionicons name="car" size={14} color="#18181B" />
                      <Text className="text-zinc-900 text-xs font-bold">Book Parking</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}