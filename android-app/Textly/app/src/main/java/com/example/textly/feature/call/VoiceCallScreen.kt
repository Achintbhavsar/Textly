package com.example.textly.feature.call

import android.Manifest
import android.content.Context
import android.media.AudioManager
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import coil.compose.AsyncImage
import com.example.textly.model.Call
import com.example.textly.model.CallStatus
import com.example.textly.webrtc.CallManager
import com.example.textly.webrtc.WebRTCManager
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.rememberMultiplePermissionsState
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import org.webrtc.IceCandidate
import org.webrtc.SessionDescription

@OptIn(ExperimentalPermissionsApi::class)
@Composable
fun VoiceCallScreen(
    navController: NavController,
    callId: String,
    isCaller: Boolean
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var isMuted by remember { mutableStateOf(false) }
    var isSpeakerOn by remember { mutableStateOf(false) }
    var callDuration by remember { mutableStateOf(0) }
    var isConnected by remember { mutableStateOf(false) }
    var isCallActive by remember { mutableStateOf(true) }
    var callAlreadyEnded by remember { mutableStateOf(false) }
    var callStatus by remember { mutableStateOf(CallStatus.RINGING) }
    var otherUserName by remember { mutableStateOf("User") }
    var otherUserImage by remember { mutableStateOf("") }
    var offerSent by remember { mutableStateOf(false) }
    var offerProcessed by remember { mutableStateOf(false) }
    var webRtcInitialized by remember { mutableStateOf(false) }

    val webRTCManager = remember { WebRTCManager(context) }
    val audioManager = remember {
        context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }
    val currentUserId = remember { FirebaseAuth.getInstance().currentUser?.uid ?: "" }

    // ✅ FIX: Store the latest Firestore snapshot so we can re-process the offer
    // after WebRTC finishes initializing (same race condition fix as VideoCallScreen)
    val lastCallSnapshot = remember { mutableStateOf<Call?>(null) }

    val permissionsState = rememberMultiplePermissionsState(
        permissions = listOf(Manifest.permission.RECORD_AUDIO)
    )

    // Step 1: Request permissions
    LaunchedEffect(Unit) {
        permissionsState.launchMultiplePermissionRequest()
    }

    // ─────────────────────────────────────────────
    // Step 2: Init WebRTC + CALLER sends offer
    // ─────────────────────────────────────────────
    LaunchedEffect(permissionsState.allPermissionsGranted) {
        if (!permissionsState.allPermissionsGranted) return@LaunchedEffect
        if (webRtcInitialized) return@LaunchedEffect
        webRtcInitialized = true

        android.util.Log.d("VoiceCall", "🚀 Init WebRTC — isCaller: $isCaller")

        webRTCManager.createPeerConnection(
            onIceCandidate = { candidate ->
                scope.launch { CallManager.addIceCandidate(callId, candidate) }
            }
        )

        webRTCManager.startLocalAudioCapture()

        if (isCaller && !offerSent) {
            offerSent = true
            android.util.Log.d("VoiceCall", "📤 Creating offer...")
            webRTCManager.createOffer(
                onSuccess = { offer ->
                    scope.launch {
                        CallManager.sendOffer(callId, offer)
                        android.util.Log.d("VoiceCall", "✅ Offer saved to Firestore")
                    }
                },
                onError = { error ->
                    android.util.Log.e("VoiceCall", "❌ Offer error: $error")
                }
            )
        }
    }

    // ─────────────────────────────────────────────
    // Step 2b: Re-process offer if it arrived before WebRTC was initialized
    // ✅ FIX: Same pattern as VideoCallScreen — saves offer and re-checks after init
    // ─────────────────────────────────────────────
    LaunchedEffect(webRtcInitialized) {
        if (!webRtcInitialized) return@LaunchedEffect
        if (isCaller || offerProcessed) return@LaunchedEffect
        val call = lastCallSnapshot.value ?: return@LaunchedEffect
        if (call.offer == null || call.offerType == null) return@LaunchedEffect

        offerProcessed = true
        android.util.Log.d("VoiceCall", "📥 Receiver: late offer processing after WebRTC init")
        val sdp = SessionDescription(
            SessionDescription.Type.fromCanonicalForm(call.offerType),
            call.offer
        )
        webRTCManager.setRemoteDescription(sdp) {
            webRTCManager.createAnswer(
                onSuccess = { answer ->
                    scope.launch {
                        CallManager.sendAnswer(callId, answer)
                        CallManager.acceptCall(callId)
                        android.util.Log.d("VoiceCall", "✅ Answer sent (late path)")
                    }
                },
                onError = { android.util.Log.e("VoiceCall", "❌ Answer error: $it") }
            )
        }
    }

    // Step 3: Listen for remote ICE candidates
    LaunchedEffect(callId) {
        CallManager.listenForIceCandidates(callId) { candidate ->
            webRTCManager.addIceCandidate(
                IceCandidate(candidate.sdpMid, candidate.sdpMLineIndex, candidate.sdp)
            )
        }
    }

    // ─────────────────────────────────────────────
    // Step 4: SDP exchange + call status
    // ─────────────────────────────────────────────
    LaunchedEffect(callId) {
        CallManager.listenForCallUpdates(callId) { call ->
            // ✅ FIX: Always save latest snapshot for the late-processing LaunchedEffect
            lastCallSnapshot.value = call

            if (call.callerId == currentUserId) {
                otherUserName = call.receiverName
                otherUserImage = call.receiverImage
            } else {
                otherUserName = call.callerName
                otherUserImage = call.callerImage
            }

            callStatus = call.callStatus

            when (call.callStatus) {

                CallStatus.ACCEPTED -> {
                    isConnected = true
                    if (isCaller && call.answer != null && call.answerType != null) {
                        android.util.Log.d("VoiceCall", "📥 Caller: setting remote answer")
                        val sdp = SessionDescription(
                            SessionDescription.Type.fromCanonicalForm(call.answerType),
                            call.answer
                        )
                        webRTCManager.setRemoteDescription(sdp)
                    }
                }

                CallStatus.RINGING -> {
                    // ✅ FIX: Only process if WebRTC is already initialized.
                    // If not ready yet, LaunchedEffect(webRtcInitialized) handles it.
                    if (!isCaller && !offerProcessed &&
                        call.offer != null && call.offerType != null &&
                        webRtcInitialized
                    ) {
                        offerProcessed = true
                        android.util.Log.d("VoiceCall", "📥 Receiver: offer arrived, creating answer")
                        val sdp = SessionDescription(
                            SessionDescription.Type.fromCanonicalForm(call.offerType),
                            call.offer
                        )
                        webRTCManager.setRemoteDescription(sdp) {
                            webRTCManager.createAnswer(
                                onSuccess = { answer ->
                                    scope.launch {
                                        CallManager.sendAnswer(callId, answer)
                                        CallManager.acceptCall(callId)
                                        android.util.Log.d("VoiceCall", "✅ Answer sent")
                                    }
                                },
                                onError = { error ->
                                    android.util.Log.e("VoiceCall", "❌ Answer error: $error")
                                }
                            )
                        }
                    }
                }

                CallStatus.REJECTED, CallStatus.ENDED -> {
                    if (!callAlreadyEnded) {
                        callAlreadyEnded = true
                        webRTCManager.cleanup()
                        CallManager.stopListening()
                        navController.popBackStack()
                    }
                }

                else -> {}
            }
        }
    }

    // Step 5: Timer
    LaunchedEffect(isConnected) {
        if (isConnected) {
            while (isCallActive) {
                delay(1000)
                callDuration++
            }
        }
    }

    // Step 6: Cleanup
    // ✅ FIX: Use release() instead of cleanup() so EglBase is properly cleaned up
    DisposableEffect(Unit) {
        onDispose {
            isCallActive = false
            webRTCManager.release()
            CallManager.stopListening()
            if (!callAlreadyEnded) {
                scope.launch { CallManager.endCall(callId) }
            }
        }
    }

    // UI
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.primaryContainer)
    ) {
        Column(
            modifier = Modifier.fillMaxSize().padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.padding(top = 64.dp)
            ) {
                Box(
                    modifier = Modifier
                        .size(120.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.surface),
                    contentAlignment = Alignment.Center
                ) {
                    if (otherUserImage.isNotEmpty()) {
                        AsyncImage(
                            model = otherUserImage,
                            contentDescription = "Avatar",
                            modifier = Modifier.size(120.dp).clip(CircleShape)
                        )
                    } else {
                        Text(
                            text = otherUserName.firstOrNull()?.uppercase() ?: "U",
                            fontSize = 48.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                Text(
                    text = otherUserName,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = when {
                        isConnected -> String.format("%02d:%02d", callDuration / 60, callDuration % 60)
                        callStatus == CallStatus.RINGING -> "Ringing..."
                        callStatus == CallStatus.ACCEPTED -> "Connecting..."
                        else -> "Call ended"
                    },
                    fontSize = 16.sp,
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.7f)
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                FloatingActionButton(
                    onClick = { isMuted = !isMuted; webRTCManager.toggleMicrophone(!isMuted) },
                    containerColor = if (isMuted) MaterialTheme.colorScheme.error
                    else MaterialTheme.colorScheme.surface
                ) {
                    Icon(
                        imageVector = if (isMuted) Icons.Default.MicOff else Icons.Default.Mic,
                        contentDescription = "Mute",
                        tint = if (isMuted) MaterialTheme.colorScheme.onError
                        else MaterialTheme.colorScheme.onSurface
                    )
                }

                FloatingActionButton(
                    onClick = {
                        callAlreadyEnded = true
                        scope.launch { CallManager.endCall(callId); navController.popBackStack() }
                    },
                    containerColor = MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(72.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.CallEnd,
                        contentDescription = "End Call",
                        tint = MaterialTheme.colorScheme.onError,
                        modifier = Modifier.size(32.dp)
                    )
                }

                FloatingActionButton(
                    onClick = { isSpeakerOn = !isSpeakerOn; audioManager.isSpeakerphoneOn = isSpeakerOn },
                    containerColor = if (isSpeakerOn) MaterialTheme.colorScheme.primary
                    else MaterialTheme.colorScheme.surface
                ) {
                    Icon(
                        imageVector = Icons.Default.VolumeUp,
                        contentDescription = "Speaker",
                        tint = if (isSpeakerOn) MaterialTheme.colorScheme.onPrimary
                        else MaterialTheme.colorScheme.onSurface
                    )
                }
            }
        }
    }
}