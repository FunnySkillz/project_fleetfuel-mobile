const WEB_SQLITE_UNAVAILABLE_MESSAGE =
  'SQLite-backed local storage is currently unavailable on web for this build configuration.';

export async function getDatabase(): Promise<never> {
  throw new Error(WEB_SQLITE_UNAVAILABLE_MESSAGE);
}

export async function runInWriteTransaction<T>(task: (txn: never) => Promise<T>): Promise<T> {
  void task;
  throw new Error(WEB_SQLITE_UNAVAILABLE_MESSAGE);
}
