import { SafeAreaView, StyleSheet } from "react-native";
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
    backgroundColor: '#f5f5f5',
  },
});
