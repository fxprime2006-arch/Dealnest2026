import React from 'react';
import { NavView, SectionConfig } from '../types';
import { CITIES } from '../data';
import { 
  Home, 
  Search,
  ShoppingBag, 
  UtensilsCrossed, 
  Zap, 
  Ticket, 
  Flame, 
  Bot, 
  Moon, 
  Sun, 
  User, 
  Settings,
  ShieldCheck,
  RefreshCw,
  Radio
} from 'lucide-react';

interface SidebarProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  brandName: string;
  location: string;
  onLocationChange: (city: string) => void;
  theme: 'light' | 'dark' | null;
  onToggleTheme: () => void;
  user: string | null;
  onAuthClick: () => void;
  onAdminClick: () => void;
  sections?: SectionConfig;
  onRefreshPrices?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  brandName,
  location,
  onLocationChange,
  theme,
  onToggleTheme,
  user,
  onAuthClick,
  onAdminClick,
  sections,
  onRefreshPrices,
}) => {
  const navItems: { id: NavView; label: string; icon: React.ReactNode }[] = [
    ...(sections?.home !== false ? [{ id: 'home' as NavView, label: 'Home', icon: <Home className="w-4 h-4" /> }] : []),
    { id: 'search' as NavView, label: 'Search & Compare', icon: <Search className="w-4 h-4" /> },
    ...(sections?.shop !== false ? [{ id: 'shop' as NavView, label: 'Shopping', icon: <ShoppingBag className="w-4 h-4" /> }] : []),
    ...(sections?.food !== false ? [{ id: 'food' as NavView, label: 'Food & Dining', icon: <UtensilsCrossed className="w-4 h-4" /> }] : []),
    ...(sections?.qc !== false ? [{ id: 'qc' as NavView, label: 'Quick Groceries', icon: <Zap className="w-4 h-4" /> }] : []),
    ...(sections?.coupons !== false ? [{ id: 'coupons' as NavView, label: 'Coupons & Codes', icon: <Ticket className="w-4 h-4" /> }] : []),
    ...(sections?.deals !== false ? [{ id: 'deals' as NavView, label: 'Today’s Deals', icon: <Flame className="w-4 h-4" /> }] : []),
    ...(sections?.ai !== false ? [{ id: 'ai' as NavView, label: 'DealNest AI', icon: <Bot className="w-4 h-4" /> }] : []),
  ];

  return (
    <aside className="sticky top-0 self-start h-screen w-[240px] p-4 bg-[var(--card)] border-r-2 border-[var(--bd)] flex flex-col gap-3.5 z-30 select-none shadow-[2px_0_0_rgba(18,16,43,0.05)]">
      {/* Brand Logo with live pricing tagline */}
      <button
        onClick={() => onNavigate(sections?.home !== false ? 'home' : 'search')}
        className="flex items-center gap-2.5 text-left bg-transparent border-0 p-1 mb-1 text-[var(--ink)] cursor-pointer group"
      >
        <div className="w-9 h-9 rounded-xl bg-[var(--lime)] border-2 border-[var(--bd)] flex items-center justify-center shadow-[2px_2px_0_var(--bd)] group-hover:translate-x-[-1px] group-hover:translate-y-[-1px] transition-transform">
          <svg width="22" height="22" viewBox="0 0 32 32">
            <path d="M7 20c0-6 4-10 9-10s9 4 9 10" fill="none" stroke="#5b3df5" strokeWidth="4" strokeLinecap="round"/>
            <circle cx="16" cy="20" r="4" fill="#12102b"/>
          </svg>
        </div>
        <div>
          <span className="font-display font-extrabold text-xl text-[var(--ink)] tracking-tight block leading-none">
            {brandName}
          </span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider font-extrabold flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
            <span>Live price checks</span>
          </span>
        </div>
      </button>

      {/* Main Navigation List */}
      <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
        {navItems.map(item => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between py-2 px-3 rounded-xl border-2 transition-all cursor-pointer text-sm ${
                isActive
                  ? 'bg-[var(--lime)] border-[var(--bd)] text-[#12102b] font-extrabold shadow-[2px_2px_0_var(--bd)]'
                  : 'bg-transparent border-transparent text-[var(--ink)] font-semibold hover:bg-[var(--bg)] hover:border-[var(--bd)]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {item.icon}
                <span>{item.label}</span>
              </div>
            </button>
          );
        })}
      </nav>

      {/* Manual data refresh */}
      <div className="p-2.5 rounded-xl bg-[var(--bg)] border border-[var(--bd)] text-[11px] space-y-1.5">
        <div className="flex items-center justify-between font-bold text-[var(--ink)]">
          <span className="flex items-center gap-1">
            <Radio className="w-3 h-3 text-emerald-500" />
            <span>Refresh deal data</span>
          </span>
        </div>
        {onRefreshPrices && (
          <button
            type="button"
            onClick={onRefreshPrices}
            className="w-full text-[10px] font-extrabold bg-[var(--card)] hover:bg-[var(--lime)] hover:text-[#12102b] text-[var(--ink)] py-1 px-2 rounded-lg border border-[var(--bd)] transition-all flex items-center justify-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh available deals</span>
          </button>
        )}
      </div>

      {/* City Location Selector */}
      <div className="pt-2 border-t-2 border-[var(--bd)] space-y-1">
        <label className="text-[10px] uppercase font-bold text-[var(--mut)] tracking-wider block">
          Current Location
        </label>
        <select
          value={location}
          onChange={e => onLocationChange(e.target.value)}
          className="dn-input text-xs w-full py-1.5 font-bold cursor-pointer"
        >
          {CITIES.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Bottom Controls: User, Admin, Dark Mode */}
      <div className="pt-2 border-t-2 border-[var(--bd)] space-y-2">
        <button
          onClick={onAuthClick}
          className="w-full dn-btn dn-btn-secondary text-xs py-1.5 justify-start px-2.5 cursor-pointer"
        >
          <User className="w-3.5 h-3.5 text-[var(--pri)]" />
          <span className="truncate">{user ? user : 'Sign In / Account'}</span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onAdminClick}
            className={`dn-btn text-xs py-1.5 px-2 flex-1 justify-center cursor-pointer ${
              currentView === 'admin' ? 'dn-btn-lime' : 'dn-btn-secondary'
            }`}
            title="Admin & Affiliate Controls"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="truncate">Admin</span>
          </button>

          <button
            onClick={onToggleTheme}
            className="dn-btn dn-btn-secondary text-xs py-1.5 px-2 flex-shrink-0 cursor-pointer"
            title="Toggle color theme"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-3.5 h-3.5 text-amber-500" />
            ) : (
              <Moon className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};
