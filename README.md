<!-- Copyright (c) Microsoft Corporation.
 Licensed under the MIT License. -->
# PromptVault (VS Code Extension)

<!-- Optional CI badge (update with your repository if/when CI is set up) -->
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/jonathan-nafta.promptvault)](https://marketplace.visualstudio.com/items?itemName=jonathan-nafta.promptvault)
[![Security Policy](https://img.shields.io/badge/Security-Policy-blue.svg)](./SECURITY.md)

A Visual Studio Code extension that enables teams to manage and share AI assistant catalog resources (chat modes, instructions, prompts, tasks, and MCP servers) across multiple repositories inside VS Code.

## ✨ Features

- **🗂️ Catalog Management**: Organize and manage AI assistant resources across multiple repositories
- **🎭 Chat Modes**: Define custom AI assistant personas and behaviors
- **📚 Instructions**: Share reusable instruction sets for AI assistants
- **💡 Prompts**: Manage and activate prompt templates
- **⚡ Tasks**: Define automated task configurations
- **🔧 MCP Integration**: Manage Model Context Protocol servers
- **🎩 Hats (Presets)**: Save and apply resource combinations as presets
- **🔄 Real-time Sync**: Automatically sync resources between catalogs and workspaces
- **🎯 Multiple Sources**: Support for local directories, workspace folders, and remote URLs
- **🚀 Team Collaboration**: Share catalog configurations across development teams

## 🚀 Quick Start



### Installation

Install from VS Code Marketplace: [PromptVault](https://marketplace.visualstudio.com/items?itemName=jonathan-nafta.promptvault)

### Basic Usage

1. **Open the PromptVault view** in the VS Code Activity Bar.
2. **Add a catalog directory**:
    - Click the Options menu → **Add Catalog Directory...** (recommended), OR
    - Open the Dev menu → **Open Settings** and add paths under the `promptvault.catalogs` setting.
3. *(Optional)* **Create a template catalog**: Dev menu → **Create Template Catalog** (helpful if you don't already have a catalog).
4. **Activate resources**: Right-click any resource and choose **Activate**.
5. **Apply presets (Hats)**: Use the Hats menu to apply saved resource combinations.
6. *(Optional)* Repeat step 2 to add multiple catalogs (local folders or remote URLs) for aggregation.

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
└── hats/
    └── full-stack-dev.json
```

## 📖 Documentation

- [Setup Guide](./SETUP_GUIDE.md) - Detailed installation and configuration instructions
- [Software Architecture](./SOFTWARE_ARCHITECTURE_SPECIFICATION.md) - Technical architecture overview
- [Test Plan](./TESTPLAN.md) - Testing strategies and test cases
- [Changelog](./CHANGELOG.md) - Version history and release notes
- [Catalog Display Names](./CATALOG_DISPLAY_NAMES_EXAMPLE.md) - Naming conventions and examples

## 🛠️ Development

### Prerequisites
- Node.js 18+
- VS Code 1.90.0+
- TypeScript 5.4+

<!--
### Building from Source (Hidden)
```bash
git clone <your-fork-or-repo-url>.git promptvault
cd promptvault
npm install
npm run build
npm test
```

### Version & Packaging (Hidden)
We rely on the official VS Code packaging tool now. The manual build scripts were removed.

```bash
# Bump version (choose one)
npm version patch
npm version minor
npm version major

# Build (prepublish will re-run build)
npx @vscode/vsce package

# Install locally for testing
code --install-extension promptvault-*.vsix --force
```

Notes:
- Only edit `package.json` for version changes (Identity version auto-handled by vsce).
- Avoid committing generated `.vsix` files unless needed for distribution outside Marketplace.

### Development Workflow (Hidden)

1. **Follow TDD**: Write failing tests first, then implement features
2. **Version Management**: Update `package.json` version and sync with `vsix/extension.vsixmanifest`
3. **Testing**: Ensure all tests pass before packaging
4. **Documentation**: Update CHANGELOG.md for each release

For detailed development guidelines, add internal docs or instructions as needed for your fork.
-->

### Renaming / Rebranding the Extension

If you need to rebrand (e.g. rename PromptVault to PromptVault), a helper script is provided:

```
pwsh ./scripts/rename-extension.ps1 -DryRun
```

Then (when satisfied) apply the changes:

```
pwsh ./scripts/rename-extension.ps1 -OldName PromptVault -NewName PromptVault -OldId promptvault -NewId promptvault -OldRepoSlug vscode-promptvault -NewRepoSlug vscode-promptvault
```

Flags:
- `-DryRun` shows intended modifications
- `-RequireCleanGit` aborts if the working tree has uncommitted changes
- `-ConfirmEach` prompts per changed file

Review with `git diff` before committing, then run tests (`npm test`). Adjust marketplace badges and publication settings manually if the extension identifier changes.

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

## 🔒 Security

Security is a top priority for this project. We follow Microsoft's security guidelines and best practices.

### Security Resources
- [Security Policy](./SECURITY.md) - How to report security vulnerabilities
- [Security Guidelines](./SECURITY_GUIDELINES.md) - Development security practices  
- [Third Party Licenses](./THIRD_PARTY_LICENSES.md) - License compliance information
- [Export Control](./EXPORT_CONTROL.md) - Export control compliance

### Security Features
- Automated security vulnerability scanning
- License compliance checking  
- Secret detection in CI/CD
- HTTPS-only remote catalog sources
- Input validation and path sanitization

### Reporting Security Issues
If you discover a security issue, please do NOT open a public issue. Instead, follow our [Security Policy](SECURITY.md) for responsible disclosure.


## 🏷️ Versioning

We use [Semantic Versioning](https://semver.org/) for release management:
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

## 🙏 Acknowledgments

- Thanks to the VS Code extension development community
- Inspired by the need for better AI assistant resource management
- Built with ❤️ by independent contributors

## Code of Conduct

Please adopt a standard open-source code of conduct (e.g. Contributor Covenant) for community interactions. If one is added, reference it here.

## Trademarks

All product names, logos, and brands are property of their respective owners. Use of any third-party trademarks or logos does not imply endorsement.

