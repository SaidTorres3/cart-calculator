package com.saidtorres3.cartcalculator.wear.data

import android.util.Base64
import com.saidtorres3.cartcalculator.wear.model.CartItem
import com.saidtorres3.cartcalculator.wear.model.WishlistItem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.TimeUnit

class GeminiService {

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    private val CART_EXTRACT_PROMPT = """
        Extract shopping items from the audio and return a JSON array of objects with properties:
        product (string), quantity (float), price (float).
        Rules:
        - Product after a number (e.g., "rollo de 100") → interpret as price.
        - Default: quantity = 1.0, price = 0.0.
        - Convert grams to kilograms (e.g., "500 gramos" = 0.5).
        Output ONLY a JSON array or an empty array ([]) for random text.
    """.trimIndent()

    private val WISHLIST_EXTRACT_PROMPT = """
        Extract wish-list items from the audio and return a JSON array of strings,
        where each string is the product name. Output ONLY a JSON array.
    """.trimIndent()

    suspend fun extractCartItemsFromAudio(
        audioBase64: String,
        mimeType: String,
        apiKey: String,
        model: String
    ): List<CartItem> = withContext(Dispatchers.IO) {
        val responseText = callGemini(audioBase64, mimeType, CART_EXTRACT_PROMPT, apiKey, model)
        parseCartResponse(responseText)
    }

    suspend fun extractWishlistItemsFromAudio(
        audioBase64: String,
        mimeType: String,
        apiKey: String,
        model: String
    ): List<WishlistItem> = withContext(Dispatchers.IO) {
        val responseText = callGemini(audioBase64, mimeType, WISHLIST_EXTRACT_PROMPT, apiKey, model)
        parseWishlistResponse(responseText)
    }

    private fun callGemini(
        audioBase64: String,
        mimeType: String,
        prompt: String,
        apiKey: String,
        model: String
    ): String {
        val requestBody = JSONObject().apply {
            put("contents", JSONArray().apply {
                put(JSONObject().apply {
                    put("role", "user")
                    put("parts", JSONArray().apply {
                        put(JSONObject().apply { put("text", prompt) })
                        put(JSONObject().apply {
                            put("inlineData", JSONObject().apply {
                                put("mimeType", mimeType)
                                put("data", audioBase64)
                            })
                        })
                    })
                })
            })
        }.toString()

        val request = Request.Builder()
            .url("https://generativelanguage.googleapis.com/v1beta/models/$model:generateContent?key=$apiKey")
            .post(requestBody.toRequestBody("application/json".toMediaType()))
            .build()

        val response = client.newCall(request).execute()
        val responseString = response.body?.string() ?: return ""

        return try {
            val root = JSONObject(responseString)
            root.getJSONArray("candidates")
                .getJSONObject(0)
                .getJSONObject("content")
                .getJSONArray("parts")
                .getJSONObject(0)
                .getString("text")
        } catch (e: Exception) {
            ""
        }
    }

    private fun parseCartResponse(rawText: String): List<CartItem> {
        if (rawText.isBlank()) return emptyList()
        return try {
            val clean = rawText
                .replace(Regex("```json\\n?"), "")
                .replace(Regex("```\\n?"), "")
                .trim()
            val arr = JSONArray(clean)
            (0 until arr.length()).map { i ->
                val obj = arr.getJSONObject(i)
                CartItem(
                    id = UUID.randomUUID().toString(),
                    product = obj.optString("product", "Item"),
                    quantity = obj.optDouble("quantity", 1.0).toString(),
                    price = obj.optDouble("price", 0.0).toString(),
                    visible = true
                )
            }
        } catch (e: Exception) {
            emptyList()
        }
    }

    private fun parseWishlistResponse(rawText: String): List<WishlistItem> {
        if (rawText.isBlank()) return emptyList()
        return try {
            val clean = rawText
                .replace(Regex("```json\\n?"), "")
                .replace(Regex("```\\n?"), "")
                .trim()
            val arr = JSONArray(clean)
            (0 until arr.length()).map { i ->
                WishlistItem(
                    id = UUID.randomUUID().toString(),
                    product = arr.getString(i),
                    visible = true
                )
            }
        } catch (e: Exception) {
            emptyList()
        }
    }
}
