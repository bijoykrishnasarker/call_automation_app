'use client';

import React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Bot, Mail } from 'lucide-react';

export default function ConfirmEmailPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f0] px-4">
      <div className="w-full max-w-[400px] bg-white rounded-xl shadow-sm border border-slate-200/80 p-8 text-center">
        {/* Branding */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-10 h-10 bg-lime-500 rounded-lg flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-slate-800 tracking-tight">
            LeadOps<span className="text-lime-600">AI</span>
          </span>
        </div>

        <div className="w-14 h-14 rounded-full bg-lime-100 flex items-center justify-center mx-auto mb-6">
          <Mail className="w-7 h-7 text-lime-600" />
        </div>

        <h1 className="text-lg font-bold text-slate-800 mb-2">Confirm your email</h1>
        <p className="text-slate-600 text-sm mb-6">
          We&apos;ve sent a confirmation link to
          {email ? (
            <strong className="block mt-1 text-slate-800">{email}</strong>
          ) : (
            ' your email address'
          )}.
          Click the link in that email to activate your account.
        </p>

        <p className="text-slate-500 text-sm mb-6">
          Didn&apos;t receive the email? Check your spam folder or try signing up again.
        </p>

        <Link
          href="/login"
          className="inline-block w-full py-2.5 bg-lime-500 hover:bg-lime-600 text-white font-medium rounded-lg transition-colors active:scale-[0.99] text-center"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}
