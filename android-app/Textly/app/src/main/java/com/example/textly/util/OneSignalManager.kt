package com.example.textly.util

import android.util.Log
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.onesignal.OneSignal

object OneSignalManager {

    private const val TAG = "OneSignalManager"

    /**
     * Save OneSignal Player ID to Firestore
     * Call this after successful login
     */
    fun savePlayerId() {
        val userId = FirebaseAuth.getInstance().currentUser?.uid
        if (userId == null) {
            Log.w(TAG, "❌ No user logged in")
            return
        }

        // Set external user ID for OneSignal
        OneSignal.login(userId)
        Log.d(TAG, "✅ OneSignal external user ID set: $userId")

        // Get OneSignal Player ID (subscription ID)
        val playerId = OneSignal.User.pushSubscription.id

        if (playerId.isNullOrEmpty()) {
            Log.w(TAG, "⚠️ OneSignal Player ID is null, will retry later")
            // Retry after a delay
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({
                savePlayerIdRetry(userId)
            }, 2000)
            return
        }

        // Save to Firestore
        FirebaseFirestore.getInstance()
            .collection("users")
            .document(userId)
            .update("oneSignalId", playerId)
            .addOnSuccessListener {
                Log.d(TAG, "✅ OneSignal Player ID saved to Firestore: $playerId")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "❌ Failed to save OneSignal Player ID", e)
            }
    }

    private fun savePlayerIdRetry(userId: String) {
        val playerId = OneSignal.User.pushSubscription.id

        if (!playerId.isNullOrEmpty()) {
            FirebaseFirestore.getInstance()
                .collection("users")
                .document(userId)
                .update("oneSignalId", playerId)
                .addOnSuccessListener {
                    Log.d(TAG, "✅ OneSignal Player ID saved (retry): $playerId")
                }
                .addOnFailureListener { e ->
                    Log.e(TAG, "❌ Failed to save OneSignal Player ID (retry)", e)
                }
        } else {
            Log.w(TAG, "❌ OneSignal Player ID still null after retry")
        }
    }

    /**
     * Clear OneSignal Player ID from Firestore
     * Call this on logout
     */
    fun clearPlayerId() {
        val userId = FirebaseAuth.getInstance().currentUser?.uid ?: return

        FirebaseFirestore.getInstance()
            .collection("users")
            .document(userId)
            .update("oneSignalId", "")
            .addOnSuccessListener {
                Log.d(TAG, "✅ OneSignal Player ID cleared")
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "❌ Failed to clear OneSignal Player ID", e)
            }

        // Logout from OneSignal
        OneSignal.logout()
        Log.d(TAG, "✅ OneSignal user logged out")
    }
}