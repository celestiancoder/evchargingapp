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
  v2gData?: {
    v2gEnabled: boolean;
    minBatteryReserve: number;
    energySoldKwh: number;
    avgSellingPrice: number;
    v2gRevenue: number;
    moneySaved: number;
    totalBenefit: number;
    immediateChargingCost: number;
  };
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

    const deltaMinutePrices = chargingMinutePrices.map((chargePrice, idx) => chargePrice - parkingMinutePrices[idx]);

    let currentWindowDeltaSum = 0;
    for (let i = arrivalMin; i < arrivalMin + minutesNeeded; i++) {
      currentWindowDeltaSum += deltaMinutePrices[i];
    }
    
    let minDeltaCost = currentWindowDeltaSum;
    let bestStartMin = arrivalMin;

    for (let i = arrivalMin + 1; i <= departureMin - minutesNeeded; i++) {
      currentWindowDeltaSum = currentWindowDeltaSum - deltaMinutePrices[i - 1] + deltaMinutePrices[i + minutesNeeded - 1];
      if (currentWindowDeltaSum < minDeltaCost) {
        minDeltaCost = currentWindowDeltaSum;
        bestStartMin = i;
      }
    }

    const bestEndMin = bestStartMin + minutesNeeded;

    let finalChargingCost = 0;
    let finalIdleParkingCost = 0;

    for (let i = arrivalMin; i < departureMin; i++) {
      if (i >= bestStartMin && i < bestEndMin) {
        finalChargingCost += chargingMinutePrices[i];
      } else {
        finalIdleParkingCost += parkingMinutePrices[i];
      }
    }

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
    } else {
      finalParkingCost += parkingPrices[m];
    }
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

  calculateV2G(
    arrivalTime: string,
    departureTime: string,
    achievedSoc: number,
    batteryCapacityMah: number,
    minBatteryReserve: number,
    v2gEnabled: boolean,
    chargingCost: number,
    chargingMinutesNeeded: number
  ) {
    const arrivalMin = this.timeToMinutes(arrivalTime);
    const departureMin = this.timeToMinutes(departureTime);

    // Calculate immediate charging cost
    const chargingMinutePrices = this.getMinuteByMinutePrices(DAILY_PRICING_GRID);
    let immediateChargingCost = 0;
    for (let i = arrivalMin; i < arrivalMin + chargingMinutesNeeded; i++) {
      immediateChargingCost += chargingMinutePrices[i % 1440];
    }
    immediateChargingCost = Number(immediateChargingCost.toFixed(2));

    const moneySaved = Math.max(0, Number((immediateChargingCost - chargingCost).toFixed(2)));

    if (!v2gEnabled) {
      return {
        v2gEnabled: false,
        minBatteryReserve,
        energySoldKwh: 0,
        avgSellingPrice: 0,
        v2gRevenue: 0,
        moneySaved,
        totalBenefit: moneySaved,
        immediateChargingCost
      };
    }

    const batteryCapacityKwh = batteryCapacityMah / 100;
    const surplusSoc = Math.max(0, achievedSoc - minBatteryReserve);
    const surplusKwh = (surplusSoc / 100) * batteryCapacityKwh;

    // Identify all overlapping 30-min intervals during parking stay
    const overlappingIntervals: { index: number; price: number }[] = [];
    for (let j = 0; j < 48; j++) {
      const start = j * 30;
      const end = (j + 1) * 30;
      if (Math.max(arrivalMin, start) < Math.min(departureMin, end)) {
        overlappingIntervals.push({ index: j, price: DAILY_PRICING_GRID[j] });
      }
    }

    // Sort intervals by price in descending order to simulate selling at peak prices
    const sortedIntervals = overlappingIntervals.sort((a, b) => b.price - a.price);

    let remainingSurplus = surplusKwh;
    let totalRevenue = 0;
    let intervalsUsed = 0;
    let sumPrices = 0;

    for (const interval of sortedIntervals) {
      if (remainingSurplus <= 0) break;
      
      const dischargeCapacity = 3.7; // max discharge in kWh per 30 mins
      const soldInInterval = Math.min(remainingSurplus, dischargeCapacity);
      
      const pricePerKwh = interval.price * 5.12; // scales 2.5 to 12.8
      totalRevenue += soldInInterval * pricePerKwh;
      remainingSurplus -= soldInInterval;
      
      sumPrices += pricePerKwh;
      intervalsUsed++;
    }

    const energySoldKwh = Number((surplusKwh - remainingSurplus).toFixed(2));
    const avgSellingPrice = intervalsUsed > 0 ? Number((sumPrices / intervalsUsed).toFixed(2)) : 12.8;
    const v2gRevenue = Number(totalRevenue.toFixed(2));
    const totalBenefit = Number((moneySaved + v2gRevenue).toFixed(2));

    return {
      v2gEnabled: true,
      minBatteryReserve,
      energySoldKwh,
      avgSellingPrice,
      v2gRevenue,
      moneySaved,
      totalBenefit,
      immediateChargingCost
    };
  }
};