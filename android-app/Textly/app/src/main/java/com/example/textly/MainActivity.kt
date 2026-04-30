package com.example.textly

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.*
import androidx.navigation.NavHostController
import androidx.navigation.compose.rememberNavController
import com.example.textly.data.ThemeMode
import com.example.textly.ui.theme.TextlyTheme
import com.example.textly.ui.theme.ThemeViewModel
import dagger.hilt.android.AndroidEntryPoint
import java.net.URLEncoder
import javax.inject.Inject
import androidx.activity.viewModels
import androidx.core.view.WindowCompat

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    private val themeViewModel: ThemeViewModel by viewModels()

    private var navController: NavHostController? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        setContent {
            val themeMode by themeViewModel.themeMode.collectAsState()

            val darkTheme = when (themeMode) {
                ThemeMode.DARK -> true
                ThemeMode.LIGHT -> false
                ThemeMode.SYSTEM -> isSystemInDarkTheme()
            }

            val controller = rememberNavController()

            // ✅ Store reference for onNewIntent
            LaunchedEffect(Unit) {
                navController = controller
                handleIntent(intent, controller)
            }

            TextlyTheme(darkTheme = darkTheme) {
                MainApp(
                    navController = controller,
                    themeViewModel = themeViewModel
                )
            }
        }
    }

    // ✅ Handles intent when app is already running
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        navController?.let { controller ->
            handleIntent(intent, controller)
        }
    }

    private fun handleIntent(
        intent: Intent?,
        controller: NavHostController
    ) {
        val navigateTo = intent?.getStringExtra("navigate_to") ?: return

        if (navigateTo == "incoming_call") {
            val callId = intent.getStringExtra("callId") ?: ""
            val callerName = intent.getStringExtra("callerName") ?: "Unknown"
            val callerImage = intent.getStringExtra("callerImage") ?: ""
            val callType = intent.getStringExtra("callType") ?: "VOICE"

            if (callId.isNotEmpty()) {
                val encodedName = URLEncoder.encode(callerName, "UTF-8")
                val encodedImage = URLEncoder.encode(callerImage, "UTF-8")
                val route = "incoming_call/$callId/$encodedName/$encodedImage/$callType"
                controller.navigate(route)
            }
        }
    }
}