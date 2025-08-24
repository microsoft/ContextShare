# GitHub Copilot Instructions for VS Code Copilot Catalog Manager

## Project Overview

This VS Code extension manages AI assistant catalog resources (chat modes, instructions, prompts, tasks, MCP servers) across multiple repositories. It provides centralized discovery, activation, and "Hats" (preset) functionality for AI resources that enhance GitHub Copilot workflows.

## Core Architecture

### Service Layer Pattern
- **ResourceService** (`src/services/resourceService.ts`): Resource discovery, activation/deactivation, state management, remote fetching with TTL caching
- **HatService** (`src/services/hatService.ts`): Preset management across catalog/workspace/user storage locations  
- **FileService** (`src/services/fileService.ts`): Abstracted file system operations with mock support for testing

### Data Flow
```
Catalogs (local/remote) → ResourceService.discoverResources() → Tree Providers → VS Code UI
User Actions → Commands → Service Methods → File Operations → State Updates → UI Refresh
```

### Resource States & Origins
- **States**: `INACTIVE` (discovered), `ACTIVE` (copied to runtime), `MODIFIED` (edited after activation)
- **Origins**: `catalog` (from catalog dirs), `user` (runtime-only), `remote` (fetched from URLs)
- **Runtime Location**: `{workspace}/.github/{category}/` (configurable via `runtimeDirectory`)

## Key Development Patterns

### Resource Discovery Algorithm
1. **Structured Discovery**: Scan `{catalog}/{category}/` directories first
2. **Fallback Discovery**: Recursive filename-based classification for loose files when using root catalog override
3. **Remote Handling**: Single file URLs or directory URLs with `index.json` manifest
4. **User Asset Detection**: Compare runtime directory against catalog to identify user-created resources

### Testing Approach (TDD Required)
- Use `MockFileService` for isolated unit tests
- All test files run via `npm test` (no external test runner)
- Key test areas: resource discovery, state transitions, MCP merging, Hat presets, edge cases
- Run tests before packaging: `npm run build && npm test`

### MCP Integration Pattern
Special handling for Model Context Protocol servers:
- Merge multiple MCP configs into single target file
- Track added server names in sidecar metadata for cleanup
- Use `stripJsonComments()` to handle commented JSON configs

## Build & Package Workflow

### Development Commands
```bash
npm run build          # TypeScript compilation to dist/
npm run watch          # Watch mode for development
npm test              # Run all test suites
```

### VSIX Packaging (Cross-Platform)
Use `./build_vsix.ps1` (PowerShell Core) which:
- Updates version/publisher from package.json → vsix manifest
- Excludes node_modules/.git/vsix_build from package
- Uses Compress-Archive → zip CLI → .NET ZipFile fallback
- Copies result to `build/` directory

### Configuration Override System
Two modes for catalog discovery:
1. **Per-Category Overrides**: `copilotCatalog.chatmodesDirectory`, etc.
2. **Root Catalog Override**: `copilotCatalog.rootCatalogOverride` (takes precedence)

When root override is set, uses filename heuristics to classify resources into categories.

## VS Code Integration Points

### Tree Data Providers
- `CategoryTreeProvider`: Groups resources by category (chatmodes, instructions, etc.)
- `OverviewTreeProvider`: Shows welcome screen when no resources found
- Context menu actions: activate, deactivate, open, show diff

### Command Registration Pattern
Register commands in `extension.ts` `activate()` using:
```typescript
vscode.commands.registerCommand('copilotCatalog.commandName', async (item) => {
  // Command implementation
});
```

### Settings Schema
All configuration in `package.json` → `contributes.configuration.properties`:
- Use `patternProperties` for dynamic catalog directory mappings
- Include `order` property for settings UI grouping

## Security & Privacy Considerations

- **Path Safety**: Use `isSafeRelativeEntry()` and `sanitizeFilename()` for remote content
- **Scope Confinement**: All writes confined to designated runtime directories
- **User Asset Protection**: Never delete user-created resources during deactivation
- **Remote Caching**: Configurable TTL with privacy-friendly local storage only

## Common Debugging Scenarios

### Resource Not Appearing
1. Check catalog path configuration in settings
2. Verify file naming follows category conventions (`.chatmode.md`, `.instruction.md`, etc.)
3. Check if root catalog override is interfering with per-category paths

### State Sync Issues
Resources maintain state through `getResourceState()` comparison between catalog and runtime locations. Modified detection compares file content, not just timestamps.

### Hat Application Failures
Hats reference resources by `relativePath`. Ensure hat definitions use correct path separators and category prefixes.
