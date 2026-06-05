package com.saidtorres3.cartcalculator.wear.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.rotary.onRotaryScrollEvent
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.foundation.lazy.AutoCenteringParams
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.ScalingLazyListState
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.CircularProgressIndicator
import androidx.wear.compose.material.Icon
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.dialog.Alert
import androidx.wear.compose.material.dialog.Dialog
import com.saidtorres3.cartcalculator.wear.model.CartItem
import com.saidtorres3.cartcalculator.wear.model.BudgetEntry
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.MicOff
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.HelpOutline
import kotlinx.coroutines.launch
import kotlin.math.abs

@Composable
fun CartScreen(
    items: List<CartItem>,
    budgetEnabled: Boolean,
    budgetEntries: List<BudgetEntry>,
    isRecording: Boolean,
    isProcessing: Boolean,
    focused: Boolean,
    onMicClick: () -> Unit,
    onToggleVisibility: (String) -> Unit,
    onRemove: (String) -> Unit,
    onTogglePriceUncertain: (String) -> Unit
) {
    val listState = rememberScalingLazyListState()
    val focusRequester = remember { FocusRequester() }
    val coroutineScope = rememberCoroutineScope()
    val haptic = LocalHapticFeedback.current
    var totalScroll = remember { 0f }

    // Dialog state for delete confirmation
    var showDeleteDialog by remember { mutableStateOf(false) }
    var itemToDeleteId by remember { mutableStateOf<String?>(null) }
    var itemToDeleteName by remember { mutableStateOf("") }

    // Calculate total amount of visible items
    val totalAmount = items
        .filter { it.visible }
        .sumOf { (it.price.toDoubleOrNull() ?: 0.0) * (it.quantity.toDoubleOrNull() ?: 1.0) }

    // Calculate budget total and remaining budget
    val budgetTotal = budgetEntries
        .filter { it.visible }
        .sumOf { it.amount.toDoubleOrNull() ?: 0.0 }
    val remainingBudget = budgetTotal - totalAmount

    LaunchedEffect(focused) {
        if (focused) {
            focusRequester.requestFocus()
        }
    }

    if (showDeleteDialog) {
        Dialog(
            showDialog = showDeleteDialog,
            onDismissRequest = { showDeleteDialog = false }
        ) {
            Alert(
                title = {
                    Text(
                        text = "Delete item?",
                        textAlign = TextAlign.Center,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold
                    )
                },
                content = {
                    Text(
                        text = itemToDeleteName,
                        textAlign = TextAlign.Center,
                        fontSize = 12.sp,
                        color = MaterialTheme.colors.onBackground.copy(alpha = 0.8f)
                    )
                },
                negativeButton = {
                    Button(
                        onClick = { showDeleteDialog = false },
                        colors = ButtonDefaults.secondaryButtonColors(),
                        modifier = Modifier.size(ButtonDefaults.LargeButtonSize)
                    ) {
                        Icon(imageVector = Icons.Default.Close, contentDescription = "Cancel")
                    }
                },
                positiveButton = {
                    Button(
                        onClick = {
                            itemToDeleteId?.let { onRemove(it) }
                            showDeleteDialog = false
                        },
                        colors = ButtonDefaults.primaryButtonColors(),
                        modifier = Modifier.size(ButtonDefaults.LargeButtonSize)
                    ) {
                        Icon(imageVector = Icons.Default.Check, contentDescription = "Delete")
                    }
                }
            )
        }
    }

    ScalingLazyColumn(
        state = listState,
        modifier = Modifier
            .fillMaxSize()
            .onRotaryScrollEvent {
                coroutineScope.launch {
                    listState.scrollBy(it.verticalScrollPixels)
                }
                // Adaptive haptic feedback
                totalScroll += it.verticalScrollPixels
                if (abs(totalScroll) > 30f) {
                    haptic.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    totalScroll = 0f
                }
                true
            }
            .focusRequester(focusRequester)
            .focusable(),
        autoCentering = AutoCenteringParams(itemIndex = 0)
    ) {
        // Summary Card at the top of the list
        item {
            CartSummary(
                totalAmount = totalAmount,
                budgetEnabled = budgetEnabled,
                remainingBudget = remainingBudget
            )
        }

        // Header row with title + mic button
        item {
            CartHeader(
                isRecording = isRecording,
                isProcessing = isProcessing,
                onMicClick = onMicClick
            )
        }

        // Items list
        if (items.isEmpty()) {
            item {
                EmptyState(message = "Cart is empty\nTap mic to add items")
            }
        } else {
            items(items) { item ->
                CartItemRow(
                    item = item,
                    onToggleVisibility = { onToggleVisibility(item.id) },
                    onTogglePriceUncertain = { onTogglePriceUncertain(item.id) },
                    onRemove = {
                        itemToDeleteId = item.id
                        itemToDeleteName = item.product
                        showDeleteDialog = true
                    }
                )
            }
        }
    }
}

