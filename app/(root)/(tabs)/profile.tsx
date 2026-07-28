import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  ActivityIndicator,
  Image,
  StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/auth-context';
import { authService } from '@/services/auth.service'; 

export default function ProfileScreen() {
  const { profile, user } = useAuth(); 

  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhone(profile.phone || '');
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile?.id) return;
    
    try {
      setIsLoading(true);
      await authService.updateProfile(profile.id, {
        full_name: fullName.trim(),
        phone: phone.trim(),
      });
      
      Alert.alert('Success', 'Your profile has been updated!');
      setIsEditing(false);
      
    } catch (error: any) {
      console.error('Profile update error:', error);
      Alert.alert('Update Failed', error.message || 'Could not update profile.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity 
          onPress={() => isEditing ? handleSave() : setIsEditing(true)}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#3b82f6" />
          ) : (
            <Text style={[styles.headerButtonText, isEditing ? styles.textBlue : styles.textGray]}>
              {isEditing ? 'Save' : 'Edit'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

        <View style={styles.avatarContainer}>
          <Image
            source={{ uri: 'https://th.bing.com/th/id/OIP.cg_7dxSsur0VYIKEWZZtAQHaHa?w=168&h=180&c=7&r=0&o=7&dpr=1.3&pid=1.7&rm=3' }}
            style={styles.avatarImage}
          />
          <Text style={styles.avatarName}>
            {profile?.full_name || 'User'}
          </Text>
        </View>

        <View style={styles.formContainer}>

          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>Email Address</Text>
            <View style={[styles.inputContainer, styles.inputContainerDisabled]}>
              <Ionicons name="mail-outline" size={20} color="#9ca3af" style={styles.icon} />
              <TextInput
                style={[styles.input, styles.inputTextDisabled]}
                value={user?.email || 'Loading...'}
                editable={false} 
              />
              <Ionicons name="lock-closed" size={16} color="#d1d5db" />
            </View>
            <Text style={styles.helperText}>Email cannot be changed here.</Text>
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>Full Name</Text>
            <View style={[styles.inputContainer, isEditing ? styles.inputContainerActive : styles.inputContainerInactive]}>
              <Ionicons name="person-outline" size={20} color={isEditing ? '#3b82f6' : '#9ca3af'} style={styles.icon} />
              <TextInput
                style={[styles.input, isEditing ? styles.inputTextActive : styles.inputTextDisabled]}
                value={fullName}
                onChangeText={setFullName}
                editable={isEditing}
                placeholder="Enter your full name"
              />
            </View>
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>Phone Number</Text>
            <View style={[styles.inputContainer, isEditing ? styles.inputContainerActive : styles.inputContainerInactive]}>
              <Ionicons name="call-outline" size={20} color={isEditing ? '#3b82f6' : '#9ca3af'} style={styles.icon} />
              <TextInput
                style={[styles.input, isEditing ? styles.inputTextActive : styles.inputTextDisabled]}
                value={phone}
                onChangeText={setPhone}
                editable={isEditing}
                keyboardType="phone-pad"
                placeholder="Enter your phone number"
              />
            </View>
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#111827' },
  headerButtonText: { fontSize: 16, fontWeight: '600' },
  textBlue: { color: '#2563EB' },
  textGray: { color: '#6B7280' },
  scrollView: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  avatarContainer: { alignItems: 'center', marginBottom: 32 },
  avatarImage: { width: 96, height: 96, borderRadius: 48, borderWidth: 4, borderColor: '#ffffff', marginBottom: 12 },
  avatarName: { fontSize: 20, fontWeight: 'bold', color: '#111827' },
  formContainer: { marginBottom: 32 },
  fieldWrapper: { marginBottom: 24 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', marginBottom: 8, marginLeft: 4, letterSpacing: 0.5 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 16, borderWidth: 1 },
  inputContainerDisabled: { backgroundColor: '#F3F4F6', borderColor: '#E5E7EB' },
  inputContainerInactive: { backgroundColor: '#ffffff', borderColor: '#E5E7EB' },
  inputContainerActive: { backgroundColor: '#ffffff', borderColor: '#60A5FA', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
  icon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16 },
  inputTextDisabled: { color: '#6B7280' },
  inputTextActive: { color: '#111827' },
  helperText: { fontSize: 12, color: '#9CA3AF', marginTop: 4, marginLeft: 8 }
});