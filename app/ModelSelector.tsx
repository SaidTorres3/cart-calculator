import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface ModelSelectorProps {
  visible: boolean;
  onClose: () => void;
  selectedModel: string;
  onSelect: (model: string) => void;
}

const MODELS = [
  { label: "Gemini 2.5 Flash", value: "gemini-2.5-flash" },
  { label: "Gemini 2.5 Flash Lite", value: "gemini-2.5-flash-lite" },
  { label: "Gemini 2.0 Flash", value: "gemini-2.0-flash" },
  { label: "Gemini 2.0 Flash Lite", value: "gemini-2.0-flash-lite" },
  { label: "Gemma 3 12B", value: "gemma-3-12b-it" },
  { label: "Gemma 3 27B", value: "gemma-3-27b-it" },
];

const ModelSelector: React.FC<ModelSelectorProps> = ({
  visible,
  onClose,
  selectedModel,
  onSelect,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Select AI Model</Text>
          {MODELS.map((m) => (
            <TouchableOpacity
              key={m.value}
              style={[styles.option, selectedModel === m.value && styles.selectedOption]}
              onPress={() => onSelect(m.value)}
            >
              <Text style={styles.optionText}>{m.label}</Text>
              {selectedModel === m.value && (
                <MaterialIcons name="check" size={24} color="#4CAF50" />
              )}
            </TouchableOpacity>
          ))}
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

export default ModelSelector;
