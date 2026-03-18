/**
 * Swift code generation for Live Activities (iOS 16.2+)
 *
 * Generates a single GeneratedLiveActivity.swift file containing:
 * - Duplicated GenericActivityAttributes (self-contained Widget Extension)
 * - Per-activity SwiftUI View structs
 * - Single LiveActivityWidget with switch dispatch
 * - Optional WidgetBundle
 */

import type {
  LiveActivityDefinition,
  LiveActivityFieldDef,
  LayoutNode,
} from '../liveactivity-types';
import type { IntentsConfig } from '../types';
import { pascalCase, escapeForSwift } from './utils';
import { loadTemplate, fillTemplate } from './template-loader';

/**
 * Returns a string of spaces for the given indentation level (4 spaces per level)
 */
function indent(level: number): string {
  return '    '.repeat(level);
}

/**
 * Maps a LiveActivityFieldDef type to the CodableValue accessor name
 */
function mapFieldTypeToAccessor(type: LiveActivityFieldDef['type']): string {
  switch (type) {
    case 'string':
      return 'stringValue';
    case 'number':
      return 'doubleValue';
    case 'boolean':
      return 'boolValue';
    case 'date':
      return 'doubleValue';
  }
}

/**
 * Maps a LiveActivityFieldDef type to the Swift default value
 */
function mapFieldTypeToDefault(type: LiveActivityFieldDef['type']): string {
  switch (type) {
    case 'string':
      return '""';
    case 'number':
      return '0';
    case 'boolean':
      return 'false';
    case 'date':
      return '0';
  }
}

/**
 * Recursively generates SwiftUI code from a LayoutNode tree
 *
 * Uses dictionary-based field access via GenericActivityAttributes:
 * - Attributes: context.attributes.data["field"]?.stringValue ?? ""
 * - ContentState: context.state.data["field"]?.doubleValue ?? 0
 *
 * @param node - The layout node to generate
 * @param attributeFields - Map of attribute field names to their definitions
 * @param contentStateFields - Map of content state field names to their definitions
 * @param indent - Current indentation level
 */
export function generateLayoutSwiftUI(
  node: LayoutNode,
  attributeFields: Record<string, LiveActivityFieldDef>,
  contentStateFields: Record<string, LiveActivityFieldDef>,
  indentStr: string = indent(4)
): string {
  const inner = generateLayoutSwiftUIInner(node, attributeFields, contentStateFields, indentStr);

  // Wrap with showWhen conditional if specified
  if (node.showWhen) {
    const { field, equals } = node.showWhen;
    let comparison: string;

    if (typeof equals === 'boolean') {
      comparison = `context.state.data["${field}"]?.boolValue == ${equals}`;
    } else if (typeof equals === 'string') {
      comparison = `context.state.data["${field}"]?.stringValue == "${escapeForSwift(equals)}"`;
    } else {
      comparison = `context.state.data["${field}"]?.doubleValue == ${equals}`;
    }

    return `${indentStr}if ${comparison} {
${inner.split('\n').map(line => '    ' + line).join('\n')}
${indentStr}}`;
  }

  return inner;
}

/**
 * Inner layout generation without showWhen wrapping
 */
function generateLayoutSwiftUIInner(
  node: LayoutNode,
  attributeFields: Record<string, LiveActivityFieldDef>,
  contentStateFields: Record<string, LiveActivityFieldDef>,
  indentStr: string
): string {
  switch (node.type) {
    case 'spacer':
      return `${indentStr}Spacer()`;

    case 'text':
      return generateTextNode(node, attributeFields, contentStateFields, indentStr);

    case 'image':
      return generateImageNode(node, indentStr);

    case 'progress':
      return generateProgressNode(node, contentStateFields, indentStr);

    case 'timer':
      return generateTimerNode(node, contentStateFields, indentStr);

    case 'button':
      return generateButtonNode(node, indentStr);

    case 'hstack':
    case 'vstack':
    case 'zstack':
      return generateStackNode(
        node,
        attributeFields,
        contentStateFields,
        indentStr
      );

    default:
      return `${indentStr}// Unknown node type: ${(node as LayoutNode).type}`;
  }
}

/**
 * Generates SwiftUI Text view with interpolation and modifiers
 */
function generateTextNode(
  node: LayoutNode,
  attributeFields: Record<string, LiveActivityFieldDef>,
  contentStateFields: Record<string, LiveActivityFieldDef>,
  indentStr: string
): string {
  const value = node.value || '';
  const swiftString = resolveInterpolation(
    value,
    attributeFields,
    contentStateFields
  );
  let code = `${indentStr}Text(${swiftString})`;

  if (node.font) {
    code += `\n${indentStr}    .font(.${node.font})`;
  }
  if (node.color) {
    code += `\n${indentStr}    .foregroundColor(.${node.color})`;
  }
  if (node.monospacedDigit) {
    code += `\n${indentStr}    .monospacedDigit()`;
  }

  return code;
}

