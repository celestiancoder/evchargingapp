import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Pressable
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { vehicleService, Vehicle } from '@/services/vehicle.service';

interface EvPreset {
  name: string;
  capacityMah: number;
}

const EV_PRESETS: EvPreset[] = [
  { name: 'Tesla Model Y', capacityMah: 5000 },
  { name: 'Tata Nexon EV', capacityMah: 4000 },
  { name: 'Nissan Leaf', capacityMah: 3000 },
];

export default function VehiclesScreen() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form State
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [makeModel, setMakeModel] = useState<string>('');
  const [licensePlate, setLicensePlate] = useState<string>('');
  const [batteryCapacity, setBatteryCapacity] = useState<string>('2200');
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number | 'custom'>('custom');

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const data = await vehicleService.getVehicles();
      setVehicles(data);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error', err.message || 'Could not load your vehicles.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPreset = (index: number | 'custom') => {
    setSelectedPresetIndex(index);
    if (index === 'custom') {
      setMakeModel('');
      setBatteryCapacity('2200');
    } else {
      const preset = EV_PRESETS[index];
      setMakeModel(preset.name);
      setBatteryCapacity(preset.capacityMah.toString());
    }
  };

  const openAddModal = () => {
    setEditingVehicleId(null);
    setMakeModel('');
    setLicensePlate('');
    setBatteryCapacity('2200');
    setSelectedPresetIndex('custom');
    setIsModalOpen(true);
  };

  const openEditModal = (vehicle: Vehicle) => {
    setEditingVehicleId(vehicle.id);
    setMakeModel(vehicle.make_model);
    setLicensePlate(vehicle.license_plate);
    setBatteryCapacity(vehicle.battery_capacity_mah.toString());

    // Check if it matches a preset
    const presetIdx = EV_PRESETS.findIndex(
      (p) => p.name.toLowerCase() === vehicle.make_model.toLowerCase()
    );
    if (presetIdx !== -1 && EV_PRESETS[presetIdx].capacityMah === vehicle.battery_capacity_mah) {
      setSelectedPresetIndex(presetIdx);
    } else {
      setSelectedPresetIndex('custom');
    }
    setIsModalOpen(true);
  };

  const handleSaveVehicle = async () => {
    if (!makeModel.trim() || !licensePlate.trim()) {
      Alert.alert('Missing Info', 'Please enter make/model and license plate.');
      return;
    }

    const capacityNum = Number(batteryCapacity);
    if (isNaN(capacityNum) || capacityNum <= 0) {
      Alert.alert('Invalid Capacity', 'Please enter a valid battery capacity in mAh.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingVehicleId) {
        // Edit flow
        await vehicleService.updateVehicle(editingVehicleId, {
          make_model: makeModel.trim(),
          license_plate: licensePlate.trim().toUpperCase(),
          battery_capacity_mah: capacityNum,
        });
        Alert.alert('Success', 'Vehicle updated successfully!');
      } else {
        // Add flow
        await vehicleService.addVehicle(
          makeModel.trim(),
          licensePlate.trim().toUpperCase(),
          capacityNum
        );
        Alert.alert('Success', 'Vehicle added successfully!');
      }
      setIsModalOpen(false);
      fetchVehicles();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save vehicle details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteVehicle = (vehicle: Vehicle) => {
    Alert.alert(
      'Delete Vehicle',
      `Are you sure you want to remove your ${vehicle.make_model}? This will delete all active reservations and history linked to this vehicle.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await vehicleService.deleteVehicle(vehicle.id);
              Alert.alert('Deleted', 'Vehicle removed successfully.');
              fetchVehicles();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Could not delete vehicle.');
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const renderVehicleItem = ({ item }: { item: Vehicle }) => {
    return (
      <View className="bg-white border border-gray-200 rounded-3xl p-5 mb-4 shadow-sm flex-row justify-between items-center">
        <View className="flex-1 mr-4">
          <View className="flex-row items-center mb-1">
            <Ionicons name="car-sport" size={20} color="#1F2937" />
            <Text className="font-bold text-gray-900 text-lg ml-2">{item.make_model}</Text>
          </View>
          <View className="flex-row items-center gap-2.5 mt-2">
            <View className="bg-gray-100 px-3 py-1.5 rounded-xl border border-gray-200">
              <Text className="text-gray-700 font-bold text-xs uppercase tracking-wider">
                {item.license_plate}
              </Text>
            </View>
            <Text className="text-zinc-500 text-xs font-semibold">
              {item.battery_capacity_mah} mAh Battery
            </Text>
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => openEditModal(item)}
            className="w-10 h-10 bg-zinc-100 rounded-full items-center justify-center border border-zinc-200"
            activeOpacity={0.7}
          >
            <Ionicons name="pencil" size={16} color="#374151" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDeleteVehicle(item)}
            className="w-10 h-10 bg-red-50 rounded-full items-center justify-center border border-red-100"
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-zinc-50" edges={['top']}>
      {/* Header */}
      <View className="bg-white px-6 py-4 border-b border-zinc-200 flex-row items-center justify-between">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-zinc-900">My Vehicles</Text>
        <TouchableOpacity onPress={openAddModal} className="p-1">
          <Ionicons name="add" size={24} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      {/* Main List */}
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={vehicles}
          keyExtractor={(item) => item.id}
          renderItem={renderVehicleItem}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: 100 }}
          ListEmptyComponent={
            <View className="items-center justify-center mt-20 p-6 bg-white border border-dashed border-gray-300 rounded-3xl">
              <Ionicons name="car-outline" size={48} color="#9CA3AF" />
              <Text className="text-gray-500 font-bold text-base mt-4">No Vehicles Found</Text>
              <Text className="text-gray-400 text-xs text-center mt-1">
                Add a vehicle to enable charging or parking reservations
              </Text>
              <TouchableOpacity
                onPress={openAddModal}
                className="bg-blue-600 px-5 py-3 rounded-2xl mt-5 shadow-sm"
              >
                <Text className="text-white font-bold text-sm">Add Vehicle</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      {/* Bottom Floating Add Button */}
      {!loading && vehicles.length > 0 && (
        <View className="absolute bottom-6 left-6 right-6">
          <TouchableOpacity
            onPress={openAddModal}
            className="bg-black rounded-2xl py-4 flex-row items-center justify-center shadow-lg"
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={20} color="white" />
            <Text className="text-white text-base font-bold ml-2">Add New Vehicle</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Add / Edit Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent={true}>
        <View className="flex-1 justify-end bg-black/50">
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="w-full"
          >
            <View className="bg-white rounded-t-[32px] p-6 shadow-xl max-h-[85vh]">
              {/* Header */}
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-2xl font-bold text-gray-900">
                  {editingVehicleId ? 'Edit Vehicle' : 'Add Vehicle'}
                </Text>
                <TouchableOpacity
                  disabled={isSubmitting}
                  onPress={() => setIsModalOpen(false)}
                  className="bg-gray-100 p-2 rounded-full"
                >
                  <Ionicons name="close" size={22} color="#4b5563" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} className="mb-6">
                {/* EV Model Presets */}
                <Text className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2.5">
                  Select EV Preset
                </Text>
                <View className="flex-row flex-wrap gap-2.5 mb-5">
                  {EV_PRESETS.map((preset, idx) => {
                    const isSelected = selectedPresetIndex === idx;
                    return (
                      <TouchableOpacity
                        key={preset.name}
                        disabled={isSubmitting}
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
                    disabled={isSubmitting}
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

                {/* Make & Model */}
                <View className="mb-4">
                  <Text className="text-sm text-gray-500 mb-2 font-medium">Make & Model</Text>
                  <TextInput
                    className={`bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-4 text-base text-gray-900 ${
                      selectedPresetIndex !== 'custom' ? 'text-gray-500' : ''
                    }`}
                    placeholder="e.g. Tata Nexon EV"
                    value={makeModel}
                    onChangeText={setMakeModel}
                    editable={!isSubmitting && selectedPresetIndex === 'custom'}
                  />
                </View>

                {/* License Plate */}
                <View className="mb-4">
                  <Text className="text-sm text-gray-500 mb-2 font-medium">License Plate Number</Text>
                  <TextInput
                    className="bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-4 text-base text-gray-900 uppercase"
                    placeholder="e.g. MH-46-XY-1234"
                    value={licensePlate}
                    onChangeText={setLicensePlate}
                    autoCapitalize="characters"
                    editable={!isSubmitting}
                  />
                </View>

                {/* Battery Capacity */}
                <View className="mb-2">
                  <Text className="text-sm text-gray-500 mb-2 font-medium">Battery Capacity (mAh)</Text>
                  <TextInput
                    className={`bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-4 text-base text-gray-900 ${
                      selectedPresetIndex !== 'custom' ? 'text-gray-500' : ''
                    }`}
                    placeholder="e.g. 2200"
                    value={batteryCapacity}
                    onChangeText={setBatteryCapacity}
                    keyboardType="numeric"
                    editable={!isSubmitting && selectedPresetIndex === 'custom'}
                  />
                </View>
                <Text className="text-xs text-gray-400 mb-6">
                  Pre-populated values default to typical mock charging scales.
                </Text>
              </ScrollView>

              {/* Submit Buttons */}
              <TouchableOpacity
                onPress={handleSaveVehicle}
                disabled={isSubmitting}
                className="bg-black rounded-2xl py-4 items-center flex-row justify-center"
                style={{ gap: 8 }}
                activeOpacity={0.8}
              >
                {isSubmitting && <ActivityIndicator color="white" size="small" />}
                <Text className="text-white text-base font-bold">
                  {isSubmitting ? 'Saving...' : editingVehicleId ? 'Save Changes' : 'Save Vehicle'}
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
