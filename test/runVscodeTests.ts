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

        // Enhanced launch arguments for better CI compatibility
        const launchArgs = [
            '--no-sandbox',
            '--disable-gpu-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--headless' // Always use headless mode for testing
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
