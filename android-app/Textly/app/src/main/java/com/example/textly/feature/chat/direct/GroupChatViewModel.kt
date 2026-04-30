package com.example.textly.feature.chat.direct

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.textly.model.Group
import com.example.textly.model.Message
import com.example.textly.model.User
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import com.example.textly.service.OneSignalNotificationSender

@HiltViewModel
class GroupChatViewModel @Inject constructor() : ViewModel() {

    private val TAG = "GroupChatViewModel"
    private val auth = FirebaseAuth.getInstance()
    private val firestore = FirebaseFirestore.getInstance()

    private val currentUserId: String
        get() = auth.currentUser?.uid.orEmpty()

    private val _messages = MutableStateFlow<List<Message>>(emptyList())
    val messages = _messages.asStateFlow()

    private val _groupInfo = MutableStateFlow<Group?>(null)
    val groupInfo = _groupInfo.asStateFlow()

    private val _isTyping = MutableStateFlow(false)
    val isTyping = _isTyping.asStateFlow()

    private var messagesListener: ListenerRegistration? = null
    private var typingListener: ListenerRegistration? = null
    private var groupListener: ListenerRegistration? = null
    private var typingJob: Job? = null

    // Load group info
    fun loadGroupInfo(groupId: String) {
        groupListener?.remove()

        groupListener = firestore.collection("groups")
            .document(groupId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.e(TAG, "Error loading group info", error)
                    return@addSnapshotListener
                }

                if (snapshot != null && snapshot.exists()) {
                    _groupInfo.value = Group(
                        id = snapshot.id,
                        name = snapshot.getString("name") ?: "",
                        description = snapshot.getString("description") ?: "",
                        groupImage = snapshot.getString("groupImage") ?: "",
                        createdBy = snapshot.getString("createdBy") ?: "",
                        createdAt = snapshot.getLong("createdAt") ?: 0L,
                        participants = (snapshot.get("participants") as? List<String>) ?: emptyList(),
                        admins = (snapshot.get("admins") as? List<String>) ?: emptyList(),
                        lastMessage = snapshot.getString("lastMessage") ?: "",
                        lastMessageTime = snapshot.getLong("lastMessageTime") ?: 0L
                    )
                }
            }
    }


    fun listenForGroupMessages(groupId: String) {
        messagesListener?.remove()

        messagesListener = firestore.collection("groups")
            .document(groupId)
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


    fun markMessagesAsRead(groupId: String) {
        viewModelScope.launch {
            try {

                val unreadMessages = firestore.collection("groups")
                    .document(groupId)
                    .collection("messages")
                    .whereNotEqualTo("senderId", currentUserId)
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

                Log.d(TAG, "✅ Marked ${unreadMessages.size()} group messages as read")
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error marking messages as read", e)
            }
        }
    }

    // In sendGroupMessage function:
    fun sendGroupMessage(groupId: String, text: String) {
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

            firestore.collection("groups")
                .document(groupId)
                .collection("messages")
                .add(messageData)
                .addOnSuccessListener {
                    Log.d(TAG, "✅ Message sent")
                }
                .addOnFailureListener { e ->
                    Log.e(TAG, "❌ Failed to send message", e)
                }

            // Update last message
            firestore.collection("groups")
                .document(groupId)
                .update(
                    mapOf(
                        "lastMessage" to text.trim(),
                        "lastMessageTime" to System.currentTimeMillis()
                    )
                )

            // ✅ Send OneSignal notification
            val groupInfo = _groupInfo.value
            if (groupInfo != null) {
                OneSignalNotificationSender.sendGroupMessageNotification(
                    groupId = groupId,
                    groupName = groupInfo.name,
                    senderName = currentUser.displayName ?: "User",
                    messageText = text.trim()
                )
            }

            stopTyping(groupId)
        }
    }


    fun onTyping(groupId: String) {
        typingJob?.cancel()
        setTypingStatus(groupId, true)

        typingJob = viewModelScope.launch {
            delay(3000)
            setTypingStatus(groupId, false)
        }
    }

    fun stopTyping(groupId: String) {
        typingJob?.cancel()
        setTypingStatus(groupId, false)
    }

    private fun setTypingStatus(groupId: String, isTyping: Boolean) {
        viewModelScope.launch {
            try {
                val typingRef = firestore.collection("groups")
                    .document(groupId)
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

    fun listenForTypingStatus(groupId: String) {
        typingListener?.remove()

        typingListener = firestore.collection("groups")
            .document(groupId)
            .collection("typing")
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.e(TAG, "Error listening to typing status", error)
                    return@addSnapshotListener
                }

                val anyoneTyping = snapshot?.documents?.any { doc ->
                    val userId = doc.id
                    val isTyping = doc.getBoolean("isTyping") ?: false
                    val timestamp = doc.getLong("timestamp") ?: 0L
                    val isRecent = (System.currentTimeMillis() - timestamp) < 4000

                    userId != currentUserId && isTyping && isRecent
                } ?: false

                _isTyping.value = anyoneTyping
            }
    }

    override fun onCleared() {
        super.onCleared()
        messagesListener?.remove()
        typingListener?.remove()
        groupListener?.remove()
        typingJob?.cancel()
    }
}