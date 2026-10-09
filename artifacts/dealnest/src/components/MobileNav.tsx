import React from 'react';
import { NavView, SectionConfig } from '../types';
import { Home, Search, Flame, Ticket, User, Bot } from 'lucide-react';

interface MobileNavProps {
  currentView: NavView;
  onNavigate: (view: NavView) => void;
  user: string | null;
  sections?: SectionConfig;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentView,
  onNavigate,
  user,
  sections,
}) => {
  const items: { id: NavView; label: string; icon: React.ReactNode }[] = [
    ...(sections?.home !== false ? [{ id: 'home' as NavView, label: 'Home', icon: <Home className="w-4 h-4" /> }] : []),
    { id: 'search', label: 'Search', icon: <Search className="w-4 h-4" /> },
    ...(sections?.deals !== false ? [{ id: 'deals' as NavView, label: 'Deals', icon: <Flame className="w-4 h-4" /> }] : []),
    ...(sections?.coupons !== false ? [{ id: 'coupons' as NavView, label: 'Coupons', icon: <Ticket className="w-4 h-4" /> }] : []),
    ...(sections?.ai !== false ? [{ id: 'ai' as NavView, label: 'AI', icon: <Bot className="w-4 h-4" /> }] : []),
    { id: 'account', label: user || 'Profile', icon: <User className="w-4 h-4" /> },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-[var(--card)] border-t-2 border-[var(--bd)] py-1.5 px-2 flex justify-around items-center z-40 select-none pb-[calc(6px+env(safe-area-inset-bottom,0px))] shadow-[0_-4px_10px_rgba(0,0,0,0.06)]">
      {items.map(item => {
        const isActive = currentView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl border-2 transition-all ${
              isActive
                ? 'bg-[var(--lime)] border-[var(--bd)] text-[#12102b] font-bold shadow-[2px_2px_0_var(--bd)]'
                : 'border-transparent text-[var(--mut)] font-medium'
            }`}
          >
            {item.icon}
            <span className="text-[10px] mt-0.5 max-w-[60px] truncate">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
