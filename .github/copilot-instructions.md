# GitHub Copilot Instructions for ContextHub

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
- **Runtime Locations**: 
  - Most resources: `{workspace}/.github/{category}/`
  - **MCP Exception**: Always targets `{workspace}/.vscode/mcp.json` (not under runtime dir)

## Key Development Patterns

### Resource Discovery Algorithm
1. **Root Override Priority**: When `rootCatalogOverride` is set, it takes precedence over per-category overrides
2. **Filename-Based Classification**: Uses `inferCategoryFromFilename()` for recursive discovery (`.chatmode.md`, `.instructions.md`, etc.; legacy `.instruction.md` also supported)
3. **Remote Sources**: Support HTTPS-only URLs with `index.json` manifest for directories
4. **User Asset Detection**: Compare runtime vs catalog locations to identify user-created resources

### Testing Framework (TDD Required)
- **MockFileService**: Use canonical version from `test/fileService.mock.ts` (avoid inline duplicates)
- **Test Utilities**: `createTestPaths()` in `testUtils.ts` for consistent path structures
- **Path Assertions**: Use cross-platform path comparison patterns consistently
- **Run Order**: Always `npm run build && npm test` before packaging

### MCP Integration (Special Case)
Model Context Protocol servers require unique merge semantics:
- **Merge Strategy**: Combines multiple catalog MCP configs into single target file
- **Conflict Resolution**: Deduplicates identical server configs, renames conflicts with `-catalog` suffix
- **Sidecar Metadata**: Tracks added server names in `.copilot-catalog-mcp-meta.json` for cleanup
- **JSON Comments**: Use `stripJsonComments()` for commented JSON configs
- **Target Path**: Always `.vscode/mcp.json`, never under runtime directory

### Target Path Resolution Logic
The extension supports multiple workspace targeting modes:
1. **Target Workspace Override**: When `copilotCatalog.targetWorkspace` is set, use that absolute path
2. **Current Workspace Root**: Falls back to detected current workspace
3. **Repository Root**: Final fallback to catalog repository root

## Build & Package Workflow

### Development Commands
```bash
npm run build          # TypeScript compilation to dist/
npm run watch          # Watch mode for development  
npm test              # Run all test suites
```

### Cross-Platform VSIX Building
- **Primary**: `./build_vsix.ps1` (PowerShell Core) with version bump support
- **Fallback**: `./build_vsix.sh` (Bash) for non-PowerShell environments
- **Version Management**: Syncs `package.json` version ↔ `vsix/extension.vsixmanifest`
- **Task Integration**: Use VS Code tasks for build automation (`npm run build`, `npm test`)

### Configuration Discovery Modes
1. **Structured Mode**: Explicit per-category paths (`copilotCatalog.source.chatmodes`, etc.)
2. **Root Override Mode**: Single `rootCatalogOverride` path with recursive filename classification
3. **Auto-Discovery**: Fallback to `copilot_catalog/` folders in workspace

## VS Code Integration Points

### Tree Providers & UI
- **CategoryTreeProvider**: Category-specific views with resource filtering by catalog name
- **State Icons**: Different icons for INACTIVE/ACTIVE/MODIFIED states via `computeIconId()`
- **Context Menus**: Activate/deactivate actions, diff viewing, user resource enable/disable
- **Command Pattern**: All commands registered in `extension.ts` activation with consistent error handling

### Configuration Schema Pattern
Settings in `package.json` use:
- `patternProperties` for flexible catalog path mappings
- `order` properties for settings UI organization
- Dynamic validation for remote URL schemes (HTTPS-only)

## Security & Privacy Considerations

- **Remote Safety**: HTTPS-only remote sources, path traversal protection via `isSafeRelativeEntry()`
- **Filename Sanitization**: `sanitizeFilename()` for all remote content
- **Scope Confinement**: All file operations within designated runtime/target directories
- **User Asset Protection**: Never delete user-created resources during deactivation
- **Cache Strategy**: Local-only TTL caching, no external telemetry

## Common Debugging Scenarios

### Resource Discovery Issues
1. **Check Override Priority**: Root catalog override trumps per-category settings
2. **Filename Conventions**: Verify `.chatmode.md`, `.instructions.md` (preferred), `.prompt.md`, `.task.json`, `.mcp.json`
3. **Path Resolution**: Use VS Code output channel for resource discovery logging

### MCP Merge Failures  
1. **JSON Syntax**: Ensure MCP configs are valid JSON (comments stripped automatically)
2. **Sidecar Metadata**: Check `.copilot-catalog-mcp-meta.json` for tracking issues
3. **Target Path**: MCP always targets `.vscode/mcp.json`, not runtime directory

### State Sync Problems
- State determined by content comparison between catalog and runtime files
- MODIFIED state indicates runtime file exists but differs from catalog source
- User resources cannot be deactivated (protection mechanism)
