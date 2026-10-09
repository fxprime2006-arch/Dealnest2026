import React from 'react';
import { ClickRecord, SectionConfig } from '../types';
import { PLATFORM_COLORS, DEFAULT_PLATFORM_LINKS } from '../data';
import { ALL_DIRECTORY_PLATFORMS, getPlatformCoverage } from '../platformDirectory';
import { 
  ShieldCheck, 
  BarChart3, 
  Settings, 
  Link, 
  Database, 
  Eye, 
  EyeOff, 
  Bot, 
  Sparkles, 
  ShoppingBag, 
  UtensilsCrossed, 
  Zap, 
  Tag, 
  Flame 
} from 'lucide-react';

interface AdminViewProps {
  demoMode: boolean;
  onToggleDemo: (val: boolean) => void;
  brandName: string;
  onBrandNameChange: (val: string) => void;
  disabledPlatforms: Record<string, boolean>;
  onTogglePlatform: (plat: string, enabled: boolean) => void;
  customAffiliates: Record<string, string>;
  onAffiliateChange: (plat: string, url: string) => void;
  clicks: ClickRecord[];
  searchesCount: number;
  sections: SectionConfig;
  onToggleSection: (sec: keyof SectionConfig, enabled: boolean) => void;
}

export const AdminView: React.FC<AdminViewProps> = ({
  demoMode,
  onToggleDemo,
  brandName,
  onBrandNameChange,
  disabledPlatforms,
  onTogglePlatform,
  customAffiliates,
  onAffiliateChange,
  clicks,
  searchesCount,
  sections,
  onToggleSection,
}) => {
  // Aggregate clicks by platform
  const clicksByPlatform: Record<string, number> = {};
  clicks.forEach(c => {
    clicksByPlatform[c.p] = (clicksByPlatform[c.p] || 0) + 1;
  });

  const platforms = ALL_DIRECTORY_PLATFORMS;

  const sectionItems: {
    key: keyof SectionConfig;
    label: string;
    description: string;
    icon: React.ReactNode;
    requiresAdminBadge?: boolean;
  }[] = [
    {
      key: 'shop',
      label: 'Shopping & Electronics',
      description: 'Tech, mobile phones, audio gear, and retail catalog price comparison.',
      icon: <ShoppingBag className="w-4 h-4 text-pink-500" />,
    },
    {
      key: 'food',
      label: 'Food & Dining',
      description: 'Zomato, Swiggy, and direct restaurant delivery comparison.',
      icon: <UtensilsCrossed className="w-4 h-4 text-emerald-500" />,
    },
    {
      key: 'qc',
      label: 'Quick Groceries (10-min)',
      description: 'Zepto, Blinkit, and Instamart essentials and dairy deals.',
      icon: <Zap className="w-4 h-4 text-amber-500" />,
    },
    {
      key: 'deals',
      label: "Today's Deals & Price Drops",
      description: 'Today’s featured bargain ranking and home showcase deals.',
      icon: <Flame className="w-4 h-4 text-rose-500" />,
    },
    {
      key: 'coupons',
      label: 'Coupon Code Zone',
      description: 'Platform promo codes, instant card offers, and copy vouchers.',
      icon: <Tag className="w-4 h-4 text-purple-500" />,
    },
    {
      key: 'ai',
      label: 'DealNest AI Shopping Assistant',
      description: 'Conversational cross-platform comparison with live catalog and coupon context.',
      icon: <Bot className="w-4 h-4 text-[var(--pri)]" />,
      requiresAdminBadge: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)] font-display tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-[var(--pri)]" />
          <span>Admin & Feature Control Center</span>
        </h2>
        <span className="text-xs bg-[var(--lime)] text-[#12102b] font-extrabold px-3 py-1 rounded-full border-2 border-[var(--bd)] shadow-[2px_2px_0_var(--bd)]">
          Administrator Mode Active
        </span>
      </div>

      {/* Section Activation & Visibility Control Card (Direct user request) */}
      <div className="dn-card border-2 border-[var(--bd)] bg-[var(--card)] shadow-[4px_4px_0_var(--bd)]">
        <div className="flex items-center justify-between mb-3 border-b-2 border-[var(--bd)] pb-3">
          <div>
            <h3 className="text-base font-extrabold text-[var(--ink)] flex items-center gap-2">
              <Settings className="w-5 h-5 text-[var(--pri)]" />
              <span>Section Activation & Visibility Controls</span>
            </h3>
            <p className="text-xs text-[var(--mut)] mt-0.5">
              Admin can activate or hide any section (Today's Deals, Coupons, Groceries, Shopping, Food, or AI Assistant).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {sectionItems.map(sec => {
            const isEnabled = sections[sec.key];

            return (
              <div
                key={sec.key}
                className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col justify-between gap-3 ${
                  isEnabled
                    ? 'bg-[var(--bg)] border-[var(--bd)] text-[var(--ink)]'
                    : 'bg-gray-100/50 dark:bg-gray-900/40 border-dashed border-gray-400 text-gray-500 opacity-80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 font-extrabold text-sm">
                      {sec.icon}
                      <span>{sec.label}</span>
                    </div>
                    {sec.requiresAdminBadge && (
                      <span className="bg-[#12102b] text-[var(--lime)] text-[9px] font-black uppercase px-2 py-0.5 rounded border border-[var(--bd)]">
                        Admin Only
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--mut)] leading-relaxed">
                    {sec.description}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--bd)]/20">
                  <span className={`text-[11px] font-bold flex items-center gap-1 ${
                    isEnabled ? 'text-emerald-700 font-extrabold' : 'text-rose-600'
                  }`}>
                    {isEnabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{isEnabled ? 'Active in UI' : 'Hidden from Users'}</span>
                  </span>

                  <button
                    type="button"
                    onClick={() => onToggleSection(sec.key, !isEnabled)}
                    className={`dn-btn text-xs py-1 px-3 font-bold cursor-pointer transition-all ${
                      isEnabled
                        ? 'dn-btn-secondary text-[var(--cor)] hover:bg-rose-50'
                        : 'dn-btn-lime text-[#12102b]'
                    }`}
                  >
                    {isEnabled ? 'Hide Section' : 'Activate Section'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Analytics Card */}
        <div className="dn-card">
          <h3 className="text-base font-bold text-[var(--ink)] flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-[var(--pri)]" />
            <span>Outbound Affiliate Metrics</span>
          </h3>
          <div className="text-3xl font-extrabold font-display text-[var(--ink)]">
            {clicks.length}
          </div>
          <div className="text-xs text-[var(--mut)] mt-1">
            Total partner store referrals tracked · {searchesCount} catalog searches executed
          </div>
        </div>

        {/* Global Settings */}
        <div className="dn-card">
          <h3 className="text-base font-bold text-[var(--ink)] flex items-center gap-2 mb-3">
            <Settings className="w-4 h-4 text-[var(--pri)]" />
            <span>Global Configuration</span>
          </h3>

          <div className="space-y-3 text-xs">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-[var(--ink)]">
              <input
                type="checkbox"
                checked={demoMode}
                onChange={e => onToggleDemo(e.target.checked)}
                className="w-4 h-4 rounded text-[var(--pri)]"
              />
              <span>Source-backed offer labels (verified listings and checkout notices)</span>
            </label>

            <div>
              <label className="block text-[11px] font-bold text-[var(--mut)] uppercase tracking-wider mb-1">
                Platform Brand Name
              </label>
              <input
                type="text"
                value={brandName}
                onChange={e => onBrandNameChange(e.target.value)}
                className="dn-input w-full text-xs font-semibold"
              />
            </div>
          </div>
        </div>

        {/* Affiliate URL Templates */}
        <div className="dn-card md:col-span-2">
          <h3 className="text-base font-bold text-[var(--ink)] flex items-center gap-2 mb-3">
            <Link className="w-4 h-4 text-[var(--pri)]" />
            <span>Platform Integration & Affiliate Links</span>
          </h3>
          <p className="text-xs text-[var(--mut)] mb-4">
            Configure partner affiliate tags. Use <code className="bg-[var(--pri2)] px-1 py-0.5 rounded font-mono text-[var(--ink)]">{'{q}'}</code> for search keyword or <code className="bg-[var(--pri2)] px-1 py-0.5 rounded font-mono text-[var(--ink)]">{'{qd}'}</code> for slug.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[360px] overflow-y-auto pr-2">
            {platforms.map(platform => {
              const isEnabled = disabledPlatforms[platform] !== false;
              const clickCount = clicksByPlatform[platform] || 0;

              return (
                <div
                  key={platform}
                  className="p-3 rounded-xl border border-[var(--bd)] bg-[var(--bg)] flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-[var(--ink)]">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={e => onTogglePlatform(platform, e.target.checked)}
                        className="w-4 h-4 rounded text-[var(--pri)]"
                      />
                      <span
                        className="w-2.5 h-2.5 rounded-full inline-block"
                        style={{ backgroundColor: PLATFORM_COLORS[platform] || '#333' }}
                      />
                      <span>{platform}</span>
                    </label>

                    <span className="text-[10px] font-semibold text-[var(--mut)] text-right">
                      <span className="block">{clickCount} {clickCount === 1 ? 'click' : 'clicks'}</span>
                      <span className={getPlatformCoverage(platform) === 'live' ? 'text-emerald-600' : 'text-amber-600'}>{getPlatformCoverage(platform) === 'live' ? 'Source-backed listing' : 'Checkout coverage'}</span>
                    </span>
                  </div>

                  <input
                    type="text"
                    value={customAffiliates[platform] || ''}
                    placeholder={DEFAULT_PLATFORM_LINKS[platform]}
                    onChange={e => onAffiliateChange(platform, e.target.value)}
                    className="dn-input text-xs w-full py-1.5 font-mono"
                    aria-label={`${platform} affiliate link`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Click Log Table */}
        <div className="dn-card md:col-span-2 overflow-x-auto">
          <h3 className="text-base font-bold text-[var(--ink)] flex items-center gap-2 mb-3">
            <Database className="w-4 h-4 text-[var(--pri)]" />
            <span>Referral Click Log</span>
          </h3>

          {clicks.length === 0 ? (
            <p className="text-xs text-[var(--mut)] italic py-2">
              No referral outbound links clicked yet in this session.
            </p>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-[var(--bd)] text-[var(--mut)]">
                  <th className="py-2 px-3">Click ID</th>
                  <th className="py-2 px-3">Platform</th>
                  <th className="py-2 px-3">Product</th>
                  <th className="py-2 px-3">Destination Link</th>
                  <th className="py-2 px-3">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {clicks.slice(0, 15).map(c => (
                  <tr key={c.id} className="border-b border-[var(--bd)]/20 hover:bg-[var(--bg)]">
                    <td className="py-2 px-3 font-mono text-[var(--pri)] font-bold">{c.id}</td>
                    <td className="py-2 px-3 font-bold">{c.p}</td>
                    <td className="py-2 px-3 truncate max-w-[150px]">{c.itemName || 'Catalog Search'}</td>
                    <td className="py-2 px-3 font-mono text-[11px] text-[var(--mut)] truncate max-w-[220px]">
                      {c.u || 'Default search link'}
                    </td>
                    <td className="py-2 px-3 text-[var(--mut)]">
                      {new Date(c.t).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
