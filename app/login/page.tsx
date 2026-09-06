'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Home, Mail, Lock, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../src/lib/supabase';
import { AUTH_STORAGE_KEYS, clearAuthStorage } from '../../src/lib/storageKeys';
import { getSecureLoginRequest } from '../../src/lib/authFlow';

export default function LoginPage() {
  const [email, setEmail] = useState('steve.cantago@gmail.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      if (typeof window !== 'undefined') {
        clearAuthStorage(window.localStorage);
      }

      if (!supabase) {
        throw new Error('Supabase is not configured. Use the dashboard demo or add Supabase environment variables.');
      }

      const loginRequest = getSecureLoginRequest({ email, password });
      if (!loginRequest.success) {
        throw new Error(loginRequest.error);
      }

      if (supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: loginRequest.email,
          password: loginRequest.password,
        });
        if (error) {
          throw error;
        }
        if (!data.session?.user?.email) {
          throw new Error('Login did not return a confirmed session.');
        }
        localStorage.setItem(AUTH_STORAGE_KEYS[0], data.session.user.email);
      }

      setMessage({ type: 'success', text: 'Successfully logged in! Redirecting to dashboard...' });
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.href = '/';
        }
      }, 1000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Login failed. Please check your credentials.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center justify-center space-y-2 text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Home className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Sign In to SMCLedger</h1>
          <p className="text-xs text-slate-400">Multi-Tenant Family Financial Ledger</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-6 sm:p-8 shadow-2xl space-y-5">
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

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="steve.cantago@gmail.com"
                  className="w-full bg-slate-900 text-white text-xs pl-9 pr-3 py-2.5 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-xs font-medium text-slate-300">Password</label>
                <Link href="/forgot-password" className="text-[11px] text-sky-400 hover:underline">
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full bg-slate-900 text-white text-xs pl-9 pr-3 py-2.5 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-bold rounded-lg transition-all shadow flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{loading ? 'Signing In...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-4 border-t border-slate-700/60 text-center text-xs text-slate-400">
            Family members sign in after an admin invitation.
          </div>
        </div>

      </div>
    </div>
  );
}
