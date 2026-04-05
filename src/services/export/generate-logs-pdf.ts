import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { logsRepo } from '@/data/repositories';
import type { ExportFuelRow, ExportTripRow, ExportVehicleSection, LogsExportDataset, LogsExportFilters } from '@/data/types';
import { formatIsoDateLocal } from '@/utils/date-format';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso: string) {
  return formatIsoDateLocal(iso);
}

function formatDateTime(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }

  return `${parsed.toISOString().slice(0, 10)} ${parsed.toISOString().slice(11, 16)} UTC`;
}

function formatCurrency(value: number) {
  return `EUR ${value.toFixed(2)}`;
}

function usageLabel(usage: LogsExportFilters['usageType']) {
  if (usage === 'work') {
    return 'Work trips';
  }

  if (usage === 'private') {
    return 'Private trips';
  }

  if (usage === 'unclassified') {
    return 'Unclassified trips';
  }

  return 'Work + Private';
}

function tripMarker(tag: ExportTripRow['privateTag']) {
  if (tag === 'business') {
    return 'Work';
  }

  if (tag === 'private') {
    return 'Private';
  }

  return 'Unclassified';
}

function fuelTypeLabel(value: ExportFuelRow['fuelType']) {
  if (!value) {
    return 'Unspecified';
  }

  const labels: Record<NonNullable<ExportFuelRow['fuelType']>, string> = {
    petrol: 'Petrol',
    diesel: 'Diesel',
    electric: 'Electric',
    hybrid: 'Hybrid',
    lpg: 'LPG',
    cng: 'CNG',
    other: 'Other',
  };

  return labels[value];
}

function dateRangeLabel(filters: LogsExportFilters) {
  if (filters.fromDate || filters.toDate) {
    return `${filters.fromDate ?? 'start'}_to_${filters.toDate ?? 'now'}`;
  }

  if (filters.year) {
    return `year_${filters.year}`;
  }

  return 'all_dates';
}

function vehicleScopeLabel(filters: LogsExportFilters) {
  if (filters.vehicleIds.length === 0) {
    return 'all_vehicles';
  }

  return `${filters.vehicleIds.length}_vehicles`;
}

function buildFileName(dataset: LogsExportDataset) {
  const parsed = new Date(dataset.generatedAt);
  const timestamp = Number.isNaN(parsed.getTime())
    ? Date.now().toString()
    : parsed.toISOString().replace(/[-:]/g, '').slice(0, 15);
  const nonce = Math.random().toString(36).slice(2, 6);
  const range = dateRangeLabel(dataset.filters);
  const scope = vehicleScopeLabel(dataset.filters);

  return `fleetfuel_logs_${range}_${scope}_${timestamp}_${nonce}.pdf`;
}

function renderTripTableRows(trips: ExportTripRow[]) {
  if (trips.length === 0) {
    return '<tr><td colspan="6" class="muted">No matching trips.</td></tr>';
  }

  return trips
    .map(
      (trip) => `
      <tr>
        <td>${escapeHtml(formatDate(trip.occurredAt))}</td>
        <td>${escapeHtml(tripMarker(trip.privateTag))}</td>
        <td>${escapeHtml(trip.purpose)}</td>
        <td>${trip.startOdometerKm}</td>
        <td>${trip.endOdometerKm}</td>
        <td>${trip.distanceKm} km</td>
      </tr>
    `,
    )
    .join('');
}

function renderFuelTableRows(fuelEntries: ExportFuelRow[]) {
  if (fuelEntries.length === 0) {
    return '<tr><td colspan="7" class="muted">No matching fuel entries.</td></tr>';
  }

  return fuelEntries
    .map(
      (fuel) => `
      <tr>
        <td>${escapeHtml(formatDate(fuel.occurredAt))}</td>
        <td>${escapeHtml(fuelTypeLabel(fuel.fuelType))}</td>
        <td>${escapeHtml(fuel.station)}</td>
        <td>${fuel.liters.toFixed(2)} L</td>
        <td>${fuel.fuelInTankAfterRefuelLiters !== null ? `${fuel.fuelInTankAfterRefuelLiters.toFixed(2)} L` : '-'}</td>
        <td>${escapeHtml(formatCurrency(fuel.totalPrice))}</td>
        <td>${fuel.odometerKm ?? '-'}</td>
      </tr>
    `,
    )
    .join('');
}

function renderVehicleSection(section: ExportVehicleSection, includeFuel: boolean) {
  const tripRows = renderTripTableRows(section.trips);
  const fuelRows = renderFuelTableRows(section.fuelEntries);

  return `
    <section class="section">
      <h2>${escapeHtml(section.vehicleName)} <span class="plate">(${escapeHtml(section.vehiclePlate)})</span></h2>
      <div class="meta-grid">
        <div><strong>Trips:</strong> ${section.totals.tripCount}</div>
        <div><strong>Distance:</strong> ${section.totals.distanceKm} km</div>
        <div><strong>Work:</strong> ${section.totals.businessDistanceKm} km</div>
        <div><strong>Private:</strong> ${section.totals.privateDistanceKm} km</div>
        <div><strong>Unclassified:</strong> ${section.totals.unclassifiedDistanceKm} km</div>
        <div><strong>Fuel spend:</strong> ${escapeHtml(formatCurrency(section.totals.fuelSpendTotal))}</div>
      </div>

      <h3>Trips</h3>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Usage</th>
            <th>Purpose</th>
            <th>Start km</th>
            <th>End km</th>
            <th>Distance</th>
          </tr>
        </thead>
        <tbody>${tripRows}</tbody>
      </table>

      ${
        includeFuel
          ? `
      <h3>Fuel Entries</h3>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Fuel type</th>
            <th>Station</th>
            <th>Liters</th>
            <th>Tank level</th>
            <th>Total</th>
            <th>Odometer</th>
          </tr>
        </thead>
        <tbody>${fuelRows}</tbody>
      </table>
      `
          : ''
      }
    </section>
  `;
}

