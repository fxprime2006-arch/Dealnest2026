import React, { useState } from 'react';
import { CouponItem } from '../types';
import { fmt } from '../utils';
import { CheckCircle2, Copy, Check, ExternalLink, ListChecks, Users, Info } from 'lucide-react';

interface CouponCardProps {
  coupon: CouponItem;
  onUseOffer: (platform: string, code?: string) => void;
  onToast: (msg: string) => void;
  demoMode?: boolean;
}

export const CouponCard: React.FC<CouponCardProps> = ({
  coupon,
  onUseOffer,
  onToast,
  demoMode = false,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!coupon.code) {
      onToast('No universal code is published. Open the official offer page and confirm eligibility at checkout.');
      return;
    }
    try {
      await navigator.clipboard.writeText(coupon.code);
      setCopied(true);
      onToast(`Copied ${coupon.code} to clipboard!`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onToast(`Code: ${coupon.code}`);
    }
  };

  const couponTitle = coupon.title.toLowerCase();
  const inferredAudience = coupon.audience || (
    couponTitle.includes('first') || couponTitle.includes('new order') ? 'new' :
      couponTitle.includes('hdfc') || couponTitle.includes('axis') || couponTitle.includes('bank') ? 'bank' :
        couponTitle.includes('star') || couponTitle.includes('membership') ? 'membership' : 'all'
  );
  const audienceLabel = inferredAudience === 'new'
    ? 'New customers'
    : inferredAudience === 'returning'
      ? 'Returning customers'
      : inferredAudience === 'bank'
        ? 'Eligible bank offer'
        : inferredAudience === 'membership'
          ? 'Membership required'
          : 'All eligible customers';
  const eligibilityNote = coupon.eligibilityNote || (
    inferredAudience === 'new'
      ? 'Usually limited to a first order or first successful payment.'
      : inferredAudience === 'bank'
        ? 'Requires the named bank/card or payment method; confirm the terms at checkout.'
        : inferredAudience === 'membership'
          ? 'Requires the partner membership or loyalty plan to be active.'
          : 'Eligibility and availability must be confirmed at checkout.'
  );
  const howToApply = coupon.howToApply || 'Open the partner link, add eligible items, apply the code at checkout, and verify the final payable total.';
  const sourceType = coupon.sourceType || 'official';
  const isUnofficial = sourceType === 'unofficial' || sourceType === 'user_submitted';

  return (
    <div className="border-2 border-dashed border-[var(--bd)] rounded-[20px] p-4 sm:p-5 bg-[var(--card)] shadow-[4px_4px_0_var(--bd)] flex flex-col justify-between transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0_var(--bd)]">
      <div>
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base text-[var(--ink)]">
              {coupon.platform}
            </span>
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold flex items-center gap-1 ${isUnofficial ? 'bg-amber-100 text-amber-800' : 'bg-[#12102b] text-[var(--lime)]'}`}>
              <CheckCircle2 className="w-3 h-3" />
              <span>{isUnofficial ? 'CHECK BEFORE USE' : 'AVAILABLE OFFER'}</span>
            </span>
          </div>

        </div>

        <div className="font-display font-extrabold text-xl sm:text-2xl text-[var(--ink)] tracking-tight my-1">
          {coupon.title}
        </div>

        <div className={`text-[10px] font-bold uppercase tracking-wide mb-2 ${isUnofficial ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-400'}`}>
          {isUnofficial ? 'Check availability before use' : 'Available offer — verify checkout eligibility'}
        </div>

        <div className="my-2.5">
          <div className="inline-flex items-center gap-2 font-mono font-extrabold text-base bg-[var(--lime)] text-[#12102b] border-2 border-[var(--bd)] py-1 px-3 rounded-lg shadow-[2px_2px_0_var(--bd)]">
            <span>{coupon.code || 'Offer code unavailable'}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[var(--mut)] mb-3">
          <span>Minimum order {coupon.minOrder ? fmt(coupon.minOrder) : 'Not published'}</span>
          <span>Validity {coupon.expires}</span>
          {coupon.discount && <span className="sm:col-span-2 font-bold text-[var(--ink)]">Savings: {coupon.discount}</span>}
        </div>
        <div className="space-y-1.5 rounded-xl bg-[var(--bg)] border border-[var(--bd)]/15 p-2.5 text-[11px] text-[var(--mut)]">
          <div className="flex items-start gap-1.5 font-bold text-[var(--ink)]">
            <Users className="w-3.5 h-3.5 mt-0.5 text-[var(--pri)]" />
            <span>{audienceLabel}</span>
          </div>
          <div className="flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>{eligibilityNote}</span>
          </div>
          <div className="flex items-start gap-1.5">
            <ListChecks className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-emerald-600" />
            <span>{howToApply}</span>
          </div>
          {coupon.terms && (
            <div className="flex items-start gap-1.5 border-t border-[var(--bd)]/10 pt-1.5">
              <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span><strong className="text-[var(--ink)]">Terms:</strong> {coupon.terms}</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-[var(--bd)]/20">
        <button
          type="button"
          onClick={handleCopy}
          disabled={!coupon.code}
          className="dn-btn dn-btn-secondary text-xs py-2 px-3 flex-1 flex items-center justify-center gap-1.5"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{coupon.code ? (copied ? 'COPIED!' : 'COPY CODE') : 'NO CODE'}</span>
        </button>

        {coupon.sourceUrl ? (
          <a
            href={coupon.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="dn-btn text-xs py-2 px-3 flex-1 flex items-center justify-center gap-1.5"
          >
            <span>VIEW OFFER</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <button
            type="button"
            onClick={() => onUseOffer(coupon.platform, coupon.code || undefined)}
            className="dn-btn text-xs py-2 px-3 flex-1 flex items-center justify-center gap-1.5"
          >
            <span>USE OFFER</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
