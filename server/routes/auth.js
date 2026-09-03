const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const store = require('../db/store');
const { generateRandomUsername } = require('../utils/usernameGenerator');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

// Anonymous Join / Register / Instant Session
router.post('/anonymous-join', (req, res) => {
  try {
    let username = generateRandomUsername();
    
    // Ensure uniqueness
    while (store.users.some(u => u.username === username)) {
      username = generateRandomUsername();
    }

    const newUser = {
      id: uuidv4(),
      username: username,
      avatar_seed: username,
      role: 'user',
      status: 'active',
      bio: 'Anonymous Community Member',
      reputation: 10,
      created_at: new Date().toISOString()
    };

    store.users.push(newUser);

    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, role: newUser.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Notice: NO phone number, email, or real identity stored or returned
    res.json({
      message: 'Joined anonymously successfully!',
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        avatar_seed: newUser.avatar_seed,
        role: newUser.role,
        bio: newUser.bio,
        reputation: newUser.reputation,
        created_at: newUser.created_at
      }
    });
  } catch (error) {
    console.error('ANONYMOUS JOIN ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

// Custom Random Regenerate Username
router.post('/regenerate-name', authenticateToken, (req, res) => {
  try {
    let newUsername = generateRandomUsername();
    while (store.users.some(u => u.username === newUsername)) {
      newUsername = generateRandomUsername();
    }

    const user = store.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.username = newUsername;
    user.avatar_seed = newUsername;

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Anonymous handle updated!',
      token,
      user: {
        id: user.id,
        username: user.username,
        avatar_seed: user.avatar_seed,
        role: user.role,
        bio: user.bio,
        reputation: user.reputation,
        created_at: user.created_at
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Admin Login
router.post('/admin-login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin12345';

  if (password !== adminPassword) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }

  let admin = store.users.find(u => u.role === 'admin');
  if (!admin) {
    admin = {
      id: 'admin-001',
      username: 'CommunityAdmin',
      avatar_seed: 'admin',
      role: 'admin',
      status: 'active',
      bio: 'Platform Administrator',
      reputation: 999,
      created_at: new Date().toISOString()
    };
    store.users.push(admin);
  }

  const token = jwt.sign(
    { id: admin.id, username: admin.username, role: admin.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    message: 'Admin authenticated successfully!',
    token,
    user: {
      id: admin.id,
      username: admin.username,
      avatar_seed: admin.avatar_seed,
      role: admin.role,
      bio: admin.bio,
      reputation: admin.reputation,
      created_at: admin.created_at
    }
  });
});

// Get current user profile
router.get('/me', authenticateToken, (req, res) => {
  const user = store.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Always return sanitized user profile WITHOUT exposing personal identifiers
  res.json({
    id: user.id,
    username: user.username,
    avatar_seed: user.avatar_seed,
    role: user.role,
    status: user.status,
    bio: user.bio,
    reputation: user.reputation,
    created_at: user.created_at
  });
});

// Update profile bio
router.put('/profile', authenticateToken, (req, res) => {
  const { bio } = req.body;
  const user = store.users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (bio !== undefined) user.bio = bio;

  res.json({
    message: 'Profile updated successfully!',
    user: {
      id: user.id,
      username: user.username,
      avatar_seed: user.avatar_seed,
      role: user.role,
      bio: user.bio,
      reputation: user.reputation,
      created_at: user.created_at
    }
  });
});

module.exports = router;
