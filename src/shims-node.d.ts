// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Minimal Node.js type shims for offline build environments where @types/node isn't installed.
// NOTE: Replace with full @types/node by running `npm install` in a normal dev environment.
declare module 'http' {
  export interface IncomingMessage {
    statusCode?: number;
    headers: Record<string, any>;
    on(event: 'data', handler: (chunk: any)=>void): any;
    on(event: 'end', handler: ()=>void): any;
  }
}

declare module 'https' {
  import { IncomingMessage } from 'http';
  export function get(url: string, cb: (res: IncomingMessage)=>void): { on(event: string, handler: (arg: any)=>void): any };
}

// Buffer shim (very limited, only what we use)
declare const Buffer: { concat(chunks: any[]): { toString(enc: string): string } };

declare const process: {
	platform: string;
	exit(code?: number): never;
};

declare function setTimeout(callback: (...args: any[]) => void, ms: number, ...args: any[]): NodeJS.Timeout;
declare namespace NodeJS {
	interface Timeout {
		ref(): Timeout;
		unref(): Timeout;
	}
}

declare module 'path' {
    export function join(...paths: string[]): string;
    export function dirname(p: string): string;
    export function basename(p: string, ext?: string): string;
    export function isAbsolute(p: string): boolean;
}

declare module 'fs/promises' {
    export function appendFile(path: string, data: string): Promise<void>;
    export function mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
    export function readFile(path: string, encoding: 'utf8'): Promise<string>;
    export function writeFile(path: string, data: string): Promise<void>;
    export function readdir(path: string): Promise<string[]>;
    export function copyFile(src: string, dest: string): Promise<void>;
}
