package com.saidtorres3.cartcalculator.wear

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Singleton in-memory state store for the watch.
 * The WearDataListenerService writes here; the ViewModel/Composable reads from here.
 */
object CartRepository {
    private val _cartState = MutableStateFlow(CartState())
    val cartState: StateFlow<CartState> = _cartState.asStateFlow()

    fun updateState(newState: CartState) {
        _cartState.value = newState
    }

    /**
     * Optimistically toggle an item's visibility locally while the phone confirms.
     */
    fun toggleItemLocally(itemId: String) {
        val current = _cartState.value
        val updated = current.copy(
            shoppingItems = current.shoppingItems.map { item ->
                if (item.id == itemId) item.copy(visible = !item.visible) else item
            }
        )
        _cartState.value = updated
    }
}
