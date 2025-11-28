# Localization

Enable localization to translate your Siri shortcuts into multiple languages.

## Enabling Localization

```typescript
const config: ShortcutsConfig = {
  localization: true,  // Enable localization support
  shortcuts: [
    {
      identifier: 'startTimer',
      title: 'Start Timer',
      phrases: ['Start timer', 'Begin tracking'],
      description: 'Starts a new timer',
      stateDialogs: [
        {
          stateKey: 'timerRunning',
          showWhen: true,
          message: 'Timer is already running. Do you want to start a new one?',
          requiresConfirmation: true
        }
      ]
    }
  ]
};
```

## Generated Files

When `localization: true`, the generator creates:

- `GeneratedAppIntents.swift` - Using `String(localized:)` for titles, descriptions, and dialogs
- `Localizable.xcstrings` - String Catalog for titles, descriptions, and dialog messages
- `AppShortcuts.strings` - Localization file for Siri phrases (iOS 16+ compatible)

## Adding Localization Files to Xcode

After running `npx react-native-ios-intents generate`:

1. In Xcode, right-click your app folder in the project navigator
2. Select **"Add Files to..."**
3. Choose both `Localizable.xcstrings` and `AppShortcuts.strings`
4. **Uncheck** "Copy items if needed" (files are already in place)
5. Make sure your app target is selected
6. Click **Add**

## Adding Translations

### For Localizable.xcstrings (titles, descriptions, dialogs)

1. Select `Localizable.xcstrings` in Xcode
2. Click **+** in the language sidebar to add a language (e.g., Spanish)
3. Click each key and add the translation in the right panel

Or use **Editor → Export Localizations** to generate XLIFF files for translators.

### For AppShortcuts.strings (Siri phrases)

1. Select `AppShortcuts.strings` in Xcode
2. In File Inspector (right panel), click **Localize...**
3. Check the language you want to add (e.g., Spanish)
4. Xcode creates `es.lproj/AppShortcuts.strings`
5. Edit it with translations:

```
"Start timer in ${applicationName}" = "Iniciar temporizador en ${applicationName}";
"Begin tracking in ${applicationName}" = "Comenzar seguimiento en ${applicationName}";
"Stop timer in ${applicationName}" = "Detener temporizador en ${applicationName}";
```

> **Important:** Always include `${applicationName}` in every phrase translation.

## Translation Keys

The generator creates keys in `Localizable.xcstrings`:

```
startTimer.title → "Start Timer"
startTimer.description → "Starts a new timer"
startTimer.stateDialogs.0.message → "Timer is already running..."
system.error.appGroupFailed → "Failed to communicate with app"
system.timeout → "Done"
```

Phrase keys in `AppShortcuts.strings` use the actual phrase text:

```
"Start timer in ${applicationName}" = "Start timer in ${applicationName}";
"Begin tracking in ${applicationName}" = "Begin tracking in ${applicationName}";
```

> **Note:** Without localization enabled, all strings are hardcoded directly in Swift for simpler setup.
