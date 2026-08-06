import { DAILY_PRICING_GRID, DAILY_PARKING_GRID } from '@/config/pricing';

export interface BookingResult {
  startTime: string;      
  endTime: string;        
  chargeStartTime?: string; 
  chargeEndTime?: string;   
  chargingCost: number;
  parkingCost: number;
  totalCost: number;
  achievedSoc?: number;
  isPartial?: boolean;
  chargingMinutesNeeded?: number;
  serviceType: 'charging' | 'parking';
  isV2G?: boolean;
  dischargeStartTime?: string;
  dischargeEndTime?: string;
  v2gRevenue?: number;
  v2gProfit?: number;
  extraV2GMinutes?: number;
}

export const chargingAlgorithm = {
  
  timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  },

  minutesToTime(minutes: number): string {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
  },

  getMinuteByMinutePrices(grid: number[]): number[] {
    const minutePrices = new Array(1440).fill(0);
    for (let i = 0; i < 48; i++) {
      const pricePerMinute = grid[i] / 30; 
      for (let m = 0; m < 30; m++) {
        minutePrices[i * 30 + m] = pricePerMinute;
      }
    }
    return minutePrices;
  },

  calculateParkingOnly(arrivalTime: string, departureTime: string): BookingResult {
    const arrivalMin = this.timeToMinutes(arrivalTime);
    const departureMin = this.timeToMinutes(departureTime);
    const parkingMinutePrices = this.getMinuteByMinutePrices(DAILY_PARKING_GRID);
    
    let totalCost = 0;
    for (let i = arrivalMin; i < departureMin; i++) {
      totalCost += parkingMinutePrices[i];
    }

    return {
      serviceType: 'parking',
      startTime: arrivalTime,
      endTime: departureTime,
      chargingCost: 0,
      parkingCost: Number(totalCost.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2))
    };
  },

  calculateChargeAndPark(
    arrivalTime: string, 
    departureTime: string, 
    currentSoc: number, 
    targetSoc: number,
    maxOutputAmps: number = 2.5,
    batteryCapacityMah: number = 2200
  ): BookingResult {
    const BATTERY_CAPACITY_MAH = batteryCapacityMah;
    const CHARGER_SPEED_MAH_PER_HOUR = maxOutputAmps * 1000;

    const arrivalMin = this.timeToMinutes(arrivalTime);
    const departureMin = this.timeToMinutes(departureTime);
    const availableParkTime = departureMin - arrivalMin;

    const socNeeded = targetSoc - currentSoc;
    const mahNeeded = (socNeeded / 100) * BATTERY_CAPACITY_MAH;
    let minutesNeeded = Math.ceil((mahNeeded / CHARGER_SPEED_MAH_PER_HOUR) * 60);

    let achievedSoc = targetSoc;
    let isPartial = false;

    if (minutesNeeded > availableParkTime) {
      minutesNeeded = availableParkTime;
      const achievableMah = (minutesNeeded / 60) * CHARGER_SPEED_MAH_PER_HOUR;
      achievedSoc = Math.min(100, Math.floor(currentSoc + (achievableMah / BATTERY_CAPACITY_MAH) * 100));
      isPartial = true;
    }

    const chargingMinutePrices = this.getMinuteByMinutePrices(DAILY_PRICING_GRID);
    const parkingMinutePrices = this.getMinuteByMinutePrices(DAILY_PARKING_GRID);

    // const deltaMinutePrices = chargingMinutePrices.map((chargePrice, idx) => chargePrice - parkingMinutePrices[idx]);
    const chargePrefix = new Array(1441).fill(0);
    for (let i = 0; i < 1440; i++) {
      chargePrefix[i + 1] = chargePrefix[i] + chargingMinutePrices[i];
    }

    const getChargeRangeCost = (start: number, end: number): number =>{
      return chargePrefix[end] - chargePrefix[start];
    }
       
    let bestStartMin = arrivalMin;
    let lowestChargeCost = Number.POSITIVE_INFINITY;

    for (let start = arrivalMin; start <= departureMin - minutesNeeded; start++) {
      const end = start + minutesNeeded;
      const chargeCost = getChargeRangeCost(start, end);

      if (chargeCost < lowestChargeCost) {
        lowestChargeCost = chargeCost;
        bestStartMin = start;
      }
    }

    // let currentWindowDeltaSum = 0;
    // for (let i = arrivalMin; i < arrivalMin + minutesNeeded; i++) {
    //   currentWindowDeltaSum += deltaMinutePrices[i];
    // }
    
    // let minDeltaCost = currentWindowDeltaSum;
    // let bestStartMin = arrivalMin;

    // for (let i = arrivalMin + 1; i <= departureMin - minutesNeeded; i++) {
    //   currentWindowDeltaSum = currentWindowDeltaSum - deltaMinutePrices[i - 1] + deltaMinutePrices[i + minutesNeeded - 1];
    //   if (currentWindowDeltaSum < minDeltaCost) {
    //     minDeltaCost = currentWindowDeltaSum;
    //     bestStartMin = i;
    //   }
    // }

    const bestEndMin = bestStartMin + minutesNeeded;

    // let finalChargingCost = 0;
    // let finalIdleParkingCost = 0;

    let finalChargingCost = 0;
    for (let i = bestStartMin; i < bestEndMin; i++) {
      finalChargingCost += chargingMinutePrices[i];
    }

    let finalIdleParkingCost = 0;
    for (let i = arrivalMin; i < departureMin; i++) {
      finalIdleParkingCost += parkingMinutePrices[i];
    }

    // for (let i = arrivalMin; i < departureMin; i++) {
    //   if (i >= bestStartMin && i < bestEndMin) {
    //     finalChargingCost += chargingMinutePrices[i];
    //   } 
    //   finalIdleParkingCost += parkingMinutePrices[i];
    // }

    const totalCombinedCost = finalChargingCost + finalIdleParkingCost;

    return {
      serviceType: 'charging',
      startTime: arrivalTime,
      endTime: departureTime,
      chargeStartTime: this.minutesToTime(bestStartMin),
      chargeEndTime: this.minutesToTime(bestEndMin),
      chargingCost: Number(finalChargingCost.toFixed(2)),
      parkingCost: Number(finalIdleParkingCost.toFixed(2)),
      totalCost: Number(totalCombinedCost.toFixed(2)),
      achievedSoc,
      isPartial,
      chargingMinutesNeeded: minutesNeeded
    };
  },
  calculateEarlyCancellation(
  startTime: string,
  endTime: string,
  chargeStartTime: string | undefined,
  chargeEndTime: string | undefined,
  cancelTime: string, // Format "HH:MM"
  originalTotalCost: number,
  serviceType: 'charging' | 'parking'
) {
  const startMin = this.timeToMinutes(startTime);
  const endMin = this.timeToMinutes(endTime);
  let cancelMin = this.timeToMinutes(cancelTime);

  if (cancelMin <= startMin) {
    return {
      isPreStart: true,
      elapsedMinutes: 0,
      chargingCost: 0,
      parkingCost: 0,
      finalTotalCost: 0,
      refundAmount: originalTotalCost,
    };
  }

  if (cancelMin > endMin) cancelMin = endMin;

  const elapsedMinutes = cancelMin - startMin;
  const chargingPrices = this.getMinuteByMinutePrices(DAILY_PRICING_GRID);
  const parkingPrices = this.getMinuteByMinutePrices(DAILY_PARKING_GRID);

  let finalChargingCost = 0;
  let finalParkingCost = 0;

  const chargeStartMin = chargeStartTime ? this.timeToMinutes(chargeStartTime) : -1;
  const chargeEndMin = chargeEndTime ? this.timeToMinutes(chargeEndTime) : -1;

  for (let m = startMin; m < cancelMin; m++) {
    if (serviceType === 'charging' && m >= chargeStartMin && m < chargeEndMin) {
      finalChargingCost += chargingPrices[m];
    } 
    finalParkingCost += parkingPrices[m];
  }

  const finalTotalCost = Number((finalChargingCost + finalParkingCost).toFixed(2));
  const refundAmount = Number(Math.max(0, originalTotalCost - finalTotalCost).toFixed(2));

  return {
    isPreStart: false,
    elapsedMinutes,
    chargingCost: Number(finalChargingCost.toFixed(2)),
    parkingCost: Number(finalParkingCost.toFixed(2)),
    finalTotalCost,
    refundAmount,
  };
},
calculateV2GChargeAndPark(
  arrivalTime: string, 
  departureTime: string, 
  currentSoc: number, 
  targetSoc: number,
  maxOutputAmps: number = 2.5,
  batteryCapacityMah: number = 2200,
  enableV2G: boolean = true 
): BookingResult {

  const standardPlan = this.calculateChargeAndPark(
    arrivalTime, departureTime, currentSoc, targetSoc, maxOutputAmps, batteryCapacityMah
  );

  if (!enableV2G || standardPlan.isPartial) {
    return standardPlan;
  }

  const arrivalMin = this.timeToMinutes(arrivalTime);
  const departureMin = this.timeToMinutes(departureTime);
  const availableParkTime = departureMin - arrivalMin;
  const M = standardPlan.chargingMinutesNeeded || 0; 
  
  const CHARGER_SPEED_MAH_PER_HOUR = maxOutputAmps * 1000;
  const maxExtraSoc = 100 - targetSoc;
  const maxExtraMah = (maxExtraSoc / 100) * batteryCapacityMah;
  const maxExtraMinsByBattery = Math.floor((maxExtraMah / CHARGER_SPEED_MAH_PER_HOUR) * 60);
  
  const maxExtraMinsByTime = Math.floor((availableParkTime - M) / 2);
  const xMax = Math.min(maxExtraMinsByBattery, maxExtraMinsByTime);

  if (xMax <= 0) return standardPlan; 

  const chargingPrices = this.getMinuteByMinutePrices(DAILY_PRICING_GRID);
  const parkingPrices = this.getMinuteByMinutePrices(DAILY_PARKING_GRID);

  let totalParkingCost = 0;
  for (let k = arrivalMin; k < departureMin; k++) {
    totalParkingCost += parkingPrices[k];
  }

  const chargePrefix = new Array(1441).fill(0);
  for (let i = 0; i < 1440; i++) {
    chargePrefix[i + 1] = chargePrefix[i] + chargingPrices[i];
  }

  const getRangeCost = (start: number, end: number): number => chargePrefix[end] - chargePrefix[start];

  let bestV2GPlan: BookingResult | null = null;
  let lowestNetCost = standardPlan.totalCost;

  for (let x = 1; x <= xMax; x++) {
    const chargeDuration = M + x;
    const dischargeDuration = x;

    for (let chargeStart = arrivalMin; chargeStart <= departureMin - chargeDuration; chargeStart++) {
      const chargeEnd = chargeStart + chargeDuration;
      const currentChargeCost = getRangeCost(chargeStart, chargeEnd);

      const minDischargeStart = chargeEnd;
      
      for (let dischargeStart = minDischargeStart; dischargeStart <= departureMin - dischargeDuration; dischargeStart++) {
        const dischargeEnd = dischargeStart + dischargeDuration;
        const currentDischargeRevenue = getRangeCost(dischargeStart, dischargeEnd);

        const netCost = (currentChargeCost - currentDischargeRevenue) + totalParkingCost;

        if (netCost < lowestNetCost) {
          lowestNetCost = netCost;
          bestV2GPlan = {
            serviceType: 'charging',
            startTime: arrivalTime,
            endTime: departureTime,
            chargeStartTime: this.minutesToTime(chargeStart),
            chargeEndTime: this.minutesToTime(chargeEnd),
            dischargeStartTime: this.minutesToTime(dischargeStart),
            dischargeEndTime: this.minutesToTime(dischargeEnd),
            chargingCost: Number(currentChargeCost.toFixed(2)),
            parkingCost: Number(totalParkingCost.toFixed(2)),
            totalCost: Number(netCost.toFixed(2)),
            achievedSoc: targetSoc,
            isPartial: false,
            chargingMinutesNeeded: chargeDuration,
            isV2G: true,
            v2gRevenue: Number(currentDischargeRevenue.toFixed(2)),
            v2gProfit: Number((standardPlan.totalCost - netCost).toFixed(2)),
            extraV2GMinutes: x
          };
        }
      }
    }
  }

  return bestV2GPlan ? bestV2GPlan : standardPlan;
}
};