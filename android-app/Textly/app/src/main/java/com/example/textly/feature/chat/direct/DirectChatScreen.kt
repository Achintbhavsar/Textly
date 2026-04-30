package com.example.textly.feature.chat.direct

import android.widget.Toast
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import coil.compose.AsyncImage
import com.example.textly.feature.chat.DirectChatViewModel
import com.example.textly.model.CallType
import com.example.textly.model.Message
import com.example.textly.service.OneSignalNotificationSender
import com.example.textly.webrtc.CallManager
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await


@Composable
fun DirectChatScreen(
    navController: NavController,
    otherUserId: String
) {
    val viewModel: DirectChatViewModel = hiltViewModel()
    val messages by viewModel.messages.collectAsState()
    val otherUser by viewModel.otherUser.collectAsState()
    val isOtherUserTyping by viewModel.isOtherUserTyping.collectAsState()

    val currentUserId = FirebaseAuth.getInstance().currentUser?.uid ?: ""

    val chatId = remember(currentUserId, otherUserId) {
        if (currentUserId < otherUserId) {
            "${currentUserId}_${otherUserId}"
        } else {
            "${otherUserId}_${currentUserId}"
        }
    }

    LaunchedEffect(chatId, otherUserId) {
        viewModel.loadOtherUserInfo(otherUserId)
        viewModel.startDirectChat(otherUserId)
        viewModel.listenForDirectMessages(chatId)
        viewModel.listenForTypingStatus(chatId, otherUserId)
        // ✅ Removed duplicate markMessagesAsRead here — handled by LaunchedEffect(messages.size)
    }

    // ✅ Mark as read only when new messages arrive
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            viewModel.markMessagesAsRead(chatId, otherUserId)
        }
    }

    DisposableEffect(chatId) {
        onDispose {
            viewModel.stopTyping(chatId)
        }
    }

    DirectChatContent(
        messages = messages,
        otherUser = otherUser,
        chatId = chatId,
        currentUserId = currentUserId,
        otherUserId = otherUserId,
        isOtherUserTyping = isOtherUserTyping,
        onSendMessage = { text ->
            viewModel.sendDirectMessage(chatId, text)
        },
        onTyping = {
            viewModel.onTyping(chatId)
        },
        onStopTyping = {
            viewModel.stopTyping(chatId)
        },
        onBackClick = { navController.popBackStack() },
        navController = navController
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DirectChatContent(
    messages: List<Message>,
    otherUser: com.example.textly.model.User?,
    chatId: String,
    currentUserId: String,
    otherUserId: String,
    isOtherUserTyping: Boolean,
    onSendMessage: (String) -> Unit,
    onTyping: () -> Unit,
    onStopTyping: () -> Unit,
    onBackClick: () -> Unit,
    navController: NavController

) {
    var messageText by remember { mutableStateOf("") }
    val listState = rememberLazyListState()
    val keyboardController = LocalSoftwareKeyboardController.current
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    var isTypingState by remember { mutableStateOf(false) }
    var typingJob by remember { mutableStateOf<Job?>(null) }
    var showClearChatDialog by remember { mutableStateOf(false) }

    // ✅ Fix: use messages.size - 1 to avoid index out of bounds crash
    LaunchedEffect(messages.size, isOtherUserTyping) {
        if (messages.isNotEmpty()) {
            // scroll to last message; if typing bubble shown, scroll one more
            val targetIndex = if (isOtherUserTyping) messages.size else messages.size - 1
            listState.animateScrollToItem(targetIndex)
        }
    }

    // ✅ Clear Chat Dialog — was declared but never rendered before
    if (showClearChatDialog) {
        AlertDialog(
            onDismissRequest = { showClearChatDialog = false },
            icon = {
                Icon(
                    Icons.Default.Delete,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.error
                )
            },
            title = { Text("Clear Chat") },
            text = {
                Text("Are you sure you want to delete all messages? This cannot be undone.")
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        scope.launch {
                            try {
                                val messagesRef = FirebaseFirestore.getInstance()
                                    .collection("directChats")
                                    .document(chatId)
                                    .collection("messages")

                                val messageDocs = messagesRef.get().await()
                                val batch = FirebaseFirestore.getInstance().batch()
                                messageDocs.documents.forEach { doc ->
                                    batch.delete(doc.reference)
                                }
                                batch.commit().await()

                                FirebaseFirestore.getInstance()
                                    .collection("directChats")
                                    .document(chatId)
                                    .update(
                                        mapOf(
                                            "lastMessage" to "",
                                            "lastMessageTime" to 0L
                                        )
                                    ).await()

                                Toast.makeText(context, "Chat cleared", Toast.LENGTH_SHORT).show()
                                showClearChatDialog = false
                            } catch (e: Exception) {
                                Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                            }
                        }
                    }
                ) {
                    Text("Clear", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showClearChatDialog = false }) {
                    Text("Cancel")
                }
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(MaterialTheme.colorScheme.primaryContainer),
                            contentAlignment = Alignment.Center
                        ) {
                            if (!otherUser?.profileUrl.isNullOrEmpty()) {
                                AsyncImage(
                                    model = otherUser?.profileUrl,
                                    contentDescription = "Avatar",
                                    modifier = Modifier
                                        .size(40.dp)
                                        .clip(CircleShape)
                                )
                            } else {
                                Text(
                                    text = otherUser?.name?.firstOrNull()?.uppercase() ?: "U",
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = MaterialTheme.colorScheme.onPrimaryContainer
                                )
                            }
                        }

                        Column {
                            Text(
                                text = otherUser?.name ?: "Loading...",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onPrimary
                            )
                            if (isOtherUserTyping) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(4.dp)
                                ) {
                                    Text(
                                        text = "typing",
                                        fontSize = 12.sp,
                                        color = MaterialTheme.colorScheme.secondary,
                                        fontWeight = FontWeight.Medium
                                    )
                                    TypingDotsAnimation()
                                }
                            }
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBackClick) {
                        Icon(
                            Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = MaterialTheme.colorScheme.onPrimary
                        )
                    }
                },
                actions = {
                    var showMenu by remember { mutableStateOf(false) }

                    // ✅ Voice Call — navigates with callId only (matches fixed VoiceCallScreen)
                    IconButton(
                        onClick = {
                            scope.launch {
                                try {
                                    val callId = CallManager.initiateCall(
                                        receiverId = otherUserId,
                                        receiverName = otherUser?.name ?: "User",
                                        receiverImage = otherUser?.profileUrl ?: "",
                                        callType = CallType.VOICE
                                    )
                                    OneSignalNotificationSender.sendCallNotification(
                                        receiverId = otherUserId,
                                        callerName = FirebaseAuth.getInstance().currentUser?.displayName ?: "User",
                                        callId = callId,
                                        callType = CallType.VOICE
                                    )
                                    // ✅ Only pass callId — VoiceCallScreen fetches other info from Firestore
                                    navController.navigate("voice_call/$callId/true")
                                } catch (e: Exception) {
                                    Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                                }
                            }
                        }
                    ) {
                        Icon(
                            Icons.Default.Call,
                            contentDescription = "Voice Call",
                            tint = MaterialTheme.colorScheme.onPrimary
                        )
                    }

                    // ✅ Video Call — navigates with callId + user info (matches fixed VideoCallScreen)
                    IconButton(
                        onClick = {
                            scope.launch {
                                try {
                                    val callId = CallManager.initiateCall(
                                        receiverId = otherUserId,
                                        receiverName = otherUser?.name ?: "User",
                                        receiverImage = otherUser?.profileUrl ?: "",
                                        callType = CallType.VIDEO
                                    )
                                    OneSignalNotificationSender.sendCallNotification(
                                        receiverId = otherUserId,
                                        callerName = FirebaseAuth.getInstance().currentUser?.displayName ?: "User",
                                        callId = callId,
                                        callType = CallType.VIDEO
                                    )
                                    // ✅ Pass callId + user info for VideoCallScreen
                                    val encodedName = java.net.URLEncoder.encode(otherUser?.name ?: "User", "UTF-8")
                                    val encodedImage = java.net.URLEncoder.encode(otherUser?.profileUrl ?: "", "UTF-8")
                                    navController.navigate(
                                        "video_call/$callId/true/$otherUserId/$encodedName/$encodedImage")
                                } catch (e: Exception) {
                                    Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_SHORT).show()
                                }
                            }
                        }
                    ) {
                        Icon(
                            Icons.Default.Videocam,
                            contentDescription = "Video Call",
                            tint = MaterialTheme.colorScheme.onPrimary
                        )
                    }

                    // More Menu
                    Box {
                        IconButton(onClick = { showMenu = true }) {
                            Icon(
                                Icons.Default.MoreVert,
                                contentDescription = "More",
                                tint = MaterialTheme.colorScheme.onPrimary
                            )
                        }

                        DropdownMenu(
                            expanded = showMenu,
                            onDismissRequest = { showMenu = false }
                        ) {
                            DropdownMenuItem(
                                text = { Text("View Profile") },
                                onClick = {
                                    showMenu = false
                                    otherUser?.uid?.let { userId ->
                                        navController.navigate("view_profile/$userId")
                                    }
                                },
                                leadingIcon = {
                                    Icon(Icons.Default.Person, contentDescription = null)
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("Clear Chat", color = MaterialTheme.colorScheme.error) },
                                onClick = {
                                    showMenu = false
                                    showClearChatDialog = true
                                },
                                leadingIcon = {
                                    Icon(
                                        Icons.Default.Delete,
                                        contentDescription = null,
                                        tint = MaterialTheme.colorScheme.error
                                    )
                                }
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .background(MaterialTheme.colorScheme.background)
        ) {
            LazyColumn(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                state = listState,
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                items(messages) { message ->
                    DirectMessageBubble(
                        message = message,
                        isCurrentUser = message.senderId == currentUserId
                    )
                }

                if (isOtherUserTyping) {
                    item { TypingBubble() }
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surface)
                    .padding(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextField(
                    value = messageText,
                    onValueChange = { newText ->
                        messageText = newText

                        if (newText.isNotBlank()) {
                            if (!isTypingState) {
                                isTypingState = true
                                onTyping()
                            }
                            typingJob?.cancel()
                            typingJob = scope.launch {
                                delay(2000)
                                isTypingState = false
                                onStopTyping()
                            }
                        } else {
                            isTypingState = false
                            typingJob?.cancel()
                            onStopTyping()
                        }
                    },
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(24.dp)),
                    placeholder = {
                        Text(
                            "Type a message...",
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    },
                    colors = TextFieldDefaults.colors(
                        unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                        focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                        unfocusedIndicatorColor = MaterialTheme.colorScheme.surfaceVariant,
                        focusedIndicatorColor = MaterialTheme.colorScheme.primary
                    ),
                    keyboardOptions = KeyboardOptions.Default.copy(imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(
                        onSend = {
                            if (messageText.isNotBlank()) {
                                onSendMessage(messageText.trim())
                                messageText = ""
                                isTypingState = false
                                typingJob?.cancel()
                                onStopTyping()
                                keyboardController?.hide()
                            }
                        }
                    ),
                    maxLines = 4
                )

                Spacer(modifier = Modifier.width(8.dp))

                IconButton(
                    onClick = {
                        if (messageText.isNotBlank()) {
                            onSendMessage(messageText.trim())
                            messageText = ""
                            isTypingState = false
                            typingJob?.cancel()
                            onStopTyping()
                        }
                    },
                    modifier = Modifier
                        .size(48.dp)
                        .clip(CircleShape)
                        .background(MaterialTheme.colorScheme.primary)
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.Send,
                        contentDescription = "Send",
                        tint = MaterialTheme.colorScheme.onPrimary
                    )
                }
            }
        }
    }
}

// ─────────────────────────────────────────────
// Message Bubble
// ─────────────────────────────────────────────

@Composable
fun DirectMessageBubble(
    message: Message,
    isCurrentUser: Boolean
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isCurrentUser) Arrangement.End else Arrangement.Start
    ) {
        if (!isCurrentUser) {
            Box(
                modifier = Modifier
                    .size(32.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.primaryContainer),
                contentAlignment = Alignment.Center
            ) {
                if (!message.senderImage.isNullOrEmpty()) {
                    AsyncImage(
                        model = message.senderImage,
                        contentDescription = "Avatar",
                        modifier = Modifier
                            .size(32.dp)
                            .clip(CircleShape)
                    )
                } else {
                    Text(
                        text = message.senderName.firstOrNull()?.uppercase() ?: "U",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                }
            }
            Spacer(modifier = Modifier.width(8.dp))
        }

        Surface(
            shape = RoundedCornerShape(
                topStart = 12.dp,
                topEnd = 12.dp,
                bottomStart = if (isCurrentUser) 12.dp else 2.dp,
                bottomEnd = if (isCurrentUser) 2.dp else 12.dp
            ),
            color = if (isCurrentUser) {
                MaterialTheme.colorScheme.primary
            } else {
                MaterialTheme.colorScheme.surfaceVariant
            },
            shadowElevation = 1.dp,
            modifier = Modifier.wrapContentWidth()
        ) {
            Row(
                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                verticalAlignment = Alignment.Bottom,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Text(
                    text = message.message,
                    color = if (isCurrentUser) {
                        MaterialTheme.colorScheme.onPrimary
                    } else {
                        MaterialTheme.colorScheme.onSurfaceVariant
                    },
                    fontSize = 15.sp,
                    modifier = Modifier.alignByBaseline()
                )

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(3.dp),
                    modifier = Modifier.alignByBaseline()
                ) {
                    Text(
                        text = formatMessageTime(message.createdAt),
                        fontSize = 10.sp,
                        color = if (isCurrentUser) {
                            MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.6f)
                        } else {
                            MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.7f)
                        }
                    )

                    if (isCurrentUser) {
                        MessageStatusIcon(
                            delivered = message.delivered,
                            read = message.read
                        )
                    }
                }
            }
        }

        if (isCurrentUser) {
            Spacer(modifier = Modifier.width(8.dp))
        }
    }
}

