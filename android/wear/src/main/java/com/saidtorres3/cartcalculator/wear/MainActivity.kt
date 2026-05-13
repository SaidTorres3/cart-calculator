package com.saidtorres3.cartcalculator.wear

import android.Manifest
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.wear.compose.material.HorizontalPageIndicator
import androidx.wear.compose.material.MaterialTheme
import androidx.wear.compose.material.PageIndicatorState
import androidx.wear.compose.material.Scaffold
import androidx.wear.compose.material.Text
import androidx.wear.compose.material.TimeText
import androidx.wear.compose.material.Vignette
import androidx.wear.compose.material.VignettePosition
import com.saidtorres3.cartcalculator.wear.data.DataRepository
import com.saidtorres3.cartcalculator.wear.ui.CartScreen
import com.saidtorres3.cartcalculator.wear.ui.WishlistScreen

class MainActivity : ComponentActivity() {

    private val viewModel: MainViewModel by viewModels {
        MainViewModel.Factory(
            DataRepository(applicationContext),
            applicationContext
        )
    }

    private val micPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
            if (!granted) {
                // User will see the error message from ViewModel when they try to record
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Request mic permission upfront
        micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)

        setContent {
            WearAppContent(viewModel = viewModel)
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun WearAppContent(viewModel: MainViewModel) {
    val cartItems by viewModel.cartItems.collectAsState()
    val wishlistItems by viewModel.wishlistItems.collectAsState()
    val isRecordingCart by viewModel.isRecordingCart.collectAsState()
    val isRecordingWishlist by viewModel.isRecordingWishlist.collectAsState()
    val isProcessingCart by viewModel.isProcessingCart.collectAsState()
    val isProcessingWishlist by viewModel.isProcessingWishlist.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()

    val pagerState = rememberPagerState(pageCount = { 2 })

    val pageIndicatorState = object : PageIndicatorState {
        override val pageOffset: Float get() = pagerState.currentPageOffsetFraction
        override val selectedPage: Int get() = pagerState.currentPage
        override val pageCount: Int get() = 2
    }

    MaterialTheme {
        Scaffold(
            modifier = Modifier.fillMaxSize(),
            timeText = { TimeText(modifier = Modifier.padding(top = 4.dp)) },
            pageIndicator = {
                HorizontalPageIndicator(pageIndicatorState = pageIndicatorState)
            },
            vignette = {
                Vignette(vignettePosition = VignettePosition.TopAndBottom)
            }
        ) {
            Box(modifier = Modifier.fillMaxSize()) {
                HorizontalPager(
                    state = pagerState,
                    modifier = Modifier.fillMaxSize()
                ) { page ->
                    when (page) {
                        0 -> CartScreen(
                            items = cartItems,
                            isRecording = isRecordingCart,
                            isProcessing = isProcessingCart,
                            onMicClick = { viewModel.toggleCartRecording() },
                            onToggleVisibility = { viewModel.toggleCartItemVisibility(it) },
                            onRemove = { viewModel.removeCartItem(it) }
                        )
                        1 -> WishlistScreen(
                            items = wishlistItems,
                            isRecording = isRecordingWishlist,
                            isProcessing = isProcessingWishlist,
                            onMicClick = { viewModel.toggleWishlistRecording() },
                            onToggleVisibility = { viewModel.toggleWishlistItemVisibility(it) },
                            onRemove = { viewModel.removeWishlistItem(it) }
                        )
                    }
                }

                // Error overlay
                errorMessage?.let { msg ->
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(Color.Black.copy(alpha = 0.85f))
                            .clickable(
                                interactionSource = remember { MutableInteractionSource() },
                                indication = null
                            ) { viewModel.clearError() }
                            .padding(24.dp), // Increased padding for circular screens
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = msg,
                            color = Color.White,
                            fontSize = 13.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                }
            }
        }
    }
}
