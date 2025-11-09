// src/components/Search.tsx
import { useEffect, useState } from 'react';
import { supabase, Profile, Post } from '../lib/supabase';
import { Search as SearchIcon, X } from 'lucide-react';

const goToProfile = async (profileId: string) => {
  const { data } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', profileId)
    .single();
  if (data) {
    window.history.replaceState({}, '', `/?${data.username}`);
    window.dispatchEvent(new CustomEvent('navigateToProfile', { detail: profileId }));
  }
};

export const Search = ({ onClose }: { onClose: () => void }) => {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setUsers([]);
      setPosts([]);
      return;
    }

    const debounce = setTimeout(async () => {
      setLoading(true);
      const lowerQuery = query.toLowerCase();

      // Search users
      const { data: userData } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${lowerQuery}%,display_name.ilike.%${lowerQuery}%`)
        .limit(5);

      // Search posts
      const { data: postData } = await supabase
        .from('posts')
        .select('*, profiles(*)')
        .ilike('content', `%${lowerQuery}%`)
        .order('created_at', { ascending: false })
        .limit(10);

      setUsers(userData || []);
      setPosts(postData || []);
      setLoading(false);
    }, 300);

    return () => clearTimeout(debounce);
  }, [query]);

  return (
    <div className="fixed inset-0 bg-[rgb(var(--color-surface))] z-50 flex flex-col">
      <div className="flex items-center gap-3 p-4 border-b border-[rgb(var(--color-border))]">
        <button onClick={onClose} className="p-2 hover:bg-[rgb(var(--color-surface-hover))] rounded-full transition">
          <X size={24} className="text-[rgb(var(--color-text-secondary))]" />
        </button>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users or posts..."
          className="flex-1 text-lg outline-none text-[rgb(var(--color-text))]"
          autoFocus
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="p-8 text-center text-[rgb(var(--color-text-secondary))]">Searching...</div>
        )}

        {!loading && query && (
          <>
            {/* Users */}
            {users.length > 0 && (
              <div className="border-b border-[rgb(var(--color-border))]">
                <h3 className="px-4 py-2 text-sm font-bold text-[rgb(var(--color-text-secondary))] uppercase tracking-wider">
                  Users
                </h3>
                {users.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      goToProfile(u.id);
                      onClose();
                    }}
                    className="w-full text-left p-4 hover:bg-[rgb(var(--color-surface-hover))] transition border-b border-[rgb(var(--color-border))] flex items-center gap-3"
                  >
                    <img
                      src={u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`}
                      className="w-10 h-10 rounded-full flex-shrink-0"
                      alt=""
                    />
                    <div className="text-left min-w-0 flex-1">
                      <div className="font-semibold text-[rgb(var(--color-text))]">{u.display_name}</div>
                      <div className="text-sm text-[rgb(var(--color-text-secondary))]">@{u.username}</div>
                    </div>
                    {u.verified && <BadgeCheck size={16} className="text-[rgb(var(--color-accent))]" />}
                  </button>
                ))}
              </div>
            )}

            {/* Posts */}
            {posts.length > 0 && (
              <div>
                <h3 className="px-4 py-2 text-sm font-bold text-[rgb(var(--color-text-secondary))] uppercase tracking-wider">
                  Posts
                </h3>
                {posts.map((post) => (
                  <button
                    key={post.id}
                    onClick={() => {
                      goToProfile(post.user_id);
                      onClose();
                    }}
                    className="w-full text-left p-4 hover:bg-[rgb(var(--color-surface-hover))] transition border-b border-[rgb(var(--color-border))]"
                  >
                    <div className="flex gap-3">
                      <img
                        src={
                          post.profiles?.avatar_url ||
                          `https://api.dicebear.com/7.x/avataaars/svg?seed=${post.profiles?.username}`
                        }
                        className="w-10 h-10 rounded-full flex-shrink-0"
                        alt=""
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 text-sm">
                          <span className="font-bold text-[rgb(var(--color-text))]">{post.profiles?.display_name}</span>
                          <span className="text-[rgb(var(--color-text-secondary))]">@{post.profiles?.username}</span>
                        </div>
                        <p className="text-[rgb(var(--color-text))] mt-1 line-clamp-2">
                          {post.content}
                        </p>
                        {post.image_url && (
                          <img
                            src={post.image_url}
                            className="mt-2 rounded-xl max-h-48 object-cover w-full"
                            alt=""
                          />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!users.length && !posts.length && (
              <div className="p-12 text-center text-[rgb(var(--color-text-secondary))]">
                No results found for "{query}"
              </div>
            )}
          </>
        )}

        {!query && (
          <div className="p-12 text-center text-[rgb(var(--color-text-secondary))]">
            <SearchIcon size={48} className="mx-auto mb-4 opacity-50 text-[rgb(var(--color-text-secondary))]" />
            <p>Type to search users and posts</p>
          </div>
        )}
      </div>
    </div>
  );
};
