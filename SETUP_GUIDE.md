# Copilot Catalog Manager - Complete Setup Guide

This guide will walk you through everything you need to know to set up and use the Copilot Catalog Manager extension effectively.

## Table of Contents

1. [Installation & First Run](#installation--first-run)
2. [Understanding the Interface](#understanding-the-interface)
3. [Configuration Options](#configuration-options)
4. [Setting Up Your First Catalog](#setting-up-your-first-catalog)
5. [Working with Hats (Presets)](#working-with-hats-presets)
6. [Team Collaboration Workflow](#team-collaboration-workflow)
7. [Advanced Configuration](#advanced-configuration)
8. [Troubleshooting](#troubleshooting)

## Installation & First Run

### Prerequisites
- VS Code version 1.90.0 or higher
- Basic understanding of Git (for team collaboration)

### Installing the Extension

#### Option 1: From VSIX File (Local Development)
```powershell
# Install the latest version
code --install-extension ./copilot-catalog-manager-0.1.32.vsix --force
```

#### Option 2: VS Code Marketplace (Future)
1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "Copilot Catalog Manager"
4. Click Install

### First Launch
1. **Restart VS Code** after installation
2. **Look for the 📚 icon** in the Activity Bar (left sidebar)
3. **Click the icon** to open the Copilot Catalog view

## Understanding the Interface

### Activity Bar Icon 📚
- Located in the left sidebar
- Shows status: "Copilot Catalog 📚 X/Y" (X active resources out of Y total)
- Click to open the main catalog tree view

### Tree View
The main interface showing your catalog structure:

#### Resource States
- **✓ Active**: Resource is copied to runtime directory and ready to use
- **⚠ Modified**: Active resource has been changed and differs from catalog version
- **📁 Available**: Resource exists in catalog but isn't activated
- **🔍 Missing**: Referenced in Hat but not found in catalog

#### Context Menu (Right-click)
- **Activate**: Copy resource to runtime directory
- **Deactivate**: Remove resource from runtime directory  
- **Diff with Active**: Compare catalog version with active version
- **Edit**: Open resource file for editing
- **Show Active**: Reveal active file in explorer

### Title Bar Commands

#### Hats Menu 🎩
- **Apply Hat (Preset)**: Activate a saved preset
- **Save Hat from Active (Workspace)**: Save current active resources as a workspace preset
- **Save Hat from Active (User)**: Save current active resources as a user preset
- **Delete Hat**: Remove a saved preset

#### Dev Menu 🔧
- **Create Template Catalog**: Generate sample catalog structure
- **Configure Source/Target Settings**: Quick access to path configuration
- **Refresh**: Reload catalog and check for changes
- **Diagnostics**: Show detailed status and troubleshooting info

## Configuration Options

Access settings via: **File** → **Preferences** → **Settings** → Search "Copilot Catalog"

### Basic Settings

| Setting | Default | Description |
|---------|---------|-------------|
| **Catalog Directory** | `{}` | Maps catalog paths to display names. Can be local paths, workspace-relative paths, or HTTPS URLs |
| **Runtime Directory** | `.github` | Where active resources are copied (relative to target workspace) |
| **Target Workspace** | `(current)` | Workspace where resources should be activated |

### Advanced Settings

| Setting | Default | Description |
|---------|---------|-------------|
| **Remote Cache TTL Seconds** | `300` | How long to cache remote catalog fetches (0 = no cache) |
| **Enable File Logging** | `false` | Write extension logs to user global storage |

## Setting Up Your First Catalog

### Method 1: Create Template Catalog (Recommended for New Users)

1. **Open any workspace** in VS Code
2. **Open Copilot Catalog view** (📚 icon)
3. **Click Dev → Create Template Catalog** in title bar
4. **Explore the created structure**:
   ```
   copilot_catalog/
   ├── chatmodes/           # AI assistant modes
   ├── instructions/        # Coding guidelines and rules  
   ├── prompts/            # Reusable prompt templates
   ├── tasks/              # VS Code task definitions
   ├── mcp/                # Model Context Protocol configs
   └── hats/               # Preset collections
   ```

### Method 2: Manual Catalog Creation

1. **Create the folder structure**:
   ```
   mkdir copilot_catalog
   cd copilot_catalog
   mkdir chatmodes instructions prompts tasks mcp hats
   ```

2. **Add your first resource** (example instruction):
   ```markdown
   # File: copilot_catalog/instructions/coding-standards.instructions.md
   ---
   applyTo: '**/*.js,**/*.ts'
   ---
   
   # JavaScript/TypeScript Coding Standards
   
   - Use TypeScript strict mode
   - Prefer const over let, avoid var
   - Use meaningful variable names
   - Add JSDoc comments for public functions
   ```

3. **Refresh the Catalog view**
4. **Right-click your resource → Activate**

### Method 3: Point to Existing Catalog

If you already have a catalog elsewhere:

1. **Open Settings** → Search "Copilot Catalog"
2. **Set Catalog Directory**: 
   - Key: Path to your catalog (absolute or relative to workspace)
   - Value: Display name (optional)
3. **Refresh the Catalog view**

Example configuration:
```json
{
  "copilotCatalog.catalogDirectory": {
    "/path/to/my/shared-catalog": "Team Standards",
    "./my-project-catalog": "Project Specific",
    "https://raw.githubusercontent.com/org/repo/main/catalog": "Company Catalog"
  }
}
```

## Working with Hats (Presets)

Hats let you save and apply collections of resources with one click.

### Creating Your First Hat

1. **Activate some resources** (right-click → Activate)
2. **Save as Hat**: Click **Hats** → **Save Hat from Active (Workspace)**
3. **Name it**: e.g., "Code Review Setup"
4. **Add description** (optional): "Resources for thorough code reviews"

### Hat File Structure

Workspace hats are saved to `.vscode/copilot-hats.json`:
```json
{
  "hats": [
    {
      "name": "Code Review Setup",
      "description": "Resources for thorough code reviews",
      "resources": [
        "instructions/code-review-checklist.instructions.md",
        "prompts/security-review.prompt.md",
        "chatmodes/reviewer.chatmode.md"
      ]
    }
  ]
}
```

### Applying Hats

1. **Click Hats → Apply Hat (Preset)**
2. **Choose your hat** from the list
3. **Select mode**:
   - **Additive**: Add hat resources to currently active ones
   - **Exclusive**: Deactivate everything else, activate only hat resources

### Hat Types

#### Workspace Hats (.vscode/copilot-hats.json)
- Shared with your team via Git
- Perfect for role-based setups ("Frontend Dev", "Backend Dev", "QA")
- Project-specific configurations

#### User Hats (Global)
- Personal to your machine
- Cross-project personal preferences
- Not shared with team

#### Catalog Hats (copilot_catalog/hats/*.json)
- Stored in the catalog itself
- Can be shared across multiple repositories
- Version-controlled with the catalog

## Team Collaboration Workflow

### Setting Up Team Collaboration

1. **Repository Owner**:
   ```bash
   # Create and populate catalog
   mkdir copilot_catalog
   # Add your team's standard resources
   git add copilot_catalog/
   git commit -m "Add team Copilot catalog"
   
   # Create team hats in VS Code and commit
   git add .vscode/copilot-hats.json
   git commit -m "Add team presets"
   git push
   ```

2. **Team Members**:
   ```bash
   git pull  # Get latest catalog and hats
   # Open VS Code, go to Copilot Catalog view
   # Click Hats → Apply Hat → Choose team preset
   ```

### Best Practices for Teams

#### 1. Catalog Organization
```
copilot_catalog/
├── instructions/
│   ├── general/           # Company-wide standards
│   ├── frontend/          # Frontend-specific guidelines
│   └── backend/           # Backend-specific guidelines
├── chatmodes/
│   ├── roles/             # Role-based chat modes
│   └── tasks/             # Task-specific modes
└── hats/
    ├── frontend-dev.json  # Frontend developer preset
    ├── backend-dev.json   # Backend developer preset
    └── code-review.json   # Code reviewer preset
```

#### 2. Hat Strategy
- **Role-based hats**: "Frontend Dev", "Backend Dev", "DevOps", "QA"
- **Task-based hats**: "Code Review", "Bug Fixing", "Feature Development"
- **Project-phase hats**: "Initial Development", "Maintenance", "Refactoring"

#### 3. Naming Conventions
- Use consistent prefixes: `TEAM.`, `PROJECT.`, `ROLE.`
- Include version info for evolving standards: `coding-standards-v2.instructions.md`
- Use descriptive names: `react-component-best-practices.instructions.md`

### Review Process for Catalog Changes

1. **Create PR for catalog changes**:
   ```bash
   git checkout -b improve-coding-standards
   # Edit copilot_catalog/instructions/coding-standards.instructions.md
   git add copilot_catalog/
   git commit -m "Update coding standards for async/await usage"
   git push origin improve-coding-standards
   ```

2. **Team reviews catalog changes** just like code
3. **Merge and notify team** to refresh their catalogs

## Advanced Configuration

### Multiple Catalog Sources

You can configure multiple catalogs with display names:

```json
{
  "copilotCatalog.catalogDirectory": {
    "./copilot_catalog": "Project Catalog",
    "/shared/team-catalog": "Team Standards", 
    "https://company.com/copilot-catalog": "Company-wide",
    "../shared-resources/catalog": "Shared Resources"
  }
}
```

### Cross-Workspace Activation

Activate resources into a different workspace than where your catalog is:

```json
{
  "copilotCatalog.targetWorkspace": "/path/to/target/workspace"
}
```

Use case: Centralized catalog repository that activates resources into various project repositories.

### Remote Catalogs

Load catalogs from HTTPS URLs:

```json
{
  "copilotCatalog.catalogDirectory": {
    "https://raw.githubusercontent.com/company/ai-catalog/main": "Company Catalog"
  },
  "copilotCatalog.remoteCacheTtlSeconds": 600
}
```

**Security Notes**:
- Only HTTPS URLs are allowed
- Responses are size-limited and timeout-protected
- Cache reduces network requests

### Custom Runtime Directory

Change where active resources are placed:

```json
{
  "copilotCatalog.runtimeDirectory": ".copilot"
}
```

Popular choices:
- `.github` (default) - Works well with GitHub repositories
- `.vscode` - Keeps everything VS Code-related together
- `.copilot` - Clearly branded for AI resources

## Troubleshooting
### CI fails: Version mismatch (package.json vs VSIX manifest)

Cause: `vsix/extension.vsixmanifest` Version didn’t get updated.

Fix:
- Run one of the build scripts with --bump or --version, which auto-syncs the manifest:
  - `pwsh ./build_vsix.ps1 --bump patch` or `bash ./build_vsix.sh --bump patch`
- Or, run the guard: `npm run verify:version` to see the mismatch locally.

Tip: Do not hand-edit the manifest; scripts keep it correct based on package.json.

### Common Issues

#### "No catalog found" Message

**Problem**: Catalog view shows "No catalog directory found"

**Solutions**:
1. **Check catalog exists**: Ensure `copilot_catalog/` folder exists in workspace
2. **Configure path**: Go to Settings → Copilot Catalog → Catalog Directory
3. **Refresh view**: Click refresh button in catalog view
4. **Check workspace**: Ensure you have a workspace open (not just loose files)

#### Resources Not Activating

**Problem**: Right-click → Activate doesn't work

**Solutions**:
1. **Check target workspace**: Verify `copilotCatalog.targetWorkspace` setting
2. **Check permissions**: Ensure VS Code can write to runtime directory
3. **Check file conflicts**: Look for existing files that might block activation
4. **View diagnostics**: Use Dev → Diagnostics for detailed error info

#### Hat Application Fails

**Problem**: Applying a hat doesn't activate expected resources

**Solutions**:
1. **Check resource paths**: Ensure hat references valid catalog paths
2. **Refresh catalog**: Resource might have been moved or renamed
3. **Check exclusive mode**: In exclusive mode, other resources are deactivated
4. **Verify catalog source**: Hat might reference resources from different catalog

#### Performance Issues

**Problem**: Catalog view is slow to load or refresh

**Solutions**:
1. **Check remote catalogs**: HTTPS catalogs can be slow; adjust cache TTL
2. **Reduce catalog size**: Large catalogs take time to process
3. **Check file system**: Network drives can be slow
4. **Disable file logging**: Turn off `enableFileLogging` if enabled

### Diagnostic Information

**Get detailed info**: Dev → Diagnostics command shows:
- Catalog discovery results
- Active resource status
- Configuration summary
- Recent errors
- Performance metrics

**Check logs**: 
- Output panel → "Copilot Catalog" channel
- If file logging enabled: User global storage location shown in diagnostics

### Getting Help

1. **Check Output Panel**: View → Output → "Copilot Catalog"
2. **Run Diagnostics**: Dev → Diagnostics in catalog view
3. **Review Settings**: Ensure all paths are absolute and accessible
4. **Test Minimal Setup**: Try with a simple catalog to isolate issues

### Performance Optimization

#### For Large Catalogs
- Use specific catalog directory mappings instead of auto-discovery
- Increase remote cache TTL for stable remote catalogs
- Consider splitting very large catalogs into focused subcatalogs

#### For Remote Catalogs
- Set appropriate cache TTL (600+ seconds for stable catalogs)
- Use CDN-backed URLs when possible
- Monitor Output panel for fetch timing information

---

## Next Steps

🎯 **Try it out**: Create a simple catalog and experiment with activating resources  
🎩 **Make your first Hat**: Save a useful combination as a preset  
👥 **Share with team**: Commit your catalog and hats to Git  
⚡ **Iterate**: Refine your setup based on what works for your workflow  

**Happy cataloging!** 🚀
