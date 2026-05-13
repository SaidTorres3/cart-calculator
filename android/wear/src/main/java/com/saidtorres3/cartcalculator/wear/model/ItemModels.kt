package com.saidtorres3.cartcalculator.wear.model

import org.json.JSONArray
import org.json.JSONObject

data class CartItem(
    val id: String,
    val product: String,
    val quantity: String,
    val price: String,
    val visible: Boolean,
    val priceUncertain: Boolean = false
)

data class WishlistItem(
    val id: String,
    val product: String,
    val visible: Boolean
)

fun List<CartItem>.toJsonString(): String {
    val arr = JSONArray()
    forEach { item ->
        arr.put(JSONObject().apply {
            put("id", item.id)
            put("product", item.product)
            put("quantity", item.quantity)
            put("price", item.price)
            put("visible", item.visible)
            put("priceUncertain", item.priceUncertain)
        })
    }
    return arr.toString()
}

fun List<WishlistItem>.wishlistToJsonString(): String {
    val arr = JSONArray()
    forEach { item ->
        arr.put(JSONObject().apply {
            put("id", item.id)
            put("product", item.product)
            put("visible", item.visible)
        })
    }
    return arr.toString()
}

fun cartItemsFromJson(json: String): List<CartItem> {
    if (json.isBlank()) return emptyList()
    return try {
        val arr = JSONArray(json)
        (0 until arr.length()).map { i ->
            val obj = arr.getJSONObject(i)
            CartItem(
                id = obj.optString("id", ""),
                product = obj.optString("product", ""),
                quantity = obj.optString("quantity", "1"),
                price = obj.optString("price", "0"),
                visible = obj.optBoolean("visible", true),
                priceUncertain = obj.optBoolean("priceUncertain", false)
            )
        }
    } catch (e: Exception) {
        emptyList()
    }
}

fun wishlistItemsFromJson(json: String): List<WishlistItem> {
    if (json.isBlank()) return emptyList()
    return try {
        val arr = JSONArray(json)
        (0 until arr.length()).map { i ->
            val obj = arr.getJSONObject(i)
            WishlistItem(
                id = obj.optString("id", ""),
                product = obj.optString("product", ""),
                visible = obj.optBoolean("visible", true)
            )
        }
    } catch (e: Exception) {
        emptyList()
    }
}
