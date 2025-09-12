# Azure Pipeline Test and Validation Steps

This document outlines the automated checks, tests, and validation steps performed by the `azure-pipelines.yml` file for this project. These steps ensure code quality, security, and compliance before any changes are merged.

## Pipeline Stages

The pipeline executes the following key validation steps in order:

### 1. Install Node.js
- **Task:** `NodeTool@0`
- **Purpose:** Ensures a specific version of Node.js (`20.x`) is installed on the build agent for a consistent runtime environment.

### 2. Component Governance Detection
- **Task:** `ComponentGovernanceComponentDetection@0`
- **Purpose:** This is a mandatory security scan for Microsoft open source projects. It scans all project dependencies (npm packages) and registers them with Microsoft's Component Governance service to detect known vulnerabilities, policy violations, or other security risks.

### 3. Dependency Installation
- **Command:** `npm ci`
- **Purpose:** Installs project dependencies from the `package-lock.json` file. Using `ci` instead of `install` ensures a clean, reproducible build that exactly matches the locked dependency versions.

### 4. Security Audit
- **Command:** `npm run security:audit`
- **Purpose:** Runs `npm audit` to check for known security vulnerabilities within the installed packages. This provides an immediate, first-party check against the public npm vulnerability database. The `continueOnError: true` flag ensures that the pipeline continues even if vulnerabilities are found, allowing for manual review.

### 5. License Compliance Check
- **Command:** `npm run license:check`
- **Purpose:** Executes a script to verify that all project dependencies have permissive and compliant licenses. This is crucial for maintaining the open source integrity of the project.

### 6. Build Extension
- **Command:** `npm run build`
- **Purpose:** Compiles the TypeScript source code into JavaScript. This step acts as a critical integration check, ensuring that the code is syntactically correct and that all types match. A successful build is a prerequisite for running the functional tests.

### 7. Run Tests
- **Command:** `npm test` (within a virtual framebuffer environment)
- **Purpose:** This is the primary testing stage, which executes the full suite of automated tests for the VS Code extension.
- **Environment Setup:**
  - `sudo apt-get update && sudo apt-get install ...`: Before running the tests, the script installs a comprehensive list of system libraries required to run a headless instance of VS Code (and its underlying Electron/Chromium framework) on a Linux build agent.
  - `Xvfb`: The tests are run inside an `Xvfb` (X Virtual Framebuffer) session. This creates a virtual, in-memory display server, which is necessary for running GUI-based applications like VS Code in a headless CI/CD environment where no physical display is present.
  - `export DISPLAY=:99`: This environment variable tells the application to use the virtual display created by `Xvfb`.
- **Execution:** Runs the Mocha test suite, which launches a temporary instance of VS Code with the extension loaded and performs a series of integration and unit tests.
