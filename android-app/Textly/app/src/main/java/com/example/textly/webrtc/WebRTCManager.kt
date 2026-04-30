package com.example.textly.webrtc

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import org.webrtc.*

class WebRTCManager(private val context: Context) {

    companion object {
        private const val TAG = "WebRTCManager"

        private val ICE_SERVERS = listOf(
            PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer(),
            PeerConnection.IceServer.builder("stun:stun1.l.google.com:19302").createIceServer(),
            PeerConnection.IceServer.builder("stun:stun2.l.google.com:19302").createIceServer(),
            PeerConnection.IceServer.builder("turn:openrelay.metered.ca:80")
                .setUsername("openrelayproject")
                .setPassword("openrelayproject")
                .createIceServer(),
            PeerConnection.IceServer.builder("turn:openrelay.metered.ca:443")
                .setUsername("openrelayproject")
                .setPassword("openrelayproject")
                .createIceServer(),
            PeerConnection.IceServer.builder("turn:openrelay.metered.ca:443?transport=tcp")
                .setUsername("openrelayproject")
                .setPassword("openrelayproject")
                .createIceServer()
        )
    }

    // ✅ FIX: EglBase created once, never released until release() is explicitly called
    // Releasing it in cleanup() caused dead EGL context on next call → black screen
    private val eglBase: EglBase = EglBase.create()
    val eglBaseContext: EglBase.Context get() = eglBase.eglBaseContext

    private var peerConnectionFactory: PeerConnectionFactory? = null
    private var peerConnection: PeerConnection? = null
    private var localAudioTrack: AudioTrack? = null
    private var localVideoTrack: VideoTrack? = null
    private var localVideoSource: VideoSource? = null
    private var videoCapturer: VideoCapturer? = null
    private var surfaceTextureHelper: SurfaceTextureHelper? = null

    var onIceCandidateListener: ((IceCandidate) -> Unit)? = null
    var onRemoteVideoTrackListener: ((VideoTrack) -> Unit)? = null
    var onConnectionStateChanged: ((PeerConnection.IceConnectionState?) -> Unit)? = null

    // ✅ FIX: All callbacks posted to main thread — WebRTC fires on internal threads,
    // writing Compose state from those threads causes race conditions / silent failures
    private val mainHandler = Handler(Looper.getMainLooper())

    init {
        initializePeerConnectionFactory()
    }

    private fun initializePeerConnectionFactory() {
        val options = PeerConnectionFactory.InitializationOptions.builder(context)
            .setEnableInternalTracer(true)
            .createInitializationOptions()

        PeerConnectionFactory.initialize(options)

        val encoderFactory = DefaultVideoEncoderFactory(eglBase.eglBaseContext, true, true)
        val decoderFactory = DefaultVideoDecoderFactory(eglBase.eglBaseContext)

        peerConnectionFactory = PeerConnectionFactory.builder()
            .setVideoEncoderFactory(encoderFactory)
            .setVideoDecoderFactory(decoderFactory)
            .setOptions(PeerConnectionFactory.Options())
            .createPeerConnectionFactory()

        Log.d(TAG, "✅ PeerConnectionFactory created")
    }

