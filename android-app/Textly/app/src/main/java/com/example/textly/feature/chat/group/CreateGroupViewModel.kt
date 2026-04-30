package com.example.textly.feature.group

import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.textly.model.User
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class CreateGroupViewModel @Inject constructor() : ViewModel() {

    private val TAG = "CreateGroupViewModel"
    private val auth = FirebaseAuth.getInstance()
    private val firestore = FirebaseFirestore.getInstance()

    private val currentUserId: String
        get() = auth.currentUser?.uid.orEmpty()

    private val _allUsers = MutableStateFlow<List<User>>(emptyList())
    val allUsers = _allUsers.asStateFlow()

    private val _selectedUsers = MutableStateFlow<List<User>>(emptyList())
    val selectedUsers = _selectedUsers.asStateFlow()

    private val _isCreating = MutableStateFlow(false)
    val isCreating = _isCreating.asStateFlow()

    init {
        loadAllUsers()
    }

    private fun loadAllUsers() {
        firestore.collection("users")
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.e(TAG, "Error loading users", error)
                    return@addSnapshotListener
                }
                if (snapshot == null) return@addSnapshotListener

                val users = snapshot.documents.mapNotNull { doc ->
                    val uid = doc.getString("uid") ?: return@mapNotNull null
                    if (uid == currentUserId) return@mapNotNull null // Don't show current user

                    User(
                        uid = uid,
                        name = doc.getString("name") ?: "",
                        email = doc.getString("email") ?: "",
                        profileUrl = doc.getString("profileUrl") ?: "",
                        status = doc.getString("status") ?: "offline"
                    )
                }
                _allUsers.value = users
                Log.d(TAG, "Loaded ${users.size} users")
            }
    }

    fun toggleUserSelection(user: User) {
        val currentSelection = _selectedUsers.value.toMutableList()
        if (currentSelection.contains(user)) {
            currentSelection.remove(user)
        } else {
            currentSelection.add(user)
        }
        _selectedUsers.value = currentSelection
        Log.d(TAG, "Selected users: ${currentSelection.size}")
    }

    fun createGroup(
        groupName: String,
        description: String,
        onSuccess: (String) -> Unit
    ) {
        if (groupName.isBlank()) {
            Log.e(TAG, "Group name is blank")
            return
        }

        viewModelScope.launch {
            _isCreating.value = true
            Log.d(TAG, "Creating group: $groupName")

            try {
                val groupId = firestore.collection("groups").document().id

                // Create participant list (selected users + current user)
                val participants = _selectedUsers.value.map { it.uid }.toMutableList()
                participants.add(currentUserId)

                val groupData = hashMapOf(
                    "id" to groupId,
                    "name" to groupName,
                    "description" to description,
                    "groupImage" to "",
                    "createdBy" to currentUserId,
                    "createdAt" to System.currentTimeMillis(),
                    "participants" to participants,
                    "admins" to listOf(currentUserId),
                    "lastMessage" to "",
                    "lastMessageTime" to System.currentTimeMillis()
                )

                firestore.collection("groups")
                    .document(groupId)
                    .set(groupData)
                    .addOnSuccessListener {
                        Log.d(TAG, "Group created successfully: $groupId")
                        _isCreating.value = false
                        onSuccess(groupId)
                    }
                    .addOnFailureListener { e ->
                        Log.e(TAG, "Failed to create group", e)
                        _isCreating.value = false
                    }

            } catch (e: Exception) {
                Log.e(TAG, "Error creating group", e)
                _isCreating.value = false
            }
        }
    }
}