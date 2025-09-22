<!-- Copyright (c) Microsoft Corporation.
 Licensed under the MIT License. -->
# ContextShare (VS Code Extension)

<!-- Optional CI badge (update with your repository if/when CI is set up) -->
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/ContextShare.contextshare)](https://marketplace.visualstudio.com/items?itemName=ContextShare.contextshare)
[![Security Policy](https://img.shields.io/badge/Security-Policy-blue.svg)](./SECURITY.md)

Unified AI workflow catalog for VS Code: manage and share chat modes, instructions, prompts, tasks - plus upcoming MCP server orchestration - across all your repositories from one consistent UI. Reduce prompt drift, standardize team AI usage, and reuse curated presets.

## ✨ Feature Highlights

Core value: a single, structured, multi-catalog layer for AI assistant resources that become instantly available & activatable per workspace.

- Catalog aggregation (local folders + remote URLs)
- Chat Modes (persona definitions)
- Instructions (reusable guidance bundles)
- Prompts (templated starting points)
- Tasks (JSON task configs)
- MCP Integration (coming soon)
- Presets (presets bundling multiple resources)
- Real‑time sync & state tracking (INACTIVE / ACTIVE / MODIFIED)
- Safe activation (never overwrites user‑created originals)
- Secure: HTTPS-only remotes + path & filename sanitization

### Feature Matrix

| Category      | Purpose / Scope                     | Runtime Location                | Filename Pattern / Notes                | Status |
|---------------|-------------------------------------|---------------------------------|-----------------------------------------|--------|
| Chat Modes    | Persona / behavior definitions      | `.github/chatmodes/`            | `*.chatmode.md`                         | ✅     |
| Instructions  | Shared guideline sets               | `.github/instructions/`         | `*.instructions.md` (legacy *.instruction.md) | ✅ |
| Prompts       | Prompt templates / starters         | `.github/prompts/`              | `*.prompt.md`                           | ✅     |
| Tasks         | Automation / action configurations  | `.github/tasks/`                | `*.task.json`                           | ✅     |
| MCP Servers   | Model Context Protocol sources      | `.vscode/mcp.json`              | Merged composite file                   |  Coming soon |
| Presets       | Declarative preset bundles          | `.github/presets/`              | `*.json` (see example below)            | ✅     |

State logic: ACTIVE resources are copied to runtime; MODIFIED indicates the runtime file diverged from its source (e.g., team-local customization).

## 🚀 Quick Start

### Installation
Install from the VS Code Marketplace: [ContextShare](https://marketplace.visualstudio.com/items?itemName=contextshare.contextshare)

### Use in 5 Steps
1. Open the ContextShare Activity Bar view.
2. Add a catalog (Options → Add Catalog Directory… or add a remote HTTPS URL).
3. Activate a resource (right‑click → Activate).
4. (Optional) Apply a Preset to activate multiple at once.
5. Edit runtime copies under `.github/**` if you need local tweaks (they'll show as MODIFIED).

### Presets
Presets are small JSON descriptors bundling chosen chat mode + instructions + prompts + tasks (+ soon MCP servers) into a one‑click activation set. Great for role or workflow switching (e.g., "Full Stack Review", "Security Audit").

### Example Catalog Structure

```
example-catalog/
├── chatmodes/
│   └── developer-assistant.chatmode.md
├── instructions/
│   └── code-review-guidelines.instructions.md
├── prompts/
│   └── bug-analysis.prompt.md
├── tasks/
│   └── automated-testing.task.json
├── mcp/
│   └── development-servers.mcp.json
└── presets/
    └── full-stack-dev.json
```

## 📖 Documentation

- [Setup Guide](./SETUP_GUIDE.md) - Detailed installation and configuration instructions
- [Software Architecture](./SOFTWARE_ARCHITECTURE_SPECIFICATION.md) - Technical architecture overview
- [Test Plan](./TESTPLAN.md) - Testing strategies and test cases
- [Changelog](./CHANGELOG.md) - Version history and release notes
- [Catalog Display Names](./CATALOG_DISPLAY_NAMES_EXAMPLE.md) - Naming conventions and examples

##  Configuration Examples

Add catalogs in `.vscode/settings.json`:

```jsonc
{
    "contextshare.catalogs": [
        "../team-ai-catalog", 
        "https://raw.githubusercontent.com/example-org/shared-ai-catalog/main/index.json"
    ]
}
```

Remote `index.json` (HTTPS only):

```json
{
    "version": 1,
    "resources": [
        "prompts/bug-analysis.prompt.md",
        "instructions/code-review-guidelines.instructions.md",
        "chatmodes/developer-assistant.chatmode.md"
    ]
}
```

Sample Preset (`.github/presets/full-stack-dev.json`):

```json
{
    "name": "Full Stack Dev",
    "chatMode": "developer-assistant.chatmode.md",
    "instructions": ["code-review-guidelines.instructions.md"],
    "prompts": ["bug-analysis.prompt.md"],
    "tasks": ["automated-testing.task.json"],
    "mcpServers": ["development-servers.mcp.json"]
}
```

Display Names: Provide friendly catalog labels via configuration so multiple catalogs can be visually distinguished in the tree (see `CATALOG_DISPLAY_NAMES_EXAMPLE.md`).

## 🛠️ Development

Development details, build, and contribution workflow are documented in `CONTRIBUTING.md` and supporting architecture docs.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](./CONTRIBUTING.md) for details.

### Development Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Write tests for your changes
4. Implement your feature
5. Ensure all tests pass: `npm test`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔒 Security & Privacy

Focused on safe local workspace operations:

- HTTPS-only remote catalog sources
- Path traversal & filename sanitization
- User-created runtime resources are never deleted
- No telemetry / tracking collected by this extension

Resources:
- [Security Policy](./SECURITY.md)
- [Security Guidelines](./SECURITY_GUIDELINES.md)
- [Third Party Licenses](./THIRD_PARTY_LICENSES.md)
- [Export Control](./EXPORT_CONTROL.md)

Report vulnerabilities privately via the Security Policy (responsible disclosure). Please avoid public issues for sensitive findings.

## ❓ Troubleshooting

| Issue | Possible Cause | Action |
|-------|----------------|--------|
| Resource not listed | Filename pattern mismatch | Verify suffix (e.g., `.prompt.md`, `.instructions.md`) |
| Remote catalog empty | `index.json` not reachable / HTTP error | Open URL in browser; ensure HTTPS and correct raw path |
| Resource shows MODIFIED unexpectedly | Local edit vs source catalog | Diff runtime file in `.github/**` with original source |
| Removed MCP server persists | (Upcoming MCP feature) cached merged entry | After MCP feature release: remove from source & reload window |
| Preset not applying all items | Missing referenced filenames | Check JSON fields and ensure each resource exists |

If stuck, enable verbose logging (future setting) or open an issue with a minimal reproduction.

## 🏷️ Versioning

We use [Semantic Versioning](https://semver.org/) for release management:
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](./CODE_OF_CONDUCT.md). Participation implies acceptance.

## Trademarks

All product names, logos, and brands are property of their respective owners. Use of any third-party trademarks or logos does not imply endorsement.
