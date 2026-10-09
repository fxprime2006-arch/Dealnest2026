import React, { useState } from 'react';
import { ExternalLink, X, Copy, Check, Sliders, ShieldCheck, Tag } from 'lucide-react';
import { PLATFORM_COLORS } from '../data';
import { fmt, isSafeOutboundUrl } from '../utils';

interface OutboundModalProps {
  platform: string;
  url: string | null;
  itemName?: string;
  couponCode?: string | null;
  currentPrice?: number | null;
  brandName: string;
  onClose: () => void;
  onAdjustPrice?: (newPrice: number) => void;
}

export const OutboundModal: React.FC<OutboundModalProps> = ({
  platform,
  url,
  itemName,
  couponCode,
  currentPrice,
  brandName,
  onClose,
  onAdjustPrice,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCoupon, setCopiedCoupon] = useState(false);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [adjustedPriceInput, setAdjustedPriceInput] = useState<string>(currentPrice ? String(currentPrice) : '');
  const [adjustedSaved, setAdjustedSaved] = useState(false);

  // Guarantee a valid fallback working URL
  const fallbackUrl =
    (platform === 'Amazon'
      ? `https://www.amazon.in/s?k=${encodeURIComponent(itemName || 'iPhone')}&ref=nb_sb_noss`
      : platform === 'Flipkart'
      ? `https://www.flipkart.com/search?q=${encodeURIComponent(itemName || 'iPhone')}`
      : platform === 'Swiggy'
      ? `https://www.swiggy.com/search?query=${encodeURIComponent(itemName || 'food')}`
      : platform === 'Zomato'
      ? `https://www.zomato.com/india`
      : platform === 'EatClub'
      ? `https://eatclub.com/search?q=${encodeURIComponent(itemName || 'food')}`
      : platform === "Domino's"
      ? `https://pizzaonline.dominos.co.in/`
      : platform === 'Magicpin'
      ? `https://magicpin.in/search?q=${encodeURIComponent(itemName || 'food')}`
      : platform === 'Zepto'
      ? `https://www.zepto.com/search?query=${encodeURIComponent(itemName || 'grocery')}`
      : platform === 'Blinkit'
      ? `https://blinkit.com/s/?q=${encodeURIComponent(itemName || 'grocery')}`
      : `https://www.google.com/search?q=${encodeURIComponent(`${platform} ${itemName || ''}`)}`);
  const targetUrl = url && isSafeOutboundUrl(url, platform) ? url : fallbackUrl;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCoupon = () => {
    if (!couponCode) return;
    const clean = couponCode.match(/^([A-Z0-9_-]+)/)?.[1] || couponCode;
    navigator.clipboard.writeText(clean);
    setCopiedCoupon(true);
    setTimeout(() => setCopiedCoupon(false), 2000);
  };

  const handleSavePriceAdjustment = () => {
    const p = parseFloat(adjustedPriceInput);
    if (!isNaN(p) && p > 0 && onAdjustPrice) {
      onAdjustPrice(p);
      setAdjustedSaved(true);
      setTimeout(() => setAdjustedSaved(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-[#12102b]/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-[var(--card)] border-2 border-[var(--bd)] rounded-[24px] p-6 max-w-md w-full shadow-[8px_8px_0_var(--pri)] relative max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg border border-[var(--bd)] text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--bg)] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-3">
          <span
            className="w-10 h-10 rounded-full border-2 border-[var(--bd)] flex items-center justify-center font-extrabold text-base text-white shadow-[2px_2px_0_var(--bd)]"
            style={{ backgroundColor: PLATFORM_COLORS[platform] || '#473fa0' }}
          >
            {platform.charAt(0)}
          </span>
          <div>
            <h2 className="text-xl font-extrabold text-[var(--ink)] font-display">
              Continue to {platform}
            </h2>
            <p className="text-xs text-[var(--mut)] flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Official Partner Store Checkout</span>
            </p>
          </div>
        </div>

        {itemName && (
          <div className="bg-[var(--bg)] p-3 rounded-xl border border-[var(--bd)] mb-3">
            <span className="text-[11px] text-[var(--mut)] font-bold block uppercase tracking-wider">
              Product & Deal Match:
            </span>
            <span className="font-extrabold text-sm text-[var(--ink)] font-display">
              {itemName}
            </span>
          </div>
        )}

        {couponCode && (
          <div className="bg-[var(--lime)] text-[#12102b] p-3 rounded-xl border border-[var(--bd)] mb-3 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <span className="text-xs font-bold block">Verified Promo / Bank Offer:</span>
              <span className="text-xs font-semibold truncate block mt-0.5">{couponCode}</span>
            </div>
            <button
              type="button"
              onClick={handleCopyCoupon}
              className="text-xs font-bold bg-[#12102b] text-white px-2.5 py-1 rounded-lg border border-[var(--bd)] flex items-center gap-1 flex-shrink-0 cursor-pointer"
            >
              {copiedCoupon ? <Check className="w-3 h-3 text-[var(--lime)]" /> : <Copy className="w-3 h-3" />}
              <span>{copiedCoupon ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        )}

        {currentPrice != null && (
          <div className="rounded-xl border-2 border-[var(--bd)] bg-[var(--bg)] p-3 mb-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-[var(--mut)]">DealNest listed / landed snapshot</span>
              <strong className="text-base text-[var(--ink)]">{fmt(currentPrice)}</strong>
            </div>
            <div className="flex items-center justify-between gap-3 text-[10px] mt-1.5 text-[var(--mut)]">
              <span>Delivery, payment fees, stock and eligibility</span>
              <span className="font-bold">Confirm at checkout</span>
            </div>
            <p className="text-[10px] text-[var(--mut)] mt-2 leading-relaxed">This is the current DealNest comparison value supplied for the offer. The official checkout total is authoritative; no unknown fee is added here.</p>
          </div>
        )}

        {/* Adjust Price Tool (Addresses user's prompt: "if customer was facing link issue, adjust price") */}
        <div className="p-3 rounded-xl border border-[var(--bd)] bg-[var(--bg)] mb-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--ink)] flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-[var(--pri)]" />
              <span>Found a different price on {platform}?</span>
            </span>
            <button
              type="button"
              onClick={() => setIsAdjusting(!isAdjusting)}
              className="text-[11px] font-bold text-[var(--pri)] hover:underline cursor-pointer"
            >
              {isAdjusting ? 'Close' : 'Adjust Price'}
            </button>
          </div>

          {isAdjusting && (
            <div className="mt-2 pt-2 border-t border-[var(--bd)]/20 space-y-2">
              <p className="text-[11px] text-[var(--mut)]">
                Enter the current listed price you see on {platform}'s site to recalculate your DealNest comparison:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={adjustedPriceInput}
                  onChange={e => setAdjustedPriceInput(e.target.value)}
                  placeholder="e.g. 81999"
                  className="dn-input text-xs py-1.5 px-2.5 w-32 font-bold"
                />
                <button
                  type="button"
                  onClick={handleSavePriceAdjustment}
                  className="dn-btn dn-btn-lime text-xs py-1.5 px-3 font-bold cursor-pointer"
                >
                  Save & Update
                </button>
                {adjustedSaved && (
                  <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                    <Check className="w-3 h-3" /> Updated!
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-[var(--mut)] mb-4 leading-relaxed">
          Prices and bank discounts must be confirmed at {platform}'s checkout. © 2026 DealNest. All rights reserved.
        </p>

        <div className="space-y-2">
          <a
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="dn-btn text-sm py-2.5 w-full font-bold inline-flex items-center justify-center gap-2"
          >
            <span>Proceed to {platform} (Official Website)</span>
            <ExternalLink className="w-4 h-4" />
          </a>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="dn-btn dn-btn-secondary text-xs py-2 flex-1 flex items-center justify-center gap-1 font-semibold"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Link Copied!' : 'Copy Direct Search Link'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="dn-btn dn-btn-secondary text-xs py-2 px-4"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
