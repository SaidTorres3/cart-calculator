import { NativeModules, Platform } from 'react-native';

const { WearSync } = NativeModules;

/**
 * Returns true if we're on Android and the WearSync native module is available.
 */
const isAvailable = Platform.OS === 'android' && !!WearSync;

/**
 * Sync the entire cart state to any connected WearOS watches.
 * Call this whenever shopping items, wishlist, or budget changes.
 *
 * @param shoppingItemsJson  JSON.stringify of the shopping items array
 * @param wishlistItemsJson  JSON.stringify of the wishlist items array
 * @param budgetEntriesJson  JSON.stringify of the budget entries array
 * @param budgetEnabled      Whether the budget feature is enabled
 */
export async function syncCartToWatch(
  shoppingItemsJson: string,
  wishlistItemsJson: string | null = null,
  budgetEntriesJson: string | null = null,
  budgetEnabled: boolean = false
): Promise<void> {
  if (!isAvailable) return;

  try {
    await WearSync.syncCart(
      shoppingItemsJson,
      wishlistItemsJson,
      budgetEntriesJson,
      budgetEnabled
    );
  } catch (error) {
    // Non-fatal: watch sync failing should never crash the phone app
    console.warn('[WearSync] Failed to sync to watch:', error);
  }
}
