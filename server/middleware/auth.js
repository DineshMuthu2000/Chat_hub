const jwt = require('jsonwebtoken');
const store = require('../db/store');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_community_key_2026';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Check if user is banned
    const foundUser = store.users.find(u => u.id === user.id);
    if (foundUser && foundUser.status === 'banned') {
      return res.status(403).json({ error: 'Your account has been banned by the administrator.' });
    }

    req.user = foundUser || user;
    next();
  });
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (!err) {
        const foundUser = store.users.find(u => u.id === user.id);
        if (foundUser && foundUser.status !== 'banned') {
          req.user = foundUser;
        }
      }
      next();
    });
  } else {
    next();
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { authenticateToken, optionalAuth, requireAdmin, JWT_SECRET };
