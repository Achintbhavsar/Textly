package com.example.textly.feature.settings

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.StarOutline
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

@Composable
fun RatingDialog(
    onDismiss: () -> Unit
) {
    val context = LocalContext.current
    var selectedStars by remember { mutableStateOf(0) }
    var feedbackText by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Column(horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.fillMaxWidth()) {
                Text(
                    text = "Rate Textly",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Your feedback helps us improve!",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        text = {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                // Star Rating Row
                Row(
                    horizontalArrangement = Arrangement.Center,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    (1..5).forEach { star ->
                        Icon(
                            imageVector = if (star <= selectedStars)
                                Icons.Filled.Star else Icons.Outlined.StarOutline,
                            contentDescription = "$star stars",
                            tint = if (star <= selectedStars)
                                Color(0xFFFFB300) else MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier
                                .size(40.dp)
                                .clickable { selectedStars = star }
                                .padding(4.dp)
                        )
                    }
                }

                // Star label
                if (selectedStars > 0) {
                    Text(
                        text = when (selectedStars) {
                            1 -> "😞 Poor"
                            2 -> "😐 Fair"
                            3 -> "🙂 Good"
                            4 -> "😊 Very Good"
                            5 -> "🤩 Excellent!"
                            else -> ""
                        },
                        style = MaterialTheme.typography.bodyMedium,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.primary
                    )
                }

                // Feedback Text Field
                OutlinedTextField(
                    value = feedbackText,
                    onValueChange = { feedbackText = it },
                    label = { Text("Write your feedback...") },
                    minLines = 3,
                    maxLines = 5,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val starLabel = "⭐".repeat(selectedStars)
                    val emailBody = """
                        Rating: $starLabel ($selectedStars/5)
                        
                        Feedback:
                        $feedbackText
                        
                        ---
                        Sent from Textly App
                    """.trimIndent()

                    val intent = Intent(Intent.ACTION_SENDTO).apply {
                        data = Uri.parse("mailto:")
                        putExtra(Intent.EXTRA_EMAIL, arrayOf("batmanop2506@gmail.com")) // 👈 replace with your email
                        putExtra(Intent.EXTRA_SUBJECT, "Textly App Feedback - $selectedStars/5 Stars")
                        putExtra(Intent.EXTRA_TEXT, emailBody)
                    }
                    context.startActivity(Intent.createChooser(intent, "Send Feedback"))
                    onDismiss()
                },
                enabled = selectedStars > 0
            ) {
                Text("Submit Feedback")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}