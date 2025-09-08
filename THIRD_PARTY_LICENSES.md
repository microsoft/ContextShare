<!-- Copyright (c) Microsoft Corporation.
 Licensed under the MIT License. -->
# Microsoft PromptVault - Third Party License Compliance

This document provides information about third-party licenses in the PromptVault VS Code extension.

## License Compliance Summary

The PromptVault project uses dependencies with the following license categories:

### ✅ Pre-Approved Licenses
These licenses are automatically approved for use in Microsoft open source projects:
- MIT (Primary license for most dependencies)
- BSD-2-Clause & BSD-3-Clause
- Apache-2.0
- ISC
- CC0-1.0 (Public Domain equivalent)
- BlueOak-1.0.0
- 0BSD (Public Domain equivalent)

### ⚠️ Licenses Requiring Review
These licenses may be acceptable but require legal review:
- Python-2.0 (Used by argparse - parsing library)
- Artistic-2.0 (Used by textlint ecosystem packages)
- CC-BY-3.0 (Used by SPDX data)

### 📋 Third-Party Dependencies

The project includes dependencies from these main categories:

**VS Code Extension Development:**
- @vscode/vsce - VS Code Extension CLI tools (MIT)
- @types/vscode - TypeScript definitions (MIT)

**Build Tools:**
- esbuild - JavaScript bundler (MIT)
- TypeScript - Language compiler (Apache-2.0)

**Development Dependencies:**
- Various utility libraries for text processing, formatting, and file operations

## Compliance Process

1. **Automated Checking:** The `npm run license:check` command scans all dependencies
2. **CI/CD Integration:** License compliance is checked on every build
3. **Manual Review:** Licenses marked for review are evaluated by Microsoft legal team
4. **Documentation:** This file is updated when dependency changes occur

## Reporting License Issues

If you discover a license compatibility issue:

1. Run `npm run license:check` to get the current status
2. Document the specific package and license concern
3. Contact the project maintainers with details
4. For Microsoft employees: Consult the legal team via standard channels

## Updates and Maintenance

This document and compliance checking is updated when:
- New dependencies are added
- Existing dependencies are updated
- License requirements change
- Legal guidance is updated

Last Updated: December 2024