import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_KEY, OPENAI_API_KEY, GROQ_WHISPER_API_URL, OPENAI_CHAT_API_URL } from '../config';

interface Item {
  id: string;
  product: string;
  quantity: string;
  price: string;
  visible: boolean;
  fadeAnim?: Animated.Value;
}

const STORAGE_KEY = 'SHOPPING_ITEMS';

const ShoppingList: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [product, setProduct] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isFormVisible, setIsFormVisible] = useState(true);
  const rainbowAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Enable LayoutAnimation on Android
    if (Platform.OS === 'android') {
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
          const restoredItems = parsedItems.map(i => ({
            ...i,
            fadeAnim: new Animated.Value(1)
          }));
          setItems(restoredItems);
        }
      } catch (error) {
        console.error('Failed to load data from AsyncStorage', error);
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
          })
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
        console.error('Failed to save data to AsyncStorage', error);
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
      Alert.alert('Error', 'Failed to start recording');
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
        // Convert audio to base64
        const base64Audio = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Create form data for the API request
        const formData = new FormData();
        formData.append('file', {
          name: 'audio.wav',
          type: 'audio/wav',
          uri,
        } as any);
        formData.append('model', 'whisper-large-v3-turbo');
        formData.append('response_format', 'verbose_json');

        // Transcribe with Whisper using Groq's API
        const transcriptionResponse = await fetch(GROQ_WHISPER_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${API_KEY}`,
          },
          body: formData,
        });

        const transcriptionData = await transcriptionResponse.json();
        const transcribedText = transcriptionData.text;

        console.log('Transcribed text:', transcribedText);

        const chatResponse = await fetch(OPENAI_CHAT_API_URL, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: `Extract shopping items from text and return a JSON array of objects with properties: product (string), quantity (float), and price (float).

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
                role: "user",
                content: transcribedText,
              },
            ],
            temperature: 0.3,
            max_tokens: 1000,
          }),
        });

        const completionData = await chatResponse.json();

        if (!chatResponse.ok) {
          console.error('Chat API Error:', completionData);
          throw new Error('Chat processing failed');
        }

        console.log('Chat response:', completionData.choices[0].message.content);

        try {
          const cleanResponse = completionData.choices[0].message.content
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();

          const results = JSON.parse(cleanResponse);

          if (!Array.isArray(results)) {
            throw new Error('Invalid response format - expected an array');
          }

          const newItems: Item[] = results.map(result => ({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            product: result.product || '',
            quantity: result.quantity?.toString() || '',
            price: result.price?.toString() || '',
            visible: true,
            fadeAnim: new Animated.Value(0),
          }));

          console.log('Adding new items:', newItems);
          setItems(prevItems => [...newItems, ...prevItems]);

          newItems.forEach(item => {
            Animated.timing(item.fadeAnim!, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }).start();
          });
        } catch (parseError) {
          console.error('Parse error:', parseError, 'Response:', completionData.choices[0].message.content);
          Alert.alert('Error', 'Failed to parse the response');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Failed to process voice command');
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

  const addItem = () => {
    if (product.trim() === '') return;

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    const newItem = {
      id: Date.now().toString(),
      product: product.trim(),
      quantity: quantity || '1',
      price: price || '0',
      visible: true,
      fadeAnim: new Animated.Value(0),
    };

    setItems(prevItems => [newItem, ...prevItems]);
    setProduct('');
    setPrice('');
    setQuantity('1');

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
      Alert.alert('Error', 'Please fill product and price');
      return;
    }

    setItems(items.map(item =>
      item.id === editingId
        ? { ...item, product, price, quantity: quantity || '1' }
        : item
    ));

    setEditingId(null);
    setProduct('');
    setPrice('');
    setQuantity('1');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setProduct('');
    setPrice('');
    setQuantity('1');
  };

  const removeItem = (id: string) => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this item?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          onPress: () => {
            setItems(items.filter(item => item.id !== id));
          },
          style: 'destructive'
        }
      ]
    );
  };

  const toggleVisibility = (id: string) => {
    setItems(items.map(item =>
      item.id === id
        ? { ...item, visible: !item.visible }
        : item
    ));
  };

  const calculateTotal = () => {
    return items
      .filter(item => item.visible)
      .reduce((sum, item) => sum + parseFloat(item.price) * parseFloat(item.quantity), 0)
      .toFixed(2);
  };

  const renderItem = ({ item }: { item: Item }) => {
    const isEditing = item.id === editingId;
    const borderColor = rainbowAnim.interpolate({
      inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
      outputRange: [
        '#ff0000',
        '#ffa500',
        '#ffff00',
        '#008000',
        '#0000ff',
        '#4b0082'
      ]
    }).toString();

    return (
      <TouchableOpacity
        onPress={() => startEditing(item)}
        activeOpacity={0.7}
      >
        <Animated.View
          style={[
            styles.item,
            !item.visible && styles.hiddenItem,
            isEditing && {
              borderWidth: 2,
              borderColor: borderColor,
            },
            { opacity: item.fadeAnim }
          ]}
        >
          <View style={styles.itemInfo}>
            <View style={styles.textContainer}>
              <Text style={[styles.itemText, !item.visible && styles.hiddenText]} numberOfLines={2}>
                {item.product}
              </Text>
              <View style={styles.quantityPriceContainer}>
                <Text style={[styles.itemText, !item.visible && styles.hiddenText]}>
                  {item.quantity}
                </Text>
                <Text style={[styles.itemText, !item.visible && styles.hiddenText]}>&bull;</Text>
                <Text style={[styles.itemText, !item.visible && styles.hiddenText]}>
                  ${item.price}
                </Text>
                <Text style={[styles.itemText, !item.visible && styles.hiddenText]}>&bull;</Text>
                <Text style={[styles.subtotalText, !item.visible && styles.hiddenText]}>
                  ${(parseFloat(item.price) * parseFloat(item.quantity)).toFixed(2)}
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
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setIsFormVisible(!isFormVisible)}
      >
        <Text style={styles.title}>Cart Calculator</Text>
        <View style={styles.collapseButton}>
          <MaterialIcons
            name={isFormVisible ? "expand-less" : "expand-more"}
            size={28}
            color="#1976D2"
          />
        </View>
      </TouchableOpacity>

      {isFormVisible && (
        <View style={styles.inputContainer}>
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
            <TextInput
              ref={priceRef}
              style={[styles.input, styles.priceInput]}
              placeholder="Precio"
              placeholderTextColor="#666"
              value={price}
              onChangeText={text => setPrice(text.replace(/[^0-9]/g, ''))}
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
              onChangeText={text => setQuantity(text.replace(/[^0-9]/g, ''))}
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
              <TouchableOpacity style={[styles.addButton, styles.updateButton]} onPress={updateItem}>
                <MaterialIcons name="check" size={24} color="white" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.addButton, styles.cancelButton]} onPress={cancelEditing}>
                <MaterialIcons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.addButton} onPress={addItem}>
              <MaterialIcons name="add" size={24} color="white" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.recordButton} onPress={isRecording ? stopRecording : startRecording}>
            <MaterialIcons name={isRecording ? "stop" : "mic"} size={24} color="white" />
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        ref={flatListRef}
        data={items}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        style={styles.list}
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={10}
        onScrollToIndexFailed={() => {}}
      />

      <View style={styles.totalContainer}>
        <Text style={styles.totalText}>Total: $ {calculateTotal()}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  collapseButton: {
    position: 'absolute',
    right: 0,
    padding: 8,
  },
  inputContainer: {
    gap: 10,
    marginBottom: 20,
    backgroundColor: '#242424',
    padding: 15,
    borderRadius: 10,
  },
  input: {
    backgroundColor: '#333',
    color: '#fff',
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
  },
  item: {
    backgroundColor: '#242424',
    padding: 6,
    marginVertical: 5,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    overflow: 'hidden',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemText: {
    fontSize: 16,
    color: '#fff',
  },
  subtotalText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
    flexShrink: 0,
  },
  actionButton: {
    padding: 8,
    borderRadius: 8,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visibilityButton: {
    backgroundColor: '#1976D2',
  },
  removeButton: {
    backgroundColor: '#C62828',
  },
  addButton: {
    backgroundColor: '#1976D2',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    height: 44,
  },
  updateButton: {
    flex: 1,
    backgroundColor: '#2E7D32',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F57C00',
  },
  editButtonsContainer: {
    flexDirection: 'row',
    gap: 10,
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
  hiddenItem: {
    opacity: 0.5,
    backgroundColor: '#1e1e1e',
  },
  hiddenText: {
    color: '#666',
  },
  totalContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#242424',
    borderRadius: 8,
  },
  totalText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'right',
  },
  list: {
    marginBottom: 20,
  },
  priceQuantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: 'bold',
    color: '#fff',
    marginHorizontal: 8,
  },
});

export default ShoppingList;