/**
 * Generates SwiftUI Image view (SF Symbols) with modifiers
 */
function generateImageNode(node: LayoutNode, indentStr: string): string {
  const systemImage = node.systemImage || 'questionmark';
  let code = `${indentStr}Image(systemName: "${escapeForSwift(systemImage)}")`;

  if (node.color) {
    code += `\n${indentStr}    .foregroundColor(.${node.color})`;
  }

  return code;
}

/**
 * Generates SwiftUI ProgressView with dictionary-based field access
 */
function generateProgressNode(
  node: LayoutNode,
  contentStateFields: Record<string, LiveActivityFieldDef>,
  indentStr: string
): string {
  const field = node.progressField || '';
  if (!field || !(field in contentStateFields)) {
    return `${indentStr}// Progress: missing or invalid field "${field}"`;
  }
  return `${indentStr}ProgressView(value: context.state.data["${field}"]?.doubleValue ?? 0)`;
}

/**
 * Generates SwiftUI Text(timerInterval:) for system-rendered timer display
 */
function generateTimerNode(
  node: LayoutNode,
  contentStateFields: Record<string, LiveActivityFieldDef>,
  indentStr: string
): string {
  const startField = node.timerStartField || '';
  const endField = node.timerEndField || '';
  const countsDown = node.countsDown ?? false;

  if (!startField || !(startField in contentStateFields)) {
    return `${indentStr}// Timer: missing or invalid timerStartField "${startField}"`;
  }

  let rangeStart: string;
  let rangeEnd: string;

  if (endField && endField in contentStateFields) {
    rangeStart = `Date(timeIntervalSince1970: context.state.data["${startField}"]?.doubleValue ?? 0)`;
    rangeEnd = `Date(timeIntervalSince1970: context.state.data["${endField}"]?.doubleValue ?? 0)`;
  } else {
    rangeStart = `Date(timeIntervalSince1970: context.state.data["${startField}"]?.doubleValue ?? 0)`;
    rangeEnd = 'Date.distantFuture';
  }

  let code = `${indentStr}Text(timerInterval: ${rangeStart}...${rangeEnd}, countsDown: ${countsDown})`;

  if (node.font) {
    code += `\n${indentStr}    .font(.${node.font})`;
  }
  if (node.monospacedDigit) {
    code += `\n${indentStr}    .monospacedDigit()`;
  }
  if (node.color) {
    code += `\n${indentStr}    .foregroundColor(.${node.color})`;
  }

  return code;
}

/**
 * Generates SwiftUI Button(intent:) for interactive Live Activity buttons
 */
function generateButtonNode(node: LayoutNode, indentStr: string): string {
  const shortcutId = node.shortcutIdentifier || '';
  if (!shortcutId) {
    return `${indentStr}// Button: missing shortcutIdentifier`;
  }

  // Use LA_ prefix to avoid naming collision with Siri shortcut intents
  // in the main app target (e.g., StopTimerIntent: AppIntent)
  const intentName = `LA_${pascalCase(shortcutId)}Intent`;
  const title = node.title || shortcutId;

  let labelCode: string;
  if (node.systemImage) {
    labelCode = `Label("${escapeForSwift(title)}", systemImage: "${escapeForSwift(node.systemImage)}")`;
  } else {
    labelCode = `Text("${escapeForSwift(title)}")`;
  }

  return `${indentStr}Button(intent: ${intentName}()) {
${indentStr}    ${labelCode}
${indentStr}}`;
}

/**
 * Generates SwiftUI stack containers (HStack, VStack, ZStack)
 */
function generateStackNode(
  node: LayoutNode,
  attributeFields: Record<string, LiveActivityFieldDef>,
  contentStateFields: Record<string, LiveActivityFieldDef>,
  indentStr: string
): string {
  const stackType =
    node.type === 'hstack'
      ? 'HStack'
      : node.type === 'vstack'
        ? 'VStack'
        : 'ZStack';

  const params: string[] = [];
  if (node.alignment) {
    params.push(`alignment: .${node.alignment}`);
  }
  if (node.spacing !== undefined) {
    params.push(`spacing: ${node.spacing}`);
  }

  const paramStr = params.length > 0 ? `(${params.join(', ')})` : '';
  const childIndent = indentStr + '    ';

  const children = (node.children || [])
    .map((child) =>
      generateLayoutSwiftUI(child, attributeFields, contentStateFields, childIndent)
    )
    .join('\n');

  return `${indentStr}${stackType}${paramStr} {
${children}
${indentStr}}`;
}

