import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  KeyboardAvoidingView,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
  AppState,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { GoogleGenAI } from '@google/genai';
import { getApiKey } from '../config';
import { supportsThinkingConfig } from '../utils/aiUtils';

interface BudgetEntry {
  id: string;
  name: string;
  amount: string;
  visible: boolean;
}

const BUDGET_STORAGE_KEY = 'BUDGET_ENTRIES';
const SHOPPING_STORAGE_KEY = 'SHOPPING_ITEMS';
const WISHLIST_STORAGE_KEY = 'WISHLIST_ITEMS';

interface BudgetProps {
  selectedModel: string;
  onRequireApiKey: () => void;
  onRefreshAll?: () => void;
}

interface ShoppingItem {
  id: string;
  price: string;
  quantity: string;
  visible: boolean;
}

const Budget: React.FC<BudgetProps> = ({ selectedModel, onRequireApiKey, onRefreshAll }) => {
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [cartTotal, setCartTotal] = useState(0);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formHeight, setFormHeight] = useState(0);
  const [isFormVisible, setIsFormVisible] = useState(true);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const nameRef = useRef<TextInput>(null);
  const amountRef = useRef<TextInput>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (Platform.OS === 'android') {
      if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
      }
    }
  }, []);

  const loadCartTotal = async () => {
    try {
      const saved = await AsyncStorage.getItem(SHOPPING_STORAGE_KEY);
      if (saved) {
        const items: ShoppingItem[] = JSON.parse(saved);
        const total = items
          .filter((i) => i.visible)
          .reduce(
            (sum, i) => sum + parseFloat(i.price) * parseFloat(i.quantity),
            0
          );
        setCartTotal(total);
      } else {
        setCartTotal(0);
      }
    } catch (e) {
      console.error('Failed to load cart total', e);
    }
  };

  useEffect(() => {
    (async () => {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(BUDGET_STORAGE_KEY);
        if (saved) setEntries(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load budget entries', e);
      }
    })();
    loadCartTotal();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadCartTotal();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (entries.length > 0) {
      AsyncStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(entries)).catch(
        (e) => console.error('Failed to save budget entries', e)
      );
    } else {
      AsyncStorage.removeItem(BUDGET_STORAGE_KEY).catch((e) =>
        console.error('Failed to remove budget entries', e)
      );
    }
  }, [entries]);

  const budgetTotal = entries
    .filter((e) => e.visible)
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const remaining = budgetTotal - cartTotal;

  const startRecording = async () => {
    try {
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      setIsRecording(true);
    } catch (err) {
      Alert.alert(t('error'), t('failedStartRecording'));
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      if (!uri) return;
      if (!getApiKey()) {
        onRequireApiKey();
        return;
      }
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const genAI = new GoogleGenAI({ apiKey: getApiKey() });
      const aiParams: any = {
        model: selectedModel,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Extract budget entries from the spoken text and return a JSON array of objects with properties: name (string) and amount (float).
Rules:
- Each entry is a named money source or fund.
- Default amount = 0.0 if not mentioned.
Examples:
"tarjeta de mamá 120, efectivo 800" → [{"name":"Tarjeta de mamá","amount":120.0},{"name":"Efectivo","amount":800.0}]
"caja chica cincuenta pesos" → [{"name":"Caja chica","amount":50.0}]
Output: Return ONLY a JSON array or [] for unrecognizable input.`,
              },
              {
                inlineData: {
                  mimeType: 'audio/wav',
                  data: base64Audio,
                },
              },
            ],
          },
        ],
      };
      if (supportsThinkingConfig(selectedModel)) {
        aiParams.config = { thinkingConfig: { thinkingBudget: 0 } };
      }
      const result = await genAI.models.generateContent(aiParams);
      const text = result.text?.replace(/```json\n?|```/g, '').trim() || '';
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('invalid output');
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      const newEntries: BudgetEntry[] = parsed.map((r: any) => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: r.name || '',
        amount: (parseFloat(r.amount) || 0).toFixed(2),
        visible: true,
      }));
      setEntries((prev) => [...newEntries, ...prev]);
    } catch (error) {
      console.error('Budget voice error:', error);
      Alert.alert(t('error'), t('failedProcessVoiceCommand'));
    }
  };

  const addEntry = () => {
    if (!name.trim() || !amount.trim()) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newEntry: BudgetEntry = {
      id: Date.now().toString(),
      name: name.trim(),
      amount: parseFloat(amount).toFixed(2),
      visible: true,
    };
    setEntries((prev) => [newEntry, ...prev]);
    setName('');
    setAmount('');
    nameRef.current?.focus();
  };

  const updateEntry = () => {
    if (!name.trim() || !amount.trim() || !editingId) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEntries((prev) =>
      prev.map((e) =>
        e.id === editingId
          ? { ...e, name: name.trim(), amount: parseFloat(amount).toFixed(2) }
          : e
      )
    );
    setEditingId(null);
    setName('');
    setAmount('');
  };

  const startEditing = (entry: BudgetEntry) => {
    setEditingId(entry.id);
    setName(entry.name);
    setAmount(entry.amount);
  };

  const toggleVisibility = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setEntries((prev) =>
      prev.map((e) => (e.id === id ? { ...e, visible: !e.visible } : e))
    );
  };

  const cancelEditing = () => {
    setEditingId(null);
    setName('');
    setAmount('');
  };

  const removeEntry = (id: string) => {
    Alert.alert(t('deleteBudgetEntry'), t('deleteBudgetEntryMessage'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setEntries((prev) => prev.filter((e) => e.id !== id));
          if (editingId === id) cancelEditing();
        },
      },
    ]);
  };

  const clearAll = () => {
    if (entries.length === 0) {
      Alert.alert(t('noItems'), t('noItemsMessage'));
      return;
    }
    Alert.alert(t('clearAllBudgetEntries'), t('clearAllBudgetConfirm'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('clearAll'),
        style: 'destructive',
        onPress: () => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setEntries([]);
          cancelEditing();
        },
      },
    ]);
  };

  const deleteAllEverything = async () => {
    Alert.alert(
      t('deleteAllEverything'),
      t('deleteAllEverythingConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              await Promise.all([
                AsyncStorage.removeItem(BUDGET_STORAGE_KEY),
                AsyncStorage.removeItem(SHOPPING_STORAGE_KEY),
                AsyncStorage.removeItem(WISHLIST_STORAGE_KEY),
              ]);
              setEntries([]);
              cancelEditing();
              if (onRefreshAll) onRefreshAll();
              Alert.alert(t('success'), t('allDataCleared'));
            } catch (e) {
              console.error('Failed to clear all data', e);
              Alert.alert(t('error'), t('failedToClearData'));
            }
          },
        },
      ]
    );
  };

  const renderEntry = ({ item }: { item: BudgetEntry }) => {
    const isEditing = item.id === editingId;
    return (
      <TouchableOpacity onPress={() => startEditing(item)} activeOpacity={0.7}>
        <View style={[styles.entry, isEditing && styles.entryEditing, !item.visible && styles.hiddenEntry]}>
          <View style={styles.entryInfo}>
            <Text style={[styles.entryName, !item.visible && styles.hiddenText]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.entryAmount, !item.visible && styles.hiddenText]}>${item.amount}</Text>
          </View>
          <View style={styles.entryButtons}>
            <TouchableOpacity
              style={styles.visibilityBtn}
              onPress={(e) => {
                e.stopPropagation();
                toggleVisibility(item.id);
              }}
            >
              <MaterialIcons
                name={item.visible ? 'visibility' : 'visibility-off'}
                size={20}
                color="white"
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.removeBtn}
              onPress={(e) => {
                e.stopPropagation();
                removeEntry(item.id);
              }}
            >
              <MaterialIcons name="delete" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <TouchableOpacity
        style={styles.header}
        onPress={() => setIsFormVisible(!isFormVisible)}
      >
        <Text style={styles.title} numberOfLines={1}>{t('budget')}</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            onPress={clearAll} 
            onLongPress={deleteAllEverything}
            delayLongPress={2000}
            style={styles.clearAllIcon}
          >
            <MaterialIcons name="delete-sweep" size={28} color="#C62828" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.collapseButton}>
            <MaterialIcons
              name={isFormVisible ? 'expand-less' : 'expand-more'}
              size={28}
              color="#1976D2"
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      <FlatList
        data={entries}
        renderItem={renderEntry}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={{ paddingBottom: isFormVisible ? formHeight + 180 : 100 }}
        initialNumToRender={20}
      />

      {/* Summary pinned above the form */}
      <View style={[styles.summaryContainer, { bottom: isFormVisible ? formHeight + 20 : 20 }]}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('budgetTotal')}:</Text>
          <Text style={styles.summaryValue}>${budgetTotal.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t('total')} (cart):</Text>
          <Text style={styles.summaryValue}>${cartTotal.toFixed(2)}</Text>
        </View>
        <View style={[styles.summaryRow, styles.remainingRow]}>
          <Text style={styles.remainingLabel}>{t('budgetRemaining')}:</Text>
          <Text
            style={[
              styles.remainingValue,
              { color: remaining >= 0 ? '#4CAF50' : '#C62828' },
            ]}
          >
            ${remaining.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Add / Edit form */}
      {isFormVisible && (
      <View
        style={styles.inputContainer}
        onLayout={(e) => setFormHeight(e.nativeEvent.layout.height)}
      >
        <TextInput
          ref={nameRef}
          style={styles.input}
          placeholder={t('budgetEntryName')}
          placeholderTextColor="#666"
          value={name}
          onChangeText={setName}
          returnKeyType="next"
          onSubmitEditing={() => amountRef.current?.focus()}
          blurOnSubmit={false}
        />
        <View style={styles.amountRow}>
          <Text style={styles.dollarSign}>$</Text>
          <TextInput
            ref={amountRef}
            style={[styles.input, styles.amountInput]}
            placeholder={t('budgetEntryAmount')}
            placeholderTextColor="#666"
            value={amount}
            onChangeText={(text) => setAmount(text.replace(/[^0-9.]/g, ''))}
            keyboardType="numeric"
            returnKeyType="done"
            onSubmitEditing={() => {
              if (editingId) updateEntry();
              else addEntry();
              nameRef.current?.focus();
            }}
          />
          {editingId ? (
            <View style={styles.editButtonsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.confirmBtn]}
                onPress={updateEntry}
              >
                <MaterialIcons name="check" size={24} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={cancelEditing}
              >
                <MaterialIcons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.actionBtn} onPress={addEntry}>
              <MaterialIcons name="add" size={24} color="white" />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.recordButton}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <MaterialIcons
            name={isRecording ? 'stop' : 'mic'}
            size={24}
            color="white"
          />
        </TouchableOpacity>
      </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    flex: 1,
  },
  headerButtons: {
    position: 'absolute',
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clearAllIcon: {
    padding: 8,
  },
  collapseButton: {
    padding: 8,
  },
  list: {
    marginBottom: 20,
  },
  entry: {
    backgroundColor: '#242424',
    padding: 14,
    marginVertical: 5,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryEditing: {
    borderWidth: 2,
    borderColor: '#1976D2',
  },
  entryInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginRight: 10,
  },
  entryName: {
    color: '#fff',
    fontSize: 16,
    flex: 1,
  },
  entryAmount: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  entryButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  visibilityBtn: {
    backgroundColor: '#1565C0',
    padding: 8,
    borderRadius: 8,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtn: {
    backgroundColor: '#C62828',
    padding: 8,
    borderRadius: 8,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenEntry: {
    opacity: 0.5,
    backgroundColor: '#1e1e1e',
  },
  hiddenText: {
    color: '#666',
  },
  summaryContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    backgroundColor: '#242424',
    borderRadius: 10,
    padding: 12,
    zIndex: 2,
    gap: 6,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    color: '#aaa',
    fontSize: 15,
    fontWeight: 'bold',
  },
  summaryValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  remainingRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#444',
  },
  remainingLabel: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  remainingValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  inputContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
    gap: 10,
    backgroundColor: '#242424',
    padding: 15,
    borderRadius: 10,
    zIndex: 1,
  },
  input: {
    backgroundColor: '#333',
    color: '#fff',
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dollarSign: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  amountInput: {
    flex: 1,
  },
  actionBtn: {
    backgroundColor: '#1976D2',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    height: 44,
  },
  confirmBtn: {
    backgroundColor: '#2E7D32',
  },
  cancelBtn: {
    backgroundColor: '#F57C00',
  },
  editButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  recordButton: {
    backgroundColor: '#C62828',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    height: 44,
  },
});

export default Budget;
