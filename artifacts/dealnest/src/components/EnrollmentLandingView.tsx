import React, { useState } from 'react';
import { 
  Key, 
  ShieldCheck, 
  Lock, 
  ArrowRight, 
  AlertCircle, 
  Loader2, 
  Sparkles, 
  ShoppingBag, 
  UtensilsCrossed, 
  Zap, 
  Bot,
  User,
  ShieldAlert
} from 'lucide-react';
import { EnrolledUser } from '../types';
import { PLATFORM_GROUPS } from '../platformDirectory';

interface EnrollmentLandingViewProps {
  brandName: string;
  onEnrollSuccess: (token: string, user: EnrolledUser) => void;
  onOpenAdminLogin: () => void;
}

export const EnrollmentLandingView: React.FC<EnrollmentLandingViewProps> = ({
  brandName,
  onEnrollSuccess,
  onOpenAdminLogin,
}) => {
  const [code, setCode] = useState('');
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '');
    if (!cleanCode) {
      setErrorMessage('Please enter your secret access code to continue.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    setRetryAfter(null);

    try {
      let response: Response | null = null;
      try {
        response = await fetch('/api/enroll/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: cleanCode,
            userName: userName.trim() || 'Enrolled Member',
          }),
        });
      } catch (firstErr) {
        // Automatic retry once after 350ms in case of temporary iframe/network hiccup
        await new Promise(r => setTimeout(r, 350));
        try {
          response = await fetch('/api/enroll/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code: cleanCode,
              userName: userName.trim() || 'Enrolled Member',
            }),
          });
        } catch {
          // Will handle network fallback below
        }
      }

      if (response) {
        let data: any = null;
        try {
          const text = await response.text();
          data = text ? JSON.parse(text) : {};
        } catch {
          data = {};
        }

        if (!response.ok || !data?.success) {
          setErrorMessage(data?.error || `Verification failed (${response.status}). Please check your code.`);
          if (data?.retryAfterSeconds) {
            setRetryAfter(data.retryAfterSeconds);
          }
          return;
        }

        // Server verification successful
        onEnrollSuccess(data.token, data.user);
        return;
      }

      setErrorMessage('Unable to connect to authorization server. Please check your network and try again.');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col justify-between selection:bg-[var(--lime)] selection:text-[#12102b]">
      {/* Top Navigation Bar */}
      <header className="px-4 sm:px-8 py-4 border-b-2 border-[var(--bd)] bg-[var(--card)] flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[var(--lime)] border-2 border-[var(--bd)] flex items-center justify-center shadow-[2px_2px_0_var(--bd)]">
            <svg width="22" height="22" viewBox="0 0 32 32">
              <path d="M7 20c0-6 4-10 9-10s9 4 9 10" fill="none" stroke="#5b3df5" strokeWidth="4" strokeLinecap="round" />
              <circle cx="16" cy="20" r="4" fill="#12102b" />
            </svg>
          </div>
          <div>
            <span className="font-display font-extrabold text-xl tracking-tight text-[var(--ink)] block leading-none">
              {brandName}
            </span>
            <span className="text-[10px] text-[var(--mut)] font-bold tracking-wide uppercase">
              Private Access Portal
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenAdminLogin}
          className="text-xs font-bold text-[var(--pri)] hover:text-[#4125db] flex items-center gap-1.5 py-1.5 px-3 rounded-xl border border-[var(--bd)] hover:bg-[var(--pri2)] cursor-pointer transition-colors"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Administrator Access</span>
        </button>
      </header>

      {/* Main Hero & Code Entry Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 max-w-5xl mx-auto w-full">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column: Enrollment Value & Platform Teaser */}
          <div className="lg:col-span-6 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--lime)] text-[#12102b] text-xs font-extrabold border-2 border-[var(--bd)] shadow-[2px_2px_0_var(--bd)]">
              <Sparkles className="w-4 h-4" />
              <span>Invitation-Only Deal Intelligence</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-display tracking-tight text-[var(--ink)] leading-[1.1]">
              Unlock Cross-Platform Deal Intelligence
            </h1>

            <p className="text-sm sm:text-base text-[var(--mut)] leading-relaxed max-w-lg mx-auto lg:mx-0">
              DealNest compares connected listings and partner checkout coverage across {PLATFORM_GROUPS.length} consumer categories, with coupons, fees, delivery context, and price drops clearly labelled.
            </p>

            {/* Feature highlights grid */}
            <div className="grid grid-cols-2 gap-3 pt-2 max-w-md mx-auto lg:mx-0 text-left">
              <div className="p-3 rounded-2xl border-2 border-[var(--bd)] bg-[var(--card)] shadow-[2px_2px_0_var(--bd)] flex items-start gap-2.5">
                <ShoppingBag className="w-5 h-5 text-pink-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-extrabold text-[var(--ink)]">14 Consumer Categories</h4>
                  <p className="text-[11px] text-[var(--mut)]">Retail, food, travel, services</p>
                </div>
              </div>

              <div className="p-3 rounded-2xl border-2 border-[var(--bd)] bg-[var(--card)] shadow-[2px_2px_0_var(--bd)] flex items-start gap-2.5">
                <UtensilsCrossed className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-extrabold text-[var(--ink)]">Food & Dining</h4>
                  <p className="text-[11px] text-[var(--mut)]">Swiggy, Zomato, EatClub</p>
                </div>
              </div>

              <div className="p-3 rounded-2xl border-2 border-[var(--bd)] bg-[var(--card)] shadow-[2px_2px_0_var(--bd)] flex items-start gap-2.5">
                <Zap className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-extrabold text-[var(--ink)]">Coupons & Offers</h4>
                  <p className="text-[11px] text-[var(--mut)]">Verified codes when available</p>
                </div>
              </div>

              <div className="p-3 rounded-2xl border-2 border-[var(--bd)] bg-[var(--card)] shadow-[2px_2px_0_var(--bd)] flex items-start gap-2.5">
                <Bot className="w-5 h-5 text-[var(--pri)] flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-extrabold text-[var(--ink)]">DealNest Intelligence</h4>
                  <p className="text-[11px] text-[var(--mut)]">Answers across every category</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Enter Secret Code Form */}
          <div className="lg:col-span-6 w-full max-w-md mx-auto">
            <div className="dn-card border-2 border-[var(--bd)] bg-[var(--card)] shadow-[8px_8px_0_var(--pri)] p-6 sm:p-8 rounded-[28px] relative">
              
              {/* Top Banner required by User Brief */}
              <div className="mb-6 p-3.5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-extrabold text-[12px] leading-tight">
                    Access Code Required
                  </p>
                  <p className="text-[11px] mt-0.5 text-[var(--mut)] leading-relaxed">
                    You need an access code from the administrator to continue.
                  </p>
                </div>
              </div>

              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-[var(--lime)] border-2 border-[var(--bd)] mx-auto flex items-center justify-center mb-3 shadow-[3px_3px_0_var(--bd)]">
                  <Key className="w-7 h-7 text-[#12102b]" />
                </div>
                <h2 className="text-2xl font-extrabold text-[var(--ink)] font-display tracking-tight">
                  Enter Secret Access Code
                </h2>
                <p className="text-xs text-[var(--mut)] mt-1">
                  Enter the unique access code given to you by the administrator.
                </p>
              </div>

              {/* Error Message Alert */}
              {errorMessage && (
                <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/15 border-2 border-rose-500/40 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Enrollment Failed</span>
                    <p className="text-[11px] mt-0.5 leading-relaxed">{errorMessage}</p>
                    {retryAfter && (
                      <p className="text-[10px] text-rose-600 font-mono mt-1">
                        Please wait {retryAfter}s before retrying.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleEnroll} className="space-y-4">
                <div>
                  <label
                    htmlFor="secretCodeInput"
                    className="block text-xs font-bold text-[var(--ink)] mb-1.5 uppercase tracking-wider"
                  >
                    Secret Access Code
                  </label>
                  <input
                    id="secretCodeInput"
                    type="text"
                    value={code}
                    onChange={e => {
                      setCode(e.target.value.toUpperCase());
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="e.g. NEST-ABCD-7K9M"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={loading}
                    className="dn-input w-full py-3 px-4 text-base font-mono font-bold tracking-wider uppercase text-center focus:ring-2 focus:ring-[var(--pri)]"
                    autoFocus
                  />
                </div>

                <div>
                  <label
                    htmlFor="userNameInput"
                    className="block text-xs font-bold text-[var(--mut)] mb-1.5 uppercase tracking-wider flex items-center justify-between"
                  >
                    <span>Your Name / Handle</span>
                    <span className="text-[10px] font-normal lowercase">(optional)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--mut)]">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      id="userNameInput"
                      type="text"
                      value={userName}
                      onChange={e => setUserName(e.target.value)}
                      placeholder="e.g. Alex Sharma"
                      disabled={loading}
                      className="dn-input w-full py-2.5 pl-10 pr-3 text-xs"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="dn-btn w-full py-3.5 text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Code on Server...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue / Enroll</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-[var(--bd)]/40 text-center">
                <p className="text-[11px] text-[var(--mut)] flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Secure server validation with rate-limiting protection</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-4 sm:px-8 py-6 border-t-2 border-[var(--bd)] bg-[var(--card)] text-xs text-[var(--mut)] text-center">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© 2026 DealNest. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <button
              type="button"
              onClick={onOpenAdminLogin}
              className="text-[var(--pri)] hover:underline cursor-pointer"
            >
              Administrator Login
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
