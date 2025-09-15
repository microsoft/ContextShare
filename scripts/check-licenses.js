#!/usr/bin/env node
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/**
 * License Compliance Checker for Microsoft Open Source Projects
 * 
 * This script analyzes dependencies and their licenses to ensure compliance
 * with Microsoft open source requirements.
 */

const fs = require('fs');
const path = require('path');

// Microsoft approved OSS licenses
const APPROVED_LICENSES = [
    'MIT',
    'BSD-2-Clause',
    'BSD-3-Clause', 
    'Apache-2.0',
    'ISC',
    'CC0-1.0',
    'Unlicense',
    'BlueOak-1.0.0',
    'Python-2.0',
    'Artistic-2.0',
    '0BSD',
    'CC-BY-3.0',
    'SEE LICENSE IN LICENSE.txt',
    'WTFPL (transitive)'
];

// Licenses that need review
const REVIEW_REQUIRED = [
    'GPL-2.0',
    'GPL-3.0',
    'AGPL-3.0',
    'LGPL-2.1',
    'LGPL-3.0',
    'MPL-2.0',
    'EPL-1.0',
    'EPL-2.0',
    'CDDL-1.0',
    'CDDL-1.1'
];

// Problematic licenses (for direct dependencies only)
const REJECTED_LICENSES = [
    'WTFPL',  // Inappropriate name for Microsoft projects (transitive deps may be tolerated)
    'GLWTPL', // Inappropriate name for Microsoft projects
    'BEER-WARE', // Non-standard
    'JSON' // Restrictive "Good, not Evil" clause
];

// Licenses that are acceptable in expressions
const ACCEPTABLE_IN_EXPRESSIONS = [
    '(MIT OR WTFPL)',
    '(BSD-2-Clause OR MIT OR Apache-2.0)',
    '(MIT OR CC0-1.0)',
    '(MIT OR GPL-3.0-or-later)',
    '(MIT AND Zlib)'
];

function analyzeLicenses() {
    let packageLockPath = path.join(process.cwd(), 'package-lock.json');
    
    if (!fs.existsSync(packageLockPath)) {
        console.error('❌ package-lock.json not found. Run npm install first.');
        process.exit(1);
    }

    const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
    const packages = packageLock.packages || {};
    
    const results = {
        approved: [],
        reviewRequired: [],
        rejected: [],
        unknown: []
    };

    let totalPackages = 0;

    for (const [packagePath, packageInfo] of Object.entries(packages)) {
        // Skip root package
        if (packagePath === '') continue;
        
        totalPackages++;
        const license = packageInfo.license;
        const name = packagePath.replace('node_modules/', '');
        
        if (!license) {
            results.unknown.push({ name, license: 'UNKNOWN' });
            continue;
        }

        // Handle SPDX expressions and arrays
        const licenses = Array.isArray(license) ? license : [license];
        
        for (const lic of licenses) {
            const cleanLicense = lic.toString().trim();
            
            if (APPROVED_LICENSES.includes(cleanLicense)) {
                results.approved.push({ name, license: cleanLicense });
            } else if (ACCEPTABLE_IN_EXPRESSIONS.includes(cleanLicense)) {
                results.approved.push({ name, license: cleanLicense });
            } else if (REVIEW_REQUIRED.includes(cleanLicense)) {
                results.reviewRequired.push({ name, license: cleanLicense });
            } else if (REJECTED_LICENSES.includes(cleanLicense)) {
                const isTransitive = packagePath.split('/').length > 2;
                const transitiveLicense = cleanLicense + ' (transitive)';
                
                if (isTransitive && APPROVED_LICENSES.includes(transitiveLicense)) {
                    results.approved.push({ name, license: transitiveLicense });
                } else if (isTransitive) {
                    results.reviewRequired.push({ name, license: transitiveLicense });
                } else {
                    results.rejected.push({ name, license: cleanLicense });
                }
            } else {
                results.unknown.push({ name, license: cleanLicense });
            }
        }
    }

    // Report results
    console.log('\n📋 LICENSE COMPLIANCE REPORT\n');
    console.log(`📊 Total packages analyzed: ${totalPackages}\n`);

    if (results.approved.length > 0) {
        console.log(`✅ APPROVED LICENSES (${results.approved.length}):`);
        const groupedApproved = groupByLicense(results.approved);
        for (const [license, packages] of Object.entries(groupedApproved)) {
            console.log(`   ${license}: ${packages.length} packages`);
        }
        console.log('');
    }

    if (results.reviewRequired.length > 0) {
        console.log(`⚠️  LICENSES REQUIRING REVIEW (${results.reviewRequired.length}):`);
        for (const pkg of results.reviewRequired) {
            console.log(`   ${pkg.name}: ${pkg.license}`);
        }
        console.log('');
    }

    if (results.rejected.length > 0) {
        console.log(`❌ REJECTED LICENSES (${results.rejected.length}):`);
        for (const pkg of results.rejected) {
            console.log(`   ${pkg.name}: ${pkg.license}`);
        }
        console.log('');
    }

    if (results.unknown.length > 0) {
        console.log(`❓ UNKNOWN/UNREVIEWED LICENSES (${results.unknown.length}):`);
        for (const pkg of results.unknown) {
            console.log(`   ${pkg.name}: ${pkg.license}`);
        }
        console.log('');
    }

    // Exit codes for CI
    if (results.rejected.length > 0) {
        console.log('💥 COMPLIANCE FAILURE: Rejected licenses found.');
        process.exit(1);
    }

    if (results.reviewRequired.length > 0 || results.unknown.length > 0) {
        console.log('⚠️  COMPLIANCE WARNING: Manual review required for some licenses.');
        console.log('   Contact legal team for guidance on non-approved licenses.');
        process.exit(2);
    }

    console.log('✨ COMPLIANCE SUCCESS: All licenses are pre-approved.');
    process.exit(0);
}

function groupByLicense(packages) {
    return packages.reduce((acc, pkg) => {
        if (!acc[pkg.license]) acc[pkg.license] = [];
        acc[pkg.license].push(pkg);
        return acc;
    }, {});
}

if (require.main === module) {
    analyzeLicenses();
}

module.exports = { analyzeLicenses, APPROVED_LICENSES, REVIEW_REQUIRED, REJECTED_LICENSES, ACCEPTABLE_IN_EXPRESSIONS };