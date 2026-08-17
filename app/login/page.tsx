'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot,
  Mail,
  Lock,
  CheckCircle2,
  ArrowRight,
  User,
  Phone,
  Calendar,
  ShieldCheck,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { ThemeToggle } from '@/components/ThemeToggle';

type AuthMode = 'login' | 'signup' | 'forgot' | 'update-password';

const inputClass =
  'w-full rounded-xl border border-zinc-800 bg-[#111214] py-3 pl-11 pr-11 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-all focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/15';
const labelClass = 'mb-2 block text-sm font-medium text-zinc-400';
const linkClass = 'cursor-pointer font-semibold text-violet-400 transition-colors hover:text-violet-300';

const FEATURES = [
  {
    icon: Phone,
    iconClass: 'text-violet-400 bg-violet-500/10 ring-violet-500/20',
    title: '24/7 AI Voice Receptionist',
    desc: 'Answers calls in natural, low-latency human voice.',
  },
  {
    icon: Calendar,
    iconClass: 'text-emerald-400 bg-emerald-500/10 ring-emerald-500/20',
    title: 'Live Calendar Booking',
    desc: 'Instantly books consultations while checking your real-time availability.',
  },
  {
    icon: ShieldCheck,
    iconClass: 'text-violet-400 bg-violet-500/10 ring-violet-500/20',
    title: 'Automated Multi-Channel Follow-up',
    desc: 'Syncs with SMS, Email, WhatsApp, and Google Reviews effortlessly.',
  },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const { login, register, resetPassword, updatePassword, authError, clearAuthError } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (hash && (hash.includes('type=recovery') || hash.includes('access_token='))) {
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

  const showAuthTabs = mode === 'login' || mode === 'signup';

  const renderPasswordField = (
    id: string,
    label: string,
    value: string,
    onChange: (v: string) => void,
    visible: boolean,
    onToggle: () => void,
    placeholder = '••••••••',
    showForgot = false,
  ) => (
    <div className="relative group">
      <div className="mb-2 flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium text-zinc-400">{label}</label>
        {showForgot && (
          <button type="button" onClick={() => switchMode('forgot')} className="text-xs font-semibold text-violet-400 hover:text-violet-300">
            Forgot?
          </button>
        )}
      </div>
      <div className="relative">
        <Lock className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-600 group-focus-within:text-violet-400 transition-colors" />
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          className={inputClass}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition-colors"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      {/* Top bar — stays visible while scrolling */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-white/[0.06] bg-[#09090b]/95 px-6 py-4 backdrop-blur-md md:px-10">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/20 ring-1 ring-violet-500/30">
            <Bot className="h-4 w-4 text-violet-400" strokeWidth={2.25} />
          </div>
          <span className="text-base font-bold tracking-tight text-white">
            LeadOps<span className="text-violet-400">AI</span>
          </span>
        </div>
        <ThemeToggle className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-[#111214] text-zinc-400 transition-colors hover:border-zinc-700 hover:text-zinc-200" />
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-4.5rem)] max-w-6xl flex-col items-center justify-center gap-10 px-6 py-10 md:flex-row md:items-center md:gap-16 md:px-10 lg:gap-20">
        {/* Left — hero */}
        <section className="w-full max-w-xl md:flex-1">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/25 bg-violet-500/10 px-3.5 py-1.5">
            <Sparkles className="h-3.5 w-3.5 text-violet-400" />
            <span className="text-xs font-semibold text-violet-300">Autonomous AI Lead Engine</span>
          </div>

          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl lg:text-[2.65rem] lg:leading-[1.15]">
            The Intelligent{' '}
            <span className="text-violet-400">Voice &amp; CRM</span>
            {' '}Employee
          </h1>

          <p className="mt-4 max-w-lg text-sm leading-relaxed text-zinc-500 sm:text-base">
            Never miss a customer call again. Capture high-intent leads, book calendar appointments, and sync full transcripts to your pipeline 24/7.
          </p>

          <div className="mt-8 space-y-3">
            {FEATURES.map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-4 rounded-xl border border-white/[0.06] bg-[#111214] p-4 transition-colors hover:border-white/[0.1]"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${item.iconClass}`}>
                  <item.icon className="h-[18px] w-[18px]" strokeWidth={2} />
                </div>
                <div className="min-w-0 pt-0.5">
                  <h3 className="text-sm font-semibold text-zinc-100">{item.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500 sm:text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right — auth card */}
        <section className="w-full max-w-md shrink-0 md:w-[400px]">
          <div className="rounded-2xl border border-white/[0.08] bg-[#111214] p-6 shadow-2xl shadow-black/40 sm:p-8">
            {showAuthTabs && (
              <div className="mb-7 flex gap-1 rounded-xl bg-[#0a0a0b] p-1 ring-1 ring-white/[0.06]">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                    mode === 'login'
                      ? 'bg-violet-400 text-zinc-950 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${
                    mode === 'signup'
                      ? 'bg-violet-400 text-zinc-950 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Create Account
                </button>
              </div>
            )}

            <div className="mb-6">
              <h2 className="text-xl font-bold text-white">
                {mode === 'login' && 'Welcome Back'}
                {mode === 'signup' && 'Create Account'}
                {mode === 'forgot' && 'Reset Password'}
                {mode === 'update-password' && 'Set New Password'}
              </h2>
              <p className="mt-1.5 text-sm text-zinc-500">
                {mode === 'login' && 'Enter your credentials to access your dashboard.'}
                {mode === 'signup' && 'Start automating your lead capture and bookings today.'}
                {mode === 'forgot' && "We'll send a reset link to your email."}
                {mode === 'update-password' && 'Choose a strong new password.'}
              </p>
            </div>

            {authError && (
              <div className="mb-5 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-3.5 text-sm text-red-300" role="alert">
                <div className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-400" />
                {authError}
              </div>
            )}

            {successMessage && (
              <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-sm text-emerald-300" role="status">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                {successMessage}
              </div>
            )}

            {mode === 'forgot' ? (
              resetSent ? (
                <div className="text-center py-4">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-500/10 ring-1 ring-violet-500/20">
                    <Mail className="h-7 w-7 text-violet-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white">Check your inbox</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                    We&apos;ve sent a password reset link to <strong className="text-zinc-300">{email}</strong>.
                  </p>
                  <button type="button" onClick={() => switchMode('login')} className={`${linkClass} mt-5 inline-flex items-center gap-2 text-sm`}>
                    <ArrowRight className="h-4 w-4 rotate-180" /> Back to Login
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="space-y-5">
                  <div className="group relative">
                    <label htmlFor="forgot-email" className={labelClass}>Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-600 group-focus-within:text-violet-400 transition-colors" />
                      <input id="forgot-email" type="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-400 py-3 text-sm font-bold text-zinc-950 transition-all hover:bg-violet-300 active:scale-[0.98] disabled:opacity-70"
                  >
                    {isLoading ? 'Sending...' : 'Send Reset Link'}
                    {!isLoading && <ArrowRight className="h-4 w-4" />}
                  </button>
                  <button type="button" onClick={() => switchMode('login')} className="w-full text-sm font-medium text-zinc-500 hover:text-zinc-300">
                    Back to Login
                  </button>
                </form>
              )
            ) : mode === 'update-password' ? (
              <form onSubmit={handleUpdatePassword} className="space-y-5">
                {renderPasswordField('new-password', 'New Password', newPassword, setNewPassword, showNewPassword, () => setShowNewPassword((v) => !v))}
                {renderPasswordField('confirm-new-password', 'Confirm New Password', confirmNewPassword, setConfirmNewPassword, showConfirmPassword, () => setShowConfirmPassword((v) => !v))}
                {passwordError && <p className="ml-1 text-xs font-semibold text-red-400">{passwordError}</p>}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-400 py-3 text-sm font-bold text-zinc-950 transition-all hover:bg-violet-300 active:scale-[0.98] disabled:opacity-70"
                >
                  {isLoading ? 'Updating...' : 'Set New Password'}
                  {!isLoading && <ArrowRight className="h-4 w-4" />}
                </button>
              </form>
            ) : mode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="group relative">
                  <label htmlFor="email" className={labelClass}>Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-600 group-focus-within:text-violet-400 transition-colors" />
                    <input id="email" type="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />
                  </div>
                </div>
                {renderPasswordField('password', 'Password', password, setPassword, showPassword, () => setShowPassword((v) => !v), '••••••••', true)}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-400 py-3 text-sm font-bold text-zinc-950 transition-all hover:bg-violet-300 active:scale-[0.98] disabled:opacity-70"
                >
                  {isLoading ? 'Signing in...' : 'Sign In'}
                  {!isLoading && <ArrowRight className="h-4 w-4" />}
                </button>
                <p className="text-center text-sm text-zinc-500">
                  Don&apos;t have an account?{' '}
                  <span onClick={() => switchMode('signup')} className={linkClass}>Create one</span>
                </p>
              </form>
            ) : (
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="group relative">
                  <label className={labelClass}>Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-600 group-focus-within:text-violet-400 transition-colors" />
                    <input type="text" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} required className={inputClass} />
                  </div>
                </div>
                <div className="group relative">
                  <label className={labelClass}>Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-zinc-600 group-focus-within:text-violet-400 transition-colors" />
                    <input type="email" placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />
                  </div>
                </div>
                {renderPasswordField('signup-password', 'Password', password, setPassword, showPassword, () => setShowPassword((v) => !v), 'Min 6 characters')}
                {renderPasswordField('signup-confirm', 'Confirm Password', confirmPassword, setConfirmPassword, showConfirmPassword, () => setShowConfirmPassword((v) => !v), 'Repeat password')}
                {passwordError && <p className="ml-1 text-xs font-semibold text-red-400">{passwordError}</p>}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-400 py-3 text-sm font-bold text-zinc-950 transition-all hover:bg-violet-300 active:scale-[0.98] disabled:opacity-70"
                >
                  {isLoading ? 'Creating account...' : 'Create Account'}
                  {!isLoading && <ArrowRight className="h-4 w-4" />}
                </button>
                <p className="text-center text-sm text-zinc-500">
                  Already have an account?{' '}
                  <span onClick={() => switchMode('login')} className={linkClass}>Log In</span>
                </p>
              </form>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
