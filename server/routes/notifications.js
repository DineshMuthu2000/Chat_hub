const express = require('express');
const router = express.Router();
const store = require('../db/store');
const { authenticateToken } = require('../middleware/auth');

// GET user notifications
router.get('/', authenticateToken, (req, res) => {
  const userNotifs = store.notifications
    .filter(n => n.user_id === req.user.id)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  res.json(userNotifs);
});

// PUT mark all notifications as read
router.put('/read-all', authenticateToken, (req, res) => {
  store.notifications
    .filter(n => n.user_id === req.user.id)
    .forEach(n => { n.is_read = true; });

  res.json({ message: 'Notifications marked as read' });
});

// PUT mark single notification as read
router.put('/:id/read', authenticateToken, (req, res) => {
  const notif = store.notifications.find(n => n.id === req.params.id && n.user_id === req.user.id);
  if (notif) notif.is_read = true;
  res.json({ message: 'Notification marked as read' });
});

module.exports = router;
