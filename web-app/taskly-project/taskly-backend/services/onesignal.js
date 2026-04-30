import * as OneSignalNode from 'onesignal-node';

let client = null;

const getClient = () => {
  if (!client) {
    if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_REST_API_KEY) {
      console.warn('⚠️ OneSignal credentials not configured');
      return null;
    }
    client = new OneSignalNode.Client(
      process.env.ONESIGNAL_APP_ID,
      process.env.ONESIGNAL_REST_API_KEY
    );
  }
  return client;
};

export const sendMessageNotification = async ({
  recipientUserId,
  senderName,
  messageText,
  conversationId,
  chatId,
}) => {
  try {
    const oneSignalClient = getClient();
    if (!oneSignalClient) {
      return;
    }

    await oneSignalClient.createNotification({
      headings:        { en: `💬 ${senderName}` },
      contents:        { en: messageText?.length > 80 ? messageText.substring(0, 80) + '...' : messageText || 'New message' },
      include_aliases: { external_id: [recipientUserId] },
      target_channel:  'push',
      data:            { type: 'message', conversationId: conversationId || chatId, chatId: chatId || conversationId, senderName },
      url:             `${process.env.FRONTEND_URL}/dashboard?conversation=${conversationId || chatId}`,
    });
    console.log(`🔔 Message notification sent to: ${recipientUserId}`);
  } catch (err) {
    console.error('❌ OneSignal message notification error:', err.message);
  }
};

export const sendCallNotification = async ({
  recipientUserId,
  callerName,
  callType,
  conversationId,
  chatId,
}) => {
  try {
    const oneSignalClient = getClient();
    if (!oneSignalClient) {
      return;
    }

    await oneSignalClient.createNotification({
      headings:        { en: callType === 'video' ? '📹 Incoming Video Call' : '📞 Incoming Audio Call' },
      contents:        { en: `${callerName} is calling you...` },
      include_aliases: { external_id: [recipientUserId] },
      target_channel:  'push',
      priority:        10,
      ttl:             30,
      data:            { type: 'call', callType, callerName, conversationId: conversationId || chatId, chatId: chatId || conversationId },
      url:             `${process.env.FRONTEND_URL}/dashboard?conversation=${conversationId || chatId}`,
    });
    console.log(`📞 Call notification sent to: ${recipientUserId}`);
  } catch (err) {
    console.error('❌ OneSignal call notification error:', err.message);
  }
};
