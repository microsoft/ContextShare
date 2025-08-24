import * as os from 'os';
import * as path from 'path';

/**
 * Test utilities for creating portable test paths and scenarios
 */

/**
 * Creates a cross-platform test directory structure based on a base path
 */
export function createTestPaths(baseName: string) {
  const tempDir = os.tmpdir();
  const baseDir = path.join(tempDir, 'copilot-catalog-tests', baseName);
  
  return {
    // Repository paths
    repoRoot: path.join(baseDir, 'test-repo'),
    catalogPath: path.join(baseDir, 'test-repo', 'copilot_catalog'),
    runtimePath: path.join(baseDir, 'test-repo', '.github'),
    
    // Workspace paths  
    workspaceRoot: path.join(baseDir, 'workspace'),
    workspaceGithub: path.join(baseDir, 'workspace', '.github'),
    workspaceVscode: path.join(baseDir, 'workspace', '.vscode'),
    
    // Alternative workspace paths
    altWorkspaceRoot: path.join(baseDir, 'alt-workspace'),
    altWorkspaceGithub: path.join(baseDir, 'alt-workspace', '.github'),
    
    // Base directory for cleanup
    baseDir
  };
}

/**
 * Creates test paths for a catalog-as-root scenario
 */
export function createCatalogAsRootPaths(baseName: string) {
  const tempDir = os.tmpdir();
  const baseDir = path.join(tempDir, 'copilot-catalog-tests', baseName);
  
  const catalogRoot = path.join(baseDir, 'catalog-repo');
  
  return {
    // Catalog is the repository root
    repoRoot: catalogRoot,
    catalogPath: catalogRoot,
    runtimePath: path.join(catalogRoot, '.github'),
    
    // Separate workspace
    workspaceRoot: path.join(baseDir, 'my-project'),
    workspaceGithub: path.join(baseDir, 'my-project', '.github'),
    workspaceVscode: path.join(baseDir, 'my-project', '.vscode'),
    
    // Alternative workspace paths
    altWorkspaceRoot: path.join(baseDir, 'alt-workspace'),
    altWorkspaceGithub: path.join(baseDir, 'alt-workspace', '.github'),
    
    // Base directory for cleanup
    baseDir
  };
}

/**
 * Creates a portable mock file structure for testing
 */
export function createMockFileStructure(paths: ReturnType<typeof createTestPaths> | ReturnType<typeof createCatalogAsRootPaths>) {
  const files: Record<string, string> = {};
  
  // Catalog resources
  files[path.join(paths.catalogPath, 'chatmodes', 'test.chatmode.md')] = 'test chatmode';
  files[path.join(paths.catalogPath, 'prompts', 'test.prompt.md')] = 'test prompt';
  files[path.join(paths.catalogPath, 'tasks', 'build.task.json')] = '{"label": "test task"}';
  files[path.join(paths.catalogPath, 'mcp', 'servers.mcp.json')] = '{"mcpServers": {}}';
  
  // Workspace user assets
  files[path.join(paths.workspaceGithub, 'chatmodes', 'user.chatmode.md')] = 'user chatmode';
  files[path.join(paths.workspaceGithub, 'prompts', 'user.prompt.md')] = 'user prompt';
  files[path.join(paths.workspaceGithub, 'tasks', 'user.task.json')] = '{"label": "user task"}';
  
  // Runtime path assets (should be ignored when workspace is set)
  files[path.join(paths.runtimePath, 'chatmodes', 'runtime.chatmode.md')] = 'runtime chatmode';
  
  return files;
}

/**
 * Normalizes a path for cross-platform comparison
 */
export function normalizePath(pathStr: string): string {
  return path.normalize(pathStr).replace(/\\/g, '/');
}

/**
 * Asserts that two paths are equal after normalization
 */
export function assertPathEquals(actual: string, expected: string, context: string): void {
  if (normalizePath(actual) !== normalizePath(expected)) {
    throw new Error(`${context}: expected '${expected}', got '${actual}'`);
  }
}

/**
 * Logs a test section with consistent formatting
 */
export function logTestSection(testNumber: number, description: string): void {
  console.log(`✅ Test ${testNumber}: ${description}`);
}

/**
 * Creates a formatted error for path mismatches
 */
export function createPathError(context: string, expected: string, actual: string): Error {
  return new Error(`${context}: expected '${expected}', got '${actual}'`);
}

/**
 * Mock repository discovery logic shared across tests and debug scripts
 */
export function createMockRepository(catalogPath: string, displayName: string, runtimeDirName: string = '.github'): {
  id: string;
  name: string;
  rootPath: string;
  catalogPath: string;
  runtimePath: string;
  isActive: boolean;
} {
  const absoluteCatalogPath = path.resolve(catalogPath);
  const basename = path.basename(absoluteCatalogPath).toLowerCase();
  
  let repoRoot: string;
  let runtimePath: string;
  
  if (basename === 'copilot_catalog') {
    // Traditional structure: repo/copilot_catalog -> repo root is parent
    repoRoot = path.dirname(absoluteCatalogPath);
    runtimePath = path.join(repoRoot, runtimeDirName);
  } else {
    // Direct catalog directory: use catalog directory as repo root
    repoRoot = absoluteCatalogPath;
    runtimePath = path.join(repoRoot, runtimeDirName);
  }
  
  const repoName = displayName || path.basename(absoluteCatalogPath);
  
  return {
    id: path.basename(repoRoot) + '_' + path.basename(absoluteCatalogPath),
    name: repoName,
    rootPath: repoRoot,
    catalogPath: absoluteCatalogPath,
    runtimePath,
    isActive: true
  };
}

/**
 * Mock multiple repositories discovery for testing
 */
export function mockDiscoverRepositories(catalogDirectories: Record<string, string>, runtimeDirName: string = '.github') {
  const repos = [];
  
  for (const [catalogPath, displayName] of Object.entries(catalogDirectories)) {
    repos.push(createMockRepository(catalogPath, displayName, runtimeDirName));
  }
  
  return repos;
}

/**
 * Creates expected target paths for testing
 */
export function createExpectedTargets(workspaceRoot: string) {
  return {
    chatmode: path.join(workspaceRoot, '.github', 'chatmodes'),
    prompt: path.join(workspaceRoot, '.github', 'prompts'), 
    task: path.join(workspaceRoot, '.github', 'tasks'),
    instruction: path.join(workspaceRoot, '.github', 'instructions'),
    hat: path.join(workspaceRoot, '.github', 'hats'),
    mcp: path.join(workspaceRoot, '.vscode', 'mcp.json')
  };
}
