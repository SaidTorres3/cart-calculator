package com.saidtorres3.cartcalculator

import android.content.Context
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable

/**
 * React Native native module that pushes the current cart/wishlist/settings
 * to the paired WearOS device via the Wearable Data Layer API.
 *
 * Also registers a live DataClient listener when the app is in the foreground so
 * that cart/wishlist updates pushed FROM the watch are received in real-time and
 * emitted to the JS layer as "WearDataUpdated" events (instead of waiting for the
 * next foreground/AppState transition).
 *
 * Call from JS via NativeModules.WearSync.syncData(cart, wishlist, apiKey, model).
 */
class WearSyncModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext),
    LifecycleEventListener,
    DataClient.OnDataChangedListener {

    init {
        reactContext.addLifecycleEventListener(this)
    }

    override fun getName(): String = "WearSync"

    companion object {
        private const val TAG = "WearSyncModule"
        const val PATH_SYNC = "/sync"
        const val PATH_UPDATE_CART = "/update_cart"
        const val PATH_UPDATE_WISHLIST = "/update_wishlist"
        const val PATH_ADD_CART_ITEMS = "/add_cart_items"
        const val PATH_ADD_WISHLIST_ITEMS = "/add_wishlist_items"
        const val PATH_UPDATE_BUDGET = "/update_budget"
        const val PATH_ADD_BUDGET_ITEMS = "/add_budget_items"
        const val EVENT_WEAR_DATA_UPDATED = "WearDataUpdated"
    }

    // --- LifecycleEventListener -----------------------------------------------

    override fun onHostResume() {
        Wearable.getDataClient(reactContext).addListener(this)
        Log.d(TAG, "onHostResume: DataClient live listener registered")
    }

    override fun onHostPause() {
        Wearable.getDataClient(reactContext).removeListener(this)
        Log.d(TAG, "onHostPause: DataClient live listener unregistered")
    }

    override fun onHostDestroy() {
        Wearable.getDataClient(reactContext).removeListener(this)
    }

    // --- DataClient.OnDataChangedListener -------------------------------------

    override fun onDataChanged(dataEvents: DataEventBuffer) {
        dataEvents.forEach { event ->
            val path = event.dataItem.uri.path ?: return@forEach
            Log.d(TAG, "onDataChanged: path=$path")
            when (path) {
                PATH_UPDATE_CART -> {
                    val dataMap = DataMapItem.fromDataItem(event.dataItem).dataMap
                    val cartJson = dataMap.getString("cart") ?: return@forEach
                    Log.d(TAG, "onDataChanged: cart from watch (${cartJson.length} chars) - merging")
                    // Merge: preserve phone items not in the watch payload
                    val merged = mergeCartJson(cartJson)
                    reactContext.applicationContext
                        .getSharedPreferences(WearDataListenerService.PREFS_NAME, Context.MODE_PRIVATE)
                        .edit().putString(WearDataListenerService.KEY_WATCH_CART, merged).apply()
                    emitEvent(EVENT_WEAR_DATA_UPDATED, Arguments.createMap().apply {
                        putString("type", "cart")
                        putString("data", merged)
                    })
                }
                PATH_UPDATE_WISHLIST -> {
                    val dataMap = DataMapItem.fromDataItem(event.dataItem).dataMap
                    val wishlistJson = dataMap.getString("wishlist") ?: return@forEach
                    Log.d(TAG, "onDataChanged: wishlist from watch (${wishlistJson.length} chars) - merging")
                    // Merge: preserve phone items not in the watch payload
                    val merged = mergeWishlistJson(wishlistJson)
                    reactContext.applicationContext
                        .getSharedPreferences(WearDataListenerService.PREFS_NAME, Context.MODE_PRIVATE)
                        .edit().putString(WearDataListenerService.KEY_WATCH_WISHLIST, merged).apply()
                    emitEvent(EVENT_WEAR_DATA_UPDATED, Arguments.createMap().apply {
                        putString("type", "wishlist")
                        putString("data", merged)
                    })
                }
                PATH_UPDATE_BUDGET -> {
                    val dataMap = DataMapItem.fromDataItem(event.dataItem).dataMap
                    val budgetJson = dataMap.getString("budget") ?: return@forEach
                    Log.d(TAG, "onDataChanged: budget from watch (${budgetJson.length} chars) - merging")
                    val merged = mergeBudgetJson(budgetJson)
                    reactContext.applicationContext
                        .getSharedPreferences(WearDataListenerService.PREFS_NAME, Context.MODE_PRIVATE)
                        .edit().putString("watch_budget", merged).apply()
                    emitEvent(EVENT_WEAR_DATA_UPDATED, Arguments.createMap().apply {
                        putString("type", "budget")
                        putString("data", merged)
                    })
                }
                PATH_ADD_CART_ITEMS -> {
                    val dataMap = DataMapItem.fromDataItem(event.dataItem).dataMap
                    val newItemsJson = dataMap.getString("cart") ?: return@forEach
                    Log.d(TAG, "onDataChanged: ADD cart items from watch (${newItemsJson.length} chars)")
                    // Additive: append new items (dedup by ID)
                    val merged = appendCartJson(newItemsJson)
                    reactContext.applicationContext
                        .getSharedPreferences(WearDataListenerService.PREFS_NAME, Context.MODE_PRIVATE)
                        .edit().putString(WearDataListenerService.KEY_WATCH_CART, merged).apply()
                    emitEvent(EVENT_WEAR_DATA_UPDATED, Arguments.createMap().apply {
                        putString("type", "cart")
                        putString("data", merged)
                    })
                }
                PATH_ADD_WISHLIST_ITEMS -> {
                    val dataMap = DataMapItem.fromDataItem(event.dataItem).dataMap
                    val newItemsJson = dataMap.getString("wishlist") ?: return@forEach
                    Log.d(TAG, "onDataChanged: ADD wishlist items from watch (${newItemsJson.length} chars)")
                    // Additive: append new items (dedup by ID)
                    val merged = appendWishlistJson(newItemsJson)
                    reactContext.applicationContext
                        .getSharedPreferences(WearDataListenerService.PREFS_NAME, Context.MODE_PRIVATE)
                        .edit().putString(WearDataListenerService.KEY_WATCH_WISHLIST, merged).apply()
                    emitEvent(EVENT_WEAR_DATA_UPDATED, Arguments.createMap().apply {
                        putString("type", "wishlist")
                        putString("data", merged)
                    })
                }
                PATH_ADD_BUDGET_ITEMS -> {
                    val dataMap = DataMapItem.fromDataItem(event.dataItem).dataMap
                    val newItemsJson = dataMap.getString("budget") ?: return@forEach
                    Log.d(TAG, "onDataChanged: ADD budget items from watch (${newItemsJson.length} chars)")
                    val merged = appendBudgetJson(newItemsJson)
                    reactContext.applicationContext
                        .getSharedPreferences(WearDataListenerService.PREFS_NAME, Context.MODE_PRIVATE)
                        .edit().putString("watch_budget", merged).apply()
                    emitEvent(EVENT_WEAR_DATA_UPDATED, Arguments.createMap().apply {
                        putString("type", "budget")
                        putString("data", merged)
                    })
                }
            }
        }
    }

    private fun emitEvent(name: String, params: WritableMap) {
        try {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(name, params)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to emit event $name", e)
        }
    }

    @ReactMethod
    fun syncData(cartJson: String, wishlistJson: String, apiKey: String, model: String, budgetEnabled: Boolean, budgetEntriesJson: String, apiProvider: String, autoHideWishlist: Boolean) {
        Log.e(TAG, "syncData called: cart=${cartJson.length} chars, apiKey=${if (apiKey.isNotEmpty()) "SET (${apiKey.length} chars)" else "EMPTY"}, budgetEnabled=$budgetEnabled, apiProvider=$apiProvider, autoHideWishlist=$autoHideWishlist")
        val context: Context = reactContext.applicationContext

        // Mirror data into SharedPreferences so WearDataListenerService can
        // respond to /request_sync even when the RN JS runtime is not running.
        val prefs = context.getSharedPreferences(WearDataListenerService.PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().also {
            it.putString(WearDataListenerService.KEY_CART, cartJson)
            it.putString(WearDataListenerService.KEY_WISHLIST, wishlistJson)
            it.putString(WearDataListenerService.KEY_API_KEY, apiKey)
            it.putString(WearDataListenerService.KEY_MODEL, model)
            it.putBoolean("budgetEnabled", budgetEnabled)
            it.putString("budgetEntries", budgetEntriesJson)
            it.putString("apiProvider", apiProvider)
            it.putBoolean("autoHideWishlist", autoHideWishlist)
            it.apply()
        }

        try {
            val request = PutDataMapRequest.create(PATH_SYNC).apply {
                dataMap.putString("cart", cartJson)
                dataMap.putString("wishlist", wishlistJson)
                dataMap.putString("apiKey", apiKey)
                dataMap.putString("model", model)
                dataMap.putBoolean("budgetEnabled", budgetEnabled)
                dataMap.putString("budgetEntries", budgetEntriesJson)
                dataMap.putString("apiProvider", apiProvider)
                dataMap.putBoolean("autoHideWishlist", autoHideWishlist)
                dataMap.putLong("timestamp", System.currentTimeMillis())
            }.asPutDataRequest().setUrgent()

            // Fire-and-forget on a background thread
            Thread {
                try {
                    Tasks.await(Wearable.getDataClient(context).putDataItem(request))
                    Log.d(TAG, "syncData: DataItem put to /sync successfully")
                } catch (e: Exception) {
                    Log.e(TAG, "syncData: putDataItem failed", e)
                }
            }.start()
        } catch (e: Exception) {
            Log.e(TAG, "syncData: failed to build request", e)
        }
    }

    /**
     * Returns the latest cart and wishlist JSON that was received from the watch
     * (stored in WearSyncPrefs by WearDataListenerService).
     * The JS layer calls this when coming to foreground to pick up watch-side edits.
     */
    @ReactMethod
    fun getWatchUpdates(promise: Promise) {
        try {
            val prefs = reactContext.applicationContext
                .getSharedPreferences(WearDataListenerService.PREFS_NAME, Context.MODE_PRIVATE)
            val cart = prefs.getString(WearDataListenerService.KEY_WATCH_CART, null)
            val wishlist = prefs.getString(WearDataListenerService.KEY_WATCH_WISHLIST, null)
            val budget = prefs.getString("watch_budget", null)
            // Clear after reading so we don't re-apply stale updates on next foreground
            if (cart != null || wishlist != null || budget != null) {
                prefs.edit()
                    .remove(WearDataListenerService.KEY_WATCH_CART)
                    .remove(WearDataListenerService.KEY_WATCH_WISHLIST)
                    .remove("watch_budget")
                    .apply()
            }
            val map = WritableNativeMap().apply {
                putString("cart", cart)
                putString("wishlist", wishlist)
                putString("budget", budget)
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("WEAR_PREFS_ERROR", e)
        }
    }

    // ---- Merge helpers -------------------------------------------------------
    // These ensure the phone never loses items during sync from the watch.

    /**
     * Merges incoming cart JSON from the watch with existing phone cart.
     * Items present in the watch payload update the phone version (by ID).
     * Items on the phone NOT in the watch payload are PRESERVED.
     * New items from the watch are prepended.
     */
    private fun mergeCartJson(incomingJson: String): String {
        return try {
            val existingJson = reactContext.applicationContext
                .getSharedPreferences(WearDataListenerService.PREFS_NAME, Context.MODE_PRIVATE)
                .getString(WearDataListenerService.KEY_CART, null)
                ?: return incomingJson // No existing data, use incoming as-is

            val existing = org.json.JSONArray(existingJson)
            val incoming = org.json.JSONArray(incomingJson)

            val existingById = mutableMapOf<String, org.json.JSONObject>()
            for (i in 0 until existing.length()) {
                val obj = existing.getJSONObject(i)
                val id = obj.optString("id", "")
                if (id.isNotEmpty()) existingById[id] = obj
            }

            val incomingIds = mutableSetOf<String>()
            val result = org.json.JSONArray()

            // First: add all incoming items (they take priority for updates)
            for (i in 0 until incoming.length()) {
                val obj = incoming.getJSONObject(i)
                val id = obj.optString("id", "")
                if (id.isNotEmpty()) incomingIds.add(id)
                result.put(obj)
            }

            // Then: preserve any existing items NOT in the incoming payload
            for (i in 0 until existing.length()) {
                val obj = existing.getJSONObject(i)
                val id = obj.optString("id", "")
                if (id.isNotEmpty() && id !in incomingIds) {
                    result.put(obj)
                    Log.d(TAG, "mergeCartJson: preserved phone-only item id=$id")
                }
            }

            Log.d(TAG, "mergeCartJson: incoming=${incoming.length()}, existing=${existing.length()}, merged=${result.length()}")
            result.toString()
        } catch (e: Exception) {
            Log.e(TAG, "mergeCartJson failed, using incoming as-is", e)
            incomingJson
        }
    }

    /**
     * Merges incoming wishlist JSON from the watch with existing phone wishlist.
     * Same merge logic as cart.
     */
    private fun mergeWishlistJson(incomingJson: String): String {
        return try {
            val existingJson = reactContext.applicationContext
                .getSharedPreferences(WearDataListenerService.PREFS_NAME, Context.MODE_PRIVATE)
                .getString(WearDataListenerService.KEY_WISHLIST, null)
                ?: return incomingJson

            val existing = org.json.JSONArray(existingJson)
            val incoming = org.json.JSONArray(incomingJson)

            val incomingIds = mutableSetOf<String>()
            val result = org.json.JSONArray()

            for (i in 0 until incoming.length()) {
                val obj = incoming.getJSONObject(i)
                val id = obj.optString("id", "")
                if (id.isNotEmpty()) incomingIds.add(id)
                result.put(obj)
            }

            for (i in 0 until existing.length()) {
                val obj = existing.getJSONObject(i)
                val id = obj.optString("id", "")
                if (id.isNotEmpty() && id !in incomingIds) {
                    result.put(obj)
                    Log.d(TAG, "mergeWishlistJson: preserved phone-only item id=$id")
                }
            }

            Log.d(TAG, "mergeWishlistJson: incoming=${incoming.length()}, existing=${existing.length()}, merged=${result.length()}")
            result.toString()
        } catch (e: Exception) {
            Log.e(TAG, "mergeWishlistJson failed, using incoming as-is", e)
            incomingJson
        }
    }

    /**
     * Appends new cart items from the watch to the existing phone cart.
     * Only adds items with IDs not already present. Never removes existing items.
     */
    private fun appendCartJson(newItemsJson: String): String {
        return try {
            val existingJson = reactContext.applicationContext
                .getSharedPreferences(WearDataListenerService.PREFS_NAME, Context.MODE_PRIVATE)
                .getString(WearDataListenerService.KEY_CART, null)

            if (existingJson.isNullOrBlank()) return newItemsJson

            val existing = org.json.JSONArray(existingJson)
            val newItems = org.json.JSONArray(newItemsJson)

            val existingIds = mutableSetOf<String>()
            for (i in 0 until existing.length()) {
                val id = existing.getJSONObject(i).optString("id", "")
                if (id.isNotEmpty()) existingIds.add(id)
            }

            // Prepend new items (only those with new IDs)
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
            // Then add all existing items
            for (i in 0 until existing.length()) {
                result.put(existing.getJSONObject(i))
            }

            Log.d(TAG, "appendCartJson: added $added new items, total=${result.length()}")
            result.toString()
        } catch (e: Exception) {
            Log.e(TAG, "appendCartJson failed, using newItems as-is", e)
            newItemsJson
        }
    }

    /**
     * Appends new wishlist items from the watch to the existing phone wishlist.
     * Only adds items with IDs not already present. Never removes existing items.
     */
    private fun appendWishlistJson(newItemsJson: String): String {
        return try {
            val existingJson = reactContext.applicationContext
                .getSharedPreferences(WearDataListenerService.PREFS_NAME, Context.MODE_PRIVATE)
                .getString(WearDataListenerService.KEY_WISHLIST, null)

            if (existingJson.isNullOrBlank()) return newItemsJson

            val existing = org.json.JSONArray(existingJson)
            val newItems = org.json.JSONArray(newItemsJson)

            val existingIds = mutableSetOf<String>()
            for (i in 0 until existing.length()) {
                val id = existing.getJSONObject(i).optString("id", "")
                if (id.isNotEmpty()) existingIds.add(id)
            }

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

            Log.d(TAG, "appendWishlistJson: added $added new items, total=${result.length()}")
            result.toString()
        } catch (e: Exception) {
            Log.e(TAG, "appendWishlistJson failed, using newItems as-is", e)
            newItemsJson
        }
    }

    private fun mergeBudgetJson(incomingJson: String): String {
        return try {
            val existingJson = reactContext.applicationContext
                .getSharedPreferences(WearDataListenerService.PREFS_NAME, Context.MODE_PRIVATE)
                .getString("budgetEntries", null)
                ?: return incomingJson

            val existing = org.json.JSONArray(existingJson)
            val incoming = org.json.JSONArray(incomingJson)

            val existingById = mutableMapOf<String, org.json.JSONObject>()
            for (i in 0 until existing.length()) {
                val obj = existing.getJSONObject(i)
                val id = obj.optString("id", "")
                if (id.isNotEmpty()) existingById[id] = obj
            }

            val incomingIds = mutableSetOf<String>()
            val result = org.json.JSONArray()

            for (i in 0 until incoming.length()) {
                val obj = incoming.getJSONObject(i)
                val id = obj.optString("id", "")
                if (id.isNotEmpty()) incomingIds.add(id)
                result.put(obj)
            }

            for (i in 0 until existing.length()) {
                val obj = existing.getJSONObject(i)
                val id = obj.optString("id", "")
                if (id.isNotEmpty() && id !in incomingIds) {
                    result.put(obj)
                }
            }
            result.toString()
        } catch (e: Exception) {
            incomingJson
        }
    }

    private fun appendBudgetJson(newItemsJson: String): String {
        return try {
            val existingJson = reactContext.applicationContext
                .getSharedPreferences(WearDataListenerService.PREFS_NAME, Context.MODE_PRIVATE)
                .getString("budgetEntries", null)

            if (existingJson.isNullOrBlank()) return newItemsJson

            val existing = org.json.JSONArray(existingJson)
            val newItems = org.json.JSONArray(newItemsJson)

            val existingIds = mutableSetOf<String>()
            for (i in 0 until existing.length()) {
                val id = existing.getJSONObject(i).optString("id", "")
                if (id.isNotEmpty()) existingIds.add(id)
            }

            val result = org.json.JSONArray()
            for (i in 0 until newItems.length()) {
                val obj = newItems.getJSONObject(i)
                val id = obj.optString("id", "")
                if (id.isNotEmpty() && id !in existingIds) {
                    result.put(obj)
                }
            }
            for (i in 0 until existing.length()) {
                result.put(existing.getJSONObject(i))
            }
            result.toString()
        } catch (e: Exception) {
            newItemsJson
        }
    }
}

