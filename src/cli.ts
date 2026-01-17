#!/usr/bin/env node
import minimist from 'minimist';
import { readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  const argv = minimist(process.argv.slice(2), {
    boolean: ['version', 'help', 'json'],
    alias: {
      v: 'version',
      h: 'help',
    },
  });

  if (argv.version) {
    // Read package.json at runtime to avoid build structure issues
    try {
      const packageJsonPath = join(__dirname, '..', 'package.json'); // Assumes out/cli.js -> ../package.json logic if run from out, but in src it is different.
      // Actually, when running from ./out/cli.js, the package.json is in ../package.json relative to the file.
      // But let's verify where out is. Root/out. Root/package.json. So yes, ../package.json.
      
      const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      console.log(`v${pkg.version}`);
    } catch (e) {
      console.log('Unknown version');
    }
    process.exit(0);
  }

  if (argv.help) {
    console.log(`
Usage: uaq [options]

Options:
  -v, --version  Show version number
  -h, --help     Show help
  --json         Output results as JSON
`);
    process.exit(0);
  }

  console.log('Universal Agent Quota Tracker CLI');
  // Future implementation: Fetch providers
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
