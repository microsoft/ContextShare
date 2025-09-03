import * as fs from 'fs/promises';
import * as path from 'path';
import { generateUserVariantFilename } from './naming';

/**
 * Preserves a file with a variant name to avoid conflicts
 * @param filePath - Path to the file to preserve
 * @param logger - Logger function for debugging
 * @returns Promise<string> - The new file path where the file was preserved
 */
export async function preserveFileWithVariant(
  filePath: string,
  logger: (msg: string) => Promise<void>
): Promise<string> {
  const dir = path.dirname(filePath);
  await logger(`Attempting to preserve file: ${filePath}`);
  await logger(`Target directory: ${dir}`);
  
  const entries = await fs.readdir(dir).catch(() => [] as string[]);
  const existing = new Set<string>(entries);
  const newName = generateUserVariantFilename(path.basename(filePath), existing);
  const newPath = path.join(dir, newName);
  
  await logger(`Generated new filename: ${newName}`);
  await logger(`Full new path: ${newPath}`);
  
  await fs.copyFile(filePath, newPath);
  await logger(`Successfully preserved file: ${newPath}`);
  
  return newPath;
}
