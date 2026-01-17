#!/usr/bin/env node
import minimist from 'minimist';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CLIConfigService } from './services/cliConfigService';
import { ApiKeyService } from './services/apiKeyService';
import { ProviderRegistry } from './providers';
import { setZaiApiKey } from './providers/zai';
import { formatTable } from './cli/tableFormatter';

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
      const packageJsonPath = join(__dirname, '..', 'package.json');
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

  if (!argv.json) {
    console.log('Universal Agent Quota Tracker CLI');
  }

  try {
    // Initialize services
    const configService = new CLIConfigService();
    const apiKeyService = new ApiKeyService(configService);
    
    // Load API keys
    const zaiKey = await apiKeyService.getApiKey('zai');
    if (zaiKey) {
      setZaiApiKey(zaiKey);
    }
    
    // Initialize Registry
    const registry = new ProviderRegistry();
    
    if (!argv.json) {
      console.log('Fetching quotas...');
    }
    
    // Fetch all
    const results = await registry.fetchAll();
    
    if (argv.json) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      console.log(formatTable(results));
    }
  } catch (error) {
    console.error('Error fetching quotas:', error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
