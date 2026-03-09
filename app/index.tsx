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
} from "react-native";
import ShoppingList from "./ShoppingList";
import Wishlist from "./Wishlist";
import Budget from "./BudgetPanel";
import { useEffect, useState, useCallback, useMemo } from "react";
import * as SplashScreen from "expo-splash-screen";
import { MaterialIcons } from "@expo/vector-icons";
import LLMChat from "./LLMChat";
import SettingsModal from "./SettingsModal";
import ApiKeyModal from "./ApiKeyModal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiKey, LLM_CHAT_ENABLED, initApiKey, clearApiKey, setApiKey } from "../config";
import { useTranslation } from 'react-i18next';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function Index() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [activeScreen, setActiveScreen] = useState<
    "shoppingList" | "wishlist" | "budget" | "llmChat"
  >("shoppingList");
  const [selectedModel, setSelectedModel] = useState<string>("gemini-2.5-flash-lite");
  const [configVisible, setConfigVisible] = useState(false);
  const [autoHideWishlistOnAdd, setAutoHideWishlistOnAdd] = useState(true);
  const [budgetEnabled, setBudgetEnabled] = useState(false);
  const [apiKeyModalVisible, setApiKeyModalVisible] = useState(false);
  const [apiKeyError, setApiKeyError] = useState(false);
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
      const currentIndex = screens.indexOf(prev);
      return currentIndex < screens.length - 1
        ? screens[currentIndex + 1]
        : prev;
    });
  }, [screens]);

  const switchToPrev = useCallback(() => {
    hideKeyboard();
    setActiveScreen((prev) => {
      const currentIndex = screens.indexOf(prev);
      return currentIndex > 0 ? screens[currentIndex - 1] : prev;
    });
  }, [screens]);

  const handleSelectModel = async (model: string) => {
    setSelectedModel(model);
    await AsyncStorage.setItem('SELECTED_MODEL', model);
  };

  const toggleAutoHide = async () => {
    const newValue = !autoHideWishlistOnAdd;
    setAutoHideWishlistOnAdd(newValue);
    await AsyncStorage.setItem('AUTO_HIDE_WISHLIST_ON_ADD', newValue.toString());
  };

  const toggleBudget = async () => {
    const newValue = !budgetEnabled;
    setBudgetEnabled(newValue);
    await AsyncStorage.setItem('BUDGET_ENABLED', newValue.toString());
    if (!newValue && activeScreen === 'budget') {
      setActiveScreen('shoppingList');
    }
  };

  const handleClearApiKey = async () => {
    await AsyncStorage.removeItem('GEMINI_API_KEY');
    clearApiKey();
    setApiKeyModalVisible(true);
  };

  const [refreshKey, setRefreshKey] = useState(0);
  const handleRefreshAll = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleSaveApiKey = async (key: string) => {
    await AsyncStorage.setItem('GEMINI_API_KEY', key);
    setApiKey(key);
    setApiKeyError(false);
    setApiKeyModalVisible(false);
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
        // Add any initialization logic here if needed
        await initApiKey();
        if (!getApiKey()) {
          setApiKeyModalVisible(true);
        }
        await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay to ensure proper initialization
      } catch (e) {
        console.warn(e);
        setError(e as Error);
      } finally {
        setIsReady(true);
        await SplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        hideKeyboard();
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
        <TouchableOpacity
          onPressIn={hideKeyboard}
          onPress={() => setActiveScreen("shoppingList")}
        >
          <Text
            style={
              activeScreen === "shoppingList"
                ? styles.activeHeaderText
                : styles.inactiveHeaderText
            }
          >
            {t('shoppingList')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPressIn={hideKeyboard}
          onPress={() => setActiveScreen("wishlist")}
        >
          <Text
            style={
              activeScreen === "wishlist"
                ? styles.activeHeaderText
                : styles.inactiveHeaderText
            }
          >
            {t('wishlist')}
          </Text>
        </TouchableOpacity>
        {budgetEnabled && (
          <TouchableOpacity
            onPressIn={hideKeyboard}
            onPress={() => setActiveScreen("budget")}
          >
            <Text
              style={
                activeScreen === "budget"
                  ? styles.activeHeaderText
                  : styles.inactiveHeaderText
              }
            >
              {t('budget')}
            </Text>
          </TouchableOpacity>
        )}
        {LLM_CHAT_ENABLED && (
          <TouchableOpacity
            onPressIn={hideKeyboard}
            onPress={() => setActiveScreen("llmChat")}
          >
            <Text
              style={
                activeScreen === "llmChat"
                  ? styles.activeHeaderText
                  : styles.inactiveHeaderText
              }
            >
              {t('llmChat')}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPressIn={hideKeyboard}
          onPress={() => setConfigVisible(true)}
        >
          <MaterialIcons name="settings" size={24} color="white" />
        </TouchableOpacity>
      </View>
      {activeScreen === "shoppingList" ? (
        <ShoppingList
          key={`shopping-${refreshKey}`}
          selectedModel={selectedModel}
          autoHideWishlistOnAdd={autoHideWishlistOnAdd}
          budgetEnabled={budgetEnabled}
          onRequireApiKey={requireApiKey}
          onRefreshAll={handleRefreshAll}
        />
      ) : activeScreen === "wishlist" ? (
        <Wishlist 
          key={`wishlist-${refreshKey}`}
          selectedModel={selectedModel} 
          onRequireApiKey={requireApiKey} 
          onRefreshAll={handleRefreshAll}
        />
      ) : activeScreen === "budget" ? (
        <Budget 
          key={`budget-${refreshKey}`}
          selectedModel={selectedModel} 
          onRequireApiKey={requireApiKey} 
          onRefreshAll={handleRefreshAll}
        />
      ) : LLM_CHAT_ENABLED ? (
        <LLMChat selectedModel={selectedModel} onRequireApiKey={requireApiKey} />
      ) : null}
      <SettingsModal
        visible={configVisible}
        onClose={() => setConfigVisible(false)}
        selectedModel={selectedModel}
        onSelectModel={handleSelectModel}
        autoHideWishlistOnAdd={autoHideWishlistOnAdd}
        onToggleAutoHide={toggleAutoHide}
        budgetEnabled={budgetEnabled}
        onToggleBudget={toggleBudget}
        onClearApiKey={handleClearApiKey}
        onAddApiKey={() => setApiKeyModalVisible(true)}
      />
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
    justifyContent: "space-around",
    padding: 10,
  },
  activeHeaderText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 18,
  },
  inactiveHeaderText: {
    color: "#aaa",
    fontSize: 18,
  },
});
