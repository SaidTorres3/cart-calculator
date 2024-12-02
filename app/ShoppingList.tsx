import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface Item {
  id: string;
  product: string;
  quantity: string;
  price: string;
  visible: boolean;
}

export default function ShoppingList() {
  const [items, setItems] = useState<Item[]>([]);
  const [product, setProduct] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [editingId, setEditingId] = useState<string | null>(null);

  const productRef = useRef<TextInput>(null);
  const priceRef = useRef<TextInput>(null);
  const quantityRef = useRef<TextInput>(null);

  const addItem = () => {
    if (!product || !price) {
      Alert.alert('Error', 'Please fill product and price');
      return;
    }

    const newItem: Item = {
      id: Date.now().toString(),
      product,
      quantity: quantity || '1',
      price,
      visible: true,
    };

    setItems([...items, newItem]);
    setProduct('');
    setPrice('');
    setQuantity('1');
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

  const renderItem = ({ item }: { item: Item }) => (
    <View style={[styles.item, !item.visible && styles.hiddenItem]}>
      <View style={styles.itemInfo}>
        <View style={styles.textContainer}>
          <Text style={[styles.itemText, !item.visible && styles.hiddenText]} numberOfLines={2}>
            {item.product}
          </Text>
          <View style={styles.quantityPriceContainer}>
            <Text style={[styles.itemText, !item.visible && styles.hiddenText]}>
              {item.quantity}x
            </Text>
            <Text style={[styles.itemText, !item.visible && styles.hiddenText]}>•</Text>
            <Text style={[styles.itemText, !item.visible && styles.hiddenText]}>
              ${item.price}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.visibilityButton]}
          onPress={() => toggleVisibility(item.id)}
        >
          <MaterialIcons 
            name={item.visible ? "visibility" : "visibility-off"} 
            size={20} 
            color="white" 
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={() => startEditing(item)}
        >
          <MaterialIcons name="edit" size={20} color="white" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.removeButton]}
          onPress={() => removeItem(item.id)}
        >
          <MaterialIcons name="delete" size={20} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Shopping List</Text>
      
      <View style={styles.inputContainer}>
        <TextInput
          ref={productRef}
          style={styles.input}
          placeholder="Product"
          placeholderTextColor="#666"
          value={product}
          onChangeText={setProduct}
          returnKeyType="next"
          onSubmitEditing={() => priceRef.current?.focus()}
          blurOnSubmit={false}
        />
        <TextInput
          ref={priceRef}
          style={styles.input}
          placeholder="Price"
          placeholderTextColor="#666"
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
          returnKeyType="next"
          onSubmitEditing={() => quantityRef.current?.focus()}
          blurOnSubmit={false}
        />
        <TextInput
          ref={quantityRef}
          style={styles.input}
          placeholder="Quantity (default: 1)"
          placeholderTextColor="#666"
          value={quantity}
          onChangeText={setQuantity}
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
      </View>

      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        style={styles.list}
      />

      <View style={styles.totalContainer}>
        <Text style={styles.totalText}>Total: $ {calculateTotal()}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#1a1a1a',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#fff',
    textAlign: 'center',
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
    padding: 12,
    marginVertical: 5,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  editButton: {
    backgroundColor: '#2E7D32',
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
});
