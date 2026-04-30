package com.example.textly.model

data class Call(
    val callId: String = "",
    val callerId: String = "",
    val callerName: String = "",
    val callerImage: String = "",
    val receiverId: String = "",
    val receiverName: String = "",
    val receiverImage: String = "",
    val callType: CallType = CallType.VOICE,
    val callStatus: CallStatus = CallStatus.RINGING,
    val offer: String? = null,
    val offerType: String? = null,
    val answer: String? = null,
    val answerType: String? = null,
    val iceCandidates: List<IceCandidate> = emptyList(),
    val timestamp: Long = System.currentTimeMillis(),
    val isGroupCall: Boolean = false,
    val groupId: String? = null,
    val groupName: String? = null,
    val participants: List<String> = emptyList()
)

data class IceCandidate(
    val sdp: String = "",
    val sdpMid: String = "",
    val sdpMLineIndex: Int = 0,
    val userId: String = ""
)

enum class CallType {
    VOICE,
    VIDEO
}

enum class CallStatus {
    RINGING,
    ACCEPTED,
    REJECTED,
    ENDED,
    MISSED,
    BUSY
}