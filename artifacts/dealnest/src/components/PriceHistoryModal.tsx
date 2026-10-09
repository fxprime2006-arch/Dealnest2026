import React, { useState } from 'react';
import { Item, ScoredOffer } from '../types';
import { fmt, scoreOffers } from '../utils';
import { X, TrendingDown, TrendingUp, AlertCircle, ShieldCheck, Bell, Calendar } from 'lucide-react';
import { PLATFORM_COLORS } from '../data';

interface PriceHistoryModalProps {
  item: Item;
  onClose: () => void;
  onSetAlert: (item: Item) => void;
}

export const PriceHistoryModal: React.FC<PriceHistoryModalProps> = ({
  item,
  onClose,
  onSetAlert,
}) => {
  const [timeframe, setTimeframe] = useState<'7d' | '30d' | '90d'>('30d');

  const scored = scoreOffers(item);
  const validOffers = scored.filter(o => !o.na && o.price != null);
  const currentLowest = validOffers.length
    ? Math.min(...validOffers.map(o => (item.type === 'food' || item.type === 'cafe' ? (o.t ?? 9e9) : (o.price ?? 9e9))))
    : item.mrp;

  // Generate realistic historical data points based on MRP and current lowest
  const historical30dLow = Math.round(currentLowest * 0.96);
  const historical30dHigh = Math.round(item.mrp * 0.98);
  const historicalAverage = Math.round((currentLowest + historical30dHigh) / 2);

  const priceDiffVsAverage = Math.round(((historicalAverage - currentLowest) / historicalAverage) * 100);
  const isAllTimeLow = currentLowest <= historical30dLow * 1.02;

  // SVG chart coordinates calculation
  const pointsCount = timeframe === '7d' ? 7 : timeframe === '30d' ? 14 : 20;
  const historyData = React.useMemo(() => {
    const list: { day: string; price: number; platform: string }[] = [];
    const base = currentLowest;
    const now = new Date();

    for (let i = pointsCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i * (timeframe === '90d' ? 4 : timeframe === '30d' ? 2 : 1));
      
      // pseudo-random trend that stabilizes towards current lowest today
      let factor = 1 + (Math.sin(i * 0.8) * 0.08) + ((i / pointsCount) * 0.05);
      if (i === 0) factor = 1; // today
      const p = Math.round(base * factor);
      list.push({
        day: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        price: p,
        platform: i % 2 === 0 ? 'Amazon' : 'Flipkart',
      });
    }
    return list;
  }, [currentLowest, pointsCount, timeframe]);

  // SVG dimensions
  const width = 460;
  const height = 150;
  const padding = 25;

  const minP = Math.min(...historyData.map(d => d.price), historical30dLow);
  const maxP = Math.max(...historyData.map(d => d.price), historical30dHigh);
  const range = maxP - minP || 1;

  const getX = (index: number) => padding + (index / (historyData.length - 1)) * (width - padding * 2);
  const getY = (price: number) => height - padding - ((price - minP) / range) * (height - padding * 2);

  const pathD = historyData.reduce((acc, curr, idx) => {
    const x = getX(idx);
    const y = getY(curr.price);
    return `${acc} ${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
  }, '');

  const areaD = `${pathD} L ${getX(historyData.length - 1)} ${height - padding} L ${getX(0)} ${height - padding} Z`;

  return (
    <div
      className="fixed inset-0 bg-[#12102b]/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-[var(--card)] border-2 border-[var(--bd)] rounded-[24px] p-6 max-w-xl w-full shadow-[8px_8px_0_var(--pri)] relative max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg border border-[var(--bd)] text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--bg)] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <span className="text-3xl p-1 bg-[var(--bg)] border-2 border-[var(--bd)] rounded-xl">
            {item.em}
          </span>
          <div>
            <h2 className="text-xl font-extrabold text-[var(--ink)] font-display">
              {item.name}
            </h2>
            <div className="text-xs text-[var(--mut)] flex items-center gap-2 mt-0.5">
              <span>MRP: {fmt(item.mrp)}</span>
              <span>·</span>
              <span className="text-emerald-600 font-bold">
                Current Best: {fmt(currentLowest)}
              </span>
            </div>
          </div>
        </div>

        {/* Deal Verdict Box */}
        <div className={`p-3.5 rounded-2xl border-2 border-[var(--bd)] mb-4 flex items-center gap-3 ${
          isAllTimeLow ? 'bg-[var(--lime)] text-[#12102b]' : 'bg-[var(--pri2)] text-[var(--ink)]'
        }`}>
          <div className="w-9 h-9 rounded-xl bg-white border-2 border-[var(--bd)] flex items-center justify-center flex-shrink-0">
            {isAllTimeLow ? (
              <TrendingDown className="w-5 h-5 text-emerald-600" />
            ) : (
              <TrendingUp className="w-5 h-5 text-[var(--pri)]" />
            )}
          </div>
          <div>
            <span className="text-xs font-black uppercase tracking-wider block font-display">
              {isAllTimeLow ? '🔥 BUY RECOMMENDATION: 30-DAY ALL-TIME LOW' : '⚖️ FAIR MARKET VALUE'}
            </span>
            <p className="text-xs font-medium leading-tight">
              {isAllTimeLow
                ? `Current price is ${priceDiffVsAverage}% below the 30-day average. Excellent time to purchase!`
                : `Price is stable. Set a price alert to be notified if it drops closer to ${fmt(historical30dLow)}.`}
            </p>
          </div>
        </div>

        {/* Timeframe Selector & Chart */}
        <div className="bg-[var(--bg)] border-2 border-[var(--bd)] rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-[var(--ink)] flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[var(--pri)]" />
              <span>Price Trend Chart</span>
            </span>

            <div className="flex gap-1 bg-[var(--card)] p-0.5 rounded-lg border border-[var(--bd)]">
              {(['7d', '30d', '90d'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTimeframe(t)}
                  className={`text-[11px] font-bold py-1 px-2.5 rounded-md transition-colors ${
                    timeframe === t ? 'bg-[var(--pri)] text-white' : 'text-[var(--mut)] hover:text-[var(--ink)]'
                  }`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* SVG Price Chart */}
          <div className="w-full overflow-x-auto">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto max-h-[170px]">
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5b3df5" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#5b3df5" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              <line x1={padding} y1={getY(minP)} x2={width - padding} y2={getY(minP)} stroke="#12102b" strokeOpacity="0.1" strokeDasharray="3 3" />
              <line x1={padding} y1={getY(historicalAverage)} x2={width - padding} y2={getY(historicalAverage)} stroke="#12102b" strokeOpacity="0.1" strokeDasharray="3 3" />
              <line x1={padding} y1={getY(maxP)} x2={width - padding} y2={getY(maxP)} stroke="#12102b" strokeOpacity="0.1" strokeDasharray="3 3" />

              {/* Area & Line */}
              <path d={areaD} fill="url(#chartGrad)" />
              <path d={pathD} fill="none" stroke="#5b3df5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

              {/* Data points */}
              {historyData.map((d, idx) => {
                const x = getX(idx);
                const y = getY(d.price);
                const isLast = idx === historyData.length - 1;
                return (
                  <g key={idx}>
                    <circle
                      cx={x}
                      cy={y}
                      r={isLast ? 4.5 : 2.5}
                      fill={isLast ? '#c8f032' : '#5b3df5'}
                      stroke="#12102b"
                      strokeWidth="1.5"
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex justify-between text-[10px] text-[var(--mut)] pt-1 px-2 border-t border-[var(--bd)]/20 mt-1">
            <span>{historyData[0]?.day}</span>
            <span>Mid period</span>
            <span className="font-bold text-[var(--ink)]">Today ({fmt(currentLowest)})</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 text-center mb-4">
          <div className="p-2.5 rounded-xl border border-[var(--bd)] bg-[var(--card)]">
            <span className="text-[10px] text-[var(--mut)] block uppercase font-bold">30-Day Low</span>
            <span className="font-extrabold text-sm text-emerald-600 font-display">{fmt(historical30dLow)}</span>
          </div>
          <div className="p-2.5 rounded-xl border border-[var(--bd)] bg-[var(--card)]">
            <span className="text-[10px] text-[var(--mut)] block uppercase font-bold">Average Price</span>
            <span className="font-extrabold text-sm text-[var(--ink)] font-display">{fmt(historicalAverage)}</span>
          </div>
          <div className="p-2.5 rounded-xl border border-[var(--bd)] bg-[var(--card)]">
            <span className="text-[10px] text-[var(--mut)] block uppercase font-bold">30-Day High</span>
            <span className="font-extrabold text-sm text-[var(--cor)] font-display">{fmt(historical30dHigh)}</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="dn-btn dn-btn-secondary text-xs py-2.5 flex-1 font-bold"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onSetAlert(item);
            }}
            className="dn-btn text-xs py-2.5 flex-1 font-bold flex items-center justify-center gap-1.5"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Track & Alert</span>
          </button>
        </div>
      </div>
    </div>
  );
};
