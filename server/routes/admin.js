const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const store = require('../db/store');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { deleteSupabaseFile } = require('../config/supabase');

// All endpoints in this route require Admin authentication
router.use(authenticateToken, requireAdmin);

// Dashboard overview stats
router.get('/stats', (req, res) => {
  res.json({
    totalUsers: store.users.length,
    activeUsers: store.users.filter(u => u.status === 'active').length,
    bannedUsers: store.users.filter(u => u.status === 'banned').length,
    totalDoubts: store.doubts.length,
    solvedDoubts: store.doubts.filter(d => d.is_solved).length,
    totalAnswers: store.answers.length,
    totalMessages: store.chat_messages.length,
    totalUploads: store.uploads.length
  });
});

// GET all users for admin management
router.get('/users', (req, res) => {
  const users = store.users.map(u => ({
    id: u.id,
    username: u.username,
    role: u.role,
    status: u.status,
    reputation: u.reputation,
    bio: u.bio,
    created_at: u.created_at
  }));
  res.json(users);
});

// PUT update user status (ban / unban)
router.put('/users/:id/status', (req, res) => {
  const { status } = req.body;
  if (!['active', 'banned'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const user = store.users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.role === 'admin') {
    return res.status(400).json({ error: 'Cannot ban admin user' });
  }

  user.status = status;
  res.json({ message: `User status updated to ${status}`, user });
});

// DELETE user
router.delete('/users/:id', (req, res) => {
  const index = store.users.findIndex(u => u.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'User not found' });

  if (store.users[index].role === 'admin') {
    return res.status(400).json({ error: 'Cannot delete admin user' });
  }

  store.users.splice(index, 1);
  res.json({ message: 'User deleted successfully' });
});

// DELETE a doubt / question
router.delete('/doubts/:id', async (req, res) => {
  const index = store.doubts.findIndex(d => d.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Question not found' });

  const doubt = store.doubts[index];
  if (doubt.attachment_url) {
    await deleteSupabaseFile(doubt.attachment_url);
  }

  const answers = store.answers.filter(a => a.doubt_id === req.params.id);
  for (const answer of answers) {
    if (answer.attachment_url) {
      await deleteSupabaseFile(answer.attachment_url);
    }
  }

  store.doubts.splice(index, 1);
  // Also remove answers for this doubt
  store.answers = store.answers.filter(a => a.doubt_id !== req.params.id);
  // Also remove likes for this doubt
  store.doubt_likes = store.doubt_likes.filter(l => l.doubt_id !== req.params.id);

  res.json({ message: 'Question and associated answers deleted successfully' });
});

// DELETE an answer / reply
router.delete('/answers/:id', (req, res) => {
  const index = store.answers.findIndex(a => a.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Answer not found' });

  const doubt = store.doubts.find(d => d.id === store.answers[index].doubt_id);
  if (doubt) {
    doubt.answers_count = Math.max(0, doubt.answers_count - 1);
  }

  store.answers.splice(index, 1);
  res.json({ message: 'Answer deleted successfully' });
});

// POST send platform-wide system broadcast announcement
router.post('/broadcast', (req, res) => {
  const { title, message } = req.body;
  if (!title || !message) {
    return res.status(400).json({ error: 'Title and message are required' });
  }

  // Add system message to general chat
  const systemMsg = {
    id: uuidv4(),
    sender_id: req.user.id,
    sender_name: '📢 SYSTEM ANNOUNCEMENT',
    recipient_id: null,
    room_id: 'general',
    message: `[${title.toUpperCase()}]: ${message}`,
    is_system: true,
    created_at: new Date().toISOString()
  };
  store.chat_messages.push(systemMsg);

  // Send notification to all non-admin users
  store.users.forEach(u => {
    if (u.role !== 'admin') {
      store.notifications.push({
        id: uuidv4(),
        user_id: u.id,
        type: 'system',
        title: `📢 Announcement: ${title}`,
        message: message,
        link: '/chats/group/general',
        is_read: false,
        created_at: new Date().toISOString()
      });
    }
  });

  res.json({ message: 'Broadcast sent to all users!' });
});

// DELETE uploaded file
router.delete('/uploads/:id', async (req, res) => {
  const index = store.uploads.findIndex(u => u.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'File record not found' });

  const fileRecord = store.uploads[index];
  if (fileRecord.file_url) {
    await deleteSupabaseFile(fileRecord.file_url);
  }

  const filePath = path.join(__dirname, '../../uploads', path.basename(fileRecord.file_url));

  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.error('Error removing file from disk:', e);
    }
  }

  store.uploads.splice(index, 1);
  res.json({ message: 'File deleted successfully' });
});

module.exports = router;