    fun createPeerConnection(
        onIceCandidate: (IceCandidate) -> Unit,
        onRemoteVideoTrack: (VideoTrack) -> Unit = {}
    ) {
        onIceCandidateListener = onIceCandidate
        onRemoteVideoTrackListener = onRemoteVideoTrack

        val rtcConfig = PeerConnection.RTCConfiguration(ICE_SERVERS).apply {
            bundlePolicy = PeerConnection.BundlePolicy.MAXBUNDLE
            rtcpMuxPolicy = PeerConnection.RtcpMuxPolicy.REQUIRE
            tcpCandidatePolicy = PeerConnection.TcpCandidatePolicy.ENABLED
            sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN
            continualGatheringPolicy = PeerConnection.ContinualGatheringPolicy.GATHER_CONTINUALLY
        }

        val observer = object : PeerConnection.Observer {
            override fun onIceCandidate(candidate: IceCandidate?) {
                candidate?.let {
                    Log.d(TAG, "🧊 ICE candidate: ${it.sdpMid} ${it.sdp}")
                    mainHandler.post { onIceCandidateListener?.invoke(it) }
                }
            }

            override fun onIceCandidatesRemoved(candidates: Array<out IceCandidate>?) {}

            override fun onTrack(transceiver: RtpTransceiver?) {
                val track = transceiver?.receiver?.track()
                Log.d(TAG, "📹 onTrack called — kind: ${track?.kind()} enabled: ${track?.enabled()}")
                if (track is VideoTrack) {
                    Log.d(TAG, "✅ Remote VideoTrack received — invoking listener")
                    track.setEnabled(true)
                    // ✅ Main thread so Compose state (pendingRemoteTrack) updates safely
                    mainHandler.post { onRemoteVideoTrackListener?.invoke(track) }
                } else if (track is AudioTrack) {
                    Log.d(TAG, "🔊 Remote AudioTrack received")
                    track.setEnabled(true)
                }
            }

            override fun onSignalingChange(state: PeerConnection.SignalingState?) {
                Log.d(TAG, "📡 Signaling state: $state")
            }

            override fun onIceConnectionChange(state: PeerConnection.IceConnectionState?) {
                Log.d(TAG, "🧊 ICE connection state: $state")
                mainHandler.post { onConnectionStateChanged?.invoke(state) }
                when (state) {
                    PeerConnection.IceConnectionState.CONNECTED ->
                        Log.d(TAG, "✅ ICE CONNECTED — peers should see each other")
                    PeerConnection.IceConnectionState.FAILED ->
                        Log.e(TAG, "❌ ICE FAILED — check STUN/TURN servers")
                    PeerConnection.IceConnectionState.DISCONNECTED ->
                        Log.w(TAG, "⚠️ ICE DISCONNECTED")
                    else -> {}
                }
            }

            override fun onConnectionChange(newState: PeerConnection.PeerConnectionState?) {
                Log.d(TAG, "🔗 PeerConnection state: $newState")
            }

            override fun onIceConnectionReceivingChange(receiving: Boolean) {
                Log.d(TAG, "🧊 ICE receiving: $receiving")
            }

            override fun onIceGatheringChange(state: PeerConnection.IceGatheringState?) {
                Log.d(TAG, "🧊 ICE gathering: $state")
            }

            override fun onAddStream(stream: MediaStream?) {
                Log.d(TAG, "📺 onAddStream: ${stream?.videoTracks?.size} video tracks")
            }

            override fun onRemoveStream(stream: MediaStream?) {}
            override fun onDataChannel(channel: DataChannel?) {}
            override fun onRenegotiationNeeded() {
                Log.d(TAG, "🔄 Renegotiation needed")
            }
            override fun onAddTrack(receiver: RtpReceiver?, streams: Array<out MediaStream>?) {
                Log.d(TAG, "➕ onAddTrack: ${receiver?.track()?.kind()}")
            }
        }

        peerConnection = peerConnectionFactory?.createPeerConnection(rtcConfig, observer)
        Log.d(TAG, "✅ PeerConnection created")
    }

    fun startLocalAudioCapture() {
        val audioConstraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("echoCancellation", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("noiseSuppression", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("autoGainControl", "true"))
        }
        val audioSource = peerConnectionFactory?.createAudioSource(audioConstraints)
        localAudioTrack = peerConnectionFactory?.createAudioTrack("ARDAMSa0", audioSource)
        localAudioTrack?.setEnabled(true)
        localAudioTrack?.let { track ->
            val sender = peerConnection?.addTrack(track, listOf("ARDAMS"))
            Log.d(TAG, "✅ Audio track added — sender: $sender")
        }
    }

    // ✅ FIX: onReady callback added — offer must only be created AFTER this fires,
    // guaranteeing the video track is in the peer connection before SDP negotiation
    fun startLocalVideoCapture(surfaceView: SurfaceViewRenderer, onReady: () -> Unit = {}) {
        surfaceView.setMirror(true)

        videoCapturer = createCameraVideoCapturer() ?: run {
            Log.e(TAG, "❌ No camera capturer found")
            return
        }

        localVideoSource = peerConnectionFactory?.createVideoSource(false)
        localVideoTrack = peerConnectionFactory?.createVideoTrack("ARDAMSv0", localVideoSource)
        localVideoTrack?.setEnabled(true)

        surfaceTextureHelper = SurfaceTextureHelper.create(
            "CaptureThread", eglBase.eglBaseContext
        )

        videoCapturer?.initialize(
            surfaceTextureHelper,
            context,
            localVideoSource?.capturerObserver
        )
        videoCapturer?.startCapture(1280, 720, 30)

        localVideoTrack?.addSink(surfaceView)
        localVideoTrack?.let { track ->
            val sender = peerConnection?.addTrack(track, listOf("ARDAMS"))
            Log.d(TAG, "✅ Video track added — sender: $sender trackId: ${track.id()}")
        }

        Log.d(TAG, "✅ Local video capture started")

        // ✅ All tracks are now added — safe to create offer
        onReady()
    }

    private fun createCameraVideoCapturer(): VideoCapturer? {
        val enumerator = Camera2Enumerator(context)
        val deviceNames = enumerator.deviceNames

        Log.d(TAG, "📷 Available cameras: ${deviceNames.toList()}")

        deviceNames.firstOrNull { enumerator.isFrontFacing(it) }?.let {
            Log.d(TAG, "📷 Using front camera: $it")
            return enumerator.createCapturer(it, null)
        }
        deviceNames.firstOrNull { !enumerator.isFrontFacing(it) }?.let {
            Log.d(TAG, "📷 Using back camera: $it")
            return enumerator.createCapturer(it, null)
        }
        return null
    }

