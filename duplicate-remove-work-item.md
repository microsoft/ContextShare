# Duplicate Code Removal Work Item

**Date Created**: August 24, 2025  
**Priority**: Medium  
**Estimated Effort**: 4-6 hours  

## Overview

This work item addresses code duplication patterns identified across the ContextHub extension codebase. The duplicates are primarily in test code but impact maintainability and consistency.

## Current State Analysis

- **Total duplicate/near-duplicate groups**: 8 major patterns
- **Files affected**: 25 TypeScript/JavaScript files  
- **Estimated lines reducible**: 300-400 lines
- **Risk level**: Medium (mostly test code, but affects maintainability)

## Detailed Duplicates Found

### 1. MockFileService Implementations (🔴 EXACT DUPLICATES - 100%)

**Files affected:**
- `test/fileService.mock.ts` (canonical implementation)
- `test/targetWorkspaceUserAssets.test.ts` (duplicate inline class)

**Impact**: ~30 lines of duplicated file service methods

### 2. Test Path Creation Utilities (🟡 NEAR-DUPLICATES - 85%)

**Files affected:**
- `test/testUtils.ts` - `createTestPaths()`
- `debug-repo-discovery.js` - `createTestPaths()` 
- `debug-user-assets.js` - `createTestPaths()`

**Impact**: ~15 lines each, different base directory names but same structure

### 3. Path Validation Test Patterns (🟡 NEAR-DUPLICATES - 90%)

**Files affected:**
- `test/targetPath.test.ts` (8 instances)
- `test/repositoryDiscovery.test.ts` (12+ instances)
- `test/workspaceConfiguration.test.ts` (6+ instances)
- `test/resourceActivation.test.ts` (4+ instances)

**Pattern:**
```typescript
if (normalizePath(actualPath) !== normalizePath(expectedPath)) {
  throw new Error(`Expected path '${expectedPath}', got '${actualPath}'`);
}
```

**Impact**: 40-50 instances of 3-line validation blocks

### 4. Test Console Logging Patterns (🟡 NEAR-DUPLICATES - 95%)

**Files affected:**
- `test/targetPath.test.ts` (8 instances)
- `test/repositoryDiscovery.test.ts` (6 instances)
- `test/resourceActivation.test.ts` (4 instances)
- `test/workspaceConfiguration.test.ts` (3 instances)

**Pattern:** `console.log('✅ Test N: Description');`

**Impact**: ~20 instances

### 5. Repository Discovery Mock Logic (🟡 NEAR-DUPLICATES - 80%)

**Files affected:**
- `debug-repo-discovery.js` - `debugDiscoverRepositories()`
- `debug-user-assets.js` - `debugCorrectedRepositoryDiscovery()`
- `test/repositoryDiscovery.test.ts` - `mockDiscoverRepositories()`

**Impact**: 30-40 lines of core logic per file

### 6. File Service Method Implementations (🟡 NEAR-DUPLICATES - 85%)

**Files affected:**
- `src/services/fileService.ts` (real implementation)
- `test/fileService.mock.ts` (mock implementation)
- `test/targetWorkspaceUserAssets.test.ts` (inline mock)

**Impact**: Similar method signatures and patterns across implementations

### 7. Error Message Formatting (🟡 NEAR-DUPLICATES - 90%)

**Pattern:** `throw new Error(\`Expected X '${expected}', got '${actual}'\`);`

**Files affected:**
- `test/repositoryDiscovery.test.ts` (12+ instances)
- `test/targetPath.test.ts` (8+ instances)
- `test/naming.test.ts` (3 instances)

**Impact**: 25+ instances

### 8. Display Name Testing Pattern (🟡 NEAR-DUPLICATES - 95%)

**File affected:** `test/display.test.ts`

**Pattern:** `allTests++; if (testDisplayName('file.ext', ResourceCategory.TYPE, 'expected')) passedTests++;`

**Impact**: ~15 similar test invocations

