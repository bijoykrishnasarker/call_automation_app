'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Mail, Lock, CheckCircle2, ArrowRight, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';

type AuthMode = 'login' | 'signup' | 'forgot' | 'update-password';

const inputClass =
  'w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-lime-500/20 focus:border-lime-500 focus:bg-white transition-all';
const labelClass = 'block text-sm font-semibold text-slate-700 mb-1.5 ml-1';
const btnClass =
  'w-full py-3 bg-gradient-to-r from-lime-500 to-lime-600 hover:from-lime-600 hover:to-lime-700 text-white font-bold rounded-xl shadow-lg shadow-lime-500/20 transition-all hover:shadow-lime-500/30 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2';
const linkClass = 'text-lime-600 font-semibold hover:text-lime-700 transition-colors cursor-pointer';

export default function LoginPage() {
  const router = useRouter();
  const { login, register, resetPassword, updatePassword, authError, clearAuthError } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');

  // Input fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Update password fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // Recovery detection
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (hash && (hash.includes('type=recovery') || hash.includes('access_token='))) {
      // Small delay to ensure Supabase session is initialized
      setTimeout(() => {
        setMode('update-password');
        window.history.replaceState(null, '', window.location.pathname);
      }, 500);
    }
  }, []);

  const switchMode = (newMode: AuthMode) => {
    clearAuthError();
    setPasswordError('');
    setSuccessMessage('');
    setIsLoading(false);
    setMode(newMode);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email, password);
      router.push('/');
    } catch {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    setIsLoading(true);
    try {
      const { needsEmailConfirmation } = await register(fullName, email, password);
      if (needsEmailConfirmation) {
        router.push(`/login/confirm-email?email=${encodeURIComponent(email)}`);
      } else {
        router.push('/');
      }
    } catch {
      setIsLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    setIsLoading(true);
    try {
      await updatePassword(newPassword);
      setSuccessMessage('Password successfully updated! You can now log in.');
      setTimeout(() => switchMode('login'), 2000);
    } catch {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f8f9f4]">
      {/* Brand Side (Left/Top) */}
      <div className="md:w-1/2 bg-slate-900 flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-lime-500/10 rounded-full blur-3xl -mr-48 -mt-48" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-lime-500/5 rounded-full blur-3xl -ml-48 -mb-48" />
        
        <div className="relative z-10 max-w-md text-center">
          <div className="inline-flex items-center gap-2 mb-8 px-4 py-2 bg-slate-800/50 rounded-full border border-slate-700/50 backdrop-blur-sm">
            <div className="w-8 h-8 bg-lime-500 rounded-lg flex items-center justify-center shadow-lg shadow-lime-500/20">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">LeadOpsAI</span>
          </div>
          
          <h2 className="text-4xl font-extrabold text-white mb-6 leading-tight">
            The Intelligent <span className="text-lime-400">Receptionist</span> for your Business
          </h2>
          <p className="text-slate-400 text-lg mb-12">
            Automate your lead capture, booking, and CRM updates with one powerful AI platform.
          </p>

          <div className="space-y-4 text-left">
            <div className="flex items-center gap-3 text-slate-300">
              <div className="w-6 h-6 rounded-full bg-lime-500/20 flex items-center justify-center text-lime-400">
                <CheckCircle2 size={16} />
              </div>
              <span className="text-sm font-medium">Capture names, emails, and phone numbers accurately</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <div className="w-6 h-6 rounded-full bg-lime-500/20 flex items-center justify-center text-lime-400">
                <CheckCircle2 size={16} />
              </div>
              <span className="text-sm font-medium">Automatic appointment booking & availability checks</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <div className="w-6 h-6 rounded-full bg-lime-500/20 flex items-center justify-center text-lime-400">
                <CheckCircle2 size={16} />
              </div>
              <span className="text-sm font-medium">Real-time CRM updates with detailed call summaries</span>
            </div>
          </div>
        </div>
      </div>

      {/* Form Side (Right/Bottom) */}
      <div className="md:w-1/2 flex flex-col items-center justify-center p-8 bg-white md:rounded-l-[2.5rem] shadow-2xl z-20">
        <div className="w-full max-w-[420px]">
          <div className="mb-10 text-center md:text-left">
            <h1 className="text-3xl font-black text-slate-900 mb-3">
              {mode === 'login' && 'Welcome Back'}
              {mode === 'signup' && 'Get Started'}
              {mode === 'forgot' && 'Reset Password'}
              {mode === 'update-password' && 'Set New Password'}
            </h1>
            <p className="text-slate-500">
              {mode === 'login' && "Sign in to your dashboard to manage your leads."}
              {mode === 'signup' && 'Join LeadOpsAI and transform your business scaling.'}
              {mode === 'forgot' && 'No worries, we\'ll help you get back into your account.'}
              {mode === 'update-password' && 'Enter a strong new password for your account.'}
            </p>
          </div>

          {authError && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm flex gap-3 items-center" role="alert">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              {authError}
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-4 rounded-xl bg-lime-50 border border-lime-100 text-lime-800 text-sm flex gap-3 items-center" role="status">
              <CheckCircle2 size={18} className="text-lime-600" />
              {successMessage}
            </div>
          )}

          {mode === 'forgot' ? (
            resetSent ? (
              <div className="text-center bg-slate-50 p-8 rounded-2xl border border-dashed border-slate-200">
                <div className="w-16 h-16 bg-lime-100 text-lime-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Check your inbox</h3>
                <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                  We've sent a password reset link to <strong className="text-slate-900">{email}</strong>.
                </p>
                <button
                  onClick={() => switchMode('login')}
                  className="text-sm font-bold text-lime-600 hover:text-lime-700 flex items-center justify-center gap-2 mx-auto"
                >
                  <ArrowRight size={16} className="rotate-180" /> Back to Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-6">
                <div className="relative group">
                  <label htmlFor="email" className={labelClass}>Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-lime-500 transition-colors" size={18} />
                    <input
                      id="email"
                      type="email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className={inputClass}
                    />
                  </div>
                </div>
                <button type="submit" className={btnClass} disabled={isLoading}>
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                  {!isLoading && <ArrowRight size={18} />}
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="w-full text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  Back to Login
                </button>
              </form>
            )
          ) : mode === 'update-password' ? (
            <form onSubmit={handleUpdatePassword} className="space-y-6">
              <div className="relative group">
                <label className={labelClass}>New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-lime-500 transition-colors" size={18} />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="relative group">
                <label className={labelClass}>Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-lime-500 transition-colors" size={18} />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
              </div>
              {passwordError && <p className="text-xs font-bold text-red-500 mt-1 ml-1">{passwordError}</p>}
              <button type="submit" className={btnClass} disabled={isLoading}>
                {isLoading ? 'Updating...' : 'Set New Password'}
                {!isLoading && <ArrowRight size={18} />}
              </button>
            </form>
          ) : mode === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="relative group">
                <label htmlFor="email" className={labelClass}>Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-lime-500 transition-colors" size={18} />
                  <input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="relative group">
                <div className="flex justify-between items-center mb-1.5 ml-1">
                  <label htmlFor="password" className="text-sm font-semibold text-slate-700">Password</label>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-xs font-semibold text-lime-600 hover:text-lime-700"
                  >
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-lime-500 transition-colors" size={18} />
                  <input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
              </div>
              <button type="submit" className={btnClass} disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In'}
                {!isLoading && <ArrowRight size={18} />}
              </button>
              <div className="mt-8 text-center bg-slate-50 py-4 px-6 rounded-2xl border border-slate-100">
                <p className="text-sm text-slate-500">
                  New to LeadOpsAI?{' '}
                  <span onClick={() => switchMode('signup')} className={linkClass}>Create an account</span>
                </p>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-5">
              <div className="relative group">
                <label className={labelClass}>Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-lime-500 transition-colors" size={18} />
                  <input
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="relative group">
                <label className={labelClass}>Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-lime-500 transition-colors" size={18} />
                  <input
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="relative group">
                <label className={labelClass}>Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-lime-500 transition-colors" size={18} />
                  <input
                    type="password"
                    placeholder="Min 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="relative group">
                <label className={labelClass}>Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-lime-500 transition-colors" size={18} />
                  <input
                    type="password"
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
              </div>
              {passwordError && <p className="text-xs font-bold text-red-500 mt-1 ml-1">{passwordError}</p>}
              <button type="submit" className={btnClass} disabled={isLoading}>
                {isLoading ? 'Creating account...' : 'Create Account'}
                {!isLoading && <ArrowRight size={18} />}
              </button>
              <div className="mt-6 text-center">
                <p className="text-sm text-slate-500">
                  Already have an account?{' '}
                  <span onClick={() => switchMode('login')} className={linkClass}>Log In</span>
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
