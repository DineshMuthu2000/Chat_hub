const { v4: uuidv4 } = require('uuid');

// Seed default channels
const initialGroupChats = [
  { id: 'general', name: 'General Lounge', description: 'Open discussion for all anonymous community members', icon: 'MessageSquare' },
  { id: 'code-doubts', name: 'Code & Tech Doubts', description: 'Programming, bugs, tech stack questions and help', icon: 'Code' },
  { id: 'media-share', name: 'Media & Docs Hub', description: 'Share images, videos, audio, PDFs, and guides', icon: 'FileText' },
  { id: 'off-topic', name: 'Off-Topic & Chill', description: 'Casual chats, memes, games, and random banter', icon: 'Coffee' }
];

// Default admin user
const adminUser = {
  id: 'admin-001',
  username: 'CommunityAdmin',
  avatar_seed: 'admin',
  role: 'admin',
  status: 'active',
  bio: 'Platform Administrator & Moderator',
  reputation: 999,
  created_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
};

// Seed sample users
const sampleUser1 = {
  id: 'user-001',
  username: 'BlueTiger42',
  avatar_seed: 'BlueTiger42',
  role: 'user',
  status: 'active',
  bio: 'Anonymous Tech Enthusiast & Developer',
  reputation: 45,
  created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString()
};

const sampleUser2 = {
  id: 'user-002',
  username: 'NeonFalcon88',
  avatar_seed: 'NeonFalcon88',
  role: 'user',
  status: 'active',
  bio: 'Passionate about React, Node.js and UI Design',
  reputation: 82,
  created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString()
};

// Seed sample doubts
const sampleDoubts = [
  {
    id: uuidv4(),
    user_id: sampleUser1.id,
    anonymous_name: sampleUser1.username,
    title: 'How to optimize Express.js REST API response speed with caching?',
    content: 'I am building a high-traffic node app. What are the best practices for caching responses and managing database query overhead using Redis or memory cache in Express?',
    tags: ['Node.js', 'Express', 'Performance', 'Backend'],
    attachment_url: null,
    attachment_type: null,
    attachment_name: null,
    likes_count: 14,
    views_count: 128,
    answers_count: 2,
    is_solved: true,
    is_featured: true,
    created_at: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString()
  },
  {
    id: uuidv4(),
    user_id: sampleUser2.id,
    anonymous_name: sampleUser2.username,
    title: 'How do I build a seamless file viewer for PDFs and videos in React?',
    content: 'Looking for recommended packages or HTML5 embedded techniques for displaying PDF documents, custom audio, and video streams inline in a React single page app.',
    tags: ['React', 'Frontend', 'PDF', 'UI/UX'],
    attachment_url: null,
    attachment_type: null,
    attachment_name: null,
    likes_count: 8,
    views_count: 65,
    answers_count: 1,
    is_solved: false,
    is_featured: false,
    created_at: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString()
  }
];

// Seed sample answers
const sampleAnswers = [
  {
    id: uuidv4(),
    doubt_id: sampleDoubts[0].id,
    user_id: sampleUser2.id,
    anonymous_name: sampleUser2.username,
    content: 'You can use `express-redis-cache` middleware or lightweight in-memory LRU cache like `node-cache`. Also make sure to implement pagination for database queries!',
    attachment_url: null,
    attachment_type: null,
    attachment_name: null,
    likes_count: 5,
    is_accepted: true,
    created_at: new Date(Date.now() - 36 * 3600 * 1000).toISOString()
  }
];

// Seed sample messages
const sampleMessages = [
  {
    id: uuidv4(),
    sender_id: sampleUser1.id,
    sender_name: sampleUser1.username,
    recipient_id: null,
    room_id: 'general',
    message: 'Welcome to the anonymous community! Feel free to ask questions or start chat rooms without worrying about revealing personal info.',
    attachment_url: null,
    attachment_type: null,
    attachment_name: null,
    attachment_size: null,
    is_system: false,
    created_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString()
  },
  {
    id: uuidv4(),
    sender_id: sampleUser2.id,
    sender_name: sampleUser2.username,
    recipient_id: null,
    room_id: 'general',
    message: 'Awesome platform! The multi-media chat and anonymous doubt solver work super smoothly.',
    attachment_url: null,
    attachment_type: null,
    attachment_name: null,
    attachment_size: null,
    is_system: false,
    created_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString()
  }
];

const store = {
  users: [adminUser, sampleUser1, sampleUser2],
  doubts: sampleDoubts,
  answers: sampleAnswers,
  doubt_likes: [
    { id: uuidv4(), doubt_id: sampleDoubts[0].id, user_id: sampleUser2.id }
  ],
  group_chats: initialGroupChats,
  chat_messages: sampleMessages,
  notifications: [
    {
      id: uuidv4(),
      user_id: sampleUser1.id,
      type: 'like',
      title: 'New Like on your Doubt',
      message: 'NeonFalcon88 liked your doubt "How to optimize Express.js REST API..."',
      link: `/doubts/${sampleDoubts[0].id}`,
      is_read: false,
      created_at: new Date(Date.now() - 10 * 3600 * 1000).toISOString()
    }
  ],
  uploads: []
};

module.exports = store;
