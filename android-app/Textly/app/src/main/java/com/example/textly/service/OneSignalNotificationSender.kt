package com.example.textly.service

import android.util.Log
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import com.example.textly.model.CallType

object OneSignalNotificationSender {

    private const val TAG = "OneSignalSender"

    // ✅ Replace these with your OneSignal credentials
    private const val ONESIGNAL_APP_ID = "2a094a8e-c6d5-48e5-9443-13162e6e8a44"
    private const val ONESIGNAL_REST_API_KEY = "os_v2_app_fieuvdwg2veolfcdcmlc43ukitbtqnrxldgush55gcdxksnmr7ym6l4tmvzfw24zablmptiqegsziqrcttndb3klidgaizz5okyhf5y"
    private const val ONESIGNAL_API_URL = "https://onesignal.com/api/v1/notifications"

    /**
     * Send notification for direct message
     */
    suspend fun sendMessageNotification(
        receiverId: String,
        senderName: String,
        messageText: String,
        chatId: String
    ) = withContext(Dispatchers.IO) {
        try {
            // Get receiver's OneSignal ID from Firestore
            val receiverDoc = FirebaseFirestore.getInstance()
                .collection("users")
                .document(receiverId)
                .get()
                .await()

            val oneSignalId = receiverDoc.getString("oneSignalId")

            if (oneSignalId.isNullOrEmpty()) {
                Log.w(TAG, "❌ Receiver has no OneSignal ID")
                return@withContext
            }

            val currentUserId = FirebaseAuth.getInstance().currentUser?.uid ?: ""

            // Build notification payload
            val notification = JSONObject().apply {
                put("app_id", ONESIGNAL_APP_ID)
                put("include_player_ids", JSONArray().put(oneSignalId))

                // Notification content
                put("headings", JSONObject().apply {
                    put("en", senderName)
                })

                put("contents", JSONObject().apply {
                    put("en", messageText)
                })

                // Custom data
                put("data", JSONObject().apply {
                    put("chatId", chatId)
                    put("senderId", currentUserId)
                    put("senderName", senderName)
                    put("type", "direct_message")
                })

                // ❌ REMOVED: android_channel_id (causing the error)
                // ✅ OneSignal will use its default channel

                put("priority", 10)
            }

            sendNotificationRequest(notification)

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error sending direct message notification", e)
        }
    }

    /**
     * Send notification for group message
     */
    suspend fun sendGroupMessageNotification(
        groupId: String,
        groupName: String,
        senderName: String,
        messageText: String
    ) = withContext(Dispatchers.IO) {
        try {
            val currentUserId = FirebaseAuth.getInstance().currentUser?.uid ?: return@withContext

            // Get group participants
            val groupDoc = FirebaseFirestore.getInstance()
                .collection("groups")
                .document(groupId)
                .get()
                .await()

            val participants = (groupDoc.get("participants") as? List<String>) ?: emptyList()

            // Collect all OneSignal IDs except sender
            val playerIds = JSONArray()
            var recipientCount = 0

            for (participantId in participants) {
                if (participantId != currentUserId) {
                    val userDoc = FirebaseFirestore.getInstance()
                        .collection("users")
                        .document(participantId)
                        .get()
                        .await()

                    val oneSignalId = userDoc.getString("oneSignalId")
                    if (!oneSignalId.isNullOrEmpty()) {
                        playerIds.put(oneSignalId)
                        recipientCount++
                    }
                }
            }

            if (playerIds.length() == 0) {
                Log.w(TAG, "❌ No recipients with OneSignal IDs found")
                return@withContext
            }

            // Build notification payload
            val notification = JSONObject().apply {
                put("app_id", ONESIGNAL_APP_ID)
                put("include_player_ids", playerIds)

                // Notification content
                put("headings", JSONObject().apply {
                    put("en", groupName)
                })

                put("contents", JSONObject().apply {
                    put("en", "$senderName: $messageText")
                })

                // Custom data
                put("data", JSONObject().apply {
                    put("groupId", groupId)
                    put("groupName", groupName)
                    put("senderId", currentUserId)
                    put("senderName", senderName)
                    put("type", "group_message")
                })

                // ❌ REMOVED: android_channel_id (causing the error)
                // ✅ OneSignal will use its default channel

                put("priority", 10)
            }

            sendNotificationRequest(notification)
            Log.d(TAG, "✅ Group notification sent to $recipientCount recipients")

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error sending group notification", e)
        }
    }

