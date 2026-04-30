package com.example.textly.service

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.example.textly.MainActivity
import com.example.textly.R
import com.onesignal.notifications.INotificationReceivedEvent
import com.onesignal.notifications.INotificationServiceExtension
import java.net.URLEncoder

class TextlyNotificationService : INotificationServiceExtension {

    companion object {
        private const val TAG = "TextlyNotificationService"
        const val CALL_CHANNEL_ID = "incoming_call_channel"
        const val CALL_CHANNEL_NAME = "Incoming Calls"
        const val CALL_NOTIFICATION_ID = 1001
    }

    // ✅ Called when app is BACKGROUND/KILLED by OneSignal internally
    override fun onNotificationReceived(event: INotificationReceivedEvent) {
        val notification = event.notification
        val data = notification.additionalData

        Log.d(TAG, "📩 Notification received: $data")

        val notificationType = data?.optString("type") ?: ""

        if (notificationType == "incoming_call") {
            val callId = data?.optString("callId") ?: ""
            val callerName = data?.optString("callerName") ?: "Unknown"
            val callerImage = data?.optString("callerImage") ?: ""
            val callType = data?.optString("callType") ?: "VOICE"

            if (callId.isNotEmpty()) {
                Log.d(TAG, "📞 Incoming call: $callId from $callerName")

                // ✅ Prevent OneSignal default notification
                event.preventDefault()

                // ✅ Show our custom full-screen call notification
                showIncomingCallNotification(
                    context = event.context,
                    callId = callId,
                    callerName = callerName,
                    callerImage = callerImage,
                    callType = callType
                )
            }
        }
    }

    // ✅ Public method — called from TextlyApplication when app is FOREGROUND
    fun showCallNotification(
        context: Context,
        callId: String,
        callerName: String,
        callerImage: String,
        callType: String
    ) {
        showIncomingCallNotification(context, callId, callerName, callerImage, callType)
    }

    // ✅ Shared private implementation used by both foreground and background
    private fun showIncomingCallNotification(
        context: Context,
        callId: String,
        callerName: String,
        callerImage: String,
        callType: String
    ) {
        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Create notification channel (required for Android 8+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CALL_CHANNEL_ID,
                CALL_CHANNEL_NAME,
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for incoming calls"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 1000, 500, 1000)
            }
            notificationManager.createNotificationChannel(channel)
        }

        // ✅ Build intent to open MainActivity → incoming_call screen
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("navigate_to", "incoming_call")
            putExtra("callId", callId)
            putExtra("callerName", callerName)
            putExtra("callerImage", callerImage)
            putExtra("callType", callType)
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            callId.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // ✅ Reject intent → CallRejectReceiver
        val rejectIntent = Intent(context, CallRejectReceiver::class.java).apply {
            putExtra("callId", callId)
        }
        val rejectPendingIntent = PendingIntent.getBroadcast(
            context,
            callId.hashCode() + 2,
            rejectIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val callTypeText = if (callType == "VIDEO") "Video Call" else "Voice Call"

        // ✅ Build notification
        val notification = NotificationCompat.Builder(context, CALL_CHANNEL_ID)
            .setSmallIcon(R.drawable.call)
            .setContentTitle("Incoming $callTypeText")
            .setContentText("$callerName is calling...")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setAutoCancel(true)
            .setOngoing(true)
            .setFullScreenIntent(pendingIntent, true)   // ✅ Shows on lock screen
            .setContentIntent(pendingIntent)
            .addAction(R.drawable.call, "Accept", pendingIntent)
            .addAction(R.drawable.callend, "Decline", rejectPendingIntent)
            .build()

        notificationManager.notify(CALL_NOTIFICATION_ID, notification)
        Log.d(TAG, "✅ Call notification shown for: $callerName")
    }
}