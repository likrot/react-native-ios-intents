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
- **Live Activities** - Config-driven Lock Screen & Dynamic Island updates (iOS 16.2+)

## Requirements

- iOS 16.0+
- React Native 0.74+
- Xcode 15+

## Installation

```sh
npm install react-native-ios-intents react-native-nitro-modules
cd ios && pod install
```

## Setup

### 1. Generate Configuration

```bash
npx react-native-ios-intents generate
```

### 2. Define Shortcuts

Edit `intents.config.ts`:

```typescript
import type { IntentsConfig } from 'react-native-ios-intents';

const config: IntentsConfig = {
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
   - Select your target → **Signing & Capabilities** → **"+ Capability"** → **Siri**

2. **App Groups** (Required)
   - **"+ Capability"** → **App Groups** → click **"+"** to add a new group
   - Use format: `group.{your.bundle.id}` (e.g., `group.com.myapp`)
   - The library automatically uses `group.{bundleId}` — ensure it matches

3. **Add Generated Swift Files**
   - Locate `ios/{YourApp}/GeneratedAppIntents.swift`
   - Drag it into your Xcode project, **uncheck** "Copy items if needed"
   - Ensure your app target is selected

See the [iOS Setup Guide](./docs/setup.md) for more details.

### 4. Regenerate & Build

After editing your config, regenerate the Swift code and build:

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
        // Handle state-based confirmations with userConfirmed
        if (shortcut.userConfirmed) {
          // User confirmed to override existing timer
          stopCurrentTimer();
          startNewTimer();
          respond({ message: "New timer started!" });
        } else {
          // Normal start
          startTimer();
          respond({ message: "Timer started!" });
        }
      }
    });

    return () => subscription.remove();
  }, []);

  return <YourApp />;
}
```

Now say **"Hey Siri, start timer in [Your App Name]"** and Siri will respond with your message!

## Example App

The `example/` directory contains a complete timer app demonstrating Siri Shortcuts with parameters, state dialogs, and Live Activities.

```bash
npm install
cd example && npm install && cd ios && pod install && cd ../..
npm run nitrogen
npm run generate-shortcuts:example
npm run example ios
```

## API Reference

### `SiriShortcuts.addEventListener<T>(event, listener)`

Listen for Siri shortcut invocations with optional type safety.

```typescript
// Basic usage (default types)
const subscription = SiriShortcuts.addEventListener('shortcut', (shortcut, respond) => {
  // shortcut.identifier is string
  // shortcut.parameters is Record<string, any>
  // shortcut.userConfirmed is boolean | undefined
});

// Type-safe usage with generated types (recommended)
import type { ShortcutInvocation } from './shortcuts.generated';

const subscription = SiriShortcuts.addEventListener<ShortcutInvocation>('shortcut', (shortcut, respond) => {
  // TypeScript knows exact shortcut identifiers: 'startTimer' | 'stopTimer' | ...

  if (shortcut.identifier === 'addTask') {
    // TypeScript knows shortcut.parameters.taskName exists and is a string
    console.log(shortcut.parameters.taskName);
  }

  // Check if user confirmed a state dialog
  if (shortcut.userConfirmed === true) {
    // User confirmed an override dialog
  } else if (shortcut.userConfirmed === false) {
    // User cancelled (though handler typically won't receive this)
  } else {
    // No confirmation dialog was shown
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

### `LiveActivities`

```typescript
import { LiveActivities } from 'react-native-ios-intents';

// Start — returns an activity ID
const id = LiveActivities.startActivity('timerActivity', { taskName: 'Work' }, { timerStart: new Date(), isRunning: true });

// Update content state
LiveActivities.updateActivity(id, 'timerActivity', { isRunning: false });

// End
LiveActivities.endActivity(id, 'timerActivity');

// Get running activities (useful for cleanup on app restart)
const running = LiveActivities.getRunningActivities();
// Returns: { activityId: string, activityType: string }[]

// Listen for button taps on Live Activity
const sub = LiveActivities.addEventListener('button', (action) => {
  console.log(action.identifier); // e.g. 'pauseTimer'
});
sub.remove();
```

See [Live Activities documentation](./docs/live-activities.md) for configuration, layout nodes, and setup details.

## Shortcut Parameters

Capture voice input from users through Siri:

**Supported types:** `string`, `number`, `boolean`, `date`

```typescript
// intents.config.ts
{
  identifier: 'addTask',
  title: 'Add Task',
  phrases: ['Add a task', 'Create a task'],
  parameters: [
    { name: 'taskName', title: 'Task Name', type: 'string', optional: false },
    { name: 'dueDate', title: 'Due Date', type: 'date', optional: true }
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

See [Configuration](./docs/configuration.md) for more options and details.

## Live Activities

Config-driven [Live Activities](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities) for iOS 16.2+. Define your layout in `intents.config.ts` and the library generates SwiftUI views, ActivityAttributes, and the Widget Bundle.

```typescript
const config: IntentsConfig = {
  shortcuts: [...],
  liveActivities: [{
    identifier: 'timerActivity',
    attributes: { taskName: { type: 'string', title: 'Task Name' } },
    contentState: {
      timerStart: { type: 'date', title: 'Timer Start' },
      isRunning: { type: 'boolean', title: 'Running' }
    },
    lockScreenLayout: {
      type: 'hstack',
      children: [
        { type: 'text', value: '${taskName}', font: 'headline' },
        { type: 'spacer' },
        { type: 'timer', timerStartField: 'timerStart', font: 'title', monospacedDigit: true }
      ]
    }
  }]
};
```

See [Live Activities documentation](./docs/live-activities.md) for timer display, interactive buttons, conditional visibility, widget extension setup, and more.

## Documentation

- [iOS Setup Guide](./docs/setup.md) - Detailed setup instructions
- [Configuration](./docs/configuration.md) - Config options and types
- [State Dialogs](./docs/state-dialogs.md) - Smart confirmations and messages
- [Localization](./docs/localization.md) - Multi-language support
- [Live Activities](./docs/live-activities.md) - Full Live Activities guide
- [Testing](./docs/testing.md) - Testing and debugging
- [Architecture](./CONTRIBUTING.md#architecture) - How it works under the hood

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, code generation workflow, and architecture details.

## Known Issues

### State Dialog API Uses Deprecated Confirmation Method

The current state dialog feature with `requiresConfirmation: true` uses `requestConfirmation(result:)` which is deprecated in iOS 16+. The code works but shows compiler warnings.

**TODO:** Update to modern App Intents confirmation flow using:

- `@Parameter` for confirmation values
- Proper `IntentConfirmation` structure

See: [Apple App Intents Documentation - Confirmation](https://developer.apple.com/documentation/appintents/dynamicoptionsprovider)

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
