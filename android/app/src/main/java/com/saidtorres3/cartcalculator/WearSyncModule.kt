package com.saidtorres3.cartcalculator

import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

/**
 * React Native Native Module that exposes wear sync to JavaScript.
 *
 * Usage from JS/TS:
 *   import { NativeModules } from 'react-native';
 *   const { WearSync } = NativeModules;
 *   await WearSync.syncCart(shoppingJSON, wishlistJSON, budgetJSON, budgetEnabled);
 */
class WearSyncModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "WearSync"

    /**
     * Push the full cart state to any connected WearOS watches.
     */
    @ReactMethod
    fun syncCart(
        shoppingItemsJson: String,
        wishlistItemsJson: String?,
        budgetEntriesJson: String?,
        budgetEnabled: Boolean,
        promise: Promise
    ) {
        try {
            PhoneDataLayerService.syncToWatch(
                reactContext,
                shoppingItemsJson,
                wishlistItemsJson,
                budgetEntriesJson,
                budgetEnabled
            )
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("WEAR_SYNC_ERROR", e.message, e)
        }
    }
}
