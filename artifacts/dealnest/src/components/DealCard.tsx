import React, { useState } from 'react';
import { Item, ScoredOffer } from '../types';
import { PLATFORM_COLORS } from '../data';
import { fmt, ety, scoreOffers, getItemPriceTrend } from '../utils';
import { 
  Heart, 
  Bell, 
  Share2, 
  Award, 
  Ticket, 
  Star, 
  Clock, 
  LineChart, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  ShieldCheck, 
  Sparkles,
  Truck,
  TrendingDown,
  TrendingUp,
  Minus
} from 'lucide-react';

interface DealCardProps {
  item: Item;
  isSaved: boolean;
  onToggleSave: (id: string) => void;
  onPriceAlert: (item: Item) => void;
  onShare: (item: Item) => void;
  onGetDeal: (item: Item, platform: string) => void;
  onViewHistory?: (item: Item) => void;
  disabledPlatforms?: Record<string, boolean>;
  demoMode?: boolean;
  flashingOfferKey?: string | null;
}

export const DealCard: React.FC<DealCardProps> = ({
  item,
  isSaved,
  onToggleSave,
  onPriceAlert,
  onShare,
  onGetDeal,
  onViewHistory,
  disabledPlatforms = {},
  demoMode = false,
  flashingOfferKey = null,
}) => {
  const [expandedOfferPlatform, setExpandedOfferPlatform] = useState<string | null>(null);
  const [copiedCoupon, setCopiedCoupon] = useState<string | null>(null);
  const [isCopiedShare, setIsCopiedShare] = useState(false);
  const [isShakingShare, setIsShakingShare] = useState(false);

  const handleShareClick = () => {
    setIsShakingShare(true);
    setIsCopiedShare(true);
    onShare(item);
    setTimeout(() => setIsShakingShare(false), 500);
    setTimeout(() => setIsCopiedShare(false), 2400);
  };

  const scoredList = scoreOffers(item, disabledPlatforms);
  const validOffers = scoredList.filter(o => !o.na);
  const unavailableOffers = scoredList.filter(o => o.na);

  const bestOffer = validOffers.length
    ? validOffers.reduce((prev, curr) => ((curr.t ?? 9e9) < (prev.t ?? 9e9) ? curr : prev))
    : null;

  // Next best price for savings comparison
  const sortedOffers = [...validOffers].sort((a, b) => (a.t ?? 9e9) - (b.t ?? 9e9));
  const secondBestOffer = sortedOffers.length > 1 ? sortedOffers[1] : null;

  const typeLabels: Record<string, string> = {
    shop: 'Shopping',
    food: 'Food delivery',
    cafe: 'Cafe & Drinks',
    qc: 'Quick commerce (10-min)',
  };

  const handleCopyCoupon = (e: React.MouseEvent, couponText: string) => {
    e.stopPropagation();
    // extract coupon code if formatted like 'FOOD150 (details)'
    const codeMatch = couponText.match(/^([A-Z0-9_-]+)/);
    const codeToCopy = codeMatch ? codeMatch[1] : couponText;
    navigator.clipboard.writeText(codeToCopy);
    setCopiedCoupon(couponText);
    setTimeout(() => setCopiedCoupon(null), 2000);
  };

  const toggleExpand = (platform: string) => {
    setExpandedOfferPlatform(prev => (prev === platform ? null : platform));
  };

  const trendData = getItemPriceTrend(item);
  const sparkPoints = trendData.points;
  const sparkMin = Math.min(...sparkPoints);
  const sparkMax = Math.max(...sparkPoints);
  const sparkRange = sparkMax - sparkMin || 1;
  const sparkW = 60;
  const sparkH = 20;
  const sparkPad = 2;

  const getSparkX = (idx: number) =>
    sparkPad + (idx / (sparkPoints.length - 1)) * (sparkW - sparkPad * 2);
  const getSparkY = (price: number) =>
    sparkH - sparkPad - ((price - sparkMin) / sparkRange) * (sparkH - sparkPad * 2);

  const sparkLineD = sparkPoints.reduce((acc, p, idx) => {
    const x = getSparkX(idx);
    const y = getSparkY(p);
    return `${acc} ${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }, '');

  const sparkFillD = `${sparkLineD} L ${getSparkX(sparkPoints.length - 1).toFixed(1)} ${sparkH} L ${getSparkX(0).toFixed(1)} ${sparkH} Z`;

  const trendStrokeColor =
    trendData.direction === 'down'
      ? '#10b981'
      : trendData.direction === 'up'
      ? '#f43f5e'
      : '#6366f1';

  return (
    <div className="dn-card relative flex flex-col justify-between" data-id={item.id}>
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="text-3xl sm:text-4xl p-1 bg-[var(--bg)] border-2 border-[var(--bd)] rounded-2xl flex-shrink-0 select-none">
              {item.em}
            </span>
            <div className="min-w-0">
              <h3 className="font-extrabold text-lg sm:text-xl text-[var(--ink)] leading-snug truncate">
                {item.name}
              </h3>
              <div className="text-xs text-[var(--mut)] flex items-center gap-1.5 flex-wrap mt-0.5">
                <span className="font-semibold">{typeLabels[item.type] || item.type}</span>
                <span>·</span>
                <span>MRP {fmt(item.mrp)}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onToggleSave(item.id)}
            className="border-2 border-[var(--bd)] bg-[var(--card)] hover:bg-[var(--lime)] rounded-xl p-2 transition-all cursor-pointer flex-shrink-0"
            aria-label={isSaved ? 'Remove from saved' : 'Save deal'}
            title={isSaved ? 'Saved in Watchlist' : 'Save to Watchlist'}
          >
            <Heart
              className={`w-4 h-4 transition-transform active:scale-125 ${
                isSaved ? 'fill-[var(--cor)] text-[var(--cor)]' : 'text-[var(--ink)]'
              }`}
            />
          </button>
        </div>

        {/* Price Trend Visual Indicator with Mini Sparkline Chart */}
        <div
          onClick={() => onViewHistory && onViewHistory(item)}
          role="button"
          tabIndex={0}
          title={`Price Trend: ${trendData.label}. Click to view 30-day price history chart.`}
          className={`mb-3 p-2 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] group select-none ${
            trendData.direction === 'down'
              ? 'bg-emerald-500/10 border-emerald-500/30 hover:border-emerald-500/60 text-emerald-800 dark:text-emerald-300'
              : trendData.direction === 'up'
              ? 'bg-rose-500/10 border-rose-500/30 hover:border-rose-500/60 text-rose-800 dark:text-rose-300'
              : 'bg-indigo-500/10 border-indigo-500/30 hover:border-indigo-500/60 text-indigo-800 dark:text-indigo-300'
          }`}
        >
          {/* Trend arrow & label */}
          <div className="flex items-center gap-1.5 min-w-0">
            {trendData.direction === 'down' ? (
              <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <TrendingDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" />
              </div>
            ) : trendData.direction === 'up' ? (
              <div className="w-5 h-5 rounded-full bg-rose-500/20 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 stroke-[2.5]" />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <Minus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 stroke-[2.5]" />
              </div>
            )}

            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="font-extrabold text-[11px] tracking-tight">
                  {trendData.label}
                </span>
                {trendData.isAllTimeLow && (
                  <span className="bg-emerald-600 text-white text-[9px] font-black uppercase px-1 py-0.2 rounded">
                    Best Deal
                  </span>
                )}
              </div>
              <span className="text-[10px] opacity-75 font-medium block truncate">
                {trendData.direction === 'down'
                  ? `Dropped from ${fmt(trendData.previousPrice)} recently`
                  : trendData.direction === 'up'
                  ? `Rose from ${fmt(trendData.previousPrice)} recently`
                  : 'Price has remained steady'}
              </span>
            </div>
          </div>

          {/* Sparkline mini line chart */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-[56px] h-[20px] bg-black/5 dark:bg-white/5 rounded px-0.5 py-0.5">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 60 20" preserveAspectRatio="none">
                <defs>
                  <linearGradient id={`sparkGrad-${item.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={trendStrokeColor} stopOpacity="0.4" />
                    <stop offset="100%" stopColor={trendStrokeColor} stopOpacity="0.0" />
                  </linearGradient>
                </defs>
                <path d={sparkFillD} fill={`url(#sparkGrad-${item.id})`} />
                <path
                  d={sparkLineD}
                  fill="none"
                  stroke={trendStrokeColor}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx={getSparkX(sparkPoints.length - 1)}
                  cy={getSparkY(sparkPoints[sparkPoints.length - 1])}
                  r="2.5"
                  fill={trendStrokeColor}
                />
              </svg>
            </div>
            <span className="text-[10px] font-extrabold text-[var(--pri)] opacity-80 group-hover:opacity-100 hidden sm:inline">
              History →
            </span>
          </div>
        </div>

        {/* Platform Comparison Rows */}
        <div className="space-y-2.5 mt-3">
          {validOffers.map(offer => {
            const isWinner = offer === bestOffer;
            const isFlashing = flashingOfferKey === `${item.id}|${offer.p}`;
            const displayPrice = item.type === 'food' || item.type === 'cafe' ? offer.t : offer.price;
            const isExpanded = expandedOfferPlatform === offer.p;

            // Calculate savings vs 2nd best
            const savingsVsNext =
              isWinner && secondBestOffer && secondBestOffer.t && offer.t
                ? Math.max(0, secondBestOffer.t - offer.t)
                : 0;

            return (
              <div
                key={offer.p}
                className={`p-3 rounded-2xl border-2 transition-all flex flex-col gap-2 ${
                  isWinner
                    ? 'bg-[var(--lime)] border-[var(--bd)] text-[#12102b] shadow-[3px_3px_0_var(--bd)]'
                    : 'bg-[var(--bg)] border-[var(--bd)]/50 text-[var(--ink)] hover:border-[var(--bd)]'
                }`}
              >
                {/* Row Header: Platform info, pricing & CTA */}
                <div className="flex items-center justify-between gap-2.5">
                  {/* Left: Platform identity & rating */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-8 h-8 rounded-full border-2 border-[var(--bd)] flex items-center justify-center font-extrabold text-sm text-white flex-shrink-0 shadow-[1px_1px_0_var(--bd)]"
                      style={{ backgroundColor: PLATFORM_COLORS[offer.p] || '#473fa0' }}
                    >
                      {offer.p.charAt(0)}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-sm tracking-tight">{offer.p}</span>
                        {isWinner && (
                          <span className="bg-[#12102b] text-[var(--lime)] text-[10px] font-extrabold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                            <Award className="w-3 h-3 text-[var(--lime)]" />
                            <span>BEST {item.type === 'food' || item.type === 'cafe' ? 'VALUE' : 'PRICE'}</span>
                          </span>
                        )}
                      </div>

                      <div
                        className={`text-[11px] flex items-center gap-1.5 flex-wrap mt-0.5 ${
                          isWinner ? 'text-[#3b4a05]' : 'text-[var(--mut)]'
                        }`}
                      >
                        {offer.rating && (
                          <span className="flex items-center gap-0.5 font-bold">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                            <span>{offer.rating}</span>
                          </span>
                        )}
                        <span>·</span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{ety(offer.eta)}</span>
                        </span>
                        {(item.type === 'food' || item.type === 'cafe') && (
                          <>
                            <span>·</span>
                            <span>Fee: {offer.fee ? fmt(offer.fee) : 'Free'}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Listed Price & Quick CTA */}
                  <div className="text-right flex-shrink-0 flex flex-col items-end">
                    <div className="flex items-center gap-1.5 justify-end">
                      <span
                        className={`text-lg sm:text-xl font-extrabold font-display transition-colors ${
                          isFlashing ? 'flash' : ''
                        }`}
                      >
                        {fmt(displayPrice)}
                      </span>
                      <span className="text-[11px] line-through text-[var(--mut)]">
                        {fmt(item.mrp)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 justify-end mt-0.5">
                      <span className="bg-[var(--cor)] text-white font-extrabold text-[10px] px-1.5 py-0.5 rounded border border-[var(--bd)]">
                        {offer.disc}% OFF
                      </span>
                      <span className="text-[10px] font-extrabold bg-[var(--card)] text-[var(--ink)] px-1.5 py-0.5 rounded border border-[var(--bd)]">
                        Score {offer.score}/100
                      </span>
                    </div>
                  </div>
                </div>

                {/* Full-width Offer Details Strip (No truncation, full visibility!) */}
                {offer.coupon && (
                  <div
                    className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
                      isWinner
                        ? 'bg-white/80 border-[#12102b]/20 text-[#12102b]'
                        : 'bg-[var(--card)] border-[var(--bd)] text-[var(--ink)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Ticket className="w-3.5 h-3.5 text-[var(--pri)] flex-shrink-0" />
                      <span className="font-bold text-[11px] leading-tight break-words">
                        Offer: {offer.coupon}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={e => handleCopyCoupon(e, offer.coupon!)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-all flex items-center gap-1 flex-shrink-0 cursor-pointer ${
                        copiedCoupon === offer.coupon
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : 'bg-[var(--bg)] hover:bg-[var(--lime)] text-[var(--ink)] border-[var(--bd)]'
                      }`}
                      title="Copy coupon / offer code"
                    >
                      {copiedCoupon === offer.coupon ? (
                        <>
                          <Check className="w-3 h-3" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Savings Pill if Best Price */}
                {isWinner && savingsVsNext > 0 && (
                  <div className="text-[11px] font-extrabold text-[#2a3604] flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#587304]" />
                    <span>
                      Save {fmt(savingsVsNext)} compared to {secondBestOffer?.p}!
                    </span>
                  </div>
                )}

                {/* Expandable Offer Breakdown Drawer */}
                {isExpanded && (
                  <div
                    className={`mt-1 p-2.5 rounded-xl border text-xs space-y-1.5 ${
                      isWinner ? 'bg-white/90 border-[#12102b]/30' : 'bg-[var(--card)] border-[var(--bd)]'
                    }`}
                  >
                    <div className="flex justify-between font-medium text-[var(--mut)]">
                      <span>Base Store Price:</span>
                      <span className="font-bold text-[var(--ink)]">{fmt(offer.price)}</span>
                    </div>
                    {offer.fee !== undefined && (
                      <div className="flex justify-between font-medium text-[var(--mut)]">
                        <span>Delivery / Platform Fee:</span>
                        <span className="font-bold text-[var(--ink)]">
                          {offer.fee === 0 ? 'Free Delivery' : fmt(offer.fee)}
                        </span>
                      </div>
                    )}
                    {offer.coupon && (
                      <div className="flex justify-between font-medium text-emerald-700">
                        <span>Applicable Discount / Offer:</span>
                        <span className="font-bold">{offer.coupon}</span>
                      </div>
                    )}
                    <div className="pt-1 border-t border-[var(--bd)]/20 flex justify-between font-extrabold text-sm text-[var(--ink)]">
                      <span>Total Landed Price:</span>
                      <span className="font-display text-emerald-600">{fmt(offer.t)}</span>
                    </div>
                    <div className="text-[10px] text-[var(--mut)] pt-1 flex items-center gap-1">
                      <Truck className="w-3 h-3 text-[var(--pri)]" />
                      <span>Estimated delivery: {ety(offer.eta)} · Live verified</span>
                    </div>
                  </div>
                )}

                {/* Row Action Footer */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => toggleExpand(offer.p)}
                    className={`text-[11px] font-bold py-1 px-2 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${
                      isWinner
                        ? 'border-[#12102b]/20 hover:bg-white/60 text-[#12102b]'
                        : 'border-[var(--bd)] bg-[var(--card)] text-[var(--mut)] hover:text-[var(--ink)]'
                    }`}
                  >
                    <span>{isExpanded ? 'Less' : 'Offer Details'}</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => onGetDeal(item, offer.p)}
                    className="dn-btn py-1.5 px-3 text-xs font-bold flex-1 flex items-center justify-center gap-1"
                  >
                    <span>
                      {item.type === 'qc' ? 'SHOP NOW' : item.type === 'shop' ? 'VIEW DEAL' : 'GET DEAL'}
                    </span>
                  </button>
                </div>
              </div>
            );
          })}

          {/* Unavailable platforms */}
          {unavailableOffers.map(offer => (
            <div
              key={offer.p}
              className="p-2.5 rounded-2xl border-2 border-dashed border-[var(--bd)]/40 bg-[var(--bg)]/50 text-[var(--mut)] flex items-center gap-2.5 opacity-70"
            >
              <span className="w-8 h-8 rounded-full border border-gray-400 bg-gray-400 flex items-center justify-center font-bold text-sm text-white flex-shrink-0">
                {offer.p.charAt(0)}
              </span>
              <div className="text-xs">
                <span className="font-bold text-[var(--ink)]">{offer.p}</span>
                <p className="text-[11px] text-[var(--cor)]">Currently unavailable · Stock out or unverified price</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Card Bottom Meta & Actions */}
      <div className="relative flex items-center gap-2 pt-4 mt-3 border-t-2 border-[var(--bd)]">
        {/* Temporary 'Link Copied!' feedback badge directly inside the card */}
        {isCopiedShare && (
          <div className="absolute -top-7 right-0 z-20 bg-[#12102b] text-[var(--lime)] text-[11px] font-extrabold px-2.5 py-1 rounded-xl border-2 border-[var(--lime)] shadow-[2px_2px_0_var(--bd)] flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-200">
            <Check className="w-3.5 h-3.5 text-[var(--lime)] stroke-[3]" />
            <span>Link Copied!</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => onPriceAlert(item)}
          className="dn-btn dn-btn-secondary text-xs py-1.5 px-2.5 flex-1 flex items-center justify-center gap-1"
          title="Create price drop alert"
        >
          <Bell className="w-3.5 h-3.5 text-[var(--pri)]" />
          <span>Alert</span>
        </button>

        {onViewHistory && (
          <button
            type="button"
            onClick={() => onViewHistory(item)}
            className="dn-btn dn-btn-secondary text-xs py-1.5 px-2.5 flex-1 flex items-center justify-center gap-1"
            title="View 30-day price trend chart"
          >
            <LineChart className="w-3.5 h-3.5 text-emerald-600" />
            <span>History</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleShareClick}
          className={`dn-btn text-xs py-1.5 px-2.5 flex items-center justify-center gap-1 transition-all duration-200 cursor-pointer ${
            isShakingShare ? 'btn-shake' : ''
          } ${
            isCopiedShare
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-[1px_1px_0_var(--bd)] scale-105'
              : 'dn-btn-secondary hover:scale-105 active:scale-95'
          }`}
          title="Share deal link"
        >
          {isCopiedShare ? (
            <>
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
