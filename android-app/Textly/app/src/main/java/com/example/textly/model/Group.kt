package com.example.textly.model

data class Group(
    val id: String = "",
    val name: String = "",
    val description: String = "",
    val groupImage: String = "",
    val createdBy: String = "",
    val createdAt: Long = 0L,
    val participants: List<String> = emptyList(),
    val admins: List<String> = emptyList(),
    val lastMessage: String = "",
    val lastMessageTime: Long = 0L
)