export type ReceiptCleanupReport = {
  referencedCount: number;
  orphanCount: number;
  orphanFiles: string[];
  scanTimestamp: string;
};

function normalizeUri(uri: string) {
  return uri.trim();
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

export function classifyReceiptOrphans(input: {
  referencedUris: string[];
  receiptFiles: string[];
  scanTimestamp?: string;
}): ReceiptCleanupReport {
  const referenced = unique(input.referencedUris.map(normalizeUri).filter((value) => value.length > 0));
  const files = unique(input.receiptFiles.map(normalizeUri).filter((value) => value.length > 0));

  const referencedSet = new Set(referenced);
  const orphanFiles = files.filter((file) => !referencedSet.has(file)).sort((a, b) => a.localeCompare(b));

  return {
    referencedCount: referenced.length,
    orphanCount: orphanFiles.length,
    orphanFiles,
    scanTimestamp: input.scanTimestamp ?? new Date().toISOString(),
  };
}
