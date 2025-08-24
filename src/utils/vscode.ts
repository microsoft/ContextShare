/**
 * Utility for safely importing VS Code API in environments where it may not be available (e.g., tests)
 */
export function getVSCode(): typeof import('vscode') | undefined {
  try {
    return require('vscode');
  } catch {
    // In test mode or other environments where vscode is not available
    return undefined;
  }
}