// ─────────────────────────────────────────────
// Typing Indicators
// ─────────────────────────────────────────────

@Composable
fun TypingBubble() {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Start
    ) {
        Surface(
            shape = RoundedCornerShape(16.dp),
            color = MaterialTheme.colorScheme.surfaceVariant,
            shadowElevation = 2.dp
        ) {
            Row(
                modifier = Modifier.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TypingDotsAnimation()
            }
        }
    }
}

@Composable
fun TypingDotsAnimation() {
    val infiniteTransition = rememberInfiniteTransition(label = "typing")

    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        repeat(3) { index ->
            val alpha by infiniteTransition.animateFloat(
                initialValue = 0.3f,
                targetValue = 1f,
                animationSpec = infiniteRepeatable(
                    animation = tween(600),
                    repeatMode = RepeatMode.Reverse,
                    initialStartOffset = StartOffset(index * 200)
                ),
                label = "dot$index"
            )

            Box(
                modifier = Modifier
                    .size(8.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = alpha))
            )
        }
    }
}

// ─────────────────────────────────────────────
// Message Status Icon
// ─────────────────────────────────────────────

@Composable
fun MessageStatusIcon(delivered: Boolean, read: Boolean) {
    val iconColor = if (read) {
        MaterialTheme.colorScheme.secondary
    } else {
        MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.6f)
    }

    val icon = if (delivered || read) {
        Icons.Default.DoneAll
    } else {
        Icons.Default.Done
    }

    Icon(
        imageVector = icon,
        contentDescription = when {
            read -> "Read"
            delivered -> "Delivered"
            else -> "Sent"
        },
        modifier = Modifier.size(14.dp),
        tint = iconColor
    )
}

// ─────────────────────────────────────────────
// Time Formatter
// ─────────────────────────────────────────────

fun formatMessageTime(timestamp: Long): String {
    val now = System.currentTimeMillis()
    val diff = now - timestamp
    return when {
        diff < 60000 -> "Now"
        diff < 3600000 -> "${diff / 60000}m"
        diff < 86400000 -> {
            val sdf = java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault())
            sdf.format(java.util.Date(timestamp))
        }
        else -> {
            val sdf = java.text.SimpleDateFormat("dd/MM", java.util.Locale.getDefault())
            sdf.format(java.util.Date(timestamp))
        }
    }
}