#!/usr/bin/env node
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
const fs = require('fs');
const path = require('path');

function readJson(p){ return JSON.parse(fs.readFileSync(p, 'utf8')); }
function readText(p){ return fs.readFileSync(p, 'utf8'); }

const repoRoot = path.resolve(__dirname, '..');
const pkg = readJson(path.join(repoRoot, 'package.json'));
const manifestPath = path.join(repoRoot, 'vsix', 'extension.vsixmanifest');
const xml = readText(manifestPath);
const m = xml.match(/Identity[^>]*Version="([^"]+)"/i);
const manifestVersion = m ? m[1] : null;

if(!manifestVersion){
  console.error(`ERROR: Could not read Version from ${manifestPath}`);
  process.exit(2);
}

const shouldFix = process.argv.includes('--fix');

if(pkg.version !== manifestVersion){
  if (shouldFix) {
    console.log(`Version mismatch detected. package.json=${pkg.version}, manifest=${manifestVersion}. Updating manifest...`);
    const updatedXml = xml.replace(/(<Identity[^>]*Version=")([^"]+)(")/i, `$1${pkg.version}$3`);
    fs.writeFileSync(manifestPath, updatedXml, 'utf8');
    console.log(`Successfully updated ${manifestPath} to version ${pkg.version}`);
  } else {
    console.error(`ERROR: Version mismatch. package.json is ${pkg.version}, but vsixmanifest is ${manifestVersion}.`);
    console.error('Run with --fix to automatically update the manifest.');
    process.exit(1);
  }
} else {
  console.log(`Version sync OK: ${pkg.version}`);
}
