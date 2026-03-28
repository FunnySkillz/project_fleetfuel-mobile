import * as FileSystem from 'expo-file-system/legacy';

const RECEIPTS_DIR_NAME = 'receipts';

function getReceiptsDirectory() {
  const baseDir = FileSystem.documentDirectory;
  if (!baseDir) {
    throw new Error('App document directory is unavailable.');
  }

  return `${baseDir}${RECEIPTS_DIR_NAME}`;
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function inferExtension(sourceUri: string, preferredName?: string | null) {
  const fromName = preferredName ? preferredName.split('.').pop() : null;
  if (fromName && fromName.length <= 8) {
    return fromName.toLowerCase();
  }

  const cleanUri = sourceUri.split('?')[0];
  const fromUri = cleanUri.includes('.') ? cleanUri.split('.').pop() : null;
  if (fromUri && fromUri.length <= 8) {
    return fromUri.toLowerCase();
  }

  return 'bin';
}

export async function copyReceiptToAppStorage(input: {
  sourceUri: string;
  preferredName?: string | null;
  prefix?: 'receipt_photo' | 'receipt_pdf' | 'receipt_file';
}) {
  const receiptsDir = getReceiptsDirectory();
  await FileSystem.makeDirectoryAsync(receiptsDir, { intermediates: true });

  const extension = inferExtension(input.sourceUri, input.preferredName);
  const prefix = input.prefix ?? 'receipt_file';
  const fileName = sanitizeFileName(
    `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}.${extension}`,
  );

  const targetUri = `${receiptsDir}/${fileName}`;
  await FileSystem.copyAsync({ from: input.sourceUri, to: targetUri });

  return {
    uri: targetUri,
    name: input.preferredName ? sanitizeFileName(input.preferredName) : fileName,
  };
}
