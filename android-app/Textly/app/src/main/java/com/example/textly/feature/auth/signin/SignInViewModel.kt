package com.example.textly.feature.auth.signin

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.example.textly.util.OneSignalManager
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.firestore.FirebaseFirestore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import javax.inject.Inject
import android.os.Handler
import android.os.Looper

@HiltViewModel
class SignInViewModel @Inject constructor() : ViewModel() {

    private val auth = FirebaseAuth.getInstance()
    private val firestore = FirebaseFirestore.getInstance()

    private val _state = MutableStateFlow<SignInState>(SignInState.Nothing)
    val state = _state.asStateFlow()

    fun signIn(email: String, password: String) {
        viewModelScope.launch {
            _state.value = SignInState.Loading
            try {
                val result = auth.signInWithEmailAndPassword(email, password).await()

                result.user?.let { user ->
                    saveUserToFirestore(
                        uid = user.uid,
                        name = user.displayName ?: "",
                        email = user.email ?: "",
                        profileUrl = user.photoUrl?.toString() ?: ""
                    )
                }
                Handler(Looper.getMainLooper()).postDelayed({
                    OneSignalManager.savePlayerId()
                }, 3000)
                _state.value = SignInState.Success
            } catch (e: Exception) {
                _state.value = SignInState.Error
            }
        }
    }

    fun signInWithGoogle(idToken: String) {
        viewModelScope.launch {
            _state.value = SignInState.Loading
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
                    OneSignalManager.savePlayerId() // 👈 Added after successful Google login
                    _state.value = SignInState.Success
                } else {
                    _state.value = SignInState.Error
                }
            } catch (e: Exception) {
                _state.value = SignInState.Error
            }
        }
    }

    private suspend fun saveUserToFirestore(
        uid: String,
        name: String,
        email: String,
        profileUrl: String
    ) {
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

sealed class SignInState {
    object Nothing : SignInState()
    object Loading : SignInState()
    object Success : SignInState()
    object Error : SignInState()
}