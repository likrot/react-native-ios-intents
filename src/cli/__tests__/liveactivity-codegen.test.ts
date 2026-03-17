import * as fs from 'fs';
import * as path from 'path';
import {
  generateLayoutSwiftUI,
  resolveInterpolation,
  generateActivityView,
  generateActivityWidget,
  generateWidgetBundle,
  generateLiveActivitySwiftFile,
  generateLiveActivityIntentsForApp,
} from '../liveactivity-codegen';
import type { LiveActivityDefinition, LayoutNode, LiveActivityFieldDef } from '../../liveactivity-types';
import type { IntentsConfig } from '../../types';

// Helper: create a minimal Live Activity definition
function createTimerDef(
  overrides?: Partial<LiveActivityDefinition>
): LiveActivityDefinition {
  return {
    identifier: 'timerActivity',
    attributes: {
      taskName: { type: 'string', title: 'Task Name' },
    },
    contentState: {
      elapsedSeconds: { type: 'number', title: 'Elapsed Seconds' },
      isRunning: { type: 'boolean', title: 'Running' },
    },
    lockScreenLayout: {
      type: 'hstack',
      children: [
        { type: 'text', value: '${taskName}', font: 'headline' },
        { type: 'spacer' },
        {
          type: 'text',
          value: '${elapsedSeconds}',
          font: 'title',
          monospacedDigit: true,
        },
      ],
    },
    ...overrides,
  };
}

