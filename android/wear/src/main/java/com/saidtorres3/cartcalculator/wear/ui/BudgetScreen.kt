package com.saidtorres3.cartcalculator.wear.ui

import androidx.compose.foundation.focusable
import androidx.compose.foundation.gestures.scrollBy
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.wear.compose.material.Icon
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.dialog.Alert
import androidx.wear.compose.material.dialog.Dialog
import com.saidtorres3.cartcalculator.wear.model.BudgetEntry
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AttachMoney
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Check
import kotlinx.coroutines.launch
import kotlin.math.abs

@Composable
fun BudgetScreen(
    entries: List<BudgetEntry>,
    isRecording: Boolean,
    isProcessing: Boolean,
    focused: Boolean,
    onMicClick: () -> Unit,
    onToggleVisibility: (String) -> Unit,
    onRemove: (String) -> Unit
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
                        text = "Delete budget entry?",
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
        // Header row with title + mic button
        item {
            BudgetHeader(
                isRecording = isRecording,
                isProcessing = isProcessing,
                onMicClick = onMicClick
            )
        }

        // Items list
        if (entries.isEmpty()) {
            item {
                EmptyState(message = "Budget is empty\nTap mic to add entries")
            }
        } else {
            items(entries) { entry ->
                BudgetEntryRow(
                    entry = entry,
                    onToggleVisibility = { onToggleVisibility(entry.id) },
                    onRemove = {
                        itemToDeleteId = entry.id
                        itemToDeleteName = entry.name
                        showDeleteDialog = true
                    }
                )
            }
        }
    }
}

@Composable
private fun BudgetHeader(
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
            imageVector = Icons.Default.AttachMoney,
            contentDescription = "Budget",
            tint = Color(0xFF4CAF50),
            modifier = Modifier.size(16.dp)
        )
        Spacer(modifier = Modifier.width(4.dp))
        Text(
            text = "Budget",
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colors.onSurface,
            modifier = Modifier.weight(1f)
        )
        MicButton(isRecording = isRecording, isProcessing = isProcessing, onMicClick = onMicClick)
    }
}

@Composable
private fun BudgetEntryRow(
    entry: BudgetEntry,
    onToggleVisibility: () -> Unit,
    onRemove: () -> Unit
) {
    val alpha = if (entry.visible) 1f else 0.4f
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 3.dp, horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = entry.name,
                fontSize = 13.sp,
                color = MaterialTheme.colors.onSurface.copy(alpha = alpha),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                fontWeight = if (entry.visible) FontWeight.Medium else FontWeight.Normal
            )
            Text(
                text = "$${entry.amount}",
                fontSize = 11.sp,
                color = Color(0xFF4CAF50).copy(alpha = alpha),
                fontWeight = FontWeight.Bold
            )
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
                imageVector = if (entry.visible) Icons.Default.Visibility else Icons.Default.VisibilityOff,
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
