import React from 'react';
import { View, Text, Modal, ScrollView, Pressable, Button, StyleSheet } from 'react-native';
import type { Todo } from './storage';

interface TodoModalProps {
  visible: boolean;
  todos: Todo[];
  onClose: () => void;
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
}

export function TodoModal({ visible, todos, onClose, onToggleTodo, onDeleteTodo }: TodoModalProps) {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📝 Todo List</Text>
            <Pressable onPress={onClose} style={styles.modalCloseButton}>
              <Text style={styles.modalCloseText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.todoList}>
            {todos.length === 0 && (
              <Text style={styles.emptyText}>
                No todos yet! Say "Hey Siri, add a task in IosIntentsExample" to add one.
              </Text>
            )}
            {todos.map((todo) => (
              <View key={todo.id} style={styles.todoItem}>
                <Pressable
                  style={styles.todoCheckbox}
                  onPress={() => onToggleTodo(todo.id)}
                >
                  <View style={[styles.checkbox, todo.completed && styles.checkboxChecked]}>
                    {todo.completed && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </Pressable>
                <View style={styles.todoContent}>
                  <Text style={[styles.todoText, todo.completed && styles.todoTextCompleted]}>
                    {todo.text}
                  </Text>
                  {todo.dueDate && (
                    <Text style={styles.dueDateText}>
                      📅 {new Date(todo.dueDate).toLocaleDateString()}
                    </Text>
                  )}
                </View>
                <Pressable
                  style={styles.deleteButton}
                  onPress={() => onDeleteTodo(todo.id)}
                >
                  <Text style={styles.deleteButtonText}>🗑️</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>

          <View style={styles.modalFooter}>
            <Button title="Close" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    width: '85%',
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    padding: 5,
  },
  modalCloseText: {
    fontSize: 24,
    color: '#666',
  },
  todoList: {
    padding: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 40,
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  todoContent: {
    flex: 1,
    marginRight: 8,
  },
  todoCheckbox: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
  },
  checkmark: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  todoText: {
    fontSize: 16,
  },
  todoTextCompleted: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  dueDateText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  deleteButton: {
    padding: 8,
  },
  deleteButtonText: {
    fontSize: 18,
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
});
