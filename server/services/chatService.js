const { v4: uuidv4 } = require('uuid');
const store = require('../db/store');
const { broadcastChatMessage, getIo } = require('../socket');

/**
  Single source of truth for saving + broadcasting a chat message.
  Used by BOTH the REST chat-message API and the socket event handler,
  so attachments (camera photos, files) and text behave identically.
  client_msg_id is passed through so the sender can dedupe the realtime echo.
*/
function createChatMessage(msgData) {
  const newMessage = {
    id: uuidv4(),
    sender_id: msgData.sender_id,
    sender_name: msgData.sender_name,
    recipient_id: msgData.recipient_id || null,
    room_id: msgData.room_id || 'general',
    message: msgData.message ? String(msgData.message).trim() : '',
    attachment_url: msgData.attachment_url || null,
    attachment_type: msgData.attachment_type || null,
    attachment_name: msgData.attachment_name || null,
    attachment_size: msgData.attachment_size || null,
    client_msg_id: msgData.client_msg_id || null,
    reply_to_id: msgData.reply_to_id || null,
    is_system: false,
    created_at: new Date().toISOString()
  };

  // Persist in the existing store (in-memory DB / Supabase-compatible shape)
  store.chat_messages.push(newMessage);

  if (newMessage.recipient_id) {
    // Direct message: notify + push realtime to both sides
    const io = getIo();
    if (io) {
      store.notifications.push({
        id: uuidv4(),
        user_id: newMessage.recipient_id,
        type: 'chat',
        title: `Message from ${newMessage.sender_name}`,
        message: newMessage.message ? newMessage.message.substring(0, 40) : `Attachment: ${newMessage.attachment_name}`,
        link: `/chats/dm/${newMessage.sender_id}`,
        is_read: false,
        created_at: new Date().toISOString()
      });
      io.emit(`notification_${newMessage.recipient_id}`, store.notifications[store.notifications.length - 1]);
    }
  }

  // Realtime broadcast to the room (group) or both DM parties
  broadcastChatMessage(newMessage);

  return newMessage;
}

module.exports = { createChatMessage };
