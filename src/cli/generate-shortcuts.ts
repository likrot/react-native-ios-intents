#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import type { IntentsConfig } from '../types';
import {
  extractLocalizableStrings,
  extractAppShortcutsPhrases,
  mergeStringCatalog,
  mergeAppShortcutsStrings,
  generateTypeScriptTypes,
} from './utils';
import { generateSwiftFile } from './swift-codegen';
import {
  generateLiveActivitySwiftFile,
} from './liveactivity-codegen';

/**
 * Generates Swift AppIntent code from shortcuts.config.ts
 *
 * This script:
 * 1. Reads shortcuts.config.ts
 * 2. Generates Swift AppIntent structs for each shortcut
 * 3. Generates AppShortcutsProvider with all shortcuts
 * 4. Optionally generates Localizable.xcstrings for translations
 * 5. Writes to ios/<AppName>/GeneratedAppIntents.swift
 */

/**
 * Finds the app output directory by locating .xcodeproj in ios directory
 *
 * This function searches for the Xcode project file to determine the app name,
 * then locates the corresponding app directory where generated Swift files should be placed.
 *
 * @param iosDir - Path to the ios directory to search
 * @param contextLabel - Display label for error messages (e.g., "example/ios directory", "ios directory")
 * @returns Path to the app directory containing the app's Swift files
 * @throws Calls process.exit(1) if .xcodeproj not found or app directory doesn't exist
 */
