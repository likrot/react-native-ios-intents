# Testing

## Development Testing

1. **Build and run** your app
2. **Open Shortcuts app** on your device/simulator
3. **Find your shortcuts** - they should appear under "App Shortcuts"
4. **Say "Hey Siri, [phrase] in [App Name]"** to test voice invocation
5. **Check console logs** to see handling

## Testing When App is Killed

1. **Completely close your app** (swipe up in app switcher)
2. **Say "Hey Siri, start timer in [App Name]"**
3. **App should open** and handle the command
4. **Check logs** for handling

## Debugging

Enable verbose logging to see App Intent execution:

```bash
# View system logs
xcrun simctl spawn booted log stream --predicate 'processImagePath contains "YourApp"' --level debug
```

Look for messages from your generated App Intents (e.g., `[StartTimerIntent]`).

## Common Issues

### Shortcuts Not Appearing

- Make sure you added `GeneratedAppIntents.swift` to your Xcode project
- Verify App Groups capability is enabled
- Rebuild and reinstall the app

### App Group Communication Failing

- Check that App Group ID matches in Xcode capabilities and your config
- Format should be `group.<bundle-identifier>`
- Your main app and App Intents must use the same App Group ID
  - App Intents run in a separate process but are part of your app bundle
  - They communicate via shared UserDefaults (App Groups)

### Siri Not Recognizing Phrases

- Phrases must include the app name (library adds this automatically)
- Try exact phrases defined in your config
- Restart Siri: Settings → Siri & Search → toggle off/on

### Timeout Errors

- Ensure your handler calls `respond()` within 5 seconds
- Check that native module is properly linked
- Verify Darwin notifications are being received

## Running the Example App

1. **Install dependencies:**
   ```bash
   npm install
   cd example && npm install
   cd ios && pod install && cd ../..
   ```

2. **Generate Nitro bindings:**
   ```bash
   npm run prepare
   ```

3. **Generate shortcuts for the example:**
   ```bash
   npm run generate-shortcuts:example
   ```

4. **Run the example:**
   ```bash
   npm run example ios
   ```

The example app includes two shortcuts: "Start Timer" and "Stop Timer". After building, try saying "Hey Siri, start timer in IosIntentsExample" to test!
