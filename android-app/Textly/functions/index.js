/**
 * Firebase Functions (v2) + FCM Notifications for Textly
 */

const { setGlobalOptions } = require("firebase-functions/v2");
const { onRequest, onCall } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");

const admin = require("firebase-admin");
admin.initializeApp();

// 🔧 Limit instances (cost control)
setGlobalOptions({ maxInstances: 10 });

/**
 * ✅ Send notification when direct message is sent
 */
exports.sendDirectMessageNotification = onDocumentCreated(
  "directChats/{chatId}/messages/{messageId}",
  async (event) => {
    const message = event.data.data();
    const chatId = event.params.chatId;

    try {
      const chatDoc = await admin.firestore()
        .collection("directChats")
        .doc(chatId)
        .get();

      const participants = chatDoc.data().participants;
      const senderId = message.senderId;
      const receiverId = participants.find((id) => id !== senderId);

      if (!receiverId) {
        logger.log("No receiver found");
        return null;
      }

      const receiverDoc = await admin.firestore()
        .collection("users")
        .doc(receiverId)
        .get();

      const receiverData = receiverDoc.data();
      const fcmToken = receiverData ? receiverData.fcmToken : null;

      if (!fcmToken) {
        logger.log("Receiver has no FCM token");
        return null;
      }

      const payload = {
        token: fcmToken,
        notification: {
          title: message.senderName || "New Message",
          body: message.message,
        },
        data: {
          chatId: chatId,
          senderId: senderId,
          senderName: message.senderName || "User",
          click_action: "OPEN_CHAT",
        },
        android: {
          priority: "high",
          notification: {
            sound: "default",
            channelId: "textly_chat_channel",
          },
        },
      };

      const response = await admin.messaging().send(payload);
      logger.log("✅ Direct notification sent:", response);

      return response;
    } catch (error) {
      logger.error("❌ Error sending direct notification:", error);
      return null;
    }
  }
);

/**
 * ✅ Send notification when group message is sent
 */
exports.sendGroupMessageNotification = onDocumentCreated(
   "groups/{groupId}/messages/{messageId}",
   async (event) => {
     const message = event.data.data();
     const groupId = event.params.groupId;
     const senderId = message.senderId;

     try {
       const groupDoc = await admin.firestore()
         .collection("groups")
         .doc(groupId)
         .get();

       const groupData = groupDoc.data();

       // ✅ Safe checks (no optional chaining)
       const participants = groupData && groupData.participants
         ? groupData.participants
         : [];

       const groupName = groupData && groupData.name
         ? groupData.name
         : "Group";

       const promises = [];

       for (const participantId of participants) {
         if (participantId !== senderId) {

           const userDoc = await admin.firestore()
             .collection("users")
             .doc(participantId)
             .get();

           const userData = userDoc.data();
           const fcmToken = userData ? userData.fcmToken : null;

           if (fcmToken) {
             const payload = {
               token: fcmToken,
               notification: {
                 title: groupName,
                 body: message.senderName + ": " + message.message,
               },
               data: {
                 groupId: groupId,
                 groupName: groupName,
                 senderId: senderId,
                 senderName: message.senderName || "User",
                 click_action: "OPEN_GROUP_CHAT",
               },
               android: {
                 priority: "high",
                 notification: {
                   sound: "default",
                   channelId: "textly_chat_channel",
                 },
               },
             };

             promises.push(admin.messaging().send(payload));
           }
         }
       }

       const results = await Promise.all(promises);
       logger.log("✅ Sent " + results.length + " group notifications");

       return results;

     } catch (error) {
       logger.error("❌ Error sending group notification:", error);
       return null;
     }
   }
 );
/**
 * ✅ Update FCM token when user logs in
 */
exports.updateUserFCMToken = onCall(async (request) => {
 const uid = request.auth ? request.auth.uid : null;
  const fcmToken = request.data.fcmToken;

  if (!uid || !fcmToken) {
    throw new Error("User ID and FCM token are required");
  }

  try {
    await admin.firestore()
      .collection("users")
      .doc(uid)
      .update({ fcmToken: fcmToken });

    return { success: true, message: "FCM token updated" };
  } catch (error) {
    throw new Error(error.message);
  }
});