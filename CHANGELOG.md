<!-- Copyright (c) Microsoft Corporation.
 Licensed under the MIT License. -->
# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and this project adheres to Semantic Versioning when feasible.

## [Unreleased]
### Changed
- Updated activity bar icon to a catalog book design that better represents the ContextShare functionality. The new icon features a book/catalog with organized content lines and a small AI indicator dot.

## [0.1.35] - 2025-08-23
### Changed
- Duplicate handling logic: when a catalog (or remote) resource is ACTIVE or MODIFIED its corresponding runtime copy is no longer shown as a separate `user` item; instead the catalog entry with its state icon is kept. This prevents seeing both "user" and catalog rows for the same activated asset across multiple catalogs.


## [0.1.34] - 2025-08-22
### Changed
- Renamed the MCPs view title to "MCPs (Soon)" to indicate upcoming functionality.

## [0.1.31] - 2025-08-20
### Added
- Custom catalog display names: Users can now set friendly display names for catalog directories via `copilotCatalog.catalogDisplayNames` setting
- Support for mapping directory paths to custom display names (exact path, partial path, or basename matching)
- New `getCatalogDisplayName` utility function with comprehensive path matching logic
- Enhanced catalog management with user-configurable display names

### Changed
- Improved catalog discovery to use custom display names when configured
- Enhanced resource identification with better catalog naming
- Updated CatalogSource interface to include optional displayName field

### Technical
- Added comprehensive test suite for catalog display name functionality (10 test cases)
- Extended display utilities with catalog name resolution
- Enhanced configuration schema with catalogDisplayNames object setting

## [0.1.30] - 2025-08-20
### Added
- Clean resource display names: File extensions are now hidden for better UX (e.g., `default.chatmode.md` → `default`)
- Category-specific extension removal patterns for all resource types
- New `getDisplayName` utility function with robust fallback logic
- Comprehensive test suite for display functionality (15 test cases)

### Changed
- Updated tree providers to use clean display names
- Improved resource labeling while preserving functionality for user disabled assets
- Enhanced user experience with cleaner catalog interface

### Fixed
- Corrected treeIcons.test.ts to match current icon behavior for user resources

## [0.1.26] - 2025-08-19
### Added
- Comprehensive Software Architecture Specification documentation
- Enhanced type definitions with additional Node.js shims
- Improved error handling with try-catch wrapper in activation

### Changed
- Removed icons from activate/deactivate commands for cleaner UI
- Updated tree provider tooltips to show contextual action hints
- Enhanced TypeScript configuration with DOM library support

### Fixed
- Better cross-platform compatibility with enhanced type definitions
- More robust extension activation with error handling

## [0.1.25] - 2025-08-18
### Fixed
- Ensure commands are available in headless/tunnel sessions by activating the extension eagerly (activationEvents: "*"). This prevents "command not found" errors for Dev commands.

## [0.1.24] - 2025-08-18
### Fixed
- Register providers and commands before the initial refresh, and defer refresh to after registration. Prevents command-not-found in tunnels if refresh throws early during activation.

## [0.1.25] - 2025-08-18
### Fixed
- Remote SSH/headless UX: if opening the Settings UI fails, the extension now falls back to opening workspace `.vscode/settings.json` for direct edits.

### Changed
- Activate/Deactivate commands now show check/circle-slash icons for consistency.

### Fixed
- Ensured template Hat (`Copilot Catalog Setup`) appears immediately by auto-setting `rootCatalogPath` if created outside the workspace.

## [0.1.14] - 2025-08-18
### Added
- Initial path picker integration and command registration fixes.

## [0.1.15] - 2025-08-18
### Added
- Inline user asset Disable/Enable actions and improved hat visibility.

## [0.1.16] - 2025-08-18
### Added
- Folder pickers for template destination and for configuring `rootCatalogPath` and `targetWorkspace` (path autocompletion UX).
- Inline Enable/Disable actions for user assets with consistent icons.
- Category visual dividers in the tree view.
- Extension icon updated to a PNG for Marketplace/Extensions view.

## [0.1.17] - 2025-08-18
### Changed
- Replaced hover/inline icons with explicit text labels for item actions:
	- Catalog assets: "Catalog: Enable" / "Catalog: Disable"
	- User assets: "User: Enable" / "User: Disable"
- Updated development instructions to require updating CHANGELOG.md on every version bump.

## [0.1.18] - 2025-08-18
### Fixed
- Restored inline actions in the tree by placing actions in the `inline` menu group and providing icons (VS Code requires an icon for inline placement). Labels remain text as requested:
	- Catalog: "Catalog: Enable" / "Catalog: Disable"
	- User: "User: Enable" / "User: Disable"
    
## [0.1.19] - 2025-08-18
### Changed
- Replaced heavy line separators with a subtle modern dot divider between categories and removed the trailing divider after the last category.

## [0.1.20] - 2025-08-18
### Changed
- Switched the category divider to a minimalist spacer (non-breaking spaces) for a cleaner, less distracting look; still shown only between groups.

## [0.1.21] - 2025-08-18
### Changed
- Updated the divider to five bullets (• • • • •) with thin spacing to improve visual clarity between categories.

## [0.1.22] - 2025-08-18
### Fixed
- Dev commands now work in headless/tunnel sessions: picker dialogs are wrapped in try/catch with manual input fallbacks (path input or typed action selection) and logging.

