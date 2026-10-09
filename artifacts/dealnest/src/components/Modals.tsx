import React, { useState } from 'react';
import { Item, PriceAlert } from '../types';
import { fmt, scoreOffers } from '../utils';
import { X, Bell, User, ExternalLink, ShieldCheck, Mail, Send, Check } from 'lucide-react';

interface PriceAlertModalProps {
  item: Item;
  onClose: () => void;
  onSaveAlert: (threshold: number) => void;
}

export const PriceAlertModal: React.FC<PriceAlertModalProps> = ({
  item,
  onClose,
  onSaveAlert,
}) => {
  const scored = scoreOffers(item);
  const lowestTotal = Math.min(...scored.filter(o => !o.na).map(o => o.t ?? 9e9));
  const suggestedPrice = Math.round(lowestTotal * 0.92);
  const [threshold, setThreshold] = useState<number>(suggestedPrice);

  return (
    <div
      className="fixed inset-0 bg-[#12102b]/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-[var(--card)] border-2 border-[var(--bd)] rounded-[24px] p-6 max-w-md w-full shadow-[8px_8px_0_var(--pri)] relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg border border-[var(--bd)] text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--bg)] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 mb-3">
          <Bell className="w-5 h-5 text-[var(--pri)]" />
          <h2 className="text-xl font-extrabold text-[var(--ink)] font-display">
            Set Price Drop Alert
          </h2>
        </div>

        <p className="text-xs text-[var(--mut)] mb-4 leading-relaxed">
          We’ll continuously monitor partner prices for <strong className="text-[var(--ink)]">{item.name}</strong> and notify you the moment it drops below your target.
        </p>

        <div className="bg-[var(--bg)] p-3 rounded-xl border border-[var(--bd)] mb-4 flex items-center justify-between text-xs">
          <span className="font-semibold text-[var(--mut)]">Current Lowest Price:</span>
          <span className="font-extrabold text-sm text-emerald-600 font-display">
            {fmt(lowestTotal)}
          </span>
        </div>

        <div className="space-y-2 mb-5">
          <label className="block text-xs font-bold text-[var(--ink)]">
            Alert me when price drops below:
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-sm font-bold text-[var(--mut)]">₹</span>
            <input
              type="number"
              value={threshold}
              onChange={e => setThreshold(Number(e.target.value))}
              className="dn-input w-full pl-7 font-bold text-base"
              min="1"
            />
          </div>
          <div className="flex gap-2 pt-1">
            {[-5, -10, -15].map(pct => {
              const val = Math.round(lowestTotal * (1 + pct / 100));
              return (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setThreshold(val)}
                  className="dn-chip text-[11px] py-0.5 px-2 flex-1"
                >
                  {pct}% ({fmt(val)})
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="dn-btn dn-btn-secondary text-xs py-2.5 flex-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSaveAlert(threshold);
              onClose();
            }}
            className="dn-btn text-xs py-2.5 flex-1 font-bold"
          >
            CREATE ALERT
          </button>
        </div>
      </div>
    </div>
  );
};

interface AuthModalProps {
  currentUser: string | null;
  onClose: () => void;
  onLogin: (name: string) => void;
  onLogout: () => void;
  onOpenDashboard: () => void;
  onOpenAdmin: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  currentUser,
  onClose,
  onLogin,
  onLogout,
  onOpenDashboard,
  onOpenAdmin,
}) => {
  const [identifier, setIdentifier] = useState('');

  if (currentUser) {
    return (
      <div
        className="fixed inset-0 bg-[#12102b]/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
        onClick={onClose}
      >
        <div
          className="bg-[var(--card)] border-2 border-[var(--bd)] rounded-[24px] p-6 max-w-sm w-full shadow-[8px_8px_0_var(--pri)] relative"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg border border-[var(--bd)] text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--bg)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="text-center mb-5">
            <div className="w-12 h-12 rounded-2xl bg-[var(--lime)] border-2 border-[var(--bd)] mx-auto flex items-center justify-center mb-2 shadow-[2px_2px_0_var(--bd)]">
              <User className="w-6 h-6 text-[#12102b]" />
            </div>
            <h2 className="text-xl font-extrabold text-[var(--ink)] font-display">
              {currentUser}
            </h2>
            <p className="text-xs text-[var(--mut)]">Signed in to DealNest</p>
          </div>

          <div className="space-y-2">
            <button
              onClick={() => {
                onClose();
                onOpenDashboard();
              }}
              className="dn-btn dn-btn-secondary text-xs py-2.5 w-full font-bold"
            >
              Go to Dashboard
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenAdmin();
              }}
              className="dn-btn dn-btn-secondary text-xs py-2.5 w-full font-bold"
            >
              Affiliate & Admin Control
            </button>
            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="dn-btn dn-btn-secondary text-[var(--cor)] text-xs py-2.5 w-full"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-[#12102b]/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-[var(--card)] border-2 border-[var(--bd)] rounded-[24px] p-6 max-w-sm w-full shadow-[8px_8px_0_var(--pri)] relative"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg border border-[var(--bd)] text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--bg)] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-xl font-extrabold text-[var(--ink)] font-display mb-1.5">
          Sign In to DealNest
        </h2>
        <p className="text-xs text-[var(--mut)] mb-4">
          Save your deals, synchronize price alerts, and get exclusive coupon unlocks.
        </p>

        <form
          onSubmit={e => {
            e.preventDefault();
            onLogin(identifier.trim() || 'SmartShopper');
            onClose();
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-[11px] font-bold text-[var(--mut)] uppercase tracking-wider mb-1">
              Email or Mobile Number
            </label>
            <input
              type="text"
              value={identifier}
              onChange={e => setIdentifier(e.target.value)}
              placeholder="e.g. shopper@example.com"
              className="dn-input w-full text-xs"
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="dn-btn w-full py-2.5 text-xs font-bold"
          >
            Continue
          </button>
        </form>

      </div>
    </div>
  );
};

export type LegalModalType = 'privacy' | 'terms' | 'cookies' | 'affiliate' | 'contact' | 'disclaimer';

interface LegalModalProps {
  type: LegalModalType;
  onClose: () => void;
  brandName: string;
  onToast: (msg: string) => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  type,
  onClose,
  brandName,
  onToast,
}) => {
  const [contactForm, setContactForm] = useState({ name: '', email: '', category: 'Deal Inquiry', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    onToast('Message received! Our deal concierge will reply promptly.');
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  const titles: Record<LegalModalType, string> = {
    privacy: 'Privacy Policy',
    terms: 'Terms of Service',
    cookies: 'Cookie Policy & Preferences',
    affiliate: 'Affiliate Disclosure',
    contact: 'Contact Deal Concierge',
    disclaimer: 'Pricing & Availability Disclaimer',
  };

  return (
    <div
      className="fixed inset-0 bg-[#12102b]/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-[var(--card)] border-2 border-[var(--bd)] rounded-[24px] p-6 max-w-xl w-full shadow-[8px_8px_0_var(--pri)] relative max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg border border-[var(--bd)] text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--bg)] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--ink)] font-display mb-3">
          {titles[type]}
        </h2>

        <div className="text-xs sm:text-sm text-[var(--ink)] space-y-3 leading-relaxed">
          {type === 'affiliate' && (
            <>
              <div className="bg-[var(--lime)] p-3 rounded-xl border border-[var(--bd)] font-bold text-[#12102b]">
                Transparency First: How {brandName} Works & Earns
              </div>
              <p>
                {brandName} is a smart price comparison and coupon aggregation engine. We are committed to transparency in our recommendations.
              </p>
              <p>
                Some of the links on this website are affiliate links. This means that, at zero additional cost to you, {brandName} may earn a small referral commission if you click through and make a qualifying purchase on a partner website (such as Amazon, Flipkart, Myntra, Swiggy, Zomato, Zepto, or Blinkit).
              </p>
              <p>
                Our proprietary deal scoring algorithm (0 to 100) ranks offers objectively based on total landed price (including shipping and delivery fees), current discount percentage, verified customer ratings, and delivery speed. Partner commissions never influence our Deal Score or the "Best Price" badge designation.
              </p>
            </>
          )}

          {type === 'disclaimer' && (
            <>
              <div className="bg-[var(--pri2)] p-3 rounded-xl border border-[var(--bd)] font-semibold text-[var(--ink)]">
                Prices and availability may change. Final price is confirmed on the partner platform.
              </div>
              <p>
                Prices, product availability, coupon codes, and estimated delivery times displayed on {brandName} are updated at regular intervals via partner feeds and historical data. However, merchant pricing and promotional inventory can change rapidly.
              </p>
              <p>
                The final binding price, taxes, shipping charges, and promotional validity are always determined by and confirmed on the respective partner retailer’s checkout page.
              </p>
              <p>
                {brandName} does not sell items directly and is not responsible for merchant fulfillment, shipping delays, or stock discrepancies.
              </p>
            </>
          )}

          {type === 'privacy' && (
            <>
              <p>
                At {brandName}, we value your privacy. We store user preferences (such as selected delivery location, dark/light theme, watched deals, and price alerts) locally on your device using browser local storage.
              </p>
              <p>
                We do not sell your personal data or search queries to third-party data brokers. When you click an outbound merchant link, you will be redirected to the merchant’s platform, which operates under its own privacy policy.
              </p>
            </>
          )}

          {type === 'terms' && (
            <>
              <p>
                By using {brandName}, you agree to use our deal comparison platform solely for personal, non-commercial shopping discovery.
              </p>
              <p>
                All brand logos, trademarks, and store names belong to their respective corporate owners. Use of partner platform names is for identification and comparative reference purposes only.
              </p>
            </>
          )}

          {type === 'cookies' && (
            <>
              <p>
                {brandName} uses essential browser cookies and local storage tokens to remember your shopping preferences, saved watchlist, location, and theme settings.
              </p>
              <div className="p-3 bg-[var(--bg)] rounded-xl border border-[var(--bd)] space-y-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold">Essential Shopping Preferences</span>
                  <span className="text-[11px] font-bold text-emerald-600">Active</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold">Affiliate Attribution Cookies</span>
                  <span className="text-[11px] font-bold text-emerald-600">Enabled</span>
                </div>
              </div>
            </>
          )}

          {type === 'contact' && (
            <div>
              {submitted ? (
                <div className="text-center py-6 space-y-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <Check className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold">Thank you for reaching out!</h3>
                  <p className="text-xs text-[var(--mut)]">
                    Our partner relations team will review your message promptly.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--mut)] uppercase tracking-wider mb-1">
                      Your Name
                    </label>
                    <input
                      type="text"
                      required
                      value={contactForm.name}
                      onChange={e => setContactForm({ ...contactForm, name: e.target.value })}
                      placeholder="Jane Doe"
                      className="dn-input w-full text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--mut)] uppercase tracking-wider mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={contactForm.email}
                      onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                      placeholder="jane@example.com"
                      className="dn-input w-full text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--mut)] uppercase tracking-wider mb-1">
                      Topic
                    </label>
                    <select
                      value={contactForm.category}
                      onChange={e => setContactForm({ ...contactForm, category: e.target.value })}
                      className="dn-input w-full text-xs"
                    >
                      <option>Deal / Price Correction</option>
                      <option>Coupon Code Issue</option>
                      <option>Merchant Partnership & Affiliate</option>
                      <option>General Feedback</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[var(--mut)] uppercase tracking-wider mb-1">
                      Message
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={contactForm.message}
                      onChange={e => setContactForm({ ...contactForm, message: e.target.value })}
                      placeholder="Tell us about the deal or inquiry..."
                      className="dn-input w-full text-xs"
                    />
                  </div>

                  <button
                    type="submit"
                    className="dn-btn w-full py-2.5 text-xs font-bold"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Message</span>
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        <div className="mt-5 pt-3 border-t border-[var(--bd)]/20 text-right">
          <button
            type="button"
            onClick={onClose}
            className="dn-btn dn-btn-secondary text-xs py-1.5 px-4 font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
