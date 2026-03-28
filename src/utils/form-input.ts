export function sanitizePlateInput(value: string, maxLength: number) {
  return value.toUpperCase().replace(/[^A-Z0-9 -]/g, '').slice(0, maxLength);
}

export function sanitizeIntegerInput(value: string, maxLength: number) {
  return value.replace(/[^\d]/g, '').slice(0, maxLength);
}

export function sanitizeDecimalInput(
  value: string,
  maxIntegerDigits: number,
  maxFractionDigits: number,
) {
  const normalized = value.replace(',', '.').replace(/[^\d.]/g, '');
  const firstDotIndex = normalized.indexOf('.');

  if (firstDotIndex === -1) {
    return normalized.slice(0, maxIntegerDigits);
  }

  const integerPart = normalized.slice(0, firstDotIndex).replace(/\./g, '').slice(0, maxIntegerDigits);
  const fractionPart = normalized
    .slice(firstDotIndex + 1)
    .replace(/\./g, '')
    .slice(0, maxFractionDigits);

  return `${integerPart}.${fractionPart}`;
}

export function parseIntegerValue(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseDecimalValue(value: string) {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return null;
  if (!/^\d*(\.\d+)?$/.test(normalized)) return null;
  if (!/\d/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function trimmedLength(value: string) {
  return value.trim().length;
}

