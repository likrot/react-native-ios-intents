import * as fs from 'fs';
import * as path from 'path';
import {
  pascalCase,
  escapeForSwift,
  extractVariables,
  generateSwiftCondition,
  extractLocalizableStrings,
  extractAppShortcutsPhrases,
  generateAppShortcutsStrings,
  generateStringCatalog,
  mergeStringCatalog,
  mergeAppShortcutsStrings,
} from '../utils';
import type { ShortcutsConfig } from '../../types';
import { mockShortcutsConfig } from './__fixtures__/shortcuts.config.mock';

// Helper to load fixture files
const loadFixture = (filename: string): string => {
  return fs.readFileSync(
    path.join(__dirname, '__fixtures__', filename),
    'utf8'
  );
};

describe('CLI Utils', () => {
  describe('pascalCase', () => {
    it.each([
      ['startTimer', 'StartTimer'],
      ['start-timer', 'StartTimer'],
      ['start_timer', 'StartTimer'],
      ['start timer', 'StartTimer'],
      ['start-timer_action test', 'StartTimerActionTest'],
      ['StartTimer', 'StartTimer'],
      ['timer', 'Timer'],
      ['', ''],
      ['start--timer', 'StartTimer'],
    ])('should convert "%s" to "%s"', (input, expected) => {
      expect(pascalCase(input)).toBe(expected);
    });
  });

  describe('escapeForSwift', () => {
    it.each([
      ['path\\to\\file', 'path\\\\to\\\\file', 'backslashes'],
      ['say "hello"', 'say \\"hello\\"', 'double quotes'],
      ['line1\nline2', 'line1\\nline2', 'newlines'],
      ['line1\rline2', 'line1\\rline2', 'carriage returns'],
      ['col1\tcol2', 'col1\\tcol2', 'tabs'],
      ['say "hello"\nworld', 'say \\"hello\\"\\nworld', 'multiple sequences'],
      ['Hello World!', 'Hello World!', 'regular characters'],
      ['', '', 'empty string'],
    ])('should escape %s correctly', (input, expected) => {
      expect(escapeForSwift(input)).toBe(expected);
    });
  });

  describe('extractVariables', () => {
    it.each([
      ['Hello ${name}', ['name']],
      ['${greeting} ${name}, you have ${count} messages', ['greeting', 'name', 'count']],
      ['Hello World', []],
      ['${start} middle ${end}', ['start', 'end']],
      ['${first}${second}', ['first', 'second']],
      ['$name ${valid} {invalid}', ['valid']],
      ['', []],
      ['${task_name} is ${elapsed_time}', ['task_name', 'elapsed_time']],
      ['${value1} and ${value2}', ['value1', 'value2']],
    ])('should extract variables from "%s"', (input, expected) => {
      expect(extractVariables(input)).toEqual(expected);
    });
  });

  describe('generateSwiftCondition', () => {
    it.each([
      ['appState_running', true, 'defaults.double(forKey: "appState_running") == 1'],
      ['appState_running', false, 'defaults.double(forKey: "appState_running") == 0'],
      ['appState_count', 42, 'defaults.double(forKey: "appState_count") == 42'],
      ['appState_count', 0, 'defaults.double(forKey: "appState_count") == 0'],
      ['appState_temp', -10, 'defaults.double(forKey: "appState_temp") == -10'],
      ['appState_ratio', 3.14, 'defaults.double(forKey: "appState_ratio") == 3.14'],
      ['appState_status', 'active', 'defaults.string(forKey: "appState_status") == "active"'],
      ['appState_status', '', 'defaults.string(forKey: "appState_status") == ""'],
    ])('should generate condition for %s = %s', (key, value, expected) => {
      expect(generateSwiftCondition(key, value)).toBe(expected);
    });
  });

  describe('extractLocalizableStrings', () => {
    it('should extract titles, descriptions, and state dialog messages', () => {
      const config: ShortcutsConfig = {
        shortcuts: [
          {
            identifier: 'test',
            title: 'Test Title',
            phrases: [],
            description: 'Test Description',
            stateDialogs: [
              { stateKey: 'running', showWhen: true, message: 'Dialog message' },
            ],
          },
        ],
      };
      const result = extractLocalizableStrings(config);

      expect(result['test.title']).toBe('Test Title');
      expect(result['test.description']).toBe('Test Description');
      expect(result['test.stateDialogs.0.message']).toBe('Dialog message');
      expect(result['system.error.appGroupFailed']).toBe('Failed to communicate with app');
      expect(result['system.timeout']).toBe('Done');
    });

    it('should handle multiple shortcuts', () => {
      const config: ShortcutsConfig = {
        shortcuts: [
          { identifier: 'start', title: 'Start', phrases: [] },
          { identifier: 'stop', title: 'Stop', phrases: [] },
        ],
      };
      const result = extractLocalizableStrings(config);
      expect(result['start.title']).toBe('Start');
      expect(result['stop.title']).toBe('Stop');
    });
  });

  describe('extractAppShortcutsPhrases', () => {
    it.each([
      [['Start timer'], ['Start timer in ${applicationName}']],
      [['Start', 'Begin'], ['Start in ${applicationName}', 'Begin in ${applicationName}']],
      [[], []],
    ])('should convert phrases %j to %j', (input, expected) => {
      const config: ShortcutsConfig = {
        shortcuts: [{ identifier: 'test', title: 'Test', phrases: input }],
      };
      expect(extractAppShortcutsPhrases(config)).toEqual(expected);
    });
  });

  describe('generateAppShortcutsStrings', () => {
    it.each([
      [['Start in ${applicationName}'], '"Start in ${applicationName}" = "Start in ${applicationName}";'],
      [[], ''],
    ])('should generate .strings from %j', (phrases, expected) => {
      expect(generateAppShortcutsStrings(phrases)).toBe(expected);
    });

    it('should join multiple phrases with newlines', () => {
      const phrases = ['Start in ${applicationName}', 'Stop in ${applicationName}'];
      const result = generateAppShortcutsStrings(phrases);
      expect(result.split('\n')).toHaveLength(2);
    });
  });

  describe('generateStringCatalog', () => {
    it('should generate valid xcstrings JSON structure', () => {
      const strings = { 'test.title': 'Test Title' };
      const result = generateStringCatalog(strings);
      const parsed = JSON.parse(result);

      expect(parsed.sourceLanguage).toBe('en');
      expect(parsed.version).toBe('1.0');
      expect(parsed.strings['test.title'].extractionState).toBe('manual');
      expect(parsed.strings['test.title'].localizations.en.stringUnit.state).toBe('translated');
      expect(parsed.strings['test.title'].localizations.en.stringUnit.value).toBe('Test Title');
    });

    it('should handle empty strings object', () => {
      const parsed = JSON.parse(generateStringCatalog({}));
      expect(parsed.strings).toEqual({});
    });
  });

  describe('mergeStringCatalog', () => {
    it('should create new catalog when no existing catalog provided', () => {
      const newStrings = { 'test.title': 'Test Title' };
      const result = mergeStringCatalog(newStrings, null);
      const parsed = JSON.parse(result);

      expect(parsed.sourceLanguage).toBe('en');
      expect(parsed.version).toBe('1.0');
      expect(parsed.strings['test.title'].localizations.en.stringUnit.value).toBe('Test Title');
    });

    it('should preserve existing translations when updating English default', () => {
      const existing = JSON.stringify({
        sourceLanguage: 'en',
        version: '1.0',
        strings: {
          'test.title': {
            extractionState: 'manual',
            localizations: {
              en: { stringUnit: { state: 'translated', value: 'Old Title' } },
              es: { stringUnit: { state: 'translated', value: 'Título de Prueba' } },
              fr: { stringUnit: { state: 'translated', value: 'Titre de Test' } },
            },
          },
        },
      });

      const newStrings = { 'test.title': 'New Title' };
      const result = mergeStringCatalog(newStrings, existing);
      const parsed = JSON.parse(result);

      // English value should be updated
      expect(parsed.strings['test.title'].localizations.en.stringUnit.value).toBe('New Title');
      // Other languages should be preserved
      expect(parsed.strings['test.title'].localizations.es.stringUnit.value).toBe('Título de Prueba');
      expect(parsed.strings['test.title'].localizations.fr.stringUnit.value).toBe('Titre de Test');
    });

    it('should add new keys while preserving old ones', () => {
      const existing = JSON.stringify({
        sourceLanguage: 'en',
        version: '1.0',
        strings: {
          'old.key': {
            extractionState: 'manual',
            localizations: {
              en: { stringUnit: { state: 'translated', value: 'Old Key' } },
              es: { stringUnit: { state: 'translated', value: 'Clave Antigua' } },
            },
          },
        },
      });

      const newStrings = { 'new.key': 'New Key' };
      const result = mergeStringCatalog(newStrings, existing);
      const parsed = JSON.parse(result);

      // Old key should still exist with all translations
      expect(parsed.strings['old.key'].localizations.en.stringUnit.value).toBe('Old Key');
      expect(parsed.strings['old.key'].localizations.es.stringUnit.value).toBe('Clave Antigua');
      // New key should be added with only English
      expect(parsed.strings['new.key'].localizations.en.stringUnit.value).toBe('New Key');
      expect(parsed.strings['new.key'].localizations.es).toBeUndefined();
    });

    it('should handle both adding and updating keys in one merge', () => {
      const existing = JSON.stringify({
        sourceLanguage: 'en',
        version: '1.0',
        strings: {
          'existing.key': {
            extractionState: 'manual',
            localizations: {
              en: { stringUnit: { state: 'translated', value: 'Old Value' } },
              de: { stringUnit: { state: 'translated', value: 'Alter Wert' } },
            },
          },
        },
      });

      const newStrings = {
        'existing.key': 'Updated Value',
        'brand.new.key': 'Brand New',
      };
      const result = mergeStringCatalog(newStrings, existing);
      const parsed = JSON.parse(result);

      // Existing key updated, German preserved
      expect(parsed.strings['existing.key'].localizations.en.stringUnit.value).toBe('Updated Value');
      expect(parsed.strings['existing.key'].localizations.de.stringUnit.value).toBe('Alter Wert');
      // New key added
      expect(parsed.strings['brand.new.key'].localizations.en.stringUnit.value).toBe('Brand New');
    });

    it('should handle invalid JSON gracefully', () => {
      const invalidJson = 'this is not valid JSON';
      const newStrings = { 'test.key': 'Test Value' };

      // Should not throw, should create new catalog
      const result = mergeStringCatalog(newStrings, invalidJson);
      const parsed = JSON.parse(result);

      expect(parsed.strings['test.key']).toBeDefined();
      expect(parsed.strings['test.key'].localizations.en.stringUnit.value).toBe('Test Value');
    });

    it('should preserve sourceLanguage and version from existing catalog', () => {
      const existing = JSON.stringify({
        sourceLanguage: 'es',
        version: '2.0',
        strings: {},
      });

      const newStrings = { 'test.key': 'Test' };
      const result = mergeStringCatalog(newStrings, existing);
      const parsed = JSON.parse(result);

      expect(parsed.sourceLanguage).toBe('es');
      expect(parsed.version).toBe('2.0');
    });

    it('should handle empty new strings', () => {
      const existing = JSON.stringify({
        sourceLanguage: 'en',
        version: '1.0',
        strings: {
          'old.key': {
            extractionState: 'manual',
            localizations: {
              en: { stringUnit: { state: 'translated', value: 'Old' } },
            },
          },
        },
      });

      const result = mergeStringCatalog({}, existing);
      const parsed = JSON.parse(result);

      // Old key should still exist
      expect(parsed.strings['old.key']).toBeDefined();
    });

    it('should work with realistic fixture file', () => {
      const existingCatalog = loadFixture('existing-catalog.xcstrings');
      const newStrings = {
        'startTimer.title': 'Start Timer (Updated)',
        'newFeature.title': 'New Feature',
      };

      const result = mergeStringCatalog(newStrings, existingCatalog);
      const parsed = JSON.parse(result);

      // Updated key: English updated, other languages preserved
      expect(parsed.strings['startTimer.title'].localizations.en.stringUnit.value).toBe('Start Timer (Updated)');
      expect(parsed.strings['startTimer.title'].localizations.es.stringUnit.value).toBe('Iniciar Temporizador');
      expect(parsed.strings['startTimer.title'].localizations.fr.stringUnit.value).toBe('Démarrer le Minuteur');
      expect(parsed.strings['startTimer.title'].localizations.de.stringUnit.value).toBe('Timer Starten');

      // Old keys preserved
      expect(parsed.strings['stopTimer.title']).toBeDefined();
      expect(parsed.strings['system.timeout'].localizations.fr.stringUnit.value).toBe('Terminé');

      // New key added
      expect(parsed.strings['newFeature.title'].localizations.en.stringUnit.value).toBe('New Feature');
      expect(parsed.strings['newFeature.title'].localizations.es).toBeUndefined();
    });

    it('should handle invalid fixture gracefully', () => {
      const invalidCatalog = loadFixture('invalid-catalog.xcstrings');
      const newStrings = { 'test.key': 'Test' };

      // Should not throw
      const result = mergeStringCatalog(newStrings, invalidCatalog);
      const parsed = JSON.parse(result);

      expect(parsed.strings['test.key']).toBeDefined();
    });
  });

  describe('mergeAppShortcutsStrings', () => {
    it('should create new strings when no existing content provided', () => {
      const newPhrases = ['Start timer', 'Stop timer'];
      const result = mergeAppShortcutsStrings(newPhrases, null);

      expect(result).toContain('"Start timer" = "Start timer";');
      expect(result).toContain('"Stop timer" = "Stop timer";');
    });

    it('should preserve existing entries', () => {
      const existing = `"Start timer" = "Start timer";
"Stop timer" = "Stop timer";`;

      const newPhrases = ['Start timer', 'Pause timer'];
      const result = mergeAppShortcutsStrings(newPhrases, existing);

      // Existing entries should be preserved
      expect(result).toContain('"Start timer" = "Start timer";');
      expect(result).toContain('"Stop timer" = "Stop timer";');
      // New phrase should be added with default
      expect(result).toContain('"Pause timer" = "Pause timer";');
    });

    it('should preserve custom values if user modified base file', () => {
      const existing = `"Start timer" = "Begin the timer";
"Stop timer" = "End the timer";`;

      const newPhrases = ['Start timer', 'Pause timer'];
      const result = mergeAppShortcutsStrings(newPhrases, existing);

      // Custom values should be preserved (user may have customized base file)
      expect(result).toContain('"Start timer" = "Begin the timer";');
      expect(result).toContain('"Stop timer" = "End the timer";');
      // New phrase should be added with default
      expect(result).toContain('"Pause timer" = "Pause timer";');
    });

    it('should not duplicate phrases', () => {
      const existing = '"Start timer" = "Start timer";';
      const newPhrases = ['Start timer', 'Start timer']; // Duplicate in input

      const result = mergeAppShortcutsStrings(newPhrases, existing);
      const lines = result.split('\n').filter((l) => l.includes('Start timer'));

      // Should only appear once
      expect(lines).toHaveLength(1);
    });

    it('should handle empty existing content', () => {
      const newPhrases = ['Test phrase'];
      const result = mergeAppShortcutsStrings(newPhrases, '');

      expect(result).toContain('"Test phrase" = "Test phrase";');
    });

    it('should handle empty new phrases', () => {
      const existing = '"Old phrase" = "Old phrase";';
      const result = mergeAppShortcutsStrings([], existing);

      // Should preserve existing
      expect(result).toContain('"Old phrase" = "Old phrase";');
    });

    it('should handle malformed existing lines gracefully', () => {
      const existing = `"Valid phrase" = "Valid phrase";
This is not a valid line
"Another valid" = "Another valid";`;

      const newPhrases = ['New phrase'];
      const result = mergeAppShortcutsStrings(newPhrases, existing);

      // Should preserve valid lines and add new
      expect(result).toContain('"Valid phrase" = "Valid phrase";');
      expect(result).toContain('"Another valid" = "Another valid";');
      expect(result).toContain('"New phrase" = "New phrase";');
      // Malformed line should be ignored
      expect(result.split('\n').filter((l) => l === 'This is not a valid line')).toHaveLength(0);
    });

    it('should handle phrases with special characters', () => {
      const existing = `"Say \\"hello\\"" = "Say \\"hello\\"";`;
      const newPhrases = ['Say "hello"', 'Say "goodbye"'];

      const result = mergeAppShortcutsStrings(newPhrases, existing);

      // Should not be confused by escaped quotes
      expect(result).toContain('"Say \\"hello\\"" = "Say \\"hello\\"";');
    });

    it('should work with realistic fixture file', () => {
      const existingPhrases = loadFixture('existing-phrases.strings');
      const newPhrases = [
        'Start timer in ${applicationName}',
        'Reset timer in ${applicationName}', // New phrase
      ];

      const result = mergeAppShortcutsStrings(newPhrases, existingPhrases);

      // Existing entries preserved (base file has key = key format)
      expect(result).toContain('"Start timer in ${applicationName}" = "Start timer in ${applicationName}";');
      expect(result).toContain('"Stop timer in ${applicationName}" = "Stop timer in ${applicationName}";');
      expect(result).toContain('"Pause timer in ${applicationName}" = "Pause timer in ${applicationName}";');

      // Old phrase not in new list still preserved
      expect(result).toContain('"Resume timer in ${applicationName}"');

      // New phrase added with default
      expect(result).toContain('"Reset timer in ${applicationName}" = "Reset timer in ${applicationName}";');
    });
  });

  describe('extractLocalizableStrings with fixture', () => {
    it('should extract strings from realistic config', () => {
      const result = extractLocalizableStrings(mockShortcutsConfig);

      // Titles
      expect(result['startTimer.title']).toBe('Start Timer');
      expect(result['stopTimer.title']).toBe('Stop Timer');
      expect(result['pauseTimer.title']).toBe('Pause Timer');
      expect(result['checkStatus.title']).toBe('Check Timer Status');

      // Descriptions
      expect(result['startTimer.description']).toBe('Start a new timer session');
      expect(result['stopTimer.description']).toBe('Stop the current timer');
      expect(result['checkStatus.description']).toBe('Check current timer status with interpolation');

      // State dialog messages
      expect(result['startTimer.stateDialogs.0.message']).toBe('Timer is already running. Stop it first?');
      expect(result['stopTimer.stateDialogs.0.message']).toBe('No timer is running');
      expect(result['checkStatus.stateDialogs.0.message']).toBe('Timer ${taskName} has been running for ${elapsedTime}');

      // System messages
      expect(result['system.error.appGroupFailed']).toBe('Failed to communicate with app');
      expect(result['system.timeout']).toBe('Done');
    });
  });
});
