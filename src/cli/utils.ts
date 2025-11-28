/**
 * CLI utility functions for generate-shortcuts
 */

import type { ShortcutsConfig } from '../types';

/**
 * Converts a string to PascalCase
 */
export function pascalCase(str: string): string {
  return str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (_, c) => c.toUpperCase());
}

/**
 * Escapes a string for use in Swift string literals
 */
export function escapeForSwift(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Extracts variable names from a message template
 * e.g., "Hello ${name}" -> ["name"]
 */
export function extractVariables(message: string): string[] {
  const regex = /\$\{(\w+)\}/g;
  const variables: string[] = [];
  let match;
  while ((match = regex.exec(message)) !== null) {
    if (match[1]) {
      variables.push(match[1]);
    }
  }
  return variables;
}

/**
 * Generates Swift condition for checking state value
 */
export function generateSwiftCondition(
  stateKey: string,
  showWhen: boolean | string | number
): string {
  if (typeof showWhen === 'boolean') {
    return `defaults.double(forKey: "${stateKey}") == ${showWhen ? 1 : 0}`;
  }
  if (typeof showWhen === 'number') {
    return `defaults.double(forKey: "${stateKey}") == ${showWhen}`;
  }
  if (typeof showWhen === 'string') {
    return `defaults.string(forKey: "${stateKey}") == "${showWhen}"`;
  }
  return `defaults.string(forKey: "${stateKey}") != nil`;
}

/**
 * Extracts all localizable strings from the config
 */
export function extractLocalizableStrings(
  config: ShortcutsConfig
): Record<string, string> {
  const strings: Record<string, string> = {};

  config.shortcuts.forEach((shortcut) => {
    const id = shortcut.identifier;
    strings[`${id}.title`] = shortcut.title;

    if (shortcut.description) {
      strings[`${id}.description`] = shortcut.description;
    }

    if (shortcut.parameters) {
      shortcut.parameters.forEach((param, index) => {
        strings[`${id}.parameters.${index}.title`] = param.title;
        if (param.description) {
          strings[`${id}.parameters.${index}.description`] = param.description;
        }
        // Add prompt for requestValue()
        const defaultPrompt = `What ${param.title.toLowerCase()}?`;
        strings[`${id}.parameters.${index}.prompt`] = defaultPrompt;
      });
    }

    if (shortcut.stateDialogs) {
      shortcut.stateDialogs.forEach((dialog, index) => {
        strings[`${id}.stateDialogs.${index}.message`] = dialog.message;
      });
    }
  });

  strings['system.error.appGroupFailed'] = 'Failed to communicate with app';
  strings['system.timeout'] = 'Done';

  return strings;
}

/**
 * Extracts all App Shortcuts phrases for AppShortcuts.strings
 */
export function extractAppShortcutsPhrases(config: ShortcutsConfig): string[] {
  const phrases: string[] = [];

  config.shortcuts.forEach((shortcut) => {
    shortcut.phrases.forEach((phrase) => {
      const phraseKey = phrase.includes('applicationName')
        ? phrase.replace(/\\?\(\.applicationName\)/g, '${applicationName}')
        : `${phrase} in \${applicationName}`;
      phrases.push(phraseKey);
    });
  });

  return phrases;
}

/**
 * Generates AppShortcuts.strings file content
 */
export function generateAppShortcutsStrings(phrases: string[]): string {
  return phrases.map((phrase) => `"${phrase}" = "${phrase}";`).join('\n');
}

/**
 * Generates iOS String Catalog (.xcstrings) file content
 */
export function generateStringCatalog(strings: Record<string, string>): string {
  const catalog = {
    sourceLanguage: 'en',
    strings: {} as Record<string, any>,
    version: '1.0',
  };

  Object.entries(strings).forEach(([key, value]) => {
    catalog.strings[key] = {
      extractionState: 'manual',
      localizations: {
        en: {
          stringUnit: {
            state: 'translated',
            value: value,
          },
        },
      },
    };
  });

  return JSON.stringify(catalog, null, 2);
}

/**
 * Merges new localization strings with existing String Catalog
 *
 * This function preserves existing translations while updating the structure:
 * - New keys are added with default English localization
 * - Existing keys preserve all user translations
 * - English default values are updated to match current config
 * - Keys no longer in config are preserved (not removed)
 *
 * @param newStrings - New localization strings from shortcuts config
 * @param existingCatalogContent - Content of existing Localizable.xcstrings file (if it exists)
 * @returns Merged String Catalog content as JSON string
 */
export function mergeStringCatalog(
  newStrings: Record<string, string>,
  existingCatalogContent: string | null
): string {
  // Start with base catalog structure
  const catalog = {
    sourceLanguage: 'en',
    strings: {} as Record<string, any>,
    version: '1.0',
  };

  // If existing catalog exists, parse and use as base
  if (existingCatalogContent) {
    try {
      const existingCatalog = JSON.parse(existingCatalogContent);
      if (existingCatalog.strings) {
        // Copy all existing strings (preserves old keys and translations)
        catalog.strings = { ...existingCatalog.strings };
      }
      // Preserve source language and version if specified
      if (existingCatalog.sourceLanguage) {
        catalog.sourceLanguage = existingCatalog.sourceLanguage;
      }
      if (existingCatalog.version) {
        catalog.version = existingCatalog.version;
      }
    } catch (error) {
      // If parsing fails, start fresh (logged by caller)
      console.warn('⚠️  Failed to parse existing String Catalog, creating new one');
    }
  }

  // Add or update keys from new strings
  Object.entries(newStrings).forEach(([key, value]) => {
    if (catalog.strings[key]) {
      // Key exists - preserve all localizations, just update English default
      if (!catalog.strings[key].localizations) {
        catalog.strings[key].localizations = {};
      }
      catalog.strings[key].localizations.en = {
        stringUnit: {
          state: 'translated',
          value: value,
        },
      };
    } else {
      // New key - create with English localization only
      catalog.strings[key] = {
        extractionState: 'manual',
        localizations: {
          en: {
            stringUnit: {
              state: 'translated',
              value: value,
            },
          },
        },
      };
    }
  });

  return JSON.stringify(catalog, null, 2);
}

/**
 * Merges new phrase localizations with existing AppShortcuts.strings
 *
 * Preserves existing phrases that may have been manually translated,
 * while adding new phrases from the config.
 *
 * @param newPhrases - New phrase list from shortcuts config
 * @param existingContent - Content of existing AppShortcuts.strings file (if it exists)
 * @returns Merged .strings file content
 */
export function mergeAppShortcutsStrings(
  newPhrases: string[],
  existingContent: string | null
): string {
  const phrases = new Set<string>();

  // Add existing phrases first (to preserve any manual translations)
  if (existingContent) {
    // Parse .strings format: "phrase" = "translation";
    // Regex needs to handle escaped quotes: \"
    const lines = existingContent.split('\n');
    lines.forEach((line) => {
      // Match: "key" = "value"; where key and value can contain escaped quotes
      const match = line.match(/^"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)";/);
      if (match) {
        // Preserve the line as-is (including translation if different from key)
        phrases.add(line);
      }
    });
  }

  // Add new phrases (default: phrase = phrase)
  newPhrases.forEach((phrase) => {
    const entry = `"${phrase}" = "${phrase}";`;
    // Only add if not already present
    if (![...phrases].some((p) => p.startsWith(`"${phrase}"`))) {
      phrases.add(entry);
    }
  });

  return Array.from(phrases).join('\n');
}

/**
 * Generates TypeScript type definitions for shortcuts
 * Creates discriminated union types for type-safe parameter access
 *
 * @param config - The shortcuts configuration
 * @returns TypeScript type definition file content
 *
 * @example
 * // For a config with addTask(taskName: string) and startTimer()
 * // Generates:
 * // export type ShortcutInvocation =
 * //   | { identifier: 'addTask'; parameters: { taskName: string }; ... }
 * //   | { identifier: 'startTimer'; parameters?: never; ... }
 */
export function generateTypeScriptTypes(config: ShortcutsConfig): string {
  const imports = `// AUTO-GENERATED - DO NOT EDIT
// Generated from shortcuts.config.ts
// Run 'npx react-native-ios-intents generate' to regenerate

// This file augments react-native-ios-intents types with your shortcuts
// No manual import needed - types are automatically applied!

`;

  // Generate individual shortcut invocation types
  const shortcutTypes = config.shortcuts.map((shortcut) => {
    const hasParameters = shortcut.parameters && shortcut.parameters.length > 0;

    if (hasParameters) {
      // Generate parameters object type
      const paramFields = shortcut.parameters!
        .map((param) => {
          const tsType = mapParameterTypeToTS(param.type);
          const optional = param.optional !== false ? '?' : '';
          return `    ${param.name}${optional}: ${tsType};`;
        })
        .join('\n');

      return `  | {
      identifier: '${shortcut.identifier}';
      nonce: string;
      parameters: {
${paramFields}
      };
      userConfirmed?: boolean;
    }`;
    } else {
      // No parameters
      return `  | {
      identifier: '${shortcut.identifier}';
      nonce: string;
      parameters?: never;
      userConfirmed?: boolean;
    }`;
    }
  });

  // Generate standalone types that can be directly imported
  const typeDefinition = `/**
 * Type-safe shortcut invocation
 * Provides autocomplete and type checking for shortcut identifiers and parameters
 *
 * Usage in your code:
 * import type { ShortcutInvocation } from './shortcuts.generated';
 *
 * Or use the type assertion:
 * const shortcut = data as ShortcutInvocation;
 */
export type ShortcutInvocation =
${shortcutTypes.join('\n')};

/**
 * Callback function for responding to Siri
 */
export type RespondCallback = (response?: { message?: string }) => void;

/**
 * Listener function for shortcut events
 * Receives typed shortcut data with autocomplete
 */
export type ShortcutListener = (
  shortcut: ShortcutInvocation,
  respond: RespondCallback
) => void | Promise<void>;
`;

  return imports + typeDefinition;
}

/**
 * Maps parameter type to TypeScript type
 */
function mapParameterTypeToTS(
  type: 'string' | 'number' | 'boolean' | 'date'
): string {
  switch (type) {
    case 'string':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'date':
      return 'Date';
  }
}
