import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import {
  AccordionSection,
  AppText,
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
import type { EntrySummary, ExportPreview, FuelTypeFilter, LogsExportFilters, TripUsageFilter, VehicleListItem } from '@/data/types';
import { useI18n } from '@/hooks/use-i18n';
import { useNavigationPressGuard } from '@/hooks/use-navigation-press-guard';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { generateLogsPdf } from '@/services/export/generate-logs-pdf';
import { formatIsoDateLocal, formatLocalDate } from '@/utils/date-format';
import { buildFuelTypeFilterOptions } from '@/utils/fuel-type-options';

function formatDate(iso: string) {
  return formatIsoDateLocal(iso);
}

function sanitizeDayDateInput(value: string) {
  return value.replace(/[^\d-]/g, '').slice(0, 10);
}

function isValidDayDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function resolvePeriodRange(year: number, currentYear: number, todayLocal: string) {
  return {
    fromDate: `${year}-01-01`,
    toDate: year === currentYear ? todayLocal : `${year}-12-31`,
  };
}

const USAGE_OPTIONS: TripUsageFilter[] = ['both', 'work', 'private', 'unclassified'];
type SecondaryAccordionKey = 'tripUsage' | 'fuelType' | 'dataScope';
type LogsValidationErrorKey =
  | 'logs.validation.vehicleScopeRequired'
  | 'logs.validation.fromDateFormat'
  | 'logs.validation.toDateFormat'
  | 'logs.validation.dateRange';

export default function LogsScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const theme = useTheme();
  const { t } = useI18n();
  const { runGuarded } = useNavigationPressGuard();

  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const todayLocal = formatLocalDate(now);
  const currentYearPeriod = useMemo(() => resolvePeriodRange(currentYear, currentYear, todayLocal), [currentYear, todayLocal]);
  const yearOptions = useMemo(() => [currentYear, currentYear - 1, currentYear - 2], [currentYear]);
  const usageOptions = useMemo(
    () =>
      USAGE_OPTIONS.map((value) => ({
        value,
        label:
          value === 'work'
            ? t('logs.option.usageWork')
            : value === 'private'
              ? t('logs.option.usagePrivate')
              : value === 'unclassified'
                ? t('logs.option.usageUnclassified')
                : t('logs.option.usageBoth'),
      })),
    [t],
  );
  const fuelTypeOptions = useMemo(() => buildFuelTypeFilterOptions(t), [t]);

  const [vehicles, setVehicles] = useState<VehicleListItem[]>([]);
  const [vehiclesStatus, setVehiclesStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const [allVehiclesScope, setAllVehiclesScope] = useState(true);
  const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);

  const [year, setYear] = useState(currentYear);
  const [fromDate, setFromDate] = useState(currentYearPeriod.fromDate);
  const [toDate, setToDate] = useState(currentYearPeriod.toDate);
  const [usageType, setUsageType] = useState<TripUsageFilter>('both');
  const [fuelType, setFuelType] = useState<FuelTypeFilter>('all');
  const [includeFuel, setIncludeFuel] = useState(true);
  const [includeReceipts, setIncludeReceipts] = useState(false);

  const [isVehicleScopeOpen, setIsVehicleScopeOpen] = useState(false);
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);
  const [openSecondary, setOpenSecondary] = useState<SecondaryAccordionKey | null>(null);

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

  const validationErrorKey = useMemo<LogsValidationErrorKey | null>(() => {
    if (!allVehiclesScope && selectedVehicleIds.length === 0) {
      return 'logs.validation.vehicleScopeRequired';
    }

    const trimmedFrom = fromDate.trim();
    const trimmedTo = toDate.trim();

    if (trimmedFrom.length > 0 && !isValidDayDate(trimmedFrom)) {
      return 'logs.validation.fromDateFormat';
    }

    if (trimmedTo.length > 0 && !isValidDayDate(trimmedTo)) {
      return 'logs.validation.toDateFormat';
    }

    if (trimmedFrom.length > 0 && trimmedTo.length > 0 && trimmedFrom > trimmedTo) {
      return 'logs.validation.dateRange';
    }

    return null;
  }, [allVehiclesScope, fromDate, selectedVehicleIds.length, toDate]);

  useEffect(() => {
    if (validationErrorKey === 'logs.validation.vehicleScopeRequired') {
      setIsVehicleScopeOpen(true);
    }

    if (
      validationErrorKey === 'logs.validation.fromDateFormat' ||
      validationErrorKey === 'logs.validation.toDateFormat' ||
      validationErrorKey === 'logs.validation.dateRange'
    ) {
      setIsPeriodOpen(true);
    }
  }, [validationErrorKey]);

  const validationError = validationErrorKey ? t(validationErrorKey) : null;

  const exportFilters = useMemo<Partial<LogsExportFilters>>(
    () => ({
      vehicleIds: selectedIds,
      fromDate: fromDate.trim() || null,
      toDate: toDate.trim() || null,
      year,
      usageType,
      fuelType,
      includeFuel,
      includeReceipts,
    }),
    [fromDate, fuelType, includeFuel, includeReceipts, selectedIds, toDate, usageType, year],
  );

  const isDirty =
    !allVehiclesScope ||
    selectedVehicleIds.length > 0 ||
    year !== currentYear ||
    fromDate !== currentYearPeriod.fromDate ||
    toDate !== currentYearPeriod.toDate ||
    usageType !== 'both' ||
    fuelType !== 'all' ||
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
    if (validationErrorKey) {
      setPreviewStatus('error');
      setPreviewError(t(validationErrorKey));
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
      setPreviewError(error instanceof Error ? error.message : t('logs.preview.errorFallback'));
      setPreview(null);
    }
  }, [exportFilters, t, validationErrorKey]);

  const loadTimeline = useCallback(async () => {
    if (!showTimeline) {
      setTimelineStatus('idle');
      setTimelineEntries([]);
      setTimelineError(null);
      return;
    }

    if (validationErrorKey) {
      setTimelineStatus('error');
      setTimelineEntries([]);
      setTimelineError(t(validationErrorKey));
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
      setTimelineError(error instanceof Error ? error.message : t('logs.timeline.errorFallback'));
    }
  }, [fromDate, selectedIds, showTimeline, t, timelineSearch, toDate, usageType, validationErrorKey, year]);

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

  const applyYearDefaults = useCallback(
    (nextYear: number) => {
      const period = resolvePeriodRange(nextYear, currentYear, todayLocal);
      setYear(nextYear);
      setFromDate(period.fromDate);
      setToDate(period.toDate);
    },
    [currentYear, todayLocal],
  );

  const handleResetFilters = useCallback(() => {
    setAllVehiclesScope(true);
    setSelectedVehicleIds([]);
    applyYearDefaults(currentYear);
    setUsageType('both');
    setFuelType('all');
    setIncludeFuel(true);
    setIncludeReceipts(false);
    setIsVehicleScopeOpen(false);
    setIsPeriodOpen(false);
    setOpenSecondary(null);
  }, [applyYearDefaults, currentYear]);

  const handleGeneratePdf = async () => {
    if (exportingPdf) {
      return;
    }

    if (validationErrorKey) {
      Alert.alert(t('logs.alert.checkFiltersTitle'), t(validationErrorKey));
      return;
    }

    setExportingPdf(true);
    try {
      const result = await generateLogsPdf(exportFilters);
      Alert.alert(
        t('logs.alert.pdfReadyTitle'),
        t('logs.alert.pdfReadyMessage', {
          fileName: result.fileName,
          uri: result.uri,
          tripCount: result.dataset.preview.tripCount,
          fuelCount: result.dataset.preview.fuelCount,
        }),
      );
      allowNextNavigation();
    } catch (error) {
      Alert.alert(t('logs.alert.exportFailedTitle'), error instanceof Error ? error.message : t('logs.alert.exportFailedFallback'));
    } finally {
      setExportingPdf(false);
    }
  };

  const yearValue = String(year);
  const dataScopeValues = [includeFuel ? 'fuel' : null, includeReceipts ? 'receipts' : null].filter(
    (value): value is string => Boolean(value),
  );

  const vehicleScopeSummary = allVehiclesScope
    ? t('logs.summary.allVehicles')
    : selectedVehicleIds.length === 0
      ? t('logs.summary.noVehicleSelected')
      : t('logs.summary.selectedVehicles', { count: selectedVehicleIds.length });
  const periodSummary = t('logs.summary.periodRange', {
    from: fromDate.trim() || '----',
    to: toDate.trim() || '----',
  });
  const usageSummary = usageOptions.find((option) => option.value === usageType)?.label ?? t('logs.option.usageBoth');
  const fuelTypeSummary = fuelTypeOptions.find((option) => option.value === fuelType)?.label ?? t('common.fuelType.all');
  const dataScopeSummary = includeFuel
    ? includeReceipts
      ? t('logs.summary.dataScopeFuelAndReceipts')
      : t('logs.summary.dataScopeFuelOnly')
    : includeReceipts
      ? t('logs.summary.dataScopeReceiptsOnly')
      : t('logs.summary.dataScopeNone');

  const toggleSecondaryAccordion = (key: SecondaryAccordionKey) => {
    setOpenSecondary((current) => (current === key ? null : key));
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <SectionHeader
            title={t('logs.title')}
            description={t('logs.description')}
            actionLabel={t('logs.action.reset')}
            onAction={handleResetFilters}
          />

          <AccordionSection
            title={t('logs.field.vehicleScope')}
            summary={vehicleScopeSummary}
            open={isVehicleScopeOpen}
            onToggle={() => setIsVehicleScopeOpen((current) => !current)}>
            <FormField
              label={t('logs.field.vehicleScope')}
              error={validationErrorKey === 'logs.validation.vehicleScopeRequired' ? validationError : null}>
              <SelectField
                options={[
                  { value: 'all', label: t('logs.option.allVehicles') },
                  { value: 'selected', label: t('logs.option.selectVehicles') },
                ]}
                value={allVehiclesScope ? 'all' : 'selected'}
                onChange={(value) => setAllVehiclesScope(value === 'all')}
              />
            </FormField>

            {!allVehiclesScope ? (
              <FormField label={t('logs.field.vehicles')} required>
                {vehiclesStatus === 'loading' ? (
                  <Input value={t('common.loadingVehicles')} editable={false} variant="subtle" />
                ) : vehicles.length === 0 ? (
                  <EmptyState title={t('logs.scope.noVehicles')} description={t('logs.scope.noVehiclesDescription')} />
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
          </AccordionSection>

          <AccordionSection
            title={t('logs.field.period')}
            summary={periodSummary}
            open={isPeriodOpen}
            onToggle={() => setIsPeriodOpen((current) => !current)}>
            <FormField label={t('logs.field.period')}>
              <SelectField
                options={yearOptions.map((option) => ({
                  value: String(option),
                  label: String(option),
                }))}
                value={yearValue}
                onChange={(value) => {
                  const parsedYear = Number.parseInt(value, 10);
                  if (Number.isNaN(parsedYear)) {
                    return;
                  }
                  applyYearDefaults(parsedYear);
                }}
              />
            </FormField>

            <View style={styles.rowTwoCols}>
              <View style={styles.col}>
                <FormField
                  label={t('logs.field.fromDate')}
                  error={validationErrorKey === 'logs.validation.fromDateFormat' ? validationError : null}>
                  <DateTimeField
                    mode="date"
                    value={fromDate}
                    onChangeText={(value) => {
                      setFromDate(sanitizeDayDateInput(value));
                    }}
                    onClear={() => {
                      setFromDate('');
                    }}
                    clearable
                    placeholder={t('logs.placeholder.fromDate')}
                    tone={validationErrorKey === 'logs.validation.fromDateFormat' ? 'destructive' : 'neutral'}
                  />
                </FormField>
              </View>

              <View style={styles.col}>
                <FormField
                  label={t('logs.field.toDate')}
                  error={
                    validationErrorKey === 'logs.validation.toDateFormat' || validationErrorKey === 'logs.validation.dateRange'
                      ? validationError
                      : null
                  }>
                  <DateTimeField
                    mode="date"
                    value={toDate}
                    onChangeText={(value) => {
                      setToDate(sanitizeDayDateInput(value));
                    }}
                    onClear={() => {
                      setToDate('');
                    }}
                    clearable
                    placeholder={t('logs.placeholder.toDate')}
                    tone={
                      validationErrorKey === 'logs.validation.toDateFormat' || validationErrorKey === 'logs.validation.dateRange'
                        ? 'destructive'
                        : 'neutral'
                    }
                  />
                </FormField>
              </View>
            </View>
          </AccordionSection>

          <AccordionSection
            title={t('logs.field.usageType')}
            summary={usageSummary}
            open={openSecondary === 'tripUsage'}
            onToggle={() => toggleSecondaryAccordion('tripUsage')}>
            <FormField label={t('logs.field.usageType')}>
              <SelectField options={usageOptions} value={usageType} onChange={(value) => setUsageType(value as TripUsageFilter)} />
            </FormField>
          </AccordionSection>

          <AccordionSection
            title={t('logs.field.fuelType')}
            summary={fuelTypeSummary}
            open={openSecondary === 'fuelType'}
            onToggle={() => toggleSecondaryAccordion('fuelType')}>
            <FormField label={t('logs.field.fuelType')}>
              <SelectField options={fuelTypeOptions} value={fuelType} onChange={(value) => setFuelType(value as FuelTypeFilter)} />
            </FormField>
          </AccordionSection>

          <AccordionSection
            title={t('logs.field.dataScope')}
            summary={dataScopeSummary}
            open={openSecondary === 'dataScope'}
            onToggle={() => toggleSecondaryAccordion('dataScope')}>
            <FormField label={t('logs.field.dataScope')}>
              <SelectField
                multi
                options={[
                  { value: 'fuel', label: t('logs.option.includeFuel') },
                  { value: 'receipts', label: t('logs.option.includeReceipts') },
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
          </AccordionSection>

          <Card variant="outline" className="gap-1.5">
            <AppText variant="label">{t('logs.preview.title')}</AppText>
            {previewStatus === 'loading' ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={theme.textSecondary} />
                <AppText variant="caption" color="secondary">
                  {t('logs.preview.calculating')}
                </AppText>
              </View>
            ) : previewStatus === 'error' || !preview ? (
              <AppText variant="caption" color="destructive">
                {previewError ?? t('logs.preview.errorFallback')}
              </AppText>
            ) : (
              <View style={styles.previewGrid}>
                <AppText variant="caption" color="secondary">
                  {t('logs.preview.vehicleCount', { value: preview.vehicleCount })}
                </AppText>
                <AppText variant="caption" color="secondary">
                  {t('logs.preview.tripCount', { value: preview.tripCount })}
                </AppText>
                <AppText variant="caption" color="secondary">
                  {t('logs.preview.fuelCount', { value: preview.fuelCount })}
                </AppText>
                <AppText variant="caption" color="secondary">
                  {t('logs.preview.totalDistance', { value: preview.totalDistanceKm })}
                </AppText>
                <AppText variant="caption" color="secondary">
                  {t('logs.preview.workDistance', { value: preview.businessDistanceKm })}
                </AppText>
                <AppText variant="caption" color="secondary">
                  {t('logs.preview.privateDistance', { value: preview.privateDistanceKm })}
                </AppText>
                <AppText variant="caption" color="secondary">
                  {t('logs.preview.unclassifiedDistance', { value: preview.unclassifiedDistanceKm })}
                </AppText>
                <AppText variant="caption" color="secondary">
                  {t('logs.preview.fuelSpend', { value: preview.fuelSpendTotal.toFixed(2) })}
                </AppText>
              </View>
            )}
          </Card>

          <Button
            variant="primary"
            label={exportingPdf ? t('logs.generatingPdf') : t('logs.generatePdf')}
            onPress={() => void handleGeneratePdf()}
            disabled={exportingPdf || Boolean(validationErrorKey)}
          />

          <Card className="gap-2">
            <SectionHeader
              title={t('logs.timeline.title')}
              description={t('logs.timeline.description')}
              actionLabel={showTimeline ? t('logs.timeline.hide') : t('logs.timeline.show')}
              onAction={() => setShowTimeline((current) => !current)}
              className="mb-1"
            />

            {showTimeline ? (
              <>
                <FormField label={t('logs.timeline.searchLabel')}>
                  <Input
                    value={timelineSearch}
                    onChangeText={setTimelineSearch}
                    placeholder={t('logs.timeline.searchPlaceholder')}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </FormField>

                {timelineStatus === 'loading' ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color={theme.textSecondary} />
                    <AppText variant="caption" color="secondary">
                      {t('logs.timeline.loading')}
                    </AppText>
                  </View>
                ) : timelineStatus === 'error' ? (
                  <AppText variant="caption" color="destructive">
                    {timelineError ?? t('logs.timeline.errorFallback')}
                  </AppText>
                ) : timelineEntries.length === 0 ? (
                  <EmptyState title={t('logs.timeline.emptyTitle')} description={t('logs.timeline.emptyDescription')} />
                ) : (
                  timelineEntries.map((entry) => (
                    <ListRow
                      key={entry.id}
                      title={entry.type === 'trip' ? t('logs.timeline.entryTypeTrip') : t('logs.timeline.entryTypeFuel')}
                      subtitle={`${entry.vehicleName} | ${entry.summary}`}
                      meta={formatDate(entry.date)}
                      onPress={() =>
                        runGuarded(() => {
                          router.push({
                            pathname: '/entries/[entryId]',
                            params: { entryId: entry.id },
                          });
                        })
                      }
                    />
                  ))
                )}
              </>
            ) : (
              <AppText variant="caption" color="secondary">
                {t('logs.timeline.hiddenHint')}
              </AppText>
            )}
          </Card>

          {vehiclesStatus === 'error' ? (
            <Card tone="warning">
              <AppText variant="caption" color="warning">
                {t('logs.warning.vehiclesLoad')}
              </AppText>
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
