#!/usr/bin/env node
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * Security Scanner for PromptVault
 * 
 * Scans for potential security issues like hardcoded secrets, 
 * unsafe patterns, and security anti-patterns.
 */

const fs = require('fs');
const path = require('path');

// Patterns that might indicate hardcoded secrets
const SECRET_PATTERNS = [
    /['"](sk-[a-zA-Z0-9]{48,})['"]/g,  // OpenAI API keys
    /['"](AIza[0-9A-Za-z\-_]{35})['"]/g,  // Google API keys
    /['"](AKIA[0-9A-Z]{16})['"]/g,  // AWS Access Keys
    /['"](gh[ps]_[A-Za-z0-9_]{36,255})['"]/g,  // GitHub tokens
    /['"](xox[baprs]-[0-9a-zA-Z-]{10,72})['"]/g,  // Slack tokens
    /['"][A-Za-z0-9+/]{40,}={0,2}['"]/g,  // Base64 encoded (40+ chars)
    /password\s*[:=]\s*['"]\w{8,}['"]/gi,  // password = "something"
    /secret\s*[:=]\s*['"]\w{8,}['"]/gi,  // secret = "something"
    /token\s*[:=]\s*['"]\w{8,}['"]/gi,  // token = "something"
];

// File extensions to scan
const EXTENSIONS = ['.ts', '.js', '.json', '.md', '.txt', '.env'];

// Files/directories to skip
const SKIP_PATTERNS = [
    /node_modules/,
    /\.git/,
    /dist/,
    /\.vscode/,
    /\.nyc_output/,
    /coverage/,
    /\.vsix$/,
    /package-lock\.json$/  // Too noisy for secrets
];

// Files that can contain example/test secrets
const TEST_FILES = [
    /test\//,
    /\.test\./,
    /\.spec\./,
    /example/,
    /README/,
    /SECURITY/,
    /CHANGELOG/,
    /\.md$/
];

function shouldSkipFile(filePath) {
    return SKIP_PATTERNS.some(pattern => pattern.test(filePath));
}

function isTestFile(filePath) {
    return TEST_FILES.some(pattern => pattern.test(filePath));
}

function scanFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const findings = [];
        
        // Split into lines and remove comments for JS/TS files
        const lines = content.split('\n');
        const ext = path.extname(filePath);
        
        let inBlockComment = false;
        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            let line = lines[lineNum];
            
            // Skip comment lines in JS/TS files
            if (['.js', '.ts'].includes(ext)) {
                const trimmed = line.trim();
                // Handle block comments
                if (inBlockComment) {
                    if (trimmed.includes('*/')) {
                        inBlockComment = false;
                        // If there's code after the block comment ends, process it
                        const after = trimmed.split('*/')[1];
                        if (!after || after.trim() === '') continue;
                        line = after;
                    } else {
                        continue;
                    }
                }
                if (trimmed.startsWith('//')) {
                    continue;
                }
                // Start of block comment
                if (trimmed.includes('/*')) {
                    // If block comment ends on same line, skip only the comment part
                    if (trimmed.includes('*/')) {
                        const before = trimmed.split('/*')[0];
                        const after = trimmed.split('*/')[1];
                        if (!before && (!after || after.trim() === '')) continue;
                        line = before + (after ? after : '');
                    } else {
                        inBlockComment = true;
                        // If there's code before the block comment, process it
                        const before = trimmed.split('/*')[0];
                        if (!before || before.trim() === '') continue;
                        line = before;
                    }
                }
                // Remove inline comments
                const commentIndex = line.indexOf('//');
                if (commentIndex > 0) {
                    line = line.substring(0, commentIndex);
                }
            }
            
            for (const pattern of SECRET_PATTERNS) {
                pattern.lastIndex = 0; // Reset regex state
                let match;
                while ((match = pattern.exec(line)) !== null) {
                    findings.push({
                        file: filePath,
                        line: lineNum + 1,
                        pattern: pattern.source,
                        match: match[1] || match[0],
                        context: lines[lineNum].trim(),
                        isTest: isTestFile(filePath)
                    });
                }
            }
        }
        
        return findings;
        
    } catch (error) {
        console.warn(`⚠️  Could not read file ${filePath}: ${error.message}`);
        return [];
    }
}

function scanDirectory(dir) {
    const allFindings = [];
    
    function walkDir(currentDir) {
        try {
            const entries = fs.readdirSync(currentDir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);
                
                if (shouldSkipFile(fullPath)) {
                    continue;
                }
                
                if (entry.isDirectory()) {
                    walkDir(fullPath);
                } else if (entry.isFile()) {
                    const ext = path.extname(entry.name);
                    if (EXTENSIONS.includes(ext) || entry.name.startsWith('.env')) {
                        const findings = scanFile(fullPath);
                        allFindings.push(...findings);
                    }
                }
            }
        } catch (error) {
            console.warn(`⚠️  Could not read directory ${currentDir}: ${error.message}`);
        }
    }
    
    walkDir(dir);
    return allFindings;
}

function runSecurityScan() {
    console.log('🔍 Running security scan for potential secrets...\n');
    
    const findings = scanDirectory(process.cwd());
    
    if (findings.length === 0) {
        console.log('✅ No potential secrets detected');
        return 0;
    }
    
    const realFindings = findings.filter(f => !f.isTest);
    const testFindings = findings.filter(f => f.isTest);
    
    if (realFindings.length > 0) {
        console.log('❌ POTENTIAL SECRETS DETECTED:\n');
        for (const finding of realFindings) {
            console.log(`File: ${finding.file}:${finding.line}`);
            console.log(`Pattern: ${finding.pattern}`);
            console.log(`Context: ${finding.context}`);
            console.log(`Match: ${finding.match.substring(0, 20)}...`);
            console.log('');
        }
        
        console.log('🚨 Action Required: Review and remove any hardcoded secrets');
        console.log('   Use environment variables or secure configuration instead\n');
    }
    
    if (testFindings.length > 0) {
        console.log(`ℹ️  Found ${testFindings.length} potential secrets in test/example files:`);
        for (const finding of testFindings) {
            console.log(`   ${finding.file}:${finding.line} - ${finding.context.substring(0, 80)}...`);
        }
        console.log('   (Test/example secrets are typically acceptable)\n');
    }
    
    // Exit with error only if real secrets found
    return realFindings.length > 0 ? 1 : 0;
}

if (require.main === module) {
    const exitCode = runSecurityScan();
    process.exit(exitCode);
}

module.exports = { runSecurityScan, SECRET_PATTERNS };