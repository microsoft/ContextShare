// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Lightweight filename/entry sanitization helpers
// - sanitizeFilename: strips directory separators and disallowed characters
// - isSafeRelativeEntry: ensures the entry doesn't attempt path traversal or absolute paths

export function sanitizeFilename(name: string): string {
  const base = (name || '').split(/[\\/]/).pop() || '';
  // Remove characters that are problematic on Windows/macOS/Linux filesystems
  const cleaned = base.replace(/[\0<>:\"|?*]/g, '').trim();
  // Prevent hidden dot-files if source tried to craft them unintentionally
  if(cleaned === '' || cleaned === '.' || cleaned === '..') return 'file.txt';
  return cleaned;
}

export function isSafeRelativeEntry(entry: string): boolean {
  if(!entry) return false;
  // Disallow absolute paths or drive-letter paths
  if(/^[a-zA-Z]:[\\/]/.test(entry)) return false;
  if(entry.startsWith('/') || entry.startsWith('\\')) return false;
  // Disallow path traversal
  if(entry.includes('..')) return false;
  return true;
}
