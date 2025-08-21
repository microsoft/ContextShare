# VS Code Copilot Catalog Manager

[![Build Status](https://github.com/microsoft/vscode-copilot-catalog-manager/actions/workflows/ci.yml/badge.svg)](https://github.com/microsoft/vscode-copilot-catalog-manager/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/microsoft.copilot-catalog-manager)](https://marketplace.visualstudio.com/items?itemName=microsoft.copilot-catalog-manager)

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

1. Install from VS Code Marketplace: [Copilot Catalog Manager](https://marketplace.visualstudio.com/items?itemName=microsoft.copilot-catalog-manager)
2. Or install from VSIX: `code --install-extension copilot-catalog-manager-x.x.x.vsix`

### Basic Usage

1. **Open the Copilot Catalog view** in the VS Code Activity Bar
2. **Create a template catalog**: Click the Dev menu → "Create Template Catalog"
3. **Configure catalog sources**: Use Dev menu → "Configure Source/Target Settings"
4. **Activate resources**: Right-click any resource and select "Activate"
5. **Apply presets**: Use the Hats menu to apply predefined resource combinations

### Example Catalog Structure

```
example-catalog/
├── chatmodes/
│   └── developer-assistant.chatmode.md
├── instructions/
│   └── code-review-guidelines.instruction.md
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

- Node.js 18+ and npm
- Visual Studio Code 1.90.0+
- TypeScript 5.4+

### Building from Source

```bash
# Clone the repository
git clone https://github.com/microsoft/vscode-copilot-catalog-manager.git
cd vscode-copilot-catalog-manager

# Install dependencies
npm install

# Build the extension
npm run build

# Run tests
npm test

# Package VSIX (Windows only)
pwsh ./build_vsix.ps1
```

### Development Workflow

1. **Follow TDD**: Write failing tests first, then implement features
2. **Version Management**: Update `package.json` version and sync with `vsix/extension.vsixmanifest`
3. **Testing**: Ensure all tests pass before packaging
4. **Documentation**: Update CHANGELOG.md for each release

For detailed development guidelines, see our [Development Instructions](./.github/instructions/development.instructions.md).

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

Microsoft takes the security of our software products and services seriously. If you believe you have found a security vulnerability, please report it to us as described in our [Security Policy](SECURITY.md).

## 📞 Support

For support and questions, please see our [Support Guide](SUPPORT.md).

## 🏷️ Versioning

We use [Semantic Versioning](https://semver.org/) for release management:
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

## 🙏 Acknowledgments

- Thanks to the VS Code extension development community
- Inspired by the need for better AI assistant resource management
- Built with ❤️ by the Microsoft team

## Contributing

This project welcomes contributions and suggestions.  Most contributions require you to agree to a
Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us
the rights to use your contribution. For details, visit [Contributor License Agreements](https://cla.opensource.microsoft.com).

When you submit a pull request, a CLA bot will automatically determine whether you need to provide
a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions
provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

## Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft
trademarks or logos is subject to and must follow
[Microsoft's Trademark & Brand Guidelines](https://www.microsoft.com/legal/intellectualproperty/trademarks/usage/general).
Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship.
Any use of third-party trademarks or logos are subject to those third-party's policies.
