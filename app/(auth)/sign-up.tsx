import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  Keyboard, 
  Pressable,
  KeyboardAvoidingView, 
  ScrollView,           
  Platform             
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/auth-context';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword || !name) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, name);
      Alert.alert(
        'Success', 
        'Account created successfully!',
        [{ text: 'OK', onPress: () => router.replace('/(root)/(tabs)') }]
      );
    } catch (error: any) {
      Alert.alert('Sign Up Failed', error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            style={{ flex: 1 }}
            className="justify-center px-6 py-8"
            onPress={Keyboard.dismiss}
          >
            <View className="space-y-4">
              <View className="mb-8">
                <Text className="text-3xl font-bold text-gray-900 text-center">Create Account</Text>
                <Text className="text-gray-500 mt-2 text-center">Sign up to get started</Text>
              </View>

              <View>
                <Text className="text-gray-700 font-medium mb-2">Email Address</Text>
                <TextInput
                  className="w-full h-12 px-4 border border-gray-300 rounded-lg text-gray-900 focus:border-blue-500"
                  placeholder="email@example.com"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View className="mt-4">
                <Text className="text-gray-700 font-medium mb-2">Full Name</Text>
                <TextInput
                  className="w-full h-12 px-4 border border-gray-300 rounded-lg text-gray-900 focus:border-blue-500"
                  placeholder="John Doe"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="none"
                />
              </View>

              <View className="mt-4">
                <Text className="text-gray-700 font-medium mb-2">Password</Text>
                <TextInput
                  className="w-full h-12 px-4 border border-gray-300 rounded-lg text-gray-900 focus:border-blue-500"
                  placeholder="••••••••"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <View className="mt-4">
                <Text className="text-gray-700 font-medium mb-2">Confirm Password</Text>
                <TextInput
                  className="w-full h-12 px-4 border border-gray-300 rounded-lg text-gray-900 focus:border-blue-500"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                onPress={handleSignUp}
                disabled={loading}
                className="w-full h-12 bg-black rounded-lg items-center justify-center mt-6"
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-semibold text-lg">Sign Up</Text>
                )}
              </TouchableOpacity>

              <View className="flex-row justify-center mt-6">
                <Text className="text-gray-600">Already have an account? </Text>
                <Link href="/(auth)/sign-in" asChild>
                  <TouchableOpacity>
                    <Text className="text-blue-600 font-semibold">Sign In</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
