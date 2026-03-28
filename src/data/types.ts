export type EntryType = 'trip' | 'fuel';
export type TripPrivateTag = 'private' | 'business' | null;

export type ReceiptAttachment = {
  uri: string;
  name: string;
  mimeType: string | null;
};

export type VehicleRecord = {
  id: string;
  name: string;
  plate: string;
  make: string | null;
  model: string | null;
  year: number | null;
  ps: number | null;
  kw: number | null;
  engineDisplacementCc: number | null;
  vin: string | null;
  engineTypeCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VehicleListItem = VehicleRecord & {
  tripCount: number;
  fuelCount: number;
  lastActivityAt: string | null;
};

export type TripRecord = {
  id: string;
  vehicleId: string;
  occurredAt: string;
  purpose: string;
  startOdometerKm: number;
  endOdometerKm: number;
  distanceKm: number;
  startTime: string | null;
  endTime: string | null;
  startLocation: string | null;
  endLocation: string | null;
  notes: string | null;
  privateTag: TripPrivateTag;
  createdAt: string;
  updatedAt: string;
};

export type FuelEntryRecord = {
  id: string;
  vehicleId: string;
  occurredAt: string;
  liters: number;
  totalPrice: number;
  station: string;
  odometerKm: number | null;
  avgConsumptionLPer100Km: number | null;
  receiptUri: string | null;
  receiptName: string | null;
  receiptMimeType: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EntrySummary = {
  id: string;
  type: EntryType;
  vehicleId: string;
  vehicleName: string;
  date: string;
  summary: string;
  searchText: string;
  privateTag: TripPrivateTag;
};

export type LogsQueryFilters = {
  type?: 'all' | EntryType;
  vehicleId?: string | null;
  search?: string;
  fromDate?: string | null;
  toDate?: string | null;
  businessOnly?: boolean;
  limit?: number;
};

export type TripEntryDetail = {
  type: 'trip';
  id: string;
  vehicleId: string;
  vehicleName: string;
  occurredAt: string;
  purpose: string;
  startOdometerKm: number;
  endOdometerKm: number;
  distanceKm: number;
  startTime: string | null;
  endTime: string | null;
  startLocation: string | null;
  endLocation: string | null;
  notes: string | null;
  privateTag: TripPrivateTag;
};

export type FuelEntryDetail = {
  type: 'fuel';
  id: string;
  vehicleId: string;
  vehicleName: string;
  occurredAt: string;
  liters: number;
  totalPrice: number;
  station: string;
  odometerKm: number | null;
  avgConsumptionLPer100Km: number | null;
  receiptUri: string | null;
  receiptName: string | null;
  receiptMimeType: string | null;
  notes: string | null;
};

export type EntryDetail = TripEntryDetail | FuelEntryDetail;
