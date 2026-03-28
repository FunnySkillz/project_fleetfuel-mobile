export function createId(prefix: 'veh' | 'trip' | 'fuel') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${timestamp}_${random}`;
}

export function nowIso() {
  return new Date().toISOString();
}

