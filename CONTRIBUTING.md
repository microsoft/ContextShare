# Contributing to ContextHub

Thank you for your interest in contributing to ContextHub! This document provides guidelines and instructions for contributing to the project.

## 🚀 Getting Started

### Prerequisites

- **Node.js**: Version 18+ with npm
- **Visual Studio Code**: Version 1.90.0 or later
- **TypeScript**: Version 5.4+
- **Git**: For version control

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/vscode-contexthub.git
   cd vscode-contexthub
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Build the Extension**
   ```bash
   npm run build
   ```

4. **Run Tests**
   ```bash
   npm test
   ```

## 🔄 Development Workflow

We follow a **Test-Driven Development (TDD)** approach and adhere to strict quality gates:

### 1. **Red → Green → Refactor Cycle**

1. **REPRO** (for bugs): Reproduce the issue manually
2. **RED**: Write a failing test first that demonstrates the problem
3. **GREEN**: Implement the minimal code to make the test pass
4. **REFACTOR**: Clean up the implementation while keeping tests green

### 2. **Version Management**

- Update `package.json` version following [Semantic Versioning](https://semver.org/)
- Keep `vsix/extension.vsixmanifest` version synchronized
- Update `CHANGELOG.md` with user-visible changes
- Place new changelog entries at the TOP (newest first)

### 3. **Quality Gates**

Before any pull request:

```bash
# 1. Clean build (must succeed)
rm -rf dist/
npm run build

# 2. Run all tests (must pass)
npm test

# 3. Check TypeScript compilation
npx tsc --noEmit

# 4. Package extension (Windows only)
pwsh ./build_vsix.ps1
```

## 📝 Coding Standards

### TypeScript Guidelines

- Use strict TypeScript configuration
- Prefer explicit types over `any`
- Follow existing code style and patterns
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

### Testing Requirements

- **Every bug fix** must include a new test that would fail without the fix
- **Every new feature** must have corresponding test coverage
- Tests should be fast, deterministic, and independent
- Avoid network calls in tests (use mocks when needed)

### Test Categories

| Type | Location | Purpose |
|------|----------|---------|
| Unit Tests | `test/*.test.ts` | Fast, isolated logic testing |
| Integration Tests | `test/integration/` | Component interaction testing |
| E2E Tests | `test/e2e/` | Full workflow testing |

## 🌟 Contribution Types

We welcome various types of contributions:

### 🐛 Bug Fixes

1. **Search existing issues** to avoid duplicates
2. **Reproduce the bug** and create a minimal test case
3. **Write a failing test** that demonstrates the issue
4. **Implement the fix** to make the test pass
5. **Update documentation** if behavior changes

### ✨ New Features

1. **Discuss the feature** by opening an issue first
2. **Design the API** and get feedback from maintainers
3. **Write tests** for the expected behavior
4. **Implement the feature** incrementally
5. **Update documentation** and examples

### 📚 Documentation

1. **Improve README** and setup guides
2. **Add code examples** and usage patterns
3. **Update API documentation** for new features
4. **Fix typos** and improve clarity

### 🧪 Testing

1. **Increase test coverage** for existing code
2. **Add edge case tests** that weren't previously covered
3. **Improve test reliability** and reduce flakiness
4. **Add performance tests** for critical paths

## 📋 Pull Request Process

### 1. **Branch Naming**

Use descriptive branch names:
- `feature/add-remote-catalog-support`
- `bugfix/fix-resource-activation-race`
- `docs/improve-setup-guide`
- `test/add-hat-service-coverage`

### 2. **Commit Messages**

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add support for remote catalog URLs
fix: resolve race condition in resource activation
docs: update installation instructions
test: add coverage for MCP server merging
```

### 3. **Pull Request Template**

When opening a PR, include:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change fixing an issue)
- [ ] New feature (non-breaking change adding functionality)
- [ ] Breaking change (fix or feature causing existing functionality to change)
- [ ] Documentation update

## Testing
- [ ] Added/updated tests for changes
- [ ] All tests pass locally
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Version bumped appropriately
- [ ] CHANGELOG.md updated
```

### 4. **Review Process**

1. **Automated checks** must pass (CI/CD pipeline)
2. **At least one approval** required from maintainers
3. **Address review feedback** promptly
4. **Squash commits** before merging (if requested)

## 🚨 Issue Reporting

### Bug Reports

Use our bug report template:

```markdown
**Bug Description**
Clear description of the bug

**Steps to Reproduce**
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior**
What should happen

**Screenshots**
If applicable

**Environment**
- OS: [e.g., Windows 11]
- VS Code Version: [e.g., 1.90.0]
- Extension Version: [e.g., 0.1.33]
```

### Feature Requests

```markdown
**Feature Description**
Clear description of the desired feature

**Use Case**
Why is this feature needed?

**Proposed Solution**
How should it work?

**Alternatives Considered**
Other approaches you've thought about
```

## 🔒 Security

- **Never commit** sensitive information (API keys, passwords, etc.)
- **Report security vulnerabilities** privately via [SECURITY.md](SECURITY.md)
- **Follow secure coding practices** and validate all inputs
- **Use dependency scanning** to avoid vulnerable packages

## 🎯 Code of Conduct

This project follows the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). Please be respectful and professional in all interactions.

## 📞 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Documentation**: Check existing docs before asking questions

## 🏆 Recognition

Contributors will be recognized in:
- Release notes for their contributions
- GitHub contributors page
- Special thanks for significant contributions

Thank you for helping make ContextHub better! 🚀
