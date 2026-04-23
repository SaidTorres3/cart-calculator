package com.saidtorres3.cartcalculator.wear

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import android.util.Log

class CartViewModel(application: Application) : AndroidViewModel(application) {

    val cartState: StateFlow<CartState> = CartRepository.cartState

    /**
     * Toggle item visibility:
     *  1. Optimistically update local UI
     *  2. Send message to phone for authoritative update
     */
    fun toggleItem(itemId: String) {
        // Optimistic local update
        CartRepository.toggleItemLocally(itemId)

        // Send message to phone
        viewModelScope.launch {
            try {
                val nodes = Wearable.getNodeClient(getApplication<Application>())
                    .connectedNodes
                    .await()

                val messageClient = Wearable.getMessageClient(getApplication<Application>())
                nodes.forEach { node ->
                    messageClient.sendMessage(
                        node.id,
                        WearPaths.PATH_TOGGLE_ITEM,
                        itemId.toByteArray()
                    ).await()
                    Log.d(TAG, "Toggle sent for item $itemId to ${node.displayName}")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to send toggle message", e)
            }
        }
    }

    companion object {
        private const val TAG = "CartViewModel"
    }
}
