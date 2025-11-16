-- Enable UUID extension if not already
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create statuses table
CREATE TABLE statuses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  media_url TEXT NOT NULL,
  media_type TEXT CHECK (media_type IN ('image', 'video')) NOT NULL,
  text_overlay JSONB DEFAULT '{}'::JSONB,  -- e.g., {"text": "Hello", "x": 50, "y": 50, "fontSize": 24, "color": "white"}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  viewed_by UUID[] DEFAULT ARRAY[]::UUID[]  -- Optional: track viewers
);

-- Trigger function to set expires_at
CREATE OR REPLACE FUNCTION set_status_expires()
RETURNS TRIGGER AS $$
BEGIN
  NEW.expires_at = NEW.created_at + INTERVAL '24 hours';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically set expires_at on insert
CREATE TRIGGER trigger_set_status_expires
  BEFORE INSERT ON statuses
  FOR EACH ROW
  EXECUTE FUNCTION set_status_expires();

-- Indexes for performance
CREATE INDEX idx_statuses_user_expires ON statuses(user_id, expires_at DESC);
CREATE INDEX idx_statuses_expires ON statuses(expires_at DESC);

-- RLS policy: Users can insert their own, read public active statuses (or followed if enforcing follows)
ALTER TABLE statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own statuses" ON statuses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read active statuses" ON statuses FOR SELECT USING (expires_at > NOW() AND (auth.uid() = user_id OR true));  -- true for public; adjust if follow-only
CREATE POLICY "Users can read own archive" ON statuses FOR SELECT USING (auth.uid() = user_id);  -- For archive, all own
CREATE POLICY "Users can update own viewed_by" ON statuses FOR UPDATE USING (auth.uid() = ANY(viewed_by) OR auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
