package com.saidtorres3.cartcalculator

import android.content.Context
import android.util.Log
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import com.google.android.gms.wearable.WearableListenerService
import com.google.android.gms.wearable.MessageEvent
import kotlinx.coroutines.*
import kotlinx.coroutines.tasks.await
import org.json.JSONArray
import org.json.JSONObject
import java.nio.charset.StandardCharsets

/**
 * Phone-side listener that:
 *   1. Receives toggle-item messages from the watch
 *   2. Applies the toggle to AsyncStorage (shared prefs bridge)
 *   3. Re-broadcasts updated state to React Native via an Intent
 *
 * Also provides a static helper [syncToWatch] that JS calls via WearSyncModule.
 */
class PhoneDataLayerService : WearableListenerService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onMessageReceived(messageEvent: MessageEvent) {
        if (messageEvent.path == PATH_TOGGLE_ITEM) {
            val itemId = String(messageEvent.data, StandardCharsets.UTF_8)
            Log.d(TAG, "Received toggle request from watch for item: $itemId")

            scope.launch {
                toggleItemInPrefs(applicationContext, itemId)
            }
        }
    }

    /**
     * Toggle an item's `visible` field inside the AsyncStorage-backed SharedPreferences.
     * React Native's AsyncStorage on Android stores data in a SharedPreferences file
     * named "RCTAsyncLocalStorage_V1".
     */
    private suspend fun toggleItemInPrefs(context: Context, itemId: String) {
        try {
            val prefs = context.getSharedPreferences(
                "RCTAsyncLocalStorage_V1",
                Context.MODE_PRIVATE
            )

            val json = prefs.getString("SHOPPING_ITEMS", null) ?: return
            val arr = JSONArray(json)
            val updated = JSONArray()

            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                if (obj.getString("id") == itemId) {
                    obj.put("visible", !obj.getBoolean("visible"))
                }
                updated.put(obj)
            }

            prefs.edit().putString("SHOPPING_ITEMS", updated.toString()).apply()
            Log.d(TAG, "Toggled item $itemId in SharedPreferences")

            // Re-sync updated list to the watch
            syncToWatch(context, updated.toString(), null, null, false)

        } catch (e: Exception) {
            Log.e(TAG, "Failed to toggle item in prefs", e)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }

    companion object {
        private const val TAG = "PhoneDataLayerService"
        private const val PATH_CART_STATE = "/cart/state"
        private const val PATH_TOGGLE_ITEM = "/cart/toggle"
        private const val KEY_JSON_PAYLOAD = "json_payload"

        /**
         * Push cart state to all connected WearOS nodes.
         * Called from WearSyncModule (React Native bridge).
         *
         * @param shoppingItemsJson  JSON string of shopping items array
         * @param wishlistItemsJson  JSON string of wishlist items array (nullable)
         * @param budgetEntriesJson  JSON string of budget entries array (nullable)
         * @param budgetEnabled      Whether the budget feature is on
         */
        fun syncToWatch(
            context: Context,
            shoppingItemsJson: String,
            wishlistItemsJson: String?,
            budgetEntriesJson: String?,
            budgetEnabled: Boolean
        ) {
            CoroutineScope(Dispatchers.IO + SupervisorJob()).launch {
                try {
                    // Build combined payload
                    val payload = JSONObject().apply {
                        put("shoppingItems", JSONArray(shoppingItemsJson))
                        put("wishlistItems", if (wishlistItemsJson != null) JSONArray(wishlistItemsJson) else JSONArray())
                        put("budgetEnabled", budgetEnabled)

                        // Compute budget total from entries
                        var budgetTotal = 0.0
                        if (budgetEntriesJson != null) {
                            val entries = JSONArray(budgetEntriesJson)
                            for (i in 0 until entries.length()) {
                                val amount = entries.getJSONObject(i).optString("amount", "0")
                                budgetTotal += amount.toDoubleOrNull() ?: 0.0
                            }
                        }
                        put("budgetTotal", budgetTotal)
                    }

                    val putRequest = PutDataMapRequest.create(PATH_CART_STATE).apply {
                        dataMap.putString(KEY_JSON_PAYLOAD, payload.toString())
                        // Adding timestamp forces DataLayer to treat it as always-changed
                        dataMap.putLong("timestamp", System.currentTimeMillis())
                    }

                    Wearable.getDataClient(context)
                        .putDataItem(putRequest.asPutDataRequest().setUrgent())
                        .await()

                    Log.d(TAG, "Synced cart to watch: ${shoppingItemsJson.length} chars")
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to sync to watch", e)
                }
            }
        }
    }
}
