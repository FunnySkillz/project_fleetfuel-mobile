export function normalizeRequiredText(value: string, fieldName: string) {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }
  return normalized;
}

export function normalizeOptionalText(value: string | null | undefined) {
  const normalized = (value ?? '').trim().replace(/\s+/g, ' ');
  return normalized.length > 0 ? normalized : null;
}

export function normalizePlate(value: string) {
  return normalizeRequiredText(value, 'License plate').toUpperCase();
}

export function normalizeSearch(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

export function assertValidPrivateTag(value: string | null | undefined): 'private' | 'business' | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (value === 'private' || value === 'business') {
    return value;
  }

  throw new Error('Invalid private/business tag.');
}

export function ensureValidDayDate(value: string | null | undefined, fieldName: string) {
  if (!value) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${fieldName} must use YYYY-MM-DD format.`);
  }

  return value;
}

export function ensureValidTime(value: string | null | undefined, fieldName: string) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    return null;
  }

  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(normalized)) {
    throw new Error(`${fieldName} must use HH:MM (24h) format.`);
  }

  return normalized;
}

export function buildDayRangeIso(value: string | null | undefined, edge: 'start' | 'end') {
  const day = ensureValidDayDate(value, edge === 'start' ? 'From date' : 'To date');
  if (!day) {
    return null;
  }

  return edge === 'start' ? `${day}T00:00:00.000Z` : `${day}T23:59:59.999Z`;
}

export function formatIsoDate(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return iso;
  }

  return parsed.toISOString().slice(0, 10);
}

export function normalizeOptionalInteger(value: number | null | undefined, fieldName: string, min: number, max: number) {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isInteger(value)) {
    throw new Error(`${fieldName} must be a whole number.`);
  }

  if (value < min || value > max) {
    throw new Error(`${fieldName} must be between ${min} and ${max}.`);
  }

  return value;
}
