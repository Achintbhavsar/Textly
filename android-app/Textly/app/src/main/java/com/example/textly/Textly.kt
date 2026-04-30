package com.example.textly

import android.app.Application
import android.util.Log
import com.example.textly.service.TextlyNotificationService
import com.example.textly.util.CallNotificationHandler
import com.onesignal.OneSignal
import com.onesignal.debug.LogLevel
import com.onesignal.notifications.INotificationClickEvent
import com.onesignal.notifications.INotificationClickListener
import com.onesignal.notifications.INotificationLifecycleListener
import com.onesignal.notifications.INotificationWillDisplayEvent
import dagger.hilt.android.HiltAndroidApp
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@HiltAndroidApp
class Textly : Application() {

    companion object {
        const val ONESIGNAL_APP_ID = "2a094a8e-c6d5-48e5-9443-13162e6e8a44"
    }

    override fun onCreate() {
        super.onCreate()

        // Verbose Logging (remove in production)
        OneSignal.Debug.logLevel = LogLevel.VERBOSE

        // ✅ Initialize OneSignal ONCE
        OneSignal.initWithContext(this, ONESIGNAL_APP_ID)

        // ✅ Request notification permission
        CoroutineScope(Dispatchers.IO).launch {
            OneSignal.Notifications.requestPermission(true)
        }

        // ✅ Handle notification arriving while app is OPEN (foreground)
        OneSignal.Notifications.addForegroundLifecycleListener(object : INotificationLifecycleListener {
            override fun onWillDisplay(event: INotificationWillDisplayEvent) {
                val data = event.notification.additionalData
                val type = data?.optString("type") ?: return

                if (type == "incoming_call") {
                    val callId = data.optString("callId", "")
                    val callerName = data.optString("callerName", "Unknown")
                    val callerImage = data.optString("callerImage", "")
                    val callType = data.optString("callType", "VOICE")

                    if (callId.isNotEmpty()) {
                        // ✅ Prevent OneSignal default notification for calls
                        event.preventDefault()

                        // ✅ Show our custom full-screen call notification
                        TextlyNotificationService().showCallNotification(
                            context = this@Textly,
                            callId = callId,
                            callerName = callerName,
                            callerImage = callerImage,
                            callType = callType
                        )
                    }
                }
            }
        })

        // ✅ Handle notification CLICK (app background or killed)
        OneSignal.Notifications.addClickListener(object : INotificationClickListener {
            override fun onClick(event: INotificationClickEvent) {
                val data = event.notification.additionalData
                Log.d("OneSignal", "📲 Notification clicked: $data")

                val type = data?.optString("type") ?: return

                when (type) {
                    "incoming_call" -> {
                        val callId = data.optString("callId", "")
                        val callerName = data.optString("callerName", "Unknown")
                        val callerImage = data.optString("callerImage", "")
                        val callType = data.optString("callType", "VOICE")

                        if (callId.isNotEmpty()) {
                            CallNotificationHandler.handleIncomingCall(
                                context = this@Textly,
                                callId = callId,
                                callerName = callerName,
                                callerImage = callerImage,
                                callType = callType
                            )
                        }
                    }
                    "group_call" -> {
                        val callId = data.optString("callId", "")
                        val callerName = data.optString("callerName", "Unknown")
                        val groupName = data.optString("groupName", "Group")
                        val callType = data.optString("callType", "VOICE")

                        if (callId.isNotEmpty()) {
                            CallNotificationHandler.handleIncomingCall(
                                context = this@Textly,
                                callId = callId,
                                callerName = "$callerName ($groupName)",
                                callerImage = "",
                                callType = callType
                            )
                        }
                    }
                }
            }
        })

        Log.d("TextlyApp", "✅ OneSignal initialized")
    }
}