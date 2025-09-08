// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
import * as fs from 'fs';
import * as path from 'path';

(function run(){
  // __dirname is .../dist/test when compiled; project root is two levels up
  const root = path.resolve(__dirname, '..', '..');
  const pkgPath = path.join(root, 'package.json');
  const extJsPath = path.join(root, 'dist', 'src', 'extension.js');
  if(!fs.existsSync(extJsPath)){
    console.error('commandsRegistered.test FAIL: build output missing at', extJsPath);
    process.exit(1);
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const declared: string[] = (pkg.contributes?.commands || []).map((c:any)=> c.command);
  const js = fs.readFileSync(extJsPath, 'utf8');
  const reg = new Set<string>();
  const re = /registerCommand\(['"]([^'\"]+)['"]/g;
  let m: RegExpExecArray | null;
  while((m = re.exec(js))){ reg.add(m[1]); }
  const missing = declared.filter(cmd => cmd.startsWith('copilotCatalog.') && !reg.has(cmd));
  if(missing.length){
    console.error('Missing command registrations:', missing);
    throw new Error('Some contributed commands are not registered');
  }
  console.log('commandsRegistered.test PASS');
})()
