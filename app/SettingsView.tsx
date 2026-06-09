import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import SettingsItem from '../components/SettingsItem';

interface SettingsViewProps {
  onClose: () => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  apiProvider: string;
  onSelectApiProvider: (provider: string) => void;
  autoHideWishlistOnAdd: boolean;
  onToggleAutoHide: () => void;
  budgetEnabled: boolean;
  onToggleBudget: () => void;
  onClearApiKey: () => void;
  onAddApiKey: () => void;
  hasApiKey: boolean;
}

const MODELS = [
  { label: "Gemini 3.1 Flash Lite", value: "gemini-3.1-flash-lite-preview" },
  { label: "Gemini 3.0 Flash", value: "gemini-3-flash-preview" },
  { label: "Gemma 3 27B", value: "gemma-3-27b-it" },
];

const LANGUAGES = [
  { label: 'English', value: 'en' },
  { label: 'Español', value: 'es' },
  { label: 'Français', value: 'fr' },
  { label: 'Deutsch', value: 'de' },
  { label: '中文', value: 'zh' },
  { label: '日本語', value: 'ja' },
];

const SettingsView: React.FC<SettingsViewProps> = ({
  onClose,
  selectedModel,
  onSelectModel,
  apiProvider,
  onSelectApiProvider,
  autoHideWishlistOnAdd,
  onToggleAutoHide,
  budgetEnabled,
  onToggleBudget,
  onClearApiKey,
  onAddApiKey,
  hasApiKey,
}) => {
  const { t } = useTranslation();
  const [modelExpanded, setModelExpanded] = useState(false);
  const [langExpanded, setLangExpanded] = useState(false);

  const handleLanguageChange = async (value: string) => {
    i18n.changeLanguage(value);
    await AsyncStorage.setItem('user-language', value);
  };

  const confirmRemove = () => {
    Alert.alert(t('removeApiKeyConfirmTitle'), t('removeApiKeyConfirmMessage'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('remove'), style: 'destructive', onPress: onClearApiKey },
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onClose}>
          <MaterialIcons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('settings')}</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Scrollable list */}
      <ScrollView 
        style={styles.scrollArea} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>{t('aiConfiguration').toUpperCase()}</Text>

        {/* Model Selector */}
        <SettingsItem
          icon="smart-toy"
          title={t('selectModel')}
          subtitle={MODELS.find((m) => m.value === selectedModel)?.label || selectedModel}
          rightElement={
            <MaterialIcons
              name={modelExpanded ? 'expand-less' : 'expand-more'}
              size={22}
              color="#888"
            />
          }
          onPress={() => {
            setModelExpanded(!modelExpanded);
            setLangExpanded(false);
          }}
        />
        {modelExpanded && (
          <View style={styles.expandedOptions}>
            {MODELS.map((m) => (
              <TouchableOpacity
                key={m.value}
                style={[
                  styles.optionItem,
                  selectedModel === m.value && styles.optionItemActive,
                ]}
                onPress={() => {
                  onSelectModel(m.value);
                  setModelExpanded(false);
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    selectedModel === m.value && styles.optionTextActive,
                  ]}
                >
                  {m.label}
                </Text>
                {selectedModel === m.value && (
                  <MaterialIcons name="check" size={18} color="#64B5F6" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* API Provider Card - Title on top, choices full-width on bottom */}
        <View style={styles.providerCard}>
          <View style={styles.providerRow}>
            <View style={styles.providerIconBackground}>
              <MaterialIcons name="cloud" size={20} color="#64B5F6" />
            </View>
            <Text style={styles.providerTitle}>{t('selectApiProvider')}</Text>
          </View>
          <View style={styles.segmentedContainer}>
            <TouchableOpacity
              style={[
                styles.segmentButton,
                apiProvider === 'vertex' && styles.segmentButtonActive,
              ]}
              onPress={() => onSelectApiProvider('vertex')}
            >
              <Text
                style={[
                  styles.segmentText,
                  apiProvider === 'vertex' && styles.segmentTextActive,
                ]}
              >
                Vertex AI
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segmentButton,
                apiProvider === 'google_ai_studio' && styles.segmentButtonActive,
              ]}
              onPress={() => onSelectApiProvider('google_ai_studio')}
            >
              <Text
                style={[
                  styles.segmentText,
                  apiProvider === 'google_ai_studio' && styles.segmentTextActive,
                ]}
              >
                Google AI Studio
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* API Key Status / Configuration */}
        <SettingsItem
          icon="vpn-key"
          title="Gemini API Key"
          subtitle={hasApiKey ? 'Configured and ready' : 'Not configured'}
          rightElement={
            hasApiKey ? (
              <TouchableOpacity style={styles.removeKeyBtn} onPress={confirmRemove}>
                <MaterialIcons name="delete-outline" size={18} color="#FF7043" />
                <Text style={styles.removeKeyBtnText}>{t('remove')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.setKeyBtn} onPress={onAddApiKey}>
                <MaterialIcons name="add" size={18} color="#ffffff" />
                <Text style={styles.setKeyBtnText}>Set</Text>
              </TouchableOpacity>
            )
          }
        />

        <Text style={[styles.sectionTitle, { marginTop: 16 }]}>{t('preferences').toUpperCase()}</Text>

        {/* Language Selector */}
        <SettingsItem
          icon="translate"
          title={t('selectLanguage')}
          subtitle={LANGUAGES.find((l) => l.value === i18n.language)?.label || i18n.language}
          rightElement={
            <MaterialIcons
              name={langExpanded ? 'expand-less' : 'expand-more'}
              size={22}
              color="#888"
            />
          }
          onPress={() => {
            setLangExpanded(!langExpanded);
            setModelExpanded(false);
          }}
        />
        {langExpanded && (
          <View style={styles.expandedOptions}>
            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.value}
                style={[
                  styles.optionItem,
                  i18n.language === lang.value && styles.optionItemActive,
                ]}
                onPress={() => {
                  handleLanguageChange(lang.value);
                  setLangExpanded(false);
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    i18n.language === lang.value && styles.optionTextActive,
                  ]}
                >
                  {lang.label}
                </Text>
                {i18n.language === lang.value && (
                  <MaterialIcons name="check" size={18} color="#64B5F6" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Auto-Hide Wishlisted Switch */}
        <SettingsItem
          icon="visibility-off"
          title={t('autoHide')}
          rightElement={
            <Switch
              value={autoHideWishlistOnAdd}
              onValueChange={onToggleAutoHide}
              trackColor={{ false: '#3e3e3e', true: '#1976D2' }}
              thumbColor={autoHideWishlistOnAdd ? '#64B5F6' : '#f4f3f4'}
            />
          }
        />

        {/* Budget Enabled Switch */}
        <SettingsItem
          icon="account-balance-wallet"
          title={t('budgetEnabled')}
          rightElement={
            <Switch
              value={budgetEnabled}
              onValueChange={onToggleBudget}
              trackColor={{ false: '#3e3e3e', true: '#1976D2' }}
              thumbColor={budgetEnabled ? '#64B5F6' : '#f4f3f4'}
            />
          }
        />
      </ScrollView>

      <TouchableOpacity style={styles.doneButton} onPress={onClose}>
        <Text style={styles.doneButtonText}>{t('done')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d30',
    marginBottom: 10,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#2d2d30',
    justifyContent: 'center',
    alignItems: 'center',
    width: 44,
    height: 44,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 10,
  },
  sectionTitle: {
    color: '#8e8e93',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 8,
    marginLeft: 4,
  },
  expandedOptions: {
    backgroundColor: '#1f1f21',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2d2d30',
    overflow: 'hidden',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d30',
  },
  optionItemActive: {
    backgroundColor: '#262629',
  },
  optionText: {
    color: '#e5e5ea',
    fontSize: 14,
  },
  optionTextActive: {
    color: '#64B5F6',
    fontWeight: '600',
  },
  providerCard: {
    backgroundColor: '#2b2b2b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#383838',
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  providerIconBackground: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1f1f1f',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  providerTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#1f1f21',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#383838',
    width: '100%',
    height: 40,
  },
  segmentButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentButtonActive: {
    backgroundColor: '#2d2d30',
  },
  segmentText: {
    color: '#8e8e93',
    fontSize: 14,
    fontWeight: '500',
  },
  segmentTextActive: {
    color: '#64B5F6',
    fontWeight: 'bold',
  },
  setKeyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1976D2',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  setKeyBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  removeKeyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,112,67,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,112,67,0.3)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 4,
  },
  removeKeyBtnText: {
    color: '#FF7043',
    fontSize: 13,
    fontWeight: '600',
  },
  doneButton: {
    backgroundColor: '#1976D2',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  doneButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default SettingsView;
