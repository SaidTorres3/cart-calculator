import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

interface ApiKeyModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (key: string) => void;
  showError?: boolean;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ visible, onClose, onSave, showError }) => {
  const [key, setKey] = useState('');
  const { t } = useTranslation();

  const handleSave = () => {
    if (!key.trim()) return;
    onSave(key.trim());
    setKey('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{t('enterApiKeyTitle')}</Text>
          {showError && <Text style={styles.error}>{t('apiKeyRequired')}</Text>}
          <TextInput
            style={styles.input}
            value={key}
            onChangeText={setKey}
            placeholder={t('apiKeyPlaceholder')}
            placeholderTextColor="#888"
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveText}>{t('save')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>{t('skip')}</Text>
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
  error: {
    color: '#ff5252',
    marginBottom: 10,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#333',
    color: '#fff',
    padding: 10,
    borderRadius: 8,
  },
  saveButton: {
    backgroundColor: '#1976D2',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  saveText: {
    color: '#fff',
    fontSize: 16,
  },
  cancelButton: {
    marginTop: 10,
    padding: 10,
    alignItems: 'center',
  },
  cancelText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default ApiKeyModal;
