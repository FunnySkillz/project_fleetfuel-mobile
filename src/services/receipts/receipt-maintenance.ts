import { fuelRepo } from '@/data/repositories';
import { deleteFileIfExists, listReceiptFiles } from '@/utils/receipt-files';

import { classifyReceiptOrphans, type ReceiptCleanupReport } from './receipt-maintenance-core';

export type ReceiptCleanupResult = {
  deletedCount: number;
  failed: { uri: string; reason: string }[];
  deletedFiles: string[];
};

export async function scanReceiptCleanupReport(): Promise<ReceiptCleanupReport> {
  const [referencedUris, receiptFiles] = await Promise.all([
    fuelRepo.listActiveReceiptUris(),
    listReceiptFiles(),
  ]);

  return classifyReceiptOrphans({ referencedUris, receiptFiles });
}

export async function cleanupOrphanReceipts(orphanFiles: string[]): Promise<ReceiptCleanupResult> {
  const uniqueOrphans = Array.from(new Set(orphanFiles.map((uri) => uri.trim()).filter((uri) => uri.length > 0)));
  const result: ReceiptCleanupResult = {
    deletedCount: 0,
    failed: [],
    deletedFiles: [],
  };

  for (const uri of uniqueOrphans) {
    try {
      const deleted = await deleteFileIfExists(uri);
      if (deleted) {
        result.deletedCount += 1;
        result.deletedFiles.push(uri);
      }
    } catch (error) {
      result.failed.push({
        uri,
        reason: error instanceof Error ? error.message : 'Unknown delete failure.',
      });
    }
  }

  return result;
}
