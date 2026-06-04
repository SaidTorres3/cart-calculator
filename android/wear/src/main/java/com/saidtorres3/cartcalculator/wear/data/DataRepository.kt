package com.saidtorres3.cartcalculator.wear.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.DataMap
import com.google.android.gms.wearable.PutDataMapRequest
import com.google.android.gms.wearable.Wearable
import com.saidtorres3.cartcalculator.wear.model.CartItem
import com.saidtorres3.cartcalculator.wear.model.WishlistItem
import com.saidtorres3.cartcalculator.wear.model.cartItemsFromJson
import com.saidtorres3.cartcalculator.wear.model.toJsonString
import com.saidtorres3.cartcalculator.wear.model.wishlistItemsFromJson
import com.saidtorres3.cartcalculator.wear.model.wishlistToJsonString
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val Context.dataStore by preferencesDataStore(name = "wear_data")

class DataRepository(private val context: Context) {

    companion object {
        val KEY_CART = stringPreferencesKey("cart_items")
        val KEY_WISHLIST = stringPreferencesKey("wishlist_items")
        val KEY_API_KEY = stringPreferencesKey("api_key")
        val KEY_MODEL = stringPreferencesKey("selected_model")

        // Wearable Data Layer paths
        const val PATH_SYNC = "/sync"
        const val PATH_REQUEST_SYNC = "/request_sync"
        const val PATH_UPDATE_CART = "/update_cart"
        const val PATH_UPDATE_WISHLIST = "/update_wishlist"
        const val PATH_ADD_CART_ITEMS = "/add_cart_items"
        const val PATH_ADD_WISHLIST_ITEMS = "/add_wishlist_items"
    }

    init {
        Log.d("DataRepository", "Initialized with context: $context")
    }

    val cartItems: Flow<List<CartItem>> = context.dataStore.data.map { prefs ->
        cartItemsFromJson(prefs[KEY_CART] ?: "")
    }

    val wishlistItems: Flow<List<WishlistItem>> = context.dataStore.data.map { prefs ->
        wishlistItemsFromJson(prefs[KEY_WISHLIST] ?: "")
    }

    val apiKeyFlow: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[KEY_API_KEY] ?: ""
    }

    val selectedModel: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[KEY_MODEL] ?: "gemini-2.5-flash-lite"
    }

    suspend fun updateFromSyncData(dataMap: DataMap) {
        val cart = dataMap.getString("cart") ?: ""
        val wishlist = dataMap.getString("wishlist") ?: ""
        val apiKey = dataMap.getString("apiKey") ?: ""
        val model = dataMap.getString("model") ?: ""
        Log.d("DataRepository", "updateFromSyncData: cart=${cart.length} chars, wishlist=${wishlist.length} chars, apiKey=${if (apiKey.isNotEmpty()) "SET" else "EMPTY"}, model=$model")
        context.dataStore.edit { prefs ->
            prefs[KEY_CART] = cart
            prefs[KEY_WISHLIST] = wishlist
            prefs[KEY_API_KEY] = apiKey
            prefs[KEY_MODEL] = model
        }
    }

    suspend fun saveCartItems(items: List<CartItem>) {
        context.dataStore.edit { prefs ->
            prefs[KEY_CART] = items.toJsonString()
        }
    }

    suspend fun saveWishlistItems(items: List<WishlistItem>) {
        context.dataStore.edit { prefs ->
            prefs[KEY_WISHLIST] = items.wishlistToJsonString()
        }
    }

    // Pushes updated cart to the phone via Wearable Data Layer (full list — for toggle/remove)
    fun pushCartToPhone(items: List<CartItem>) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val request = PutDataMapRequest.create(PATH_UPDATE_CART).apply {
                    dataMap.putString("cart", items.toJsonString())
                    dataMap.putLong("timestamp", System.currentTimeMillis())
                }.asPutDataRequest().setUrgent()
                Tasks.await(Wearable.getDataClient(context).putDataItem(request))
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    // Pushes ONLY new cart items to the phone (additive — phone appends, never deletes)
    fun pushNewCartItemsToPhone(newItems: List<CartItem>) {
        if (newItems.isEmpty()) return
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val request = PutDataMapRequest.create(PATH_ADD_CART_ITEMS).apply {
                    dataMap.putString("cart", newItems.toJsonString())
                    dataMap.putLong("timestamp", System.currentTimeMillis())
                }.asPutDataRequest().setUrgent()
                Tasks.await(Wearable.getDataClient(context).putDataItem(request))
                Log.d("DataRepository", "pushNewCartItemsToPhone: sent ${newItems.size} new items")
            } catch (e: Exception) {
                Log.e("DataRepository", "pushNewCartItemsToPhone failed", e)
            }
        }
    }

    // Pushes updated wishlist to the phone via Wearable Data Layer (full list — for toggle/remove)
    fun pushWishlistToPhone(items: List<WishlistItem>) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val request = PutDataMapRequest.create(PATH_UPDATE_WISHLIST).apply {
                    dataMap.putString("wishlist", items.wishlistToJsonString())
                    dataMap.putLong("timestamp", System.currentTimeMillis())
                }.asPutDataRequest().setUrgent()
                Tasks.await(Wearable.getDataClient(context).putDataItem(request))
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    // Pushes ONLY new wishlist items to the phone (additive — phone appends, never deletes)
    fun pushNewWishlistItemsToPhone(newItems: List<WishlistItem>) {
        if (newItems.isEmpty()) return
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val request = PutDataMapRequest.create(PATH_ADD_WISHLIST_ITEMS).apply {
                    dataMap.putString("wishlist", newItems.wishlistToJsonString())
                    dataMap.putLong("timestamp", System.currentTimeMillis())
                }.asPutDataRequest().setUrgent()
                Tasks.await(Wearable.getDataClient(context).putDataItem(request))
                Log.d("DataRepository", "pushNewWishlistItemsToPhone: sent ${newItems.size} new items")
            } catch (e: Exception) {
                Log.e("DataRepository", "pushNewWishlistItemsToPhone failed", e)
            }
        }
    }

    // Requests the phone to push fresh sync data
    fun requestSyncFromPhone() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val nodeClient = Wearable.getNodeClient(context)
                val nodes = Tasks.await(nodeClient.connectedNodes)
                Log.d("DataRepository", "requestSyncFromPhone: found ${nodes.size} connected nodes")
                if (nodes.isEmpty()) {
                    Log.w("DataRepository", "requestSyncFromPhone: NO connected nodes - phone not paired or not reachable!")
                }
                val messageClient = Wearable.getMessageClient(context)
                nodes.forEach { node ->
                    Log.d("DataRepository", "Sending /request_sync to node: ${node.displayName} (${node.id})")
                    Tasks.await(
                        messageClient.sendMessage(node.id, PATH_REQUEST_SYNC, ByteArray(0))
                    )
                }
            } catch (e: Exception) {
                Log.e("DataRepository", "requestSyncFromPhone failed", e)
            }
        }
    }
}
