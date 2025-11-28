import type { ShortcutsConfig } from '../../../types';

/**
 * Mock shortcuts configuration for testing
 * Includes various features: state dialogs, descriptions, multiple phrases
 */
export const mockShortcutsConfig: ShortcutsConfig = {
  shortcuts: [
    {
      identifier: 'startTimer',
      title: 'Start Timer',
      description: 'Start a new timer session',
      phrases: [
        'Start timer',
        'Begin timer',
        'Start tracking time',
      ],
      systemImageName: 'timer',
      stateDialogs: [
        {
          stateKey: 'timerRunning',
          showWhen: true,
          message: 'Timer is already running. Stop it first?',
          requiresConfirmation: true,
        },
      ],
    },
    {
      identifier: 'stopTimer',
      title: 'Stop Timer',
      description: 'Stop the current timer',
      phrases: [
        'Stop timer',
        'End timer',
        'Finish timing',
      ],
      systemImageName: 'stop.circle',
      stateDialogs: [
        {
          stateKey: 'timerRunning',
          showWhen: false,
          message: 'No timer is running',
          requiresConfirmation: false,
        },
      ],
    },
    {
      identifier: 'pauseTimer',
      title: 'Pause Timer',
      phrases: ['Pause timer', 'Hold timer'],
      systemImageName: 'pause.circle',
    },
    {
      identifier: 'checkStatus',
      title: 'Check Timer Status',
      description: 'Check current timer status with interpolation',
      phrases: ['Check timer', 'Timer status'],
      stateDialogs: [
        {
          stateKey: 'timerRunning',
          showWhen: true,
          message: 'Timer ${taskName} has been running for ${elapsedTime}',
          requiresConfirmation: false,
        },
      ],
    },
  ],
  appGroupId: 'group.com.example.timer',
  localization: true,
};

/**
 * Minimal config for basic testing
 */
export const minimalConfig: ShortcutsConfig = {
  shortcuts: [
    {
      identifier: 'simpleAction',
      title: 'Simple Action',
      phrases: ['simple action'],
    },
  ],
};

/**
 * Config without optional features
 */
export const noLocalizationConfig: ShortcutsConfig = {
  shortcuts: [
    {
      identifier: 'basicAction',
      title: 'Basic Action',
      phrases: ['basic action'],
    },
  ],
  localization: false,
};
