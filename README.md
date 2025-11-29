# react-native-ios-intents

React Native library for iOS Siri Shortcuts using App Intents.

Built with [Nitro Modules](https://nitro.margelo.com/) for optimal performance.

## Features

- **TypeScript-first** - Configure shortcuts in TypeScript, generate Swift code
- **Full type safety with autocomplete** - Generic types for shortcut identifiers and parameters
- **Dynamic state dialogs** - Show confirmations/messages based on app state
- **Instant availability** - Shortcuts work immediately after installation
- **Works when app is killed** - Uses App Intents for background execution
- **Siri parameters** - Capture user input (dates, names, notes) via Siri voice commands
- 🚧 **Live Activities** - tbd

## Requirements

- iOS 16.0+
- React Native 0.74+
- Xcode 15+

## Installation

```sh
npm install react-native-ios-intents react-native-nitro-modules
cd ios && pod install
```

## Quick Start

### 1. Generate Configuration

```bash
npx react-native-ios-intents generate
```

### 2. Define Shortcuts

Edit `shortcuts.config.ts`:

```typescript
import type { ShortcutsConfig } from 'react-native-ios-intents';

const config: ShortcutsConfig = {
  shortcuts: [
    {
      identifier: 'startTimer',
      title: 'Start Timer',
      phrases: ['Start timer', 'Begin tracking'],
      systemImageName: 'play.circle',
    },
  ],
};

export default config;
```

### 3. Configure iOS Capabilities

Open your project in Xcode and add the required capabilities:

1. **Siri** (Recommended)
   - Select your target → **Signing & Capabilities**
   - Click **"+ Capability"** → **Siri**
   - Note: This may work without explicitly adding Siri capability when using App Intents framework (iOS 16+), but adding it is recommended

2. **App Groups** (Required)
   - Click **"+ Capability"** → **App Groups**
   - Click **"+"** to add a new group
   - Use format: `group.{your.bundle.id}` (e.g., `group.com.myapp`)
   - **Important:** The library automatically uses `group.{bundleId}` - ensure it matches

3. **Add Generated Swift Files**
   - After running `generate`, locate `ios/{YourApp}/GeneratedAppIntents.swift`
   - Drag it into your Xcode project
   - **Uncheck** "Copy items if needed"
   - Ensure your app target is selected

### 4. Generate & Build

```bash
npx react-native-ios-intents generate
npx react-native run-ios
```

### 5. Handle Invocations

```typescript
import { useEffect } from 'react';
import { SiriShortcuts } from 'react-native-ios-intents';
import type { ShortcutInvocation } from './shortcuts.generated';

function App() {
  useEffect(() => {
    // Use generic type for full autocomplete support
    const subscription = SiriShortcuts.addEventListener<ShortcutInvocation>('shortcut', (shortcut, respond) => {
      // TypeScript now knows all possible identifiers!
      if (shortcut.identifier === 'startTimer') {
        startTimer();
        respond({ message: "Timer started!" });
      }
    });

    return () => subscription.remove();
  }, []);

  return <YourApp />;
}
```

Now say **"Hey Siri, start timer in [Your App Name]"** and Siri will respond with your message!

## API Reference

### `SiriShortcuts.addEventListener<T>(event, listener)`

Listen for Siri shortcut invocations with optional type safety.

```typescript
// Basic usage (default types)
const subscription = SiriShortcuts.addEventListener('shortcut', (shortcut, respond) => {
  // shortcut.identifier is string
  // shortcut.parameters is Record<string, any>
});

// Type-safe usage with generated types (recommended)
import type { ShortcutInvocation } from './shortcuts.generated';

const subscription = SiriShortcuts.addEventListener<ShortcutInvocation>('shortcut', (shortcut, respond) => {
  // TypeScript knows exact shortcut identifiers: 'startTimer' | 'stopTimer' | ...
  // Full autocomplete for shortcut.identifier

  if (shortcut.identifier === 'addTask') {
    // TypeScript knows shortcut.parameters.taskName exists and is a string
    console.log(shortcut.parameters.taskName); // Autocomplete works!
  }

  respond({ message: "Done!" });
});

subscription.remove(); // cleanup
```

### `SiriShortcuts.updateAppState(state)`

Sync app state for state-based dialogs.

```typescript
SiriShortcuts.updateAppState({
  timerRunning: true,
  taskName: 'Work',
});
```

### `SiriShortcuts.cleanup(stateKeys?)`

Full cleanup for logout/teardown scenarios.

```typescript
// Full cleanup - remove listeners and clear all tracked app state
SiriShortcuts.cleanup();

// Clear only specific keys
SiriShortcuts.cleanup(['timerRunning', 'taskName']);
```

## Documentation

- [iOS Setup Guide](./docs/setup.md) - Detailed setup instructions
- [Configuration](./docs/configuration.md) - Config options and types
- [State Dialogs](./docs/state-dialogs.md) - Smart confirmations and messages
- [Localization](./docs/localization.md) - Multi-language support
- [Architecture](./docs/architecture.md) - How it works under the hood
- [Testing](./docs/testing.md) - Testing and debugging

## Example

See the `example/` directory for a complete timer app implementation.

```bash
npm install
cd example && npm install && cd ios && pod install && cd ../..
npm run nitrogen
npm run generate-shortcuts:example
npm run example ios
```

## Known Issues / TODO

### State Dialog API Uses Deprecated Confirmation Method
The current state dialog feature with `requiresConfirmation: true` uses `requestConfirmation(result:)` which is deprecated in iOS 16+. The code works but shows compiler warnings.

**TODO:** Update to modern App Intents confirmation flow using:
- `@Parameter` for confirmation values
- Proper `IntentConfirmation` structure

See: [Apple App Intents Documentation - Confirmation](https://developer.apple.com/documentation/appintents/dynamicoptionsprovider)

### Shortcut Parameters

The library supports capturing voice input from users through Siri parameters:

```typescript
// shortcuts.config.ts
{
  identifier: 'addTask',
  title: 'Add Task',
  phrases: ['Add a task', 'Create a task'],
  parameters: [
    {
      name: 'taskName',
      title: 'Task Name',
      type: 'string',
      optional: false
    },
    {
      name: 'dueDate',
      title: 'Due Date',
      type: 'date',
      optional: true
    }
  ]
}
```

**Handling in your code:**
```typescript
import type { ShortcutInvocation } from './shortcuts.generated';

SiriShortcuts.addEventListener<ShortcutInvocation>('shortcut', (shortcut, respond) => {
  if (shortcut.identifier === 'addTask') {
    // TypeScript knows shortcut.parameters.taskName is a string
    const taskName = shortcut.parameters.taskName;
    const dueDate = shortcut.parameters.dueDate; // Date | undefined

    addTask(taskName, dueDate);
    respond({ message: `Task "${taskName}" added!` });
  }
});
```

**Supported parameter types:** `string`, `number`, `boolean`, `date`

### Live Activities (Coming Soon)

Support for iOS Live Activities to show real-time updates on the Lock Screen and Dynamic Island.

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