/**
 * Resolves ${field} interpolation in text values to Swift dictionary-based access
 *
 * - ${field} where field is in attributes -> context.attributes.data["field"]?.stringValue ?? ""
 * - ${field} where field is in contentState -> context.state.data["field"]?.doubleValue ?? 0
 * - Plain text (no interpolation) -> quoted string literal
 */
export function resolveInterpolation(
  value: string,
  attributeFields: Record<string, LiveActivityFieldDef>,
  contentStateFields: Record<string, LiveActivityFieldDef>
): string {
  const hasInterpolation = /\$\{(\w+)\}/.test(value);
  if (!hasInterpolation) {
    return `"${escapeForSwift(value)}"`;
  }

  // Split on interpolation tokens, escape literal parts, reassemble
  const parts = value.split(/(\$\{\w+\})/);
  const swiftParts = parts.map((part) => {
    const match = part.match(/^\$\{(\w+)\}$/);
    if (!match) {
      // Literal text — escape for Swift string
      return escapeForSwift(part);
    }

    const field = match[1]!;
    if (field in attributeFields) {
      const def = attributeFields[field]!;
      const accessor = mapFieldTypeToAccessor(def.type);
      const defaultVal = mapFieldTypeToDefault(def.type);
      return `\\(context.attributes.data["${field}"]?.${accessor} ?? ${defaultVal})`;
    }
    if (field in contentStateFields) {
      const def = contentStateFields[field]!;
      const accessor = mapFieldTypeToAccessor(def.type);
      const defaultVal = mapFieldTypeToDefault(def.type);
      return `\\(context.state.data["${field}"]?.${accessor} ?? ${defaultVal})`;
    }
    // Unknown field - leave as literal
    return escapeForSwift(`\${${field}}`);
  });

  return `"${swiftParts.join('')}"`;
}

/**
 * Generates a SwiftUI View struct for a single Live Activity type
 */
export function generateActivityView(
  def: LiveActivityDefinition
): string {
  const viewName = `${pascalCase(def.identifier)}View`;
  const attributeFields = def.attributes;
  const contentStateFields = def.contentState;

  // Generate Lock Screen layout
  const lockScreenBody = generateLayoutSwiftUI(
    def.lockScreenLayout,
    attributeFields,
    contentStateFields,
    indent(3)
  );

  return `@available(iOS 16.2, *)
struct ${viewName}: View {
    let context: ActivityViewContext<GenericActivityAttributes>

    var body: some View {
        VStack {
${lockScreenBody}
        }
        .padding()
    }
}`;
}

/**
 * Generates the single LiveActivityWidget with switch dispatch for all activity types
 */
export function generateActivityWidget(
  defs: LiveActivityDefinition[]
): string {
  // Generate switch cases for lock screen
  const lockScreenCases = defs.map((def) => {
    const viewName = `${pascalCase(def.identifier)}View`;
    return `${indent(4)}case "${def.identifier}":
${indent(5)}${viewName}(context: context)`;
  }).join('\n');

  // Generate Dynamic Island content for each activity type
  // For simplicity, use the first definition's dynamic island config or defaults
  const dynamicIslandContent = generateDynamicIslandContent(defs);

  return `@available(iOS 16.2, *)
struct LiveActivityWidget: Widget {
${indent(1)}var body: some WidgetConfiguration {
${indent(2)}ActivityConfiguration(for: GenericActivityAttributes.self) { context in
${indent(3)}let type = context.attributes.data["_activityType"]?.stringValue ?? ""
${indent(3)}switch type {
${lockScreenCases}
${indent(3)}default:
${indent(4)}EmptyView()
${indent(3)}}
${indent(2)}} dynamicIsland: { context in
${dynamicIslandContent}
${indent(2)}}
${indent(1)}}
}`;
}

/**
 * Generates Dynamic Island content with switch dispatch
 */
