import React, { useState, useRef, useEffect } from "react";
import {
  View,
  KeyboardAvoidingView,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  BackHandler,
} from "react-native";
import DraggableFlatList, {
  RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { MaterialIcons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiKey } from "../config";
import { GoogleGenAI } from "@google/genai";
import { supportsThinkingConfig } from "./aiUtils";

interface Item {
  id: string;
  product: string;
  quantity: string;
  price: string;
  visible: boolean;
  priceUncertain?: boolean;
  fadeAnim?: Animated.Value;
}

const STORAGE_KEY = "SHOPPING_ITEMS";
const WISHLIST_KEY = "WISHLIST_ITEMS";

interface ShoppingListProps {
  selectedModel: string;
  autoHideWishlistOnAdd: boolean;
  onRequireApiKey: () => void;
}

const ShoppingList: React.FC<ShoppingListProps> = ({
  selectedModel,
  autoHideWishlistOnAdd,
  onRequireApiKey,
}) => {
  const [items, setItems] = useState<Item[]>([]);
  const [product, setProduct] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(true);
  const [formHeight, setFormHeight] = useState(0);
  const rainbowAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<any>(null);

  const updateWishlistWithAI = async (
    wishlist: Item[],
    newItems: Item[]
  ): Promise<Item[]> => {
    if (!getApiKey()) {
      onRequireApiKey();
      return wishlist;
    }
    try {
      const genAI = new GoogleGenAI({ apiKey: getApiKey() });
      const prompt =
        'You will receive a JSON array called WISHLIST and another array NEW_ITEMS. ' +
        'For every entry in NEW_ITEMS, if a semantically equivalent product exists in WISHLIST, ' +
        'set that wishlist entry\'s "visible" field to false. Do not change any other fields, ' +
        'do not remove or add elements, and keep the same ordering. Return ONLY the updated WISHLIST JSON.';

      const userText =
        `${prompt}\nWISHLIST:\n${JSON.stringify(wishlist)}\nNEW_ITEMS:\n${JSON.stringify(
          newItems
        )}`;

      const aiParams: any = {
        model: selectedModel,
        contents: [
          {
            role: 'user',
            parts: [{ text: userText }],
          },
        ],
      };
      if (supportsThinkingConfig(selectedModel)) {
        aiParams.config = { thinkingConfig: { thinkingBudget: 0 } };
      }
      const result = await genAI.models.generateContent(aiParams);

      const clean = result.text?.replace(/```json\n?|```/g, '').trim() || '';
      const parsed = JSON.parse(clean);
      if (!Array.isArray(parsed)) throw new Error('invalid output');

      const visibilityMap = new Map(parsed.map((p: any) => [p.id, p.visible]));
      return wishlist.map((w) => {
        const vis = visibilityMap.get(w.id);
        return typeof vis === 'boolean' ? { ...w, visible: vis } : w;
      });
    } catch (err) {
      console.error('Error updating wishlist via AI', err);
      return wishlist;
    }
  };

  const applyWishlistAutoHide = async (newItems: Item[]) => {
    if (!autoHideWishlistOnAdd) return;
    try {
      const wishlistData = await AsyncStorage.getItem(WISHLIST_KEY);
      if (!wishlistData) return;
      const wishlist: Item[] = JSON.parse(wishlistData);
      const updated = await updateWishlistWithAI(wishlist, newItems);
      await AsyncStorage.setItem(WISHLIST_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to update wishlist', e);
    }
  };

  useEffect(() => {
    const onBackPress = () => {
      if (isFormVisible) {
        setIsFormVisible(false);
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress
    );

    return () => subscription.remove();
  }, [isFormVisible]);

  useEffect(() => {
    // Enable LayoutAnimation on Android
    if (Platform.OS === "android") {
      if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
      }
    }
  }, []);

  // Load data from AsyncStorage on app start
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const savedData = await AsyncStorage.getItem(STORAGE_KEY);
        if (savedData !== null) {
          const parsedItems: Item[] = JSON.parse(savedData);
          // Re-initialize fadeAnim for each item
          const restoredItems = parsedItems.map((i) => ({
            ...i,
            priceUncertain: i.priceUncertain ?? false,
            fadeAnim: new Animated.Value(1),
          }));
          setItems(restoredItems);
        }
      } catch (error) {
        console.error("Failed to load data from AsyncStorage", error);
      }
    };

    loadSavedData();
  }, []);

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
    if (items.length > 0) {
      const lastItem = items[0]; // Get the most recently added item
      if (lastItem.fadeAnim) {
        Animated.sequence([
          Animated.timing(lastItem.fadeAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }
  }, [items]);

  // Save data to AsyncStorage whenever 'items' changes
  useEffect(() => {
    const saveData = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
      } catch (error) {
        console.error("Failed to save data to AsyncStorage", error);
      }
    };

    saveData();
  }, [items]);

  const startRecording = async () => {
    try {
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      Alert.alert("Error", "Failed to start recording");
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (uri) {
        const base64Audio = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (!getApiKey()) {
          onRequireApiKey();
          return;
        }
        const genAI = new GoogleGenAI({ apiKey: getApiKey() });

        const aiParams: any = {
          model: selectedModel,
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Extract shopping items from text and return a JSON array of objects with properties: product (string), quantity (float), and price (float).
        Rules:
        Product after a number (e.g., "rollo de 100") → interpret as price.
        Default: quantity = 1.0, price = 0.0.
        Convert grams to kilograms (e.g., "500 gramos" = 0.5).

        Examples:
        "una servilleta" → [{"product":"Servilleta","quantity":1.0,"price":0.0}]
        "un rollo de 100" → [{"product":"Rollo","quantity":1.0,"price":100.0}]
        "2 desodorantes de 45 pesos y uno de 25 pesos" → [{"product":"Desodorante","quantity":2.0,"price":45.0},{"product":"Desodorante","quantity":1.0,"price":25.0}]
        "3 bolsas de leche 15 pesos" → [{"product":"Leche","quantity":3.0,"price":45.0}]
        "323 gramos de tomate a 80 el kilo" → [{"product":"Tomate","quantity":0.323,"price":80.0}]

        Output:
        Return only a JSON array or an empty array ([]) for random text.
        `,
                },
                {
                  inlineData: {
                    mimeType: "audio/wav",
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

        const completionData = result.text;

        console.log("Gemini response:", completionData);
        try {
          if (!completionData) {
            throw new Error("No response from Gemini API");
          }
          const cleanResponse = completionData
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim();

          const results = JSON.parse(cleanResponse);

          if (!Array.isArray(results)) {
            throw new Error("Invalid response format - expected an array");
          }

          const newItems: Item[] = results.map((result) => ({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            product: result.product || "",
            quantity: result.quantity?.toString() || "",
            price: result.price?.toString() || "",
            visible: true,
            priceUncertain: false,
            fadeAnim: new Animated.Value(0),
          }));

          console.log("Adding new items:", newItems);
          setItems((prevItems) => [...newItems, ...prevItems]);

          await applyWishlistAutoHide(newItems);

          newItems.forEach((item) => {
            Animated.timing(item.fadeAnim!, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }).start();
          });
        } catch (parseError) {
          console.error(
            "Parse error:",
            parseError,
            "Response:",
            completionData
          );
          Alert.alert("Error", "Failed to parse the response");
        }
      }
    } catch (error) {
      console.error("Error:", error);
      Alert.alert("Error", "Failed to process voice command");
    }
  };

  const productRef = useRef<TextInput>(null);
  const priceRef = useRef<TextInput>(null);
  const quantityRef = useRef<TextInput>(null);

  const startRainbowAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(rainbowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: false,
        }),
        Animated.timing(rainbowAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    ).start();
  };

  useEffect(() => {
    if (editingId) {
      startRainbowAnimation();
    } else {
      rainbowAnim.setValue(0);
    }
  }, [editingId]);

  const addItem = async () => {
    if (product.trim() === "") return;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    const newItem = {
      id: Date.now().toString(),
      product: product.trim(),
      quantity: quantity || "1",
      price: price || "0",
      visible: true,
      priceUncertain: false,
      fadeAnim: new Animated.Value(0),
    };

    setItems((prevItems) => [newItem, ...prevItems]);

    await applyWishlistAutoHide([newItem]);
    setProduct("");
    setPrice("");
    setQuantity("1");

    Animated.timing(newItem.fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 100);
  };

  const startEditing = (item: Item) => {
    setEditingId(item.id);
    setProduct(item.product);
    setPrice(item.price);
    setQuantity(item.quantity);
  };

  const updateItem = () => {
    if (!product || !price) {
      Alert.alert("Error", "Please fill product and price");
      return;
    }

    setItems(
      items.map((item) =>
        item.id === editingId
          ? { ...item, product, price, quantity: quantity || "1" }
          : item
      )
    );

    setEditingId(null);
    setProduct("");
    setPrice("");
    setQuantity("1");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setProduct("");
    setPrice("");
    setQuantity("1");
  };

  const removeItem = (id: string) => {
    Alert.alert("Delete Item", "Are you sure you want to delete this item?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Delete",
        onPress: () => {
          setItems(items.filter((item) => item.id !== id));
        },
        style: "destructive",
      },
    ]);
  };

  const toggleVisibility = (id: string) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, visible: !item.visible } : item
      )
    );
  };

  const togglePriceUncertain = (id: string) => {
    setItems(
      items.map((item) =>
        item.id === id ? { ...item, priceUncertain: !item.priceUncertain } : item
      )
    );
  };

  const calculateTotal = () => {
    return items
      .filter((item) => item.visible)
      .reduce(
        (sum, item) => sum + parseFloat(item.price) * parseFloat(item.quantity),
        0
      )
      .toFixed(2);
  };

  // New function to clear all items
  const clearAllItems = () => {
    if (items.length === 0) {
      Alert.alert("No Items", "There are no items to clear.");
      return;
    }

    Alert.alert(
      "Clear All Items",
      "Are you sure you want to remove all items from your shopping list?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Clear All",
          style: "destructive",
          onPress: () => {
            setItems([]);
          },
        },
      ]
    );
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<Item>) => {
    const isEditing = item.id === editingId;
    const borderColor = rainbowAnim
      .interpolate({
        inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
        outputRange: [
          "#ff0000",
          "#ffa500",
          "#ffff00",
          "#008000",
          "#0000ff",
          "#4b0082",
        ],
      })
      .toString();

    return (
      <ScaleDecorator>
        <TouchableOpacity onPress={() => startEditing(item)} activeOpacity={0.7} disabled={isActive}>
          <Animated.View
            style={[
              styles.item,
              !item.visible && styles.hiddenItem,
              item.priceUncertain && styles.uncertainItem,
              isEditing && {
                borderWidth: 2,
                borderColor: borderColor,
              },
              { opacity: item.fadeAnim },
            ]}
          >
            <TouchableOpacity
              onLongPress={drag}
              onPress={(e) => e.stopPropagation()}
              style={styles.dragHandle}
              disabled={isActive}
            >
              <MaterialIcons name="drag-handle" size={20} color="white" />
            </TouchableOpacity>
          <View style={styles.itemInfo}>
            <View style={styles.textContainer}>
              <Text
                style={[styles.itemText, !item.visible && styles.hiddenText]}
                numberOfLines={2}
              >
                {item.product}
              </Text>
              <View style={styles.quantityPriceContainer}>
                <Text
                  style={[styles.itemText, !item.visible && styles.hiddenText]}
                >
                  {item.quantity}
                </Text>
                <Text
                  style={[styles.itemText, !item.visible && styles.hiddenText]}
                >
                  •
                </Text>
                <Text
                  style={[styles.itemText, !item.visible && styles.hiddenText]}
                >
                  ${item.price}
                </Text>
                <Text
                  style={[styles.itemText, !item.visible && styles.hiddenText]}
                >
                  •
                </Text>
                <Text
                  style={[
                    styles.subtotalText,
                    !item.visible && styles.hiddenText,
                  ]}
                >
                  $
                  {(parseFloat(item.price) * parseFloat(item.quantity)).toFixed(
                    2
                  )}
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.actionButton, styles.visibilityButton]}
              onPress={(e) => {
                e.stopPropagation();
                toggleVisibility(item.id);
              }}
            >
              <MaterialIcons
                name={item.visible ? "visibility" : "visibility-off"}
                size={20}
                color="white"
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.optionalButton]}
              onPress={(e) => {
                e.stopPropagation();
                togglePriceUncertain(item.id);
              }}
            >
              <MaterialIcons
                name="help-outline"
                size={20}
                color="white"
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.removeButton]}
              onPress={(e) => {
                e.stopPropagation();
                removeItem(item.id);
              }}
            >
              <MaterialIcons name="delete" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <TouchableOpacity
        style={styles.header}
        onPress={() => setIsFormVisible(!isFormVisible)}
      >
        <Text style={styles.title}>Cart Calculator</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity onPress={clearAllItems} style={styles.clearAllIcon}>
            <MaterialIcons name="delete-sweep" size={28} color="#C62828" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.collapseButton}>
            <MaterialIcons
              name={isFormVisible ? "expand-less" : "expand-more"}
              size={28}
              color="#1976D2"
            />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      <DraggableFlatList
        ref={flatListRef}
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={{ paddingBottom: isFormVisible ? formHeight + 160 : 120 }}
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={10}
        onScrollToIndexFailed={() => {}}
        onDragEnd={({ data }) => setItems(data)}
      />

      <TouchableOpacity
        style={[
          styles.totalContainer,
          { bottom: isFormVisible ? formHeight + 20 : 20 },
        ]}
        onPress={() => setIsFormVisible(!isFormVisible)}
      >
        <Text style={styles.totalText}>Total: $ {calculateTotal()}</Text>
      </TouchableOpacity>

      {isFormVisible && (
        <View style={styles.inputContainer} onLayout={(e) => setFormHeight(e.nativeEvent.layout.height)}>
          <TextInput
            ref={productRef}
            style={styles.input}
            placeholder="Producto"
            placeholderTextColor="#666"
            value={product}
            onChangeText={setProduct}
            returnKeyType="next"
            onSubmitEditing={() => priceRef.current?.focus()}
            blurOnSubmit={false}
          />
          <View style={styles.priceQuantityContainer}>
            <Text style={styles.xSymbol}>$</Text>
            <TextInput
              ref={priceRef}
              style={[styles.input, styles.priceInput]}
              placeholder="Precio"
              placeholderTextColor="#666"
              value={price}
              onChangeText={(text) => setPrice(text.replace(/[^0-9.]/g, ""))}
              keyboardType="numeric"
              returnKeyType="next"
              onSubmitEditing={() => quantityRef.current?.focus()}
              blurOnSubmit={false}
            />
            <Text style={styles.xSymbol}>x</Text>
            <TextInput
              ref={quantityRef}
              style={[styles.input, styles.quantityInput]}
              placeholder="Cantidad"
              placeholderTextColor="#666"
              value={quantity}
              onChangeText={(text) => setQuantity(text.replace(/[^0-9.]/g, ""))}
              keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={() => {
                if (editingId) {
                  updateItem();
                } else {
                  addItem();
                }
                productRef.current?.focus();
              }}
            />
          </View>
          {editingId ? (
            <View style={styles.editButtonsContainer}>
              <TouchableOpacity
                style={[styles.addButton, styles.updateButton]}
                onPress={updateItem}
              >
                <MaterialIcons name="check" size={24} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addButton, styles.cancelButton]}
                onPress={cancelEditing}
              >
                <MaterialIcons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.addButton} onPress={addItem}>
              <MaterialIcons name="add" size={24} color="white" />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.recordButton}
            onPress={isRecording ? stopRecording : startRecording}
          >
            <MaterialIcons
              name={isRecording ? "stop" : "mic"}
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
    padding: 20,
    backgroundColor: "#1a1a1a",
  },
  header: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    position: "relative",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
  },
  headerButtons: {
    position: "absolute",
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  clearAllIcon: {
    padding: 8,
  },
  collapseButton: {
    padding: 8,
  },
  inputContainer: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 20,
    gap: 10,
    backgroundColor: "#242424",
    padding: 15,
    borderRadius: 10,
    zIndex: 1,
  },
  input: {
    backgroundColor: "#333",
    color: "#fff",
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
  },
  item: {
    backgroundColor: "#242424",
    padding: 6,
    marginVertical: 5,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    overflow: "hidden",
  },
  itemInfo: {
    flex: 1,
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
  quantityPriceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  itemText: {
    fontSize: 16,
    color: "#fff",
  },
  subtotalText: {
    fontSize: 16,
    color: "#4CAF50",
    fontWeight: "bold",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 8,
    flexShrink: 0,
  },
  dragHandle: {
    padding: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  visibilityButton: {
    backgroundColor: "#1976D2",
  },
  optionalButton: {
    backgroundColor: "#7B1FA2",
  },
  removeButton: {
    backgroundColor: "#C62828",
  },
  addButton: {
    backgroundColor: "#1976D2",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
    height: 44,
  },
  updateButton: {
    flex: 1,
    backgroundColor: "#2E7D32",
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#F57C00",
  },
  editButtonsContainer: {
    flexDirection: "row",
    gap: 10,
  },
  recordButton: {
    backgroundColor: "#C62828",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
    height: 44,
  },
  hiddenItem: {
    opacity: 0.5,
    backgroundColor: "#1e1e1e",
  },
  uncertainItem: {
    backgroundColor: "#4527A0",
  },
  hiddenText: {
    color: "#666",
  },
  totalContainer: {
    position: "absolute",
    left: 20,
    right: 20,
    padding: 7,
    backgroundColor: "#333",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#4CAF50",
    zIndex: 2,
  },
  totalText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#4CAF50",
    textAlign: "right",
  },
  clearAllButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#C62828",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  clearAllText: {
    color: "#fff",
    fontSize: 16,
    marginLeft: 6,
  },
  list: {
    marginBottom: 20,
  },
  priceQuantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  priceInput: {
    flex: 1,
  },
  quantityInput: {
    flex: 1,
  },
  xSymbol: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginHorizontal: 8,
  },
});

export default ShoppingList;