describe('Live Activity Code Generation', () => {
  describe('resolveInterpolation', () => {
    const attrFields: Record<string, LiveActivityFieldDef> = {
      taskName: { type: 'string' },
    };
    const stateFields: Record<string, LiveActivityFieldDef> = {
      elapsedSeconds: { type: 'number' },
      isRunning: { type: 'boolean' },
    };

    it('should return plain string for no interpolation', () => {
      const result = resolveInterpolation('Hello World', attrFields, stateFields);
      expect(result).toBe('"Hello World"');
    });

    it('should resolve attribute fields with dictionary access', () => {
      const result = resolveInterpolation(
        'Task: ${taskName}',
        attrFields,
        stateFields
      );
      expect(result).toContain('context.attributes.data["taskName"]?.stringValue');
    });

    it('should resolve contentState fields with dictionary access', () => {
      const result = resolveInterpolation(
        'Time: ${elapsedSeconds}s',
        attrFields,
        stateFields
      );
      expect(result).toContain('context.state.data["elapsedSeconds"]?.doubleValue');
    });

    it('should handle single field reference (contentState)', () => {
      const result = resolveInterpolation(
        '${elapsedSeconds}',
        attrFields,
        stateFields
      );
      expect(result).toContain('context.state.data["elapsedSeconds"]?.doubleValue');
    });

    it('should handle single field reference (attribute)', () => {
      const result = resolveInterpolation(
        '${taskName}',
        attrFields,
        stateFields
      );
      expect(result).toContain('context.attributes.data["taskName"]?.stringValue');
    });

    it('should leave unknown fields as literals', () => {
      const result = resolveInterpolation(
        'Value: ${unknownField}',
        attrFields,
        stateFields
      );
      expect(result).toContain('${unknownField}');
    });

    it('should handle multiple interpolations in one string', () => {
      const result = resolveInterpolation(
        '${taskName}: ${elapsedSeconds}s',
        attrFields,
        stateFields
      );
      expect(result).toContain('context.attributes.data["taskName"]');
      expect(result).toContain('context.state.data["elapsedSeconds"]');
    });

    it('should escape special characters', () => {
      const result = resolveInterpolation('Line 1\nLine 2', attrFields, stateFields);
      expect(result).toContain('\\n');
    });

    it('should use correct accessor for boolean fields', () => {
      const result = resolveInterpolation(
        '${isRunning}',
        attrFields,
        stateFields
      );
      expect(result).toContain('context.state.data["isRunning"]?.boolValue');
    });

    it('should use correct default values per type', () => {
      const result = resolveInterpolation(
        '${taskName} ${elapsedSeconds} ${isRunning}',
        attrFields,
        stateFields
      );
      expect(result).toContain('?? ""');
      expect(result).toContain('?? 0');
      expect(result).toContain('?? false');
    });
  });

  describe('generateLayoutSwiftUI', () => {
    const attrFields: Record<string, LiveActivityFieldDef> = {
      taskName: { type: 'string' },
    };
    const stateFields: Record<string, LiveActivityFieldDef> = {
      elapsedSeconds: { type: 'number' },
      progress: { type: 'number' },
    };

    it('should generate Spacer()', () => {
      const node: LayoutNode = { type: 'spacer' };
      const result = generateLayoutSwiftUI(node, attrFields, stateFields);
      expect(result).toContain('Spacer()');
    });

    it('should generate Text with value', () => {
      const node: LayoutNode = { type: 'text', value: 'Hello' };
      const result = generateLayoutSwiftUI(node, attrFields, stateFields);
      expect(result).toContain('Text("Hello")');
    });

    it('should generate Text with font modifier', () => {
      const node: LayoutNode = { type: 'text', value: 'Hi', font: 'headline' };
      const result = generateLayoutSwiftUI(node, attrFields, stateFields);
      expect(result).toContain('.font(.headline)');
    });

    it('should generate Text with color modifier', () => {
      const node: LayoutNode = {
        type: 'text',
        value: 'Hi',
        color: 'secondary',
      };
      const result = generateLayoutSwiftUI(node, attrFields, stateFields);
      expect(result).toContain('.foregroundColor(.secondary)');
    });

    it('should generate Text with monospacedDigit', () => {
      const node: LayoutNode = {
        type: 'text',
        value: '42',
        monospacedDigit: true,
      };
      const result = generateLayoutSwiftUI(node, attrFields, stateFields);
      expect(result).toContain('.monospacedDigit()');
    });

    it('should generate Text with dictionary-based interpolation', () => {
      const node: LayoutNode = { type: 'text', value: '${taskName}' };
      const result = generateLayoutSwiftUI(node, attrFields, stateFields);
      expect(result).toContain('context.attributes.data["taskName"]?.stringValue');
    });

    it('should generate Image with systemName', () => {
      const node: LayoutNode = {
        type: 'image',
        systemImage: 'play.circle',
      };
      const result = generateLayoutSwiftUI(node, attrFields, stateFields);
      expect(result).toContain('Image(systemName: "play.circle")');
    });

    it('should generate Image with color', () => {
      const node: LayoutNode = {
        type: 'image',
        systemImage: 'star',
        color: 'orange',
      };
      const result = generateLayoutSwiftUI(node, attrFields, stateFields);
      expect(result).toContain('.foregroundColor(.orange)');
    });

    it('should generate ProgressView with dictionary access', () => {
      const node: LayoutNode = {
        type: 'progress',
        progressField: 'progress',
      };
      const result = generateLayoutSwiftUI(node, attrFields, stateFields);
      expect(result).toContain('ProgressView(value: context.state.data["progress"]?.doubleValue ?? 0)');
    });

    it('should generate comment for invalid progress field', () => {
      const node: LayoutNode = {
        type: 'progress',
        progressField: 'nonExistent',
      };
      const result = generateLayoutSwiftUI(node, attrFields, stateFields);
      expect(result).toContain('// Progress: missing or invalid field');
    });

    it('should generate HStack with children', () => {
      const node: LayoutNode = {
        type: 'hstack',
        children: [
          { type: 'text', value: 'A' },
          { type: 'spacer' },
          { type: 'text', value: 'B' },
        ],
      };
      const result = generateLayoutSwiftUI(node, attrFields, stateFields);
      expect(result).toContain('HStack {');
      expect(result).toContain('Text("A")');
      expect(result).toContain('Spacer()');
      expect(result).toContain('Text("B")');
    });

    it('should generate VStack with alignment', () => {
      const node: LayoutNode = {
        type: 'vstack',
        alignment: 'leading',
        children: [{ type: 'text', value: 'Hello' }],
      };
      const result = generateLayoutSwiftUI(node, attrFields, stateFields);
      expect(result).toContain('VStack(alignment: .leading)');
    });

    it('should generate ZStack', () => {
      const node: LayoutNode = {
        type: 'zstack',
        children: [{ type: 'text', value: 'Overlay' }],
      };
      const result = generateLayoutSwiftUI(node, attrFields, stateFields);
      expect(result).toContain('ZStack {');
    });

    it('should handle spacing parameter', () => {
      const node: LayoutNode = {
        type: 'vstack',
        spacing: 8,
        children: [{ type: 'text', value: 'A' }],
      };
      const result = generateLayoutSwiftUI(node, attrFields, stateFields);
      expect(result).toContain('VStack(spacing: 8)');
    });

    it('should handle alignment and spacing together', () => {
      const node: LayoutNode = {
        type: 'hstack',
        alignment: 'center',
        spacing: 12,
        children: [{ type: 'text', value: 'X' }],
      };
      const result = generateLayoutSwiftUI(node, attrFields, stateFields);
      expect(result).toContain('HStack(alignment: .center, spacing: 12)');
    });

    it('should handle nested stacks', () => {
      const node: LayoutNode = {
        type: 'hstack',
        children: [
          {
            type: 'vstack',
            children: [
              { type: 'text', value: 'Inner' },
            ],
          },
        ],
      };
      const result = generateLayoutSwiftUI(node, attrFields, stateFields);
      expect(result).toContain('HStack {');
      expect(result).toContain('VStack {');
      expect(result).toContain('Text("Inner")');
    });

    it('should handle empty children', () => {
      const node: LayoutNode = { type: 'hstack', children: [] };
      const result = generateLayoutSwiftUI(node, attrFields, stateFields);
      expect(result).toContain('HStack {');
      expect(result).toContain('}');
    });

    // Timer node tests
    it('should generate Text(timerInterval:) with dictionary access', () => {
      const timerStateFields: Record<string, LiveActivityFieldDef> = {
        timerStart: { type: 'date' },
        progress: { type: 'number' },
      };
      const node: LayoutNode = {
        type: 'timer',
        timerStartField: 'timerStart',
      };
      const result = generateLayoutSwiftUI(node, attrFields, timerStateFields);
      expect(result).toContain('Text(timerInterval:');
      expect(result).toContain('context.state.data["timerStart"]?.doubleValue');
      expect(result).toContain('Date.distantFuture');
      expect(result).toContain('countsDown: false');
    });

    it('should generate timer with countsDown: true', () => {
      const timerStateFields: Record<string, LiveActivityFieldDef> = {
        timerStart: { type: 'date' },
      };
      const node: LayoutNode = {
        type: 'timer',
        timerStartField: 'timerStart',
        countsDown: true,
      };
      const result = generateLayoutSwiftUI(node, attrFields, timerStateFields);
      expect(result).toContain('countsDown: true');
    });

    it('should generate timer with timerEndField', () => {
      const timerStateFields: Record<string, LiveActivityFieldDef> = {
        timerStart: { type: 'date' },
        timerEnd: { type: 'date' },
      };
      const node: LayoutNode = {
        type: 'timer',
        timerStartField: 'timerStart',
        timerEndField: 'timerEnd',
        countsDown: true,
      };
      const result = generateLayoutSwiftUI(node, attrFields, timerStateFields);
      expect(result).toContain('context.state.data["timerStart"]');
      expect(result).toContain('context.state.data["timerEnd"]');
      expect(result).not.toContain('Date.distantFuture');
    });

    it('should generate timer with font and monospacedDigit modifiers', () => {
      const timerStateFields: Record<string, LiveActivityFieldDef> = {
        timerStart: { type: 'date' },
      };
      const node: LayoutNode = {
        type: 'timer',
        timerStartField: 'timerStart',
        font: 'title',
        monospacedDigit: true,
      };
      const result = generateLayoutSwiftUI(node, attrFields, timerStateFields);
      expect(result).toContain('.font(.title)');
      expect(result).toContain('.monospacedDigit()');
    });

    it('should generate timer with color modifier', () => {
      const timerStateFields: Record<string, LiveActivityFieldDef> = {
        timerStart: { type: 'date' },
      };
      const node: LayoutNode = {
        type: 'timer',
        timerStartField: 'timerStart',
        color: 'red',
      };
      const result = generateLayoutSwiftUI(node, attrFields, timerStateFields);
      expect(result).toContain('.foregroundColor(.red)');
    });

    it('should generate comment for missing timerStartField', () => {
      const node: LayoutNode = {
        type: 'timer',
        timerStartField: 'nonExistent',
      };
      const result = generateLayoutSwiftUI(node, attrFields, stateFields);
      expect(result).toContain('// Timer: missing or invalid timerStartField');
    });

    it('should generate comment for empty timerStartField', () => {
      const node: LayoutNode = { type: 'timer' };
      const result = generateLayoutSwiftUI(node, attrFields, stateFields);
      expect(result).toContain('// Timer: missing or invalid timerStartField');
    });

    // Button node tests
    it('should generate Button(intent:) for button node', () => {
      const node: LayoutNode = {
        type: 'button',
        shortcutIdentifier: 'stopTimer',
        title: 'Stop',
      };
      const result = generateLayoutSwiftUI(node, attrFields, stateFields);
      expect(result).toContain('Button(intent: LA_StopTimerIntent())');
      expect(result).toContain('Text("Stop")');
    });

    it('should generate Button with systemImage as Label', () => {
      const node: LayoutNode = {
        type: 'button',
        shortcutIdentifier: 'stopTimer',
        title: 'Pause',
        systemImage: 'pause.fill',
      };
      const result = generateLayoutSwiftUI(node, attrFields, stateFields);
      expect(result).toContain('Button(intent: LA_StopTimerIntent())');
      expect(result).toContain('Label("Pause", systemImage: "pause.fill")');
    });

    it('should generate comment for missing shortcutIdentifier', () => {
      const node: LayoutNode = { type: 'button', title: 'Click' };
      const result = generateLayoutSwiftUI(node, attrFields, stateFields);
      expect(result).toContain('// Button: missing shortcutIdentifier');
    });

    it('should use shortcutIdentifier as default title', () => {
      const node: LayoutNode = {
        type: 'button',
        shortcutIdentifier: 'startTimer',
      };
      const result = generateLayoutSwiftUI(node, attrFields, stateFields);
      expect(result).toContain('Text("startTimer")');
    });

    // showWhen conditional tests
    it('should wrap node with boolean showWhen condition', () => {
      const node: LayoutNode = {
        type: 'button',
        shortcutIdentifier: 'stopTimer',
        title: 'Pause',
        showWhen: { field: 'isRunning', equals: true },
      };
      const isRunningFields: Record<string, LiveActivityFieldDef> = {
        isRunning: { type: 'boolean' },
      };
      const result = generateLayoutSwiftUI(node, attrFields, isRunningFields);
      expect(result).toContain('if context.state.data["isRunning"]?.boolValue == true');
      expect(result).toContain('Button(intent: LA_StopTimerIntent())');
    });

    it('should wrap node with string showWhen condition', () => {
      const node: LayoutNode = {
        type: 'text',
        value: 'Active',
        showWhen: { field: 'status', equals: 'active' },
      };
      const statusFields: Record<string, LiveActivityFieldDef> = {
        status: { type: 'string' },
      };
      const result = generateLayoutSwiftUI(node, attrFields, statusFields);
      expect(result).toContain('if context.state.data["status"]?.stringValue == "active"');
      expect(result).toContain('Text("Active")');
    });

    it('should wrap node with number showWhen condition', () => {
      const node: LayoutNode = {
        type: 'text',
        value: 'Level 5',
        showWhen: { field: 'level', equals: 5 },
      };
      const levelFields: Record<string, LiveActivityFieldDef> = {
        level: { type: 'number' },
      };
      const result = generateLayoutSwiftUI(node, attrFields, levelFields);
      expect(result).toContain('if context.state.data["level"]?.doubleValue == 5');
      expect(result).toContain('Text("Level 5")');
    });

    it('should not wrap node without showWhen', () => {
      const node: LayoutNode = { type: 'text', value: 'Always visible' };
      const result = generateLayoutSwiftUI(node, attrFields, stateFields);
      expect(result).not.toContain('if context');
      expect(result).toContain('Text("Always visible")');
    });
  });

  describe('generateActivityView', () => {
    it('should generate view struct with correct name', () => {
      const result = generateActivityView(createTimerDef());
      expect(result).toContain('struct TimerActivityView: View');
    });

    it('should use GenericActivityAttributes context', () => {
      const result = generateActivityView(createTimerDef());
      expect(result).toContain('ActivityViewContext<GenericActivityAttributes>');
    });

    it('should include Lock Screen layout with dictionary access', () => {
      const result = generateActivityView(createTimerDef());
      expect(result).toContain('context.attributes.data["taskName"]');
    });

    it('should include iOS 16.2 availability', () => {
      const result = generateActivityView(createTimerDef());
      expect(result).toContain('@available(iOS 16.2, *)');
    });
  });

  describe('generateActivityWidget', () => {
    it('should generate single widget struct', () => {
      const result = generateActivityWidget([createTimerDef()]);
      expect(result).toContain('struct LiveActivityWidget: Widget');
    });

    it('should use GenericActivityAttributes', () => {
      const result = generateActivityWidget([createTimerDef()]);
      expect(result).toContain(
        'ActivityConfiguration(for: GenericActivityAttributes.self)'
      );
    });

    it('should switch on _activityType', () => {
      const result = generateActivityWidget([createTimerDef()]);
      expect(result).toContain('context.attributes.data["_activityType"]?.stringValue');
      expect(result).toContain('case "timerActivity"');
    });

    it('should dispatch to correct view', () => {
      const result = generateActivityWidget([createTimerDef()]);
      expect(result).toContain('TimerActivityView(context: context)');
    });

    it('should include default EmptyView case', () => {
      const result = generateActivityWidget([createTimerDef()]);
      expect(result).toContain('default:');
      expect(result).toContain('EmptyView()');
    });

    it('should include Dynamic Island sections', () => {
      const result = generateActivityWidget([createTimerDef()]);
      expect(result).toContain('DynamicIsland {');
      expect(result).toContain('DynamicIslandExpandedRegion(.leading)');
      expect(result).toContain('compactLeading');
      expect(result).toContain('compactTrailing');
    });

    it('should handle multiple activity types', () => {
      const defs = [
        createTimerDef(),
        createTimerDef({ identifier: 'workoutActivity' }),
      ];
      const result = generateActivityWidget(defs);
      expect(result).toContain('case "timerActivity"');
      expect(result).toContain('case "workoutActivity"');
      expect(result).toContain('TimerActivityView(context: context)');
      expect(result).toContain('WorkoutActivityView(context: context)');
    });

    it('should include custom Dynamic Island compact when provided', () => {
      const def = createTimerDef({
        dynamicIslandCompact: {
          leading: { type: 'text', value: '${taskName}', font: 'caption' },
          trailing: {
            type: 'text',
            value: '${elapsedSeconds}',
            font: 'caption',
          },
        },
      });
      const result = generateActivityWidget([def]);
      expect(result).toContain('context.attributes.data["taskName"]');
      expect(result).toContain('context.state.data["elapsedSeconds"]');
    });

    it('should include iOS 16.2 availability', () => {
      const result = generateActivityWidget([createTimerDef()]);
      expect(result).toContain('@available(iOS 16.2, *)');
    });
  });

  describe('generateWidgetBundle', () => {
    it('should generate @main bundle', () => {
      const result = generateWidgetBundle();
      expect(result).toContain('@main');
      expect(result).toContain(
        'struct GeneratedLiveActivityBundle: WidgetBundle'
      );
    });

    it('should include LiveActivityWidget', () => {
      const result = generateWidgetBundle();
      expect(result).toContain('LiveActivityWidget()');
    });

    it('should include iOS 16.2 availability', () => {
      const result = generateWidgetBundle();
      expect(result).toContain('@available(iOS 16.2, *)');
    });
  });

  describe('generateLiveActivitySwiftFile', () => {
    it('should return empty string when no liveActivities', () => {
      const config: IntentsConfig = { shortcuts: [] };
      expect(generateLiveActivitySwiftFile(config)).toBe('');
    });

    it('should generate complete Swift file', () => {
      const config: IntentsConfig = {
        shortcuts: [],
        liveActivities: [createTimerDef()],
      };
      const result = generateLiveActivitySwiftFile(config);
      expect(result).toContain('AUTO-GENERATED - DO NOT EDIT');
      expect(result).toContain('import ActivityKit');
      expect(result).toContain('import SwiftUI');
      expect(result).toContain('import WidgetKit');
      // Should contain GenericActivityAttributes (duplicated for widget)
      expect(result).toContain('struct GenericActivityAttributes: ActivityAttributes');
      expect(result).toContain('enum CodableValue: Codable, Hashable');
      // Should contain activity view and widget
      expect(result).toContain('struct TimerActivityView');
      expect(result).toContain('struct LiveActivityWidget');
      expect(result).toContain('struct GeneratedLiveActivityBundle');
    });

    it('should omit WidgetBundle when liveActivityWidgetBundle is false', () => {
      const config: IntentsConfig = {
        shortcuts: [],
        liveActivities: [createTimerDef()],
        liveActivityWidgetBundle: false,
      };
      const result = generateLiveActivitySwiftFile(config);
      expect(result).toContain('struct TimerActivityView');
      expect(result).toContain('struct LiveActivityWidget');
      expect(result).not.toContain('@main');
      expect(result).not.toContain('GeneratedLiveActivityBundle');
    });

    it('should include WidgetBundle by default', () => {
      const config: IntentsConfig = {
        shortcuts: [],
        liveActivities: [createTimerDef()],
      };
      const result = generateLiveActivitySwiftFile(config);
      expect(result).toContain('@main');
      expect(result).toContain('GeneratedLiveActivityBundle');
    });

    it('should include WidgetBundle when explicitly true', () => {
      const config: IntentsConfig = {
        shortcuts: [],
        liveActivities: [createTimerDef()],
        liveActivityWidgetBundle: true,
      };
      const result = generateLiveActivitySwiftFile(config);
      expect(result).toContain('@main');
      expect(result).toContain('GeneratedLiveActivityBundle');
    });

    it('should handle multiple Live Activities', () => {
      const config: IntentsConfig = {
        shortcuts: [],
        liveActivities: [
          createTimerDef(),
          createTimerDef({ identifier: 'deliveryActivity' }),
        ],
      };
      const result = generateLiveActivitySwiftFile(config);
      expect(result).toContain('TimerActivityView');
      expect(result).toContain('DeliveryActivityView');
      expect(result).toContain('case "timerActivity"');
      expect(result).toContain('case "deliveryActivity"');
    });

    it('should not contain per-activity ActivityAttributes structs', () => {
      const config: IntentsConfig = {
        shortcuts: [],
        liveActivities: [createTimerDef()],
      };
      const result = generateLiveActivitySwiftFile(config);
      // Should NOT have per-activity typed structs — uses GenericActivityAttributes
      expect(result).not.toContain('struct TimerActivityAttributes');
    });

    it('should contain dictionary-based field access in views', () => {
      const config: IntentsConfig = {
        shortcuts: [],
        liveActivities: [createTimerDef()],
      };
      const result = generateLiveActivitySwiftFile(config);
      expect(result).toContain('context.attributes.data["taskName"]');
      expect(result).toContain('context.state.data["elapsedSeconds"]');
    });

    it('should generate intent stubs with IPC logic for buttons', () => {
      const config: IntentsConfig = {
        shortcuts: [],
        liveActivities: [
          createTimerDef({
            lockScreenLayout: {
              type: 'hstack',
              children: [
                { type: 'text', value: '${taskName}' },
                {
                  type: 'button',
                  shortcutIdentifier: 'pauseTimer',
                  title: 'Pause',
                },
              ],
            },
          }),
        ],
      };
      const result = generateLiveActivitySwiftFile(config);
      // Should use LiveActivityIntent (not plain AppIntent)
      expect(result).toContain('struct LA_PauseTimerIntent: LiveActivityIntent');
      expect(result).not.toContain('struct PauseTimerIntent: AppIntent');
      // Should NOT have openAppWhenRun (LiveActivityIntent handles this implicitly)
      expect(result).not.toContain('openAppWhenRun');
      // Should have IPC logic
      expect(result).toContain('LIVE_ACTIVITY_APP_GROUP_ID');
      expect(result).toContain('UserDefaults(suiteName:');
      expect(result).toContain('IosIntentsPendingCommand');
      expect(result).toContain('IosIntentsCommandNonce');
      expect(result).toContain('CFNotificationCenterPostNotification');
    });

    it('should use explicit appGroupId when provided', () => {
      const config: IntentsConfig = {
        shortcuts: [],
        appGroupId: 'group.com.example.myapp',
        liveActivities: [
          createTimerDef({
            lockScreenLayout: {
              type: 'hstack',
              children: [
                {
                  type: 'button',
                  shortcutIdentifier: 'resume',
                  title: 'Resume',
                },
              ],
            },
          }),
        ],
      };
      const result = generateLiveActivitySwiftFile(config);
      expect(result).toContain(
        'LIVE_ACTIVITY_APP_GROUP_ID = "group.com.example.myapp"'
      );
      // Should NOT have dynamic App Group derivation from bundle ID
      expect(result).not.toContain('components.dropLast()');
    });

    it('should derive appGroupId dynamically when not provided', () => {
      const config: IntentsConfig = {
        shortcuts: [],
        liveActivities: [
          createTimerDef({
            lockScreenLayout: {
              type: 'hstack',
              children: [
                {
                  type: 'button',
                  shortcutIdentifier: 'stop',
                  title: 'Stop',
                },
              ],
            },
          }),
        ],
      };
      const result = generateLiveActivitySwiftFile(config);
      // Should have dynamic derivation from bundle ID
      expect(result).toContain('Bundle.main.bundleIdentifier');
      expect(result).toContain('components.dropLast()');
    });

    it('should include IosIntentsSource in generated button intents', () => {
      const config: IntentsConfig = {
        shortcuts: [],
        liveActivities: [
          createTimerDef({
            lockScreenLayout: {
              type: 'button',
              shortcutIdentifier: 'pauseTimer',
              title: 'Pause',
            },
          }),
        ],
      };
      const result = generateLiveActivitySwiftFile(config);
      expect(result).toContain('defaults.set("liveActivity", forKey: "IosIntentsSource")');
    });

    it('should include IosIntentsSource in app target intents', () => {
      const config: IntentsConfig = {
        shortcuts: [],
        liveActivities: [
          createTimerDef({
            lockScreenLayout: {
              type: 'button',
              shortcutIdentifier: 'resumeTimer',
              title: 'Resume',
            },
          }),
        ],
      };
      const result = generateLiveActivityIntentsForApp(config);
      expect(result).toContain('defaults.set("liveActivity", forKey: "IosIntentsSource")');
    });
  });

  describe('CodableValue parity between source and generated code', () => {
    it('should have matching enum cases and accessors in source and generated widget code', () => {
      // Read the source CodableValue from ios/GenericActivityAttributes.swift
      const sourceSwift = fs.readFileSync(
        path.resolve(__dirname, '../../../ios/GenericActivityAttributes.swift'),
        'utf-8'
      );

      // Generate the widget code that contains the duplicated CodableValue
      const config: IntentsConfig = {
        shortcuts: [],
        liveActivities: [createTimerDef()],
      };
      const generatedSwift = generateLiveActivitySwiftFile(config);

      // Extract enum cases from both
      const extractCases = (code: string) => {
        const caseMatches = code.match(/case \w+\(\w+\)/g) || [];
        return caseMatches.sort();
      };

      // Extract accessor names from both
      const extractAccessors = (code: string) => {
        const accessorMatches = code.match(/var \w+Value: \w+\?/g) || [];
        return accessorMatches.sort();
      };

      const sourceCases = extractCases(sourceSwift);
      const generatedCases = extractCases(generatedSwift);
      expect(sourceCases).toEqual(generatedCases);

      const sourceAccessors = extractAccessors(sourceSwift);
      const generatedAccessors = extractAccessors(generatedSwift);
      expect(sourceAccessors).toEqual(generatedAccessors);
    });
  });
});
