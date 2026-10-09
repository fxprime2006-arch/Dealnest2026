import React, { useState } from 'react';
import { AlertTriangle, Check, Loader2, Shield } from 'lucide-react';

export interface DisclaimerPayload {
  required: boolean;
  version: number;
  text: string;
  updatedAt: number;
}

interface GlobalDisclaimerModalProps {
  token: string;
  disclaimer: DisclaimerPayload;
  onAccepted: () => void;
  onToast: (message: string) => void;
}

export const GlobalDisclaimerModal: React.FC<GlobalDisclaimerModalProps> = ({ token, disclaimer, onAccepted, onToast }) => {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    if (!checked || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/disclaimer/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ version: disclaimer.version }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || 'The disclaimer changed. Please review the latest version.');
        return;
      }
      onAccepted();
      onToast('Disclaimer accepted. You can continue using the platform.');
    } catch {
      setError('Network error. The platform remains locked until acceptance is recorded.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#080713]/90 backdrop-blur-md flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="global-disclaimer-title">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-hidden rounded-3xl bg-white text-[#12102b] border-4 border-[#12102b] shadow-[10px_10px_0_#ccff00]">
        <div className="p-6 sm:p-8 border-b-2 border-[#12102b]/10 flex items-start gap-4">
          <div className="w-12 h-12 shrink-0 rounded-2xl bg-[#ccff00] border-2 border-[#12102b] flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#5b3df5]">Updated platform notice · v{disclaimer.version}</p>
            <h2 id="global-disclaimer-title" className="text-2xl sm:text-3xl font-black tracking-tight mt-1">Please review the latest disclaimer</h2>
            <p className="text-sm text-[#12102b]/60 mt-2">This updated notice applies globally. Your platform access stays locked until you acknowledge the exact text below.</p>
          </div>
        </div>
        <div className="max-h-[42vh] overflow-y-auto p-6 sm:p-8 bg-[#f7f6ff]">
          <div className="rounded-2xl border-2 border-[#12102b]/15 bg-white p-5 text-sm leading-7 whitespace-pre-wrap select-text">
            {disclaimer.text}
          </div>
          <p className="text-[11px] text-[#12102b]/50 mt-3">Published {new Date(disclaimer.updatedAt).toLocaleString()}</p>
        </div>
        <div className="p-6 sm:p-8 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} className="mt-1 w-5 h-5 accent-[#5b3df5]" />
            <span className="text-sm font-bold leading-6">I have read and understood this disclaimer and want to continue using the free platform.</span>
          </label>
          {error && <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 p-3 text-xs font-bold"><AlertTriangle className="w-4 h-4 shrink-0" />{error}</div>}
          <button type="button" disabled={!checked || saving} onClick={accept} className="w-full rounded-2xl bg-[#5b3df5] hover:bg-[#4b2fe2] text-white font-black py-3.5 px-5 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
            Accept and unlock the platform
          </button>
        </div>
      </div>
    </div>
  );
};
