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
import { useEffect, useState, useCallback, useMemo } from "react";
import * as SplashScreen from "expo-splash-screen";
import { MaterialIcons } from "@expo/vector-icons";
import LLMChat from "./LLMChat";
import SettingsModal from "./SettingsModal";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LLM_CHAT_ENABLED, initApiKey, clearApiKey } from "../config";

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function Index() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [activeScreen, setActiveScreen] = useState<
    "shoppingList" | "wishlist" | "llmChat"
  >("shoppingList");
  const [selectedModel, setSelectedModel] = useState<string>("gemini-2.5-flash-lite");
  const [configVisible, setConfigVisible] = useState(false);
  const [autoHideWishlistOnAdd, setAutoHideWishlistOnAdd] = useState(true);

  const hideKeyboard = () => {
    Keyboard.dismiss();
    const input = (TextInput as any).State?.currentlyFocusedInput?.();
    if (input && typeof input.blur === "function") {
      input.blur();
    }
  };

  const screens: ("shoppingList" | "wishlist" | "llmChat")[] = LLM_CHAT_ENABLED
    ? ["shoppingList", "wishlist", "llmChat"]
    : ["shoppingList", "wishlist"];

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

  const handleClearApiKey = async () => {
    await AsyncStorage.removeItem('GEMINI_API_KEY');
    clearApiKey();
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
            Math.abs(gestureState.dx) > 20
          );
        },
        onPanResponderGrant: () => {
          hideKeyboard();
        },
        onPanResponderRelease: (
          _: GestureResponderEvent,
          gestureState: PanResponderGestureState
        ) => {
          if (gestureState.dx > 50) {
            switchToPrev();
          } else if (gestureState.dx < -50) {
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
        <Text style={styles.errorText}>Error: {error.message}</Text>
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
            Shopping List
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
            Wishlist
          </Text>
        </TouchableOpacity>
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
              LLM Chat
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
          selectedModel={selectedModel}
          autoHideWishlistOnAdd={autoHideWishlistOnAdd}
        />
      ) : activeScreen === "wishlist" ? (
        <Wishlist selectedModel={selectedModel} />
      ) : LLM_CHAT_ENABLED ? (
        <LLMChat selectedModel={selectedModel} />
      ) : null}
      <SettingsModal
        visible={configVisible}
        onClose={() => setConfigVisible(false)}
        selectedModel={selectedModel}
        onSelectModel={handleSelectModel}
        autoHideWishlistOnAdd={autoHideWishlistOnAdd}
        onToggleAutoHide={toggleAutoHide}
        onClearApiKey={handleClearApiKey}
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
