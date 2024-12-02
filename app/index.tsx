import { SafeAreaView, StyleSheet, Platform, StatusBar } from "react-native";
import ShoppingList from "./ShoppingList";

export default function Index() {
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
});
