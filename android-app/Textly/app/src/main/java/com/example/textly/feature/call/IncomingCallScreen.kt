package com.example.textly.feature.call

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import coil.compose.AsyncImage
import com.example.textly.model.CallStatus
import com.example.textly.model.CallType
import com.example.textly.webrtc.CallManager
import kotlinx.coroutines.launch

@Composable
fun IncomingCallScreen(
    navController: NavController,
    callId: String,
    callerName: String,
    callerImage: String,
    callType: String
) {
    val scope = rememberCoroutineScope()

    val callTypeEnum = try {
        CallType.valueOf(callType)
    } catch (e: Exception) {
        CallType.VOICE
    }

    // Auto-dismiss if caller cancels / call is ended remotely
    LaunchedEffect(callId) {
        CallManager.listenForCallUpdates(callId) { call ->
            when (call.callStatus) {
                CallStatus.ENDED, CallStatus.REJECTED -> {
                    CallManager.stopListening()
                    navController.popBackStack()
                }
                else -> {}
            }
        }
    }

    // ✅ FIX: Removed CallManager.stopListening() from DisposableEffect.
    // When the user taps Accept and navigates to VideoCallScreen/VoiceCallScreen,
    // this DisposableEffect fires BEFORE the next screen sets up its own listener.
    // Stopping here caused a gap where Firestore updates (offer, ICE) were missed.
    // stopListening() is only called on the Decline path now.
    DisposableEffect(Unit) {
        onDispose {
            // intentionally empty — let the call screen manage the listener
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.primaryContainer)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Spacer(modifier = Modifier.height(64.dp))

            // Caller info
            Column(
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier
                        .size(140.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.surface),
                    contentAlignment = Alignment.Center
                ) {
                    if (callerImage.isNotEmpty() && callerImage != "none") {
                        AsyncImage(
                            model = callerImage,
                            contentDescription = "Caller Avatar",
                            modifier = Modifier
                                .size(140.dp)
                                .clip(CircleShape)
                        )
                    } else {
                        Text(
                            text = callerName.firstOrNull()?.uppercase() ?: "U",
                            fontSize = 56.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }

                Spacer(modifier = Modifier.height(32.dp))

                Text(
                    text = callerName,
                    fontSize = 32.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer
                )

                Spacer(modifier = Modifier.height(16.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = if (callTypeEnum == CallType.VIDEO) {
                            Icons.Default.Videocam
                        } else {
                            Icons.Default.Call
                        },
                        contentDescription = null,
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Incoming ${if (callTypeEnum == CallType.VIDEO) "Video" else "Voice"} Call",
                        fontSize = 18.sp,
                        color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.8f)
                    )
                }

                Spacer(modifier = Modifier.height(32.dp))

                Text(
                    text = "Ringing...",
                    fontSize = 16.sp,
                    color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.6f)
                )
            }

            // Action buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                // Decline
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    FloatingActionButton(
                        onClick = {
                            scope.launch {
                                CallManager.rejectCall(callId)
                                CallManager.stopListening()  // ✅ only stop on decline
                                navController.popBackStack()
                            }
                        },
                        containerColor = MaterialTheme.colorScheme.error,
                        modifier = Modifier.size(72.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.CallEnd,
                            contentDescription = "Reject",
                            tint = MaterialTheme.colorScheme.onError,
                            modifier = Modifier.size(32.dp)
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Decline",
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }

                // Accept
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    FloatingActionButton(
                        onClick = {
                            scope.launch {
                                val route = if (callTypeEnum == CallType.VIDEO) {
                                    val encodedName = java.net.URLEncoder.encode(callerName, "UTF-8")
                                    val encodedImage = java.net.URLEncoder.encode(callerImage, "UTF-8")
                                    "video_call/$callId/false/caller/$encodedName/$encodedImage"
                                } else {
                                    "voice_call/$callId/false"
                                }

                                navController.navigate(route) {
                                    popUpTo("incoming_call/{callId}/{callerName}/{callerImage}/{callType}") {
                                        inclusive = true
                                    }
                                }
                                // ✅ Do NOT call stopListening() here —
                                // VideoCallScreen/VoiceCallScreen need the listener to still be active
                            }
                        },
                        containerColor = MaterialTheme.colorScheme.secondary,
                        modifier = Modifier.size(72.dp)
                    ) {
                        Icon(
                            imageVector = if (callTypeEnum == CallType.VIDEO) {
                                Icons.Default.Videocam
                            } else {
                                Icons.Default.Call
                            },
                            contentDescription = "Accept",
                            tint = MaterialTheme.colorScheme.onSecondary,
                            modifier = Modifier.size(32.dp)
                        )
                    }
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Accept",
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}