import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        // Passed to --extensionDevelopmentPath
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to the extension test script
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, './runTest');

        // Minimal launch arguments for CI compatibility
        const launchArgs = [
            '--no-sandbox',
            '--disable-dev-shm-usage'
        ];

        // Download VS Code, unzip it and run the integration test
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs,
            version: 'stable'
        });
    } catch (err) {
        console.error('Failed to run tests');
        process.exit(1);
    }
}

main();
