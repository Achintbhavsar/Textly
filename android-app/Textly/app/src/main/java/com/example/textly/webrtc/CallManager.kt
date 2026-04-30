package com.example.textly.webrtc

import android.util.Log
import com.example.textly.model.Call
import com.example.textly.model.CallStatus
import com.example.textly.model.CallType
import com.example.textly.model.IceCandidate as ModelIceCandidate
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.DocumentChange
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import kotlinx.coroutines.tasks.await
import org.webrtc.SessionDescription
import org.webrtc.IceCandidate as WebRtcIceCandidate

object CallManager {

    private const val TAG = "CallManager"
    private val firestore = FirebaseFirestore.getInstance()
    private val auth = FirebaseAuth.getInstance()

    private var callListener: ListenerRegistration? = null
    private var iceListener: ListenerRegistration? = null

    // ─────────────────────────────────────────────
    // CALL LIFECYCLE
    // ─────────────────────────────────────────────

    suspend fun initiateCall(
        receiverId: String,
        receiverName: String,
        receiverImage: String,
        callType: CallType
    ): String {
        val currentUser = auth.currentUser ?: throw Exception("No user logged in")

        // ✅ Guard: receiverId must not be blank
        require(receiverId.isNotBlank()) { "receiverId must not be blank" }

        val callId = "${currentUser.uid}_${receiverId}_${System.currentTimeMillis()}"

        val callData = hashMapOf(
            "callId" to callId,
            "callerId" to currentUser.uid,
            "callerName" to (currentUser.displayName ?: "User"),
            "callerImage" to (currentUser.photoUrl?.toString() ?: ""),
            "receiverId" to receiverId,
            "receiverName" to receiverName,
            "receiverImage" to receiverImage,
            "callType" to callType.name,
            "callStatus" to CallStatus.RINGING.name,
            "timestamp" to System.currentTimeMillis(),
            "isGroupCall" to false
        )

        try {
            firestore.collection("calls").document(callId).set(callData).await()
            Log.d(TAG, "✅ Call initiated: $callId")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initiate call: ${e.message}")
            throw e
        }

        return callId
    }

    suspend fun acceptCall(callId: String) {
        require(callId.isNotBlank()) { "callId must not be blank" }
        try {
            firestore.collection("calls").document(callId)
                .update("callStatus", CallStatus.ACCEPTED.name).await()
            Log.d(TAG, "✅ Call accepted: $callId")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to accept call: ${e.message}")
            throw e
        }
    }

    suspend fun rejectCall(callId: String) {
        require(callId.isNotBlank()) { "callId must not be blank" }
        try {
            firestore.collection("calls").document(callId)
                .update("callStatus", CallStatus.REJECTED.name).await()
            Log.d(TAG, "✅ Call rejected: $callId")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to reject call: ${e.message}")
            throw e
        }
    }

    suspend fun endCall(callId: String) {
        require(callId.isNotBlank()) { "callId must not be blank" }
        try {
            firestore.collection("calls").document(callId)
                .update("callStatus", CallStatus.ENDED.name).await()
            Log.d(TAG, "✅ Call ended: $callId")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to end call: ${e.message}")
            throw e
        }
    }

    // ─────────────────────────────────────────────
    // SDP EXCHANGE
    // ─────────────────────────────────────────────

    suspend fun sendOffer(callId: String, offer: SessionDescription) {
        require(callId.isNotBlank()) { "callId must not be blank" }
        try {
            firestore.collection("calls").document(callId).update(
                mapOf(
                    "offer" to offer.description,
                    "offerType" to offer.type.canonicalForm()  // ✅ Save type too
                )
            ).await()
            Log.d(TAG, "✅ Offer sent: $callId")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send offer: ${e.message}")
            throw e
        }
    }

    suspend fun sendAnswer(callId: String, answer: SessionDescription) {
        require(callId.isNotBlank()) { "callId must not be blank" }
        try {
            firestore.collection("calls").document(callId).update(
                mapOf(
                    "answer" to answer.description,
                    "answerType" to answer.type.canonicalForm()  // ✅ Save type too
                )
            ).await()
            Log.d(TAG, "✅ Answer sent: $callId")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to send answer: ${e.message}")
            throw e
        }
    }

    // ─────────────────────────────────────────────
    // ICE CANDIDATES
    // ─────────────────────────────────────────────

