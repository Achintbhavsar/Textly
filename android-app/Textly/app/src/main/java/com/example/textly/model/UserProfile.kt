package com.example.textly.model

data class UserProfile(
    val uid: String = "",
    val name: String = "",
    val email: String = "",
    val profileUrl: String = "",
    val bio: String = "",
    val phoneNumber: String = ""
)