// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
/**
 * Utility for error message formatting and user notification
 */

/**
 * Extracts a readable error message from any error object
 * @param error - The error to extract a message from
 * @returns A string representation of the error
 */
export function getErrorMessage(error: any): string {
  return error?.message || error?.toString() || 'Unknown error';
}

/**
 * Handles an error with logging and user notification
 * @param error - The error that occurred
 * @param action - Description of the action that failed
 * @param logger - Logger function for debugging
 * @param vscode - VS Code API (optional for environments where it may not be available)
 */
export async function handleErrorWithNotification(
  error: any,
  action: string,
  logger: (msg: string) => Promise<void>,
  vscode?: typeof import('vscode')
): Promise<void> {
  const errorMessage = getErrorMessage(error);
  const logMessage = `${action} failed: ${errorMessage}`;
  
  await logger(logMessage);
  
  if (vscode?.window) {
    vscode.window.showErrorMessage(`Failed to ${action}: ${errorMessage}`);
  }
}
