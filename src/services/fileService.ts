// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import * as fs from 'fs/promises';
import * as path from 'path';
import { IFileService } from '../models';

/**
 * Ensures the parent directory exists for the given file path
 * @param filePath - The file path to ensure parent directory for
 */
async function ensureParentDirectory(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export class FileService implements IFileService {
  async readFile(p: string): Promise<string> {
    return fs.readFile(p, 'utf8');
  }

  async writeFile(p: string, content: string): Promise<void> {
    await ensureParentDirectory(p);
    await fs.writeFile(p, content, 'utf8');
  }

  async ensureDirectory(p: string): Promise<void> {
    await fs.mkdir(p, { recursive: true });
  }

  async pathExists(p: string): Promise<boolean> {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }

  async listDirectory(p: string): Promise<string[]> {
    try {
      return await fs.readdir(p);
    } catch {
      return [];
    }
  }

  async stat(p: string): Promise<'file' | 'dir' | 'other' | 'missing'> {
    try {
      const s = await fs.lstat(p);
      if (s.isFile()) return 'file';
      if (s.isDirectory()) return 'dir';
      return 'other';
    } catch {
      return 'missing';
    }
  }

  async copyFile(src: string, dest: string): Promise<void> {
    await ensureParentDirectory(dest);
    await fs.copyFile(src, dest);
  }

  async deleteFile(p: string): Promise<void> {
    try {
      await fs.unlink(p);
    } catch {
      // Ignore errors when deleting files that don't exist
    }
  }
}
