import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView } from 'react-native';
import { OPENAI_API_KEY, OPENAI_CHAT_API_URL } from '../config';

const LLMChat: React.FC = () => {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (inputText.trim() === '') return;

    const newMessage: { role: 'user'; content: string } = { role: 'user', content: inputText };
    setMessages(prevMessages => [...prevMessages, newMessage]);
    setInputText('');
    setLoading(true);

    try {
      const response = await fetch(OPENAI_CHAT_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [...messages, newMessage],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Chat API Error:', errorData);
        throw new Error('Chat processing failed');
      }

      const data = await response.json();
      const assistantMessage: { role: 'assistant'; content: string } = { role: 'assistant', content: data.choices[0].message.content };
      setMessages(prevMessages => [...prevMessages, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prevMessages => [...prevMessages, { role: 'assistant', content: 'Failed to get response.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.messageContainer}>
        {messages.map((message, index) => (
          <View key={index} style={message.role === 'user' ? styles.userMessage : styles.assistantMessage}>
            <Text style={styles.messageText}>{message.content}</Text>
          </View>
        ))}
        {loading && <Text style={styles.loadingText}>Loading...</Text>}
      </ScrollView>
      <View style={styles.inputArea}>
        <TextInput
          style={styles.input}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type your message..."
          placeholderTextColor="#666"
          multiline
        />
        <Button title="Send" onPress={sendMessage} disabled={loading} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: '#1a1a1a',
  },
  messageContainer: {
    flex: 1,
    marginBottom: 10,
  },
  userMessage: {
    backgroundColor: '#242424',
    padding: 10,
    borderRadius: 8,
    alignSelf: 'flex-end',
    marginBottom: 5,
    maxWidth: '80%',
  },
  assistantMessage: {
    backgroundColor: '#333',
    padding: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 5,
    maxWidth: '80%',
  },
  messageText: {
    color: '#fff',
  },
    loadingText: {
    color: '#fff',
    alignSelf: 'center',
    marginTop: 10,
  },
  inputArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#333',
    color: '#fff',
    padding: 10,
    borderRadius: 8,
    fontSize: 16,
  },
});

export default LLMChat;