function generateDynamicIslandContent(
  defs: LiveActivityDefinition[]
): string {
  // Build per-activity expanded regions
  const expandedCases = generateDynamicIslandExpandedCases(defs);
  const compactLeadingCases = generateDynamicIslandCompactCases(defs, 'leading');
  const compactTrailingCases = generateDynamicIslandCompactCases(defs, 'trailing');

  return `${indent(3)}let type = context.attributes.data["_activityType"]?.stringValue ?? ""
${indent(3)}return DynamicIsland {
${indent(4)}DynamicIslandExpandedRegion(.leading) {
${expandedCases.leading}
${indent(4)}}
${indent(4)}DynamicIslandExpandedRegion(.trailing) {
${expandedCases.trailing}
${indent(4)}}
${indent(4)}DynamicIslandExpandedRegion(.center) {
${expandedCases.center}
${indent(4)}}
${indent(4)}DynamicIslandExpandedRegion(.bottom) {
${expandedCases.bottom}
${indent(4)}}
${indent(3)}} compactLeading: {
${compactLeadingCases}
${indent(3)}} compactTrailing: {
${compactTrailingCases}
${indent(3)}} minimal: {
${indent(4)}EmptyView()
${indent(3)}}`;
}

/**
 * Generates switch-based Dynamic Island expanded region content
 */
function generateDynamicIslandExpandedCases(
  defs: LiveActivityDefinition[]
): { leading: string; trailing: string; center: string; bottom: string } {
  const regions: { leading: string; trailing: string; center: string; bottom: string } = {
    leading: '',
    trailing: '',
    center: '',
    bottom: '',
  };

  for (const region of ['leading', 'trailing', 'center', 'bottom'] as const) {
    const cases: string[] = [];
    let hasAnyCases = false;

    for (const def of defs) {
      const expanded = def.dynamicIslandExpanded;
      const node = expanded?.[region];
      if (node) {
        hasAnyCases = true;
        const body = generateLayoutSwiftUI(
          node,
          def.attributes,
          def.contentState,
          indent(7)
        );
        cases.push(`${indent(5)}case "${def.identifier}":
${body}`);
      }
    }

    if (hasAnyCases) {
      regions[region] = `${indent(5)}switch type {
${cases.join('\n')}
${indent(5)}default:
${indent(6)}EmptyView()
${indent(5)}}`;
    } else {
      regions[region] = `${indent(5)}EmptyView()`;
    }
  }

  return regions;
}

/**
 * Generates switch-based Dynamic Island compact content
 */
function generateDynamicIslandCompactCases(
  defs: LiveActivityDefinition[],
  position: 'leading' | 'trailing'
): string {
  const cases: string[] = [];
  let hasAnyCases = false;

  for (const def of defs) {
    const compact = def.dynamicIslandCompact;
    const node = compact?.[position];
    if (node) {
      hasAnyCases = true;
      const body = generateLayoutSwiftUI(
        node,
        def.attributes,
        def.contentState,
        indent(6)
      );
      cases.push(`${indent(4)}case "${def.identifier}":
${body}`);
    }
  }

  if (hasAnyCases) {
    return `${indent(4)}switch type {
${cases.join('\n')}
${indent(4)}default:
${indent(5)}EmptyView()
${indent(4)}}`;
  }
  return `${indent(4)}EmptyView()`;
}

/**
 * Recursively collects all shortcutIdentifiers from button nodes in a layout tree
 */
function collectButtonIntents(node: LayoutNode): Set<string> {
  const intents = new Set<string>();
  if (node.type === 'button' && node.shortcutIdentifier) {
    intents.add(node.shortcutIdentifier);
  }
  if (node.children) {
    for (const child of node.children) {
      for (const id of collectButtonIntents(child)) {
        intents.add(id);
      }
    }
  }
  return intents;
}

/**
 * Collects all button intent identifiers from all Live Activity definitions
 */
export function collectAllButtonIntents(defs: LiveActivityDefinition[]): Set<string> {
  const allIntents = new Set<string>();
  for (const def of defs) {
    for (const id of collectButtonIntents(def.lockScreenLayout)) {
      allIntents.add(id);
    }
    if (def.dynamicIslandCompact) {
      for (const id of collectButtonIntents(def.dynamicIslandCompact.leading)) {
        allIntents.add(id);
      }
      for (const id of collectButtonIntents(def.dynamicIslandCompact.trailing)) {
        allIntents.add(id);
      }
    }
    if (def.dynamicIslandExpanded) {
      for (const region of ['leading', 'trailing', 'center', 'bottom'] as const) {
        const node = def.dynamicIslandExpanded[region];
        if (node) {
          for (const id of collectButtonIntents(node)) {
            allIntents.add(id);
          }
        }
      }
    }
  }
  return allIntents;
}

/**
 * Generates a single LiveActivityIntent struct for a given shortcut identifier.
 * Used by both the main app target and widget extension target generators.
 *
 * @param id - The shortcut identifier (e.g., 'pauseTimer')
 * @param appGroupConstant - The Swift constant name for the App Group ID
 */
