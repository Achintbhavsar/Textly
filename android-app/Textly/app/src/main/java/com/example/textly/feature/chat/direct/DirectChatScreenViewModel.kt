package com.example.textly.feature.chat

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.textly.model.Message
import com.example.textly.model.User
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import com.example.textly.service.OneSignalNotificationSender

@HiltViewModel
class DirectChatViewModel @Inject constructor() : ViewModel() {

    private val TAG = "DirectChatViewModel"
    private val auth = FirebaseAuth.getInstance()
    private val firestore = FirebaseFirestore.getInstance()

    private val currentUserId: String
        get() = auth.currentUser?.uid.orEmpty()

    private val _messages = MutableStateFlow<List<Message>>(emptyList())
    val messages = _messages.asStateFlow()

    private val _otherUser = MutableStateFlow<User?>(null)
    val otherUser = _otherUser.asStateFlow()

    private val _isOtherUserTyping = MutableStateFlow(false)
    val isOtherUserTyping = _isOtherUserTyping.asStateFlow()

    private var messagesListener: ListenerRegistration? = null
    private var typingListener: ListenerRegistration? = null
    private var typingJob: Job? = null


    fun loadOtherUserInfo(otherUserId: String) {
        viewModelScope.launch {
            try {
                val doc = firestore.collection("users")
                    .document(otherUserId)
                    .get()
                    .await()

                if (doc.exists()) {
                    _otherUser.value = User(
                        uid = doc.getString("uid") ?: "",
                        name = doc.getString("name") ?: "",
                        email = doc.getString("email") ?: "",
                        profileUrl = doc.getString("profileUrl") ?: "",
                        status = doc.getString("status") ?: "offline"
                    )
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error loading other user", e)
            }
        }
    }


    fun listenForDirectMessages(chatId: String) {
        messagesListener?.remove()

        messagesListener = firestore.collection("directChats")
            .document(chatId)
            .collection("messages")
            .orderBy("createdAt", Query.Direction.ASCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.e(TAG, "Error listening to messages", error)
                    return@addSnapshotListener
                }

                val messagesList = snapshot?.documents?.mapNotNull { doc ->
                    Message(
                        id = doc.id,
                        senderId = doc.getString("senderId") ?: "",
                        message = doc.getString("message") ?: "",
                        createdAt = doc.getLong("createdAt") ?: 0L,
                        senderName = doc.getString("senderName") ?: "",
                        senderImage = doc.getString("senderImage"),
                        imageUrl = doc.getString("imageUrl"),
                        delivered = doc.getBoolean("delivered") ?: false,
                        read = doc.getBoolean("read") ?: false,
                        deliveredAt = doc.getLong("deliveredAt") ?: 0L,
                        readAt = doc.getLong("readAt") ?: 0L
                    )
                } ?: emptyList()

                _messages.value = messagesList
            }
    }


    fun markMessagesAsRead(chatId: String, otherUserId: String) {
        viewModelScope.launch {
            try {
                val unreadMessages = firestore.collection("directChats")
                    .document(chatId)
                    .collection("messages")
                    .whereEqualTo("senderId", otherUserId)
                    .whereEqualTo("read", false)
                    .get()
                    .await()

                if (unreadMessages.isEmpty) {
                    return@launch
                }

                val batch = firestore.batch()
                unreadMessages.documents.forEach { doc ->
                    batch.update(
                        doc.reference,
                        mapOf(
                            "read" to true,
                            "readAt" to System.currentTimeMillis(),
                            "delivered" to true,
                            "deliveredAt" to System.currentTimeMillis()
                        )
                    )
                }
                batch.commit()

                Log.d(TAG, "✅ Marked ${unreadMessages.size()} messages as read")
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error marking messages as read", e)
            }
        }
    }


