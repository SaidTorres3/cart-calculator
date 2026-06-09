/**
 * wearSync.ts
 *
 * Pushes the current cart / wishlist / settings to the paired WearOS device
 * via the WearSync native module (Android-only).
 *
 * The phone-side WearDataListenerService also writes incoming changes from the
 * watch to WearSyncPrefs SharedPreferences. Those changes are picked up the
 * next time the RN app is foregrounded and AsyncStorage is re-read.
 */
import { NativeModules, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiKey, getApiProvider } from '../config';

// Access lazily so New Architecture TurboModules initialisation is complete
function getWearSync() {
  return NativeModules.WearSync ?? null;
}

const STORAGE_KEY_CART = 'SHOPPING_ITEMS';
const STORAGE_KEY_WISHLIST = 'WISHLIST_ITEMS';
const STORAGE_KEY_MODEL = 'SELECTED_MODEL';
const STORAGE_KEY_API_KEY = 'GEMINI_API_KEY';
const PREFS_NAME_WEAR = 'WearSyncPrefs';  // mirrors WearDataListenerService.PREFS_NAME

/**
 * Syncs ALL current data (cart + wishlist + apiKey + model + apiProvider) to the WearOS app.
 *
 * Accepts optional overrides so callers that already have the latest data in
 * memory can avoid re-reading from AsyncStorage.
 */
export async function syncToWear(opts?: {
  cartJson?: string;
  wishlistJson?: string;
  apiKey?: string;
  model?: string;
  budgetEnabled?: boolean;
  budgetEntriesJson?: string;
  apiProvider?: string;
  autoHideWishlist?: boolean;
}): Promise<void> {
  const WearSync = getWearSync();
  if (Platform.OS !== 'android' || !WearSync) {
    console.warn('[WearSync] Not available: OS=' + Platform.OS + ', WearSync=' + WearSync);
    return;
  }

  try {
    const [cartRaw, wishlistRaw, modelRaw, apiKeyRaw, budgetEnabledRaw, budgetEntriesRaw, apiProviderRaw, autoHideWishlistRaw] = await Promise.all([
      opts?.cartJson !== undefined
        ? Promise.resolve(opts.cartJson)
        : AsyncStorage.getItem(STORAGE_KEY_CART).then((v) => v ?? '[]'),
      opts?.wishlistJson !== undefined
        ? Promise.resolve(opts.wishlistJson)
        : AsyncStorage.getItem(STORAGE_KEY_WISHLIST).then((v) => v ?? '[]'),
      opts?.model !== undefined
        ? Promise.resolve(opts.model)
        : AsyncStorage.getItem(STORAGE_KEY_MODEL).then((v) => v ?? ''),
      opts?.apiKey !== undefined
        ? Promise.resolve(opts.apiKey)
        : AsyncStorage.getItem(STORAGE_KEY_API_KEY).then((v) => v ?? getApiKey() ?? ''),
      opts?.budgetEnabled !== undefined
        ? Promise.resolve(opts.budgetEnabled)
        : AsyncStorage.getItem('BUDGET_ENABLED').then((v) => v === 'true'),
      opts?.budgetEntriesJson !== undefined
        ? Promise.resolve(opts.budgetEntriesJson)
        : AsyncStorage.getItem('BUDGET_ENTRIES').then((v) => v ?? '[]'),
      opts?.apiProvider !== undefined
        ? Promise.resolve(opts.apiProvider)
        : AsyncStorage.getItem('GEMINI_API_PROVIDER').then((v) => v ?? getApiProvider() ?? 'vertex'),
      opts?.autoHideWishlist !== undefined
        ? Promise.resolve(opts.autoHideWishlist)
        : AsyncStorage.getItem('AUTO_HIDE_WISHLIST_ON_ADD').then((v) => v !== 'false'),
    ]);

    console.log('[WearSync] syncData: cart=' + cartRaw.length + ', apiKey=' + (apiKeyRaw ? 'SET' : 'EMPTY') + ', model=' + modelRaw + ', budgetEnabled=' + budgetEnabledRaw + ', apiProvider=' + apiProviderRaw + ', autoHideWishlist=' + autoHideWishlistRaw);
    WearSync.syncData(cartRaw, wishlistRaw, apiKeyRaw, modelRaw, budgetEnabledRaw, budgetEntriesRaw, apiProviderRaw, autoHideWishlistRaw);
  } catch (e) {
    // Non-critical: WearOS sync failures should not disrupt the main app.
    console.warn('[WearSync] sync failed:', e);
  }
}

/**
 * Reads any cart/wishlist/budget updates written by the watch back to the phone.
 * Returns null values if no watch updates are available.
 * Call this when the app comes to foreground.
 */
export async function getWatchUpdates(): Promise<{ cart: string | null; wishlist: string | null; budget: string | null }> {
  const WearSync = getWearSync();
  if (Platform.OS !== 'android' || !WearSync?.getWatchUpdates) return { cart: null, wishlist: null, budget: null };
  try {
    return await WearSync.getWatchUpdates();
  } catch {
    return { cart: null, wishlist: null, budget: null };
  }
}

