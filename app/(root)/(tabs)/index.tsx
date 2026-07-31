import React, { useState, useEffect } from 'react';
import { ScrollView, RefreshControl, View, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WelcomeHeader from '@/components/WelcomeHeader';
import ActiveSessions from '@/components/ActiveSessions';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function Index() {
  const [stats, setStats] = useState({
    totalSaved: 0,
    totalV2gRevenue: 0,
    overallBenefit: 0,
  });
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoadingStats(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'completed');

      if (error) throw error;

      let savedSum = 0;
      let v2gSum = 0;

      if (bookings) {
        for (const booking of bookings) {
          const stored = localStorage.getItem(`v2g_booking_${booking.id}`);
          if (stored) {
            const parsed = JSON.parse(stored);
            savedSum += parsed.moneySaved || 0;
            v2gSum += parsed.v2gRevenue || 0;
          } else {
            // Fallback: estimate 30% savings for completed charging sessions
            if (booking.booking_type === 'charging') {
              savedSum += Number(booking.total_cost) * 0.3;
            }
          }
        }
      }

      setStats({
        totalSaved: Number(savedSum.toFixed(2)),
        totalV2gRevenue: Number(v2gSum.toFixed(2)),
        overallBenefit: Number((savedSum + v2gSum).toFixed(2)),
      });
    } catch (err) {
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoadingStats(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#10B981" />
        }
      >
        <WelcomeHeader />

        {/* V2G Lifetime Stats */}
        <View className="px-6 mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">Lifetime Savings & Benefits</Text>
          {loadingStats ? (
            <View className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6 items-center justify-center min-h-[100px]">
              <ActivityIndicator color="#10B981" />
            </View>
          ) : (
            <View className="flex-row flex-wrap justify-between gap-3">
              {/* Total Money Saved */}
              <View className="bg-emerald-50 border border-emerald-150 rounded-2xl p-4 flex-1 min-w-[45%]">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider">Money Saved</Text>
                  <Ionicons name="sparkles" size={14} color="#059669" />
                </View>
                <Text className="text-xl font-black text-emerald-700">₹{stats.totalSaved}</Text>
                <Text className="text-[9px] text-emerald-600 mt-1 leading-normal">Smart schedule savings</Text>
              </View>

              {/* Total V2G Revenue */}
              <View className="bg-orange-50 border border-orange-150 rounded-2xl p-4 flex-1 min-w-[45%]">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-[10px] font-extrabold text-orange-800 uppercase tracking-wider">V2G Revenue</Text>
                  <Ionicons name="flash" size={14} color="#D97706" />
                </View>
                <Text className="text-xl font-black text-orange-700">₹{stats.totalV2gRevenue}</Text>
                <Text className="text-[9px] text-orange-600 mt-1 leading-normal">Grid trading earnings</Text>
              </View>

              {/* Overall Benefit */}
              <View className="bg-purple-50 border border-purple-150 rounded-2xl p-4 w-full flex-row items-center justify-between mt-1">
                <View className="flex-1 mr-4">
                  <Text className="text-[10px] font-extrabold text-purple-800 uppercase tracking-wider">Overall Benefit</Text>
                  <Text className="text-[9px] text-purple-600 mt-1 leading-normal">Cumulative savings + energy sold earnings</Text>
                </View>
                <View className="items-end">
                  <Text className="text-2xl font-black text-purple-700">₹{stats.overallBenefit}</Text>
                </View>
              </View>
            </View>
          )}
        </View>

        <ActiveSessions />
      </ScrollView>
    </SafeAreaView>
  );
}
