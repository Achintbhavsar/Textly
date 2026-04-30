package com.example.textly.feature.group

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
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavController
import coil.compose.AsyncImage
import com.example.textly.feature.chat.direct.GroupChatViewModel
import com.example.textly.model.Message
import com.google.firebase.auth.FirebaseAuth
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.imePadding
import androidx.compose.ui.platform.LocalContext
import com.example.textly.webrtc.CallManager
import com.example.textly.model.CallType
import com.example.textly.service.OneSignalNotificationSender
import kotlinx.coroutines.launch

@Composable
fun GroupChatScreen(
    navController: NavController,
    groupId: String
) {
    val viewModel: GroupChatViewModel = hiltViewModel()
    val messages by viewModel.messages.collectAsState()
    val groupInfo by viewModel.groupInfo.collectAsState()
    val isTyping by viewModel.isTyping.collectAsState()

    val currentUserId = FirebaseAuth.getInstance().currentUser?.uid ?: ""

    LaunchedEffect(groupId) {
        viewModel.loadGroupInfo(groupId)
        viewModel.listenForGroupMessages(groupId)
        viewModel.listenForTypingStatus(groupId)
        viewModel.markMessagesAsRead(groupId)
    }

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            viewModel.markMessagesAsRead(groupId)
        }
    }

    DisposableEffect(groupId) {
        onDispose {
            viewModel.stopTyping(groupId)
        }
    }

    GroupChatContent(
        messages = messages,
        groupName = groupInfo?.name ?: "Group Chat",  // ✅ Pass group name
        groupImage = groupInfo?.groupImage ?: "",  // ✅ Pass group image
        participantCount = groupInfo?.participants?.size ?: 0,  // ✅ Pass participant count
        groupId = groupId,
        currentUserId = currentUserId,
        isTyping = isTyping,
        onSendMessage = { text -> viewModel.sendGroupMessage(groupId, text) },
        onTyping = { viewModel.onTyping(groupId) },
        onStopTyping = { viewModel.stopTyping(groupId) },
        onBackClick = { navController.popBackStack() },
        navController = navController
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GroupChatContent(
    messages: List<Message>,
    groupName: String,
    groupImage: String,
    participantCount: Int,
    groupId: String,
    currentUserId: String,
    isTyping: Boolean,
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

    var isTypingState by remember { mutableStateOf(false) }
    var typingJob by remember { mutableStateOf<Job?>(null) }

    LaunchedEffect(messages.size, isTyping) {
        if (messages.isNotEmpty() || isTyping) {
            listState.animateScrollToItem(messages.size)
        }
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
                            if (groupImage.isNotEmpty()) {
                                AsyncImage(
                                    model = groupImage,
                                    contentDescription = "Group Avatar",
                                    modifier = Modifier
                                        .size(40.dp)
                                        .clip(CircleShape)
                                )
                            } else {
                                Icon(
                                    imageVector = Icons.Default.Group,
                                    contentDescription = null,
                                    tint = MaterialTheme.colorScheme.onPrimaryContainer,
                                    modifier = Modifier.size(24.dp)
                                )
                            }
                        }

                        Column {
                            Text(
                                text = groupName,  // ✅ Show actual group name
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = MaterialTheme.colorScheme.onPrimary
                            )

                            // ✅ Show typing or participant count
                            if (isTyping) {
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
                            } else {
                                Text(
                                    text = "$participantCount participants",
                                    fontSize = 12.sp,
                                    color = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.7f)
                                )
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
                    val context = LocalContext.current


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
                                text = { Text("Group Info") },
                                onClick = {
                                    showMenu = false
                                    navController.navigate("group_info/$groupId")
                                },
                                leadingIcon = {
                                    Icon(Icons.Default.Info, contentDescription = null)
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("Add Members") },
                                onClick = {
                                    showMenu = false
                                    navController.navigate("add_group_member/$groupId")
                                },
                                leadingIcon = {
                                    Icon(Icons.Default.PersonAdd, contentDescription = null)
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
                    GroupMessageBubble(
                        message = message,
                        isCurrentUser = message.senderId == currentUserId
                    )
                }

                if (isTyping) {
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

@Composable
fun GroupMessageBubble(
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

        Column(
            horizontalAlignment = if (isCurrentUser) Alignment.End else Alignment.Start
        ) {

            if (!isCurrentUser) {
                Text(
                    text = message.senderName,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.primary,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(bottom = 2.dp, start = 2.dp)
                )
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
                    // Message text
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
        }

        if (isCurrentUser) {
            Spacer(modifier = Modifier.width(8.dp))
        }
    }
}

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