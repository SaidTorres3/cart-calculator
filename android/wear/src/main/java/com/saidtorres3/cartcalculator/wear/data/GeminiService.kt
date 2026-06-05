package com.saidtorres3.cartcalculator.wear.data

import android.util.Base64
import com.saidtorres3.cartcalculator.wear.model.CartItem
import com.saidtorres3.cartcalculator.wear.model.WishlistItem
import com.saidtorres3.cartcalculator.wear.model.BudgetEntry
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
        Extract shopping items from text and return a JSON array of objects with properties: product (string), quantity (float), and price (float).
        Rules:
        Product after a number (e.g., "rollo de 100") → interpret as price.
        Default: quantity = 1.0, price = 0.0.
        Convert grams to kilograms (e.g., "500 gramos" = 0.5).

        Examples:
        "una servilleta" → [{"product":"Servilleta","quantity":1.0,"price":0.0}]
        "un rollo de 100" → [{"product":"Rollo","quantity":1.0,"price":100.0}]
        "2 desodorantes de 45 pesos y uno de 25 pesos" → [{"product":"Desodorante","quantity":2.0,"price":45.0},{"product":"Desodorante","quantity":1.0,"price":25.0}]
        "3 bolsas de leche 15 pesos" → [{"product":"Leche","quantity":3.0,"price":45.0}]
        "323 gramos de tomate a 80 el kilo" → [{"product":"Tomate","quantity":0.323,"price":80.0}]

        Output:
        Return only a JSON array or an empty array ([]) for random text.
    """.trimIndent()

    private val WISHLIST_EXTRACT_PROMPT = """
        Extract shopping items from text and return a JSON array of objects with properties: product (string).

        Examples:
        "una servilleta" → [{"product":"Servilleta"}]
        "2 desodorantes" → [{"product":"2 Desodorantes"}]
        "3 bolsas de leche" → [{"product":"3 Bolsas de Leche"}]
        "Tomates" → [{"product":"Tomates"}]

        Output:
        Return only a JSON array or an empty array ([]) for random text.
    """.trimIndent()

    private val BUDGET_EXTRACT_PROMPT = """
        Extract budget entries from the spoken text and return a JSON array of objects with properties: name (string) and amount (float).
        Rules:
        - Each entry is a named money source or fund.
        - Default amount = 0.0 if not mentioned.
        Examples:
        "tarjeta de mamá 120, efectivo 800" → [{"name":"Tarjeta de mamá","amount":120.0},{"name":"Efectivo","amount":800.0}]
        "caja chica cincuenta pesos" → [{"name":"Caja chica","amount":50.0}]
        Output: Return ONLY a JSON array or [] for unrecognizable input.
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

    suspend fun extractBudgetEntriesFromAudio(
        audioBase64: String,
        mimeType: String,
        apiKey: String,
        model: String
    ): List<BudgetEntry> = withContext(Dispatchers.IO) {
        val responseText = callGemini(audioBase64, mimeType, BUDGET_EXTRACT_PROMPT, apiKey, model)
        parseBudgetResponse(responseText)
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

        val modelPath = if (model.startsWith("publishers/") || model.startsWith("projects/") || model.startsWith("models/")) {
            model
        } else if (model.contains("/")) {
            val parts = model.split("/")
            "publishers/${parts[0]}/models/${parts[1]}"
        } else {
            "publishers/google/models/$model"
        }

        val request = Request.Builder()
            .url("https://aiplatform.googleapis.com/v1beta1/$modelPath:generateContent")
            .header("x-goog-api-key", apiKey)
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

    private fun parseBudgetResponse(rawText: String): List<BudgetEntry> {
        if (rawText.isBlank()) return emptyList()
        return try {
            val clean = rawText
                .replace(Regex("```json\\n?"), "")
                .replace(Regex("```\\n?"), "")
                .trim()
            val arr = JSONArray(clean)
            (0 until arr.length()).map { i ->
                val obj = arr.getJSONObject(i)
                BudgetEntry(
                    id = UUID.randomUUID().toString(),
                    name = obj.optString("name", "Budget"),
                    amount = obj.optDouble("amount", 0.0).toString(),
                    visible = true
                )
            }
        } catch (e: Exception) {
            emptyList()
        }
    }
}
