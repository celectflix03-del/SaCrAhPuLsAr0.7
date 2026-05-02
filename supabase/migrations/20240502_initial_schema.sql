-- Initial Schema for SaCrAh PuLsAr 7.0

-- Enable RLS
ALTER TABLE IF EXISTS tracks DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS radio_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chat DISABLE ROW LEVEL SECURITY;

-- 1. Tracks Table
CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('playlist', 'commercial', 'vignette')),
  is_live BOOLEAN DEFAULT FALSE,
  user_id UUID NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Radio Settings Table
CREATE TABLE IF NOT EXISTS radio_settings (
  user_id UUID PRIMARY KEY,
  radio_name TEXT DEFAULT 'SaCrAh PuLsAr 7.0',
  default_volume FLOAT DEFAULT 0.8,
  auto_dj BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Chat Table
CREATE TABLE IF NOT EXISTS chat (
  id TEXT PRIMARY KEY,
  user_name TEXT NOT NULL,
  message TEXT NOT NULL,
  time BIGINT NOT NULL,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS again
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE radio_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat ENABLE ROW LEVEL SECURITY;

-- Policies for Tracks
CREATE POLICY "Users can manage their own tracks" ON tracks
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read tracks" ON tracks
  FOR SELECT USING (true);

-- Policies for Radio Settings
CREATE POLICY "Users can manage their own settings" ON radio_settings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read radio settings" ON radio_settings
  FOR SELECT USING (true);

-- Policies for Chat
CREATE POLICY "Anyone can read chat" ON chat
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can post to chat" ON chat
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
