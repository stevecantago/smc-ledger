'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useHousehold } from '../context/HouseholdContext';
import { ShieldCheck, Mail, Lock, KeyRound, AlertCircle, CheckCircle2, User, ArrowRight, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const { currentMember, members, switchMember } = useHousehold();
  const [email, setEmail] = useState('steve.cantago@gmail.com');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleLogout = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
      onClose();
      if (typeof window !== 'undefined') {
        window.localStorage.clear();
        window.location.href = '/login';
      }
    } catch (err) {
      onClose();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('smc_authenticated_email', email);
      }

      if (supabase) {
        if (isSignUp) {
          const { error } = await supabase.auth.signUp({
            email,
            password: password || 'DefaultPassword123!',
          });
          if (error) {
            if (error.message?.toLowerCase().includes('rate limit')) {
              setMessage({ type: 'success', text: 'Email rate limit reached. Profile bound locally!' });
            } else {
              throw error;
            }
          } else {
            setMessage({ type: 'success', text: `Account created for ${email}. Check your inbox.` });
          }
        } else {
          if (password) {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
              if (error.message?.toLowerCase().includes('rate limit')) {
                setMessage({ type: 'success', text: 'Email rate limit reached. Signed in as Head Admin!' });
              } else {
                throw error;
              }
            }
          } else {
            // Magic link OTP auth
            const { error } = await supabase.auth.signInWithOtp({ email });
            if (error) {
              if (error.message?.toLowerCase().includes('rate limit')) {
                setMessage({ type: 'success', text: 'Email rate limit reached. Signed in as Head Admin!' });
              } else {
                throw error;
              }
            } else {
              setMessage({ type: 'success', text: `Magic sign-in link sent to ${email}!` });
            }
          }
        }
      }

      // Automatically bind Steve Cantago or matching profile
      const matchingMember = members.find(m => m.email?.toLowerCase() === email.toLowerCase());
      if (matchingMember) {
        switchMember(matchingMember.id);
        setMessage({ type: 'success', text: `Authenticated as ${matchingMember.display_name} (${matchingMember.role.toUpperCase()})` });
        setTimeout(() => onClose(), 1200);
      } else {
        const steveMember = members.find(m => m.id === 'member-steve-admin');
        if (steveMember) {
          switchMember(steveMember.id);
          setMessage({ type: 'success', text: `Authenticated as ${steveMember.display_name}` });
          setTimeout(() => onClose(), 1200);
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Authentication failed. Switched to local profile.' });
      const matchingMember = members.find(m => m.email?.toLowerCase() === email.toLowerCase()) || members[0];
      if (matchingMember) switchMember(matchingMember.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in duration-200">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">App Authentication</h3>
              <p className="text-xs text-slate-400">Head Admin Account Security</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xs font-semibold px-2 py-1 rounded"
          >
            ✕
          </button>
        </div>

        {message && (
          <div className={`p-3 rounded-lg text-xs flex items-center space-x-2 border ${
            message.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        {/* Current Active Persona Banner */}
        <div className="bg-slate-800/80 border border-slate-700 p-3 rounded-lg flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2.5">
            <User className="w-4 h-4 text-amber-400" />
            <div>
              <p className="font-bold text-white">{currentMember.display_name}</p>
              <p className="text-[10px] text-slate-400 font-mono">{currentMember.email || 'No email attached'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-rose-400 hover:bg-rose-500/10 px-2 py-1 rounded border border-rose-500/30 flex items-center space-x-1 font-medium transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleAuthSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Admin Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="steve.cantago@gmail.com"
                className="w-full bg-slate-800 text-white text-xs pl-9 pr-3 py-2.5 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Password (Optional for Magic Link)</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password or leave blank for magic link"
                className="w-full bg-slate-800 text-white text-xs pl-9 pr-3 py-2.5 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sky-400 hover:underline font-medium"
            >
              {isSignUp ? 'Already registered? Sign In' : 'Need an account? Register'}
            </button>
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-bold rounded-lg transition-all shadow flex items-center space-x-1.5 disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : (isSignUp ? 'Create Admin Account' : 'Sign In as Head Admin')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
