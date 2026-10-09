import React, { useState } from 'react';
import { Shield, KeyRound, Lock, Eye, EyeOff, AlertTriangle, ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

interface AdminLoginViewProps {
  brandName: string;
  onLoginSuccess: (token: string, needsChange: boolean) => void;
  onBackToSite: () => void;
}

export const AdminLoginView: React.FC<AdminLoginViewProps> = ({
  brandName,
  onLoginSuccess,
  onBackToSite,
}) => {
  const [accessCode, setAccessCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = accessCode.trim();
    if (!cleanCode) {
      setErrorMessage('Please enter the Admin Access Code.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      let response: Response | null = null;
      try {
        response = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessCode: cleanCode }),
        });
      } catch (firstErr) {
        // Automatic retry once after 350ms
        await new Promise(r => setTimeout(r, 350));
        try {
          response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessCode: cleanCode }),
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
          setErrorMessage(data?.error || 'Invalid admin credentials.');
          if (data?.retryAfterSeconds) {
            setRetryAfter(data.retryAfterSeconds);
          }
          return;
        }

        // Success
        onLoginSuccess(data.token, data.needsChange);
        return;
      }

      setErrorMessage('Unable to connect to authorization server. Please check your network and try again.');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error connecting to authorization server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Top Back Navigation */}
        <div className="mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={onBackToSite}
            className="inline-flex items-center gap-2 text-xs font-bold text-[var(--mut)] hover:text-[var(--ink)] cursor-pointer transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to {brandName}</span>
          </button>
          <span className="text-[11px] font-mono uppercase tracking-wider text-rose-500 font-bold bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
            Restricted Zone
          </span>
        </div>

        {/* Card */}
        <div className="bg-[#100e23] border-2 border-[#2b2754] text-white rounded-[28px] p-6 sm:p-8 shadow-[8px_8px_0_#5b3df5] relative overflow-hidden">
          {/* Subtle accent glow */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-48 h-48 bg-[#5b3df5]/20 rounded-full blur-2xl pointer-events-none" />

          {/* Header */}
          <div className="text-center mb-6 relative">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#5b3df5] to-[#795cf8] border-2 border-white/20 mx-auto flex items-center justify-center mb-4 shadow-[0_8px_20px_rgba(91,61,245,0.4)]">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold font-display tracking-tight text-white">
              Administrator Portal
            </h1>
            <p className="text-xs text-white/60 mt-1 max-w-xs mx-auto leading-relaxed">
              Authenticate with your Admin Access Code to manage platform secret codes, system sections, and catalog controls.
            </p>
          </div>

          {/* Error / Rate Limit Alert */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/15 border-2 border-rose-500/40 text-rose-200 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Access Denied</span>
                <p className="text-[11px] text-rose-300 mt-0.5 leading-relaxed">{errorMessage}</p>
                {retryAfter && (
                  <p className="text-[10px] text-rose-400 mt-1 font-mono">
                    Cooldown active: retry allowed in {retryAfter}s
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="adminCodeInput"
                className="block text-xs font-bold text-white/80 mb-1.5 uppercase tracking-wider"
              >
                Admin Access Code
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-white/40">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  id="adminCodeInput"
                  type={showCode ? 'text' : 'password'}
                  value={accessCode}
                  onChange={e => {
                    setAccessCode(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Enter access code"
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full pl-10 pr-11 py-3 bg-[#181533] border-2 border-[#37316a] focus:border-[#5b3df5] focus:outline-none rounded-xl text-sm font-mono text-white placeholder-white/30 transition-all"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-white/40 hover:text-white/80 cursor-pointer"
                  aria-label={showCode ? 'Hide code' : 'Show code'}
                >
                  {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-[#ccff00] hover:bg-[#b8e600] active:scale-[0.99] text-[#12102b] font-extrabold text-sm rounded-xl border-2 border-[#12102b] shadow-[3px_3px_0_#12102b] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Enter Admin Dashboard</span>
                </>
              )}
            </button>
          </form>

          {/* Security footnote */}
          <div className="mt-6 pt-5 border-t border-white/10 text-center">
            <p className="text-[11px] text-white/40 flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#ccff00]" />
              <span>Protected by brute-force rate limiting & SHA-256 salted hashing</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
