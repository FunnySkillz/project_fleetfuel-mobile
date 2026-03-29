import { classifyReceiptOrphans } from '@/services/receipts/receipt-maintenance-core';
import { describe, expect, it } from 'vitest';

describe('receipt orphan classification', () => {
  it('classifies orphan files correctly', () => {
    const report = classifyReceiptOrphans({
      referencedUris: [
        'file:///docs/receipts/a.jpg',
        'file:///docs/receipts/b.jpg',
      ],
      receiptFiles: [
        'file:///docs/receipts/a.jpg',
        'file:///docs/receipts/c.jpg',
        'file:///docs/receipts/c.jpg',
      ],
      scanTimestamp: '2026-03-29T10:00:00.000Z',
    });

    expect(report.referencedCount).toBe(2);
    expect(report.orphanCount).toBe(1);
    expect(report.orphanFiles).toEqual(['file:///docs/receipts/c.jpg']);
    expect(report.scanTimestamp).toBe('2026-03-29T10:00:00.000Z');
  });

  it('returns no orphans when every file is referenced', () => {
    const report = classifyReceiptOrphans({
      referencedUris: ['file:///docs/receipts/a.jpg'],
      receiptFiles: ['file:///docs/receipts/a.jpg'],
    });

    expect(report.orphanCount).toBe(0);
    expect(report.orphanFiles).toEqual([]);
  });
});
