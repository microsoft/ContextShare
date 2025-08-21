/**
 * Utility functions for displaying resource names in a user-friendly way
 */

import { ResourceCategory } from '../models';
import * as path from 'path';

/**
 * Gets the display name for a catalog directory based on user configuration
 * @param directoryPath The directory path (absolute or relative)
 * @param displayNameMapping User-configured mapping of paths to display names
 * @returns The display name for the catalog
 */
export function getCatalogDisplayName(directoryPath: string, displayNameMapping: Record<string, string> = {}): string {
  // First check if user has configured a custom display name for this exact path
  if (displayNameMapping[directoryPath]) {
    return displayNameMapping[directoryPath];
  }
  
  // Check if user has configured a display name for the normalized absolute path
  const normalizedPath = path.resolve(directoryPath);
  if (displayNameMapping[normalizedPath]) {
    return displayNameMapping[normalizedPath];
  }
  
  // Check for partial path matches (e.g., 'projects/shared/resources' matching '/workspace/projects/shared/resources')
  // Sort by length descending to prefer longer, more specific matches
  const sortedKeys = Object.keys(displayNameMapping).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (directoryPath.endsWith(key) || directoryPath.includes(key)) {
      return displayNameMapping[key];
    }
  }
  
  // Fall back to using the directory basename
  const baseName = path.basename(directoryPath);
  return baseName || 'Unknown';
}

/**
 * Removes file extensions specific to each resource category for cleaner display
 * @param filename The original filename with extension
 * @param category The resource category to determine which extension to remove
 * @returns The filename without the category-specific extension
 */
export function getDisplayName(filename: string, category: ResourceCategory): string {
  let displayName = filename;
  
  switch (category) {
    case ResourceCategory.CHATMODES:
      // Remove .chatmode.md extension
      displayName = filename.replace(/\.chatmode\.md$/i, '');
      // If no change, try generic .md
      if (displayName === filename) {
        displayName = filename.replace(/\.md$/i, '');
      }
      break;
      
    case ResourceCategory.INSTRUCTIONS:
      // Remove .instructions.md extension
      displayName = filename.replace(/\.instructions\.md$/i, '');
      // Also handle .instruction.md (singular)
      if (displayName === filename) {
        displayName = filename.replace(/\.instruction\.md$/i, '');
      }
      // If no change, try generic .md
      if (displayName === filename) {
        displayName = filename.replace(/\.md$/i, '');
      }
      break;
      
    case ResourceCategory.PROMPTS:
      // Remove .prompt.md extension
      displayName = filename.replace(/\.prompt\.md$/i, '');
      // If no change, try generic .md
      if (displayName === filename) {
        displayName = filename.replace(/\.md$/i, '');
      }
      break;
      
    case ResourceCategory.TASKS:
      // Remove .task.json extension
      displayName = filename.replace(/\.task\.json$/i, '');
      // If no change, try generic .json
      if (displayName === filename) {
        displayName = filename.replace(/\.json$/i, '');
      }
      break;
      
    case ResourceCategory.MCP:
      // Remove .mcp.json extension
      displayName = filename.replace(/\.mcp\.json$/i, '');
      // If no change, try generic .json
      if (displayName === filename) {
        displayName = filename.replace(/\.json$/i, '');
      }
      break;
      
    default:
      // For unknown categories, just remove common extensions
      displayName = filename.replace(/\.(md|json|txt)$/i, '');
      break;
  }
  
  return displayName;
}
