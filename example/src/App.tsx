import { useEffect, useState, useRef } from 'react';
import { Text, View, StyleSheet, Button, ScrollView, Switch } from 'react-native';
import { SiriShortcuts } from 'react-native-ios-intents';
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
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [silentMode, setSilentMode] = useState(false);
  const silentModeRef = useRef(silentMode);
  const timerRunningRef = useRef(timerRunning);
  const [todos, setTodos] = useState<Todo[]>(() => Storage.getTodos());
  const [modalVisible, setModalVisible] = useState(false);

  // Keep ref in sync with state
  useEffect(() => {
    timerRunningRef.current = timerRunning;
  }, [timerRunning]);

  useEffect(() => {
    addLog('✅ Siri Shortcuts initialized');
    addLog('💬 Say "Hey Siri, start timer in IosIntentsExample" to try it!');
    addLog('📝 Shortcuts defined in shortcuts.config.ts');

    // Sync initial state for confirmations (including taskName for interpolation)
    SiriShortcuts.updateAppState({ timerRunning: timerRunningRef.current, taskName });
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

    // Cleanup on unmount
    return () => {
      subscription.remove();
    };
  }, [taskName]); // Removed timerRunning - using ref instead to avoid stale closures

  // Timer interval effect
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
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartTimer = (fromSiri = false) => {
    if (!fromSiri) {
      addLog('🚀 Started timer');
    }
    const startTime = Date.now();
    setTimerRunning(true);
    setTimerStartTime(startTime);
    Storage.setTimerRunning(true);
    Storage.setTimerStartTime(startTime);
    // Sync state for Siri confirmations (including taskName for dynamic messages)
    SiriShortcuts.updateAppState({ timerRunning: true, taskName });
  };

  const handleStopTimer = (fromSiri = false) => {
    if (!fromSiri) {
      addLog('🛑 Stopped timer');
    }
    setTimerRunning(false);
    setTimerStartTime(null);
    Storage.setTimerRunning(false);
    Storage.clearTimerStartTime();
    // Sync state for Siri confirmations
    SiriShortcuts.updateAppState({ timerRunning: false, taskName });
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Siri Shortcuts Example</Text>
        <Text style={styles.subtitle}>
          Status: {timerRunning ? '⏱️ Running' : '⏸️ Stopped'}
        </Text>
        {timerRunning && (
          <Text style={styles.timer}>
            {formatTime(elapsedSeconds)}
          </Text>
        )}
      </View>

      <View style={styles.controls}>
        <Button
          title="Start Timer"
          onPress={() => handleStartTimer()}
          disabled={timerRunning}
        />
        <View style={styles.spacer} />
        <Button
          title="Stop Timer"
          onPress={() => handleStopTimer()}
          disabled={!timerRunning}
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
          📝 Siri will ask for task name when adding todos!
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
        <ScrollView style={styles.logScroll}>
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
    </View>
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
    flex: 1,
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
