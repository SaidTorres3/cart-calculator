import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';

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

const LANGUAGES = [
  { label: 'English', value: 'en' },
  { label: 'Español', value: 'es' },
  { label: 'Français', value: 'fr' },
  { label: 'Deutsch', value: 'de' },
  { label: '中文', value: 'zh' },
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
  const { t } = useTranslation();
  const confirmRemove = () => {
    Alert.alert(t('removeApiKeyConfirmTitle'), t('removeApiKeyConfirmMessage'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('remove'), style: 'destructive', onPress: onClearApiKey },
    ]);
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>{t('settings')}</Text>
          <Text style={styles.sectionTitle}>{t('selectModel')}</Text>
          <Picker
            selectedValue={selectedModel}
            onValueChange={(value) => onSelectModel(value)}
            style={styles.picker}
            dropdownIconColor="#fff"
          >
            {MODELS.map((m) => (
              <Picker.Item label={m.label} value={m.value} key={m.value} />
            ))}
          </Picker>
          <Text style={styles.sectionTitle}>{t('selectLanguage')}</Text>
          <Picker
            selectedValue={i18n.language}
            onValueChange={(value) => i18n.changeLanguage(value)}
            style={styles.picker}
            dropdownIconColor="#fff"
          >
            {LANGUAGES.map((lang) => (
              <Picker.Item label={lang.label} value={lang.value} key={lang.value} />
            ))}
          </Picker>
          <View style={styles.toggleRow}>
            <Text style={styles.optionText}>{t('autoHide')}</Text>
            <Switch
              value={autoHideWishlistOnAdd}
              onValueChange={onToggleAutoHide}
            />
          </View>
          <TouchableOpacity
            style={styles.addKeyButton}
            onPress={onAddApiKey}
          >
            <Text style={styles.addKeyText}>{t('setApiKey')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.removeKeyButton}
            onPress={confirmRemove}
          >
            <Text style={styles.removeKeyText}>{t('removeApiKey')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>{t('close')}</Text>
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
  optionText: {
    color: '#fff',
    fontSize: 16,
  },
  picker: {
    color: '#fff',
    backgroundColor: '#333',
    marginBottom: 10,
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
