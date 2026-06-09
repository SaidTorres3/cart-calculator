import {
  SafeAreaView,
  StyleSheet,
  Platform,
  StatusBar,
  View,
  Text,
  TouchableOpacity,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
  Keyboard,
  AppState,
  TextInput,
  DeviceEventEmitter,
} from "react-native";
import ShoppingList from "./ShoppingList";
import Wishlist from "./Wishlist";
import Budget from "./BudgetPanel";
import { useEffect, useState, useCallback, useMemo } from "react";
import * as SplashScreen from "expo-splash-screen";
import { MaterialIcons } from "@expo/vector-icons";
import LLMChat from "./LLMChat";
import SettingsView from "./SettingsView";
import ApiKeyModal from "./ApiKeyModal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiKey, LLM_CHAT_ENABLED, initApiKey, clearApiKey, setApiKey, getApiProvider, setApiProvider, initApiProvider } from "../config";
import { syncToWear, getWatchUpdates } from "../utils/wearSync";
import { useTranslation } from 'react-i18next';

/**
 * Merges incoming items (from watch) with existing items (on phone) by ID.
 * - Items from incoming with IDs already on the phone: update the phone version.
 * - Items from incoming with new IDs: prepend them.
 * - Items on the phone NOT in incoming: PRESERVE them (never delete via sync).
 * This prevents data loss when the watch sends a stale snapshot.
 */
