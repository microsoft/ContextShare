# Publishing the ContextShare Extension

This document outlines the steps to publish new versions of the ContextShare extension to the Visual Studio Marketplace.

## Prerequisites

1.  **Node.js and npm**: Ensure you have Node.js (which includes npm) installed.
2.  **Azure DevOps Account**: You need an Azure DevOps account to create a Personal Access Token (PAT).
3.  **Publisher Account**: You must be a member of the "ContextShare" publisher account on the VS Code Marketplace.

## One-Time Setup: Personal Access Token (PAT)

To publish to the Marketplace, you need a Personal Access Token (PAT) with publishing rights.

1.  **Create a PAT**:
    *   Navigate to your Azure DevOps organization (e.g., `https://dev.azure.com/{your_organization_name}`).
    *   Go to **User settings** (the gear icon) > **Personal Access Tokens**.
    *   Click **+ New Token**.
    *   Give it a descriptive name (e.g., `vsce-publish-contextshare`).
    *   Set the **Organization** to "All accessible organizations".
    *   Set the **Scope** to **Custom defined** and click **Show all scopes**.
    *   Find and select **Marketplace (Manage)**.
    *   Click **Create**.

2.  **Store the PAT**:
    *   **IMPORTANT**: Copy the generated token immediately. You will not be able to see it again.
    *   Create a new file named `.env` in the root of this project.
    *   Add the following line to your `.env` file, replacing `{your_pat}` with the token you just copied:
        ```
        VSCE_PAT={your_pat}
        ```
    *   The `.env` file is already listed in `.gitignore`, so it will not be committed to source control.

## Publishing a Pre-Release Version

Use this for testing new features before a stable release. The version in `package.json` (e.g., `0.4.0`) will be published as a pre-release.

1.  **Ensure `package.json` has the correct version number.**
2.  Run the following command:

    ```bash
    npm run publish:prerelease
    ```

This will build, test, and publish the extension as a pre-release (e.g., `0.4.0 (Pre-release)`).

## Publishing a Stable Version

Once a pre-release version has been tested and is ready for general availability, you can publish it as a stable release.

1.  **Ensure `package.json` has the correct version number.**
2.  Run the following command:

    ```bash
    npm run publish:stable
    ```

This will publish the version as a stable release, making it the default for all users.

## Packaging without Publishing

If you only want to create the `.vsix` file without publishing it to the Marketplace, run:

```bash
npm run package
```

The generated `.vsix` file will be in the root of the project directory.
