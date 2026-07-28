import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function BookingScreen() {
  const router = useRouter();

  const navigateToForm = (type: 'charging' | 'parking') => {
    router.push({
      pathname: '/booking-form',
      params: { serviceType: type },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-6">

        <View className="mb-10">
          <Text className="text-3xl font-extrabold tracking-tight text-zinc-900">
            Book a slot
          </Text>

          <Text className="text-base leading-6 text-zinc-500">
            Choose the service you'd like to reserve.
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigateToForm('charging')}
          className="mb-6 flex-row items-center rounded-3xl border border-zinc-200 p-6"
        >
          <View className="mr-5 h-16 w-16 items-center justify-center rounded-2xl bg-black">
            <Ionicons name="flash" size={28} color="white" />
          </View>

          <View className="flex-1">
            <Text className="text-xl font-bold text-zinc-900">
              EV Charging
            </Text>

            <Text className="mt-2 text-sm leading-5 text-zinc-500">
              Reserve a charging bay. Parking is included for the duration of
              your session.
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            color="#A1A1AA"
          />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => navigateToForm('parking')}
          className="flex-row items-center rounded-3xl border border-zinc-200 bg-white p-6"
        >
          <View className="mr-5 h-16 w-16 items-center justify-center rounded-2xl bg-zinc-200">
            <Ionicons name="car" size={28} color="#18181B" />
          </View>

          <View className="flex-1">
            <Text className="text-xl font-bold text-zinc-900">
              Parking Only
            </Text>

            <Text className="mt-2 text-sm leading-5 text-zinc-500">
              Reserve a parking space without charging.
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={20}
            color="#A1A1AA"
          />
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}