function mergeItemsById(existingJson: string | null, incomingJson: string): string {
  try {
    const incoming: any[] = JSON.parse(incomingJson);
    if (!Array.isArray(incoming)) return incomingJson;

    if (!existingJson) return incomingJson;
    const existing: any[] = JSON.parse(existingJson);
    if (!Array.isArray(existing)) return incomingJson;

    const incomingIds = new Set(incoming.map((item: any) => item.id).filter(Boolean));

    // Start with all incoming items (they take priority for updates)
    const merged = [...incoming];

    // Preserve any existing items NOT in the incoming payload
    for (const item of existing) {
      if (item.id && !incomingIds.has(item.id)) {
        merged.push(item);
      }
    }

    return JSON.stringify(merged);
  } catch {
    // On any parse error, fall back to incoming data
    return incomingJson;
  }
}

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function Index() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [activeScreen, setActiveScreen] = useState<
    "shoppingList" | "wishlist" | "budget" | "llmChat" | "settings"
  >("shoppingList");
  const [selectedModel, setSelectedModel] = useState<string>("gemini-3.1-flash-lite-preview");
  const [autoHideWishlistOnAdd, setAutoHideWishlistOnAdd] = useState(true);
  const [budgetEnabled, setBudgetEnabled] = useState(false);
  const [apiKeyModalVisible, setApiKeyModalVisible] = useState(false);
  const [apiKeyError, setApiKeyError] = useState(false);
  const [apiProvider, setApiProviderState] = useState<string>("vertex");
  const { t } = useTranslation();

  const hideKeyboard = () => {
    Keyboard.dismiss();
    const input = (TextInput as any).State?.currentlyFocusedInput?.();
    if (input && typeof input.blur === "function") {
      input.blur();
    }
  };

  const screens: ("shoppingList" | "wishlist" | "budget" | "llmChat")[] = [
    "shoppingList",
    "wishlist",
    ...(budgetEnabled ? ["budget" as const] : []),
    ...(LLM_CHAT_ENABLED ? ["llmChat" as const] : []),
  ];

  const switchToNext = useCallback(() => {
    hideKeyboard();
    setActiveScreen((prev) => {
      if (prev === "settings") return prev;
      const currentIndex = screens.indexOf(prev);
      return currentIndex < screens.length - 1
        ? screens[currentIndex + 1]
        : prev;
    });
  }, [screens]);

  const switchToPrev = useCallback(() => {
    hideKeyboard();
    setActiveScreen((prev) => {
      if (prev === "settings") return prev;
      const currentIndex = screens.indexOf(prev);
      return currentIndex > 0 ? screens[currentIndex - 1] : prev;
    });
  }, [screens]);

  const handleSelectModel = async (model: string) => {
    setSelectedModel(model);
    await AsyncStorage.setItem('SELECTED_MODEL', model);
    syncToWear({ model });
  };

  const handleSelectApiProvider = async (provider: string) => {
    setApiProviderState(provider);
    await AsyncStorage.setItem('GEMINI_API_PROVIDER', provider);
    setApiProvider(provider);
    syncToWear({ apiProvider: provider });
  };

  const toggleAutoHide = async () => {
    const newValue = !autoHideWishlistOnAdd;
    setAutoHideWishlistOnAdd(newValue);
    await AsyncStorage.setItem('AUTO_HIDE_WISHLIST_ON_ADD', newValue.toString());
    syncToWear({ autoHideWishlist: newValue });
  };

  const toggleBudget = async () => {
    const newValue = !budgetEnabled;
    setBudgetEnabled(newValue);
    await AsyncStorage.setItem('BUDGET_ENABLED', newValue.toString());
    syncToWear({ budgetEnabled: newValue });
    if (!newValue && activeScreen === 'budget') {
      setActiveScreen('shoppingList');
    }
  };

  const handleClearApiKey = async () => {
    await AsyncStorage.removeItem('GEMINI_API_KEY');
    clearApiKey();
    setApiKeyModalVisible(true);
  };

  const handleRefreshAll = () => {
    DeviceEventEmitter.emit('AppStorageUpdated');
  };

  const handleSaveApiKey = async (key: string) => {
    await AsyncStorage.setItem('GEMINI_API_KEY', key);
    setApiKey(key);
    setApiKeyError(false);
    setApiKeyModalVisible(false);
    syncToWear({ apiKey: key });
  };

  const requireApiKey = () => {
    setApiKeyError(true);
    setApiKeyModalVisible(true);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (
          _: GestureResponderEvent,
          gestureState: PanResponderGestureState
        ) => {
          return (
            Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
            Math.abs(gestureState.dx) > 10
          );
        },
        onPanResponderGrant: () => {
          hideKeyboard();
        },
        onPanResponderRelease: (
          _: GestureResponderEvent,
          gestureState: PanResponderGestureState
        ) => {
          if (gestureState.dx > 30) {
            switchToPrev();
          } else if (gestureState.dx < -30) {
            switchToNext();
          }
        },
      }),
    [switchToPrev, switchToNext]
  );

  useEffect(() => {
    async function prepare() {
      try {
        console.log("[Index] prepare start");
        await initApiKey();
        console.log("[Index] initApiKey done");
        await initApiProvider();
        setApiProviderState(getApiProvider());
        console.log("[Index] initApiProvider done");
        if (!getApiKey()) {
          console.log("[Index] No API key found, showing modal");
          setApiKeyModalVisible(true);
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
        console.log("[Index] setTimeout done");
        syncToWear();
        console.log("[Index] syncToWear triggered");
      } catch (e) {
        console.warn("[Index] prepare error:", e);
        setError(e as Error);
      } finally {
        console.log("[Index] prepare finally, setting isReady=true and hiding splash");
        setIsReady(true);
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  // Real-time listener: watch pushed cart/wishlist/budget changes while phone is in foreground
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = DeviceEventEmitter.addListener(
      'WearDataUpdated',
      async (event: { type: string; data: string }) => {
        try {
          if (event.type === 'cart') {
            // Merge incoming watch data with existing phone data by item ID.
            // This prevents data loss if the watch sends a stale snapshot.
            const existing = await AsyncStorage.getItem('SHOPPING_ITEMS');
            const merged = mergeItemsById(existing, event.data);
            await AsyncStorage.setItem('SHOPPING_ITEMS', merged);
          } else if (event.type === 'wishlist') {
            const existing = await AsyncStorage.getItem('WISHLIST_ITEMS');
            const merged = mergeItemsById(existing, event.data);
            await AsyncStorage.setItem('WISHLIST_ITEMS', merged);
          } else if (event.type === 'budget') {
            const existing = await AsyncStorage.getItem('BUDGET_ENTRIES');
            const merged = mergeItemsById(existing, event.data);
            await AsyncStorage.setItem('BUDGET_ENTRIES', merged);
          }
          DeviceEventEmitter.emit('AppStorageUpdated');
        } catch {
          // Non-critical
        }
      }
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (state) => {
      if (state !== "active") {
        hideKeyboard();
        return;
      }
      // App came to foreground — pick up any edits made on the watch
      try {
        const updates = await getWatchUpdates();
        let changed = false;
        if (updates.cart !== null) {
          // Merge watch cart with existing phone cart to prevent data loss
          const existing = await AsyncStorage.getItem('SHOPPING_ITEMS');
          const merged = mergeItemsById(existing, updates.cart);
          await AsyncStorage.setItem('SHOPPING_ITEMS', merged);
          changed = true;
        }
        if (updates.wishlist !== null) {
          const existing = await AsyncStorage.getItem('WISHLIST_ITEMS');
          const merged = mergeItemsById(existing, updates.wishlist);
          await AsyncStorage.setItem('WISHLIST_ITEMS', merged);
          changed = true;
        }
        if (updates.budget !== null) {
          const existing = await AsyncStorage.getItem('BUDGET_ENTRIES');
          const merged = mergeItemsById(existing, updates.budget);
          await AsyncStorage.setItem('BUDGET_ENTRIES', merged);
          changed = true;
        }
        if (changed) {
          // Trigger a re-render of the lists
          DeviceEventEmitter.emit('AppStorageUpdated');
        }
      } catch {
        // Non-critical
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem('SELECTED_MODEL');
      if (stored) {
        setSelectedModel(stored);
      }
      const storedProvider = await AsyncStorage.getItem('GEMINI_API_PROVIDER');
      if (storedProvider) {
        setApiProviderState(storedProvider);
        setApiProvider(storedProvider);
      }
      const hideSetting = await AsyncStorage.getItem('AUTO_HIDE_WISHLIST_ON_ADD');
      if (hideSetting !== null) {
        setAutoHideWishlistOnAdd(hideSetting === 'true');
      }
      const budgetSetting = await AsyncStorage.getItem('BUDGET_ENABLED');
      if (budgetSetting !== null) {
        setBudgetEnabled(budgetSetting === 'true');
      }
    })();
  }, []);

  useEffect(() => {
    hideKeyboard();
  }, [activeScreen]);

  if (!isReady) {
    return null;
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{t('error')}: {error.message}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} {...panResponder.panHandlers}>
      <View style={styles.header}>
        <View style={styles.headerTabsContainer}>
          <TouchableOpacity
            style={styles.headerTab}
            onPressIn={hideKeyboard}
            onPress={() => setActiveScreen("shoppingList")}
          >
            <Text
              style={
                activeScreen === "shoppingList"
                  ? styles.activeHeaderText
                  : styles.inactiveHeaderText
              }
              numberOfLines={1}
            >
              {t('shoppingList')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerTab}
            onPressIn={hideKeyboard}
            onPress={() => setActiveScreen("wishlist")}
          >
            <Text
              style={
                activeScreen === "wishlist"
                  ? styles.activeHeaderText
                  : styles.inactiveHeaderText
              }
              numberOfLines={1}
            >
              {t('wishlist')}
            </Text>
          </TouchableOpacity>
          {budgetEnabled && (
            <TouchableOpacity
              style={styles.headerTab}
              onPressIn={hideKeyboard}
              onPress={() => setActiveScreen("budget")}
            >
              <Text
                style={
                  activeScreen === "budget"
                    ? styles.activeHeaderText
                    : styles.inactiveHeaderText
                }
                numberOfLines={1}
              >
                {t('budget')}
              </Text>
            </TouchableOpacity>
          )}
          {LLM_CHAT_ENABLED && (
            <TouchableOpacity
              style={styles.headerTab}
              onPressIn={hideKeyboard}
              onPress={() => setActiveScreen("llmChat")}
            >
              <Text
                style={
                  activeScreen === "llmChat"
                    ? styles.activeHeaderText
                    : styles.inactiveHeaderText
                }
                numberOfLines={1}
              >
                {t('llmChat')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.settingsButton}
          onPressIn={hideKeyboard}
          onPress={() => setActiveScreen("settings")}
        >
          <MaterialIcons 
            name="settings" 
            size={24} 
            color={activeScreen === "settings" ? "#64B5F6" : "white"} 
          />
        </TouchableOpacity>
      </View>
      {activeScreen === "shoppingList" ? (
        <ShoppingList
          selectedModel={selectedModel}
          autoHideWishlistOnAdd={autoHideWishlistOnAdd}
          budgetEnabled={budgetEnabled}
          onRequireApiKey={requireApiKey}
          onRefreshAll={handleRefreshAll}
        />
      ) : activeScreen === "wishlist" ? (
        <Wishlist 
          selectedModel={selectedModel} 
          onRequireApiKey={requireApiKey} 
          onRefreshAll={handleRefreshAll}
        />
      ) : activeScreen === "budget" ? (
        <Budget 
          selectedModel={selectedModel} 
          onRequireApiKey={requireApiKey} 
          onRefreshAll={handleRefreshAll}
        />
      ) : activeScreen === "llmChat" && LLM_CHAT_ENABLED ? (
        <LLMChat selectedModel={selectedModel} onRequireApiKey={requireApiKey} />
      ) : activeScreen === "settings" ? (
        <SettingsView
          onClose={() => setActiveScreen("shoppingList")}
          selectedModel={selectedModel}
          onSelectModel={handleSelectModel}
          apiProvider={apiProvider}
          onSelectApiProvider={handleSelectApiProvider}
          autoHideWishlistOnAdd={autoHideWishlistOnAdd}
          onToggleAutoHide={toggleAutoHide}
          budgetEnabled={budgetEnabled}
          onToggleBudget={toggleBudget}
          onClearApiKey={handleClearApiKey}
          onAddApiKey={() => setApiKeyModalVisible(true)}
          hasApiKey={!!getApiKey()}
        />
      ) : null}
      <ApiKeyModal
        visible={apiKeyModalVisible}
        onClose={() => {
          setApiKeyError(false);
          setApiKeyModalVisible(false);
        }}
        onSave={handleSaveApiKey}
        showError={apiKeyError}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
  errorText: {
    color: "white",
    textAlign: "center",
    margin: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingLeft: 10,
    paddingRight: 10,
    position: "relative",
  },
  headerTabsContainer: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  headerTab: {
    flex: 1,
    alignItems: "center",
  },
  activeHeaderText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 14,
  },
  inactiveHeaderText: {
    color: "#aaa",
    fontSize: 14,
  },
  settingsButton: {
    padding: 8,
    marginLeft: 10,
  },
});
