# Cart Calculator

Cart Calculator is a React Native app built with Expo that helps track your shopping expenses. The app lets you manage two lists:

- **Shopping List** – items you plan to buy, with quantity and price.
- **Wishlist** – items you'd like to purchase later.

The shopping list integrates with Google Gemini via the `@google/genai` SDK. You can record your voice and Gemini will parse it into structured items. Optionally an AI chat screen can be enabled.

## Features

- Add, edit and remove shopping or wishlist items.
- Voice commands for the shopping list using Gemini.
- Choose between different AI models via the new configuration menu.
- Local data stored with `AsyncStorage` so your lists persist between sessions.
- Optional **LLM Chat** screen for talking to the model.
- Works on Android, iOS and the web through Expo.

## Setup

1. Install [Node.js](https://nodejs.org/) and [Expo CLI](https://docs.expo.dev/get-started/installation/).
2. Copy `.env.example` to `.env` and fill in your Gemini API key:
   ```env
   EXPO_PUBLIC_GEMINI_API_KEY=your-api-key
   EXPO_PUBLIC_LLM_CHAT_ENABLED=true
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npx expo start
   ```
5. Use the settings button in the app header to choose between the available AI models.

## Running tests

This project uses Jest through `jest-expo`:

```bash
npm test
```

(There are currently no test files, so Jest will exit immediately.)

## Building

To create a release build for Android you can use the provided script:

```bash
./runAndroidBuild.ps1
```

For iOS or other targets see the [Expo build documentation](https://docs.expo.dev/build/introduction/).

## License

This project is licensed under the MIT License.
