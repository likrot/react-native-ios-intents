# State-Based Dialogs

Show context-aware messages or confirmations to users based on your app's current state. This feature allows Siri to ask for confirmation before executing actions or simply inform users about incompatible states.

## Basic Setup

### 1. Sync App State from React Native

```typescript
import { SiriShortcuts } from 'react-native-ios-intents';
import type { ShortcutInvocation } from './shortcuts.generated';

// Whenever your app state changes, sync it
SiriShortcuts.updateAppState({
  timerRunning: true,
  taskName: 'Work',
  elapsedTime: 3600
});
```

### 2. Configure State Dialogs in Your Shortcuts

```typescript
const config: ShortcutsConfig = {
  shortcuts: [
    {
      identifier: 'startTimer',
      title: 'Start Timer',
      phrases: ['Start timer'],
      stateDialogs: [
        {
          stateKey: 'timerRunning',
          showWhen: true,
          message: 'Timer is already running. Do you want to start a new one?',
          requiresConfirmation: true  // User must confirm to continue
        }
      ]
    },
    {
      identifier: 'stopTimer',
      title: 'Stop Timer',
      phrases: ['Stop timer'],
      stateDialogs: [
        {
          stateKey: 'timerRunning',
          showWhen: false,
          message: 'Timer is not running.',
          requiresConfirmation: false  // Just show message and return
        }
      ]
    }
  ]
};
```

## How It Works

### With `requiresConfirmation: true` (default)

- Siri shows the message and asks user to confirm or cancel
- If user **confirms**, shortcut continues to React Native handler
- If user **cancels**, shortcut is aborted (React Native not invoked)
- Your handler receives the shortcut invocation as normal

**Current Limitation:** The confirmation status (`userConfirmed`) is not yet passed to JavaScript. Your handler cannot distinguish between "user confirmed override" vs "no dialog shown". This will be implemented in a future version.

### With `requiresConfirmation: false`

- Siri just shows the informational message
- Shortcut returns immediately with the message
- **React Native is NOT invoked** - saves unnecessary processing
- Use this for "incompatible state" messages that don't need action

## Example: Timer Override Confirmation

```typescript
// shortcuts.config.ts
stateDialogs: [
  {
    stateKey: 'timerRunning',
    showWhen: true,
    message: 'Timer "${taskName}" is already running. Do you want to start a new one?',
    requiresConfirmation: true
  }
]

// App.tsx
import type { ShortcutInvocation } from './shortcuts.generated';

SiriShortcuts.updateAppState({
  timerRunning: true,
  taskName: 'Work'  // This will replace ${taskName} in the message
});

// Use generic type for autocomplete
const subscription = SiriShortcuts.addEventListener<ShortcutInvocation>('shortcut', (shortcut, respond) => {
  if (shortcut.identifier === 'startTimer') {
    // Note: userConfirmed is available as shortcut.userConfirmed
    // It indicates whether user confirmed a state dialog

    // Check current state to determine action
    const currentState = getCurrentAppState(); // Your state management

    if (currentState.timerRunning) {
      // A timer is running - user must have confirmed to get here
      stopCurrentTimer();
      startNewTimer();
      respond({ message: "Started new timer!" });
    } else {
      // No timer running - no dialog was shown
      startNewTimer();
      respond({ message: "Timer started!" });
    }
  }
});
```

**Result:** When timer is running and user says "Hey Siri, start timer in [App Name]", Siri will say: *"Timer 'Work' is already running. Do you want to start a new one?"*

## Simple Informational Message

```typescript
stateDialogs: [
  {
    stateKey: 'timerRunning',
    showWhen: false,
    message: 'Timer is not running.',
    requiresConfirmation: false  // Just inform, don't ask
  }
]

// Result: If timer not running, Siri says "Timer is not running" and stops.
// Your React Native code never executes.
```

## Dynamic Message Interpolation

State dialog messages support dynamic variable interpolation using `${variableName}` syntax:

```typescript
// shortcuts.config.ts
stateDialogs: [
  {
    stateKey: 'timerRunning',
    showWhen: true,
    message: 'Timer "${taskName}" has been running for ${elapsedMinutes} minutes. Start a new one?',
    requiresConfirmation: true
  }
]

// App.tsx
SiriShortcuts.updateAppState({
  timerRunning: true,
  taskName: 'Deep Work',
  elapsedMinutes: 25
});
```

**Result:** Siri says: *"Timer 'Deep Work' has been running for 25 minutes. Start a new one?"*

### How Interpolation Works

- The generator extracts all `${variableName}` placeholders from your message
- Swift reads corresponding values from UserDefaults (`appState_variableName`)
- Placeholders are replaced with actual values at runtime
- Supports strings and numbers
- If a variable isn't found, the placeholder remains unchanged

## Current Limitations & Future Plans

### User Confirmation Detection

```typescript
import type { ShortcutInvocation } from './shortcuts.generated';

const subscription = SiriShortcuts.addEventListener<ShortcutInvocation>('shortcut', (shortcut, respond) => {
  // Check if user confirmed a state dialog
  if (shortcut.userConfirmed === true) {
    // User explicitly confirmed an override
    console.log('User confirmed');
  } else if (shortcut.userConfirmed === false) {
    // User cancelled (though handler shouldn't receive this)
    console.log('User cancelled');
  } else {
    // No dialog was shown (userConfirmed is undefined)
    console.log('No confirmation needed');
  }
});
```

### What Works Now

✅ State synchronization (`updateAppState`)
✅ State-based dialog display
✅ User confirmation dialogs (Swift side)
✅ Message-only dialogs (`requiresConfirmation: false`)
✅ Dynamic message interpolation (`${variableName}`)
✅ Preventing React Native invocation for message-only dialogs

The feature is functional for most use cases - you just need to re-check app state in your handler rather than relying on a `userConfirmed` flag.
