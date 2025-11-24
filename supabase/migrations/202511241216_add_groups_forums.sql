-- 1. GROUPS TABLE
CREATE TABLE public.groups (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  icon_url text DEFAULT '',
  banner_url text DEFAULT '',
  type text NOT NULL CHECK (type IN ('public', 'private', 'secret')),
  tag text NOT NULL CHECK (tag IN ('Gaming', 'Hobbies', 'Study', 'Trade', 'Reviews', 'Other')),
  owner_id uuid REFERENCES public.profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 2. GROUP MEMBERS
CREATE TABLE public.group_members (
  group_id uuid REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- 3. MODIFY POSTS TABLE (To link posts to groups)
ALTER TABLE public.posts ADD COLUMN group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL;

-- 4. FORUMS TABLE
CREATE TABLE public.forums (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  icon_url text DEFAULT '',
  banner_url text DEFAULT '',
  tag text NOT NULL CHECK (tag IN ('Gaming', 'Hobbies', 'Study', 'Trade', 'Reviews', 'Other')),
  owner_id uuid REFERENCES public.profiles(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 5. FORUM POSTS (Separate from main feed)
CREATE TABLE public.forum_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  forum_id uuid REFERENCES public.forums(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  media_url text DEFAULT '',
  media_type text DEFAULT 'image',
  created_at timestamptz DEFAULT now(),
  comment_count integer DEFAULT 0
);

-- 6. FORUM COMMENTS
CREATE TABLE public.forum_comments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id uuid REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);
