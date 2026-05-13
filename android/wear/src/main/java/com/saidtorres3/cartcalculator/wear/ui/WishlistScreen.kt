package com.saidtorres3.cartcalculator.wear.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.Button
import androidx.wear.compose.material.ButtonDefaults
import androidx.wear.compose.material.Icon
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.ScalingLazyColumn
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.items
import androidx.wear.compose.material.rememberScalingLazyListState
import com.saidtorres3.cartcalculator.wear.model.WishlistItem
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material.icons.filled.Delete

@Composable
fun WishlistScreen(
    items: List<WishlistItem>,
    isRecording: Boolean,
    isProcessing: Boolean,
    onMicClick: () -> Unit,
    onToggleVisibility: (String) -> Unit,
    onRemove: (String) -> Unit
) {
    val listState = rememberScalingLazyListState()

    Column(modifier = Modifier.fillMaxSize()) {
        // Header row with title + mic button
        WishlistHeader(
            isRecording = isRecording,
            isProcessing = isProcessing,
            onMicClick = onMicClick
        )

        // Items list
        if (items.isEmpty()) {
            EmptyState(message = "Wishlist is empty\nTap mic to add items")
        } else {
            ScalingLazyColumn(
                state = listState,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 8.dp)
            ) {
                items(items) { item ->
                    WishlistItemRow(
                        item = item,
                        onToggleVisibility = { onToggleVisibility(item.id) },
                        onRemove = { onRemove(item.id) }
                    )
                }
            }
        }
    }
}

@Composable
private fun WishlistHeader(
    isRecording: Boolean,
    isProcessing: Boolean,
    onMicClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 24.dp, start = 8.dp, end = 8.dp, bottom = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = Icons.Default.Favorite,
            contentDescription = "Wishlist",
            tint = Color(0xFFFF4081),
            modifier = Modifier.size(16.dp)
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = "Wishlist",
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colors.onSurface,
            modifier = Modifier.weight(1f)
        )
        MicButton(isRecording = isRecording, isProcessing = isProcessing, onMicClick = onMicClick)
    }
}

@Composable
private fun WishlistItemRow(
    item: WishlistItem,
    onToggleVisibility: () -> Unit,
    onRemove: () -> Unit
) {
    val alpha = if (item.visible) 1f else 0.4f
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = item.product,
            fontSize = 13.sp,
            color = MaterialTheme.colors.onSurface.copy(alpha = alpha),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            fontWeight = if (item.visible) FontWeight.Medium else FontWeight.Normal,
            modifier = Modifier.weight(1f)
        )
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
