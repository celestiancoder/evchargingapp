// components/ProfileMenu.tsx

import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, Modal, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/auth-context';

export default function ProfileMenu() {
  const [open, setOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    setOpen(false);
    try {
      await signOut();
    } catch (error: any) {
      Alert.alert('Sign Out Failed', error.message || 'An error occurred');
    }
  };

  const handleProfile = () => {
    setOpen(false);
    router.push('/(root)/(tabs)/profile');
  };

  const handleHistory = () => {
    setOpen(false);
    router.push('/(root)/history');
  };

  return (
    <View>
      <TouchableOpacity onPress={() => setOpen(true)}>
        <Image
          source={{ uri: 'https://th.bing.com/th/id/OIP.cg_7dxSsur0VYIKEWZZtAQHaHa?w=168&h=180&c=7&r=0&o=7&dpr=1.3&pid=1.7&rm=3' }}
          className="w-10 h-10 rounded-full border border-gray-200"
        />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1" onPress={() => setOpen(false)}>
          <View className="absolute top-16 right-4 bg-white rounded-xl shadow-lg w-48 py-2 border border-gray-100">
            <TouchableOpacity
              onPress={handleProfile}
              className="flex-row items-center px-4 py-3"
            >
              <Ionicons name="person-outline" size={18} color="#374151" />
              <Text className="ml-3 text-gray-800 font-medium">Profile</Text>
            </TouchableOpacity>

            {/* NEW HISTORY BUTTON */}
            <TouchableOpacity
              onPress={handleHistory}
              className="flex-row items-center px-4 py-3"
            >
              <Ionicons name="time-outline" size={18} color="#374151" />
              <Text className="ml-3 text-gray-800 font-medium">Booking History</Text>
            </TouchableOpacity>

            <View className="h-px bg-gray-100 mx-2 my-1" />

            <TouchableOpacity
              onPress={handleLogout}
              className="flex-row items-center px-4 py-3"
            >
              <Ionicons name="log-out-outline" size={18} color="#dc2626" />
              <Text className="ml-3 text-red-600 font-medium">Log Out</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}