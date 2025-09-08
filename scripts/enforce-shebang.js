
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const workspaceRoot = path.resolve(__dirname, '..');
const patterns = ['**/*.js', '**/*.ts', '**/*.sh'];

console.log('Running shebang enforcement script...');

let filesProcessed = 0;
let filesFixed = 0;

const allFiles = patterns.flatMap(pattern => glob.sync(pattern, { cwd: workspaceRoot, nodir: true, ignore: '**/node_modules/**' }));
const uniqueFiles = [...new Set(allFiles)];

uniqueFiles.forEach(file => {
    const filePath = path.join(workspaceRoot, file);
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split(/\r?\n/);
        
        let shebangLine = -1;
        let shebangContent = '';

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('#!')) {
                shebangLine = i;
                shebangContent = lines[i];
                break;
            }
        }

        if (shebangLine > 0) {
            console.log(`Fixing shebang in: ${file}`);
            lines.splice(shebangLine, 1);
            
            // Remove any leading empty lines
            while (lines.length > 0 && lines[0].trim() === '') {
                lines.shift();
            }

            lines.unshift(shebangContent);
            
            const newContent = lines.join('\n');
            fs.writeFileSync(filePath, newContent, 'utf8');
            filesFixed++;
        }
        filesProcessed++;
    } catch (error) {
        console.error(`Error processing file ${file}:`, error);
    }
});

console.log(`\nShebang script finished.`);
console.log(`Processed: ${filesProcessed} files.`);
console.log(`Fixed: ${filesFixed} files.`);

if (filesFixed > 0) {
    console.log('Some files were modified to enforce shebang position.');
} else {
    console.log('All files with shebangs are compliant.');
}
