import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import {
  Button,
  Card,
  DateTimeField,
  EmptyState,
  FormField,
  Input,
  ListRow,
  SectionHeader,
  SelectField,
} from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { logsRepo, vehiclesRepo } from '@/data/repositories';
import type {
  EntrySummary,
  ExportPreview,
  LogsExportFilters,
  TripUsageFilter,
  VehicleListItem,
} from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { generateLogsPdf } from '@/services/export/generate-logs-pdf';

function formatDate(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }

  return parsed.toISOString().slice(0, 10);
}

function sanitizeDayDateInput(value: string) {
  return value.replace(/[^\d-]/g, '').slice(0, 10);
}

function isValidDayDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function usageLabel(value: TripUsageFilter) {
  if (value === 'work') {
    return 'Work';
  }
  if (value === 'private') {
    return 'Private';
  }
  if (value === 'unclassified') {
    return 'Unclassified';
  }

  return 'Both';
}

const USAGE_OPTIONS: TripUsageFilter[] = ['both', 'work', 'private', 'unclassified'];

export default function LogsScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const theme = useTheme();

  const currentYear = new Date().getUTCFullYear();
  const yearOptions = useMemo(() => [null, currentYear, currentYear - 1, currentYear - 2], [currentYear]);

  const [vehicles, setVehicles] = useState<VehicleListItem[]>([]);
  const [vehiclesStatus, setVehiclesStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const [allVehiclesScope, setAllVehiclesScope] = useState(true);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);

  const [year, setYear] = useState<number | null>(currentYear);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [usageType, setUsageType] = useState<TripUsageFilter>('both');
  const [includeFuel, setIncludeFuel] = useState(true);
  const [includeReceipts, setIncludeReceipts] = useState(false);

  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [previewStatus, setPreviewStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [showTimeline, setShowTimeline] = useState(false);
  const [timelineSearch, setTimelineSearch] = useState('');
  const [timelineEntries, setTimelineEntries] = useState<EntrySummary[]>([]);
  const [timelineStatus, setTimelineStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [timelineError, setTimelineError] = useState<string | null>(null);

  const [exportingPdf, setExportingPdf] = useState(false);

  const previewRequestRef = useRef(0);
  const timelineRequestRef = useRef(0);

  const selectedIds = useMemo(() => {
    if (allVehiclesScope) {
      return [];
    }

    return selectedVehicleIds;
  }, [allVehiclesScope, selectedVehicleIds]);

  const validationError = useMemo(() => {
    if (!allVehiclesScope && selectedVehicleIds.length === 0) {
      return 'Select at least one vehicle or switch scope to All vehicles.';
    }

    const trimmedFrom = fromDate.trim();
    const trimmedTo = toDate.trim();

    if (trimmedFrom.length > 0 && !isValidDayDate(trimmedFrom)) {
      return 'From date must use YYYY-MM-DD.';
    }

    if (trimmedTo.length > 0 && !isValidDayDate(trimmedTo)) {
      return 'To date must use YYYY-MM-DD.';
    }

    if (trimmedFrom.length > 0 && trimmedTo.length > 0 && trimmedFrom > trimmedTo) {
      return 'From date must be earlier than or equal to To date.';
    }

    return null;
  }, [allVehiclesScope, fromDate, selectedVehicleIds.length, toDate]);

  const exportFilters = useMemo<Partial<LogsExportFilters>>(
    () => ({
      vehicleIds: selectedIds,
      fromDate: fromDate.trim() || null,
      toDate: toDate.trim() || null,
      year,
      usageType,
      includeFuel,
      includeReceipts,
    }),
    [fromDate, includeFuel, includeReceipts, selectedIds, toDate, usageType, year],
  );

  const isDirty =
    !allVehiclesScope ||
    selectedVehicleIds.length > 0 ||
    year !== currentYear ||
    fromDate.trim().length > 0 ||
    toDate.trim().length > 0 ||
    usageType !== 'both' ||
    !includeFuel ||
    includeReceipts ||
    exportingPdf;
  const { allowNextNavigation } = useUnsavedChangesGuard(isDirty);

  const loadVehicles = useCallback(async () => {
    setVehiclesStatus('loading');
    try {
      const data = await vehiclesRepo.list();
      setVehicles(data);
      setVehiclesStatus('ready');

      setSelectedVehicleIds((previous) => previous.filter((id) => data.some((vehicle) => vehicle.id === id)));
    } catch {
      setVehicles([]);
      setVehiclesStatus('error');
    }
  }, []);

  const loadPreview = useCallback(async () => {
    if (validationError) {
      setPreviewStatus('error');
      setPreviewError(validationError);
      setPreview(null);
      return;
    }

    const requestId = ++previewRequestRef.current;
    setPreviewStatus('loading');
    setPreviewError(null);

    try {
      const data = await logsRepo.getExportPreview(exportFilters);
      if (requestId !== previewRequestRef.current) {
        return;
      }

      setPreview(data);
      setPreviewStatus('ready');
    } catch (error) {
      if (requestId !== previewRequestRef.current) {
        return;
      }

      setPreviewStatus('error');
      setPreviewError(error instanceof Error ? error.message : 'Failed to compute export preview.');
      setPreview(null);
    }
  }, [exportFilters, validationError]);

  const loadTimeline = useCallback(async () => {
    if (!showTimeline) {
      setTimelineStatus('idle');
      setTimelineEntries([]);
      setTimelineError(null);
      return;
    }

    if (validationError) {
      setTimelineStatus('error');
      setTimelineEntries([]);
      setTimelineError(validationError);
      return;
    }

    const requestId = ++timelineRequestRef.current;
    setTimelineStatus('loading');
    setTimelineError(null);

    try {
      const rows = await logsRepo.list({
        type: 'all',
        vehicleIds: selectedIds,
        fromDate: fromDate.trim() || null,
        toDate: toDate.trim() || null,
        year,
        usageType,
        search: timelineSearch,
      });

      if (requestId !== timelineRequestRef.current) {
        return;
      }

      setTimelineEntries(rows);
      setTimelineStatus('ready');
    } catch (error) {
      if (requestId !== timelineRequestRef.current) {
        return;
      }

      setTimelineStatus('error');
      setTimelineEntries([]);
      setTimelineError(error instanceof Error ? error.message : 'Failed to load timeline.');
    }
  }, [fromDate, selectedIds, showTimeline, timelineSearch, toDate, usageType, validationError, year]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    void loadVehicles();
  }, [isFocused, loadVehicles]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    void loadPreview();
  }, [isFocused, loadPreview]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    void loadTimeline();
  }, [isFocused, loadTimeline]);

  const toggleVehicle = (vehicleId: string) => {
    setSelectedVehicleIds((previous) => {
      if (previous.includes(vehicleId)) {
        return previous.filter((id) => id !== vehicleId);
      }

      return [...previous, vehicleId];
    });
  };

  const handleSelectYear = (nextYear: number | null) => {
    setYear(nextYear);
    setFromDate('');
    setToDate('');
  };

  const handleGeneratePdf = async () => {
    if (exportingPdf) {
      return;
    }

    if (validationError) {
      Alert.alert('Check filters', validationError);
      return;
    }

    setExportingPdf(true);
    try {
      const result = await generateLogsPdf(exportFilters);
      Alert.alert(
        'PDF ready',
        `${result.fileName}\nTrips: ${result.dataset.preview.tripCount}\nFuel entries: ${result.dataset.preview.fuelCount}`,
      );
      allowNextNavigation();
    } catch (error) {
      Alert.alert('Export failed', error instanceof Error ? error.message : 'Unexpected error while generating PDF.');
    } finally {
      setExportingPdf(false);
    }
  };

  const yearValue = year === null ? 'all' : String(year);
  const dataScopeValues = [includeFuel ? 'fuel' : null, includeReceipts ? 'receipts' : null].filter(
    (value): value is string => Boolean(value),
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <SectionHeader
            title="Logs Export"
            description="Export-first workbench. Timeline browsing stays available below as a secondary section."
          />

          <Card className="gap-3">
            <FormField label="Vehicle Scope" error={validationError?.includes('Select at least one vehicle') ? validationError : null}>
              <SelectField
                options={[
                  { value: 'all', label: 'All vehicles' },
                  { value: 'selected', label: 'Select vehicles' },
                ]}
                value={allVehiclesScope ? 'all' : 'selected'}
                onChange={(value) => setAllVehiclesScope(value === 'all')}
              />
            </FormField>

            {!allVehiclesScope ? (
              <FormField label="Vehicles" required>
                {vehiclesStatus === 'loading' ? (
                  <Input value="Loading vehicles..." editable={false} variant="subtle" />
                ) : vehicles.length === 0 ? (
                  <EmptyState title="No vehicles found" description="Add vehicles before exporting scoped datasets." />
                ) : (
                  <SelectField
                    multi
                    options={vehicles.map((vehicle) => ({ value: vehicle.id, label: `${vehicle.name} (${vehicle.plate})` }))}
                    values={selectedVehicleIds}
                    onToggle={toggleVehicle}
                  />
                )}
              </FormField>
            ) : null}

            <FormField label="Period">
              <SelectField
                options={yearOptions.map((option) => ({
                  value: option === null ? 'all' : String(option),
                  label: option === null ? 'All dates' : String(option),
                }))}
                value={yearValue}
                onChange={(value) => {
                  if (value === 'all') {
                    handleSelectYear(null);
                    return;
                  }

                  const parsedYear = Number.parseInt(value, 10);
                  handleSelectYear(Number.isNaN(parsedYear) ? null : parsedYear);
                }}
              />
            </FormField>

            <View style={styles.rowTwoCols}>
              <View style={styles.col}>
                <FormField
                  label="From (optional)"
                  error={validationError?.includes('From date') ? validationError : null}>
                  <DateTimeField
                    mode="date"
                    value={fromDate}
                    onChangeText={(value) => {
                      setFromDate(sanitizeDayDateInput(value));
                      if (value.trim().length > 0) {
                        setYear(null);
                      }
                    }}
                    placeholder="2026-01-01"
                    tone={validationError?.includes('From date') ? 'destructive' : 'neutral'}
                  />
                </FormField>
              </View>

              <View style={styles.col}>
                <FormField
                  label="To (optional)"
                  error={validationError && !validationError.includes('Select at least one vehicle') && !validationError.includes('From date') ? validationError : null}>
                  <DateTimeField
                    mode="date"
                    value={toDate}
                    onChangeText={(value) => {
                      setToDate(sanitizeDayDateInput(value));
                      if (value.trim().length > 0) {
                        setYear(null);
                      }
                    }}
                    placeholder="2026-12-31"
                    tone={
                      validationError &&
                      !validationError.includes('Select at least one vehicle') &&
                      !validationError.includes('From date')
                        ? 'destructive'
                        : 'neutral'
                    }
                  />
                </FormField>
              </View>
            </View>

            <FormField label="Trip Usage Filter">
              <SelectField
                options={USAGE_OPTIONS.map((value) => ({ value, label: usageLabel(value) }))}
                value={usageType}
                onChange={(value) => setUsageType(value as TripUsageFilter)}
              />
            </FormField>

            <FormField label="Data Scope">
              <SelectField
                multi
                options={[
                  { value: 'fuel', label: 'Include fuel entries' },
                  { value: 'receipts', label: 'Include receipt appendix' },
                ]}
                values={dataScopeValues}
                onToggle={(value) => {
                  if (value === 'fuel') {
                    setIncludeFuel((current) => !current);
                  }
                  if (value === 'receipts') {
                    setIncludeReceipts((current) => !current);
                  }
                }}
              />
            </FormField>

            <Card variant="outline" className="gap-1.5">
              <Text className="text-sm font-semibold text-text dark:text-dark-text">Live Export Preview</Text>
              {previewStatus === 'loading' ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={theme.textSecondary} />
                  <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">Calculating export scope...</Text>
                </View>
              ) : previewStatus === 'error' || !preview ? (
                <Text className="text-xs text-destructive dark:text-dark-destructive">
                  {previewError ?? 'Could not build preview.'}
                </Text>
              ) : (
                <View style={styles.previewGrid}>
                  <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">Vehicles: {preview.vehicleCount}</Text>
                  <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">Trips: {preview.tripCount}</Text>
                  <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">Fuel entries: {preview.fuelCount}</Text>
                  <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">Total distance: {preview.totalDistanceKm} km</Text>
                  <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">Work distance: {preview.businessDistanceKm} km</Text>
                  <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">Private distance: {preview.privateDistanceKm} km</Text>
                  <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">Unclassified: {preview.unclassifiedDistanceKm} km</Text>
                  <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">
                    Fuel spend: EUR {preview.fuelSpendTotal.toFixed(2)}
                  </Text>
                </View>
              )}
            </Card>

            <Button
              variant="primary"
              label={exportingPdf ? 'Generating PDF...' : 'Generate PDF Export'}
              onPress={() => void handleGeneratePdf()}
              disabled={exportingPdf || Boolean(validationError)}
            />
          </Card>

          <Card className="gap-2">
            <SectionHeader
              title="Timeline"
              description="Secondary detail-level navigation inside Logs."
              actionLabel={showTimeline ? 'Hide' : 'Show'}
              onAction={() => setShowTimeline((current) => !current)}
              className="mb-1"
            />

            {showTimeline ? (
              <>
                <FormField label="Search Timeline">
                  <Input
                    value={timelineSearch}
                    onChangeText={setTimelineSearch}
                    placeholder="Search timeline"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </FormField>

                {timelineStatus === 'loading' ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color={theme.textSecondary} />
                    <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">Loading timeline...</Text>
                  </View>
                ) : timelineStatus === 'error' ? (
                  <Text className="text-xs text-destructive dark:text-dark-destructive">
                    {timelineError ?? 'Could not load timeline.'}
                  </Text>
                ) : timelineEntries.length === 0 ? (
                  <EmptyState title="No matching timeline entries" description="Adjust filters or search terms." />
                ) : (
                  timelineEntries.map((entry) => (
                    <ListRow
                      key={entry.id}
                      title={entry.type === 'trip' ? 'Trip' : 'Fuel'}
                      subtitle={`${entry.vehicleName} | ${entry.summary}`}
                      meta={formatDate(entry.date)}
                      onPress={() =>
                        router.push({
                          pathname: '/entries/[entryId]',
                          params: { entryId: entry.id },
                        })
                      }
                    />
                  ))
                )}
              </>
            ) : (
              <Text className="text-xs text-textSecondary dark:text-dark-textSecondary">
                Open this section when you need detail-level entry navigation.
              </Text>
            )}
          </Card>

          {vehiclesStatus === 'error' ? (
            <Card tone="warning">
              <Text className="text-xs text-warning dark:text-dark-warning">
                Vehicles could not be loaded. Export scope may be incomplete.
              </Text>
            </Card>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  col: {
    flex: 1,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  previewGrid: {
    gap: Spacing.half,
  },
});


