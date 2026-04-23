package com.saidtorres3.cartcalculator.wear

import android.content.Context
import com.google.android.gms.wearable.DataClient
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.MessageClient
import com.google.android.gms.wearable.Wearable
import com.google.android.gms.wearable.WearableListenerService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import android.util.Log

/**
 * Receives cart state updates from the phone via the Wearable Data Layer.
 * Runs as a background service — wakes up even when app is not in foreground.
 */
class WearDataListenerService : WearableListenerService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val json = Json { ignoreUnknownKeys = true }

    override fun onDataChanged(dataEvents: DataEventBuffer) {
        dataEvents.forEach { event ->
            if (event.type == DataEvent.TYPE_CHANGED) {
                val dataItem = event.dataItem
                if (dataItem.uri.path == WearPaths.PATH_CART_STATE) {
                    val dataMap = DataMapItem.fromDataItem(dataItem).dataMap
                    val jsonPayload = dataMap.getString(WearPaths.KEY_JSON_PAYLOAD) ?: return@forEach

                    try {
                        val cartState = json.decodeFromString<CartState>(jsonPayload)
                        // Broadcast to the running activity via the repository
                        CartRepository.updateState(cartState)
                        Log.d(TAG, "Cart state updated: ${cartState.shoppingItems.size} items")
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to parse cart state", e)
                    }
                }
            }
        }
    }

    /**
     * Send a toggle-visibility message back to the phone.
     */
    fun sendToggleToPhone(context: Context, itemId: String) {
        scope.launch {
            try {
                val nodes = Wearable.getNodeClient(context).connectedNodes.await()
                val messageClient = Wearable.getMessageClient(context)
                nodes.forEach { node ->
                    messageClient.sendMessage(
                        node.id,
                        WearPaths.PATH_TOGGLE_ITEM,
                        itemId.toByteArray()
                    ).await()
                    Log.d(TAG, "Toggle message sent to phone node: ${node.displayName}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to send toggle to phone", e)
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }

    companion object {
        private const val TAG = "WearDataListener"
    }
}
