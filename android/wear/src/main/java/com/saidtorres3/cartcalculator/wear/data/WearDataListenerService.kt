package com.saidtorres3.cartcalculator.wear.data

import android.util.Log
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Receives data synced from the phone app via the Wearable Data Layer API.
 *
 * - Listens on PATH_SYNC (/sync) for full data pushes from the phone.
 * - The phone sends cart items, wishlist items, API key and model name.
 */
class WearDataListenerService : WearableListenerService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var repository: DataRepository

    companion object {
        private const val TAG = "WearDataListenerSvc"
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "onCreate")
        repository = DataRepository(applicationContext)
    }

    override fun onDataChanged(dataEvents: DataEventBuffer) {
        Log.d(TAG, "onDataChanged: ${dataEvents.count} events")
        dataEvents.forEach { event ->
            val path = event.dataItem.uri.path ?: return@forEach
            Log.d(TAG, "onDataChanged path=$path type=${event.type}")
            when (path) {
                DataRepository.PATH_SYNC -> {
                    val dataMap = DataMapItem.fromDataItem(event.dataItem).dataMap
                    val cart = dataMap.getString("cart") ?: ""
                    val apiKey = dataMap.getString("apiKey") ?: ""
                    val model = dataMap.getString("model") ?: ""
                    val apiProvider = dataMap.getString("apiProvider") ?: "vertex"
                    Log.d(TAG, "Received /sync: cart=${cart.length} chars, apiKey=${if (apiKey.isNotEmpty()) "SET (${apiKey.length} chars)" else "EMPTY"}, model=$model, apiProvider=$apiProvider")
                    scope.launch {
                        repository.updateFromSyncData(dataMap)
                    }
                }
            }
        }
    }

    override fun onMessageReceived(messageEvent: MessageEvent) {
        Log.d(TAG, "onMessageReceived: ${messageEvent.path}")
    }
}
