import React, { useState, useMemo } from 'react';
import { Item, PriceAlert } from '../types';
import { fmt, scoreOffers } from '../utils';
import { 
  Bookmark, 
  Bell, 
  History, 
  Settings, 
  Trash2, 
  Heart, 
  ArrowUpDown, 
  ShoppingBag, 
  UtensilsCrossed, 
  Zap, 
  ExternalLink,
  ChevronRight,
  Filter
} from 'lucide-react';

interface AccountViewProps {
  user: string | null;
  enrolledUser?: { name: string; code?: string; codeId?: string } | null;
  savedItemIds: string[];
  allItems: Item[];
  alerts: PriceAlert[];
  searchHistory: string[];
  onRemoveAlert: (index: number) => void;
  onClearAllData: () => void;
  onNavigateSearch: (q: string) => void;
  onGetDeal: (item: Item, platform: string) => void;
  onToast: (msg: string) => void;
  onToggleSave?: (id: string) => void;
  onLogoutUser?: () => void;
  onNavigateAdmin?: () => void;
}

type SavedCategoryFilter = 'all' | 'shop' | 'food' | 'qc';
type SavedSortOption = 'category' | 'price-asc' | 'price-desc' | 'name' | 'discount';

export const AccountView: React.FC<AccountViewProps> = ({
  user,
  enrolledUser,
  savedItemIds,
  allItems,
  alerts,
  searchHistory,
  onRemoveAlert,
  onClearAllData,
  onNavigateSearch,
  onGetDeal,
  onToast,
  onToggleSave,
  onLogoutUser,
  onNavigateAdmin,
}) => {
  // Category filter state for My Deals
  const [selectedCategory, setSelectedCategory] = useState<SavedCategoryFilter>('all');
  // Sort state for My Deals
  const [sortBy, setSortBy] = useState<SavedSortOption>('category');

  const allSavedItems = useMemo(() => {
    return allItems.filter(i => savedItemIds.includes(i.id));
  }, [allItems, savedItemIds]);

  // Counts by category
  const categoryCounts = useMemo(() => {
    return {
      all: allSavedItems.length,
      shop: allSavedItems.filter(i => i.type === 'shop').length,
      food: allSavedItems.filter(i => i.type === 'food' || i.type === 'cafe').length,
      qc: allSavedItems.filter(i => i.type === 'qc').length,
    };
  }, [allSavedItems]);

  // Filtered and Sorted Saved Items
  const processedSavedItems = useMemo(() => {
    // 1. Filter by category
    const filtered = allSavedItems.filter(item => {
      if (selectedCategory === 'all') return true;
      if (selectedCategory === 'shop') return item.type === 'shop';
      if (selectedCategory === 'food') return item.type === 'food' || item.type === 'cafe';
      if (selectedCategory === 'qc') return item.type === 'qc';
      return true;
    });

    // 2. Sort items
    return [...filtered].sort((a, b) => {
      const getBestOffer = (item: Item) => {
        const scored = scoreOffers(item);
        const valid = scored.filter(o => !o.na && o.price != null);
        return valid.length ? valid.reduce((p, c) => ((c.t ?? 9e9) < (p.t ?? 9e9) ? c : p)) : null;
      };

      const bestA = getBestOffer(a);
      const bestB = getBestOffer(b);
      const priceA = bestA ? (a.type === 'food' || a.type === 'cafe' ? (bestA.t ?? 9e9) : (bestA.price ?? 9e9)) : a.mrp;
      const priceB = bestB ? (b.type === 'food' || b.type === 'cafe' ? (bestB.t ?? 9e9) : (bestB.price ?? 9e9)) : b.mrp;

      if (sortBy === 'price-asc') {
        return priceA - priceB;
      }
      if (sortBy === 'price-desc') {
        return priceB - priceA;
      }
      if (sortBy === 'discount') {
        const discA = bestA ? bestA.disc : 0;
        const discB = bestB ? bestB.disc : 0;
        return discB - discA;
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      // default: category grouping
      const catOrder: Record<string, number> = { shop: 1, food: 2, cafe: 2, qc: 3 };
      const diff = (catOrder[a.type] || 4) - (catOrder[b.type] || 4);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });
  }, [allSavedItems, selectedCategory, sortBy]);

  const handleNotificationToggle = (checked: boolean) => {
    if (checked && 'Notification' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          onToast('Browser push notifications activated!');
        } else {
          onToast('Notification permission was denied.');
        }
      });
    } else {
      onToast('Notifications disabled.');
    }
  };

  const getCategoryLabel = (type: string) => {
    if (type === 'shop') return { label: 'Shopping', color: 'bg-rose-100 text-rose-800' };
    if (type === 'food' || type === 'cafe') return { label: 'Food', color: 'bg-amber-100 text-amber-800' };
    return { label: 'Grocery', color: 'bg-lime-100 text-lime-800' };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)] font-display tracking-tight">
            {user ? `${user}’s Dashboard` : 'Guest Shopper Dashboard'}
          </h2>
          <p className="text-sm text-[var(--mut)]">
            Manage your saved deals, category filters, price drop triggers, and shopping history.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Saved Deals / My Deals (Expanded Width) */}
        <div className="dn-card lg:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-[var(--cor)]" />
                <h3 className="text-lg font-bold text-[var(--ink)] font-display">
                  My Deals & Watchlist ({allSavedItems.length})
                </h3>
              </div>

              {/* Sort By Dropdown */}
              <div className="flex items-center gap-1.5 text-xs">
                <ArrowUpDown className="w-3.5 h-3.5 text-[var(--mut)]" />
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as SavedSortOption)}
                  className="dn-input text-xs py-1 px-2 font-semibold cursor-pointer"
                  aria-label="Sort saved deals"
                >
                  <option value="category">Sort: Category</option>
                  <option value="price-asc">Sort: Lowest Price</option>
                  <option value="price-desc">Sort: Highest Price</option>
                  <option value="discount">Sort: Highest Discount</option>
                  <option value="name">Sort: Name (A-Z)</option>
                </select>
              </div>
            </div>

            {/* Quick Category Filter Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 border-b border-[var(--bd)]/20">
              <span className="text-[11px] font-bold text-[var(--mut)] uppercase tracking-wider flex items-center gap-1 mr-1">
                <Filter className="w-3 h-3" />
                <span>Filter:</span>
              </span>

              {[
                { id: 'all' as const, label: 'All', icon: null, count: categoryCounts.all },
                { id: 'shop' as const, label: 'Shopping', icon: <ShoppingBag className="w-3 h-3" />, count: categoryCounts.shop },
                { id: 'food' as const, label: 'Food', icon: <UtensilsCrossed className="w-3 h-3" />, count: categoryCounts.food },
                { id: 'qc' as const, label: 'Grocery', icon: <Zap className="w-3 h-3" />, count: categoryCounts.qc },
              ].map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`dn-chip text-xs py-1 px-2.5 flex items-center gap-1.5 transition-all cursor-pointer ${
                    selectedCategory === cat.id ? 'on font-bold shadow-[2px_2px_0_var(--bd)]' : 'font-medium'
                  }`}
                >
                  {cat.icon}
                  <span>{cat.label}</span>
                  <span className={`text-[10px] px-1 rounded-full ${
                    selectedCategory === cat.id ? 'bg-[var(--lime)] text-[#12102b]' : 'bg-[var(--bg)] text-[var(--mut)]'
                  }`}>
                    {cat.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Saved Items List */}
            {allSavedItems.length === 0 ? (
              <div className="text-center py-8 px-4 bg-[var(--bg)] rounded-2xl border border-[var(--bd)]">
                <span className="text-3xl block mb-2">🤍</span>
                <p className="text-sm font-bold text-[var(--ink)]">Nothing saved in My Deals yet</p>
                <p className="text-xs text-[var(--mut)] mt-1 max-w-xs mx-auto">
                  Tap the heart icon on any shopping, food, or grocery deal to track prices in one place.
                </p>
              </div>
            ) : processedSavedItems.length === 0 ? (
              <div className="text-center py-6 px-4 bg-[var(--bg)] rounded-2xl border border-[var(--bd)]">
                <p className="text-sm font-semibold text-[var(--ink)]">
                  No saved deals found in this category.
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className="dn-btn dn-btn-secondary text-xs py-1.5 px-3 mt-2"
                >
                  Show All Saved Deals ({allSavedItems.length})
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                {processedSavedItems.map(item => {
                  const catInfo = getCategoryLabel(item.type);
                  const scored = scoreOffers(item);
                  const valid = scored.filter(o => !o.na && o.price != null);
                  const best = valid.length ? valid.reduce((p, c) => ((c.t ?? 9e9) < (p.t ?? 9e9) ? c : p)) : null;
                  const bestPrice = best ? (item.type === 'food' || item.type === 'cafe' ? best.t : best.price) : item.mrp;

                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl border-2 border-[var(--bd)] bg-[var(--card)] hover:bg-[var(--bg)] transition-all flex items-center justify-between gap-3 shadow-[2px_2px_0_var(--bd)]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-2xl p-1 bg-[var(--bg)] border border-[var(--bd)] rounded-xl flex-shrink-0">
                          {item.em}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-[var(--ink)] truncate">
                              {item.name}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border border-[var(--bd)]/30 ${catInfo.color}`}>
                              {catInfo.label}
                            </span>
                          </div>

                          <div className="text-xs text-[var(--mut)] flex items-center gap-2 mt-0.5">
                            {best ? (
                              <>
                                <span className="font-extrabold text-emerald-600 font-display">
                                  {fmt(bestPrice)} on {best.p}
                                </span>
                                <span>·</span>
                                <span className="bg-[var(--cor)] text-white text-[10px] font-bold px-1 rounded">
                                  {best.disc}% OFF
                                </span>
                              </>
                            ) : (
                              <span>MRP {fmt(item.mrp)}</span>
                            )}
                          </div>

                          {best?.coupon && (
                            <div className="text-[11px] font-semibold text-[var(--pri)] truncate mt-0.5">
                              🏷️ {best.coupon}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => onNavigateSearch(item.name)}
                          className="dn-btn py-1 px-3 text-xs font-bold flex items-center gap-1"
                          title="Compare all platform prices"
                        >
                          <span>Compare</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>

                        {onToggleSave && (
                          <button
                            type="button"
                            onClick={() => onToggleSave(item.id)}
                            className="p-1.5 rounded-lg border border-[var(--bd)] text-[var(--mut)] hover:text-[var(--cor)] hover:bg-[var(--bg)] cursor-pointer"
                            title="Remove from My Deals"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {allSavedItems.length > 0 && (
            <div className="pt-3 mt-3 border-t border-[var(--bd)]/20 flex items-center justify-between text-xs text-[var(--mut)]">
              <span>Showing {processedSavedItems.length} of {allSavedItems.length} deals</span>
              {selectedCategory !== 'all' && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory('all')}
                  className="font-bold text-[var(--pri)] hover:underline cursor-pointer"
                >
                  Reset filter
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Alerts, History & Settings */}
        <div className="lg:col-span-5 space-y-4">
          {/* Price Alerts */}
          <div className="dn-card">
            <h3 className="text-base font-bold text-[var(--ink)] flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-[var(--pri)]" />
              <span>Active Price Alerts ({alerts.length})</span>
            </h3>

            {alerts.length === 0 ? (
              <p className="text-xs text-[var(--mut)] italic py-2">
                No price drop alerts set. Click “🔔 Price Alert” on any product to get notified when prices plummet.
              </p>
            ) : (
              <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
                {alerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl border border-[var(--bd)] bg-[var(--bg)] text-xs"
                  >
                    <div>
                      <span className="font-bold text-[var(--ink)]">{alert.n}</span>
                      <div className="text-[11px] text-[var(--mut)]">
                        Notify below <span className="font-extrabold text-emerald-600">{fmt(alert.t)}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemoveAlert(idx)}
                      className="text-[var(--cor)] hover:text-red-700 p-1 cursor-pointer"
                      title="Remove alert"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Search History */}
          <div className="dn-card">
            <h3 className="text-base font-bold text-[var(--ink)] flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-[var(--mut)]" />
              <span>Recent Searches</span>
            </h3>

            {searchHistory.length === 0 ? (
              <p className="text-xs text-[var(--mut)] italic py-2">
                No recent searches recorded on this device.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-[130px] overflow-y-auto">
                {searchHistory.slice(0, 10).map((term, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onNavigateSearch(term)}
                    className="dn-chip text-xs py-1 px-2.5"
                  >
                    {term}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Member Access Pass & Security Card */}
          <div className="dn-card border-2 border-[var(--bd)] bg-[var(--card)]">
            <h3 className="text-base font-extrabold text-[var(--ink)] flex items-center justify-between mb-2">
              <span className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Enrolled Member Access</span>
              </span>
              <span className="bg-[var(--lime)] text-[#12102b] text-[10px] font-black uppercase px-2 py-0.5 rounded border border-[var(--bd)]">
                Active Pass
              </span>
            </h3>

            <p className="text-xs text-[var(--mut)] mb-3 leading-relaxed">
              You are enrolled in DealNest via a verified administrator access code. Catalog comparisons and member features are unlocked.
            </p>

            {enrolledUser?.code && (
              <div className="p-2.5 rounded-xl bg-[var(--bg)] border border-[var(--bd)] text-xs mb-3 flex items-center justify-between">
                <span className="text-[var(--mut)]">Pass Code:</span>
                <span className="font-mono font-bold text-[var(--pri)]">{enrolledUser.code}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-[var(--bd)]/20">
              {onLogoutUser && (
                <button
                  type="button"
                  onClick={onLogoutUser}
                  className="dn-btn dn-btn-secondary text-xs py-1.5 px-3 text-[var(--cor)] flex-1 justify-center"
                >
                  Sign Out / Exit Session
                </button>
              )}
              {onNavigateAdmin && (
                <button
                  type="button"
                  onClick={onNavigateAdmin}
                  className="dn-btn dn-btn-secondary text-xs py-1.5 px-3 flex-1 justify-center"
                >
                  Admin Control Portal
                </button>
              )}
            </div>
          </div>

          {/* Settings & Preferences */}
          <div className="dn-card">
            <h3 className="text-base font-bold text-[var(--ink)] flex items-center gap-2 mb-3">
              <Settings className="w-4 h-4 text-[var(--pri)]" />
              <span>Preferences & Data</span>
            </h3>

            <div className="space-y-3 text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-medium">
                <input
                  type="checkbox"
                  onChange={e => handleNotificationToggle(e.target.checked)}
                  className="w-4 h-4 rounded text-[var(--pri)]"
                />
                <span>Enable instant price drop push notifications</span>
              </label>

              <div className="pt-2 border-t border-[var(--bd)]/20">
                <button
                  type="button"
                  onClick={onClearAllData}
                  className="dn-btn dn-btn-secondary text-xs text-[var(--cor)] py-1.5 px-3 flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Local Data & History</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
