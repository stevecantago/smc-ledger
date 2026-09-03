'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home, Mail, Lock, User, ShieldCheck, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { HouseholdRole } from '../../src/types/database';
import { supabase } from '../../src/lib/supabase';

export default function RegisterPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<HouseholdRole>('admin');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      if (!displayName.trim() || !email.trim() || !password) {
        throw new Error('Please complete all required registration fields.');
      }

      if (supabase) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName,
              role: role,
            },
          },
        });
        if (error) throw error;
      }

      setMessage({ type: 'success', text: `Account registered for ${email}! Check your email inbox to verify your account.` });
      setTimeout(() => router.push('/login'), 2000);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Registration failed. Please try again.' });
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Create Family Account</h1>
          <p className="text-xs text-slate-400">Join or Register SMCLedger Household</p>
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

          <form onSubmit={handleRegister} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Full Display Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Steve Cantago"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-slate-900 text-white text-xs pl-9 pr-3 py-2.5 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  placeholder="steve.cantago@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900 text-white text-xs pl-9 pr-3 py-2.5 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900 text-white text-xs pl-9 pr-3 py-2.5 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Household Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as HouseholdRole)}
                className="w-full bg-slate-900 text-white text-xs px-3 py-2.5 rounded-lg border border-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
              >
                <option value="admin">Admin (Head Parent)</option>
                <option value="parent_member">Member (Parent/Guardian)</option>
                <option value="member">Member (Teen/Dependent)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-bold rounded-lg transition-all shadow flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{loading ? 'Creating Account...' : 'Register Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-4 border-t border-slate-700/60 text-center text-xs text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="text-sky-400 hover:underline font-semibold">
              Sign In
            </Link>
          </div>
        </div>

        <div className="text-center">
          <Link href="/" className="text-xs text-slate-400 hover:text-white transition-colors">
            ← Back to Dashboard Demo
          </Link>
        </div>

      </div>
    </div>
  );
}