    fun createOffer(onSuccess: (SessionDescription) -> Unit, onError: (String) -> Unit = {}) {
        val senders = peerConnection?.senders
        Log.d(TAG, "📤 Creating offer — senders count: ${senders?.size}")
        senders?.forEach { sender ->
            Log.d(TAG, "  Sender track: ${sender.track()?.kind()} id: ${sender.track()?.id()}")
        }

        val constraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "true"))
        }

        peerConnection?.createOffer(object : SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription?) {
                sdp ?: return
                Log.d(TAG, "✅ Offer created — type: ${sdp.type}")
                peerConnection?.setLocalDescription(SimpleSdpObserver(TAG), sdp)
                mainHandler.post { onSuccess(sdp) }
            }
            override fun onSetSuccess() {}
            override fun onCreateFailure(error: String?) {
                Log.e(TAG, "❌ Create offer failed: $error")
                mainHandler.post { onError(error ?: "Create offer failed") }
            }
            override fun onSetFailure(error: String?) {
                Log.e(TAG, "❌ Set local offer failed: $error")
            }
        }, constraints)
    }

    fun createAnswer(onSuccess: (SessionDescription) -> Unit, onError: (String) -> Unit = {}) {
        val senders = peerConnection?.senders
        Log.d(TAG, "📤 Creating answer — senders count: ${senders?.size}")

        val constraints = MediaConstraints().apply {
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveAudio", "true"))
            mandatory.add(MediaConstraints.KeyValuePair("OfferToReceiveVideo", "true"))
        }

        peerConnection?.createAnswer(object : SdpObserver {
            override fun onCreateSuccess(sdp: SessionDescription?) {
                sdp ?: return
                Log.d(TAG, "✅ Answer created — type: ${sdp.type}")
                peerConnection?.setLocalDescription(SimpleSdpObserver(TAG), sdp)
                mainHandler.post { onSuccess(sdp) }
            }
            override fun onSetSuccess() {}
            override fun onCreateFailure(error: String?) {
                Log.e(TAG, "❌ Create answer failed: $error")
                mainHandler.post { onError(error ?: "Create answer failed") }
            }
            override fun onSetFailure(error: String?) {
                Log.e(TAG, "❌ Set local answer failed: $error")
            }
        }, constraints)
    }

    // ✅ FIX: onSet always posted to main thread — previously called on WebRTC internal
    // thread which caused silent failures when writing Compose state
    fun setRemoteDescription(sdp: SessionDescription, onSet: (() -> Unit)? = null) {
        Log.d(TAG, "📥 Setting remote description — type: ${sdp.type}")
        peerConnection?.setRemoteDescription(object : SdpObserver {
            override fun onCreateSuccess(p0: SessionDescription?) {}
            override fun onSetSuccess() {
                Log.d(TAG, "✅ Remote description set successfully")
                mainHandler.post { onSet?.invoke() }
            }
            override fun onCreateFailure(p0: String?) {}
            override fun onSetFailure(error: String?) {
                Log.e(TAG, "❌ Set remote description failed: $error")
            }
        }, sdp)
    }

    fun addIceCandidate(candidate: IceCandidate) {
        Log.d(TAG, "🧊 Adding ICE candidate: ${candidate.sdpMid}")
        val result = peerConnection?.addIceCandidate(candidate)
        Log.d(TAG, "🧊 ICE candidate added: $result")
    }

    fun switchCamera() {
        (videoCapturer as? CameraVideoCapturer)?.switchCamera(null)
    }

    fun toggleMicrophone(enabled: Boolean) {
        localAudioTrack?.setEnabled(enabled)
    }

    fun toggleCamera(enabled: Boolean) {
        localVideoTrack?.setEnabled(enabled)
    }

    // ✅ FIX: cleanup() no longer calls eglBase.release()
    // EglBase must stay alive as long as any SurfaceViewRenderer is alive
    // Call release() from DisposableEffect AFTER renderers are released
    fun cleanup() {
        try {
            videoCapturer?.stopCapture()
        } catch (e: InterruptedException) {
            Log.e(TAG, "Error stopping capture: ${e.message}")
        }
        videoCapturer?.dispose()
        videoCapturer = null
        surfaceTextureHelper?.dispose()
        surfaceTextureHelper = null
        localAudioTrack?.dispose()
        localAudioTrack = null
        localVideoTrack?.dispose()
        localVideoTrack = null
        localVideoSource?.dispose()
        localVideoSource = null
        peerConnection?.close()
        peerConnection?.dispose()
        peerConnection = null
        peerConnectionFactory?.dispose()
        peerConnectionFactory = null
    }

    // ✅ Call this ONLY from DisposableEffect onDispose, AFTER releasing SurfaceViewRenderers
    fun release() {
        cleanup()
        eglBase.release()
    }

    private class SimpleSdpObserver(private val tag: String) : SdpObserver {
        override fun onCreateSuccess(p0: SessionDescription?) {}
        override fun onSetSuccess() { Log.d(tag, "✅ SDP set successfully") }
        override fun onCreateFailure(error: String?) { Log.e(tag, "❌ SDP create failed: $error") }
        override fun onSetFailure(error: String?) { Log.e(tag, "❌ SDP set failed: $error") }
    }
}