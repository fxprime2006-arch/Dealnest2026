import React from 'react';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { PLATFORM_RESEARCH } from '../platformResearch';

export const PlatformSourceDirectory: React.FC = () => (
  <section className="space-y-4" aria-labelledby="official-platform-sources-heading">
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--pri)]">Official source directory</p>
        <h2 id="official-platform-sources-heading" className="text-xl sm:text-2xl font-extrabold text-[var(--ink)] font-display tracking-tight">
          Deals from the platforms you trust
        </h2>
        <p className="text-xs text-[var(--mut)] mt-1 max-w-2xl">
          We link to each platform’s official offers and terms pages. Coupon codes, prices, dates and eligibility remain dynamic and must be confirmed at checkout.
        </p>
      </div>
      <span className="text-[10px] font-bold text-[var(--mut)] border border-[var(--bd)] rounded-full px-2.5 py-1 self-start sm:self-auto">
        {PLATFORM_RESEARCH.length} researched platforms
      </span>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {PLATFORM_RESEARCH.map(platform => (
        <article key={platform.id} className="rounded-2xl border-2 border-[var(--bd)] bg-[var(--card)] p-4 shadow-[3px_3px_0_var(--bd)] min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-extrabold text-sm text-[var(--ink)] truncate">{platform.name}</h3>
              <p className="text-[10px] uppercase tracking-wide font-bold text-[var(--mut)] mt-0.5">{platform.category}</p>
            </div>
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" aria-label="Official source reviewed" />
          </div>
          <p className="text-[11px] text-[var(--mut)] leading-relaxed mt-2">{platform.claim}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {platform.dealsUrls.slice(0, 2).map(url => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-[var(--bd)] bg-[var(--pri2)] px-2 py-1 text-[10px] font-extrabold text-[var(--ink)] hover:underline">
                Deals <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ))}
            {platform.couponUrls.slice(0, 1).map(url => (
              <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-[var(--bd)] bg-[var(--lime)] px-2 py-1 text-[10px] font-extrabold text-[#12102b] hover:underline">
                Coupons <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ))}
          </div>
          <p className="text-[10px] leading-relaxed text-amber-700 dark:text-amber-300 mt-3">{platform.dynamicWarning}</p>
        </article>
      ))}
    </div>
  </section>
);