    /**
     * Send HTTP request to OneSignal API
     */
    private fun sendNotificationRequest(notification: JSONObject) {
        try {
            val url = URL(ONESIGNAL_API_URL)
            val connection = url.openConnection() as HttpURLConnection

            connection.apply {
                requestMethod = "POST"
                setRequestProperty("Content-Type", "application/json; charset=UTF-8")
                setRequestProperty("Authorization", "Basic $ONESIGNAL_REST_API_KEY")
                doOutput = true
                doInput = true
            }

            // Write request
            val writer = OutputStreamWriter(connection.outputStream)
            writer.write(notification.toString())
            writer.flush()
            writer.close()

            // Read response
            val responseCode = connection.responseCode

            if (responseCode == 200) {
                val reader = BufferedReader(InputStreamReader(connection.inputStream))
                val response = reader.readText()
                reader.close()

                Log.d(TAG, "✅ Notification sent successfully")
                Log.d(TAG, "Response: $response")
            } else {
                val errorReader = BufferedReader(InputStreamReader(connection.errorStream))
                val errorResponse = errorReader.readText()
                errorReader.close()

                Log.e(TAG, "❌ Failed to send notification. Code: $responseCode")
                Log.e(TAG, "Error: $errorResponse")
            }

            connection.disconnect()

        } catch (e: Exception) {
            Log.e(TAG, "❌ HTTP request error", e)
        }
    }
    /**
     * Send incoming call notification
     */
    suspend fun sendCallNotification(
        receiverId: String,
        callerName: String,
        callId: String,
        callType: CallType
    ) = withContext(Dispatchers.IO) {
        try {
            // Get receiver's OneSignal ID
            val receiverDoc = FirebaseFirestore.getInstance()
                .collection("users")
                .document(receiverId)
                .get()
                .await()

            val oneSignalId = receiverDoc.getString("oneSignalId")

            if (oneSignalId.isNullOrEmpty()) {
                Log.w(TAG, "❌ Receiver has no OneSignal ID")
                return@withContext
            }

            val currentUserId = FirebaseAuth.getInstance().currentUser?.uid ?: ""
            val callTypeText = if (callType == CallType.VOICE) "Voice Call" else "Video Call"

            // Build notification
            val notification = JSONObject().apply {
                put("app_id", ONESIGNAL_APP_ID)
                put("include_player_ids", JSONArray().put(oneSignalId))

                put("headings", JSONObject().apply {
                    put("en", "Incoming $callTypeText")
                })

                put("contents", JSONObject().apply {
                    put("en", "$callerName is calling...")
                })

                put("data", JSONObject().apply {
                    put("callId", callId)
                    put("callerId", currentUserId)
                    put("callerName", callerName)
                    put("callType", callType.name)
                    put("type", "incoming_call")
                })

                put("priority", 10)
                put("ttl", 30) // Expire after 30 seconds

                // Call buttons
                put("buttons", JSONArray().apply {
                    put(JSONObject().apply {
                        put("id", "accept")
                        put("text", "Accept")
                    })
                    put(JSONObject().apply {
                        put("id", "reject")
                        put("text", "Reject")
                    })
                })
            }

            sendNotificationRequest(notification)

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error sending call notification", e)
        }
    }

    /**
     * Send group call notification
     */
    suspend fun sendGroupCallNotification(
        groupId: String,
        groupName: String,
        callerName: String,
        callId: String,
        callType: CallType,
        participants: List<String>
    ) = withContext(Dispatchers.IO) {
        try {
            val currentUserId = FirebaseAuth.getInstance().currentUser?.uid ?: return@withContext

            // Collect OneSignal IDs
            val playerIds = JSONArray()

            for (participantId in participants) {
                if (participantId != currentUserId) {
                    val userDoc = FirebaseFirestore.getInstance()
                        .collection("users")
                        .document(participantId)
                        .get()
                        .await()

                    val oneSignalId = userDoc.getString("oneSignalId")
                    if (!oneSignalId.isNullOrEmpty()) {
                        playerIds.put(oneSignalId)
                    }
                }
            }

            if (playerIds.length() == 0) {
                Log.w(TAG, "❌ No recipients found")
                return@withContext
            }

            val callTypeText = if (callType == CallType.VOICE) "Voice Call" else "Video Call"

            // Build notification
            val notification = JSONObject().apply {
                put("app_id", ONESIGNAL_APP_ID)
                put("include_player_ids", playerIds)

                put("headings", JSONObject().apply {
                    put("en", "Incoming Group $callTypeText")
                })

                put("contents", JSONObject().apply {
                    put("en", "$callerName is calling $groupName...")
                })

                put("data", JSONObject().apply {
                    put("callId", callId)
                    put("callerId", currentUserId)
                    put("callerName", callerName)
                    put("callType", callType.name)
                    put("groupId", groupId)
                    put("groupName", groupName)
                    put("type", "group_call")
                })

                put("priority", 10)
                put("ttl", 30)

                put("buttons", JSONArray().apply {
                    put(JSONObject().apply {
                        put("id", "join")
                        put("text", "Join")
                    })
                    put(JSONObject().apply {
                        put("id", "decline")
                        put("text", "Decline")
                    })
                })
            }

            sendNotificationRequest(notification)

        } catch (e: Exception) {
            Log.e(TAG, "❌ Error sending group call notification", e)
        }
    }

}