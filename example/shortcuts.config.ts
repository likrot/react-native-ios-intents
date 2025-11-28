import type { ShortcutsConfig } from 'react-native-ios-intents';

/**
 * Siri Shortcuts Configuration
 *
 * Define your app's shortcuts here. This file is used to generate Swift AppIntent
 * code at build time, so shortcuts can be immediately available to Siri.
 *
 * After modifying this file, run: npm run generate-shortcuts
 */
const config: ShortcutsConfig = {
  // Enable localization support for translations
  localization: true,

  shortcuts: [
    {
      identifier: 'startTimer',
      title: 'Start Timer',
      phrases: ['Start timer', 'Begin tracking', 'Start the timer', 'Start task'],
      systemImageName: 'play.circle',
      description: 'Starts a new timer',
      stateDialogs: [
        {
          stateKey: 'timerRunning',
          showWhen: true,
          // Dynamic message with interpolation - ${taskName} will be replaced at runtime
          message: 'Timer "${taskName}" is already running. Do you want to start a new one?',
          requiresConfirmation: true, // User must confirm to continue
        },
      ],
    },
    {
      identifier: 'stopTimer',
      title: 'Stop Timer',
      phrases: ['Stop timer', 'End tracking', 'Stop the timer', 'Stop task'],
      systemImageName: 'stop.circle',
      description: 'Stops the current timer',
      stateDialogs: [
        {
          stateKey: 'timerRunning',
          showWhen: false,
          message: 'Timer is not running.',
          requiresConfirmation: false, // Just show message and return
        },
      ],
    },
    {
      identifier: 'addTask',
      title: 'Add Task',
      phrases: ['Add a task', 'Create a task', 'Add todo', 'Create todo'],
      systemImageName: 'plus.circle',
      description: 'Adds a new task to your todo list',
      parameters: [
        {
          name: 'taskName',
          title: 'Task Name',
          type: 'string',
          optional: false,
          description: 'The name of the task to add',
        },
        {
          name: 'dueDate',
          title: 'Due Date',
          type: 'date',
          optional: true,
          description: 'Optional due date for the task',
        },
      ],
    },
  ],
};

export default config;
