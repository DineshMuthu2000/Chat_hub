const express = require('express');
const router = express.Router();
const store = require('../db/store');
const { createChatMessage } = require('../services/chatService');
const { authenticateToken } = require('../middleware/auth');

// GET group channels list
router.get('/channels', authenticateToken, (req, res) => {
  res.json(store.group_chats);
});

// GET user list for starting 1-on-1 chats (excl. current user, NO phone or personal data)
router.get('/users', authenticateToken, (req, res) => {
  const users = store.users
    .filter(u => u.id !== req.user.id && u.status !== 'banned')
    .map(u => ({
      id: u.id,
      username: u.username,
      avatar_seed: u.avatar_seed,
      role: u.role,
      bio: u.bio
    }));
  res.json(users);
});

// GET message history for a group channel or DM conversation
router.get('/messages/:type/:targetId', authenticateToken, (req, res) => {
  try {
    const { type, targetId } = req.params;
    let messages = [];

    if (type === 'group') {
      messages = store.chat_messages.filter(m => m.room_id === targetId && !m.recipient_id);
    } else if (type === 'dm') {
      const currentId = req.user.id;
      messages = store.chat_messages.filter(
        m => (m.sender_id === currentId && m.recipient_id === targetId) ||
             (m.sender_id === targetId && m.recipient_id === currentId)
      );
    }

    messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST send a chat message with optional multi-media attachment
// (canonical persistence + realtime broadcast path used by the camera/file attachment flow)
router.post('/messages', authenticateToken, (req, res) => {
  try {
    const {
      recipient_id,
      room_id,
      message,
      attachment_url,
      attachment_type,
      attachment_name,
      attachment_size,
      client_msg_id,
      reply_to_id
    } = req.body;

    if (!message && !attachment_url) {
      return res.status(400).json({ error: 'Message or attachment is required' });
    }

    // Sender identity comes from the authenticated token, never from the client payload
    const saved = createChatMessage({
      sender_id: req.user.id,
      sender_name: req.user.username,
      recipient_id: recipient_id || null,
      room_id: room_id || 'general',
      message: message || '',
      attachment_url,
      attachment_type,
      attachment_name,
      attachment_size,
      client_msg_id,
      reply_to_id: reply_to_id || null
    });

    res.status(201).json(saved);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