function renderReceiptAppendix(dataset: LogsExportDataset) {
  if (!dataset.filters.includeReceipts) {
    return '';
  }

  const rows = dataset.vehicles.flatMap((vehicle) =>
    vehicle.fuelEntries
      .filter((fuel) => Boolean(fuel.receiptUri))
      .map(
        (fuel) => `
          <tr>
            <td>${escapeHtml(vehicle.vehicleName)}</td>
            <td>${escapeHtml(formatDate(fuel.occurredAt))}</td>
            <td>${escapeHtml(fuel.receiptName ?? 'Receipt')}</td>
            <td>${escapeHtml(fuel.receiptUri ?? '')}</td>
          </tr>
        `,
      ),
  );

  if (rows.length === 0) {
    return '';
  }

  return `
    <section class="section">
      <h2>Receipt Appendix</h2>
      <table>
        <thead>
          <tr>
            <th>Vehicle</th>
            <th>Date</th>
            <th>File</th>
            <th>Stored URI</th>
          </tr>
        </thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </section>
  `;
}

function renderDatasetHtml(dataset: LogsExportDataset) {
  const filterSummary = [
    `Generated: ${formatDateTime(dataset.generatedAt)}`,
    `Usage scope: ${usageLabel(dataset.filters.usageType)}`,
    `Fuel type scope: ${dataset.filters.fuelType === 'all' ? 'All fuel types' : fuelTypeLabel(dataset.filters.fuelType)}`,
    `Vehicles: ${dataset.filters.vehicleIds.length === 0 ? 'All vehicles' : `${dataset.filters.vehicleIds.length} selected`}`,
    `Date scope: ${dataset.filters.fromDate || dataset.filters.toDate ? `${dataset.filters.fromDate ?? 'start'} -> ${dataset.filters.toDate ?? 'now'}` : dataset.filters.year ? `Year ${dataset.filters.year}` : 'All dates'}`,
    `Include fuel entries: ${dataset.filters.includeFuel ? 'Yes' : 'No'}`,
    `Include receipt appendix: ${dataset.filters.includeReceipts ? 'Yes' : 'No'}`,
  ];

  const vehicleSections = dataset.vehicles.map((section) => renderVehicleSection(section, dataset.filters.includeFuel)).join('');
  const receiptAppendix = renderReceiptAppendix(dataset);

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 24px; color: #1f2937; }
        h1 { margin: 0 0 12px; font-size: 24px; }
        h2 { margin: 0 0 12px; font-size: 18px; }
        h3 { margin: 16px 0 8px; font-size: 14px; }
        .plate { color: #6b7280; font-weight: 500; }
        .summary { margin-bottom: 20px; padding: 16px; border: 1px solid #d1d5db; border-radius: 10px; }
        .summary li { margin-bottom: 6px; }
        .totals { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
        .section { margin-top: 28px; page-break-inside: avoid; }
        .meta-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-bottom: 12px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        th, td { border: 1px solid #d1d5db; padding: 6px; font-size: 11px; text-align: left; vertical-align: top; }
        th { background: #f3f4f6; }
        .muted { color: #6b7280; }
      </style>
    </head>
    <body>
      <h1>FleetFuel Export Report</h1>
      <div class="summary">
        <ul>
          ${filterSummary.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
        </ul>
        <div class="totals">
          <div><strong>Trip rows:</strong> ${dataset.preview.tripCount}</div>
          <div><strong>Fuel rows:</strong> ${dataset.preview.fuelCount}</div>
          <div><strong>Total distance:</strong> ${dataset.preview.totalDistanceKm} km</div>
          <div><strong>Fuel spend:</strong> ${escapeHtml(formatCurrency(dataset.preview.fuelSpendTotal))}</div>
          <div><strong>Work distance:</strong> ${dataset.preview.businessDistanceKm} km</div>
          <div><strong>Private distance:</strong> ${dataset.preview.privateDistanceKm} km</div>
        </div>
      </div>

      ${vehicleSections || '<p class="muted">No matching records for the current filters.</p>'}
      ${receiptAppendix}
    </body>
  </html>
  `;
}

function getExportDirectory() {
  const baseDir = FileSystem.documentDirectory;
  if (!baseDir) {
    throw new Error('Document directory is unavailable for PDF export.');
  }

  return `${baseDir}exports`;
}

export async function generateLogsPdf(
  filters: Partial<LogsExportFilters> = {},
): Promise<{ uri: string; fileName: string; dataset: LogsExportDataset }> {
  const dataset = await logsRepo.getExportDataset(filters);
  const html = renderDatasetHtml(dataset);
  const fileName = buildFileName(dataset);

  const generated = await Print.printToFileAsync({ html });
  const exportDir = getExportDirectory();
  await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });
  const targetUri = `${exportDir}/${fileName}`;
  await FileSystem.copyAsync({ from: generated.uri, to: targetUri });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(targetUri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Share FleetFuel export',
    });
  }

  return {
    uri: targetUri,
    fileName,
    dataset,
  };
}

