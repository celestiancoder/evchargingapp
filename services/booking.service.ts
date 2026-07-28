import { supabase } from '@/lib/supabase';

export interface BayStatus {
  id: string;
  name: string;
  isAvailable: boolean;
  maxOutputAmps: number;
}

export interface CreateBookingInput {
  vehicleId: string;
  serviceType: string;
  startTime: string; 
  endTime: string;  
  chargeStartTime?: string | null;
  chargeEndTime?: string | null; 
  slotId: string;    
  targetSoc?: number; 
  totalCost: number;
}

export const bookingService = {

async getAllBayStatuses(requestedStartTime: string, requestedEndTime: string): Promise<BayStatus[]> {
  try {
    await supabase.rpc('sync_booking_statuses');
    const { data: allSlots, error: slotError } = await supabase
      .from('slots')
      .select('id, name, max_output_amps')
      .eq('status', 'available');

    if (slotError) throw slotError;
    if (!allSlots) return [];

    const { data: overlappingBookings, error: bookingError } = await supabase
      .from('bookings')
      .select('slot_id')
      .lt('start_time', requestedEndTime)
      .gt('end_time', requestedStartTime)
      .in('status', ['reserved', 'active']);

    if (bookingError) throw bookingError;

    const occupiedSlotIds = overlappingBookings?.map(b => b.slot_id) || [];

    const mappedSlots = allSlots.map(slot => ({
      id: slot.id,
      name: slot.name,
      isAvailable: !occupiedSlotIds.includes(slot.id),
      maxOutputAmps: slot.max_output_amps ?? 2.5,
    }));

    return mappedSlots.sort((a, b) => {
      const numA = parseInt(a.name.match(/\d+/)?.[0] || '0', 10);
      const numB = parseInt(b.name.match(/\d+/)?.[0] || '0', 10);
      return numA - numB;
    });

  } catch (error: any) {
    console.error("Failed to check facility statuses:", error);
    throw new Error("Could not verify bay availabilities.");
  }
},

  async createBooking(input: CreateBookingInput) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('User authentication failed. Please log in again.');
    }
    const now = new Date();
    const startTime = new Date(input.startTime);

   if (startTime.getTime() < now.getTime() - 2 * 60 * 1000) {
    throw new Error("You cannot create a reservation in the past.");
   }

    const { data: vehicleConflicts, error: conflictError } = await supabase
    .from('bookings')
    .select('id')
    .eq('vehicle_id', input.vehicleId)
    .lt('start_time', input.endTime)
    .gt('end_time', input.startTime)
    .in('status', ['reserved', 'active']);

    if (conflictError) {
      console.error('Error checking vehicle availability:', conflictError);
      throw new Error('Could not verify vehicle availability.');
    }

    if (vehicleConflicts && vehicleConflicts.length > 0) {
      throw new Error('This vehicle already has an active or reserved booking during this time slot!');
    }

    const { data, error } = await supabase
      .from('bookings')
      .insert([
        {
          user_id: user.id,
          vehicle_id: input.vehicleId,
          booking_type: input.serviceType, 
          start_time: input.startTime,
          end_time: input.endTime,
          charge_start_time: input.chargeStartTime, 
          charge_end_time: input.chargeEndTime,
          slot_id: input.slotId,           
          target_soc: input.targetSoc,
          status: 'reserved',
          total_cost: input.totalCost
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase booking insert error:', error);
      throw new Error(error.message || 'Failed to complete booking.');
    }

    return data;
  },

async cancelBooking(bookingId: string, slotId: string, finalTotalCost?: number) {
  const updatePayload: {
  status: string;
  is_charging: boolean;
  total_cost?: number;
  } = {
  status: 'cancelled',
  is_charging: false,
};

  if (finalTotalCost !== undefined) {
    updatePayload.total_cost = finalTotalCost;
  }

  const { data, error } = await supabase
    .from('bookings')
    .update(updatePayload)
    .eq('id', bookingId)
    .select()
    .single();

  if (error) {
    console.error('Error cancelling booking:', error);
    throw new Error(error.message || 'Failed to cancel reservation.');
  }

  if (slotId) {
    const { error: slotError } = await supabase
      .from('slots')
      .update({ status: 'available' })
      .eq('id', slotId);

    if (slotError) {
      console.error('Failed to update slot status:', slotError);
    }
  }

  return data;
}
};