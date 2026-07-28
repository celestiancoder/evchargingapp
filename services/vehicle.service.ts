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
  }
};