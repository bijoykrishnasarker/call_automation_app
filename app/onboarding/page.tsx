'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Bot,
  Mail,
  Briefcase,
  GitBranch,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';

// ---------- helpers ----------

function isValidEmail(email: string): boolean {
  // RFC-5322-ish: must have one @ with text on both sides and a dot-separated TLD
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

// ---------- component ----------

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isReady } = useAuth();

  // form fields
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState(user?.email ?? '');

  // step: 1 = details form, 2 = confirmation screen
  const [step, setStep] = useState<1 | 2>(1);

  // validation
  const [emailTouched, setEmailTouched] = useState(false);
  const emailError =
    emailTouched && email.trim() && !isValidEmail(email)
      ? 'Please enter a valid email address (e.g. you@example.com)'
      : '';

  // submission
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  /* ---- step navigation ---- */

  const canProceed = businessName.trim().length > 0 && isValidEmail(email);

  const goToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canProceed) return;
    setSubmitError('');
    setStep(2);
  };

  const goBack = () => setStep(1);

  /* ---- final submit ---- */

  const handleConfirm = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    setSubmitError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('No active session. Please log in again.');

      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: businessName.trim(),
          email: email.trim(),
          accessToken: session.access_token,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to complete setup. Please try again.');

      window.location.href = '/';
    } catch (err: any) {
      console.error('Onboarding error:', err);
      setSubmitError(err.message || 'Failed to complete setup. Please try again.');
      setIsLoading(false);
    }
  }, [user, businessName, email]);

  /* ---- guards ---- */

  if (!isReady) return null;
  if (!user) {
    router.replace('/login');
    return null;
  }

  /* ---- render ---- */

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 overflow-hidden relative">
      {/* Background blobs */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-lime-500/10 rounded-full blur-[120px] -mr-64 -mt-64 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-lime-500/5 rounded-full blur-[120px] -ml-64 -mb-64 pointer-events-none" />

      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden relative z-10">

        {/* ── Header ── */}
        <div className="bg-slate-900 p-8 text-white relative">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-lime-500 rounded-xl flex items-center justify-center shadow-lg shadow-lime-500/20">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight">LeadOpsAI</span>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <span className={step === 1 ? 'text-lime-400' : 'text-slate-500'}>01 Details</span>
              <span className="text-slate-600">—</span>
              <span className={step === 2 ? 'text-lime-400' : 'text-slate-500'}>02 Confirm</span>
            </div>
          </div>

          {step === 1 ? (
            <>
              <h1 className="text-3xl font-black mb-2">Setup Your Business</h1>
              <p className="text-slate-400">Let's get your CRM ready for your first leads.</p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-black mb-2">Confirm &amp; Launch</h1>
              <p className="text-slate-400">Review your details before we build your workspace.</p>
            </>
          )}
        </div>

        <div className="p-8">

          {/* ══════════════════════════════
               STEP 1 — Details Form
              ══════════════════════════════ */}
          {step === 1 && (
            <form onSubmit={goToConfirm} className="space-y-5" noValidate>

              {/* Business Name */}
              <div className="space-y-1.5">
                <label htmlFor="businessName" className="text-sm font-bold text-slate-700 ml-1">
                  Business Name <span className="text-red-400">*</span>
                </label>
                <div className="relative group">
                  <Building2
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-lime-500 transition-colors"
                    size={20}
                  />
                  <input
                    id="businessName"
                    type="text"
                    placeholder="e.g. Acme Roofing Solutions"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required
                    autoFocus
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-lime-500/10 focus:border-lime-500 transition-all font-medium text-base"
                  />
                </div>
              </div>

              {/* Business Email */}
              <div className="space-y-1.5">
                <label htmlFor="bizEmail" className="text-sm font-bold text-slate-700 ml-1">
                  Business Email <span className="text-red-400">*</span>
                </label>
                <div className="relative group">
                  <Mail
                    className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${
                      emailError ? 'text-red-400' : 'text-slate-400 group-focus-within:text-lime-500'
                    }`}
                    size={20}
                  />
                  <input
                    id="bizEmail"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setEmailTouched(true)}
                    required
                    className={`w-full pl-12 pr-4 py-4 bg-slate-50 border rounded-2xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-4 transition-all font-medium text-base ${
                      emailError
                        ? 'border-red-300 focus:ring-red-500/10 focus:border-red-400'
                        : 'border-slate-200 focus:ring-lime-500/10 focus:border-lime-500'
                    }`}
                  />
                </div>
                {emailError && (
                  <p className="text-xs text-red-500 ml-1 flex items-center gap-1.5 mt-1">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400" />
                    {emailError}
                  </p>
                )}
                {!emailError && email && isValidEmail(email) && (
                  <p className="text-xs text-lime-600 ml-1 flex items-center gap-1.5 mt-1">
                    <CheckCircle2 size={12} />
                    Looks good!
                  </p>
                )}
              </div>

              {/* What we'll set up */}
              <div className="space-y-3 pt-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                  What we'll set up for you
                </p>
                <FeatureRow
                  icon={<Briefcase size={14} />}
                  title="Workspace Initialization"
                  description="A private environment for your business data and AI settings."
                />
                <FeatureRow
                  icon={<GitBranch size={14} />}
                  title="Default Pipeline"
                  description="A standard sales pipeline to track your leads immediately."
                />
              </div>

              <button
                type="submit"
                disabled={!canProceed}
                className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-xl shadow-slate-900/10 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-base mt-2"
              >
                Review &amp; Confirm
                <ArrowRight size={18} />
              </button>
            </form>
          )}

          {/* ══════════════════════════════
               STEP 2 — Confirmation
              ══════════════════════════════ */}
          {step === 2 && (
            <div className="space-y-6">

              {/* Summary card */}
              <div className="rounded-2xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Your workspace details</p>
                </div>

                <div className="divide-y divide-slate-100">
                  <SummaryRow
                    icon={<Building2 size={16} className="text-slate-500" />}
                    label="Business Name"
                    value={businessName.trim()}
                  />
                  <SummaryRow
                    icon={<Mail size={16} className="text-slate-500" />}
                    label="Business Email"
                    value={email.trim()}
                  />
                </div>
              </div>

              {/* What will be created */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                  Will be created
                </p>
                <FeatureRow
                  icon={<Briefcase size={14} />}
                  title="Private Workspace"
                  description="Isolated environment scoped to your business."
                />
                <FeatureRow
                  icon={<GitBranch size={14} />}
                  title="Main Sales Pipeline"
                  description="5 stages: New Lead → Contacted → Qualified → Proposal Sent → Closed Won."
                />
                <FeatureRow
                  icon={<Sparkles size={14} />}
                  title="AI Receptionist Ready"
                  description="Configure your AI agent right after setup."
                />
              </div>

              {/* Error */}
              {submitError && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm flex gap-3 items-center">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                  {submitError}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={isLoading}
                  className="flex-1 py-4 border-2 border-slate-200 hover:border-slate-300 text-slate-700 font-bold rounded-2xl transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
                >
                  <ArrowLeft size={18} />
                  Edit Details
                </button>

                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isLoading}
                  className="flex-[2] py-4 bg-lime-500 hover:bg-lime-400 text-white font-bold rounded-2xl shadow-xl shadow-lime-500/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 text-base"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Building…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      Confirm &amp; Launch
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

/* ── Small reusable sub-components ── */

function FeatureRow({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
      <div className="mt-0.5 w-6 h-6 rounded-full bg-lime-500/15 flex items-center justify-center text-lime-600 shrink-0">
        {icon}
      </div>
      <div>
        <h4 className="text-sm font-bold text-slate-800">{title}</h4>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <p className="text-sm font-bold text-slate-800 truncate">{value}</p>
      </div>
    </div>
  );
}
