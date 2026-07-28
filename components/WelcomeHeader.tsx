import React from 'react';
import { View, Text } from 'react-native';
import { useAuth } from '@/context/auth-context';
import ProfileMenu from './ProfileMenu';

export default function WelcomeHeader() {
  const { profile, user } = useAuth();

  const displayName =
    profile?.full_name || user?.email?.split('@')[0] || 'there';

  return (
    <View className="px-6 pt-3 pb-8">
      <View className="flex-row items-center justify-between">
        <Text className="text-2xl font-black tracking-widest text-black">
          EV
        </Text>

        <ProfileMenu />
      </View>
      <View className="mt-12">
        <Text className="text-base text-zinc-500">
          Welcome back
        </Text>

        <Text className="mt-2 text-4xl font-extrabold text-zinc-900">
          {displayName}
        </Text>
      </View>
    </View>
  );
}