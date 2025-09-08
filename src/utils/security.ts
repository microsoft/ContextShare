// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Lightweight filename/entry sanitization helpers
// - sanitizeFilename: strips directory separators and disallowed characters
// - isSafeRelativeEntry: ensures the entry doesn't attempt path traversal or absolute paths

export function sanitizeFilename(name: string): string {
  const base = (name || '').split(/[\\/]/).pop() || '';
  // Remove characters that are problematic on Windows/macOS/Linux filesystems
  // Also handle Unicode control characters and zero-width characters
  const cleaned = base.replace(/[\0-\x1F<>:\"|?*\u200B-\u200D\uFEFF]/g, '').trim();
  // Prevent hidden dot-files if source tried to craft them unintentionally
  if(cleaned === '' || cleaned === '.' || cleaned === '..') return 'file.txt';
  // Prevent excessively long filenames (255 chars is typical filesystem limit)
  return cleaned.length > 200 ? cleaned.substring(0, 200) + '.txt' : cleaned;
}

export function isSafeRelativeEntry(entry: string): boolean {
  if(!entry) return false;
  // Disallow absolute paths or drive-letter paths
  if(/^[a-zA-Z]:[\\/]/.test(entry)) return false;
  if(entry.startsWith('/') || entry.startsWith('\\')) return false;
  // Disallow path traversal (including encoded variants)
  if(entry.includes('..') || entry.includes('%2e%2e') || entry.includes('%2E%2E')) return false;
  // Disallow UNC paths and network shares
  if(entry.startsWith('\\\\') || entry.startsWith('//')) return false;
  // Disallow null bytes and control characters
  if(/[\0-\x1F]/.test(entry)) return false;
  // Reasonable length limit to prevent buffer overflow attacks
  if(entry.length > 1000) return false;
  return true;
}

/**
 * Validates that a URL is HTTPS-only and from a reasonable domain
 */
export function isValidHttpsUrl(url: string): boolean {
  if(!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    // Only HTTPS allowed
    if(parsed.protocol !== 'https:') return false;
    // Disallow localhost and private IP ranges for security
    if(parsed.hostname === 'localhost' || 
       parsed.hostname === '127.0.0.1' || 
       /^192\.168\./.test(parsed.hostname) ||
       /^10\./.test(parsed.hostname) ||
       /^172\.(1[6-9]|2[0-9]|3[01])\./.test(parsed.hostname)) {
      return false;
    }
    // Reasonable URL length limit
    if(url.length > 2000) return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitizes error messages to prevent information disclosure
 */
export function sanitizeErrorMessage(error: any): string {
  if (!error) return 'Unknown error';
  
  const message = typeof error === 'string' ? error : (error.message || String(error));
  
  // Remove potential file paths (Windows and Unix)
  const cleaned = message
    .replace(/[A-Za-z]:\\[^\\/:*?"<>|\r\n]*\\[^\\/:*?"<>|\r\n]*\\/g, '[REDACTED_PATH]\\')
    .replace(/\/[^\/\s:*?"<>|\r\n]*\/[^\/\s:*?"<>|\r\n]*\//g, '/[REDACTED_PATH]/')
    .replace(/\b(file|directory|path|folder):\s*[^\s]+/gi, '$1: [REDACTED]')
    .replace(/\b[A-Za-z]:[\\\/][^\s]*[\\\/]/g, '[REDACTED_PATH]')
    .replace(/\b\/[^\s]*\/[^\s]*/g, '[REDACTED_PATH]');
  
  return cleaned.substring(0, 200); // Limit length
}

/**
 * Basic JSON schema validation for MCP configurations
 */
export function validateMcpConfig(obj: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: ['Configuration must be an object'] };
  }
  
  // Validate inputs array if present
  if ('inputs' in obj) {
    if (!Array.isArray(obj.inputs)) {
      errors.push('inputs must be an array');
    } else {
      obj.inputs.forEach((input: any, index: number) => {
        if (!input || typeof input !== 'object') {
          errors.push(`inputs[${index}] must be an object`);
        } else if (!input.id || typeof input.id !== 'string') {
          errors.push(`inputs[${index}].id must be a string`);
        }
      });
    }
  }
  
  // Validate servers object if present
  if ('servers' in obj || 'mcpServers' in obj) {
    const servers = obj.servers || obj.mcpServers;
    if (!servers || typeof servers !== 'object' || Array.isArray(servers)) {
      errors.push('servers must be an object');
    } else {
      Object.entries(servers).forEach(([name, config]: [string, any]) => {
        if (!config || typeof config !== 'object') {
          errors.push(`servers.${name} must be an object`);
        }
        // Basic server config validation
        if (config && typeof config === 'object') {
          if ('command' in config && typeof config.command !== 'string') {
            errors.push(`servers.${name}.command must be a string`);
          }
          if ('args' in config && !Array.isArray(config.args)) {
            errors.push(`servers.${name}.args must be an array`);
          }
        }
      });
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Basic JSON schema validation for VS Code task configurations
 */
export function validateTaskConfig(obj: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!obj || typeof obj !== 'object') {
    return { valid: false, errors: ['Task configuration must be an object'] };
  }
  
  // Check for tasks array or single task
  const tasks = Array.isArray(obj.tasks) ? obj.tasks : 
                (obj.vscodeTask || obj.vsCodeTask) ? [obj.vscodeTask || obj.vsCodeTask] :
                (obj.type || obj.label) ? [obj] : [];
  
  if (tasks.length === 0) {
    errors.push('No valid tasks found in configuration');
  }
  
  tasks.forEach((task: any, index: number) => {
    if (!task || typeof task !== 'object') {
      errors.push(`Task ${index} must be an object`);
      return;
    }
    
    if (!task.label || typeof task.label !== 'string') {
      errors.push(`Task ${index} must have a string label`);
    }
    
    if (!task.type || typeof task.type !== 'string') {
      errors.push(`Task ${index} must have a string type`);
    }
    
    if (task.type === 'shell' && (!task.command || typeof task.command !== 'string')) {
      errors.push(`Shell task ${index} must have a string command`);
    }
    
    if ('args' in task && !Array.isArray(task.args)) {
      errors.push(`Task ${index} args must be an array`);
    }
  });
  
  return { valid: errors.length === 0, errors };
}