function findAppOutputDir(iosDir: string, contextLabel: string): string {
  if (!fs.existsSync(iosDir)) {
    console.error(`❌ ios directory not found: ${iosDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(iosDir);
  const xcodeprojFile = files.find((f) => f.endsWith('.xcodeproj'));

  if (!xcodeprojFile) {
    console.error(`❌ Could not find .xcodeproj in ${contextLabel}`);
    process.exit(1);
  }

  const appName = xcodeprojFile.replace('.xcodeproj', '');
  const outputDir = path.resolve(iosDir, appName);

  if (!fs.existsSync(outputDir)) {
    console.error(`❌ App directory not found: ${outputDir}`);
    process.exit(1);
  }

  console.log(`✅ Found app: ${appName}`);
  return outputDir;
}

/**
 * Main CLI entry point for generating Swift App Intents from shortcuts config
 *
 * This function supports three execution modes:
 *
 * 1. **Example Mode** (--example flag):
 *    - Used during library development for testing
 *    - Reads config from example/shortcuts.config.ts
 *    - Outputs to example/ios/<AppName>/GeneratedAppIntents.swift
 *
 * 2. **Library Development Mode** (no flag, running from library source):
 *    - Used when developing the library itself
 *    - Reads config from lib/module/shortcuts.config.js (compiled)
 *    - Outputs to ios/ directory
 *
 * 3. **Consumer App Mode** (no flag, library installed as dependency):
 *    - Used by apps that depend on react-native-ios-intents
 *    - Reads config from app root shortcuts.config.ts/js
 *    - Outputs to app's ios/<AppName>/GeneratedAppIntents.swift
 *    - Creates template config if none exists
 *
 * The function automatically detects which mode to use based on:
 * - Command line flags (--example)
 * - Presence of react-native-ios-intents in package.json dependencies
 *
 * @throws Exits process with code 1 on errors (file not found, invalid config, etc.)
 */
async function main(): Promise<void> {
  try {
    // Check for --example flag
    const isExampleMode = process.argv.includes('--example');

    if (isExampleMode) {
      console.log('🔍 Reading example shortcuts configuration...');
    } else {
      console.log('🔍 Reading shortcuts configuration...');
    }

    // Determine if we're running from the library itself (dev mode) or from a consuming app
    // This affects where we look for shortcuts.config and where we output generated files
    const cwd = process.cwd();
    const packageJsonPath = path.resolve(cwd, 'package.json');
    let isLibrary = true; // Default to library mode (safe for missing package.json)

    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        // Combine both dependencies and devDependencies to check for this library
        const deps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };
        // If the app depends on this library, it's a consuming app (not library development)
        if (deps['react-native-ios-intents']) {
          isLibrary = false; // Switch to consumer app mode
        }
      } catch {
        // package.json parse failed - assume library mode (safe default)
        // This can happen if JSON is invalid or file permissions prevent reading
        console.warn('⚠️  Could not parse package.json, assuming library mode');
      }
    }

    let configPath: string;
    let outputDir: string;

    // Example mode: for library development
    if (isExampleMode) {
      const projectRoot = path.resolve(__dirname, '../..');
      const exampleRoot = path.resolve(projectRoot, 'example');

      // Look for intents.config first, fall back to shortcuts.config (deprecated)
      const tsConfigNew = path.resolve(exampleRoot, 'intents.config.ts');
      const jsConfigNew = path.resolve(exampleRoot, 'intents.config.js');
      const tsConfigLegacy = path.resolve(exampleRoot, 'shortcuts.config.ts');
      const jsConfigLegacy = path.resolve(exampleRoot, 'shortcuts.config.js');

      let useDeprecatedName = false;
      let tsConfig: string | undefined;
      let jsConfig: string | undefined;

      if (fs.existsSync(tsConfigNew)) {
        tsConfig = tsConfigNew;
      } else if (fs.existsSync(jsConfigNew)) {
        jsConfig = jsConfigNew;
      } else if (fs.existsSync(tsConfigLegacy)) {
        tsConfig = tsConfigLegacy;
        useDeprecatedName = true;
      } else if (fs.existsSync(jsConfigLegacy)) {
        jsConfig = jsConfigLegacy;
        useDeprecatedName = true;
      }

      if (useDeprecatedName) {
        console.warn('⚠️  shortcuts.config.ts is deprecated — rename to intents.config.ts');
      }

      if (tsConfig) {
        try {
          const tsNodePath = path.resolve(projectRoot, 'node_modules/ts-node/register');
          require(tsNodePath);
          configPath = tsConfig;
        } catch (err) {
          console.error('❌ Failed to load TypeScript config');
          console.error('   Error:', (err as Error).message);
          process.exit(1);
        }
      } else if (jsConfig) {
        configPath = jsConfig;
      } else {
        console.error('❌ No intents.config.ts found in example/');
        process.exit(1);
      }

      // Find example app's iOS directory
      outputDir = findAppOutputDir(
        path.resolve(exampleRoot, 'ios'),
        'example/ios directory'
      );
    } else if (isLibrary) {
      // Library mode: for library development without --example
      const projectRoot = path.resolve(__dirname, '../..');
      const newConfigPath = path.resolve(projectRoot, 'lib/module/intents.config.js');
      const legacyConfigPath = path.resolve(projectRoot, 'lib/module/shortcuts.config.js');

      if (fs.existsSync(newConfigPath)) {
        configPath = newConfigPath;
      } else if (fs.existsSync(legacyConfigPath)) {
        configPath = legacyConfigPath;
        console.warn('⚠️  shortcuts.config.js is deprecated — rename to intents.config.js');
      } else {
        console.error('❌ intents.config.js not found in lib/module/');
        console.error('   Expected at:', newConfigPath);
        console.error('   Make sure to run "bob build" first');
        process.exit(1);
      }
      outputDir = path.resolve(projectRoot, 'ios');
    } else {
      const appRoot = process.cwd();

      // Look for intents.config first, fall back to shortcuts.config (deprecated)
      const tsConfigNew = path.resolve(appRoot, 'intents.config.ts');
      const jsConfigNew = path.resolve(appRoot, 'intents.config.js');
      const tsConfigLegacy = path.resolve(appRoot, 'shortcuts.config.ts');
      const jsConfigLegacy = path.resolve(appRoot, 'shortcuts.config.js');

      let foundConfig: string | undefined;
      let isLegacy = false;

      if (fs.existsSync(tsConfigNew)) {
        try {
          require('ts-node/register');
          foundConfig = tsConfigNew;
        } catch {
          console.error('\n❌ Found intents.config.ts but ts-node is not installed\n');
          console.error('Choose one option:\n');
          console.error('Option 1: Install ts-node (keep TypeScript config)');
          console.error('  npm install --save-dev ts-node typescript\n');
          console.error('Option 2: Use JavaScript config instead');
          console.error('  mv intents.config.ts intents.config.js');
          console.error('  (You\'ll still get TypeScript autocomplete in your app!)\n');
          process.exit(1);
        }
      } else if (fs.existsSync(jsConfigNew)) {
        foundConfig = jsConfigNew;
      } else if (fs.existsSync(tsConfigLegacy)) {
        isLegacy = true;
        try {
          require('ts-node/register');
          foundConfig = tsConfigLegacy;
        } catch {
          console.error('\n❌ Found shortcuts.config.ts but ts-node is not installed\n');
          console.error('Choose one option:\n');
          console.error('Option 1: Install ts-node (keep TypeScript config)');
          console.error('  npm install --save-dev ts-node typescript\n');
          console.error('Option 2: Use JavaScript config instead');
          console.error('  mv shortcuts.config.ts shortcuts.config.js');
          console.error('  (You\'ll still get TypeScript autocomplete in your app!)\n');
          process.exit(1);
        }
      } else if (fs.existsSync(jsConfigLegacy)) {
        isLegacy = true;
        foundConfig = jsConfigLegacy;
      }

      if (isLegacy && foundConfig) {
        console.warn('⚠️  shortcuts.config.ts is deprecated — rename to intents.config.ts');
      }

      if (foundConfig) {
        configPath = foundConfig;
      } else {
        console.log('📝 No intents.config.ts found, creating template...');

        const templatePath = tsConfigNew;
        const template = `import type { IntentsConfig } from 'react-native-ios-intents';

        /**
         * Intents Configuration
         *
         * Define your app's Siri shortcuts and Live Activities here. After editing this file, run:
         * npx react-native-ios-intents generate
         */
        const config: IntentsConfig = {
        shortcuts: [
            {
            identifier: 'exampleAction',
            title: 'Example Action',
            phrases: [
                'Do example action',
                'Run example',
                'Example shortcut',
            ],
            systemImageName: 'star.circle',
            description: 'An example shortcut - customize this!',
            },
        ],
        // Enable localization support (optional)
        // localization: true,
        };

        export default config;
        `;

        fs.writeFileSync(templatePath, template, 'utf8');
        console.log('✅ Created template: intents.config.ts');
        console.log('');
        console.log('📝 Next steps:');
        console.log('   1. Edit intents.config.ts to define your shortcuts');
        console.log('   2. Run: npx react-native-ios-intents generate');
        console.log('');
        process.exit(0);
      }

      outputDir = findAppOutputDir(
        path.resolve(appRoot, 'ios'),
        'ios directory'
      );
    }

    let config: IntentsConfig;
    try {
      const loaded = require(configPath);
      config = loaded.default || loaded;
    } catch (error) {
      console.error('❌ Failed to load shortcuts config');
      console.error('   Error:', (error as Error).message);
      process.exit(1);
    }

    if (!config || !config.shortcuts) {
      console.error('❌ Invalid config: must export { shortcuts: [...] }');
      process.exit(1);
    }

    const useLocalization = config.localization === true;
    console.log(`✅ Found ${config.shortcuts.length} shortcuts`);
    if (useLocalization) {
      console.log('🌍 Localization enabled');
    }

    console.log('🔨 Generating Swift code...');
    const swiftCode = generateSwiftFile(config, useLocalization);

    const outputPath = path.resolve(outputDir, 'GeneratedAppIntents.swift');
    fs.writeFileSync(outputPath, swiftCode, 'utf8');
    console.log('✅ Generated:', outputPath);

    // Generate localization files if enabled
    if (useLocalization) {
      console.log('🌍 Generating string catalog...');
      const localizableStrings = extractLocalizableStrings(config);

      const catalogPath = path.resolve(outputDir, 'Localizable.xcstrings');

      // Read existing catalog to preserve user translations
      let existingCatalog: string | null = null;
      if (fs.existsSync(catalogPath)) {
        try {
          existingCatalog = fs.readFileSync(catalogPath, 'utf8');
          console.log('📖 Found existing String Catalog, merging translations...');
        } catch (error) {
          console.warn('⚠️  Could not read existing String Catalog:', (error as Error).message);
        }
      }

      // Merge with existing translations or create new catalog
      const catalogContent = mergeStringCatalog(localizableStrings, existingCatalog);
      fs.writeFileSync(catalogPath, catalogContent, 'utf8');

      console.log('✅ Generated:', catalogPath);

      // Generate AppShortcuts.strings for phrase localization (iOS 16+ compatible)
      console.log('🎤 Generating phrase localizations...');
      const phrases = extractAppShortcutsPhrases(config);

      const phrasesPath = path.resolve(outputDir, 'AppShortcuts.strings');

      // Read existing phrases to preserve manual translations
      let existingPhrases: string | null = null;
      if (fs.existsSync(phrasesPath)) {
        try {
          existingPhrases = fs.readFileSync(phrasesPath, 'utf8');
          console.log('📖 Found existing AppShortcuts.strings, merging...');
        } catch (error) {
          console.warn('⚠️  Could not read existing AppShortcuts.strings:', (error as Error).message);
        }
      }

      // Merge with existing phrases or create new
      const phrasesContent = mergeAppShortcutsStrings(phrases, existingPhrases);
      fs.writeFileSync(phrasesPath, phrasesContent, 'utf8');

      console.log('✅ Generated:', phrasesPath);
      console.log(
        `🌍 Localization keys: ${Object.keys(localizableStrings).length}`
      );
      console.log(`🎤 Phrase keys: ${phrases.length}`);
    }

    // Generate TypeScript types for type-safe parameter access
    console.log('📘 Generating TypeScript types...');
    const typesContent = generateTypeScriptTypes(config);

    // Determine where to write the types file
    let typesOutputPath: string;
    if (isExampleMode) {
      // Example mode: write to example/src/
      const exampleRoot = path.resolve(__dirname, '../../example');
      typesOutputPath = path.resolve(exampleRoot, 'src', 'shortcuts.generated.d.ts');
    } else if (isLibrary) {
      // Library mode: write to src/
      const projectRoot = path.resolve(__dirname, '../..');
      typesOutputPath = path.resolve(projectRoot, 'src', 'shortcuts.generated.d.ts');
    } else {
      // Consumer app mode: write to src/ or root
      const appRoot = process.cwd();
      const srcDir = path.resolve(appRoot, 'src');
      if (fs.existsSync(srcDir)) {
        typesOutputPath = path.resolve(srcDir, 'shortcuts.generated.d.ts');
      } else {
        typesOutputPath = path.resolve(appRoot, 'shortcuts.generated.d.ts');
      }
    }

    fs.writeFileSync(typesOutputPath, typesContent, 'utf8');
    console.log('✅ Generated:', typesOutputPath);

    // Generate Live Activity Swift code if config has liveActivities
    if (config.liveActivities && config.liveActivities.length > 0) {
      console.log('🔴 Generating Live Activity code...');
      console.log(`✅ Found ${config.liveActivities.length} Live Activities`);

      const liveActivitySwift = generateLiveActivitySwiftFile(config);
      const liveActivityPath = path.resolve(outputDir, 'GeneratedLiveActivity.swift');
      fs.writeFileSync(liveActivityPath, liveActivitySwift, 'utf8');
      console.log('✅ Generated:', liveActivityPath);

      // Auto-copy to Widget Extension target if configured
      if (config.widgetExtensionTarget) {
        const iosDir = path.resolve(outputDir, '..');
        const widgetDir = path.resolve(iosDir, config.widgetExtensionTarget);
        if (fs.existsSync(widgetDir)) {
          const widgetPath = path.resolve(widgetDir, 'GeneratedLiveActivity.swift');
          fs.writeFileSync(widgetPath, liveActivitySwift, 'utf8');
          console.log('✅ Also copied to Widget Extension:', widgetPath);
        } else {
          console.warn(`⚠️  Widget Extension directory not found: ${widgetDir}`);
          console.warn(`   Create it first, then re-run the generator.`);
        }
      }

      // Collect button intents to inform user about dual-target setup
      const hasButtons = (config.liveActivities ?? []).some((def) => {
        const checkNode = (node: any): boolean => {
          if (node.type === 'button' && node.shortcutIdentifier) return true;
          if (node.children) return node.children.some(checkNode);
          return false;
        };
        if (checkNode(def.lockScreenLayout)) return true;
        if (def.dynamicIslandCompact) {
          if (checkNode(def.dynamicIslandCompact.leading)) return true;
          if (checkNode(def.dynamicIslandCompact.trailing)) return true;
        }
        if (def.dynamicIslandExpanded) {
          for (const region of ['leading', 'trailing', 'center', 'bottom'] as const) {
            const node = def.dynamicIslandExpanded[region];
            if (node && checkNode(node)) return true;
          }
        }
        return false;
      });

      const generateBundle = config.liveActivityWidgetBundle !== false;

      console.log('');
      console.log('📝 Live Activity Widget Extension setup:');
      if (generateBundle) {
        console.log('   1. Add a Widget Extension target in Xcode (File → New → Target → Widget Extension)');
        if (config.widgetExtensionTarget) {
          console.log('   2. GeneratedLiveActivity.swift has been auto-copied to your Widget Extension target');
        } else {
          console.log('   2. Copy GeneratedLiveActivity.swift to your Widget Extension target directory');
          console.log('      💡 Set widgetExtensionTarget in your config to automate this step');
        }
        console.log('   3. Add App Group entitlement matching main app');
        console.log('   4. Add NSSupportsLiveActivities = YES to Info.plist');
        if (hasButtons) {
          console.log('');
          console.log('   🎛️ Interactive buttons detected:');
          console.log('      GeneratedAppIntents.swift includes LA_* LiveActivityIntent stubs (main app target)');
          console.log('      GeneratedLiveActivity.swift includes matching stubs (Widget Extension target)');
        }
        console.log('');
        console.log('   💡 Already have a Widget Extension? Set liveActivityWidgetBundle: false');
        console.log('      in your config and add LiveActivityWidget to your existing WidgetBundle.');
      } else {
        console.log('   ⚠️  liveActivityWidgetBundle: false — no @main WidgetBundle generated.');
        console.log('   Add LiveActivityWidget to your existing WidgetBundle:');
        console.log('');
        console.log('   // @main struct YourWidgetBundle: WidgetBundle {');
        console.log('   //     var body: some Widget {');
        console.log('   //         LiveActivityWidget()');
        console.log('   //     }');
        console.log('   // }');
        console.log('');
        if (config.widgetExtensionTarget) {
          console.log('   1. GeneratedLiveActivity.swift has been auto-copied to your Widget Extension target');
        } else {
          console.log('   1. Copy GeneratedLiveActivity.swift to your Widget Extension target directory');
          console.log('      💡 Set widgetExtensionTarget in your config to automate this step');
        }
        console.log('   2. Add LiveActivityWidget to your existing WidgetBundle');
        console.log('   3. Add NSSupportsLiveActivities = YES to Info.plist');
        if (hasButtons) {
          console.log('');
          console.log('   🎛️ Interactive buttons detected:');
          console.log('      GeneratedAppIntents.swift includes LA_* LiveActivityIntent stubs (main app target)');
          console.log('      GeneratedLiveActivity.swift includes matching stubs (Widget Extension target)');
        }
      }
    }

    console.log('');
    console.log('📝 Shortcuts generated:');
    config.shortcuts.forEach((s) => {
      console.log(`   - ${s.identifier}: "${s.title}"`);
      console.log(`     Phrases: ${s.phrases.join(', ')}`);
    });
    console.log('');

    if (!isLibrary) {
      console.log('📝 Next steps:');
      console.log(
        '   1. Add GeneratedAppIntents.swift to your Xcode project (if not already added)'
      );
      if (useLocalization) {
        console.log(
          '   2. Add Localizable.xcstrings to your Xcode project for translations'
        );
        console.log('   3. Add AppShortcuts.strings for phrase translations');
        console.log(
          '   4. Enable App Groups capability: group.<your-bundle-id>'
        );
        console.log('   5. Rebuild your app');
      } else {
        console.log(
          '   2. Enable App Groups capability: group.<your-bundle-id>'
        );
        console.log('   3. Rebuild your app');
      }
      console.log('');
    }

    console.log('✅ Done!');
  } catch (error) {
    console.error('❌ Error:', (error as Error).message);
    console.error((error as Error).stack);
    process.exit(1);
  }
}

main();
