package com.saidtorres3.cartcalculator.wear

import android.Manifest
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.os.Build
import android.util.Base64
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.saidtorres3.cartcalculator.wear.data.DataRepository
import com.saidtorres3.cartcalculator.wear.data.GeminiService
import com.saidtorres3.cartcalculator.wear.model.CartItem
import com.saidtorres3.cartcalculator.wear.model.WishlistItem
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.io.File

enum class ActiveScreen { CART, WISHLIST }
enum class RecordingTarget { CART, WISHLIST }

class MainViewModel(
    private val repository: DataRepository,
    private val appContext: android.content.Context
) : ViewModel() {

    private val geminiService = GeminiService()

    val cartItems: StateFlow<List<CartItem>> = repository.cartItems
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val wishlistItems: StateFlow<List<WishlistItem>> = repository.wishlistItems
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val apiKey: StateFlow<String> = repository.apiKeyFlow
        .stateIn(viewModelScope, SharingStarted.Eagerly, "")

    val selectedModel: StateFlow<String> = repository.selectedModel
        .stateIn(viewModelScope, SharingStarted.Eagerly, "gemini-2.5-flash-lite")

    private val _activeScreen = MutableStateFlow(ActiveScreen.CART)
    val activeScreen: StateFlow<ActiveScreen> = _activeScreen.asStateFlow()

    private val _isRecordingCart = MutableStateFlow(false)
    val isRecordingCart: StateFlow<Boolean> = _isRecordingCart.asStateFlow()

    private val _isRecordingWishlist = MutableStateFlow(false)
    val isRecordingWishlist: StateFlow<Boolean> = _isRecordingWishlist.asStateFlow()

    private val _isProcessingCart = MutableStateFlow(false)
    val isProcessingCart: StateFlow<Boolean> = _isProcessingCart.asStateFlow()

    private val _isProcessingWishlist = MutableStateFlow(false)
    val isProcessingWishlist: StateFlow<Boolean> = _isProcessingWishlist.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private var mediaRecorder: MediaRecorder? = null
    private var audioFile: File? = null
    private var currentTarget: RecordingTarget = RecordingTarget.CART

    init {
        // Request fresh data from phone on startup
        repository.requestSyncFromPhone()
    }

    fun setActiveScreen(screen: ActiveScreen) {
        _activeScreen.value = screen
    }

    fun hasMicPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            appContext, Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun toggleCartRecording() {
        if (_isRecordingCart.value) {
            stopRecording(RecordingTarget.CART)
        } else {
            startRecording(RecordingTarget.CART)
        }
    }

    fun toggleWishlistRecording() {
        if (_isRecordingWishlist.value) {
            stopRecording(RecordingTarget.WISHLIST)
        } else {
            startRecording(RecordingTarget.WISHLIST)
        }
    }

    private fun startRecording(target: RecordingTarget) {
        if (!hasMicPermission()) {
            _errorMessage.value = "Microphone permission required"
            return
        }
        if (apiKey.value.isEmpty()) {
            _errorMessage.value = "No API key. Set it in the phone app first."
            return
        }
        try {
            currentTarget = target
            val file = File(appContext.cacheDir, "wear_audio_${System.currentTimeMillis()}.m4a")
            audioFile = file

            val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(appContext)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }
            recorder.apply {
                setAudioSource(MediaRecorder.AudioSource.MIC)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioSamplingRate(16000)
                setAudioEncodingBitRate(32000)
                setOutputFile(file.absolutePath)
                prepare()
                start()
            }
            mediaRecorder = recorder

            when (target) {
                RecordingTarget.CART -> _isRecordingCart.value = true
                RecordingTarget.WISHLIST -> _isRecordingWishlist.value = true
            }
        } catch (e: Exception) {
            _errorMessage.value = "Failed to start recording: ${e.message}"
            mediaRecorder?.release()
            mediaRecorder = null
        }
    }

    private fun stopRecording(target: RecordingTarget) {
        try {
            mediaRecorder?.apply {
                stop()
                release()
            }
            mediaRecorder = null
        } catch (e: Exception) {
            e.printStackTrace()
        }

        when (target) {
            RecordingTarget.CART -> {
                _isRecordingCart.value = false
                _isProcessingCart.value = true
            }
            RecordingTarget.WISHLIST -> {
                _isRecordingWishlist.value = false
                _isProcessingWishlist.value = true
            }
        }

        val file = audioFile ?: run {
            clearProcessing()
            return
        }
        audioFile = null

        viewModelScope.launch {
            try {
                val bytes = file.readBytes()
                file.delete()
                val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                val key = apiKey.value
                val model = selectedModel.value

                when (target) {
                    RecordingTarget.CART -> {
                        val newItems = geminiService.extractCartItemsFromAudio(
                            base64, "audio/mp4", key, model
                        )
                        if (newItems.isNotEmpty()) {
                            val updated = newItems + cartItems.value
                            repository.saveCartItems(updated)
                            repository.pushCartToPhone(updated)
                        }
                    }
                    RecordingTarget.WISHLIST -> {
                        val newItems = geminiService.extractWishlistItemsFromAudio(
                            base64, "audio/mp4", key, model
                        )
                        if (newItems.isNotEmpty()) {
                            val updated = newItems + wishlistItems.value
                            repository.saveWishlistItems(updated)
                            repository.pushWishlistToPhone(updated)
                        }
                    }
                }
            } catch (e: Exception) {
                _errorMessage.value = "Processing failed: ${e.message}"
            } finally {
                clearProcessing()
            }
        }
    }

    fun toggleCartItemVisibility(id: String) {
        viewModelScope.launch {
            val updated = cartItems.value.map { if (it.id == id) it.copy(visible = !it.visible) else it }
            repository.saveCartItems(updated)
            repository.pushCartToPhone(updated)
        }
    }

    fun removeCartItem(id: String) {
        viewModelScope.launch {
            val updated = cartItems.value.filter { it.id != id }
            repository.saveCartItems(updated)
            repository.pushCartToPhone(updated)
        }
    }

    fun toggleWishlistItemVisibility(id: String) {
        viewModelScope.launch {
            val updated = wishlistItems.value.map { if (it.id == id) it.copy(visible = !it.visible) else it }
            repository.saveWishlistItems(updated)
            repository.pushWishlistToPhone(updated)
        }
    }

    fun removeWishlistItem(id: String) {
        viewModelScope.launch {
            val updated = wishlistItems.value.filter { it.id != id }
            repository.saveWishlistItems(updated)
            repository.pushWishlistToPhone(updated)
        }
    }

    fun clearError() {
        _errorMessage.value = null
    }

    private fun clearProcessing() {
        _isProcessingCart.value = false
        _isProcessingWishlist.value = false
    }

    override fun onCleared() {
        super.onCleared()
        mediaRecorder?.release()
        mediaRecorder = null
    }

    class Factory(
        private val repository: DataRepository,
        private val context: android.content.Context
    ) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            return MainViewModel(repository, context) as T
        }
    }
}
