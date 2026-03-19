# Live Activities

Config-driven [Live Activities](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities) support for iOS 16.2+. Define your Live Activity layout in `intents.config.ts` and the library generates all the Swift code — [ActivityAttributes](https://developer.apple.com/documentation/activitykit/activityattributes), SwiftUI views for the [Lock Screen](https://developer.apple.com/design/human-interface-guidelines/live-activities#Lock-Screen) and [Dynamic Island](https://developer.apple.com/design/human-interface-guidelines/live-activities#Dynamic-Island), and the Widget Bundle.

> **Prerequisites:** Requires iOS 16.2+ and a [Widget Extension target](https://developer.apple.com/documentation/widgetkit/creating-a-widget-extension) in your Xcode project. See Apple's [ActivityKit guide](https://developer.apple.com/documentation/activitykit) for background on how Live Activities work.

## Configuration

Each Live Activity definition has:

- **`attributes`** — Static data set once when the activity starts (e.g., task name)
- **`contentState`** — Dynamic data updated while the activity is running (e.g., elapsed time)
- **`lockScreenLayout`** — Required SwiftUI layout for the Lock Screen presentation
- **`dynamicIslandCompact`** / **`dynamicIslandExpanded`** — Optional [Dynamic Island](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities#Display-an-activity-in-the-Dynamic-Island) presentations

**Supported field types:** `string`, `number`, `boolean`, `date`

### Full Configuration Example

```typescript
import type { IntentsConfig } from 'react-native-ios-intents';

const config: IntentsConfig = {
  shortcuts: [...],
  liveActivities: [{
    identifier: 'timerActivity',
    attributes: {
      taskName: { type: 'string', title: 'Task Name' }
    },
    contentState: {
      timerStart: { type: 'date', title: 'Timer Start' },
      isRunning: { type: 'boolean', title: 'Running' }
    },
    lockScreenLayout: {
      type: 'hstack',
      children: [
        { type: 'text', value: '${taskName}', font: 'headline' },
        { type: 'spacer' },
        { type: 'timer', timerStartField: 'timerStart', font: 'title', monospacedDigit: true },
        {
          type: 'hstack', spacing: 8,
          children: [
            { type: 'button', shortcutIdentifier: 'pauseTimer', title: 'Pause', systemImage: 'pause.fill' },
            { type: 'button', shortcutIdentifier: 'resumeTimer', title: 'Resume', systemImage: 'play.fill' }
          ]
        }
      ]
    }
  }]
};
```

## Layout Node Types

| Node | Description | Key properties |
|------|-------------|----------------|
| `text` | Text label, supports `${field}` interpolation | `value`, `font`, `color`, `monospacedDigit` |
| `image` | SF Symbol icon | `systemImage`, `color` |
| `spacer` | Flexible space | — |
| `progress` | Progress bar (0.0–1.0) | `progressField` |
| `timer` | System-rendered timer (`Text(timerInterval:)`) | `timerStartField`, `timerEndField`, `countsDown`, `font` |
| `button` | Interactive button (`Button(intent:)`) | `shortcutIdentifier`, `title`, `systemImage` |
| `hstack` | Horizontal stack | `alignment`, `spacing`, `children` |
| `vstack` | Vertical stack | `alignment`, `spacing`, `children` |
| `zstack` | Overlay stack | `alignment`, `children` |

**Fonts:** `largeTitle`, `title`, `title2`, `title3`, `headline`, `body`, `caption`, `caption2`
**Colors:** `primary`, `secondary`, `red`, `green`, `blue`, `orange`, `white`

## Timer Display

The `timer` node generates `Text(timerInterval:countsDown:)` — a system-rendered timer that counts automatically, works when the app is killed, and animates smoothly. No polling from JavaScript needed.

| Property | Type | Description |
|----------|------|-------------|
| `timerStartField` | `string` | **Required.** contentState field name holding the start Date (Unix timestamp) |
| `timerEndField` | `string` | Optional. contentState field name holding the end Date. If omitted, counts up indefinitely |
| `countsDown` | `boolean` | Count direction. Default: `false` (counts up) |
| `font`, `color`, `monospacedDigit` | — | Same modifiers as `text` nodes |

## Interactive Buttons

The `button` node generates `Button(intent:)` with a `LiveActivityIntent` that runs in the background. This enables pause/resume/stop directly from the Lock Screen or Dynamic Island.

| Property | Type | Description |
|----------|------|-------------|
| `shortcutIdentifier` | `string` | **Required.** Identifier for the button action (generates `LA_<PascalCase>Intent`) |
| `title` | `string` | Button label text |
| `systemImage` | `string` | Optional SF Symbol. When set, renders as `Label(title, systemImage:)` |

Buttons use `LiveActivityIntent` — they execute in the main app's background process without foregrounding the app.

## staleDate

Pass a `staleDate` to signal when the Live Activity data becomes outdated. The system dims the activity after this date.

```typescript
import { LiveActivities } from 'react-native-ios-intents';

const staleDate = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
const id = LiveActivities.startActivity('timerActivity', { taskName: 'Work' }, { timerStart: new Date() }, staleDate);
LiveActivities.updateActivity(id, 'timerActivity', { timerStart: new Date() }, staleDate);
```

## Behavior When App Is Killed

- **Timer** keeps counting (system-rendered via `Text(timerInterval:)`)
- **Buttons** use LiveActivityIntent (runs in background without foregrounding)
- **Other fields** freeze at their last value
- Use `staleDate` to signal when data is outdated

> **Push Token Updates (Coming Soon):** Server-driven updates via APNs push tokens are planned for a future release.

## JS API

```typescript
import { LiveActivities } from 'react-native-ios-intents';

// Start — returns an activity ID (system-rendered timer, no polling needed)
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
  // Handle the action...
});
sub.remove(); // cleanup
```

## Widget Extension Setup

After running `npx react-native-ios-intents generate`:

1. Add a Widget Extension target in Xcode (File → New → Target → Widget Extension)
2. Copy `GeneratedLiveActivity.swift` to your Widget Extension target directory, or set `widgetExtensionTarget` in your config to automate this:

   ```typescript
   const config: IntentsConfig = {
     widgetExtensionTarget: 'MyWidgetExtension', // auto-copies on generate
     // ...
   };
   ```

3. Add App Group entitlement matching your main app
4. Add `NSSupportsLiveActivities = YES` to your app's `Info.plist`

> **Dual-target files:** `GeneratedLiveActivity.swift` goes in the Widget Extension target. If your Live Activity has interactive buttons, `GeneratedAppIntents.swift` will also contain `LA_*` prefixed `LiveActivityIntent` stubs that are automatically included in the main app target — no extra step needed.

> See Apple's [Displaying live data with Live Activities](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities) for more details on Widget Extension setup.

## Conditional Visibility (`showWhen`)

Show or hide layout elements based on contentState values at runtime:

```typescript
lockScreenLayout: {
  type: 'hstack',
  children: [
    { type: 'button', shortcutIdentifier: 'stopTimer', title: 'Pause',
      showWhen: { field: 'isRunning', equals: true } },
    { type: 'button', shortcutIdentifier: 'startTimer', title: 'Resume',
      showWhen: { field: 'isRunning', equals: false } },
  ]
}
```

Control visibility from JavaScript by updating contentState:

```typescript
// Show "Pause", hide "Resume"
LiveActivities.updateActivity(id, 'timerActivity', { isRunning: true });

// Switch: hide "Pause", show "Resume"
LiveActivities.updateActivity(id, 'timerActivity', { isRunning: false });
```

## Existing Widget Extension?

If your app already has a Widget Extension with its own `@main` WidgetBundle, set `liveActivityWidgetBundle: false` to prevent conflicts:

```typescript
const config: IntentsConfig = {
  shortcuts: [...],
  liveActivityWidgetBundle: false, // Don't generate @main WidgetBundle
  liveActivities: [...]
};
```

Then add `LiveActivityWidget` to your existing WidgetBundle:

```swift
@main struct MyWidgetBundle: WidgetBundle {
    var body: some Widget {
        MyExistingWidget()
        LiveActivityWidget()  // Add generated widget here
    }
}
```
