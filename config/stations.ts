export interface StationSlot {
  dbName: string;
  displayName: string;
}

export interface Station {
  id: string;
  name: string;
  address: string;
  distance: string;
  hasEsp32: boolean;
  slots: StationSlot[];
}

export const STATIONS: Station[] = [
  {
    id: 'iiitdmj',
    name: 'IIITDMJ Campus Hub',
    address: 'IIITDMJ Campus, Dumna Road, Jabalpur',
    distance: '0.1 km',
    hasEsp32: true,
    slots: [
      { dbName: 'Bay 1 (Hardware ESP32)', displayName: 'Bay 1 (ESP32)' },
      { dbName: 'Bay 2', displayName: 'Bay 2' },
    ],
  },
  {
    id: 'vijay-nagar',
    name: 'Vijay Nagar Hub',
    address: 'Vijay Nagar Main Road, Jabalpur',
    distance: '3.5 km',
    hasEsp32: false,
    slots: [
      { dbName: 'Bay 3', displayName: 'Bay 1' },
      { dbName: 'Bay 4', displayName: 'Bay 2' },
      { dbName: 'Bay 5', displayName: 'Bay 3' },
    ],
  },
  {
    id: 'civil-lines',
    name: 'Civil Lines Station',
    address: 'Civil Lines Near Railway Station, Jabalpur',
    distance: '5.2 km',
    hasEsp32: false,
    slots: [
      { dbName: 'Bay 6', displayName: 'Bay 1' },
      { dbName: 'Bay 7', displayName: 'Bay 2' },
      { dbName: 'Bay 8', displayName: 'Bay 3' },
    ],
  },
  {
    id: 'sadar',
    name: 'Sadar Cantt Hub',
    address: 'Cantt Market, Sadar, Jabalpur',
    distance: '7.8 km',
    hasEsp32: false,
    slots: [
      { dbName: 'Bay 9', displayName: 'Bay 1' },
      { dbName: 'Bay 10', displayName: 'Bay 2' },
    ],
  },
];

export const getStationById = (id: string) => STATIONS.find(s => s.id === id);

export const getStationBySlotDbName = (dbName: string) => 
  STATIONS.find(s => s.slots.some(slot => slot.dbName === dbName));

export const getSlotDisplayName = (dbName: string) => {
  for (const station of STATIONS) {
    const slot = station.slots.find(s => s.dbName === dbName);
    if (slot) return slot.displayName;
  }
  return dbName; // Fallback to raw DB name if not matched
};