## Refactoring Plan

### Phase 1: High Priority (Critical for maintainability)

#### Task 1.1: Consolidate MockFileService implementations
- **Effort**: 30 minutes
- **Files to modify**: `test/targetWorkspaceUserAssets.test.ts`
- **Action**: Remove duplicate MockFileService class, import from `test/fileService.mock.ts`
- **Lines saved**: ~30

#### Task 1.2: Create path assertion utilities  
- **Effort**: 45 minutes
- **Files to modify**: `test/testUtils.ts` + all test files using path validation
- **Action**: 
  - Add `assertPathEquals(actual, expected, context)` to `testUtils.ts`
  - Replace all normalizePath comparison patterns
- **Files affected**: 4 test files
- **Lines saved**: 80-100

#### Task 1.3: Standardize repository discovery testing
- **Effort**: 1 hour
- **Files to modify**: `test/testUtils.ts`, debug scripts, test files
- **Action**:
  - Extract shared mock repository discovery logic
  - Create reusable test utilities
  - Unify JavaScript/TypeScript implementations
- **Lines saved**: 60-80

### Phase 2: Medium Priority

#### Task 2.1: Create test logging utilities
- **Effort**: 20 minutes
- **Files to modify**: `test/testUtils.ts` + test files
- **Action**: Add test section logging helpers, replace console.log patterns
- **Lines saved**: ~20

#### Task 2.2: Consolidate error formatting
- **Effort**: 30 minutes  
- **Files to modify**: `test/testUtils.ts` + test files
- **Action**: Create standard assertion error helpers
- **Lines saved**: ~25

### Phase 3: Low Priority

#### Task 3.1: Refactor data-driven tests
- **Effort**: 15 minutes
- **Files to modify**: `test/display.test.ts`
- **Action**: Use test case arrays for display name testing
- **Lines saved**: ~15

#### Task 3.2: Extract path creation utilities
- **Effort**: 20 minutes
- **Files to modify**: Debug scripts, test utilities
- **Action**: Unify createTestPaths implementations, parameterize base directory
- **Lines saved**: ~15

## Implementation Guidelines

### Before Starting
- Ensure all tests pass: `npm test`
- Build successfully: `npm run build`

### During Refactoring
- Work in small increments
- Run tests after each change
- Maintain backward compatibility in test utilities
- Use descriptive function names for new utilities

### New Utility Functions to Create

#### In `test/testUtils.ts`:
```typescript
// Path validation
export function assertPathEquals(actual: string, expected: string, context: string): void

// Test logging  
export function logTestSection(testNumber: number, description: string): void

// Error formatting
export function createPathError(context: string, expected: string, actual: string): Error

// Repository discovery
export function createMockRepository(catalogPath: string, displayName: string, runtimeDir?: string): Repository
```

## Success Criteria

- [ ] All existing tests continue to pass
- [ ] Duplicate MockFileService eliminated 
- [ ] Path validation consolidated to shared utilities
- [ ] Repository discovery logic unified
- [ ] Test logging standardized
- [ ] Error formatting consistent
- [ ] Code reduction: 300-400 lines
- [ ] No regression in functionality
- [ ] Documentation updated for new utilities

## Risk Mitigation

1. **Test coverage**: Run full test suite after each phase
2. **Incremental approach**: Complete one task at a time
3. **Backup**: Create feature branch for refactoring work
4. **Validation**: Verify builds and packaging still work after changes

## Benefits Expected

- **Maintainability**: Single source of truth for common test patterns
- **Consistency**: Uniform test behavior across the codebase  
- **Developer experience**: Easier to write and understand tests
- **Code quality**: Reduced technical debt from duplication
- **Future proofing**: Easier to update shared logic

## Dependencies

- No external dependencies required
- Must maintain compatibility with existing test infrastructure
- Should not affect production code functionality

---

**Assignee**: _To be assigned_  
**Reviewer**: _To be assigned_  
**Target completion**: _To be scheduled_
