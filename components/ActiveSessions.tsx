import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase'; 
import { getSlotDisplayName } from '@/config/stations';

interface ActiveSessionData {
  id: string;
  status: 'reserved' | 'active';
  current_soc: number;
  is_charging: boolean;
  start_time: string;
  end_time: string;
  slot_id: string;
  slots?: { name: string };
}

export default function ActiveSessions() {
  const router = useRouter();
  const [activeSession, setActiveSession] = useState<ActiveSessionData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchActiveSession();
  }, []);

  const fetchActiveSession = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from('bookings')
        .select('*, slots(name)')
        .eq('user_id', user.id)
        .in('status', ['active', 'reserved'])
        .order('start_time', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching active session:', error);
      } else {
        setActiveSession(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeSession?.id) return;
    const channelName = `active-session-card-${activeSession.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bookings',
          filter: `id=eq.${activeSession.id}`,
        },
        (payload) => {
          const updated = payload.new as ActiveSessionData;
          if (updated.status !== 'active' && updated.status !== 'reserved') {
            setActiveSession(null);
          } else {
            setActiveSession((prev) => prev ? { ...prev, ...updated } : null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeSession?.id]);

  if (loading) {
    return (
      <View className="mx-6 mt-6">
        <Text className="text-lg font-semibold text-gray-900 mb-3">Active Session</Text>
        <View className="bg-gray-50 border border-gray-200 rounded-xl p-6 items-center justify-center min-h-[120px]">
          <ActivityIndicator color="#10B981" />
        </View>
      </View>
    );
  }

  if (!activeSession) {
    return (
      <View className="mx-6 mt-6">
        <Text className="text-lg font-semibold text-gray-900 mb-3">Active Session</Text>
        <View className="bg-gray-50 border border-gray-200 rounded-xl p-6 items-center justify-center min-h-[120px]">
          <Text className="text-gray-400 text-sm">No active charging sessions</Text>
        </View>
      </View>
    );
  }

  const isCharging = activeSession.is_charging;
  const slotName = activeSession.slots?.name ? getSlotDisplayName(activeSession.slots.name) : 'Charging Bay';
  const formattedEndTime = new Date(activeSession.end_time).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View className="mx-6 mt-6">
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-lg font-semibold text-gray-900">Active Session</Text>
        <TouchableOpacity onPress={fetchActiveSession}>
          <Ionicons name="refresh" size={18} color="#6B7280" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => router.push(`/(root)/live-session?bookingId=${activeSession.id}`)}
        className={`rounded-2xl p-5 border ${
          isCharging 
            ? 'bg-emerald-950 border-emerald-700' 
            : 'bg-zinc-900 border-zinc-800'
        }`}
      >
        <View className="flex-row justify-between items-start mb-4">
          <View>
            <Text className="text-white font-bold text-base">{slotName}</Text>
            <Text className="text-zinc-400 text-xs mt-0.5">Ends at {formattedEndTime}</Text>
          </View>

          <View
            className={`flex-row items-center px-3 py-1 rounded-full gap-1 ${
              isCharging ? 'bg-emerald-500/20' : 'bg-zinc-800'
            }`}
          >
            <Ionicons
              name={isCharging ? 'flash' : 'car'}
              size={12}
              color={isCharging ? '#34D399' : '#A1A1AA'}
            />
            <Text
              className={`text-xs font-semibold ${
                isCharging ? 'text-emerald-400' : 'text-zinc-400'
              }`}
            >
              {isCharging ? 'CHARGING' : 'RESERVED'}
            </Text>
          </View>
        </View>

        <View className="flex-row justify-between items-center pt-2 border-t border-zinc-800/80">
          <View className="flex-row items-baseline gap-1">
            <Text className="text-3xl font-extrabold text-white">
              {activeSession.current_soc ?? 0}%
            </Text>
            <Text className="text-zinc-400 text-xs">Battery SOC</Text>
          </View>

          <View className="flex-row items-center gap-1">
            <Text className="text-white text-xs font-semibold">View Live Stream</Text>
            <Ionicons name="chevron-forward" size={14} color="#FFFFFF" />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}