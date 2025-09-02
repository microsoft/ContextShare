#!/usr/bin/env node
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

if(pkg.version !== manifestVersion){
  console.error(`ERROR: Version mismatch. package.json=${pkg.version}, manifest=${manifestVersion}`);
  console.error('Hint: use build_vsix.ps1 or build_vsix.sh with --bump to auto-sync the manifest.');
  process.exit(1);
}

console.log(`Version sync OK: ${pkg.version}`);