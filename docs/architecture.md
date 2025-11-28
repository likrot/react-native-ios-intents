# Architecture

## Overview

The library generates static Swift App Intents from your TypeScript configuration:

```
Developer: shortcuts.config.ts → CLI generates Swift file
                                          ↓
                         GeneratedAppIntents.swift (in your app)
                                          ↓
User: "Hey Siri, start timer in [App]" → App Intent executes
                                          ↓
                  Writes to App Group + Darwin notification
                         (same for all iOS 16+)
                                          ↓
                         React Native receives command
                                          ↓
                         Your handler processes it
```

## Key Components

### shortcuts.config.ts

TypeScript configuration defining your shortcuts. This is the source of truth.

### GeneratedAppIntents.swift

Auto-generated Swift code with App Intent implementations. Never edit this file directly.

### App Groups

Enables communication between App Intent process and main app. App Intents run in a separate process from your main app.

### Darwin Notifications

Cross-process notifications that wake up the main app when shortcuts run.

### Response Communication

React Native writes responses to shared UserDefaults, which Swift polls for and returns to Siri.

## How It Works

1. **TypeScript Config**: Define shortcuts in `shortcuts.config.ts`
2. **Code Generation**: CLI generates Swift App Intents from config
3. **Build Time**: Xcode compiles generated Swift code into your app
4. **Runtime**: iOS registers shortcuts immediately on app install
5. **Siri Invocation**: User says "Hey Siri, [phrase] in [App Name]"
6. **App Intent Executes**: Generated Swift code runs in separate process
7. **Communication**: Writes command to App Group, sends Darwin notification, app reads command
   - Works the same for all iOS 16+ versions
   - App Groups enable cross-process communication
   - Darwin notifications wake the main app if needed
8. **Your Code**: React Native handler receives and processes command
9. **Response**: Your code calls `respond()` to send feedback to Siri

Works even when the app is completely killed!

## Communication Flow Detail

### Shortcut Invocation

1. User says "Hey Siri, start timer in [App Name]"
2. iOS matches phrase to your App Intent
3. App Intent's `perform()` method executes
4. Intent writes command to shared UserDefaults:
   - `IosIntentsPendingCommand`: shortcut identifier
   - `IosIntentsCommandNonce`: unique ID for this invocation
   - `IosIntentsCommandTimestamp`: when command was issued
5. Intent posts Darwin notification to wake app
6. Intent polls for response with timeout (5 seconds)

### React Native Handling

1. Native module receives Darwin notification
2. Reads command from UserDefaults
3. Calls your JavaScript listener with shortcut data
4. You process the command and call `respond()`
5. Response is written to UserDefaults with nonce key
6. Swift Intent receives response and returns to Siri

### State Synchronization

```typescript
// React Native
SiriShortcuts.updateAppState({ timerRunning: true });
```

Writes to UserDefaults as `appState_timerRunning = 1`

```swift
// Swift App Intent
if defaults.double(forKey: "appState_timerRunning") == 1 {
    // Show confirmation dialog
}
```

This allows App Intents to make decisions based on current app state without needing to launch the full app.
