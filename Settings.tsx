// src/components/Settings.tsx
import { useState } from 'react';
import { supabase, Profile as ProfileType } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BadgeCheck, Mail, Lock, User, AlertCircle, CheckCircle, Settings as SettingsLucideIcon, Check } from 'lucide-react';
import { Themes } from './Themes';

export const Settings = () => {
  // Use global state and new update function from context
  const { user, profile, updateProfile } = useAuth();
  
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [reason, setReason] = useState('');
  const [showApply, setShowApply] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Removed: local profile state and loadProfile function/useEffect.

  const handleThemeChange = async (newTheme: string) => {
    if (!user?.id || !profile) return;
    setLoading(true);
    
    // 1. Update database
    const { error } = await supabase.from('profiles').update({ theme: newTheme }).eq('id', user.id);
    setLoading(false);
    
    if (!error) {
      // 2. SUCCESS: Update global state immediately (Theme applied instantly)
      updateProfile({ ...profile, theme: newTheme }); 
      setMessage({ type: 'success', text: 'Theme updated!' });
    } else {
      setMessage({ type: 'error', text: 'Failed to update theme.' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleUsernameChange = async () => {
    if (!user?.id || !profile || newUsername === profile.username || !newUsername.trim()) return;
    setLoading(true);
    
    // Check if username is taken
    const { data: existing } = await supabase.from('profiles').select('id').eq('username', newUsername.toLowerCase()).maybeSingle();
    if (existing) {
      setMessage({ type: 'error', text: 'Username already taken.' });
      setLoading(false);
      return;
    }
    
    // 1. Update database
    const { error } = await supabase.from('profiles').update({ username: newUsername.toLowerCase() }).eq('id', user.id);
    setLoading(false);
    
    if (!error) {
      // 2. SUCCESS: Update global state immediately
      updateProfile({ ...profile, username: newUsername.toLowerCase() });
      setMessage({ type: 'success', text: 'Username updated!' });
      setNewUsername('');
    } else {
      setMessage({ type: 'error', text: 'Failed to update username.' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleEmailChange = async () => {
    if (!user?.id || !newEmail.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setLoading(false);
    if (!error) {
      setMessage({ type: 'success', text: 'Email updated! Check your inbox for confirmation.' });
      setNewEmail('');
    } else {
      setMessage({ type: 'error', text: error.message || 'Failed to update email.' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handlePasswordChange = async () => {
    if (!user?.id || newPassword !== confirmPassword || newPassword.length < 6) return;
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (!error) {
      setMessage({ type: 'success', text: 'Password updated!' });
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setMessage({ type: 'error', text: error.message || 'Failed to update password.' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleVerificationApply = async () => {
    if (!user?.id || !profile || !reason.trim()) return;
    setLoading(true);
    
    // 1. Update database
    const { error } = await supabase.from('profiles').update({ verification_request: reason }).eq('id', user.id);
    setLoading(false);
    
    if (!error) {
      // 2. SUCCESS: Update global state immediately
      updateProfile({ ...profile, verification_request: reason });
      setMessage({ type: 'success', text: 'Verification request submitted!' });
      setReason('');
      setShowApply(false);
    } else {
      setMessage({ type: 'error', text: 'Failed to submit request.' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  if (!profile || !user) return <div className="text-center p-8">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-8">
      <div className="flex items-center gap-2">
        <SettingsLucideIcon size={24} className="text-gray-600" />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {message && (
        <div className={`p-3 rounded-lg flex items-center gap-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          {message.text}
        </div>
      )}

      {/* Theme Section */}
      <section className="bg-white p-6 rounded-xl border border-gray-200">
        <h2 className="text-lg font-semibold mb-4">Theme</h2>
        <Themes currentTheme={profile.theme} onChange={handleThemeChange} loading={loading} />
      </section>

      {/* Username Section */}
      <section className="bg-white p-6 rounded-xl border border-gray-200">
        <h2 className="text-lg font-semibold mb-4">Username</h2>
        <p className="text-gray-600 mb-2">Current: @{profile.username}</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="New username"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleUsernameChange}
            disabled={loading || !newUsername.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 transition"
          >
            {loading ? '...' : 'Change'}
          </button>
        </div>
      </section>

      {/* Email Section */}
      <section className="bg-white p-6 rounded-xl border border-gray-200">
        <h2 className="text-lg font-semibold mb-4">Email</h2>
        <p className="text-gray-600 mb-2">Current: {user.email}</p>
        <div className="flex gap-2">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="New email"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleEmailChange}
            disabled={loading || !newEmail.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 transition flex items-center gap-2"
          >
            <Mail size={16} />
            {loading ? '...' : 'Change'}
          </button>
        </div>
      </section>

      {/* Password Section */}
      <section className="bg-white p-6 rounded-xl border border-gray-200">
        <h2 className="text-lg font-semibold mb-4">Password</h2>
        <div className="space-y-3">
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 6 chars)"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handlePasswordChange}
            disabled={loading || newPassword !== confirmPassword || newPassword.length < 6}
            className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 transition flex items-center justify-center gap-2"
          >
            <Lock size={16} />
            {loading ? '...' : 'Change Password'}
          </button>
        </div>
      </section>

      {/* Verification Section */}
      <section className="bg-white p-6 rounded-xl border border-gray-200">
        <h2 className="text-lg font-semibold mb-4"><BadgeCheck className="text-blue-500" /> Verification</h2>
        {profile.verified ? (
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle size={20} />
            <span>Verified</span>
            <Check size={20} className="text-blue-500" />
          </div>
        ) : profile.verification_request ? (
          <div className="text-yellow-600">Pending: {profile.verification_request}</div>
        ) : (
          <>
            <p className="text-gray-600 mb-4"> Apply for verification badge.</p>
            <button
              onClick={() => setShowApply(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
              Apply for Verification
            </button>
            {showApply && (
              <div className="mt-4 space-y-3">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason for verification (e.g., public figure, brand, etc.)"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleVerificationApply}
                    disabled={loading || !reason.trim()}
                    className="flex-1 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 transition"
                  >
                    {loading ? '...' : 'Submit'}
                  </button>
                  <button
                    onClick={() => { setShowApply(false); setReason(''); }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};
