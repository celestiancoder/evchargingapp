import { supabase } from '../lib/supabase';

export interface Vehicle {
  id: string;
  make_model: string;
  license_plate: string;
  battery_capacity_mah: number;
}

export const vehicleService = {
  
  async getVehicles(): Promise<Vehicle[]> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('vehicles')
      .select('id, make_model, license_plate, battery_capacity_mah') 
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async addVehicle(makeModel: string, licensePlate: string, batteryCapacityMah: number=2200) {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('User session not found.');

    const { data, error } = await supabase
      .from('vehicles')
      .insert([
        {
          user_id: user.id,
          make_model: makeModel.trim(),
          license_plate: licensePlate.trim().toUpperCase(),
          battery_capacity_mah: batteryCapacityMah,
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateVehicle(vehicleId: string, updates: Partial<{ make_model: string; license_plate: string; battery_capacity_mah: number }>) {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('User session not found.');

    const payload: Partial<{ make_model: string; license_plate: string; battery_capacity_mah: number }> = {};
    if (updates.make_model !== undefined) payload.make_model = updates.make_model.trim();
    if (updates.license_plate !== undefined) payload.license_plate = updates.license_plate.trim().toUpperCase();
    if (updates.battery_capacity_mah !== undefined) payload.battery_capacity_mah = updates.battery_capacity_mah;

    const { data, error } = await supabase
      .from('vehicles')
      .update(payload)
      .eq('id', vehicleId)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteVehicle(vehicleId: string) {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error('User session not found.');

    const { error } = await supabase
      .from('vehicles')
      .delete()
      .eq('id', vehicleId)
      .eq('user_id', user.id);

    if (error) throw error;
    return true;
  }
};