    suspend fun addIceCandidate(callId: String, candidate: WebRtcIceCandidate) {
        require(callId.isNotBlank()) { "callId must not be blank" }
        val currentUserId = auth.currentUser?.uid ?: return

        val candidateData = hashMapOf(
            "sdp" to candidate.sdp,
            "sdpMid" to (candidate.sdpMid ?: ""),
            "sdpMLineIndex" to candidate.sdpMLineIndex,
            "userId" to currentUserId,
            "timestamp" to System.currentTimeMillis()
        )

        try {
            firestore.collection("calls")
                .document(callId)
                .collection("iceCandidates")
                .add(candidateData)
                .await()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to add ICE candidate: ${e.message}")
            throw e
        }
    }

    // ─────────────────────────────────────────────
    // LISTENERS
    // ─────────────────────────────────────────────

    fun listenForCallUpdates(callId: String, onCallUpdate: (Call) -> Unit) {
        require(callId.isNotBlank()) { "callId must not be blank" }
        callListener?.remove()

        callListener = firestore.collection("calls")
            .document(callId)
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.e(TAG, "Error listening call updates", error)
                    return@addSnapshotListener
                }

                if (snapshot != null && snapshot.exists()) {
                    val call = Call(
                        callId = snapshot.getString("callId") ?: "",
                        callerId = snapshot.getString("callerId") ?: "",
                        callerName = snapshot.getString("callerName") ?: "",
                        callerImage = snapshot.getString("callerImage") ?: "",
                        receiverId = snapshot.getString("receiverId") ?: "",
                        receiverName = snapshot.getString("receiverName") ?: "",
                        receiverImage = snapshot.getString("receiverImage") ?: "",

                        // ✅ Safe enum parsing — won't crash on unknown values
                        callType = try {
                            CallType.valueOf(snapshot.getString("callType") ?: "VOICE")
                        } catch (e: Exception) {
                            Log.e(TAG, "Unknown callType, defaulting to VOICE")
                            CallType.VOICE
                        },
                        callStatus = try {
                            CallStatus.valueOf(snapshot.getString("callStatus") ?: "RINGING")
                        } catch (e: Exception) {
                            Log.e(TAG, "Unknown callStatus, defaulting to RINGING")
                            CallStatus.RINGING
                        },

                        offer = snapshot.getString("offer"),
                        offerType = snapshot.getString("offerType"),   // ✅ Added
                        answer = snapshot.getString("answer"),
                        answerType = snapshot.getString("answerType"), // ✅ Added
                        timestamp = snapshot.getLong("timestamp") ?: 0L,
                        isGroupCall = snapshot.getBoolean("isGroupCall") ?: false,
                        groupId = snapshot.getString("groupId"),
                        groupName = snapshot.getString("groupName"),
                        participants = (snapshot.get("participants") as? List<String>) ?: emptyList()
                    )
                    onCallUpdate(call)
                }
            }
    }

    fun listenForIceCandidates(callId: String, onCandidate: (ModelIceCandidate) -> Unit) {
        require(callId.isNotBlank()) { "callId must not be blank" }
        val currentUid = auth.currentUser?.uid
        iceListener?.remove()

        iceListener = firestore.collection("calls")
            .document(callId)
            .collection("iceCandidates")
            .addSnapshotListener { snapshot, error ->
                if (error != null) {
                    Log.e(TAG, "Error listening ICE", error)
                    return@addSnapshotListener
                }

                snapshot?.documentChanges?.forEach { change ->
                    if (change.type == DocumentChange.Type.ADDED) {
                        val doc = change.document
                        val senderUid = doc.getString("userId") ?: ""

                        // ✅ Ignore own ICE candidates
                        if (senderUid == currentUid) return@forEach

                        val candidate = ModelIceCandidate(
                            sdp = doc.getString("sdp") ?: "",
                            sdpMid = doc.getString("sdpMid") ?: "",
                            sdpMLineIndex = doc.getLong("sdpMLineIndex")?.toInt() ?: 0,
                            userId = senderUid
                        )
                        onCandidate(candidate)
                    }
                }
            }
    }

    fun stopListening() {
        callListener?.remove()
        callListener = null
        iceListener?.remove()
        iceListener = null
        Log.d(TAG, "✅ Listeners stopped")
    }
}