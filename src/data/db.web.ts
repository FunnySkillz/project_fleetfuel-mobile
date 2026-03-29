const WEB_SQLITE_UNAVAILABLE_MESSAGE =
  'SQLite-backed local storage is currently unavailable on web for this build configuration.';

export { DATABASE_NAME, SCHEMA_VERSION } from '@/data/schema';

export async function getDatabase(): Promise<never> {
  throw new Error(WEB_SQLITE_UNAVAILABLE_MESSAGE);
}

export async function runInWriteTransaction<T>(task: (txn: never) => Promise<T>): Promise<T> {
  void task;
  throw new Error(WEB_SQLITE_UNAVAILABLE_MESSAGE);
}

export async function resetDatabaseConnection(): Promise<void> {
  // No-op on web fallback build.
}

export async function checkDatabaseHealth(): Promise<void> {
  throw new Error(WEB_SQLITE_UNAVAILABLE_MESSAGE);
}
