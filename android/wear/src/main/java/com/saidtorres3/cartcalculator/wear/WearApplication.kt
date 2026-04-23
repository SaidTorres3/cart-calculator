package com.saidtorres3.cartcalculator.wear

import android.app.Application
import android.util.Log

class WearApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        Log.d("WearApplication", "Cart Calculator Wear OS app started")
    }
}
