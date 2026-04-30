package com.example.textly.util

import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat
import com.example.textly.MainActivity

object CallNotificationHandler {

    private const val TAG = "CallNotificationHandler"

    fun handleIncomingCall(
        context: Context,
        callId: String,
        callerName: String,
        callerImage: String,
        callType: String
    ) {
        Log.d(TAG, "📞 Handling incoming call: $callId from $callerName")

        // Create intent to open incoming call screen
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("navigate_to", "incoming_call")
            putExtra("callId", callId)
            putExtra("callerName", callerName)
            putExtra("callerImage", callerImage)
            putExtra("callType", callType)
        }

        ContextCompat.startActivity(context, intent, null)
    }
}