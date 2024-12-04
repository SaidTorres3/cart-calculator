import { SafeAreaView, StyleSheet, Platform, StatusBar, View, Text } from "react-native";
import ShoppingList from "./ShoppingList";
import { useEffect, useState } from "react";
import * as SplashScreen from 'expo-splash-screen';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function Index() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

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
    <SafeAreaView style={styles.container}>
      <ShoppingList />
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
  }
});