function generateSingleIntent(id: string, appGroupConstant: string): string {
  const template = loadTemplate('LiveActivityIntent.swift.template');
  return fillTemplate(template, {
    INTENT_NAME: `LA_${pascalCase(id)}Intent`,
    TITLE: pascalCase(id),
    APP_GROUP_CONSTANT: appGroupConstant,
    COMMAND_ID: id,
  });
}

/**
 * Generates LiveActivityIntent structs for the main app target.
 * These must exist in the main app target because LiveActivityIntent.perform()
 * executes in the main app's process. The widget extension has its own copy
 * for Button(intent:) compilation.
 *
 * Uses the existing APP_GROUP_ID constant from GeneratedAppIntents.swift.
 */
export function generateLiveActivityIntentsForApp(config: IntentsConfig): string {
  const defs = config.liveActivities || [];
  const intents = collectAllButtonIntents(defs);
  if (intents.size === 0) {
    return '';
  }

  const stubs = Array.from(intents)
    .map((id) => generateSingleIntent(id, 'APP_GROUP_ID'))
    .join('\n\n');

  return `// MARK: - Live Activity Button Intents
// These LiveActivityIntent structs handle button taps in Live Activities.
// They run in the main app's process in the background (without foregrounding).

${stubs}`;
}

/**
 * Generates AppIntent structs for button references in the Widget Extension.
 * These intents perform the action in the background by writing commands to
 * shared UserDefaults and posting a Darwin notification — the same IPC pattern
 * used by the main app's Siri shortcut intents.
 */
function generateIntentStubs(defs: LiveActivityDefinition[], appGroupId?: string): string {
  const intents = collectAllButtonIntents(defs);
  if (intents.size === 0) {
    return '';
  }

  const stubs = Array.from(intents)
    .map((id) => generateSingleIntent(id, 'LIVE_ACTIVITY_APP_GROUP_ID'))
    .join('\n\n');

  // Generate App Group ID constant for widget extension
  const appGroupConstant = appGroupId
    ? `private let LIVE_ACTIVITY_APP_GROUP_ID = "${appGroupId}"`
    : `private var LIVE_ACTIVITY_APP_GROUP_ID: String {
    // Widget extensions have bundle IDs like "com.app.WidgetExtension"
    // Strip last component to derive the main app's bundle ID
    guard let bundleId = Bundle.main.bundleIdentifier else {
        fatalError("Cannot determine bundle identifier")
    }
    let components = bundleId.split(separator: ".")
    let appBundleId = components.dropLast().joined(separator: ".")
    return "group.\\(appBundleId)"
}`;

  return `// MARK: - App Group ID (for Widget Extension IPC)

${appGroupConstant}

// MARK: - Button Intents (Widget Extension)
// These intents handle button taps in the Live Activity by writing commands
// to shared UserDefaults and posting a Darwin notification to wake the main app.

${stubs}`;
}

/**
 * Generates the @main WidgetBundle that registers the Live Activity widget
 */
export function generateWidgetBundle(): string {
  return loadTemplate('WidgetBundle.swift.template');
}

/**
 * Generates the duplicated CodableValue + GenericActivityAttributes for Widget Extension
 */
function generateGenericAttributesForWidget(): string {
  return loadTemplate('CodableValue.swift.template');
}

/**
 * Generates the complete GeneratedLiveActivity.swift file
 *
 * Contains:
 * - File header with generation warning
 * - Import statements
 * - Duplicated CodableValue + GenericActivityAttributes
 * - Per-activity SwiftUI View structs
 * - Single LiveActivityWidget with switch dispatch
 * - Optional WidgetBundle entry point
 */
export function generateLiveActivitySwiftFile(
  config: IntentsConfig
): string {
  const defs = config.liveActivities || [];
  if (defs.length === 0) {
    return '';
  }

  const generateBundle = config.liveActivityWidgetBundle !== false;

  const genericAttributes = generateGenericAttributesForWidget();
  const intentStubs = generateIntentStubs(defs, config.appGroupId);
  const views = defs.map((def) => generateActivityView(def)).join('\n\n');
  const widget = generateActivityWidget(defs);

  let bundleSection = '';
  if (generateBundle) {
    const bundle = generateWidgetBundle();
    bundleSection = `

// MARK: - Widget Bundle

${bundle}`;
  }

  let intentSection = '';
  if (intentStubs) {
    intentSection = `

${intentStubs}`;
  }

  const template = loadTemplate('GeneratedLiveActivity.swift.template');
  return fillTemplate(template, {
    GENERIC_ATTRIBUTES: genericAttributes,
    INTENT_SECTION: intentSection,
    ACTIVITY_VIEWS: views,
    ACTIVITY_WIDGET: widget,
    BUNDLE_SECTION: bundleSection,
  });
}
