<!-- Copyright (c) Microsoft Corporation.
 Licensed under the MIT License. -->
# Catalog Display Names Configuration Example

This example shows how to configure custom display names for your catalog directories using the new `copilotCatalog.catalogDisplayNames` setting.

## Settings Configuration

Add this to your VS Code settings.json:

```json
{
  "copilotCatalog.directories": [
    "/path/to/shared/catalog",
    "/path/to/team/resources", 
    "./local_catalog",
    "https://company.com/remote-catalog/"
  ],
  "copilotCatalog.catalogDisplayNames": {
    "/path/to/shared/catalog": "🌍 Company Shared Resources",
    "/path/to/team/resources": "👥 Team Catalog", 
    "local_catalog": "📁 Local Development",
    "https://company.com/remote-catalog/": "☁️ Remote Corporate Catalog"
  }
}
```

## How It Works

The extension will use the custom display names in the tree view and filter dropdown instead of showing the raw directory paths:

- Instead of: `shared`
- Shows: `🌍 Company Shared Resources`

- Instead of: `team` 
- Shows: `👥 Team Catalog`

- Instead of: `local_catalog`
- Shows: `📁 Local Development`

- Instead of: `remote-catalog`
- Shows: `☁️ Remote Corporate Catalog`

## Path Matching Rules

The extension matches paths in this order of preference:

1. **Exact Path Match**: `/full/absolute/path/to/catalog` 
2. **Normalized Path Match**: Resolves relative paths to absolute for matching
3. **Partial Path Match**: `projects/shared/resources` matches `/workspace/projects/shared/resources`
4. **Basename Fallback**: If no mapping exists, uses the directory name

## Examples

### Simple Setup
```json
{
  "copilotCatalog.directories": ["./copilot_catalog", "./shared_resources"],
  "copilotCatalog.catalogDisplayNames": {
    "copilot_catalog": "Main Catalog",
    "shared_resources": "Shared Assets"
  }
}
```

### Advanced Multi-Team Setup
```json
{
  "copilotCatalog.directories": [
    "/shared/engineering/ai-catalog",
    "/shared/marketing/prompts", 
    "./team-specific/catalog",
    "https://cdn.company.com/ai-resources/"
  ],
  "copilotCatalog.catalogDisplayNames": {
    "/shared/engineering/ai-catalog": "🔧 Engineering AI Tools",
    "/shared/marketing/prompts": "📢 Marketing Prompts",
    "team-specific/catalog": "🏠 Team Resources",
    "https://cdn.company.com/ai-resources/": "🌐 Corporate CDN"
  }
}
```

## Benefits

- **Cleaner UI**: Friendly names instead of technical paths
- **Better Organization**: Use emojis and descriptive names
- **Team Clarity**: Clear indication of catalog purpose and scope
- **Flexible Mapping**: Works with local, shared, and remote catalogs

## Notes

- If no display name is configured, the extension falls back to using the directory basename
- Display names appear in the catalog filter dropdown and resource labels
- Works with both local directories and remote HTTPS URLs
- Changes take effect after refreshing the catalog view
