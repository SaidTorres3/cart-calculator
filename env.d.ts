/// <reference types="expo-env" />

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      EXPO_PUBLIC_GROQ_API_KEY: string;
      EXPO_PUBLIC_OPENAI_API_KEY: string;
    }
  }
}
