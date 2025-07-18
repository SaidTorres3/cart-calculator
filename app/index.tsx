import { SafeAreaView, StyleSheet, Platform, StatusBar, View, Text, TouchableOpacity, PanResponder, GestureResponderEvent, PanResponderGestureState } from "react-native";
import ShoppingList from "./ShoppingList";
import Wishlist from "./Wishlist";
import { useEffect, useState, useRef } from "react";
import * as SplashScreen from 'expo-splash-screen';
import { MaterialIcons } from '@expo/vector-icons';
import LLMChat from "./LLMChat";
import { LLM_CHAT_ENABLED } from "../config";

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function Index() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [activeScreen, setActiveScreen] = useState<'shoppingList' | 'wishlist' | 'llmChat'>('shoppingList');

  const screens: ('shoppingList' | 'wishlist' | 'llmChat')[] =
    LLM_CHAT_ENABLED ? ['shoppingList', 'wishlist', 'llmChat'] : ['shoppingList', 'wishlist'];

  const switchToNext = () => {
    const currentIndex = screens.indexOf(activeScreen);
    const nextIndex = (currentIndex + 1) % screens.length;
    setActiveScreen(screens[nextIndex]);
  };

  const switchToPrev = () => {
    const currentIndex = screens.indexOf(activeScreen);
    const prevIndex = (currentIndex - 1 + screens.length) % screens.length;
    setActiveScreen(screens[prevIndex]);
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        return (
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          Math.abs(gestureState.dx) > 20
        );
      },
      onPanResponderRelease: (_: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        if (gestureState.dx > 50) {
          switchToPrev();
        } else if (gestureState.dx < -50) {
          switchToNext();
        }
      },
    })
  ).current;

  useEffect(() => {
    async function prepare() {
      try {
        // Add any initialization logic here if needed
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay to ensure proper initialization
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
        <TouchableOpacity onPress={() => setActiveScreen('shoppingList')}>
          <Text style={activeScreen === 'shoppingList' ? styles.activeHeaderText : styles.inactiveHeaderText}>Shopping List</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveScreen('wishlist')}>
          <Text style={activeScreen === 'wishlist' ? styles.activeHeaderText : styles.inactiveHeaderText}>Wishlist</Text>
        </TouchableOpacity>
        {LLM_CHAT_ENABLED && (
          <TouchableOpacity onPress={() => setActiveScreen('llmChat')}>
            <Text style={activeScreen === 'llmChat' ? styles.activeHeaderText : styles.inactiveHeaderText}>LLM Chat</Text>
          </TouchableOpacity>
        )}
      </View>
      {activeScreen === 'shoppingList' ? <ShoppingList /> : activeScreen === 'wishlist' ? <Wishlist /> : LLM_CHAT_ENABLED ? <LLMChat /> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  errorText: {
    color: 'white',
    textAlign: 'center',
    margin: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
  },
  activeHeaderText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  inactiveHeaderText: {
    color: '#aaa',
    fontSize: 18,
  },
});
