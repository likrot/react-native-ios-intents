# Configuration

## shortcuts.config.ts

Create this file in your project root to define your shortcuts:

```typescript
import type { ShortcutsConfig } from 'react-native-ios-intents';

const config: ShortcutsConfig = {
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

### ShortcutsConfig

```typescript
interface ShortcutsConfig {
  shortcuts: ShortcutDefinition[];
  appGroupId?: string;           // Optional: specify custom App Group ID
                                 // Default: group.<bundle-identifier>
  localization?: boolean;        // Enable localization support
                                 // Default: false
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

## CLI Commands

### `npx react-native-ios-intents generate`

Generates Swift App Intents from your shortcuts configuration.

**First run:** Creates `shortcuts.config.ts` template if it doesn't exist.

**Subsequent runs:** Reads your `shortcuts.config.ts` and generates `GeneratedAppIntents.swift`.

Run this command whenever you:
- Set up the library for the first time
- Add, remove, or modify shortcuts in your config

## Multiple Phrases

Provide multiple ways to trigger the same shortcut:

```typescript
const config: ShortcutsConfig = {
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

1. Edit `shortcuts.config.ts`
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
