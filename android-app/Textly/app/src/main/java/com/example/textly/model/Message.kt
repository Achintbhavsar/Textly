package com.example.textly.model

data class Message(
    val id: String = "",
    val senderId: String = "",
    val message: String = "",
    val createdAt: Long = 0L,
    val senderName: String = "",
    val senderImage: String? = null,
    val imageUrl: String? = null,

    val delivered: Boolean = false,
    val read: Boolean = false,
    val deliveredAt: Long = 0L,
    val readAt: Long = 0L
)