const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const store = require('../db/store');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { deleteSupabaseFile } = require('../config/supabase');

router.get('/', optionalAuth, (req, res) => {
  try {
    const { search, tag, status, sort } = req.query;
    let list = [...store.doubts];
    if (tag) list = list.filter(d => d.tags && d.tags.some(t => t.toLowerCase() === tag.toLowerCase()));
    if (status === 'solved') list = list.filter(d => d.is_solved);
    else if (status === 'unsolved') list = list.filter(d => !d.is_solved);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(d => d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q) || d.anonymous_name.toLowerCase().includes(q));
    }
    if (sort === 'popular') list.sort((a, b) => b.likes_count - a.likes_count);
    else if (sort === 'unanswered') list.sort((a, b) => a.answers_count - b.answers_count);
    else list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const currentUserId = req.user ? req.user.id : null;
    res.json(list.map(d => ({ ...d, is_liked: currentUserId ? store.doubt_likes.some(l => l.doubt_id === d.id && l.user_id === currentUserId) : false })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', optionalAuth, (req, res) => {
  try {
    const doubt = store.doubts.find(d => d.id === req.params.id);
    if (!doubt) return res.status(404).json({ error: 'Question not found' });
    doubt.views_count = (doubt.views_count || 0) + 1;
    const answers = store.answers.filter(a => a.doubt_id === doubt.id).sort((a, b) => (b.is_accepted ? 1 : 0) - (a.is_accepted ? 1 : 0));
    const currentUserId = req.user ? req.user.id : null;
    res.json({ ...doubt, is_liked: currentUserId ? store.doubt_likes.some(l => l.doubt_id === doubt.id && l.user_id === currentUserId) : false, answers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authenticateToken, (req, res) => {
  try {
    const { title, content, tags, attachment_url, attachment_type, attachment_name, attachment_size } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title required' });
    // Voice / photo / image questions may have no text — require content OR attachment
    if ((!content || !content.trim()) && !attachment_url) {
      return res.status(400).json({ error: 'Add text or attach a voice/photo/image' });
    }
    const newDoubt = {
      id: uuidv4(), user_id: req.user.id, anonymous_name: req.user.username,
      title: title.trim(), content: content ? content.trim() : '',
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []),
      attachment_url: attachment_url || null, attachment_type: attachment_type || null,
      attachment_name: attachment_name || null, attachment_size: attachment_size || null,
      likes_count: 0, views_count: 0, answers_count: 0, is_solved: false, is_featured: false,
      created_at: new Date().toISOString()
    };
    store.doubts.unshift(newDoubt);
    const user = store.users.find(u => u.id === req.user.id);
    if (user) user.reputation = (user.reputation || 0) + 5;
    res.status(201).json(newDoubt);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/like', authenticateToken, (req, res) => {
  try {
    const doubt = store.doubts.find(d => d.id === req.params.id);
    if (!doubt) return res.status(404).json({ error: 'Question not found' });
    const existingIndex = store.doubt_likes.findIndex(l => l.doubt_id === doubt.id && l.user_id === req.user.id);
    let liked = false;
    if (existingIndex >= 0) {
      store.doubt_likes.splice(existingIndex, 1);
      doubt.likes_count = Math.max(0, doubt.likes_count - 1);
    } else {
      store.doubt_likes.push({ id: uuidv4(), doubt_id: doubt.id, user_id: req.user.id });
      doubt.likes_count += 1;
      liked = true;
    }
    res.json({ liked, likes_count: doubt.likes_count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/answers', authenticateToken, (req, res) => {
  try {
    const doubt = store.doubts.find(d => d.id === req.params.id);
    if (!doubt) return res.status(404).json({ error: 'Question not found' });
    const { content, attachment_url, attachment_type, attachment_name } = req.body;
    if (!content) return res.status(400).json({ error: 'Answer content required' });
    const newAnswer = {
      id: uuidv4(), doubt_id: doubt.id, user_id: req.user.id, anonymous_name: req.user.username,
      content: content.trim(), attachment_url: attachment_url || null, attachment_type: attachment_type || null, attachment_name: attachment_name || null,
      likes_count: 0, is_accepted: false, created_at: new Date().toISOString()
    };
    store.answers.push(newAnswer);
    doubt.answers_count = (doubt.answers_count || 0) + 1;
    res.status(201).json(newAnswer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE a doubt / question
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const doubtIndex = store.doubts.findIndex(d => d.id === id);
    if (doubtIndex === -1) {
      return res.status(404).json({ error: 'Doubt not found' });
    }

    const doubt = store.doubts[doubtIndex];

    // Authorization: Owner or Admin
    const isOwner = doubt.user_id === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'Unauthorized to delete this doubt' });
    }

    // Storage cleanup for doubt attachment
    if (doubt.attachment_url) {
      await deleteSupabaseFile(doubt.attachment_url);
    }

    // Storage cleanup for any answers with attachments
    const answers = store.answers.filter(a => a.doubt_id === id);
    for (const answer of answers) {
      if (answer.attachment_url) {
        await deleteSupabaseFile(answer.attachment_url);
      }
    }

    // Remove doubt
    store.doubts.splice(doubtIndex, 1);
    // Remove answers for this doubt
    store.answers = store.answers.filter(a => a.doubt_id !== id);
    // Remove likes for this doubt
    store.doubt_likes = store.doubt_likes.filter(l => l.doubt_id !== id);

    res.json({ message: 'Doubt deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
