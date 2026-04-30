package com.example.textly.feature.auth.signup

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.UserProfileChangeRequest
import com.google.firebase.firestore.FirebaseFirestore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject

@HiltViewModel
class SignUpViewModel @Inject constructor() : ViewModel() {

    private val auth = FirebaseAuth.getInstance()
    private val firestore = FirebaseFirestore.getInstance()

    private val _state = MutableStateFlow<SignUpState>(SignUpState.Nothing)
    val state = _state.asStateFlow()

    fun signUp(name: String, email: String, password: String) {
        viewModelScope.launch {
            _state.value = SignUpState.Loading
            try {
                val result = auth.createUserWithEmailAndPassword(email, password).await()
                val user = result.user

                // Set display name
                user?.updateProfile(
                    UserProfileChangeRequest.Builder()
                        .setDisplayName(name)
                        .build()
                )?.await()

                // Save to Firestore
                if (user != null) {
                    saveUserToFirestore(
                        uid = user.uid,
                        name = name,
                        email = email,
                        profileUrl = ""
                    )
                }

                _state.value = SignUpState.Success
            } catch (e: Exception) {
                _state.value = SignUpState.Error
            }
        }
    }

    fun signUpWithGoogle(idToken: String) {
        viewModelScope.launch {
            _state.value = SignUpState.Loading
            try {
                val credential = GoogleAuthProvider.getCredential(idToken, null)
                val result = auth.signInWithCredential(credential).await()
                val user = result.user
                if (user != null) {
                    saveUserToFirestore(
                        uid = user.uid,
                        name = user.displayName ?: "",
                        email = user.email ?: "",
                        profileUrl = user.photoUrl?.toString() ?: ""
                    )
                    _state.value = SignUpState.Success
                } else {
                    _state.value = SignUpState.Error
                }
            } catch (e: Exception) {
                _state.value = SignUpState.Error
            }
        }
    }

    private suspend fun saveUserToFirestore(uid: String, name: String, email: String, profileUrl: String) {
        val userMap = hashMapOf(
            "uid" to uid,
            "name" to name,
            "email" to email,
            "profileUrl" to profileUrl,
            "status" to "online"
        )
        firestore.collection("users").document(uid).set(userMap).await()
    }
}

sealed class SignUpState {
    object Nothing : SignUpState()
    object Loading : SignUpState()
    object Success : SignUpState()
    object Error : SignUpState()
}