package com.example.textly.feature.home

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.textly.model.Group
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.Query
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

@HiltViewModel
class GroupsListViewModel @Inject constructor() : ViewModel() {

    private val TAG = "GroupsListViewModel"
    private val auth = FirebaseAuth.getInstance()
    private val firestore = FirebaseFirestore.getInstance()

    private val currentUserId: String
        get() = auth.currentUser?.uid.orEmpty()

    private val _myGroups = MutableStateFlow<List<Group>>(emptyList())
    val myGroups = _myGroups.asStateFlow()

    private var groupsListener: ListenerRegistration? = null

    init {
        listenForMyGroups()
    }

    private fun listenForMyGroups() {
        if (currentUserId.isBlank()) {
            Log.e(TAG, "Cannot listen for groups - no current user")
            return
        }

        groupsListener?.remove()
        groupsListener = firestore.collection("groups")
            .whereArrayContains("participants", currentUserId)
            // ❌ Remove: .orderBy("lastMessageTime", Query.Direction.DESCENDING)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.e(TAG, "Error listening to groups", error)
                    return@addSnapshotListener
                }
                if (snapshot == null) return@addSnapshotListener

                val groups = snapshot.documents.mapNotNull { doc ->
                    Group(
                        id = doc.id,
                        name = doc.getString("name") ?: "",
                        description = doc.getString("description") ?: "",
                        groupImage = doc.getString("groupImage") ?: "",
                        createdBy = doc.getString("createdBy") ?: "",
                        createdAt = doc.getLong("createdAt") ?: 0L,
                        participants = doc.get("participants") as? List<String> ?: emptyList(),
                        admins = doc.get("admins") as? List<String> ?: emptyList(),
                        lastMessage = doc.getString("lastMessage") ?: "",
                        lastMessageTime = doc.getLong("lastMessageTime") ?: 0L
                    )
                }.sortedByDescending { it.lastMessageTime } // ✅ Sort in-memory instead

                _myGroups.value = groups
                Log.d(TAG, "Loaded ${groups.size} groups")
            }
    }

    override fun onCleared() {
        super.onCleared()
        groupsListener?.remove()
    }
}