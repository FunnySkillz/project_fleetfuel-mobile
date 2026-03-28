import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { logsRepo, vehiclesRepo } from '@/data/repositories';
import type { EntrySummary, ExportPreview, LogsExportFilters, TripUsageFilter, VehicleListItem } from '@/data/types';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { generateLogsPdf } from '@/services/export/generate-logs-pdf';

type ChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

function Chip({ label, active, onPress }: ChipProps) {
  return (
    <Pressable onPress={onPress}>
      <ThemedView type={active ? 'backgroundSelected' : 'backgroundElement'} style={styles.chip}>
        <ThemedText type="small">{label}</ThemedText>
      </ThemedView>
    </Pressable>
  );
}

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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              Logs Export
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              Export-first workbench. Timeline browsing stays available below as a secondary section.
            </ThemedText>
          </View>

          <ThemedView type="backgroundElement" style={styles.workbenchCard}>
            <ThemedText type="smallBold">Vehicle Scope</ThemedText>
            <View style={styles.rowWrap}>
              <Chip label="All vehicles" active={allVehiclesScope} onPress={() => setAllVehiclesScope(true)} />
              <Chip label="Select vehicles" active={!allVehiclesScope} onPress={() => setAllVehiclesScope(false)} />
            </View>

            {!allVehiclesScope ? (
              <View style={styles.rowWrap}>
                {vehicles.map((vehicle) => (
                  <Chip
                    key={vehicle.id}
                    label={`${vehicle.name} (${vehicle.plate})`}
                    active={selectedVehicleIds.includes(vehicle.id)}
                    onPress={() => toggleVehicle(vehicle.id)}
                  />
                ))}
              </View>
            ) : null}

            <ThemedText type="smallBold">Period</ThemedText>
            <View style={styles.rowWrap}>
              {yearOptions.map((option) => (
                <Chip
                  key={option === null ? 'all' : String(option)}
                  label={option === null ? 'All dates' : String(option)}
                  active={year === option}
                  onPress={() => handleSelectYear(option)}
                />
              ))}
            </View>

            <View style={styles.rowTwoCols}>
              <View style={styles.col}>
                <ThemedText type="small">From (optional)</ThemedText>
                <TextInput
                  value={fromDate}
                  onChangeText={(value) => {
                    setFromDate(sanitizeDayDateInput(value));
                    if (value.trim().length > 0) {
                      setYear(null);
                    }
                  }}
                  placeholder="2026-01-01"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[
                    styles.input,
                    { color: theme.text, borderColor: theme.background, backgroundColor: theme.background },
                  ]}
                />
              </View>
              <View style={styles.col}>
                <ThemedText type="small">To (optional)</ThemedText>
                <TextInput
                  value={toDate}
                  onChangeText={(value) => {
                    setToDate(sanitizeDayDateInput(value));
                    if (value.trim().length > 0) {
                      setYear(null);
                    }
                  }}
                  placeholder="2026-12-31"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[
                    styles.input,
                    { color: theme.text, borderColor: theme.background, backgroundColor: theme.background },
                  ]}
                />
              </View>
            </View>

            <ThemedText type="smallBold">Trip Usage Filter</ThemedText>
            <View style={styles.rowWrap}>
              {(['both', 'work', 'private', 'unclassified'] as TripUsageFilter[]).map((value) => (
                <Chip key={value} label={usageLabel(value)} active={usageType === value} onPress={() => setUsageType(value)} />
              ))}
            </View>

            <ThemedText type="smallBold">Data Scope</ThemedText>
            <View style={styles.rowWrap}>
              <Chip label="Include fuel entries" active={includeFuel} onPress={() => setIncludeFuel((current) => !current)} />
              <Chip label="Include receipt appendix" active={includeReceipts} onPress={() => setIncludeReceipts((current) => !current)} />
            </View>

            {validationError ? (
              <ThemedText type="small" style={{ color: theme.destructive }}>
                {validationError}
              </ThemedText>
            ) : null}

            <ThemedView type="background" style={styles.previewCard}>
              <ThemedText type="smallBold">Live Export Preview</ThemedText>
              {previewStatus === 'loading' ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary">
                    Calculating export scope...
                  </ThemedText>
                </View>
              ) : previewStatus === 'error' || !preview ? (
                <ThemedText type="small" style={{ color: theme.destructive }}>
                  {previewError ?? 'Could not build preview.'}
                </ThemedText>
              ) : (
                <View style={styles.previewGrid}>
                  <ThemedText type="small">Vehicles: {preview.vehicleCount}</ThemedText>
                  <ThemedText type="small">Trips: {preview.tripCount}</ThemedText>
                  <ThemedText type="small">Fuel entries: {preview.fuelCount}</ThemedText>
                  <ThemedText type="small">Total distance: {preview.totalDistanceKm} km</ThemedText>
                  <ThemedText type="small">Work distance: {preview.businessDistanceKm} km</ThemedText>
                  <ThemedText type="small">Private distance: {preview.privateDistanceKm} km</ThemedText>
                  <ThemedText type="small">Unclassified: {preview.unclassifiedDistanceKm} km</ThemedText>
                  <ThemedText type="small">Fuel spend: EUR {preview.fuelSpendTotal.toFixed(2)}</ThemedText>
                </View>
              )}
            </ThemedView>

            <Pressable onPress={() => void handleGeneratePdf()} disabled={exportingPdf || Boolean(validationError)}>
              <ThemedView
                type="backgroundSelected"
                style={[styles.generateButton, (exportingPdf || Boolean(validationError)) && styles.disabledAction]}>
                <ThemedText type="smallBold">{exportingPdf ? 'Generating PDF...' : 'Generate PDF Export'}</ThemedText>
              </ThemedView>
            </Pressable>
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.timelineCard}>
            <View style={styles.timelineHeader}>
              <ThemedText type="smallBold">Timeline (Secondary)</ThemedText>
              <Pressable onPress={() => setShowTimeline((current) => !current)}>
                <ThemedText type="link">{showTimeline ? 'Hide' : 'Show'}</ThemedText>
              </Pressable>
            </View>

            {showTimeline ? (
              <>
                <TextInput
                  value={timelineSearch}
                  onChangeText={setTimelineSearch}
                  placeholder="Search timeline"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[
                    styles.input,
                    { color: theme.text, borderColor: theme.background, backgroundColor: theme.background },
                  ]}
                />

                {timelineStatus === 'loading' ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color={theme.textSecondary} />
                    <ThemedText type="small" themeColor="textSecondary">
                      Loading timeline...
                    </ThemedText>
                  </View>
                ) : timelineStatus === 'error' ? (
                  <ThemedText type="small" style={{ color: theme.destructive }}>
                    {timelineError ?? 'Could not load timeline.'}
                  </ThemedText>
                ) : timelineEntries.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    No matching timeline entries.
                  </ThemedText>
                ) : (
                  timelineEntries.map((entry) => (
                    <Pressable
                      key={entry.id}
                      onPress={() =>
                        router.push({
                          pathname: '/entries/[entryId]',
                          params: { entryId: entry.id },
                        })
                      }>
                      <ThemedView type="background" style={styles.timelineRow}>
                        <View style={styles.timelineRowLeft}>
                          <ThemedText type="smallBold">{entry.type === 'trip' ? 'Trip' : 'Fuel'}</ThemedText>
                          <ThemedText type="small">{entry.vehicleName}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {entry.summary}
                          </ThemedText>
                        </View>
                        <ThemedText type="small" themeColor="textSecondary">
                          {formatDate(entry.date)}
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                  ))
                )}
              </>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                Open this section when you need detail-level entry navigation.
              </ThemedText>
            )}
          </ThemedView>

          {vehiclesStatus === 'error' ? (
            <ThemedText type="small" style={{ color: theme.destructive }}>
              Vehicles could not be loaded. Export scope may be incomplete.
            </ThemedText>
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
  header: {
    gap: Spacing.two,
  },
  title: {
    fontSize: 36,
    lineHeight: 42,
  },
  workbenchCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  rowTwoCols: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  col: {
    flex: 1,
    gap: Spacing.one,
  },
  chip: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  previewCard: {
    borderRadius: Spacing.two,
    padding: Spacing.two,
    gap: Spacing.one,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  previewGrid: {
    gap: Spacing.half,
  },
  generateButton: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  disabledAction: {
    opacity: 0.45,
  },
  timelineCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  timelineRow: {
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  timelineRowLeft: {
    flex: 1,
    gap: Spacing.half,
  },
});

