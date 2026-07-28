import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WelcomeHeader from '@/components/WelcomeHeader';
import ActiveSessions from '@/components/ActiveSessions';

export default function Index() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <WelcomeHeader />
      <ActiveSessions />
    </SafeAreaView>
  );
}
