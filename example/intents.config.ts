import type { IntentsConfig } from 'react-native-ios-intents';

/**
 * Intents Configuration
 *
 * Define your app's Siri shortcuts and Live Activities here.
 * This file is used to generate Swift code at build time.
 *
 * After modifying this file, run: npm run generate-shortcuts
 */
const config: IntentsConfig = {
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

  // Auto-copy GeneratedLiveActivity.swift to Widget Extension target
  widgetExtensionTarget: 'LiveActivityWidget',

  // Live Activities (iOS 16.1+)
  liveActivities: [
    {
      identifier: 'timerActivity',
      attributes: {
        taskName: { type: 'string', title: 'Task Name' },
      },
      contentState: {
        timerStart: { type: 'date', title: 'Timer Start' },
        isRunning: { type: 'boolean', title: 'Running' },
        elapsedDisplay: { type: 'string', title: 'Elapsed Display' },
      },
      lockScreenLayout: {
        type: 'hstack',
        children: [
          {
            type: 'vstack',
            alignment: 'leading',
            children: [
              { type: 'text', value: '${taskName}', font: 'headline' },
              {
                type: 'text',
                value: 'Running',
                font: 'caption',
                color: 'secondary',
                showWhen: { field: 'isRunning', equals: true },
              },
              {
                type: 'text',
                value: 'Paused',
                font: 'caption',
                color: 'secondary',
                showWhen: { field: 'isRunning', equals: false },
              },
            ],
          },
          {
            type: 'timer',
            timerStartField: 'timerStart',
            font: 'title',
            monospacedDigit: true,
            showWhen: { field: 'isRunning', equals: true },
          },
          {
            type: 'text',
            value: '${elapsedDisplay}',
            font: 'title',
            monospacedDigit: true,
            showWhen: { field: 'isRunning', equals: false },
          },
          { type: 'spacer' },
          {
            type: 'hstack',
            spacing: 8,
            children: [
              {
                type: 'button',
                shortcutIdentifier: 'pauseTimer',
                title: 'Pause',
                systemImage: 'pause.fill',
                showWhen: { field: 'isRunning', equals: true },
              },
              {
                type: 'button',
                shortcutIdentifier: 'resumeTimer',
                title: 'Resume',
                systemImage: 'play.fill',
                showWhen: { field: 'isRunning', equals: false },
              },
            ],
          },
        ],
      },
      dynamicIslandCompact: {
        leading: { type: 'text', value: '${taskName}', font: 'caption' },
        trailing: {
          type: 'vstack',
          children: [
            {
              type: 'timer',
              timerStartField: 'timerStart',
              font: 'caption',
              monospacedDigit: true,
              showWhen: { field: 'isRunning', equals: true },
            },
            {
              type: 'text',
              value: '${elapsedDisplay}',
              font: 'caption',
              monospacedDigit: true,
              showWhen: { field: 'isRunning', equals: false },
            },
          ],
        },
      },
      dynamicIslandExpanded: {
        leading: { type: 'text', value: '${taskName}', font: 'headline' },
        trailing: {
          type: 'vstack',
          children: [
            {
              type: 'timer',
              timerStartField: 'timerStart',
              font: 'title',
              monospacedDigit: true,
              showWhen: { field: 'isRunning', equals: true },
            },
            {
              type: 'text',
              value: '${elapsedDisplay}',
              font: 'title',
              monospacedDigit: true,
              showWhen: { field: 'isRunning', equals: false },
            },
          ],
        },
        bottom: {
          type: 'hstack',
          spacing: 12,
          children: [
            {
              type: 'button',
              shortcutIdentifier: 'pauseTimer',
              title: 'Pause',
              systemImage: 'pause.fill',
              showWhen: { field: 'isRunning', equals: true },
            },
            {
              type: 'button',
              shortcutIdentifier: 'resumeTimer',
              title: 'Resume',
              systemImage: 'play.fill',
              showWhen: { field: 'isRunning', equals: false },
            },
          ],
        },
      },
    },
  ],
};

export default config;
