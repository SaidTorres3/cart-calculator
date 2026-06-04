package com.saidtorres3.cartcalculator

import android.util.Log
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import com.google.android.gms.wearable.WearableListenerService
import com.google.android.gms.tasks.Tasks
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Phone-side WearableListenerService.
 *
 * Handles:
 *  - /request_sync  — WearOS asks for fresh data; we re-broadcast whatever is in
 *                     the WearSyncPrefs SharedPreferences (written by WearSyncModule).
 *  - /update_cart   — WearOS sent updated cart; store it in WearSyncPrefs so the
 *                     RN JS layer can read it on next foreground.
 *  - /update_wishlist — same for wishlist.
 */
class WearDataListenerService : WearableListenerService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    companion object {
        private const val TAG = "WearDataListenerSvc"
        const val PREFS_NAME = "WearSyncPrefs"
        const val KEY_CART = "cart"
        const val KEY_WISHLIST = "wishlist"
        const val KEY_API_KEY = "apiKey"
        const val KEY_MODEL = "model"
        // Keys for data received FROM the watch (separate from phone-originated data)
        const val KEY_WATCH_CART = "watch_cart"
        const val KEY_WATCH_WISHLIST = "watch_wishlist"
    }

    override fun onDataChanged(dataEvents: DataEventBuffer) {
        Log.d(TAG, "onDataChanged: received ${dataEvents.count} events")
        dataEvents.forEach { event ->
            val path = event.dataItem.uri.path ?: return@forEach
            when (path) {
                WearSyncModule.PATH_UPDATE_CART -> {
                    Log.d(TAG, "Received cart update from watch - merging")
                    val dataMap = DataMapItem.fromDataItem(event.dataItem).dataMap
                    val cartJson = dataMap.getString(KEY_CART) ?: return@forEach
                    scope.launch {
                        val prefs = applicationContext.getSharedPreferences(
                            PREFS_NAME, MODE_PRIVATE
                        )
                        // Merge: preserve phone items not in the watch payload
                        val merged = mergeJsonById(
                            prefs.getString(KEY_CART, null),
                            cartJson
                        )
                        prefs.edit().putString(KEY_WATCH_CART, merged).apply()
                    }
                }
                WearSyncModule.PATH_UPDATE_WISHLIST -> {
                    Log.d(TAG, "Received wishlist update from watch - merging")
                    val dataMap = DataMapItem.fromDataItem(event.dataItem).dataMap
                    val wishlistJson = dataMap.getString(KEY_WISHLIST) ?: return@forEach
                    scope.launch {
                        val prefs = applicationContext.getSharedPreferences(
                            PREFS_NAME, MODE_PRIVATE
                        )
                        val merged = mergeJsonById(
                            prefs.getString(KEY_WISHLIST, null),
                            wishlistJson
                        )
                        prefs.edit().putString(KEY_WATCH_WISHLIST, merged).apply()
                    }
                }
                WearSyncModule.PATH_ADD_CART_ITEMS -> {
                    Log.d(TAG, "Received ADD cart items from watch")
                    val dataMap = DataMapItem.fromDataItem(event.dataItem).dataMap
                    val newItemsJson = dataMap.getString(KEY_CART) ?: return@forEach
                    scope.launch {
                        val prefs = applicationContext.getSharedPreferences(
                            PREFS_NAME, MODE_PRIVATE
                        )
                        // Additive: append new items, never remove existing
                        val merged = appendJsonById(
                            prefs.getString(KEY_CART, null),
                            newItemsJson
                        )
                        prefs.edit().putString(KEY_WATCH_CART, merged).apply()
                    }
                }
                WearSyncModule.PATH_ADD_WISHLIST_ITEMS -> {
                    Log.d(TAG, "Received ADD wishlist items from watch")
                    val dataMap = DataMapItem.fromDataItem(event.dataItem).dataMap
                    val newItemsJson = dataMap.getString(KEY_WISHLIST) ?: return@forEach
                    scope.launch {
                        val prefs = applicationContext.getSharedPreferences(
                            PREFS_NAME, MODE_PRIVATE
                        )
                        val merged = appendJsonById(
                            prefs.getString(KEY_WISHLIST, null),
                            newItemsJson
                        )
                        prefs.edit().putString(KEY_WATCH_WISHLIST, merged).apply()
                    }
                }
            }
        }
    }

    /**
     * Merges incoming JSON array with existing JSON array by item ID.
     * Incoming items take priority (update existing). Existing items
     * not in the incoming payload are PRESERVED.
     */
    private fun mergeJsonById(existingJson: String?, incomingJson: String): String {
        if (existingJson.isNullOrBlank()) return incomingJson
        return try {
            val existing = org.json.JSONArray(existingJson)
            val incoming = org.json.JSONArray(incomingJson)

            val incomingIds = mutableSetOf<String>()
            val result = org.json.JSONArray()

            // Incoming items first (they take priority)
            for (i in 0 until incoming.length()) {
                val obj = incoming.getJSONObject(i)
                val id = obj.optString("id", "")
                if (id.isNotEmpty()) incomingIds.add(id)
                result.put(obj)
            }

            // Preserve existing items not in the incoming payload
            for (i in 0 until existing.length()) {
                val obj = existing.getJSONObject(i)
                val id = obj.optString("id", "")
                if (id.isNotEmpty() && id !in incomingIds) {
                    result.put(obj)
                    Log.d(TAG, "mergeJsonById: preserved existing item id=$id")
                }
            }

            Log.d(TAG, "mergeJsonById: incoming=${incoming.length()}, existing=${existing.length()}, merged=${result.length()}")
            result.toString()
        } catch (e: Exception) {
            Log.e(TAG, "mergeJsonById failed, using incoming as-is", e)
            incomingJson
        }
    }

    /**
     * Appends new items to an existing JSON array, deduplicating by ID.
     * Never removes existing items.
     */
    private fun appendJsonById(existingJson: String?, newItemsJson: String): String {
        if (existingJson.isNullOrBlank()) return newItemsJson
        return try {
            val existing = org.json.JSONArray(existingJson)
            val newItems = org.json.JSONArray(newItemsJson)

            val existingIds = mutableSetOf<String>()
            for (i in 0 until existing.length()) {
                val id = existing.getJSONObject(i).optString("id", "")
                if (id.isNotEmpty()) existingIds.add(id)
            }

            // Prepend genuinely new items, then keep all existing
            val result = org.json.JSONArray()
            var added = 0
            for (i in 0 until newItems.length()) {
                val obj = newItems.getJSONObject(i)
                val id = obj.optString("id", "")
                if (id.isNotEmpty() && id !in existingIds) {
                    result.put(obj)
                    added++
                }
            }
            for (i in 0 until existing.length()) {
                result.put(existing.getJSONObject(i))
            }

            Log.d(TAG, "appendJsonById: added $added new items, total=${result.length()}")
            result.toString()
        } catch (e: Exception) {
            Log.e(TAG, "appendJsonById failed, using newItems as-is", e)
            newItemsJson
        }
    }

    override fun onMessageReceived(messageEvent: MessageEvent) {
        Log.d(TAG, "onMessageReceived: path=${messageEvent.path}")
        if (messageEvent.path == "/request_sync") {
            scope.launch { pushSyncToWatch() }
        }
    }

    private fun pushSyncToWatch() {
        Log.d(TAG, "pushSyncToWatch: reading prefs and pushing DataItem")
        try {
            val prefs = applicationContext.getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            val cart = prefs.getString(KEY_CART, "[]") ?: "[]"
            val wishlist = prefs.getString(KEY_WISHLIST, "[]") ?: "[]"
            val apiKey = prefs.getString(KEY_API_KEY, "") ?: ""
            val model = prefs.getString(KEY_MODEL, "") ?: ""
            Log.d(TAG, "pushSyncToWatch: cart=${cart.length} chars, apiKey=${if (apiKey.isNotEmpty()) "set (${apiKey.length} chars)" else "EMPTY"}")

            val request = PutDataMapRequest.create(WearSyncModule.PATH_SYNC).apply {
                dataMap.putString("cart", cart)
                dataMap.putString("wishlist", wishlist)
                dataMap.putString("apiKey", apiKey)
                dataMap.putString("model", model)
                dataMap.putLong("timestamp", System.currentTimeMillis())
            }.asPutDataRequest().setUrgent()

            Tasks.await(Wearable.getDataClient(applicationContext).putDataItem(request))
            Log.d(TAG, "pushSyncToWatch: DataItem put successfully (cart=${cart.length} chars)")
        } catch (e: Exception) {
            Log.e(TAG, "pushSyncToWatch failed", e)
        }
    }
}
