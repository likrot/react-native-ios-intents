# iOS Setup

This guide covers the detailed iOS setup required for react-native-ios-intents.

## Prerequisites

- **iOS 16.0+** (required for App Intents)
- React Native 0.74+
- Xcode 15+

## Step-by-Step Setup

### 1. Install Pods

```bash
cd ios && pod install
```

### 2. Configure App Groups

App Intents run in a separate process and need App Groups to communicate with your main app.

In Xcode:
1. Select your target → Signing & Capabilities
2. Click "+ Capability"
3. Add "App Groups"
4. Create a group with format: `group.<your-bundle-identifier>`
   - Example: if your bundle ID is `com.myapp`, use `group.com.myapp`

### 3. Enable Siri

In Xcode:
1. Select your target → Signing & Capabilities
2. Click "+ Capability"
3. Add "Siri"

### 4. Generate Shortcuts Configuration

Run the code generator to create a config template:

```bash
npx react-native-ios-intents generate
```

This creates `shortcuts.config.ts` in your project root with an example shortcut.

### 5. Configure Your Shortcuts

Edit `shortcuts.config.ts` to define your app's shortcuts. See [Configuration](./configuration.md) for details.

### 6. Generate Swift App Intents

Run the generator again to create Swift code:

```bash
npx react-native-ios-intents generate
```

This creates `ios/<YourApp>/GeneratedAppIntents.swift` with Swift App Intent implementations.

### 7. Add Generated File to Xcode

In Xcode:
1. Right-click your app folder (e.g., `YourApp/`) in the project navigator
2. Select "Add Files to..."
3. Choose `GeneratedAppIntents.swift`
4. Make sure "Copy items if needed" is **unchecked**
5. Make sure your app target is selected

### 8. Rebuild Your App

```bash
cd ios && pod install
npx react-native run-ios
```

That's it! Your shortcuts are now available to Siri.

## Custom App Group ID

By default, the library uses `group.<bundle-identifier>`. To specify a custom App Group:

```typescript
const config: ShortcutsConfig = {
  appGroupId: 'group.com.mycompany.myapp',
  shortcuts: [
    // ...
  ]
};
```

Make sure the App Group ID matches what you configured in Xcode capabilities.
