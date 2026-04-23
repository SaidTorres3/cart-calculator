package com.saidtorres3.cartcalculator.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.items
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material.*

class MainActivity : ComponentActivity() {

    private val viewModel: CartViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            CartWearApp(viewModel = viewModel)
        }
    }
}

// ─── Color Palette ───────────────────────────────────────────────────────────
private val DarkBg = Color(0xFF1A1A1A)
private val Surface = Color(0xFF2A2A2A)
private val SurfaceVariant = Color(0xFF333333)
private val AccentGreen = Color(0xFF4CAF50)
private val AccentBlue = Color(0xFF1976D2)
private val AccentRed = Color(0xFFC62828)
private val TextPrimary = Color(0xFFFFFFFF)
private val TextSecondary = Color(0xFFAAAAAA)
private val CheckedAlpha = 0.45f

// ─── Root composable ─────────────────────────────────────────────────────────
@Composable
fun CartWearApp(viewModel: CartViewModel) {
    val cartState by viewModel.cartState.collectAsStateWithLifecycle()

    MaterialTheme {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(DarkBg),
            contentAlignment = Alignment.Center
        ) {
            if (cartState.shoppingItems.isEmpty()) {
                EmptyState()
            } else {
                CartList(cartState = cartState, onToggle = viewModel::toggleItem)
            }
        }
    }
}

// ─── Empty state ─────────────────────────────────────────────────────────────
@Composable
fun EmptyState() {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier.padding(horizontal = 24.dp)
    ) {
        Text(
            text = "🛒",
            fontSize = 36.sp,
            textAlign = TextAlign.Center
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = "List is empty",
            color = TextSecondary,
            fontSize = 14.sp,
            textAlign = TextAlign.Center
        )
        Text(
            text = "Add items on\nyour phone",
            color = TextSecondary,
            fontSize = 12.sp,
            textAlign = TextAlign.Center
        )
    }
}

// ─── Main list ───────────────────────────────────────────────────────────────
@Composable
fun CartList(cartState: CartState, onToggle: (String) -> Unit) {
    val listState = rememberScalingLazyListState()
    val visibleItems = cartState.shoppingItems.filter { it.visible }
    val hiddenItems = cartState.shoppingItems.filter { !it.visible }

    ScalingLazyColumn(
        state = listState,
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(
            top = 32.dp,
            bottom = 80.dp,
            start = 8.dp,
            end = 8.dp
        ),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        // Header / total chip
        item {
            TotalChip(cartState = cartState)
        }

        // Active shopping items
        if (visibleItems.isNotEmpty()) {
            item {
                SectionLabel(text = "Shopping (${visibleItems.size})")
            }
            items(visibleItems) { item ->
                CartItemCard(item = item, onToggle = onToggle)
            }
        }

        // Checked-off items
        if (hiddenItems.isNotEmpty()) {
            item {
                SectionLabel(text = "Done (${hiddenItems.size})")
            }
            items(hiddenItems) { item ->
                CartItemCard(item = item, onToggle = onToggle)
            }
        }
    }
}

// ─── Total chip at the top ────────────────────────────────────────────────────
@Composable
fun TotalChip(cartState: CartState) {
    val total = cartState.cartTotal
    val remaining = cartState.budgetRemaining
    val hasBudget = cartState.budgetEnabled && cartState.budgetTotal > 0

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(
                Brush.horizontalGradient(
                    listOf(Color(0xFF1565C0), Color(0xFF0D47A1))
                )
            )
            .padding(horizontal = 16.dp, vertical = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "Total: $${"%.2f".format(total)}",
                color = TextPrimary,
                fontWeight = FontWeight.Bold,
                fontSize = 16.sp
            )
            if (hasBudget) {
                val remainColor = if (remaining >= 0) AccentGreen else AccentRed
                Text(
                    text = "Remaining: $${"%.2f".format(remaining)}",
                    color = remainColor,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}

// ─── Section header label ─────────────────────────────────────────────────────
@Composable
fun SectionLabel(text: String) {
    Text(
        text = text,
        color = TextSecondary,
        fontSize = 11.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 4.dp, top = 4.dp, bottom = 2.dp)
    )
}

// ─── Item card ────────────────────────────────────────────────────────────────
@Composable
fun CartItemCard(item: CartItem, onToggle: (String) -> Unit) {
    val isChecked = !item.visible
    val subtotal = (item.price.toDoubleOrNull() ?: 0.0) * (item.quantity.toDoubleOrNull() ?: 1.0)

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Surface)
            .clickable { onToggle(item.id) }
            .alpha(if (isChecked) CheckedAlpha else 1f)
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth()
        ) {
            // Checkmark circle
            Box(
                modifier = Modifier
                    .size(20.dp)
                    .clip(CircleShape)
                    .background(if (isChecked) AccentGreen else SurfaceVariant),
                contentAlignment = Alignment.Center
            ) {
                if (isChecked) {
                    Text(text = "✓", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                }
            }

            Spacer(Modifier.width(8.dp))

            // Product name + qty × price
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.product,
                    color = TextPrimary,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "${item.quantity} × $${item.price}",
                    color = TextSecondary,
                    fontSize = 10.sp
                )
            }

            // Subtotal
            Text(
                text = "$${"%.2f".format(subtotal)}",
                color = if (item.priceUncertain) Color(0xFFFF8F00) else AccentGreen,
                fontWeight = FontWeight.Bold,
                fontSize = 12.sp
            )
        }
    }
}
