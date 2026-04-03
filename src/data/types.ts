export type EntryType = 'trip' | 'fuel';
export type TripClassification = 'private' | 'business';
export type TripPrivateTag = TripClassification | null;
export type TripUsageFilter = 'both' | 'work' | 'private' | 'unclassified';
export const FUEL_TYPES = ['petrol', 'diesel', 'electric', 'hybrid', 'lpg', 'cng', 'other'] as const;
export type FuelType = (typeof FUEL_TYPES)[number];
export type FuelTypeFilter = FuelType | 'all';
export type ChangeHistoryEntityType = 'vehicle' | 'trip' | 'fuel';
export type ChangeHistoryActionType = 'update' | 'delete';
export type ChangeHistoryActorType = 'local_user' | 'system';

export type ChangeFieldDiff = {
  field: string;
  before: unknown;
  after: unknown;
};

export type ChangeHistoryRecord = {
  id: string;
  vehicleId: string;
  entityType: ChangeHistoryEntityType;
  entityId: string;
  actionType: ChangeHistoryActionType;
  reason: string;
  actorType: ChangeHistoryActorType;
  actorId: string;
  changedFields: ChangeFieldDiff[];
  before: Record<string, unknown>;
  after: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
  createdAt: string;
};

export type ReceiptAttachment = {
  uri: string;
  name: string;
  mimeType: string | null;
};

export type VehicleRecord = {
  id: string;
  name: string;
  plate: string;
  currentOdometerKm: number;
  defaultFuelType: FuelType;
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
  fuelType: FuelType | null;
  liters: number;
  fuelInTankAfterRefuelLiters: number | null;
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
  vehicleIds?: string[];
  search?: string;
  fromDate?: string | null;
  toDate?: string | null;
  year?: number | null;
  usageType?: TripUsageFilter;
  limit?: number;
};

export type LogsExportFilters = {
  vehicleIds: string[];
  fromDate: string | null;
  toDate: string | null;
  year: number | null;
  usageType: TripUsageFilter;
  fuelType: FuelTypeFilter;
  includeFuel: boolean;
  includeReceipts: boolean;
};

export type ExportPreview = {
  vehicleCount: number;
  tripCount: number;
  fuelCount: number;
  totalDistanceKm: number;
  businessDistanceKm: number;
  privateDistanceKm: number;
  unclassifiedDistanceKm: number;
  fuelSpendTotal: number;
  avgConsumptionLPer100Km: number | null;
};

export type ExportTripRow = {
  id: string;
  vehicleId: string;
  occurredAt: string;
  purpose: string;
  startOdometerKm: number;
  endOdometerKm: number;
  distanceKm: number;
  privateTag: TripPrivateTag;
  startTime: string | null;
  endTime: string | null;
  startLocation: string | null;
  endLocation: string | null;
  notes: string | null;
};

export type ExportFuelRow = {
  id: string;
  vehicleId: string;
  occurredAt: string;
  fuelType: FuelType | null;
  liters: number;
  fuelInTankAfterRefuelLiters: number | null;
  totalPrice: number;
  station: string;
  odometerKm: number | null;
  avgConsumptionLPer100Km: number | null;
  receiptName: string | null;
  receiptUri: string | null;
  notes: string | null;
};

export type ExportVehicleSection = {
  vehicleId: string;
  vehicleName: string;
  vehiclePlate: string;
  trips: ExportTripRow[];
  fuelEntries: ExportFuelRow[];
  totals: {
    tripCount: number;
    fuelCount: number;
    distanceKm: number;
    businessDistanceKm: number;
    privateDistanceKm: number;
    unclassifiedDistanceKm: number;
    fuelSpendTotal: number;
  };
};

export type LogsExportDataset = {
  generatedAt: string;
  filters: LogsExportFilters;
  preview: ExportPreview;
  vehicles: ExportVehicleSection[];
};

export type VehicleMonthlyDistancePoint = {
  monthKey: string;
  monthLabel: string;
  distanceKm: number;
};

export type VehicleUsageSplitPoint = {
  key: 'business' | 'private' | 'unclassified';
  label: string;
  distanceKm: number;
  ratio: number;
};

export type VehicleRecentTrip = {
  id: string;
  occurredAt: string;
  purpose: string;
  distanceKm: number;
  privateTag: TripPrivateTag;
  startTime: string | null;
  endTime: string | null;
  startLocation: string | null;
  endLocation: string | null;
};

export type VehicleInsightSummary = {
  vehicle: VehicleRecord;
  kpis: {
    totalTrips: number;
    totalDistanceKm: number;
    businessDistanceKm: number;
    privateDistanceKm: number;
    unclassifiedDistanceKm: number;
    fuelSpendTotal: number;
    avgConsumptionLPer100Km: number | null;
  };
  monthlyDistance: VehicleMonthlyDistancePoint[];
  usageSplit: VehicleUsageSplitPoint[];
  recentTrips: VehicleRecentTrip[];
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
  fuelType: FuelType | null;
  liters: number;
  fuelInTankAfterRefuelLiters: number | null;
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
