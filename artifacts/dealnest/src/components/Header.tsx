import React from 'react';
import { MapPin, RefreshCw } from 'lucide-react';

interface HeaderProps {
  tickerText: string;
  isFlashing: boolean;
  location: string;
  demoMode: boolean;
  isRefreshing: boolean;
  onRefreshPrices: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  tickerText,
  isFlashing,
  location,
  demoMode,
  isRefreshing,
  onRefreshPrices,
}) => {
  return (
    <header className="bg-[#100e23] text-white text-[13px] px-3 sm:px-4 py-2 flex items-center justify-between overflow-hidden z-20 select-none border-b-2 border-[#2b2754] gap-2.5">
      {/* Left: live data status and ticker */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-black text-[#ccff00] flex-shrink-0 text-[11px] uppercase tracking-wider bg-[#1a1638] px-2.5 py-0.5 rounded-full border border-[#37316a]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ccff00] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ccff00]" />
          </span>
          <span>LIVE DEAL DATA</span>
        </span>

        <span className="text-white/30 hidden sm:inline">|</span>

        <span
          className={`truncate transition-all text-xs sm:text-[13px] font-medium ${
            isFlashing ? 'text-[#ccff00] font-bold scale-[1.01]' : 'text-white/90'
          }`}
        >
          {tickerText}
        </span>
      </div>

      {/* Right: location and manual check */}
      <div className="flex items-center gap-2 sm:gap-3 text-xs flex-shrink-0 text-white/70">
        <span className="hidden md:flex items-center gap-1 text-white/80 font-bold bg-[#1a1638] px-2 py-0.5 rounded-lg border border-[#37316a]">
          <MapPin className="w-3 h-3 text-[#ff5252]" />
          <span>{location}</span>
        </span>

        {/* Explicit manual check button */}
        <button
          type="button"
          onClick={onRefreshPrices}
          disabled={isRefreshing}
          className="flex items-center gap-1.5 bg-[#5b3df5] hover:bg-[#4829e8] text-white text-[11px] font-extrabold px-2.5 py-1 rounded-lg border border-white/20 transition-all cursor-pointer disabled:opacity-50 shadow-[1px_1px_0_#12102b]"
          title="Refresh available deal data"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>
            {isRefreshing ? 'Checking...' : 'Manual check'}
          </span>
        </button>
      </div>
    </header>
  );
};
