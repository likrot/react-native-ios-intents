import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({
  id: 'ios-intents-example',
});

// Keys
const KEYS = {
  TIMER_RUNNING: 'timerRunning',
  TASK_NAME: 'taskName',
  TIMER_START_TIME: 'timerStartTime',
  LOGS: 'logs',
  TODOS: 'todos',
} as const;

// Types
export interface Todo {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  dueDate?: number; // Optional due date (timestamp in milliseconds)
}

export const Storage = {
  // Timer State
  getTimerRunning: (): boolean => {
    return storage.getBoolean(KEYS.TIMER_RUNNING) ?? false;
  },

  setTimerRunning: (value: boolean) => {
    storage.set(KEYS.TIMER_RUNNING, value);
  },

  // Task Name
  getTaskName: (): string => {
    return storage.getString(KEYS.TASK_NAME) ?? 'Work';
  },

  setTaskName: (value: string) => {
    storage.set(KEYS.TASK_NAME, value);
  },

  // Timer Start Time (timestamp in milliseconds)
  getTimerStartTime: (): number | null => {
    return storage.getNumber(KEYS.TIMER_START_TIME) ?? null;
  },

  setTimerStartTime: (timestamp: number) => {
    storage.set(KEYS.TIMER_START_TIME, timestamp);
  },

  clearTimerStartTime: () => {
    storage.remove(KEYS.TIMER_START_TIME);
  },

  // Logs
  getLogs: (): string[] => {
    const logsJson = storage.getString(KEYS.LOGS);
    if (!logsJson) return [];
    try {
      return JSON.parse(logsJson);
    } catch {
      return [];
    }
  },

  setLogs: (logs: string[]) => {
    storage.set(KEYS.LOGS, JSON.stringify(logs));
  },

  clearLogs: () => {
    storage.remove(KEYS.LOGS);
  },

  // Todos
  getTodos: (): Todo[] => {
    const todosJson = storage.getString(KEYS.TODOS);
    if (!todosJson) return [];
    try {
      return JSON.parse(todosJson);
    } catch {
      return [];
    }
  },

  setTodos: (todos: Todo[]) => {
    storage.set(KEYS.TODOS, JSON.stringify(todos));
  },

  addTodo: (text: string, dueDate?: Date): Todo => {
    const todos = Storage.getTodos();
    const newTodo: Todo = {
      id: Date.now().toString(),
      text,
      completed: false,
      createdAt: Date.now(),
      dueDate: dueDate ? dueDate.getTime() : undefined,
    };
    todos.push(newTodo);
    Storage.setTodos(todos);
    return newTodo;
  },

  toggleTodo: (id: string) => {
    const todos = Storage.getTodos();
    const todo = todos.find(t => t.id === id);
    if (todo) {
      todo.completed = !todo.completed;
      Storage.setTodos(todos);
    }
  },

  deleteTodo: (id: string) => {
    const todos = Storage.getTodos().filter(t => t.id !== id);
    Storage.setTodos(todos);
  },

  clearTodos: () => {
    storage.remove(KEYS.TODOS);
  },

  // Clear all data
  clearAll: () => {
    storage.clearAll();
  },
};
