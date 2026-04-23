package com.saidtorres3.cartcalculator.wear

import kotlinx.serialization.Serializable

/**
 * Mirrors the Item interface from ShoppingList.tsx / Wishlist.tsx
 */
@Serializable
data class CartItem(
    val id: String,
    val product: String,
    val quantity: String,
    val price: String,
    val visible: Boolean,
    val priceUncertain: Boolean = false
)

@Serializable
data class CartState(
    val shoppingItems: List<CartItem> = emptyList(),
    val wishlistItems: List<CartItem> = emptyList(),
    val budgetTotal: Double = 0.0,
    val budgetEnabled: Boolean = false
) {
    val cartTotal: Double
        get() = shoppingItems
            .filter { it.visible }
            .sumOf { (it.price.toDoubleOrNull() ?: 0.0) * (it.quantity.toDoubleOrNull() ?: 1.0) }

    val budgetRemaining: Double
        get() = budgetTotal - cartTotal
}

// Data Layer path constants shared between phone and watch
object WearPaths {
    const val PATH_CART_STATE = "/cart/state"
    const val PATH_TOGGLE_ITEM = "/cart/toggle"
    const val KEY_JSON_PAYLOAD = "json_payload"
    const val KEY_ITEM_ID = "item_id"
    const val CHANNEL_SHOPPING = "shopping"
}
