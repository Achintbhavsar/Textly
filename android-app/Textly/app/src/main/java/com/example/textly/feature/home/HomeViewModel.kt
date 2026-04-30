package com.example.textly.feature.home

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.textly.model.User
import com.example.textly.model.DirectChat
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import com.example.textly.webrtc.CallManager
import com.example.textly.model.CallStatus

@HiltViewModel
class HomeViewModel @Inject constructor() : ViewModel() {

    private val TAG = "HomeViewModel"
    private val auth = FirebaseAuth.getInstance()
    private val firestore = FirebaseFirestore.getInstance()

    private val currentUserId: String
        get() = auth.currentUser?.uid.orEmpty()

    private val _allUsers = MutableStateFlow<List<User>>(emptyList())
    val allUsers = _allUsers.asStateFlow()

    private val _myChats = MutableStateFlow<List<DirectChat>>(emptyList())
    val myChats = _myChats.asStateFlow()
    private var callListener: ListenerRegistration? = null

    private var chatsListener: ListenerRegistration? = null
    private var usersListener: ListenerRegistration? = null

    // ✅ Start both listeners immediately
    init {
        loadMyChats()
        loadAllUsers()
    }

    // ✅ Real-time listener for all users
    fun loadAllUsers() {
        usersListener?.remove()

        usersListener = firestore.collection("users")
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.e(TAG, "❌ Error loading users", error)
                    return@addSnapshotListener
                }

                val usersList = snapshot?.documents?.mapNotNull { doc ->
                    User(
                        uid = doc.getString("uid") ?: "",
                        name = doc.getString("name") ?: "",
                        email = doc.getString("email") ?: "",
                        profileUrl = doc.getString("profileUrl") ?: "",
                        status = doc.getString("status") ?: "offline"
                    )
                }?.filter { it.uid != currentUserId } ?: emptyList()

                _allUsers.value = usersList
                Log.d(TAG, "✅ Loaded ${usersList.size} users")
            }
    }

    // ✅ Real-time listener for my chats
    fun loadMyChats() {
        chatsListener?.remove()

        chatsListener = firestore.collection("directChats")
            .whereArrayContains("participants", currentUserId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.e("HomeViewModel", "❌ Error listening to chats", error)
                    return@addSnapshotListener
                }

                viewModelScope.launch {
                    val chatsList = mutableListOf<DirectChat>()

                    snapshot?.documents?.forEach { doc ->
                        try {
                            val participants = doc.get("participants") as? List<String> ?: emptyList()
                            val otherUserId = participants.firstOrNull { it != currentUserId } ?: return@forEach

                            // ✅ Fetch other user's info
                            val otherUserDoc = firestore.collection("users")
                                .document(otherUserId)
                                .get()
                                .await()

                            chatsList.add(
                                DirectChat(
                                    chatId = doc.id,
                                    participants = participants,
                                    lastMessage = doc.getString("lastMessage") ?: "",
                                    lastMessageTime = doc.getLong("lastMessageTime") ?: 0L,
                                    otherUserId = otherUserId,
                                    otherUserName = otherUserDoc.getString("name") ?: "Unknown",
                                    otherUserEmail = otherUserDoc.getString("email") ?: "",
                                    otherUserProfileUrl = otherUserDoc.getString("profileUrl") ?: ""
                                )
                            )
                        } catch (e: Exception) {
                            Log.e("HomeViewModel", "Error processing chat", e)
                        }
                    }

                    _myChats.value = chatsList.sortedByDescending { it.lastMessageTime }
                    Log.d("HomeViewModel", "✅ Loaded ${chatsList.size} chats")
                }
            }
    }

    // ✅ Search users
    fun searchUsers(query: String): List<User> {
        if (query.isBlank()) return _allUsers.value

        return _allUsers.value.filter { user ->
            user.name.contains(query, ignoreCase = true) ||
                    user.email.contains(query, ignoreCase = true)
        }
    }

    // ✅ Start direct chat with callback so navigation waits for Firestore
    fun startDirectChat(otherUserId: String, onReady: () -> Unit = {}) {
        viewModelScope.launch {
            try {
                val chatId = if (currentUserId < otherUserId)
                    "${currentUserId}_${otherUserId}"
                else
                    "${otherUserId}_${currentUserId}"

                val chatDoc = firestore.collection("directChats")
                    .document(chatId)
                    .get()
                    .await()

                if (!chatDoc.exists()) {
                    firestore.collection("directChats")
                        .document(chatId)
                        .set(
                            mapOf(
                                "participants" to listOf(currentUserId, otherUserId),
                                "createdAt" to System.currentTimeMillis(),
                                "lastMessage" to "",
                                "lastMessageTime" to 0L
                            )
                        )
                        .await() // ✅ Wait for write to complete before navigating
                    Log.d(TAG, "✅ Chat created: $chatId")
                } else {
                    Log.d(TAG, "✅ Chat already exists: $chatId")
                }

                onReady() // ✅ Navigate only after Firestore confirms
            } catch (e: Exception) {
                Log.e(TAG, "❌ Error starting chat", e)
            }
        }
    }
    fun listenForIncomingCalls(onIncomingCall: (String, String, String, String) -> Unit) {
        val userId = auth.currentUser?.uid ?: return

        callListener = firestore.collection("calls")
            .whereEqualTo("receiverId", userId)
            .whereEqualTo("callStatus", CallStatus.RINGING.name)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.e(TAG, "Error listening for calls", error)
                    return@addSnapshotListener
                }

                snapshot?.documentChanges?.forEach { change ->
                    if (change.type == com.google.firebase.firestore.DocumentChange.Type.ADDED) {
                        val doc = change.document
                        val callId = doc.id
                        val callerName = doc.getString("callerName") ?: "Unknown"
                        val callerImage = doc.getString("callerImage") ?: ""
                        val callType = doc.getString("callType") ?: "VOICE"

                        onIncomingCall(callId, callerName, callerImage, callType)
                    }
                }
            }
    }

    // ✅ Clean up listeners when ViewModel is destroyed
    override fun onCleared() {
        super.onCleared()
        chatsListener?.remove()
        usersListener?.remove()
        callListener?.remove()
    }
}