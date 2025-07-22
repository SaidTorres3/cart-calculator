import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Switch, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  autoHideWishlistOnAdd: boolean;
  onToggleAutoHide: () => void;
  onClearApiKey: () => void;
  onAddApiKey: () => void;
}

const MODELS = [
  { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
  { label: 'Gemini 2.5 Flash Lite', value: 'gemini-2.5-flash-lite' },
  { label: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash' },
  { label: 'Gemini 2.0 Flash Lite', value: 'gemini-2.0-flash-lite' },
  { label: 'Gemma 3 12B', value: 'gemma-3-12b-it' },
  { label: 'Gemma 3 27B', value: 'gemma-3-27b-it' },
];

const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  selectedModel,
  onSelectModel,
  autoHideWishlistOnAdd,
  onToggleAutoHide,
  onClearApiKey,
  onAddApiKey,
}) => {
  const confirmRemove = () => {
    Alert.alert('Remove Gemini API Key?', 'You can add it again later.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: onClearApiKey },
    ]);
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.sectionTitle}>Select AI Model</Text>
          {MODELS.map((m) => (
            <TouchableOpacity
              key={m.value}
              style={[styles.option, selectedModel === m.value && styles.selectedOption]}
              onPress={() => onSelectModel(m.value)}
            >
              <Text style={styles.optionText}>{m.label}</Text>
              {selectedModel === m.value && (
                <MaterialIcons name="check" size={24} color="#4CAF50" />
              )}
            </TouchableOpacity>
          ))}
          <View style={styles.toggleRow}>
            <Text style={styles.optionText}>Auto-hide wishlisted on add</Text>
            <Switch
              value={autoHideWishlistOnAdd}
              onValueChange={onToggleAutoHide}
            />
          </View>
          <TouchableOpacity
            style={styles.addKeyButton}
            onPress={onAddApiKey}
          >
            <Text style={styles.addKeyText}>Set Gemini API Key</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.removeKeyButton}
            onPress={confirmRemove}
          >
            <Text style={styles.removeKeyText}>Remove Gemini API Key</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '80%',
    backgroundColor: '#242424',
    borderRadius: 10,
    padding: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  sectionTitle: {
    color: '#fff',
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 6,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  selectedOption: {
    backgroundColor: '#333',
    borderRadius: 6,
  },
  optionText: {
    color: '#fff',
    fontSize: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  addKeyButton: {
    backgroundColor: '#1976D2',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  addKeyText: {
    color: '#fff',
    fontSize: 16,
  },
  removeKeyButton: {
    backgroundColor: '#551111',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  removeKeyText: {
    color: '#fff',
    fontSize: 16,
  },
  closeButton: {
    marginTop: 10,
    backgroundColor: '#1976D2',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default SettingsModal;
