package com.saidtorres3.cartcalculator

import android.content.Context
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap
import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable

/**
 * React Native native module that pushes the current cart/wishlist/settings
 * to the paired WearOS device via the Wearable Data Layer API.
 *
 * Call from JS via NativeModules.WearSync.syncData(cart, wishlist, apiKey, model).
 */
class WearSyncModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "WearSync"

    companion object {
        private const val TAG = "WearSyncModule"
        const val PATH_SYNC = "/sync"
        const val PATH_UPDATE_CART = "/update_cart"
        const val PATH_UPDATE_WISHLIST = "/update_wishlist"
    }

    @ReactMethod
    fun syncData(cartJson: String, wishlistJson: String, apiKey: String, model: String) {
        Log.d(TAG, "syncData called: cart=${cartJson.length} chars, apiKey=${if (apiKey.isNotEmpty()) "set" else "empty"}")
        val context: Context = reactContext.applicationContext

        // Mirror data into SharedPreferences so WearDataListenerService can
        // respond to /request_sync even when the RN JS runtime is not running.
        val prefs = context.getSharedPreferences(WearDataListenerService.PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().apply {
            if (cartJson.isNotEmpty()) putString(WearDataListenerService.KEY_CART, cartJson)
            if (wishlistJson.isNotEmpty()) putString(WearDataListenerService.KEY_WISHLIST, wishlistJson)
            if (apiKey.isNotEmpty()) putString(WearDataListenerService.KEY_API_KEY, apiKey)
            if (model.isNotEmpty()) putString(WearDataListenerService.KEY_MODEL, model)
        }.apply()

        try {
            val request = PutDataMapRequest.create(PATH_SYNC).apply {
                dataMap.putString("cart", cartJson)
                dataMap.putString("wishlist", wishlistJson)
                dataMap.putString("apiKey", apiKey)
                dataMap.putString("model", model)
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
            // Clear after reading so we don't re-apply stale updates on next foreground
            if (cart != null || wishlist != null) {
                prefs.edit()
                    .remove(WearDataListenerService.KEY_WATCH_CART)
                    .remove(WearDataListenerService.KEY_WATCH_WISHLIST)
                    .apply()
            }
            val map = WritableNativeMap().apply {
                putString("cart", cart)
                putString("wishlist", wishlist)
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("WEAR_PREFS_ERROR", e)
        }
    }
}
