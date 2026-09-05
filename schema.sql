-- Supabase SQL Schema setup for Modern Anonymous Community App

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE (NO phone or personal private details exposed)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) NOT NULL UNIQUE,
    avatar_seed VARCHAR(100) DEFAULT 'default',
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'banned')),
    bio TEXT DEFAULT 'Anonymous Community Member',
    reputation INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. DOUBTS / QUESTIONS TABLE
CREATE TABLE IF NOT EXISTS public.doubts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    anonymous_name VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    attachment_url TEXT,
    attachment_type VARCHAR(50),
    attachment_name VARCHAR(255),
    attachment_size BIGINT,
    likes_count INT DEFAULT 0,
    views_count INT DEFAULT 0,
    answers_count INT DEFAULT 0,
    is_solved BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. DOUBT ANSWERS / REPLIES TABLE
CREATE TABLE IF NOT EXISTS public.answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doubt_id UUID REFERENCES public.doubts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    anonymous_name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    attachment_url TEXT,
    attachment_type VARCHAR(50),
    attachment_name VARCHAR(255),
    likes_count INT DEFAULT 0,
    is_accepted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. DOUBT LIKES TABLE
CREATE TABLE IF NOT EXISTS public.doubt_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doubt_id UUID REFERENCES public.doubts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(doubt_id, user_id)
);

-- 5. GROUP CHATS / CHANNELS TABLE
CREATE TABLE IF NOT EXISTS public.group_chats (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(50) DEFAULT 'Hash',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Default group channels
INSERT INTO public.group_chats (id, name, description, icon) VALUES
('general', 'General Lounge', 'Open discussion for all anonymous community members', 'MessageSquare'),
('code-doubts', 'Code & Tech Doubts', 'Programming, bugs, tech stack questions and help', 'Code'),
('media-share', 'Media & Docs Hub', 'Share images, videos, audio, PDFs, and guides', 'FileText'),
('off-topic', 'Off-Topic & Chill', 'Casual chats, memes, games, and random banter', 'Coffee')
ON CONFLICT (id) DO NOTHING;

-- 6. CHAT MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    sender_name VARCHAR(100) NOT NULL,
    recipient_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    room_id VARCHAR(100) NOT NULL DEFAULT 'general',
    message TEXT,
    attachment_url TEXT,
    attachment_type VARCHAR(50),
    attachment_name VARCHAR(255),
    attachment_size BIGINT,
    client_msg_id VARCHAR(100),
    reply_to_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(255),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. UPLOADS TABLE
CREATE TABLE IF NOT EXISTS public.uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    uploader_name VARCHAR(100) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_url TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    category VARCHAR(50) DEFAULT 'other',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