    // In sendDirectMessage function:
    fun sendDirectMessage(chatId: String, text: String) {
        val currentUser = auth.currentUser ?: return
        if (text.isBlank()) return

        viewModelScope.launch {
            val messageData = hashMapOf(
                "senderId" to currentUser.uid,
                "message" to text.trim(),
                "createdAt" to System.currentTimeMillis(),
                "senderName" to (currentUser.displayName ?: "User"),
                "senderImage" to (currentUser.photoUrl?.toString() ?: ""),
                "delivered" to false,
                "read" to false,
                "deliveredAt" to 0L,
                "readAt" to 0L
            )

            firestore.collection("directChats")
                .document(chatId)
                .collection("messages")
                .add(messageData)
                .addOnSuccessListener {
                    Log.d(TAG, "✅ Message sent")
                }
                .addOnFailureListener { e ->
                    Log.e(TAG, "❌ Failed to send message", e)
                }

            // Update last message
            firestore.collection("directChats")
                .document(chatId)
                .update(
                    mapOf(
                        "lastMessage" to text.trim(),
                        "lastMessageTime" to System.currentTimeMillis()
                    )
                )

            // ✅ Send OneSignal notification
            val otherUserId = _otherUser.value?.uid
            if (otherUserId != null) {
                OneSignalNotificationSender.sendMessageNotification(
                    receiverId = otherUserId,
                    senderName = currentUser.displayName ?: "User",
                    messageText = text.trim(),
                    chatId = chatId
                )
            }

            stopTyping(chatId)
        }
    }
    // ✅ Create or get direct chat
    suspend fun startDirectChat(otherUserId: String): String? {
        return try {
            val chatId = if (currentUserId < otherUserId) {
                "${currentUserId}_${otherUserId}"
            } else {
                "${otherUserId}_${currentUserId}"
            }

            // ✅ Check if chat document exists
            val chatDoc = firestore.collection("directChats")
                .document(chatId)
                .get()
                .await()

            // ✅ If chat doesn't exist, create it
            if (!chatDoc.exists()) {
                val chatData = hashMapOf(
                    "participants" to listOf(currentUserId, otherUserId),
                    "createdAt" to System.currentTimeMillis(),
                    "lastMessage" to "",
                    "lastMessageTime" to 0L
                )

                firestore.collection("directChats")
                    .document(chatId)
                    .set(chatData)
                    .await()

                Log.d(TAG, "✅ Created new chat: $chatId")
            }

            chatId
        } catch (e: Exception) {
            Log.e(TAG, "❌ Error starting chat", e)
            null
        }
    }

    fun onTyping(chatId: String) {
        typingJob?.cancel()
        setTypingStatus(chatId, true)

        typingJob = viewModelScope.launch {
            delay(3000)
            setTypingStatus(chatId, false)
        }
    }

    fun stopTyping(chatId: String) {
        typingJob?.cancel()
        setTypingStatus(chatId, false)
    }

    private fun setTypingStatus(chatId: String, isTyping: Boolean) {
        viewModelScope.launch {
            try {
                val typingRef = firestore.collection("directChats")
                    .document(chatId)
                    .collection("typing")
                    .document(currentUserId)

                typingRef.update(
                    mapOf(
                        "isTyping" to isTyping,
                        "timestamp" to System.currentTimeMillis()
                    )
                ).addOnFailureListener {
                    typingRef.set(
                        mapOf(
                            "isTyping" to isTyping,
                            "timestamp" to System.currentTimeMillis()
                        )
                    )
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error updating typing status", e)
            }
        }
    }

    fun listenForTypingStatus(chatId: String, otherUserId: String) {
        typingListener?.remove()

        typingListener = firestore.collection("directChats")
            .document(chatId)
            .collection("typing")
            .document(otherUserId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.e(TAG, "Error listening to typing status", error)
                    return@addSnapshotListener
                }

                val isTyping = snapshot?.getBoolean("isTyping") ?: false
                val timestamp = snapshot?.getLong("timestamp") ?: 0L
                val isRecent = (System.currentTimeMillis() - timestamp) < 4000

                _isOtherUserTyping.value = isTyping && isRecent
            }
    }

    override fun onCleared() {
        super.onCleared()
        messagesListener?.remove()
        typingListener?.remove()
        typingJob?.cancel()
    }
}