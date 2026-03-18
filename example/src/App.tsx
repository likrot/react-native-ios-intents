import { useEffect, useState, useRef } from 'react';
import { Text, View, StyleSheet, Button, ScrollView, Switch } from 'react-native';
import { SiriShortcuts, LiveActivities } from 'react-native-ios-intents';
import { Storage, type Todo } from './storage';
import { TodoModal } from './TodoModal';
import type { ShortcutInvocation } from './shortcuts.generated';

export default function App() {
  // Initialize state from persisted storage
  const [logs, setLogs] = useState<string[]>(() => Storage.getLogs());
  const [timerRunning, setTimerRunning] = useState(() => Storage.getTimerRunning());
  const [timerStartTime, setTimerStartTime] = useState<number | null>(() => Storage.getTimerStartTime());
  const taskName = Storage.getTaskName();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [timerPaused, setTimerPaused] = useState(() => Storage.getTimerPaused());
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [silentMode, setSilentMode] = useState(false);
  const silentModeRef = useRef(silentMode);
  const timerRunningRef = useRef(timerRunning);
  const [todos, setTodos] = useState<Todo[]>(() => Storage.getTodos());
  const [modalVisible, setModalVisible] = useState(false);
  const [liveActivityId, setLiveActivityId] = useState<string | null>(null);
  const liveActivityIdRef = useRef<string | null>(null);
  const timerStartTimeRef = useRef<number | null>(timerStartTime);
  const pausedElapsedRef = useRef<number>(0);
  if(pausedElapsedRef.current === 0){
    pausedElapsedRef.current = Storage.getPausedElapsed() || 0;
  }

  // Keep refs in sync with state
  useEffect(() => {
    timerRunningRef.current = timerRunning;
  }, [timerRunning]);
  useEffect(() => {
    timerStartTimeRef.current = timerStartTime;
  }, [timerStartTime]);

  useEffect(() => {
    addLog('✅ Siri Shortcuts initialized');
    addLog('💬 Say "Hey Siri, start timer in IosIntentsExample" to try it!');
    addLog('📝 Shortcuts defined in shortcuts.config.ts');

    // Sync initial state for confirmations (including taskName for interpolation)
    SiriShortcuts.updateAppState({ timerRunning: timerRunningRef.current, taskName });
    // Restore Live Activity if timer was running or paused before app restart
    const wasPaused = Storage.getTimerPaused();
    if (timerRunningRef.current || wasPaused) {
      // End any stale activities of this type from before the kill
      const running = LiveActivities.getRunningActivities();
      running
        .filter((a) => a.activityType === 'timerActivity')
        .forEach((a) => {
          LiveActivities.endActivity(a.activityId, a.activityType);
          addLog(`🧹 Ended stale Live Activity: ${a.activityId.substring(0, 8)}...`);
        });

      const timerStartDate = timerStartTimeRef.current ? new Date(timerStartTimeRef.current) : new Date();
      const savedElapsed = pausedElapsedRef.current;

      const actId = LiveActivities.startActivity(
        'timerActivity',
        { taskName },
        wasPaused
          ? { timerStart: timerStartDate, isRunning: false, elapsedDisplay: formatTime(savedElapsed) }
          : { timerStart: timerStartDate, isRunning: true, elapsedDisplay: '' }
      );
      if (actId) {
        setLiveActivityId(actId);
        liveActivityIdRef.current = actId;
        addLog(`🔴 Live Activity restored${wasPaused ? ' (paused)' : ''}: ${actId.substring(0, 8)}...`);
      }
    }
    addLog(`📊 Synced state: timerRunning = ${timerRunningRef.current}, taskName = "${taskName}"`);

    // Listen for Siri shortcut invocations with type-safe autocomplete
    const subscription = SiriShortcuts.addEventListener<ShortcutInvocation>('shortcut', async (shortcut, respond) => {
      addLog(`🎤 Siri invoked: ${shortcut.identifier}`);
      addLog(`🎤 Siri invoked with parameters: ${JSON.stringify(shortcut.parameters)}`);
      addLog(`🎤 Siri invoked with nonce: ${shortcut.nonce}`);

      // Helper to send response (silent or with message)
      const sendResponse = (message: string) => {
        if (silentModeRef.current) {
          respond({});
          addLog('📤 Silent response sent to Siri');
        } else {
          respond({ message });
          addLog('📤 Response sent to Siri');
        }
      };

      if (shortcut.identifier === 'startTimer') {
        const userConfirmed = shortcut.userConfirmed;
        const isTimerRunning = timerRunningRef.current;

        // Check current state
        if (isTimerRunning && !userConfirmed) {
          addLog('⚠️ Timer already running');
          sendResponse("Timer is already running!");
          return;
        }

        // If user confirmed to override, stop the old timer first
        if (isTimerRunning && userConfirmed) {
          addLog('🔄 User confirmed - stopping previous timer');
          handleStopTimer(true);
        }

        // Start the new timer
        handleStartTimer(true);
        addLog('✅ Timer started');

        // Send success response to Siri
        const message = userConfirmed
          ? "Previous timer stopped. New timer started!"
          : "Timer started successfully!";
        sendResponse(message);
      } else if (shortcut.identifier === 'stopTimer') {
        const isTimerRunning = timerRunningRef.current;

        // Check current state
        if (!isTimerRunning) {
          addLog('⚠️ Timer not running');
          sendResponse("No timer is running!");
          return;
        }

        // Stop the timer
        handleStopTimer(true);
        addLog('✅ Timer stopped');

        // Send success response to Siri
        sendResponse("Timer stopped successfully!");
      } else if (shortcut.identifier === 'addTask') {
        // Get task name and optional due date from parameters
        const taskName = shortcut.parameters?.taskName as string | undefined;
        const dueDate = shortcut.parameters?.dueDate as Date | undefined;

        if (!taskName) {
          addLog('⚠️ No task name provided');
          sendResponse("Please provide a task name");
          return;
        }

        // Add the task with optional due date
        Storage.addTodo(taskName, dueDate);
        setTodos(Storage.getTodos());

        // Log with due date info if provided
        if (dueDate) {
          addLog(`✅ Task added: "${taskName}" (Due: ${dueDate.toLocaleDateString()})`);
        } else {
          addLog(`✅ Task added: "${taskName}"`);
        }

        // Send success response to Siri
        const dueDateText = dueDate ? ` due on ${dueDate.toLocaleDateString()}` : '';
        sendResponse(`Task "${taskName}"${dueDateText} added to your list!`);
      }
    });

    // Listen for Live Activity button taps (fire-and-forget, no respond callback)
    const buttonSub = LiveActivities.addEventListener('button', (action) => {
      addLog(`🎛️ LA button tapped: ${action.identifier}`);
      if (action.identifier === 'pauseTimer') {
        handlePauseTimer();
        addLog('⏸️ Timer paused via Live Activity');
      } else if (action.identifier === 'resumeTimer') {
        handleResumeTimer();
        addLog('▶️ Timer resumed via Live Activity');
      }
    });

    // Cleanup on unmount
    return () => {
      subscription.remove();
      buttonSub.remove();
    };
  }, [taskName]); // Removed timerRunning - using ref instead to avoid stale closures

  // Timer display update (local UI only - Live Activity timer is system-rendered)
  useEffect(() => {
    if (timerRunning && timerStartTime) {
      // Calculate elapsed time from start time state
      const updateElapsed = () => {
        const elapsed = Math.floor((Date.now() - timerStartTime) / 1000);
        setElapsedSeconds(elapsed);
      };

      // Update immediately
      updateElapsed();

      // Update every second
      const interval = setInterval(updateElapsed, 1000);

      return () => clearInterval(interval);
    } else {
      setElapsedSeconds(0);
    }
  }, [timerRunning, timerStartTime]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => {
      const newLogs = [`[${timestamp}] ${message}`, ...prev].slice(0, 50);
      Storage.setLogs(newLogs);
      return newLogs;
    });
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartTimer = (fromSiri = false) => {
    if (!fromSiri) {
      addLog('🚀 Started timer');
    }
    const startTime = Date.now();
    setTimerPaused(false);
    pausedElapsedRef.current = 0;
    setTimerRunning(true);
    setTimerStartTime(startTime);
    Storage.setTimerRunning(true);
    Storage.setTimerPaused(false);
    Storage.clearPausedElapsed();
    Storage.setTimerStartTime(startTime);
    // Sync state for Siri confirmations (including taskName for dynamic messages)
    SiriShortcuts.updateAppState({ timerRunning: true, taskName });

    // Start Live Activity with system-rendered timer (no polling needed)
    const timerStartDate = new Date(startTime);
    const actId = LiveActivities.startActivity(
      'timerActivity',
      { taskName },
      { timerStart: timerStartDate, isRunning: true, elapsedDisplay: '' }
    );
    if (actId) {
      setLiveActivityId(actId);
      liveActivityIdRef.current = actId;
      addLog(`🔴 Live Activity started: ${actId.substring(0, 8)}...`);
    }
  };

  const handlePauseTimer = () => {
    const startTime = timerStartTimeRef.current;
    const elapsed = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
    pausedElapsedRef.current = elapsed;
    setTimerPaused(true);
    setTimerRunning(false);
    Storage.setTimerRunning(false);
    Storage.setTimerPaused(true);
    Storage.setPausedElapsed(elapsed);
    SiriShortcuts.updateAppState({ timerRunning: false, taskName });

    const display = formatTime(elapsed);

    if (liveActivityIdRef.current) {
      LiveActivities.updateActivity(
        liveActivityIdRef.current,
        'timerActivity',
        { timerStart: startTime ? new Date(startTime) : new Date(), isRunning: false, elapsedDisplay: display }
      );
    }

    addLog(`⏸️ Timer paused at ${display}`);
  };

  const handleResumeTimer = () => {
    const newStartTime = Date.now() - (pausedElapsedRef.current * 1000);
    setTimerPaused(false);
    setTimerRunning(true);
    setTimerStartTime(newStartTime);
    Storage.setTimerRunning(true);
    Storage.setTimerPaused(false);
    Storage.setTimerStartTime(newStartTime);
    SiriShortcuts.updateAppState({ timerRunning: true, taskName });

    if (liveActivityIdRef.current) {
      LiveActivities.updateActivity(
        liveActivityIdRef.current,
        'timerActivity',
        { timerStart: new Date(newStartTime), isRunning: true, elapsedDisplay: '' }
      );
    }

    addLog('▶️ Timer resumed');
  };

  const handleStopTimer = (fromSiri = false) => {
    if (!fromSiri) {
      addLog('🛑 Stopped timer');
    }
    setTimerPaused(false);
    pausedElapsedRef.current = 0;
    setTimerRunning(false);
    setTimerStartTime(null);
    Storage.setTimerRunning(false);
    Storage.setTimerPaused(false);
    Storage.clearPausedElapsed();
    Storage.clearTimerStartTime();
    // Sync state for Siri confirmations
    SiriShortcuts.updateAppState({ timerRunning: false, taskName });

    // End Live Activity
    if (liveActivityIdRef.current) {
      LiveActivities.endActivity(liveActivityIdRef.current, 'timerActivity');
      addLog('🔴 Live Activity ended');
      setLiveActivityId(null);
      liveActivityIdRef.current = null;
    }
  };

  const handleClearLogs = () => {
    setLogs([]);
    Storage.clearLogs();
    addLog('🗑️ Logs cleared');
  };

  const handleToggleTodo = (id: string) => {
    Storage.toggleTodo(id);
    setTodos(Storage.getTodos());
  };

  const handleDeleteTodo = (id: string) => {
    Storage.deleteTodo(id);
    setTodos(Storage.getTodos());
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Siri Shortcuts Example</Text>
        <Text style={styles.subtitle}>
          Status: {timerRunning ? '⏱️ Running' : timerPaused ? '⏸️ Paused' : '⏹️ Stopped'}
          {liveActivityId ? ' | 🔴 Live' : ''}
        </Text>
        {(timerRunning || timerPaused) && (
          <Text style={styles.timer}>
            {timerPaused ? formatTime(pausedElapsedRef.current) : formatTime(elapsedSeconds)}
          </Text>
        )}
      </View>

      <View style={styles.controls}>
        {timerPaused ? (
          <Button
            title="Resume"
            onPress={handleResumeTimer}
          />
        ) : (
          <Button
            title="Start Timer"
            onPress={() => handleStartTimer()}
            disabled={timerRunning}
          />
        )}
        <View style={styles.spacer} />
        {timerRunning && (
          <Button
            title="Pause"
            onPress={handlePauseTimer}
          />
        )}
        {timerRunning && <View style={styles.spacer} />}
        <Button
          title="Stop Timer"
          onPress={() => handleStopTimer()}
          disabled={!timerRunning && !timerPaused}
        />
      </View>

      <View style={styles.todoAndSilentRow}>
        <View style={styles.todoButtonContainer}>
          <Button
            title={`📝 View Todos (${todos.length})`}
            onPress={() => setModalVisible(true)}
          />
        </View>
        <View style={styles.silentModeContainer}>
          <Text style={styles.silentModeLabel}>Silent</Text>
          <Switch
            value={silentMode}
            onValueChange={(value) => {
              silentModeRef.current = value;
              setSilentMode(value);
            }}
            trackColor={{ false: '#767577', true: '#81b0ff' }}
            thumbColor={silentMode ? '#007AFF' : '#f4f3f4'}
          />
        </View>
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>🎙️ Try with Siri:</Text>
        <Text style={styles.instructionsText}>
          • "Hey Siri, start timer in IosIntentsExample"{'\n'}
          • "Hey Siri, stop timer in IosIntentsExample"{'\n'}
          • "Hey Siri, add a task in IosIntentsExample"
        </Text>
        <Text style={styles.instructionsNote}>
          ✨ Siri will respond with custom feedback!{'\n'}
          🚀 Works even when app is killed.{'\n'}
          💾 State persists across app restarts.{'\n'}
          📝 Siri will ask for task name when adding todos!{'\n'}
          🔴 Timer shows as Live Activity on Lock Screen!{'\n'}
          ⏱️ Timer counts natively — no polling needed!{'\n'}
          🎛️ Tap buttons on Lock Screen to pause/resume!
        </Text>
      </View>

      <View style={[styles.logContainer, logsExpanded && styles.logContainerExpanded]}>
        <View style={styles.logHeader}>
          <Text style={styles.logTitle}>Event Log:</Text>
          <View style={styles.logButtons}>
            <Button
              title={logsExpanded ? 'Collapse' : 'Expand'}
              onPress={() => setLogsExpanded(!logsExpanded)}
            />
            <View style={styles.buttonSpacer} />
            <Button
              title="Clear"
              onPress={handleClearLogs}
              color="#FF3B30"
            />
          </View>
        </View>
        <ScrollView style={styles.logScroll} nestedScrollEnabled>
          {logs.length === 0 && (
            <Text style={styles.logTextEmpty}>
              Tap a button or use Siri to see events...
            </Text>
          )}
          {logs.map((log, index) => (
            <Text key={index} style={styles.logText}>
              {log}
            </Text>
          ))}
        </ScrollView>
      </View>

      <TodoModal
        visible={modalVisible}
        todos={todos}
        onClose={() => setModalVisible(false)}
        onToggleTodo={handleToggleTodo}
        onDeleteTodo={handleDeleteTodo}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#007AFF',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
  },
  timer: {
    fontSize: 42,
    fontWeight: 'bold',
    color: 'white',
    marginTop: 8,
    fontVariant: ['tabular-nums'],
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 20,
  },
  spacer: {
    width: 20,
  },
  todoAndSilentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  todoButtonContainer: {
    flex: 1,
    marginRight: 10,
  },
  silentModeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  silentModeLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 6,
  },
  instructions: {
    backgroundColor: 'white',
    margin: 20,
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
    color: '#333',
  },
  instructionsNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  logContainer: {
    flex: 1,
    backgroundColor: 'white',
    margin: 20,
    marginTop: 0,
    padding: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logContainerExpanded: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    bottom: 20,
    zIndex: 100,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  logButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonSpacer: {
    width: 8,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  logScroll: {
    maxHeight: 250,
  },
  logText: {
    fontSize: 12,
    fontFamily: 'Courier',
    marginBottom: 4,
    color: '#333',
  },
  logTextEmpty: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
});
