import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Home, User, MessageSquare, Bell, Menu, Search, Plus, LogOut } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';

// Components from your live logic
import Feed from './components/Feed';
import Profile from './components/Profile';
import Messages from './components/Messages';
import { Auth } from './components/Auth';

const NAV_ITEMS = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: MessageSquare, label: 'Messages', path: '/messages' },
  { icon: User, label: 'Profile', path: '/profile' },
];

export const SPECIAL_EVENT_MODE = false;
export const EVENT_MESSAGE = "⚡ SPECIAL EVENT (test): WELCOME TO THE LIAOVERSE! ENJOY THE VIBES! ⚡";
const EVENT_THEMES = ["https://huanmux.github.io/assets/audio/theme01.mp3", "https://huanmux.github.io/assets/audio/theme02.mp3"];

const MobileNavBar = () => {
  const location = useLocation();
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[rgba(var(--color-surface),0.9)] backdrop-blur-md border-t border-[rgba(var(--color-border),0.5)] md:hidden">
      <div className="flex justify-around items-center h-20 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} className="flex flex-col items-center justify-center w-full h-full relative group">
              {isActive && (
                <motion.div layoutId="mobile-nav-pill" className="absolute top-2 w-16 h-8 bg-[rgba(var(--color-primary),0.2)] rounded-full" transition={{ type: "spring", stiffness: 300, damping: 30 }} />
              )}
              <div className={`relative p-1 rounded-full transition-colors ${isActive ? 'text-[rgb(var(--color-text))]' : 'text-[rgb(var(--color-text-secondary))]'}`}>
                <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-xs mt-1 font-medium ${isActive ? 'text-[rgb(var(--color-text))]' : 'text-[rgb(var(--color-text-secondary))]'}`}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

const DesktopNavRail = () => {
  const location = useLocation();
  const { profile, signOut } = useAuth();

  return (
    <motion.div initial={{ x: -100 }} animate={{ x: 0 }} className="hidden md:flex flex-col w-24 h-screen fixed left-0 top-0 border-r border-[rgba(var(--color-border),0.5)] bg-[rgba(var(--color-surface),0.5)] backdrop-blur-xl z-50 py-8 items-center">
      <div className="mb-8 p-3 bg-[rgba(var(--color-primary),1)] rounded-xl text-[rgb(var(--color-text-on-primary))] shadow-lg">
        <span className="font-black text-xl">G</span>
      </div>

      <div className="flex flex-col gap-4 w-full px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} className="flex flex-col items-center gap-1 group relative w-full">
               <div className={`relative w-14 h-8 flex items-center justify-center rounded-full transition-all duration-300 ${isActive ? 'bg-[rgba(var(--color-primary),0.3)]' : 'hover:bg-[rgba(var(--color-surface-hover),1)]'}`}>
                <item.icon size={24} className={`z-10 transition-colors ${isActive ? 'text-[rgb(var(--color-text))]' : 'text-[rgb(var(--color-text-secondary))]'}`} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-[rgb(var(--color-text))]' : 'text-[rgb(var(--color-text-secondary))]'}`}>{item.label}</span>
            </Link>
          );
        })}
        <button onClick={() => signOut()} className="flex flex-col items-center gap-1 group mt-4">
           <div className="w-14 h-8 flex items-center justify-center rounded-full hover:bg-red-500/10 text-red-500 transition-all"><LogOut size={20} /></div>
           <span className="text-[10px] font-medium text-red-500">Exit</span>
        </button>
      </div>
      
      <div className="mt-auto mb-4">
         <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[rgb(var(--color-primary))] to-[rgb(var(--color-accent))] p-0.5 cursor-pointer">
            <img src={profile?.avatar_url || "https://i.pravatar.cc/150"} alt="User" className="w-full h-full rounded-full object-cover border-2 border-[rgb(var(--color-background))]" />
         </div>
      </div>
    </motion.div>
  );
};

const MainContent = () => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-[rgb(var(--color-background))] text-[rgb(var(--color-text))]">Loading Gazebo...</div>;
  if (!user) return <Auth />;

  return (
    <div className="min-h-screen bg-[rgb(var(--color-background))] text-[rgb(var(--color-text))] font-sans selection:bg-[rgba(var(--color-primary),0.3)]">
      <DesktopNavRail />
      <main className="md:pl-24 pb-20 md:pb-0 min-h-screen relative overflow-hidden">
        <div className="max-w-4xl mx-auto min-h-screen border-x border-[rgba(var(--color-border),0.3)] bg-[rgba(var(--color-background),0.5)] shadow-2xl">
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<Feed />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/messages" element={<Messages />} />
            </Routes>
          </AnimatePresence>
        </div>
      </main>
      <MobileNavBar />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <MainContent />
      </BrowserRouter>
    </AuthProvider>
  );
}
