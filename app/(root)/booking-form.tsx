import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  ScrollView, 
  TouchableOpacity, 
  KeyboardAvoidingView, 
  Platform,
  Modal,
  Alert,
  ActivityIndicator,
  Switch 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { vehicleService } from '@/services/vehicle.service';
import { Vehicle } from '@/services/vehicle.service';
import { getStationById } from '@/config/stations';

const isValidTimeString = (value: string): boolean => {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  return !!match;
};

const EV_PRESETS = [
  { name: 'Tesla Model Y', capacityMah: 5000 },
  { name: 'Tata Nexon EV', capacityMah: 4000 },
  { name: 'Nissan Leaf', capacityMah: 3000 },
];

export default function BookingFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const serviceType = params.serviceType;
  const stationId = params.stationId as string;
  const station = getStationById(stationId);
  const isCharging = serviceType === 'charging';

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [isLoadingVehicles, setIsLoadingVehicles] = useState(true);
  const [isSubmittingVehicle, setIsSubmittingVehicle] = useState(false);

  const [arrivalTime, setArrivalTime] = useState('14:00');
  const [departureTime, setDepartureTime] = useState('17:00');
  const [currentSoc, setCurrentSoc] = useState('10');
  const [targetSoc, setTargetSoc] = useState('80');
  const [newBatteryCapacity, setNewBatteryCapacity] = useState('2200');

  const [enableV2G, setEnableV2G] = useState(false);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newMakeModel, setNewMakeModel] = useState('');
  const [newLicensePlate, setNewLicensePlate] = useState('');
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number | 'custom'>('custom');

  React.useEffect(() => {
    fetchUserVehicles();
  }, []);

  const fetchUserVehicles = async () => {
    try {
      setIsLoadingVehicles(true);
      const data = await vehicleService.getVehicles();
      if (data && data.length > 0) {
        setVehicles(data);
        setSelectedVehicleId(data[0].id);
      } else {
        setVehicles([]);
      }
    } catch (error: any) {
      console.error('Error fetching vehicles:', error);
      Alert.alert('Database Error', error.message || 'Could not load your vehicles.');
    } finally {
      setIsLoadingVehicles(false);
    }
  };

  const handleSelectPreset = (index: number | 'custom') => {
    setSelectedPresetIndex(index);
    if (index === 'custom') {
      setNewMakeModel('');
      setNewBatteryCapacity('2200');
    } else {
      const preset = EV_PRESETS[index];
      setNewMakeModel(preset.name);
      setNewBatteryCapacity(preset.capacityMah.toString());
    }
  };

  const resetVehicleForm = () => {
    setNewMakeModel('');
    setNewLicensePlate('');
    setNewBatteryCapacity('2200');
    setSelectedPresetIndex('custom');
  };

  const handleSaveVehicle = async () => {
    if (!newMakeModel || !newLicensePlate) {
      Alert.alert('Missing info', 'Please fill in both fields.');
      return;
    }
    try {
      setIsSubmittingVehicle(true);
      const capacityNum = Number(newBatteryCapacity) || 2200;
      const data = await vehicleService.addVehicle(newMakeModel, newLicensePlate, capacityNum);

      if (data) {
        const addedVehicle = {
          id: data.id,
          make_model: data.make_model,
          license_plate: data.license_plate,
          battery_capacity_mah: data.battery_capacity_mah,
        };
        setVehicles([addedVehicle, ...vehicles]);
        setSelectedVehicleId(data.id);
      }

      resetVehicleForm();
      setIsModalVisible(false);
      Alert.alert('Success', 'Vehicle registered successfully!');
    } catch (error: any) {
      console.error('Error saving vehicle:', error);
      Alert.alert('Submission Failed', error.message || 'Unable to register vehicle.');
    } finally {
      setIsSubmittingVehicle(false);
    }
  };

  const handleFindSlots = () => {
    if (!selectedVehicleId) {
      Alert.alert('Hold on', 'Please add and select a vehicle first.');
      return;
    }

    if (!isValidTimeString(arrivalTime) || !isValidTimeString(departureTime)) {
      Alert.alert('Invalid time', 'Please enter time in 24h HH:mm format, e.g. 14:00.');
      return;
    }

    if (departureTime <= arrivalTime) {
      Alert.alert('Check your times', 'Departure must be after arrival.');
      return;
    }

    if (isCharging) {
      if (!currentSoc || !targetSoc) {
        Alert.alert('Hold on', 'Please enter your current and target battery percentages.');
        return;
      }
      if (Number(targetSoc) <= Number(currentSoc)) {
        Alert.alert('Check your battery %', 'Target charge should be higher than current charge.');
        return;
      }
    }

    const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

    router.push({
      pathname: '/booking-results',
      params: {
        serviceType,
        stationId,
        vehicleId: selectedVehicleId,
        batteryCapacityMah: selectedVehicle?.battery_capacity_mah || 2200,
        arrivalTime,
        departureTime,
        currentSoc,
        targetSoc,
        enableV2G: (isCharging && enableV2G).toString()
      }
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center px-6 py-4 border-b border-gray-100">
        <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1">
          <Ionicons name="arrow-back" size={24} color="#374151" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-bold text-gray-900" numberOfLines={1}>
            {station ? `${isCharging ? 'Charging' : 'Parking'} at ${station.name}` : (isCharging ? 'Charge & Park' : 'Parking Only')}
          </Text>
          <Text className="text-xs text-gray-400 mt-0.5" numberOfLines={1}>
            {station ? station.address : 'Fill in your booking details'}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>

          <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Select Vehicle
          </Text>

          <View className="mb-8">
            {isLoadingVehicles ? (
              <View className="py-6 items-start">
                <ActivityIndicator color="#2563eb" />
              </View>
            ) : vehicles.length === 0 ? (
              <TouchableOpacity
                onPress={() => setIsModalVisible(true)}
                className="border-2 border-dashed border-blue-300 bg-blue-50 rounded-2xl p-5 flex-row items-center"
                activeOpacity={0.7}
              >
                <View className="bg-white p-2.5 rounded-full mr-3 shadow-sm">
                  <Ionicons name="add" size={20} color="#3b82f6" />
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-gray-900">Add your first vehicle</Text>
                  <Text className="text-xs text-gray-500 mt-0.5">Needed to complete your booking</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#3b82f6" />
              </TouchableOpacity>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {vehicles.map((vehicle) => {
                  const selected = selectedVehicleId === vehicle.id;
                  return (
                    <TouchableOpacity
                      key={vehicle.id}
                      onPress={() => setSelectedVehicleId(vehicle.id)}
                      activeOpacity={0.7}
                      className={`mr-3 p-4 rounded-2xl border-2 ${
                        selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                      }`}
                      style={{ width: 160 }}
                    >
                      <View className="flex-row items-center justify-between mb-2">
                        <Ionicons
                          name="car-sport"
                          size={24}
                          color={selected ? '#3b82f6' : '#9ca3af'}
                        />
                      </View>
                      <Text className="font-bold text-gray-900" numberOfLines={1}>{vehicle.make_model}</Text>
                      <Text className="text-xs text-gray-500 mt-1">{vehicle.license_plate}</Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  onPress={() => setIsModalVisible(true)}
                  activeOpacity={0.7}
                  className="mr-6 p-4 rounded-2xl border-2 border-dashed border-gray-300 items-center justify-center"
                  style={{ width: 100 }}
                >
                  <View className="bg-blue-50 p-2 rounded-full mb-2">
                    <Ionicons name="add" size={20} color="#3b82f6" />
                  </View>
                  <Text className="text-xs font-medium text-gray-600">Add New</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>

          <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Time Window
          </Text>
          <View className="flex-row mb-2" style={{ gap: 16 }}>
            <View className="flex-1">
              <Text className="text-xs text-gray-500 mb-1">Arrival Time (24h)</Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-lg font-medium text-gray-900"
                value={arrivalTime}
                onChangeText={setArrivalTime}
                keyboardType="numbers-and-punctuation"
                placeholder="14:00"
                maxLength={5}
              />
            </View>
            <View className="flex-1">
              <Text className="text-xs text-gray-500 mb-1">Departure Time (24h)</Text>
              <TextInput
                className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-lg font-medium text-gray-900"
                value={departureTime}
                onChangeText={setDepartureTime}
                keyboardType="numbers-and-punctuation"
                placeholder="17:00"
                maxLength={5}
              />
            </View>
          </View>
          <Text className="text-xs text-gray-400 mb-8">Use 24-hour format, e.g. 09:30 or 17:45</Text>

          {isCharging && (
            <View>
              <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Battery Details
              </Text>
              <View className="flex-row mb-2" style={{ gap: 16 }}>
                <View className="flex-1">
                  <Text className="text-xs text-gray-500 mb-1">Current SOC (%)</Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-lg font-medium text-gray-900"
                    value={currentSoc}
                    onChangeText={setCurrentSoc}
                    keyboardType="numeric"
                    placeholder="e.g. 20"
                    maxLength={3}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-xs text-gray-500 mb-1">Target SOC (%)</Text>
                  <TextInput
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-lg font-medium text-gray-900"
                    value={targetSoc}
                    onChangeText={setTargetSoc}
                    keyboardType="numeric"
                    placeholder="e.g. 80"
                    maxLength={3}
                  />
                </View>
              </View>
              <Text className="text-xs text-gray-400 mb-6">
                We'll estimate charging time based on this range
              </Text>

              <View className="mb-8 bg-blue-50/60 border border-blue-200 rounded-2xl p-4 flex-row items-center justify-between">
                <View className="flex-1 mr-3">
                  <View className="flex-row items-center mb-1">
                    <Text className="font-bold text-gray-900 text-base">Enable V2G Optimization</Text>
                  </View>
                  <Text className="text-xs text-gray-500 leading-4">
                    Allows your EV to sell power back during peak hours to cut your total cost.
                  </Text>
                </View>
                <Switch
                  value={enableV2G}
                  onValueChange={setEnableV2G}
                  trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
                  thumbColor={enableV2G ? '#ffffff' : '#f4f3f4'}
                />
              </View>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      <View className="px-6 py-4 border-t border-gray-100 bg-white">
        <TouchableOpacity
          onPress={handleFindSlots}
          className="bg-black rounded-2xl py-4 items-center"
          activeOpacity={0.8}
        >
          <Text className="text-white text-lg font-bold">Find Best Slots</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white rounded-t-3xl p-6 shadow-xl" style={{ maxHeight: '85%' }}>

            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-2xl font-bold text-gray-900">Add Vehicle</Text>
              <TouchableOpacity
                disabled={isSubmittingVehicle}
                onPress={() => { setIsModalVisible(false); resetVehicleForm(); }}
                className="bg-gray-100 p-2 rounded-full"
              >
                <Ionicons name="close" size={22} color="#4b5563" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} className="mb-6">
              <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2.5">
                Select EV Preset
              </Text>
              <View className="flex-row flex-wrap gap-2.5 mb-5">
                {EV_PRESETS.map((preset, idx) => {
                  const isSelected = selectedPresetIndex === idx;
                  return (
                    <TouchableOpacity
                      key={preset.name}
                      disabled={isSubmittingVehicle}
                      onPress={() => handleSelectPreset(idx)}
                      className={`px-4 py-3 rounded-2xl border-2 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-zinc-200 bg-white'
                      }`}
                      activeOpacity={0.7}
                    >
                      <Text
                        className={`font-semibold text-xs ${
                          isSelected ? 'text-blue-600' : 'text-gray-700'
                        }`}
                      >
                        {preset.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  disabled={isSubmittingVehicle}
                  onPress={() => handleSelectPreset('custom')}
                  className={`px-4 py-3 rounded-2xl border-2 ${
                    selectedPresetIndex === 'custom'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-zinc-200 bg-white'
                  }`}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`font-semibold text-xs ${
                      selectedPresetIndex === 'custom' ? 'text-blue-600' : 'text-gray-700'
                    }`}
                  >
                    Custom EV
                  </Text>
                </TouchableOpacity>
              </View>

              <View className="mb-4">
                <Text className="text-sm text-gray-500 mb-2 font-medium">Make & Model</Text>
                <TextInput
                  className={`bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base text-gray-900 ${
                    selectedPresetIndex !== 'custom' ? 'text-gray-500' : ''
                  }`}
                  placeholder="e.g. Tata Nexon EV"
                  value={newMakeModel}
                  onChangeText={setNewMakeModel}
                  editable={!isSubmittingVehicle && selectedPresetIndex === 'custom'}
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm text-gray-500 mb-2 font-medium">License Plate Number</Text>
                <TextInput
                  className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base text-gray-900 uppercase"
                  placeholder="e.g. MH-46-XY-1234"
                  value={newLicensePlate}
                  onChangeText={setNewLicensePlate}
                  autoCapitalize="characters"
                  editable={!isSubmittingVehicle}
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm text-gray-500 mb-2 font-medium">Battery Capacity (mAh)</Text>
                <TextInput
                  className={`bg-gray-50 border border-gray-200 rounded-xl px-4 py-4 text-base text-gray-900 ${
                    selectedPresetIndex !== 'custom' ? 'text-gray-500' : ''
                  }`}
                  placeholder="e.g. 2200"
                  value={newBatteryCapacity}
                  onChangeText={setNewBatteryCapacity}
                  keyboardType="numeric"
                  editable={!isSubmittingVehicle && selectedPresetIndex === 'custom'}
                />
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={handleSaveVehicle}
              disabled={isSubmittingVehicle}
              className="bg-blue-600 rounded-2xl py-4 items-center flex-row justify-center"
              style={{ gap: 8 }}
            >
              {isSubmittingVehicle && <ActivityIndicator color="white" size="small" />}
              <Text className="text-white text-lg font-bold">
                {isSubmittingVehicle ? 'Saving...' : 'Save Vehicle'}
              </Text>
            </TouchableOpacity>

          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}