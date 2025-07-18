import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  ScrollView,
} from "react-native";
import { API_KEY } from "../config";
import { GoogleGenAI } from "@google/genai";

const LLMChat: React.FC = () => {
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (inputText.trim() === "") return;

    const newMessage: { role: "user"; content: string } = {
      role: "user",
      content: inputText,
    };
    setMessages((prevMessages) => [...prevMessages, newMessage]);
    setInputText("");
    setLoading(true);

    try {
      const genAI = new GoogleGenAI({ apiKey: API_KEY });

      const result = await genAI.models.generateContent({
        model: "gemini-2.5-flash-lite-preview-06-17",
        contents: [
          ...messages.map((m) => ({
            role: m.role,
            parts: [{ text: m.content }],
          })),
          {
            role: "user",
            parts: [
              {
                text: inputText,
              },
            ],
          },
        ],
        config: {
          systemInstruction: `You are a helpful assistant that always responds at the end with a smiling emoji.`,
          thinkingConfig: {
            thinkingBudget: 0
          }
        },
      });

      const assistantMessage: { role: "assistant"; content: string } = {
        role: "assistant",
        content: result.text ?? "",
      };
      setMessages((prevMessages) => [...prevMessages, assistantMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: "assistant", content: "Failed to get response." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.messageContainer}>
        {messages.map((message, index) => (
          <View
            key={index}
            style={
              message.role === "user"
                ? styles.userMessage
                : styles.assistantMessage
            }
          >
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
    backgroundColor: "#1a1a1a",
  },
  messageContainer: {
    flex: 1,
    marginBottom: 10,
  },
  userMessage: {
    backgroundColor: "#242424",
    padding: 10,
    borderRadius: 8,
    alignSelf: "flex-end",
    marginBottom: 5,
    maxWidth: "80%",
  },
  assistantMessage: {
    backgroundColor: "#333",
    padding: 10,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: 5,
    maxWidth: "80%",
  },
  messageText: {
    color: "#fff",
  },
  loadingText: {
    color: "#fff",
    alignSelf: "center",
    marginTop: 10,
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: "#333",
    color: "#fff",
    padding: 10,
    borderRadius: 8,
    fontSize: 16,
  },
});

export default LLMChat;
