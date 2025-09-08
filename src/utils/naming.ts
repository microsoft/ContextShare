// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// Generate a user variant filename following Copilot naming convention:
// First variant: user.<original>
// Subsequent variants: user.0.<original>, user.1.<original>, ...
// If original already starts with user., treat it as the base and start numbering.
export function generateUserVariantFilename(original: string, existing: Set<string>): string {
  const alreadyUser = original.startsWith('user.');
  const baseName = original;
  const firstCandidate = alreadyUser ? baseName : `user.${baseName}`;
  if(!existing.has(firstCandidate)) return firstCandidate;
  let counter = 0;
  while(existing.has(`user.${counter}.${baseName}`)) counter++;
  return `user.${counter}.${baseName}`;
}
