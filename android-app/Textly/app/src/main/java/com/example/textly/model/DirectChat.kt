package com.example.textly.model

data class DirectChat(
    val chatId: String = "",
    val participants: List<String> = emptyList(),
    val lastMessage: String = "",
    val lastMessageTime: Long = 0L,
    val otherUserName: String = "",
    val otherUserEmail: String = "",
    val otherUserProfileUrl: String = "",
    val otherUserId: String = ""
)