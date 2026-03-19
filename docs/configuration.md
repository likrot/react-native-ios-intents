# Configuration

## intents.config.ts

Create this file in your project root to define your shortcuts:

> **Note:** `ShortcutsConfig` and `shortcuts.config.ts` still work as deprecated aliases.

```typescript
import type { IntentsConfig } from 'react-native-ios-intents';

const config: IntentsConfig = {
  shortcuts: [
    {
      identifier: 'startTimer',        // Unique identifier
      title: 'Start Timer',            // Display name
      phrases: [                       // Siri trigger phrases (3-5 recommended)
        'Start timer',
        'Begin tracking',
        'Start the timer'
      ],
      systemImageName: 'play.circle',  // SF Symbol icon (optional)
      description: 'Starts a timer'    // Description (optional)
    }
  ]
};

export default config;
```

## Types

### IntentsConfig

```typescript
interface IntentsConfig {
  shortcuts: ShortcutDefinition[];
  appGroupId?: string;                  // Custom App Group ID
                                        // Default: group.<bundle-identifier>
  localization?: boolean;               // Enable localization support
                                        // Default: false
  liveActivities?: LiveActivityDefinition[];  // Live Activity definitions
                                        // See docs/live-activities.md
  widgetExtensionTarget?: string;       // Widget Extension target name
                                        // Auto-copies GeneratedLiveActivity.swift on generate
  liveActivityWidgetBundle?: boolean;   // Generate @main WidgetBundle
                                        // Default: true — set false if you have an existing bundle
}
```

### ShortcutDefinition

```typescript
interface ShortcutDefinition {
  identifier: string;            // Unique identifier (e.g., 'startTimer')
  title: string;                 // Display name shown to user
  phrases: string[];             // Siri trigger phrases (3-5 recommended)
  systemImageName?: string;      // Optional SF Symbol icon name
  description?: string;          // Optional description
  stateDialogs?: StateDialog[];  // Optional state-based dialogs/confirmations
}
```

### StateDialog

```typescript
interface StateDialog {
  stateKey: string;                          // App state key to check (synced via updateAppState)
  showWhen: boolean | string | number;       // Show dialog when state equals this value
  message: string;                           // Message to show to user via Siri
                                             // Supports ${variableName} for dynamic interpolation
  requiresConfirmation?: boolean;            // true: user must confirm, false: just show message
                                             // Default: true
}
```

### LiveActivityDefinition

```typescript
interface LiveActivityDefinition {
  identifier: string;                        // Unique identifier (e.g., 'timerActivity')
  attributes: Record<string, FieldDefinition>;   // Static data set at start
  contentState: Record<string, FieldDefinition>; // Dynamic data updated at runtime
  lockScreenLayout: LayoutNode;              // Required Lock Screen SwiftUI layout
  dynamicIslandCompact?: {                    // Optional Dynamic Island compact view
    leading: LayoutNode;                     //   Required leading content
    trailing: LayoutNode;                    //   Required trailing content
  };
  dynamicIslandExpanded?: {                  // Optional Dynamic Island expanded view
    leading?: LayoutNode;
    trailing?: LayoutNode;
    center?: LayoutNode;
    bottom?: LayoutNode;
  };
}

interface FieldDefinition {
  type: 'string' | 'number' | 'boolean' | 'date';
  title?: string;                                    // Optional human-readable title
}
```

See [Live Activities](./live-activities.md) for layout node types, timer display, interactive buttons, and widget setup.

## CLI Commands

### `npx react-native-ios-intents generate`

Generates Swift App Intents from your shortcuts configuration.

**First run:** Creates `intents.config.ts` template if it doesn't exist.

**Subsequent runs:** Reads your `intents.config.ts` and generates `GeneratedAppIntents.swift`.

Run this command whenever you:

- Set up the library for the first time
- Add, remove, or modify shortcuts in your config

## Multiple Phrases

Provide multiple ways to trigger the same shortcut:

```typescript
const config: IntentsConfig = {
  shortcuts: [
    {
      identifier: 'startTimer',
      title: 'Start Timer',
      phrases: [
        'Start timer',
        'Begin tracking',
        'Start the timer',
        'Begin timer',
        'New timer'
      ],
      systemImageName: 'play.circle'
    }
  ]
};
```

## Updating Shortcuts

To add or modify shortcuts:

1. Edit `intents.config.ts`
2. Run `npx react-native-ios-intents generate`
3. Rebuild your app: `npx react-native run-ios`

The new shortcuts will be available immediately after installation.

## Type-Safe Autocomplete

When you run `npx react-native-ios-intents generate`, it creates a `shortcuts.generated.d.ts` file with TypeScript types for your specific shortcuts. This enables full autocomplete for shortcut identifiers and parameters.

### Basic Usage (Default Types)

```typescript
import { SiriShortcuts } from 'react-native-ios-intents';

SiriShortcuts.addEventListener('shortcut', (shortcut, respond) => {
  // shortcut.identifier is string
  // shortcut.parameters is Record<string, any>

  if (shortcut.identifier === 'startTimer') {
    respond({ message: "Timer started!" });
  }
});
```

## See Also

- [State Dialogs](./state-dialogs.md) — Smart confirmations and messages via `stateDialogs`
- [Live Activities](./live-activities.md) — Layout nodes, timer, buttons, widget setup
- [Localization](./localization.md) — Multi-language translation support
