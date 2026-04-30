package com.example.textly.service

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.example.textly.webrtc.CallManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class CallRejectReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "CallRejectReceiver"
        private const val CALL_NOTIFICATION_ID = 1001
    }

    override fun onReceive(context: Context, intent: Intent) {
        val callId = intent.getStringExtra("callId") ?: ""

        if (callId.isNotEmpty()) {
            Log.d(TAG, "📵 Rejecting call: $callId")

            // ✅ Reject call in Firestore
            CoroutineScope(Dispatchers.IO).launch {
                try {
                    CallManager.rejectCall(callId)
                    Log.d(TAG, "✅ Call rejected: $callId")
                } catch (e: Exception) {
                    Log.e(TAG, "❌ Failed to reject call: ${e.message}")
                }
            }
        }

        // ✅ Dismiss the notification
        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        notificationManager.cancel(CALL_NOTIFICATION_ID)
    }
}