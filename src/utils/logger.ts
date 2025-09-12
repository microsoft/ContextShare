// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private channel?: vscode.OutputChannel;
  private filePath?: string;
  private enableFile = false;
  private initialized = false;
  private channelName = 'ContextShare';

  init(context?: vscode.ExtensionContext, options?: { enableFileLogging?: boolean; filePath?: string; channelName?: string }){
    if(this.initialized) return;
    this.initialized = true;
    if(options?.channelName) this.channelName = options.channelName;
    try{
      this.channel = vscode.window.createOutputChannel(this.channelName);
    }catch(err){
      // Not running in VS Code environment — leave channel undefined
      this.channel = undefined;
      console.error(`[Logger] Failed to create output channel "${this.channelName}":`, err);
    }
    this.enableFile = !!options?.enableFileLogging;
    if(options?.filePath) this.filePath = options.filePath;
    // If not provided but context is available, choose a sensible default
    if(!this.filePath && context?.globalStorageUri){
      this.filePath = path.join(context.globalStorageUri.fsPath, 'contextshare-debug.log');
    }
  }

  private format(level: LogLevel, msg: string, meta?: Record<string, any>){
    const time = new Date().toISOString();
    const entry = { ts: time, level, msg, meta };
    return JSON.stringify(entry);
  }

  private async writeToFile(line: string){
    if(!this.enableFile || !this.filePath) return;
    try{
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.appendFile(this.filePath, line + '\n');
    }catch(_){ /* Best-effort file logging — swallow errors to avoid cascading failures */ }
  }

  private writeToChannel(line: string){
    try{
      this.channel?.appendLine(line);
    }catch(_){ /* ignore */ }
  }

  async log(level: LogLevel, msg: string, meta?: Record<string, any>){
    const line = this.format(level, msg, meta);
    // Human-readable prefix for output channel
    const pretty = `[${new Date().toISOString()}] ${level.toUpperCase()}: ${msg}`;
    this.writeToChannel(pretty);
    await this.writeToFile(line);
  }

  async debug(msg: string, meta?: Record<string, any>){ await this.log('debug', msg, meta); }
  async info(msg: string, meta?: Record<string, any>){ await this.log('info', msg, meta); }
  async warn(msg: string, meta?: Record<string, any>){ await this.log('warn', msg, meta); }
  async error(msg: string, meta?: Record<string, any>){ await this.log('error', msg, meta); }

  // Return a compatible function for older APIs that expect (msg:string) => void
  asFunction(): (msg: string) => void {
    return (msg: string) => { void this.info(msg); };
  }
}

export const logger = new Logger();
export default logger;
