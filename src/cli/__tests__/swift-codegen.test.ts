import {
  generateMessageInterpolation,
  generateStateDialogSwift,
  generateIntentStruct,
  generateAppShortcut,
  generateSwiftFile,
} from '../swift-codegen';
import type { ShortcutsConfig, ShortcutDefinition } from '../../types';
import { mockShortcutsConfig, minimalConfig } from './__fixtures__/shortcuts.config.mock';

describe('Swift Code Generation', () => {
  describe('generateMessageInterpolation', () => {
    it('should return plain string when no variables', () => {
      const result = generateMessageInterpolation('Hello World', 'test.key', false);
      expect(result).toBe('"Hello World"');
    });

    it('should return localized string when no variables and localization enabled', () => {
      const result = generateMessageInterpolation('Hello World', 'test.key', true);
      expect(result).toBe('String(localized: "test.key", defaultValue: "Hello World")');
    });

    it('should generate interpolation code for single variable', () => {
      const result = generateMessageInterpolation('Hello ${name}', 'test.key', false);

      expect(result).toContain('var message = "Hello ${name}"');
      expect(result).toContain('if let value = defaults.string(forKey: "appState_name")');
      expect(result).toContain('message.replacingOccurrences(of: "${name}", with: value)');
    });

    it('should generate interpolation code for multiple variables', () => {
      const result = generateMessageInterpolation(
        'Timer ${taskName} has ${elapsed} seconds',
        'test.key',
        false
      );

      expect(result).toContain('appState_taskName');
      expect(result).toContain('appState_elapsed');
      expect(result).toContain('${taskName}');
      expect(result).toContain('${elapsed}');
    });

    it('should handle numeric values with NSNumber', () => {
      const result = generateMessageInterpolation('Count: ${count}', 'test.key', false);

      expect(result).toContain('if let numValue = defaults.object(forKey: "appState_count") as? NSNumber');
    });

    it('should use localized string as base when localization enabled', () => {
      const result = generateMessageInterpolation('Hello ${name}', 'test.key', true);

      expect(result).toContain('var message = String(localized: "test.key", defaultValue: "Hello ${name}")');
    });
  });

  describe('generateStateDialogSwift', () => {
    it('should generate confirmation dialog by default', () => {
      const result = generateStateDialogSwift({
        index: 0,
        className: 'TestIntent',
        dialog: {
          stateKey: 'running',
          showWhen: true,
          message: 'Are you sure?',
        },
        condition: 'defaults.double(forKey: "appState_running") == 1',
        localizationKey: 'test.dialog.0',
        useLocalization: false,
      });

      expect(result.isConfirmation).toBe(true);
      expect(result.code).toContain('try await requestConfirmation');
      expect(result.code).toContain('userConfirmedOverride = true');
      expect(result.code).toContain('Confirmation required');
    });

    it('should generate message-only dialog when requiresConfirmation is false', () => {
      const result = generateStateDialogSwift({
        index: 0,
        className: 'TestIntent',
        dialog: {
          stateKey: 'running',
          showWhen: true,
          message: 'Timer is running',
          requiresConfirmation: false,
        },
        condition: 'defaults.double(forKey: "appState_running") == 1',
        localizationKey: 'test.dialog.0',
        useLocalization: false,
      });

      expect(result.isConfirmation).toBe(false);
      expect(result.code).toContain('return .result(dialog:');
      expect(result.code).not.toContain('requestConfirmation');
      expect(result.code).toContain('Showing message (no confirmation)');
    });

    it('should use localized strings when enabled', () => {
      const result = generateStateDialogSwift({
        index: 0,
        className: 'TestIntent',
        dialog: {
          stateKey: 'running',
          showWhen: true,
          message: 'Confirm action',
        },
        condition: 'test condition',
        localizationKey: 'test.dialog.0',
        useLocalization: true,
      });

      expect(result.code).toContain('String(localized: "test.dialog.0"');
    });

    it('should include index and condition in generated code', () => {
      const result = generateStateDialogSwift({
        index: 2,
        className: 'TestIntent',
        dialog: {
          stateKey: 'status',
          showWhen: 'active',
          message: 'Test',
        },
        condition: 'custom.condition',
        localizationKey: 'test.dialog.2',
        useLocalization: false,
      });

      expect(result.code).toContain('State dialog #3'); // index + 1
      expect(result.code).toContain('if custom.condition');
    });
  });

  describe('generateIntentStruct', () => {
    const basicShortcut: ShortcutDefinition = {
      identifier: 'testAction',
      title: 'Test Action',
      phrases: ['test action'],
    };

    it('should generate basic AppIntent struct', () => {
      const result = generateIntentStruct(basicShortcut, false);

      expect(result).toContain('struct TestActionIntent: AppIntent');
      expect(result).toContain('static var title: LocalizedStringResource = "Test Action"');
      expect(result).toContain('func perform() async throws -> some IntentResult & ProvidesDialog');
      expect(result).toContain('@available(iOS 16.0, *)');
    });

    it('should generate parameter declarations when parameters provided', () => {
      const shortcutWithParams: ShortcutDefinition = {
        identifier: 'addTask',
        title: 'Add Task',
        phrases: ['add a task'],
        parameters: [
          {
            name: 'taskName',
            title: 'Task Name',
            type: 'string',
            optional: false,
          },
          {
            name: 'dueDate',
            title: 'Due Date',
            type: 'date',
            optional: true,
          },
          {
            name: 'priority',
            title: 'Priority',
            type: 'number',
            description: 'Task priority level',
          },
        ],
      };

      const result = generateIntentStruct(shortcutWithParams, true);

      // Check parameter declarations (with localization keys)
      expect(result).toContain('@Parameter(title: LocalizedStringResource("addTask.parameters.0.title", defaultValue: "Task Name"))');
      expect(result).toContain('var taskName: String?');
      expect(result).toContain('@Parameter(title: LocalizedStringResource("addTask.parameters.1.title", defaultValue: "Due Date"))');
      expect(result).toContain('var dueDate: Date?');
      expect(result).toContain('@Parameter(title: LocalizedStringResource("addTask.parameters.2.title", defaultValue: "Priority"), description: LocalizedStringResource("addTask.parameters.2.description", defaultValue: "Task priority level"))');
      expect(result).toContain('var priority: Double?');

      // Check parameter writes
      expect(result).toContain('Write parameter values to shared UserDefaults');
      expect(result).toContain('if let taskName = taskName');
      expect(result).toContain('defaults.set(taskName, forKey: "IosIntentsParam_taskName")');
      expect(result).toContain('if let dueDate = dueDate');
      expect(result).toContain('defaults.set(dueDate.timeIntervalSince1970, forKey: "IosIntentsParam_dueDate")');
      expect(result).toContain('if let priority = priority');
      expect(result).toContain('defaults.set(priority, forKey: "IosIntentsParam_priority")');
    });

    it('should generate localized parameter titles when localization enabled', () => {
      const shortcutWithParams: ShortcutDefinition = {
        identifier: 'sendMessage',
        title: 'Send Message',
        phrases: ['send message'],
        parameters: [
          {
            name: 'recipient',
            title: 'Recipient',
            type: 'string',
            description: 'Message recipient',
          },
        ],
      };

      const result = generateIntentStruct(shortcutWithParams, true);

      expect(result).toContain('@Parameter(title: LocalizedStringResource("sendMessage.parameters.0.title", defaultValue: "Recipient"), description: LocalizedStringResource("sendMessage.parameters.0.description", defaultValue: "Message recipient"))');
    });

    it('should handle all parameter types correctly', () => {
      const shortcutWithAllTypes: ShortcutDefinition = {
        identifier: 'testParams',
        title: 'Test Parameters',
        phrases: ['test params'],
        parameters: [
          { name: 'text', title: 'Text', type: 'string' },
          { name: 'count', title: 'Count', type: 'number' },
          { name: 'enabled', title: 'Enabled', type: 'boolean' },
          { name: 'when', title: 'When', type: 'date' },
        ],
      };

      const result = generateIntentStruct(shortcutWithAllTypes, false);

      // Check Swift types
      expect(result).toContain('var text: String?');
      expect(result).toContain('var count: Double?');
      expect(result).toContain('var enabled: Bool?');
      expect(result).toContain('var when: Date?');

      // Check writes
      expect(result).toContain('defaults.set(text, forKey: "IosIntentsParam_text")');
      expect(result).toContain('defaults.set(count, forKey: "IosIntentsParam_count")');
      expect(result).toContain('defaults.set(enabled, forKey: "IosIntentsParam_enabled")');
      expect(result).toContain('defaults.set(when.timeIntervalSince1970, forKey: "IosIntentsParam_when")');
    });

    it('should use localized title when enabled', () => {
      const result = generateIntentStruct(basicShortcut, true);

      expect(result).toContain('static var title: LocalizedStringResource = "testAction.title"');
    });

    it('should include description when provided', () => {
      const shortcutWithDesc: ShortcutDefinition = {
        ...basicShortcut,
        description: 'A test action',
      };
      const result = generateIntentStruct(shortcutWithDesc, false);

      expect(result).toContain('static var description = IntentDescription("A test action")');
    });

    it('should generate state dialog checks when provided', () => {
      const shortcutWithDialogs: ShortcutDefinition = {
        ...basicShortcut,
        stateDialogs: [
          {
            stateKey: 'running',
            showWhen: true,
            message: 'Timer is running',
          },
        ],
      };
      const result = generateIntentStruct(shortcutWithDialogs, false);

      expect(result).toContain('// Check app state for state-based dialogs');
      expect(result).toContain('appState_running');
    });

    it('should declare userConfirmedOverride when confirmation dialogs present', () => {
      const shortcutWithConfirmation: ShortcutDefinition = {
        ...basicShortcut,
        stateDialogs: [
          {
            stateKey: 'running',
            showWhen: true,
            message: 'Are you sure?',
            requiresConfirmation: true,
          },
        ],
      };
      const result = generateIntentStruct(shortcutWithConfirmation, false);

      expect(result).toContain('var userConfirmedOverride = false');
      expect(result).toContain('defaults.set(userConfirmedOverride, forKey: "IosIntentsUserConfirmed")');
    });

    it('should include Darwin notification code', () => {
      const result = generateIntentStruct(basicShortcut, false);

      expect(result).toContain('CFNotificationCenterPostNotification');
      expect(result).toContain('eu.eblank.likrot.iosintents.shortcut');
    });

    it('should include polling loop with timeout', () => {
      const result = generateIntentStruct(basicShortcut, false);

      expect(result).toContain('let timeout: TimeInterval = 5.0');
      expect(result).toContain('let pollInterval: TimeInterval = 0.1');
      expect(result).toContain('while Date().timeIntervalSince(startTime) < timeout');
      expect(result).toContain('Task.sleep(nanoseconds:');
    });

    it('should use nonce for response key', () => {
      const result = generateIntentStruct(basicShortcut, false);

      expect(result).toContain('let nonce = UUID().uuidString');
      expect(result).toContain('IosIntentsResponse_\\(nonce)');
    });
  });

  describe('generateAppShortcut', () => {
    const basicShortcut: ShortcutDefinition = {
      identifier: 'testAction',
      title: 'Test Action',
      phrases: ['test action', 'run test'],
    };

    it('should generate AppShortcut with phrases', () => {
      const result = generateAppShortcut(basicShortcut, false);

      expect(result).toContain('AppShortcut(');
      expect(result).toContain('intent: TestActionIntent()');
      expect(result).toContain('phrases: [');
      expect(result).toContain('"test action in \\(.applicationName)"');
      expect(result).toContain('"run test in \\(.applicationName)"');
    });

    it('should add applicationName to phrases without it', () => {
      const result = generateAppShortcut(basicShortcut, false);

      expect(result).toContain('in \\(.applicationName)');
    });

    it('should not duplicate applicationName if already present', () => {
      const shortcutWithApp: ShortcutDefinition = {
        ...basicShortcut,
        phrases: ['test in applicationName'],
      };
      const result = generateAppShortcut(shortcutWithApp, false);

      // Should not add second applicationName
      expect(result).toContain('"test in applicationName"');
      expect(result).not.toContain('applicationName in \\(.applicationName)');
    });

    it('should use localized shortTitle when enabled', () => {
      const result = generateAppShortcut(basicShortcut, true);

      expect(result).toContain('shortTitle: LocalizedStringResource("testAction.title"');
    });

    it('should use plain string shortTitle when localization disabled', () => {
      const result = generateAppShortcut(basicShortcut, false);

      expect(result).toContain('shortTitle: "Test Action"');
    });

    it('should include systemImageName', () => {
      const shortcutWithIcon: ShortcutDefinition = {
        ...basicShortcut,
        systemImageName: 'star.circle',
      };
      const result = generateAppShortcut(shortcutWithIcon, false);

      expect(result).toContain('systemImageName: "star.circle"');
    });

    it('should default to "app" icon when not specified', () => {
      const result = generateAppShortcut(basicShortcut, false);

      expect(result).toContain('systemImageName: "app"');
    });
  });

  describe('generateSwiftFile', () => {
    const config: ShortcutsConfig = {
      shortcuts: [
        {
          identifier: 'startTimer',
          title: 'Start Timer',
          phrases: ['start timer'],
        },
        {
          identifier: 'stopTimer',
          title: 'Stop Timer',
          phrases: ['stop timer'],
        },
      ],
    };

    it('should generate complete Swift file with header', () => {
      const result = generateSwiftFile(config, false);

      expect(result).toContain('// GeneratedAppIntents.swift');
      expect(result).toContain('// AUTO-GENERATED - DO NOT EDIT');
      expect(result).toContain('import Foundation');
      expect(result).toContain('import AppIntents');
    });

    it('should include all intents', () => {
      const result = generateSwiftFile(config, false);

      expect(result).toContain('struct StartTimerIntent: AppIntent');
      expect(result).toContain('struct StopTimerIntent: AppIntent');
    });

    it('should include AppShortcutsProvider', () => {
      const result = generateSwiftFile(config, false);

      expect(result).toContain('struct GeneratedAppShortcutsProvider: AppShortcutsProvider');
      expect(result).toContain('static var appShortcuts: [AppShortcut]');
      expect(result).toContain('StartTimerIntent()');
      expect(result).toContain('StopTimerIntent()');
    });

    it('should use custom appGroupId when provided', () => {
      const configWithGroup: ShortcutsConfig = {
        ...config,
        appGroupId: 'group.com.example.app',
      };
      const result = generateSwiftFile(configWithGroup, false);

      expect(result).toContain('private let APP_GROUP_ID = "group.com.example.app"');
    });

    it('should generate dynamic appGroupId when not provided', () => {
      const result = generateSwiftFile(config, false);

      expect(result).toContain('private var APP_GROUP_ID: String');
      expect(result).toContain('Bundle.main.bundleIdentifier');
      expect(result).toContain('return "group.\\(bundleId)"');
    });

    it('should be valid Swift code format', () => {
      const result = generateSwiftFile(config, false);

      // Should have proper imports
      expect(result).toContain('import Foundation');
      expect(result).toContain('import AppIntents');

      // Should have availability annotation
      expect(result).toContain('@available(iOS 16.0, *)');

      // Should have proper struct declarations
      const structMatches = result.match(/struct \w+:/g);
      expect(structMatches).not.toBeNull();
      expect(structMatches!.length).toBeGreaterThan(0);
    });

    it('should handle complex fixture config with all features', () => {
      const result = generateSwiftFile(mockShortcutsConfig, true);

      // Should include all shortcuts from mock config
      expect(result).toContain('struct StartTimerIntent: AppIntent');
      expect(result).toContain('struct StopTimerIntent: AppIntent');
      expect(result).toContain('struct PauseTimerIntent: AppIntent');
      expect(result).toContain('struct CheckStatusIntent: AppIntent');

      // Should include custom app group from config
      expect(result).toContain('private let APP_GROUP_ID = "group.com.example.timer"');

      // Should handle state dialogs
      expect(result).toContain('appState_timerRunning');

      // Should use localization (config has localization: true)
      expect(result).toContain('LocalizedStringResource("startTimer.title"');

      // Should include descriptions as localization keys (localization enabled)
      expect(result).toContain('IntentDescription("startTimer.description")');
      expect(result).toContain('IntentDescription("stopTimer.description")');
    });

    it('should handle minimal config correctly', () => {
      const result = generateSwiftFile(minimalConfig, false);

      // Should have basic structure
      expect(result).toContain('struct SimpleActionIntent: AppIntent');
      expect(result).toContain('static var title: LocalizedStringResource = "Simple Action"');

      // Should generate dynamic app group (no appGroupId in minimalConfig)
      expect(result).toContain('private var APP_GROUP_ID: String');
      expect(result).toContain('Bundle.main.bundleIdentifier');

      // Should not have state dialogs
      expect(result).not.toContain('Check app state for state-based dialogs');
    });

    it('should respect localization flag from fixture', () => {
      // mockShortcutsConfig has localization: true
      const withLocalization = generateSwiftFile(mockShortcutsConfig, true);
      expect(withLocalization).toContain('LocalizedStringResource("startTimer.title"');

      // minimalConfig has no localization flag (defaults to false)
      const withoutLocalization = generateSwiftFile(minimalConfig, false);
      expect(withoutLocalization).toContain('static var title: LocalizedStringResource = "Simple Action"');
      expect(withoutLocalization).not.toContain('LocalizedStringResource("simpleAction.title"');
    });

    it('should generate proper state dialog with variable interpolation', () => {
      const result = generateSwiftFile(mockShortcutsConfig, false);

      // checkStatus shortcut has state dialog with interpolation
      expect(result).toContain('struct CheckStatusIntent: AppIntent');
      expect(result).toContain('Check current timer status with interpolation');

      // Should have variable interpolation logic
      expect(result).toContain('${taskName}');
      expect(result).toContain('${elapsedTime}');
      expect(result).toContain('appState_taskName');
      expect(result).toContain('appState_elapsedTime');
    });
  });
});
