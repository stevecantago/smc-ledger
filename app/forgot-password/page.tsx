'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Home, Mail, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../src/lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('steve.cantago@gmail.com');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      if (!email.trim()) {
        throw new Error('Please enter a valid email address.');
      }

      if (supabase) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
      }

      setMessage({
        type: 'success',
        text: `Password reset email sent to ${email}! Please check your inbox and follow the reset link.`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to send password reset email.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex w-12 h-12 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 items-center justify-center shadow-lg shadow-sky-500/20">
            <Home className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Reset Account Password</h1>
          <p className="text-xs text-slate-400">Request Password Reset Link via Email</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-6 shadow-2xl space-y-5">
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

          <form onSubmit={handleSendResetEmail} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Registered Account Email</label>
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-bold rounded-lg transition-all shadow flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{loading ? 'Sending Reset Link...' : 'Send Password Reset Email'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-4 border-t border-slate-700/60 text-center text-xs text-slate-400">
            Remembered your password?{' '}
            <Link href="/login" className="text-sky-400 hover:underline font-semibold">
              Return to Sign In
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
