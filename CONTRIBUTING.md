# Contributing

Contributions are always welcome, no matter how large or small!

We want this community to be friendly and respectful to each other. Please follow it in all your interactions with the project. Before contributing, please read the [code of conduct](./CODE_OF_CONDUCT.md).

## Development workflow

The project contains:

- The library package in the root directory.
- An example app in the `example/` directory.

To get started, make sure you have the correct version of [Node.js](https://nodejs.org/) installed. See the [`.nvmrc`](./.nvmrc) file for the version used in this project.

Install dependencies:

```sh
npm install
```

This project uses [Nitro Modules](https://nitro.margelo.com/). You need to run Nitrogen once on first setup (the generated files are not committed to the repository):

```sh
npm run nitrogen
```

The [example app](/example/) demonstrates usage of the library. It is configured to use the local version of the library, so any changes you make to the library's source code will be reflected in the example app. Changes to the library's JavaScript code will be reflected without a rebuild, but native code changes will require a rebuild.

To edit native Swift files in Xcode, open `example/ios/IosIntentsExample.xcworkspace` and find the source files at `Pods > Development Pods > react-native-ios-intents`.

### Code generation

The library generates Swift code from `intents.config.ts`. During development, you'll work with the example app config.

**After modifying code generation logic** (`src/cli/` files), compile the CLI and regenerate:

```sh
npm run build:cli                    # Compile TS → JS (src/cli/ → scripts/cli/)
npm run generate-shortcuts:example   # Generate Swift from example/intents.config.ts
```

**After modifying `*.nitro.ts` files** (native bridge interfaces):

```sh
npm run nitrogen
```

> You only need to run `nitrogen` when changing the bridge interfaces (`*.nitro.ts` files). For most development work — code generation logic, JS API, tests — it's not needed.

There are two code generation scripts — keep them in sync when making changes:

- `npm run generate-shortcuts:example` — **Use this during development** (reads from `example/intents.config.ts`)
- `npm run generate-shortcuts` — Library dev mode (reads from `lib/module/`, requires `bob build` first)

### Running the example app

```sh
npm run example start   # Start Metro bundler
npm run example ios     # Run on iOS simulator
```

### Verification

```sh
npm run typecheck       # Type-check with TypeScript
npm run lint            # Lint with ESLint
npm run lint --fix      # Auto-fix lint errors
npm test                # Run unit tests with Jest
```

Remember to add tests for your change if possible.

### Commit message convention

We follow the [conventional commits specification](https://www.conventionalcommits.org/en) for our commit messages:

- `fix`: bug fixes, e.g. fix crash due to deprecated method.
- `feat`: new features, e.g. add new method to the module.
- `refactor`: code refactor, e.g. migrate from class components to hooks.
- `docs`: changes into documentation, e.g. add usage example for the module.
- `test`: adding or updating tests, e.g. add integration tests using detox.
- `chore`: tooling changes, e.g. change CI config.

Our pre-commit hooks verify that your commit message matches this format when committing.

### Publishing to npm

We use [release-it](https://github.com/release-it/release-it) to make it easier to publish new versions. It handles common tasks like bumping version based on semver, creating tags and releases etc.

To publish new versions, run the following:

```sh
npm run release
```

### Scripts

| Script | Description |
|--------|-------------|
| `npm install` | Install dependencies |
| `npm run nitrogen` | Generate Nitro bridge code (only after modifying `*.nitro.ts`) |
| `npm run build:cli` | Compile CLI TypeScript to JavaScript (`src/cli/` → `scripts/cli/`) |
| `npm run generate-shortcuts:example` | Generate Swift from example config (use during development) |
| `npm run generate-shortcuts` | Generate Swift in library dev mode (requires `bob build`) |
| `npm run typecheck` | Type-check with TypeScript |
| `npm run lint` | Lint with ESLint |
| `npm test` | Run unit tests with Jest |
| `npm run example start` | Start Metro bundler for example app |
| `npm run example ios` | Run example app on iOS |

## Architecture

### Overview

The library generates static Swift App Intents from your TypeScript configuration:

```
Developer: intents.config.ts → CLI generates Swift file
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

### Key Components

- **intents.config.ts** — TypeScript configuration defining your shortcuts. This is the source of truth.
- **GeneratedAppIntents.swift** — Auto-generated Swift code with App Intent implementations. Never edit this file directly.
- **App Groups** — Enables communication between App Intent process and main app. App Intents run in a separate process from your main app.
- **Darwin Notifications** — Cross-process notifications that wake up the main app when shortcuts run.
- **Response Communication** — React Native writes responses to shared UserDefaults, which Swift polls for and returns to Siri.

### How It Works

1. **TypeScript Config**: Define shortcuts in `intents.config.ts`
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

### Communication Flow Detail

#### Shortcut Invocation

1. User says "Hey Siri, start timer in [App Name]"
2. iOS matches phrase to your App Intent
3. App Intent's `perform()` method executes
4. Intent writes command to shared UserDefaults:
   - `IosIntentsPendingCommand`: shortcut identifier
   - `IosIntentsCommandNonce`: unique ID for this invocation
   - `IosIntentsCommandTimestamp`: when command was issued
5. Intent posts Darwin notification to wake app
6. Intent polls for response with timeout (5 seconds)

#### React Native Handling

1. Native module receives Darwin notification
2. Reads command from UserDefaults
3. Calls your JavaScript listener with shortcut data
4. You process the command and call `respond()`
5. Response is written to UserDefaults with nonce key
6. Swift Intent receives response and returns to Siri

#### State Synchronization

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

#### Future: IPC Alternatives

> **Status:** Low priority — current approach works fine.

Darwin notifications could be replaced with **UserDefaults KVO** (Key-Value Observing):

- Cross-process KVO on shared `UserDefaults(suiteName:)` works since iOS 9.3
- The UserDefaults write itself becomes the signal — no explicit notification posting needed
- Would eliminate ~35 lines of `CFNotificationCenter` C-bridging code from `ios/IosIntents.swift`
- Would remove Darwin notification posting from generated Swift (in `swift-codegen.ts` and `liveactivity-codegen.ts`)
- Same capabilities and limitations as Darwin — neither wakes killed apps (that's handled by `openAppWhenRun` / `LiveActivityIntent` protocol)
- **Risk:** Cross-process KVO ordering is not guaranteed; mitigated by writing the trigger key last

## Sending a pull request

> **Working on your first pull request?** You can learn how from this _free_ series: [How to Contribute to an Open Source Project on GitHub](https://app.egghead.io/playlists/how-to-contribute-to-an-open-source-project-on-github).

When you're sending a pull request:

- Prefer small pull requests focused on one change.
- Verify that linters and tests are passing.
- Review the documentation to make sure it looks good.
- Follow the pull request template when opening a pull request.
- For pull requests that change the API or implementation, discuss with maintainers first by opening an issue.
