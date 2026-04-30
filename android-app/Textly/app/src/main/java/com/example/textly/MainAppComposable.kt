package com.example.textly

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import androidx.navigation.navDeepLink
import com.example.textly.feature.auth.signin.SignInScreen
import com.example.textly.feature.auth.signup.SignUpScreen
import com.example.textly.feature.call.IncomingCallScreen
import com.example.textly.feature.call.VideoCallScreen
import com.example.textly.feature.call.VoiceCallScreen
import com.example.textly.feature.chat.direct.DirectChatScreen
import com.example.textly.feature.group.AddGroupMemberScreen
import com.example.textly.feature.group.CreateGroupScreen
import com.example.textly.feature.group.GroupChatScreen
import com.example.textly.feature.group.GroupInfoScreen
import com.example.textly.feature.home.AddFriendsScreen
import com.example.textly.feature.home.HomeScreen
import com.example.textly.feature.profile.EditProfileScreen
import com.example.textly.feature.profile.ProfileScreen
import com.example.textly.feature.profile.ViewProfileScreen
import com.example.textly.feature.settings.PrivacyPolicyScreen
import com.example.textly.feature.settings.PrivacySettingsScreen
import com.example.textly.feature.settings.SettingsScreen
import com.example.textly.ui.theme.ThemeViewModel
import com.google.firebase.auth.FirebaseAuth

@Composable
fun MainApp(
    navController: NavHostController,
    themeViewModel: ThemeViewModel
) {
    Surface(modifier = Modifier.fillMaxSize()) {
        val currentUser = FirebaseAuth.getInstance().currentUser
        val start = if (currentUser != null) "home" else "login"

        NavHost(navController = navController, startDestination = start) {

            composable("login") { SignInScreen(navController) }
            composable("signup") { SignUpScreen(navController) }
            composable("home") { HomeScreen(navController) }

            composable(
                route = "direct_chat/{otherUserId}",
                arguments = listOf(navArgument("otherUserId") { type = NavType.StringType })
            ) { backStackEntry ->
                val otherUserId = backStackEntry.arguments?.getString("otherUserId") ?: ""
                DirectChatScreen(navController = navController, otherUserId = otherUserId)
            }

            composable("add_friend") { AddFriendsScreen(navController = navController) }

            composable(
                route = "group_chat/{groupId}",
                arguments = listOf(navArgument("groupId") { type = NavType.StringType })
            ) { backStackEntry ->
                val groupId = backStackEntry.arguments?.getString("groupId") ?: ""
                GroupChatScreen(navController = navController, groupId = groupId)
            }

            composable("create_group") { CreateGroupScreen(navController = navController) }
            composable("settings") { SettingsScreen(navController = navController, themeViewModel) }
            composable("profile") { ProfileScreen(navController = navController) }
            composable("privacy_settings") { PrivacySettingsScreen(navController = navController) }
            composable("edit_profile") { EditProfileScreen(navController) }
            composable("privacy_policy") { PrivacyPolicyScreen(navController = navController) }

            composable("view_profile/{userId}") { backStackEntry ->
                val userId = backStackEntry.arguments?.getString("userId") ?: ""
                ViewProfileScreen(navController, userId)
            }

            composable("group_info/{groupId}") { backStackEntry ->
                val groupId = backStackEntry.arguments?.getString("groupId") ?: ""
                GroupInfoScreen(navController, groupId)
            }

            composable("add_group_member/{groupId}") { backStackEntry ->
                val groupId = backStackEntry.arguments?.getString("groupId") ?: ""
                AddGroupMemberScreen(navController, groupId)
            }

            // ─────────────────────────────────────────────
            // INCOMING CALL
            // ─────────────────────────────────────────────
            composable(
                route = "incoming_call/{callId}/{callerName}/{callerImage}/{callType}",
                arguments = listOf(
                    navArgument("callId") { type = NavType.StringType },
                    navArgument("callerName") { type = NavType.StringType },
                    navArgument("callerImage") {
                        type = NavType.StringType
                        defaultValue = ""
                        nullable = true
                    },
                    navArgument("callType") {
                        type = NavType.StringType
                        defaultValue = "VOICE"
                    }
                ),
                deepLinks = listOf(
                    navDeepLink {
                        uriPattern = "textly://incoming_call/{callId}/{callerName}/{callerImage}/{callType}"
                    }
                )
            ) { backStackEntry ->
                val callId = backStackEntry.arguments?.getString("callId") ?: ""
                val callerName = java.net.URLDecoder.decode(
                    backStackEntry.arguments?.getString("callerName") ?: "User", "UTF-8"
                )
                val callerImage = java.net.URLDecoder.decode(
                    backStackEntry.arguments?.getString("callerImage") ?: "", "UTF-8"
                )
                val callType = backStackEntry.arguments?.getString("callType") ?: "VOICE"

                IncomingCallScreen(
                    navController = navController,
                    callId = callId,
                    callerName = callerName,
                    callerImage = callerImage,
                    callType = callType
                )
            }

            // ─────────────────────────────────────────────
            // VOICE CALL — ✅ isCaller passed as bool param
            // ─────────────────────────────────────────────
            composable(
                route = "voice_call/{callId}/{isCaller}",
                arguments = listOf(
                    navArgument("callId") { type = NavType.StringType },
                    navArgument("isCaller") { type = NavType.BoolType }
                )
            ) { backStackEntry ->
                val callId = backStackEntry.arguments?.getString("callId") ?: ""
                val isCaller = backStackEntry.arguments?.getBoolean("isCaller") ?: false
                VoiceCallScreen(
                    navController = navController,
                    callId = callId,
                    isCaller = isCaller
                )
            }

            // ─────────────────────────────────────────────
            // VIDEO CALL — ✅ isCaller passed as bool param
            // ─────────────────────────────────────────────
            composable(
                route = "video_call/{callId}/{isCaller}/{otherUserId}/{otherUserName}/{otherUserImage}",
                arguments = listOf(
                    navArgument("callId") { type = NavType.StringType },
                    navArgument("isCaller") { type = NavType.BoolType },
                    navArgument("otherUserId") { type = NavType.StringType },
                    navArgument("otherUserName") {
                        type = NavType.StringType
                        defaultValue = "User"
                    },
                    navArgument("otherUserImage") {
                        type = NavType.StringType
                        defaultValue = ""
                        nullable = true
                    }
                )
            ) { backStackEntry ->
                val callId = backStackEntry.arguments?.getString("callId") ?: ""
                val isCaller = backStackEntry.arguments?.getBoolean("isCaller") ?: false
                val otherUserId = backStackEntry.arguments?.getString("otherUserId") ?: ""
                val otherUserName = java.net.URLDecoder.decode(
                    backStackEntry.arguments?.getString("otherUserName") ?: "User", "UTF-8"
                )
                val otherUserImage = java.net.URLDecoder.decode(
                    backStackEntry.arguments?.getString("otherUserImage") ?: "", "UTF-8"
                )

                VideoCallScreen(
                    navController = navController,
                    callId = callId,
                    isCaller = isCaller,
                    otherUserId = otherUserId,
                    otherUserName = otherUserName,
                    otherUserImage = otherUserImage
                )
            }
        }
    }
}