@Composable
private fun CartSummary(
    totalAmount: Double,
    budgetEnabled: Boolean,
    remainingBudget: Double
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 16.dp, bottom = 4.dp, start = 14.dp, end = 14.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "Total: $${"%.2f".format(totalAmount)}",
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colors.primary,
            textAlign = TextAlign.Center
        )
        if (budgetEnabled) {
            val remainingColor = if (remainingBudget >= 0) Color(0xFF4CAF50) else Color(0xFFFF5252)
            Text(
                text = "Left: $${"%.2f".format(remainingBudget)}",
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = remainingColor,
                textAlign = TextAlign.Center
            )
        }
        Spacer(modifier = Modifier.height(4.dp))
        Spacer(
            modifier = Modifier
                .fillMaxWidth(0.7f)
                .height(1.dp)
                .background(MaterialTheme.colors.onSurface.copy(alpha = 0.15f))
        )
    }
}

@Composable
private fun CartHeader(
    isRecording: Boolean,
    isProcessing: Boolean,
    onMicClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = Icons.Default.ShoppingCart,
            contentDescription = "Cart",
            tint = MaterialTheme.colors.primary,
            modifier = Modifier.size(16.dp)
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = "Cart",
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colors.onSurface,
            modifier = Modifier.weight(1f)
        )
        MicButton(isRecording = isRecording, isProcessing = isProcessing, onMicClick = onMicClick)
    }
}

@Composable
private fun CartItemRow(
    item: CartItem,
    onToggleVisibility: () -> Unit,
    onTogglePriceUncertain: () -> Unit,
    onRemove: () -> Unit
) {
    val alpha = if (item.visible) 1f else 0.4f
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 3.dp, horizontal = 14.dp), // Added horizontal padding
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = item.product,
                fontSize = 13.sp,
                color = MaterialTheme.colors.onSurface.copy(alpha = alpha),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                fontWeight = if (item.visible) FontWeight.Medium else FontWeight.Normal
            )
            val priceText = buildString {
                if (item.quantity != "1" && item.quantity != "1.0") append("×${item.quantity} ")
                if (item.price != "0" && item.price != "0.0") {
                    if (item.priceUncertain) append("~")
                    append("\$${item.price}")
                }
            }
            if (priceText.isNotEmpty()) {
                Text(
                    text = priceText,
                    fontSize = 11.sp,
                    color = MaterialTheme.colors.secondary.copy(alpha = alpha)
                )
            }
        }
        // Visibility toggle
        Button(
            onClick = onToggleVisibility,
            modifier = Modifier.size(28.dp),
            colors = ButtonDefaults.buttonColors(
                backgroundColor = Color.Transparent
            )
        ) {
            Icon(
                imageVector = if (item.visible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
                contentDescription = "Toggle",
                modifier = Modifier.size(14.dp),
                tint = MaterialTheme.colors.onSurface.copy(alpha = 0.7f)
            )
        }
        // Price uncertain toggle
        Button(
            onClick = onTogglePriceUncertain,
            modifier = Modifier.size(28.dp),
            colors = ButtonDefaults.buttonColors(
                backgroundColor = Color.Transparent
            )
        ) {
            Icon(
                imageVector = Icons.Default.HelpOutline,
                contentDescription = "Toggle uncertainty",
                modifier = Modifier.size(14.dp),
                tint = if (item.priceUncertain) Color(0xFF9C27B0) else MaterialTheme.colors.onSurface.copy(alpha = 0.5f)
            )
        }
        // Remove
        Button(
            onClick = onRemove,
            modifier = Modifier.size(28.dp),
            colors = ButtonDefaults.buttonColors(
                backgroundColor = Color.Transparent
            )
        ) {
            Icon(
                imageVector = Icons.Default.Delete,
                contentDescription = "Remove",
                modifier = Modifier.size(14.dp),
                tint = Color(0xFFFF5252).copy(alpha = 0.8f)
            )
        }
    }
}

@Composable
internal fun MicButton(
    isRecording: Boolean,
    isProcessing: Boolean,
    onMicClick: () -> Unit
) {
    Box(contentAlignment = Alignment.Center) {
        if (isProcessing) {
            CircularProgressIndicator(
                modifier = Modifier.size(32.dp),
                strokeWidth = 2.dp,
                indicatorColor = MaterialTheme.colors.primary
            )
        } else {
            Button(
                onClick = onMicClick,
                modifier = Modifier.size(32.dp),
                colors = ButtonDefaults.buttonColors(
                    backgroundColor = if (isRecording)
                        Color(0xFFFF5252)
                    else
                        MaterialTheme.colors.primary
                )
            ) {
                Icon(
                    imageVector = if (isRecording) Icons.Default.MicOff else Icons.Default.Mic,
                    contentDescription = if (isRecording) "Stop recording" else "Start recording",
                    modifier = Modifier.size(16.dp)
                )
            }
        }
    }
}

@Composable
internal fun EmptyState(message: String) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = message,
            fontSize = 12.sp,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colors.onSurface.copy(alpha = 0.5f),
            modifier = Modifier.padding(16.dp)
        )
    }
}
