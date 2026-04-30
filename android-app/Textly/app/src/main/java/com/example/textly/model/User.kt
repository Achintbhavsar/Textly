package com.example.textly.model

data class User(
    val uid: String = "",
    val name: String = "",
    val email: String = "",
    val profileUrl: String = "",
    val status: String = "offline",
    val bio: String = "",
    val oneSignalId: String = ""  // ✅ Changed from fcmToken to oneSignalId
)