package com.example.textly.feature.profile

import android.content.Context
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.textly.model.UserProfile
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.UserProfileChangeRequest
import com.google.firebase.firestore.FirebaseFirestore
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import kotlinx.coroutines.tasks.await

@HiltViewModel
class ProfileViewModel @Inject constructor(
    @ApplicationContext private val context: Context
) : ViewModel() {

    private val TAG = "ProfileViewModel"
    private val auth = FirebaseAuth.getInstance()
    private val firestore = FirebaseFirestore.getInstance()

    private val currentUserId: String
        get() = auth.currentUser?.uid.orEmpty()

    private val _userProfile = MutableStateFlow<UserProfile?>(null)
    val userProfile = _userProfile.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading = _isLoading.asStateFlow()

    fun loadUserProfile() {
        if (currentUserId.isEmpty()) {
            Log.e(TAG, "Cannot load profile - no current user")
            return
        }

        viewModelScope.launch {
            _isLoading.value = true
            try {
                val doc = firestore.collection("users")
                    .document(currentUserId)
                    .get()
                    .await()

                if (doc.exists()) {
                    _userProfile.value = UserProfile(
                        uid = doc.getString("uid") ?: "",
                        name = doc.getString("name") ?: "",
                        email = doc.getString("email") ?: "",
                        profileUrl = doc.getString("profileUrl") ?: "",
                        bio = doc.getString("bio") ?: "Hey there! I'm using Textly",
                        phoneNumber = doc.getString("phoneNumber") ?: ""
                    )
                    Log.d(TAG, "Profile loaded successfully")
                } else {
                    // Create user profile if doesn't exist
                    val currentUser = auth.currentUser
                    if (currentUser != null) {
                        val newProfile = UserProfile(
                            uid = currentUser.uid,
                            name = currentUser.displayName ?: "User",
                            email = currentUser.email ?: "",
                            profileUrl = currentUser.photoUrl?.toString() ?: "",
                            bio = "Hey there! I'm using Textly",
                            phoneNumber = ""
                        )

                        firestore.collection("users")
                            .document(currentUser.uid)
                            .set(mapOf(
                                "uid" to newProfile.uid,
                                "name" to newProfile.name,
                                "email" to newProfile.email,
                                "profileUrl" to newProfile.profileUrl,
                                "bio" to newProfile.bio,
                                "phoneNumber" to newProfile.phoneNumber
                            ))
                            .await()

                        _userProfile.value = newProfile
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error loading profile", e)
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun updateProfile(name: String, bio: String) {
        if (currentUserId.isEmpty()) return

        viewModelScope.launch {
            _isLoading.value = true
            try {
                firestore.collection("users")
                    .document(currentUserId)
                    .update(
                        mapOf(
                            "name" to name,
                            "bio" to bio
                        )
                    )
                    .await()

                val profileUpdates = UserProfileChangeRequest.Builder()
                    .setDisplayName(name)
                    .build()

                auth.currentUser?.updateProfile(profileUpdates)?.await()

                loadUserProfile()

                Log.d(TAG, "Profile updated successfully")
            } catch (e: Exception) {
                Log.e(TAG, "Error updating profile", e)
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun updatePhoneNumber(phoneNumber: String) {
        if (currentUserId.isEmpty()) return

        viewModelScope.launch {
            _isLoading.value = true
            try {
                firestore.collection("users")
                    .document(currentUserId)
                    .update("phoneNumber", phoneNumber)
                    .await()

                loadUserProfile()

                Log.d(TAG, "Phone number updated successfully")
            } catch (e: Exception) {
                Log.e(TAG, "Error updating phone number", e)
            } finally {
                _isLoading.value = false
            }
        }
    }

    // ❌ uploadProfileImage function REMOVED
    // Will add later when using Firebase Storage or alternative
}