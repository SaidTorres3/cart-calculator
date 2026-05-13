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
    }

    val cartItems: Flow<List<CartItem>> = context.dataStore.data.map { prefs ->
        cartItemsFromJson(prefs[KEY_CART] ?: "")
    }

    val wishlistItems: Flow<List<WishlistItem>> = context.dataStore.data.map { prefs ->
        wishlistItemsFromJson(prefs[KEY_WISHLIST] ?: "")
    }

    val apiKey: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[KEY_API_KEY] ?: ""
    }

    val selectedModel: Flow<String> = context.dataStore.data.map { prefs ->
        prefs[KEY_MODEL] ?: "gemini-2.5-flash-lite"
    }

    suspend fun updateFromSyncData(dataMap: DataMap) {
        context.dataStore.edit { prefs ->
            dataMap.getString("cart")?.let { prefs[KEY_CART] = it }
            dataMap.getString("wishlist")?.let { prefs[KEY_WISHLIST] = it }
            dataMap.getString("apiKey")?.let { if (it.isNotEmpty()) prefs[KEY_API_KEY] = it }
            dataMap.getString("model")?.let { if (it.isNotEmpty()) prefs[KEY_MODEL] = it }
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

    // Pushes updated cart to the phone via Wearable Data Layer
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

    // Pushes updated wishlist to the phone via Wearable Data Layer
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
