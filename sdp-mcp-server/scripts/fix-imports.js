#!/usr/bin/env node

/**
 * Script to automatically fix common TypeScript import issues
 */

const fs = require('fs').promises;
const path = require('path');

const fixes = {
  // Remove unused imports
  removeUnused: true,
  // Add .js extensions to relative imports
  addJsExtensions: true,
  // Fix import ordering
  orderImports: true
};

async function* walkDir(dir) {
  const files = await fs.readdir(dir, { withFileTypes: true });
  for (const file of files) {
    if (file.isDirectory() && !file.name.startsWith('.') && file.name !== 'node_modules') {
      yield* walkDir(path.join(dir, file.name));
    } else if (file.name.endsWith('.ts') && !file.name.endsWith('.d.ts')) {
      yield path.join(dir, file.name);
    }
  }
}

async function fixImportsInFile(filePath) {
  let content = await fs.readFile(filePath, 'utf8');
  let modified = false;
  
  // Add .js extensions to relative imports
  if (fixes.addJsExtensions) {
    const importRegex = /from\s+['"](\.[^'"]+)(?<!\.js)(?<!\.json)['"]/g;
    const newContent = content.replace(importRegex, (match, importPath) => {
      modified = true;
      return `from '${importPath}.js'`;
    });
    if (modified) content = newContent;
  }
  
  // More fixes can be added here...
  
  if (modified) {
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`✅ Fixed: ${path.relative(process.cwd(), filePath)}`);
    return 1;
  }
  
  return 0;
}

async function main() {
  console.log('🔧 Fixing TypeScript Import Issues');
  console.log('==================================\n');
  
  const srcDir = path.join(__dirname, '..', 'src');
  let totalFixed = 0;
  
  for await (const file of walkDir(srcDir)) {
    totalFixed += await fixImportsInFile(file);
  }
  
  console.log(`\n✨ Fixed ${totalFixed} files`);
  console.log('\nNext steps:');
  console.log('1. Run: npm run typecheck:dev');
  console.log('2. Fix remaining errors manually');
  console.log('3. Run: npm run build:dev');
}

main().catch(console.error);