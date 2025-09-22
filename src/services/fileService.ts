// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import * as fs from 'fs/promises';
import * as path from 'path';
import { IFileService } from '../models';

export class FileService implements IFileService {
  async readFile(p: string): Promise<string> {
    return fs.readFile(p, 'utf-8');
  }
  async writeFile(p: string, content: string): Promise<void> {
    return fs.writeFile(p, content, 'utf-8');
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
    return fs.readdir(p);
  }
  async stat(p: string): Promise<'file' | 'dir' | 'other' | 'missing'> {
    try {
      const stat = await fs.stat(p);
      if (stat.isFile()) return 'file';
      if (stat.isDirectory()) return 'dir';
      return 'other';
    } catch {
      return 'missing';
    }
  }
  async copyFile(src: string, dest: string): Promise<void> {
    return fs.copyFile(src, dest);
  }
  async deleteFile(p: string): Promise<void> {
    return fs.unlink(p);
  }
  async rm(path: string, options?: { recursive?: boolean; force?: boolean }): Promise<void> {
    return fs.rm(path, options);
  }
}
