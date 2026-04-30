package com.example.textly.feature.call

import android.Manifest
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.navigation.NavController
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
import org.webrtc.RendererCommon
import org.webrtc.SessionDescription
import org.webrtc.SurfaceViewRenderer
import org.webrtc.VideoTrack

@OptIn(ExperimentalPermissionsApi::class)
@Composable
fun VideoCallScreen(
    navController: NavController,
    callId: String,
    isCaller: Boolean,
    otherUserId: String,
    otherUserName: String,
    otherUserImage: String
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var isMuted by remember { mutableStateOf(false) }
    var isCameraOff by remember { mutableStateOf(false) }
    var callDuration by remember { mutableStateOf(0) }
    var isConnected by remember { mutableStateOf(false) }
    var isCallActive by remember { mutableStateOf(true) }
    var callAlreadyEnded by remember { mutableStateOf(false) }
    var callStatus by remember { mutableStateOf(CallStatus.RINGING) }
    var offerSent by remember { mutableStateOf(false) }
    var offerProcessed by remember { mutableStateOf(false) }
    val webRtcInitialized = remember { mutableStateOf(false) }

    val webRTCManager = remember { WebRTCManager(context) }
    val localRenderer = remember { mutableStateOf<SurfaceViewRenderer?>(null) }
    val remoteRenderer = remember { mutableStateOf<SurfaceViewRenderer?>(null) }
    val pendingRemoteTrack = remember { mutableStateOf<VideoTrack?>(null) }

    // ✅ FIX: Store the latest Firestore snapshot so we can re-process the offer
    // after WebRTC finishes initializing (handles the race where offer arrives first)
    val lastCallSnapshot = remember { mutableStateOf<Call?>(null) }

    val currentUserId = remember { FirebaseAuth.getInstance().currentUser?.uid ?: "" }

    val permissionsState = rememberMultiplePermissionsState(
        permissions = listOf(
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO
        )
    )

    // ✅ FIX: Watch BOTH remoteRenderer and pendingRemoteTrack as keys
    // Previously only watched remoteRenderer — if track arrived after renderer,
    // this LaunchedEffect never re-fired and the remote video stayed black
    LaunchedEffect(remoteRenderer.value, pendingRemoteTrack.value) {
        val renderer = remoteRenderer.value ?: return@LaunchedEffect
        val track = pendingRemoteTrack.value ?: return@LaunchedEffect
        track.addSink(renderer)
        android.util.Log.d("VideoCall", "✅ Remote track attached to renderer")
    }

    // Step 1: Request permissions
    LaunchedEffect(Unit) {
        permissionsState.launchMultiplePermissionRequest()
    }

    // ─────────────────────────────────────────────
    // Step 2: Init WebRTC — gate on BOTH renderers + permissions
    // ✅ FIX: Previously gated only on localRenderer — if remoteRenderer wasn't
    // ready, eglBaseContext could be used on a dead surface → black screen.
    // Now we wait for both renderers before initializing.
    // ─────────────────────────────────────────────
    LaunchedEffect(
        permissionsState.allPermissionsGranted,
        localRenderer.value,
        remoteRenderer.value
    ) {
        if (!permissionsState.allPermissionsGranted) return@LaunchedEffect
        if (localRenderer.value == null || remoteRenderer.value == null) return@LaunchedEffect
        if (webRtcInitialized.value) return@LaunchedEffect
        webRtcInitialized.value = true

        android.util.Log.d("VideoCall", "🚀 Init WebRTC — isCaller: $isCaller")

        webRTCManager.createPeerConnection(
            onIceCandidate = { candidate ->
                scope.launch { CallManager.addIceCandidate(callId, candidate) }
            },
            onRemoteVideoTrack = { track ->
                android.util.Log.d("VideoCall", "📹 Remote video track received!")
                // ✅ Setting pendingRemoteTrack triggers the LaunchedEffect above
                pendingRemoteTrack.value = track
            }
        )

        webRTCManager.startLocalAudioCapture()

        // ✅ FIX: Offer is created INSIDE the onReady callback — this guarantees
        // the video track is in the PeerConnection before createOffer() is called.
        // The old delay(500) was unreliable and caused missing video in the SDP.
        localRenderer.value?.let { renderer ->
            webRTCManager.startLocalVideoCapture(renderer) {
                if (isCaller && !offerSent) {
                    offerSent = true
                    android.util.Log.d("VideoCall", "📤 Creating offer...")
                    webRTCManager.createOffer(
                        onSuccess = { offer ->
                            scope.launch {
                                CallManager.sendOffer(callId, offer)
                                android.util.Log.d("VideoCall", "✅ Offer saved to Firestore")
                            }
                        },
                        onError = { error ->
                            android.util.Log.e("VideoCall", "❌ Offer error: $error")
                        }
                    )
                }
            }
        }
    }

    // ─────────────────────────────────────────────
    // Step 2b: Re-process offer if it arrived before WebRTC was initialized
    // ✅ FIX: Firestore offer can arrive before createPeerConnection() is called.
    // We save every snapshot and re-check here once WebRTC is ready.
    // ─────────────────────────────────────────────
    LaunchedEffect(webRtcInitialized.value) {
        if (!webRtcInitialized.value) return@LaunchedEffect
        if (isCaller || offerProcessed) return@LaunchedEffect
        val call = lastCallSnapshot.value ?: return@LaunchedEffect
        if (call.offer == null || call.offerType == null) return@LaunchedEffect

        offerProcessed = true
        android.util.Log.d("VideoCall", "📥 Receiver: late offer processing after WebRTC init")
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
                        android.util.Log.d("VideoCall", "✅ Answer sent (late path)")
                    }
                },
                onError = { android.util.Log.e("VideoCall", "❌ Answer error: $it") }
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
            callStatus = call.callStatus

            when (call.callStatus) {

                CallStatus.ACCEPTED -> {
                    isConnected = true
                    if (isCaller && call.answer != null && call.answerType != null) {
                        android.util.Log.d("VideoCall", "📥 Caller: setting remote answer")
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
                        webRtcInitialized.value
                    ) {
                        offerProcessed = true
                        android.util.Log.d("VideoCall", "📥 Receiver: offer arrived, creating answer")
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
                                        android.util.Log.d("VideoCall", "✅ Answer sent")
                                    }
                                },
                                onError = { error ->
                                    android.util.Log.e("VideoCall", "❌ Answer error: $error")
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
    // ✅ FIX: Release renderers BEFORE calling webRTCManager.release()
    // EglBase must outlive all SurfaceViewRenderers — previously eglBase.release()
    // was called inside cleanup() which killed the EGL context for subsequent calls
    DisposableEffect(Unit) {
        onDispose {
            isCallActive = false
            pendingRemoteTrack.value?.removeSink(remoteRenderer.value)
            localRenderer.value?.release()   // ✅ renderers first
            remoteRenderer.value?.release()
            webRTCManager.release()          // ✅ EGL released last via release()
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
            .background(MaterialTheme.colorScheme.background)
    ) {
        // Remote video full screen
        AndroidView(
            factory = { ctx ->
                SurfaceViewRenderer(ctx).apply {
                    init(webRTCManager.eglBaseContext, null)
                    setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FILL)
                    setMirror(false)
                    remoteRenderer.value = this
                    // ✅ Do NOT call addSink here — pendingRemoteTrack is always null
                    // at factory time. LaunchedEffect handles attachment safely.
                }
            },
            modifier = Modifier.fillMaxSize()
        )

        // Local video preview
        Card(
            modifier = Modifier
                .padding(16.dp)
                .size(120.dp, 160.dp)
                .align(Alignment.TopEnd),
            shape = RoundedCornerShape(12.dp)
        ) {
            AndroidView(
                factory = { ctx ->
                    SurfaceViewRenderer(ctx).apply {
                        init(webRTCManager.eglBaseContext, null)
                        setScalingType(RendererCommon.ScalingType.SCALE_ASPECT_FILL)
                        setMirror(true)
                        localRenderer.value = this
                    }
                },
                modifier = Modifier.fillMaxSize()
            )
        }

        // Top info bar
        Card(
            modifier = Modifier.align(Alignment.TopStart).padding(16.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.8f)
            )
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = otherUserName,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = when {
                        isConnected -> String.format("%02d:%02d", callDuration / 60, callDuration % 60)
                        callStatus == CallStatus.RINGING -> "Ringing..."
                        callStatus == CallStatus.ACCEPTED -> "Connecting..."
                        else -> "Call ended"
                    },
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }

        // Bottom controls
        Card(
            modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth().padding(16.dp),
            colors = CardDefaults.cardColors(
                containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.9f)
            )
        ) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                FloatingActionButton(
                    onClick = { isMuted = !isMuted; webRTCManager.toggleMicrophone(!isMuted) },
                    containerColor = if (isMuted) MaterialTheme.colorScheme.error
                    else MaterialTheme.colorScheme.primaryContainer
                ) {
                    Icon(
                        imageVector = if (isMuted) Icons.Default.MicOff else Icons.Default.Mic,
                        contentDescription = "Mute",
                        tint = if (isMuted) MaterialTheme.colorScheme.onError
                        else MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }

                FloatingActionButton(
                    onClick = { isCameraOff = !isCameraOff; webRTCManager.toggleCamera(!isCameraOff) },
                    containerColor = if (isCameraOff) MaterialTheme.colorScheme.error
                    else MaterialTheme.colorScheme.primaryContainer
                ) {
                    Icon(
                        imageVector = if (isCameraOff) Icons.Default.VideocamOff else Icons.Default.Videocam,
                        contentDescription = "Camera",
                        tint = if (isCameraOff) MaterialTheme.colorScheme.onError
                        else MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }

                FloatingActionButton(
                    onClick = {
                        callAlreadyEnded = true
                        scope.launch { CallManager.endCall(callId); navController.popBackStack() }
                    },
                    containerColor = MaterialTheme.colorScheme.error,
                    modifier = Modifier.size(64.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.CallEnd,
                        contentDescription = "End Call",
                        tint = MaterialTheme.colorScheme.onError,
                        modifier = Modifier.size(28.dp)
                    )
                }

                FloatingActionButton(
                    onClick = { webRTCManager.switchCamera() },
                    containerColor = MaterialTheme.colorScheme.primaryContainer
                ) {
                    Icon(
                        imageVector = Icons.Default.Cameraswitch,
                        contentDescription = "Switch Camera",
                        tint = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }
        }
    }
}