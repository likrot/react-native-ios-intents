#!/usr/bin/env node

const { program } = require('commander');
const { execSync } = require('child_process');
const path = require('path');

program
  .name('react-native-ios-intents')
  .description('CLI for react-native-ios-intents')
  .version(require('../package.json').version);

program
  .command('generate')
  .description('Generate Swift AppIntents from shortcuts.config.ts')
  .action(() => {
    console.log('Generating App Intents...\n');
    try {
      // Use compiled TypeScript from scripts/cli
      const scriptPath = path.resolve(__dirname, 'cli/generate-shortcuts.js');
      execSync(`node "${scriptPath}"`, { stdio: 'inherit' });
    } catch (error) {
      process.exit(1);
    }
  });

program.parse();
