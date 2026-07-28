import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase'; 
import { useAuth } from '@/context/auth-context';

interface HistoryBooking {
  id: string;
  booking_type: 'charging' | 'parking';
  status: 'completed' | 'cancelled';
  start_time: string;
  end_time: string;
  total_cost: number;
  created_at: string;
  slots?: { name: string };
  vehicles?: { make_model: string; license_plate: string };
}

export default function BookingHistoryScreen() {
  const router = useRouter();
  const { user, initializing } = useAuth();
  const [history, setHistory] = useState<HistoryBooking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    if (initializing) return;
    if (!user) {
      setLoading(false);
      return;
    }

    fetchHistory(user.id);
  }, [user, initializing]);

  const fetchHistory = async (userId: string) => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('bookings')
        .select('*, slots(name), vehicles(make_model, license_plate)')
        .eq('user_id', userId)
        .in('status', ['completed', 'cancelled'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching history:', error);
      } else {
        setHistory(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const renderItem = ({ item }: { item: HistoryBooking }) => {
    const isCompleted = item.status === 'completed';
    const slotName = item.slots?.name || 'Charging Bay';
    const vehicleText = item.vehicles
      ? `${item.vehicles.make_model} (${item.vehicles.license_plate})`
      : 'Vehicle';

    const startDate = new Date(item.start_time);
    const dateFormatted = startDate.toLocaleDateString([], {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const startTimeFormatted = startDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    const endTimeFormatted = new Date(item.end_time).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View className="bg-white border border-gray-200 rounded-2xl p-4 mb-3 shadow-sm">
        <View className="flex-row justify-between items-center mb-2">
          <View className="flex-row items-center gap-2">
            <Text className="font-bold text-gray-900 text-base">{slotName}</Text>
          </View>

          <View
            className={`px-2.5 py-1 rounded-full ${
              isCompleted ? 'bg-emerald-100' : 'bg-red-100'
            }`}
          >
            <Text
              className={`text-xs font-semibold uppercase ${
                isCompleted ? 'text-emerald-700' : 'text-red-700'
              }`}
            >
              {item.status}
            </Text>
          </View>
        </View>

        <View className="py-2 border-y border-gray-100 my-2 gap-1">
          <Text className="text-gray-500 text-xs font-medium">
            {dateFormatted} • {startTimeFormatted} - {endTimeFormatted}
          </Text>
          <Text className="text-gray-600 text-xs">{vehicleText}</Text>
        </View>

        <View className="flex-row justify-between items-center pt-1">
          <Text className="text-gray-400 text-xs capitalize font-medium">
            Type: {item.booking_type}
          </Text>
          <Text className="text-lg font-extrabold text-gray-900">
            ${Number(item.total_cost || 0).toFixed(2)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white pt-12 pb-4 px-6 border-b border-gray-200 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900">Session History</Text>
        <View className="w-6" />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                if (!user) return;
                setRefreshing(true);
                fetchHistory(user.id);
              }}
              tintColor="#10B981"
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center mt-20">
              <Ionicons name="receipt-outline" size={48} color="#9CA3AF" />
              <Text className="text-gray-500 font-medium mt-3">No past sessions found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}