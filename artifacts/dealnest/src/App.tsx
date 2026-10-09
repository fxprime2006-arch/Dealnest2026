import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Item, 
  CouponItem, 
  AppState, 
  NavView, 
  SortOption, 
  PriceAlert, 
  ClickRecord,
  SectionConfig
} from './types';
import { 
  INITIAL_ITEMS, 
  INITIAL_COUPONS, 
  PLATFORM_COLORS 
} from './data';
import { 
  scoreOffers, 
  searchCatalog, 
  parseUrlInfo, 
  generatePartnerUrl, 
  isSafeOutboundUrl,
  fmt, 
  tot,
  SORT_COMPARATORS 
} from './utils';

import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { HeroSearch } from './components/HeroSearch';
import { DealCard } from './components/DealCard';
import { CouponCard } from './components/CouponCard';
import { AiAssistant } from './components/AiAssistant';
import { AccountView } from './components/AccountView';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminLoginView } from './components/AdminLoginView';
import { EnrollmentLandingView } from './components/EnrollmentLandingView';
import { EnrolledUser, CrossPlatformAnalysisResult, SiteConfig } from './types';
import { 
  Trophy, 
  ExternalLink, 
  CheckCircle2, 
  Sparkles, 
  Loader2 
} from 'lucide-react';
import { 
  PriceAlertModal, 
  AuthModal, 
  LegalModal, 
  LegalModalType 
} from './components/Modals';
import { OutboundModal } from './components/OutboundModal';
import { PriceHistoryModal } from './components/PriceHistoryModal';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { ProductLinkInspectorModal } from './components/ProductLinkInspectorModal';
import { ThreeDLoader } from './components/ThreeDLoader';
import { GlobalDisclaimerModal, DisclaimerPayload } from './components/GlobalDisclaimerModal';
import { PlatformSourceDirectory } from './components/PlatformSourceDirectory';
import { ALL_DIRECTORY_PLATFORMS, PLATFORM_GROUPS } from './platformDirectory';
import { VERIFIED_COUPONS } from './verifiedOffers';
import { DEAL_DIRECTORY_PAGE_SIZE, DEAL_DIRECTORY_TOTAL, getDealDirectoryRecords } from './dealDirectory';

type LiveFeedDrop = {
  id: string;
  platform: string;
  price: number;
};

const LIVE_DROP_ITEM_IDS: Record<string, string> = {
  iph: 'iph',
  air: 'app',
  bir: 'bir',
  mlk: 'mlk',
  piz: 'piz',
};

function applyLiveFeedDrops(items: Item[], drops: LiveFeedDrop[]): Item[] {
  return items.map(item => {
    const drop = drops.find(candidate => LIVE_DROP_ITEM_IDS[candidate.id] === item.id);
    if (!drop || !Number.isFinite(drop.price) || drop.price <= 0) return item;
    return {
      ...item,
      o: item.o.map(offer => offer.p === drop.platform ? { ...offer, price: drop.price } : offer),
    };
  });
}

export default function App() {
  // Application State
  const [state, setState] = useState<AppState>(() => {
    const saved = localStorage.getItem('dealnest_state');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // fallback
      }
    }
    return {
      demo: false,
      loc: 'Hyderabad',
      saved: ['iph', 'bir'],
      alerts: [
        { id: 'iph', n: 'iPhone 17 256GB', t: 80000 },
        { id: 'mlk', n: 'Amul Milk 1L', t: 63 }
      ],
      clicks: [],
      hist: ['iPhone 17', 'Chicken Biryani', 'Milk 1L'],
      plat: {},
      user: null,
      aff: {},
      brand: 'DealNest',
      theme: null,
      q: '',
    };
  });

  const [items, setItems] = useState<Item[]>(INITIAL_ITEMS);
  const [coupons, setCoupons] = useState<CouponItem[]>(VERIFIED_COUPONS);
  const [view, setView] = useState<NavView>('home');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchCategoryTab, setSearchCategoryTab] = useState<'all' | 'shop' | 'food' | 'qc'>('all');
  const [currentSort, setCurrentSort] = useState<SortOption>('rec');
  const [dealsBudgetCap, setDealsBudgetCap] = useState<number>(0);
  const [directoryPage, setDirectoryPage] = useState<number>(0);
  const [directoryCategory, setDirectoryCategory] = useState<string>('all');
  const [directoryPlatform, setDirectoryPlatform] = useState<string>('all');
  const [crossPlatformResult, setCrossPlatformResult] = useState<CrossPlatformAnalysisResult | null>(null);
  const [isAnalyzingQuery, setIsAnalyzingQuery] = useState<boolean>(false);

  const directoryRecords = useMemo(
    () => getDealDirectoryRecords(directoryPage * DEAL_DIRECTORY_PAGE_SIZE, DEAL_DIRECTORY_PAGE_SIZE, directoryCategory, directoryPlatform),
    [directoryPage, directoryCategory, directoryPlatform]
  );

  // Manual connected-data lookup state
  const [tickerText, setTickerText] = useState<string>('⚡ DealNest compares available catalog data. Refresh when you want a fresh lookup.');
  const [isTickerFlashing, setIsTickerFlashing] = useState<boolean>(false);
  const [flashingKey, setFlashingKey] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Modals
  const [activeAlertItem, setActiveAlertItem] = useState<Item | null>(null);
  const [activeHistoryItem, setActiveHistoryItem] = useState<Item | null>(null);
  const [showScannerModal, setShowScannerModal] = useState<boolean>(false);
  const [showLinkInspector, setShowLinkInspector] = useState<boolean>(false);
  const [linkInspectorUrl, setLinkInspectorUrl] = useState<string>('');
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
  const [activeLegalModal, setActiveLegalModal] = useState<LegalModalType | null>(null);
  const [outboundData, setOutboundData] = useState<{
    platform: string;
    url: string | null;
    itemName?: string;
    couponCode?: string | null;
    currentPrice?: number | null;
    itemId?: string;
  } | null>(null);

  // User Enrollment & Admin Session State
  const [userToken, setUserToken] = useState<string | null>(() => {
    return localStorage.getItem('dealnest_user_token');
  });
  const [enrolledUser, setEnrolledUser] = useState<EnrolledUser | null>(() => {
    const raw = localStorage.getItem('dealnest_enrolled_user');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // fallback
      }
    }
    return null;
  });
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    return sessionStorage.getItem('dealnest_admin_token');
  });
  const [adminNeedsChange, setAdminNeedsChange] = useState<boolean>(() => {
    return sessionStorage.getItem('dealnest_admin_needs_change') === 'true';
  });
  const [siteConfig, setSiteConfig] = useState<SiteConfig>({
    accessGateEnabled: true,
    defaultCustomerView: 'home',
    defaultLocation: 'Hyderabad',
    disclaimerVersion: 1,
    disclaimerText: '',
    disclaimerUpdatedAt: 0,
  });
  const [globalDisclaimer, setGlobalDisclaimer] = useState<DisclaimerPayload | null>(null);
  const [isVerifyingSession, setIsVerifyingSession] = useState<boolean>(true);
  const [showLaunchSequence, setShowLaunchSequence] = useState<boolean>(true);

  useEffect(() => {
    fetch('/api/catalog/managed')
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        const records = Array.isArray(data?.records) ? data.records : [];
        const managedDeals = records.filter((record: any) => record.kind === 'deal' && Number.isFinite(record.price)).map((record: any) => ({
          id: record.id, name: record.title, type: ['food', 'cafe', 'qc'].includes(record.category) ? record.category : 'shop', em: '✨', mrp: record.price, pop: 70,
          o: [{ p: record.platform, price: record.price, rating: null, eta: null, fee: 0, coupon: record.couponCode || record.discount || null, directUrl: record.sourceUrl, isVerified: false }],
        }));
        const managedCoupons = records.filter((record: any) => record.kind === 'coupon').map((record: any) => ({
          platform: record.platform, title: record.title, code: record.couponCode || null, minOrder: 0, expires: 'Check source', category: ['food', 'grocery'].includes(record.category) ? record.category : 'shop', audience: 'all', discount: record.discount, sourceNote: record.sourceNote, sourceUrl: record.sourceUrl, isLive: false, sourceType: 'unofficial',
        }));
        if (managedDeals.length) setItems(previous => [...previous.filter(item => !item.id.startsWith('managed_')), ...managedDeals]);
        if (managedCoupons.length) setCoupons(previous => [...previous.filter(coupon => !coupon.sourceUrl?.includes('managed_')), ...managedCoupons]);
      })
      .catch(() => undefined);
  }, []);

  // A short, bounded first-impression animation: it never replaces session
  // verification and is automatically skipped after 3.2 seconds.
  useEffect(() => {
    const timer = window.setTimeout(() => setShowLaunchSequence(false), 3200);
    return () => window.clearTimeout(timer);
  }, []);

  // Verify server-side session tokens on startup
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();
    const verificationTimeout = window.setTimeout(() => controller.abort(), 5000);

    const verifySessions = async () => {
      try {
        const configRes = await fetch('/api/public/config', { signal: controller.signal });
        const configData = await configRes.json();
        if (isMounted && configRes.ok && configData.success && configData.config) {
          const nextConfig = configData.config as SiteConfig;
          setSiteConfig(nextConfig);
          setState(prev => ({ ...prev, loc: nextConfig.defaultLocation }));
          setView(nextConfig.defaultCustomerView);
        }
      } catch {
        // Keep secure defaults if public settings are unavailable.
      }

      // 1. Verify user enrollment session token
      const savedUserToken = localStorage.getItem('dealnest_user_token');
      if (savedUserToken) {
        try {
          const res = await fetch('/api/enroll/session', {
            headers: { Authorization: `Bearer ${savedUserToken}` },
            signal: controller.signal,
          });
          const data = await res.json();
          if (isMounted) {
            if (res.ok && data.valid && data.user) {
              setEnrolledUser(data.user);
              setUserToken(savedUserToken);
              if (data.disclaimer) setGlobalDisclaimer(data.disclaimer);
            } else {
              // Token invalid or revoked on server
              setUserToken(null);
              setEnrolledUser(null);
              localStorage.removeItem('dealnest_user_token');
              localStorage.removeItem('dealnest_enrolled_user');
            }
          }
        } catch {
          // Keep existing local state on network error
        }
      }

      // 2. Verify admin session token
      const savedAdminToken = sessionStorage.getItem('dealnest_admin_token');
      if (savedAdminToken) {
        try {
          const res = await fetch('/api/admin/status', {
            headers: { Authorization: `Bearer ${savedAdminToken}` },
            signal: controller.signal,
          });
          const data = await res.json();
          if (isMounted) {
            if (!res.ok || !data.authenticated) {
              setAdminToken(null);
              sessionStorage.removeItem('dealnest_admin_token');
            }
          }
        } catch {
          // Keep existing local state on network error
        }
      }

      if (isMounted) {
        setIsVerifyingSession(false);
      }
    };

    verifySessions().finally(() => window.clearTimeout(verificationTimeout));

    return () => {
      isMounted = false;
      window.clearTimeout(verificationTimeout);
      controller.abort();
    };
  }, []);

  // Check the exact current disclaimer on reload and listen for global admin updates.
  useEffect(() => {
    if (!userToken) {
      setGlobalDisclaimer(null);
      return;
    }
    let mounted = true;
    const loadDisclaimer = async () => {
      try {
        const response = await fetch('/api/disclaimer/current', { headers: { Authorization: `Bearer ${userToken}` } });
        const data = await response.json();
        if (mounted && response.ok && data.success) setGlobalDisclaimer(data.disclaimer);
      } catch {
        // Keep the last known lock state; fail closed when a required modal is already visible.
      }
    };
    loadDisclaimer();
    const events = new EventSource(`/api/disclaimer/stream?token=${encodeURIComponent(userToken)}`);
    events.addEventListener('disclaimer.updated', event => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        if (mounted) setGlobalDisclaimer({ ...data, required: true });
      } catch {
        // Ignore malformed broadcast data.
      }
    });
    return () => {
      mounted = false;
      events.close();
    };
  }, [userToken]);

  useEffect(() => {
    if (!userToken || globalDisclaimer?.required) return;
    fetch('/api/audit/resource', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${userToken}` },
      body: JSON.stringify({ resource: view }),
    }).catch(() => {
      // Audit logging must not interrupt free resource access.
    });
  }, [userToken, view, globalDisclaimer?.required]);

  // Auth & Enrollment handlers
  const handleEnrollSuccess = (token: string, user: EnrolledUser) => {
    setUserToken(token);
    setEnrolledUser(user);
    localStorage.setItem('dealnest_user_token', token);
    localStorage.setItem('dealnest_enrolled_user', JSON.stringify(user));
    setState(prev => ({ ...prev, user: user.name }));
    setView(activeSections.home !== false ? 'home' : 'search');
    showToast(`Access granted! Welcome, ${user.name}.`);
  };

  const handleUserLogout = async () => {
    if (userToken) {
      try {
        await fetch('/api/enroll/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${userToken}` },
        });
      } catch {
        // ignore
      }
    }
    setUserToken(null);
    setEnrolledUser(null);
    localStorage.removeItem('dealnest_user_token');
    localStorage.removeItem('dealnest_enrolled_user');
    setState(prev => ({ ...prev, user: null }));
    showToast('Signed out of DealNest session.');
  };

  const handleAdminLoginSuccess = (token: string, needsChange: boolean) => {
    setAdminToken(token);
    setAdminNeedsChange(needsChange);
    sessionStorage.setItem('dealnest_admin_token', token);
    sessionStorage.setItem('dealnest_admin_needs_change', String(needsChange));
    setView('admin');
    showToast('Admin credentials verified. Welcome to Admin Dashboard!');
  };

  const handleSiteConfigChange = (next: SiteConfig) => {
    setSiteConfig(next);
    setState(prev => ({ ...prev, loc: next.defaultLocation }));
    // Admin settings are loaded by the dashboard itself; do not redirect the
    // administrator away while the customer default view is being synchronized.
    setView(currentView => (
      currentView === 'admin' || currentView === 'admin-login'
        ? currentView
        : next.defaultCustomerView
    ));
  };

  const handleAdminLogout = async () => {
    if (adminToken) {
      try {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}` },
        });
      } catch {
        // ignore
      }
    }
    setAdminToken(null);
    sessionStorage.removeItem('dealnest_admin_token');
    sessionStorage.removeItem('dealnest_admin_needs_change');
    showToast('Admin session terminated.');
    setView('home');
  };

  // Save state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('dealnest_state', JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  // Sync theme
  useEffect(() => {
    const root = document.documentElement;
    if (state.theme) {
      root.dataset.theme = state.theme;
    } else {
      delete root.dataset.theme;
    }
  }, [state.theme]);

  // Toast helper
  const showToast = (msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  const handleUpdateItemPrice = (itemId: string, platform: string, newPrice: number) => {
    setItems(prevItems =>
      prevItems.map(item => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          o: item.o.map(offer => {
            if (offer.p !== platform) return offer;
            return { ...offer, price: newPrice };
          }),
        };
      })
    );
    setTickerText(`⚡ Manual catalog update: ${platform} price changed to ${fmt(newPrice)}`);
    setFlashingKey(`${itemId}|${platform}`);
    setTimeout(() => setFlashingKey(null), 1400);
    showToast(`Updated ${platform} price to ${fmt(newPrice)}. Confirm the final offer at checkout.`);
  };

  const handleOpenLinkInspector = (url?: string) => {
    setLinkInspectorUrl(url || '');
    setShowLinkInspector(true);
  };

  // Explicit user-triggered data refresh plus a silent one-minute rotation for members.
  const handleRefreshPrices = async (silent = false) => {
    setIsRefreshing(true);
    if (!silent) showToast('Checking available deal data...');

    try {
      const res = await fetch(`/api/market/live-feed?location=${encodeURIComponent(state.loc)}`, { headers: userToken ? { Authorization: `Bearer ${userToken}` } : {} });
      const data = await res.json();
      if (!res.ok || !data?.success || !data.ticker) {
        throw new Error(data?.error || 'Deal-data check failed.');
      }
      if (Array.isArray(data.recentPriceDrops)) {
        setItems(prevItems => applyLiveFeedDrops(prevItems, data.recentPriceDrops));
      }
      setTickerText(data.ticker);
      setIsTickerFlashing(true);
      setTimeout(() => setIsTickerFlashing(false), 1400);
      if (!silent) showToast('Deal data refreshed. Confirm final prices and eligibility at checkout.');
    } catch {
      if (!silent) showToast('Deal-data check failed. Showing the last available catalog record.');
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!userToken || globalDisclaimer?.required) return;
    const rotationTimer = window.setInterval(() => {
      void handleRefreshPrices(true);
    }, 60_000);
    return () => window.clearInterval(rotationTimer);
  }, [userToken, globalDisclaimer?.required, state.loc]);

  const defaultSections: SectionConfig = {
    home: true,
    shop: true,
    food: true,
    qc: true,
    deals: true,
    coupons: true,
    ai: true,
  };

  const activeSections: SectionConfig = {
    ...defaultSections,
    ...(state.sections || {}),
  };

  const handleToggleSection = (sec: keyof SectionConfig, enabled: boolean) => {
    setState(prev => ({
      ...prev,
      sections: {
        ...defaultSections,
        ...(prev.sections || {}),
        [sec]: enabled,
      },
    }));
    if (sec === 'home' && !enabled && view === 'home') {
      setView('search');
    }
    showToast(`${sec.toUpperCase()} section is now ${enabled ? 'Activated' : 'Hidden'} by Admin!`);
  };

  // Automatically route away from homepage if admin hidden
  useEffect(() => {
    if (view === 'home' && activeSections.home === false) {
      setView('search');
    }
  }, [view, activeSections.home]);

  // Actions
  const handleNavigate = (newView: NavView) => {
    if (newView === 'home' && activeSections.home === false) {
      setView('search');
      showToast('Homepage is hidden by administrator. Browsing Deals & Search.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setView(newView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearch = (query: string) => {
    const trimmed = query.trim();
    setSearchQuery(trimmed);
    if (trimmed) {
      setState(prev => ({
        ...prev,
        hist: [trimmed, ...prev.hist.filter(h => h.toLowerCase() !== trimmed.toLowerCase())].slice(0, 30),
      }));
    }
    setView('search');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleSave = (itemId: string) => {
    setState(prev => {
      const exists = prev.saved.includes(itemId);
      const updated = exists
        ? prev.saved.filter(id => id !== itemId)
        : [...prev.saved, itemId];
      showToast(exists ? 'Removed from My Deals' : 'Saved to My Deals ❤️');
      return { ...prev, saved: updated };
    });
  };

  const handleShare = (item: Item) => {
    if (navigator.share) {
      navigator.share({
        title: `${item.name} – Best deals on ${state.brand}`,
        text: `Compare ${item.name} prices across Amazon, Flipkart, Swiggy and quick commerce on ${state.brand}!`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${item.name} – Compare prices on ${state.brand}: ${window.location.href}`);
      showToast('Deal link copied to clipboard!');
    }
  };

  const handleGetDeal = (item: Item, platform: string) => {
    const targetOffer = item.o.find(o => o.p === platform);
    const clickId = 'clk_' + Math.random().toString(36).substring(2, 9);
    const candidateUrl = targetOffer?.directUrl || generatePartnerUrl(platform, item.name, state.aff);
    const destinationUrl = isSafeOutboundUrl(candidateUrl, platform) ? candidateUrl : null;

    // Record outbound click for affiliate analytics
    const clickRecord: ClickRecord = {
      id: clickId,
      p: platform,
      t: Date.now(),
      u: destinationUrl,
      itemName: item.name,
    };

    setState(prev => ({
      ...prev,
      clicks: [clickRecord, ...prev.clicks].slice(0, 50),
    }));

    if (!destinationUrl) {
      setOutboundData({
        platform,
        url: null,
        itemName: item.name,
      });
      return;
    }

    // Present verified outbound link and coupon guidance in iframe-safe modal
    setOutboundData({
      platform,
      url: destinationUrl,
      itemName: item.name,
      couponCode: targetOffer?.coupon || null,
      currentPrice: targetOffer?.price || null,
      itemId: item.id,
    });
  };

  const handleUseCoupon = (platform: string, code?: string) => {
    const destinationUrl = generatePartnerUrl(platform, platform, state.aff);
    setOutboundData({
      platform,
      url: destinationUrl,
      itemName: `${platform} Promotional Offer`,
      couponCode: code || 'Check official page',
    });
  };

  const handleSaveAlert = (targetPrice: number) => {
    if (!activeAlertItem) return;
    setState(prev => ({
      ...prev,
      alerts: [
        ...prev.alerts.filter(a => a.id !== activeAlertItem.id),
        { id: activeAlertItem.id, n: activeAlertItem.name, t: targetPrice },
      ],
    }));
    showToast(`Price drop alert created for ${activeAlertItem.name} below ${fmt(targetPrice)}!`);
  };

  const handleRemoveAlert = (index: number) => {
    setState(prev => {
      const next = [...prev.alerts];
      next.splice(index, 1);
      return { ...prev, alerts: next };
    });
    showToast('Price alert removed.');
  };

  const handleToggleTheme = () => {
    setState(prev => {
      const next = prev.theme === 'dark' ? 'light' : 'dark';
      return { ...prev, theme: next };
    });
  };

  const handleClearAllData = () => {
    setState(prev => ({
      ...prev,
      saved: [],
      alerts: [],
      hist: [],
      clicks: [],
    }));
    showToast('Local history, saved items, and price alerts cleared.');
  };

  // Search Results computation
  const urlInfo = useMemo(() => {
    return parseUrlInfo(searchQuery);
  }, [searchQuery]);

  // Deep Cross-Platform Search & URL Analysis API integration
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setCrossPlatformResult(null);
      setIsAnalyzingQuery(false);
      return;
    }

    let isMounted = true;
    setIsAnalyzingQuery(true);
    setCrossPlatformResult(null);

    const controller = new AbortController();
    fetch('/api/deals/analyze-search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
      },
      body: JSON.stringify({
        query: trimmed,
        location: state.loc,
      }),
      signal: controller.signal,
    })
      .then(async res => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || `Search analysis failed (${res.status}).`);
        return data;
      })
      .then(data => {
        if (isMounted && data && data.success && data.result) {
          setCrossPlatformResult(data.result);
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          if (isMounted) setCrossPlatformResult(null);
          console.warn('Cross-platform search analysis notice:', err);
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsAnalyzingQuery(false);
        }
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [searchQuery, state.loc, userToken]);

  const searchResults = useMemo(() => {
    const effectiveQuery = urlInfo ? (urlInfo.itemName || urlInfo.slug) : searchQuery;
    const matched = searchCatalog(effectiveQuery, items);

    const combined = [...matched];
    if (crossPlatformResult && crossPlatformResult.item) {
      const alreadyIncluded = combined.some(
        it => it.name.toLowerCase() === crossPlatformResult.item?.name.toLowerCase()
      );
      if (!alreadyIncluded) {
        combined.unshift(crossPlatformResult.item);
      }
    }

    return combined.filter(item => {
      if (searchCategoryTab === 'all') return true;
      if (searchCategoryTab === 'shop') return item.type === 'shop';
      if (searchCategoryTab === 'food') return item.type === 'food' || item.type === 'cafe';
      if (searchCategoryTab === 'qc') return item.type === 'qc';
      return true;
    });
  }, [searchQuery, urlInfo, items, searchCategoryTab, crossPlatformResult]);

  // Loading state while checking session validity with backend
  if (isVerifyingSession || showLaunchSequence) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
        <ThreeDLoader label={isVerifyingSession ? 'Securing your session...' : 'Preparing DealNest...'} />
      </div>
    );
  }

  // 1. UNENROLLED USER GATEKEEPING
  // If user does not have a verified secret code, show the Enter Secret Code enrollment page!
  if (siteConfig.accessGateEnabled && (!userToken || !enrolledUser)) {
    // If they explicitly requested administrator portal
    if (view === 'admin' || view === 'admin-login') {
      if (adminToken) {
        return (
          <AdminDashboard
            adminToken={adminToken}
            needsChange={adminNeedsChange}
            brandName={state.brand}
            onBrandNameChange={val => setState(prev => ({ ...prev, brand: val || 'DealNest' }))}
            demoMode={state.demo}
            onToggleDemo={val => setState(prev => ({ ...prev, demo: val }))}
            sections={activeSections}
            siteConfig={siteConfig}
            onSiteConfigChange={handleSiteConfigChange}
            onToggleSection={handleToggleSection}
            disabledPlatforms={state.plat}
            onTogglePlatform={(plat, enabled) => {
              setState(prev => ({ ...prev, plat: { ...prev.plat, [plat]: enabled } }));
            }}
            customAffiliates={state.aff}
            onAffiliateChange={(plat, url) => {
              setState(prev => ({ ...prev, aff: { ...prev.aff, [plat]: url.trim() } }));
            }}
            clicks={state.clicks}
            searchesCount={state.hist.length}
            onLogout={handleAdminLogout}
            onAdminCodeChanged={() => {
              setAdminNeedsChange(false);
              sessionStorage.setItem('dealnest_admin_needs_change', 'false');
            }}
            onToast={showToast}
          />
        );
      }

      return (
        <AdminLoginView
          brandName={state.brand}
          onLoginSuccess={handleAdminLoginSuccess}
          onBackToSite={() => setView('home')}
        />
      );
    }

    // Default for all public visitors: Enter Secret Code Landing Page
    return (
      <EnrollmentLandingView
        brandName={state.brand}
        onEnrollSuccess={handleEnrollSuccess}
        onOpenAdminLogin={() => setView('admin-login')}
      />
    );
  }

  // 2. ENROLLED USER VIEWING ADMIN DASHBOARD
  if (view === 'admin' || view === 'admin-login') {
    if (adminToken) {
      return (
        <AdminDashboard
          adminToken={adminToken}
          needsChange={adminNeedsChange}
          brandName={state.brand}
          onBrandNameChange={val => setState(prev => ({ ...prev, brand: val || 'DealNest' }))}
          demoMode={state.demo}
          onToggleDemo={val => setState(prev => ({ ...prev, demo: val }))}
          sections={activeSections}
          siteConfig={siteConfig}
          onSiteConfigChange={handleSiteConfigChange}
          onToggleSection={handleToggleSection}
          disabledPlatforms={state.plat}
          onTogglePlatform={(plat, enabled) => {
            setState(prev => ({ ...prev, plat: { ...prev.plat, [plat]: enabled } }));
          }}
          customAffiliates={state.aff}
          onAffiliateChange={(plat, url) => {
            setState(prev => ({ ...prev, aff: { ...prev.aff, [plat]: url.trim() } }));
          }}
          clicks={state.clicks}
          searchesCount={state.hist.length}
          onLogout={handleAdminLogout}
          onAdminCodeChanged={() => {
            setAdminNeedsChange(false);
            sessionStorage.setItem('dealnest_admin_needs_change', 'false');
          }}
          onToast={showToast}
        />
      );
    }

    return (
      <AdminLoginView
        brandName={state.brand}
        onLoginSuccess={handleAdminLoginSuccess}
        onBackToSite={() => setView('home')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--ink)] flex flex-col font-sans transition-colors duration-200">
      {/* Top live-data ticker with an explicit manual check */}
      <Header
        tickerText={tickerText}
        isFlashing={isTickerFlashing}
        location={state.loc}
        demoMode={state.demo}
        isRefreshing={isRefreshing}
        onRefreshPrices={handleRefreshPrices}
      />

      <div className="flex-1 flex flex-col md:flex-row max-w-full">
        {/* Desktop Left Rail Navigation */}
        <div className="hidden md:block">
          <Sidebar
            currentView={view}
            onNavigate={handleNavigate}
            brandName={state.brand}
            location={state.loc}
            onLocationChange={loc => {
              setState(prev => ({ ...prev, loc }));
              showToast(`Delivery location set to ${loc}.`);
            }}
            theme={state.theme}
            onToggleTheme={handleToggleTheme}
            user={state.user}
            onAuthClick={() => setShowAuthModal(true)}
            onAdminClick={() => handleNavigate('admin')}
            sections={activeSections}
            onRefreshPrices={handleRefreshPrices}
          />
        </div>

        {/* Mobile Header Bar */}
        <div className="md:hidden flex items-center justify-between gap-2 p-3 bg-[var(--card)] border-b-2 border-[var(--bd)] sticky top-0 z-30 min-w-0">
          <button
            onClick={() => handleNavigate('home')}
            className="flex items-center gap-2 font-display font-extrabold text-lg text-[var(--ink)] cursor-pointer min-w-0"
          >
            <div className="w-7 h-7 rounded-lg bg-[var(--lime)] border-2 border-[var(--bd)] flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 32 32">
                <path d="M7 20c0-6 4-10 9-10s9 4 9 10" fill="none" stroke="#5b3df5" strokeWidth="4" strokeLinecap="round"/>
                <circle cx="16" cy="20" r="4" fill="#12102b"/>
              </svg>
            </div>
            <span className="truncate max-w-[34vw]">{state.brand}</span>
          </button>

          <div className="flex items-center gap-1.5 min-w-0">
            <select
              value={state.loc}
              onChange={e => {
                const loc = e.target.value;
                setState(prev => ({ ...prev, loc }));
                showToast(`Location set to ${loc}.`);
              }}
              className="dn-input text-xs py-1 px-1.5 font-semibold max-w-[34vw]"
            >
              {['Hyderabad', 'Bengaluru', 'Mumbai', 'Delhi', 'Chennai', 'Pune'].map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <button
              onClick={() => setShowAuthModal(true)}
              className="dn-btn text-xs py-1 px-2.5 shrink-0"
            >
              {state.user ? 'Account' : 'Sign in'}
            </button>
          </div>
        </div>

        {/* Main Content Viewport */}
        <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-8">
          <main className="flex-1 px-3 sm:px-8 py-5 sm:py-6 max-w-[1180px] w-full mx-auto min-w-0">
            {/* 1. HOME VIEW */}
            {view === 'home' && (
              <div className="space-y-8 animate-in fade-in duration-200">
                <HeroSearch
                  initialQuery=""
                  onSearch={handleSearch}
                  items={items}
                  onToast={showToast}
                  onOpenScanner={() => setShowScannerModal(true)}
                  onOpenLinkInspector={handleOpenLinkInspector}
                />

                {/* Category Grid */}
                <div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--ink)] font-display tracking-tight mb-4 inline-block">
                    Browse Categories
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {[
                      { em: '🛒', label: 'Shopping', view: 'shop' as NavView, bg: '#ffd6dc', enabled: activeSections.shop },
                      { em: '🍔', label: 'Food & Dining', view: 'food' as NavView, bg: '#d9f7a8', enabled: activeSections.food },
                      { em: '☕', label: 'Cafe & Drinks', view: 'food' as NavView, bg: '#cfe3ff', enabled: activeSections.food },
                      { em: '⚡', label: 'Quick Commerce', view: 'qc' as NavView, bg: '#ffe9a3', enabled: activeSections.qc },
                      { em: '🥦', label: 'Fresh Grocery', view: 'qc' as NavView, bg: '#ffd6dc', enabled: activeSections.qc },
                      { em: '🎟', label: 'Coupons Zone', view: 'coupons' as NavView, bg: '#d9f7a8', enabled: activeSections.coupons },
                      { em: '🔥', label: 'Today’s Deals', view: 'deals' as NavView, bg: '#cfe3ff', enabled: activeSections.deals },
                      { em: '📉', label: 'Price Drops', view: 'deals' as NavView, bg: '#ffe9a3', enabled: activeSections.deals },
                      { em: '🤖', label: 'AI Assistant', view: 'ai' as NavView, bg: '#d9f7a8', enabled: activeSections.ai },
                    ]
                      .filter(cat => cat.enabled !== false)
                      .map((cat, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleNavigate(cat.view)}
                          style={{ backgroundColor: cat.bg }}
                          className="p-4 rounded-2xl border-2 border-[var(--bd)] text-left font-display font-extrabold text-[#12102b] shadow-[3px_3px_0_var(--bd)] hover:shadow-[5px_5px_0_var(--bd)] hover:translate-x-[-1px] hover:translate-y-[-1px] transition-all cursor-pointer"
                        >
                          <span className="block text-2xl sm:text-3xl mb-1">{cat.em}</span>
                          <span className="text-sm sm:text-base leading-tight block">{cat.label}</span>
                        </button>
                      ))}
                  </div>
                </div>

                {/* Full partner coverage directory. Source-backed listings are labelled separately from checkout-only coverage. */}
                <section className="space-y-4" aria-labelledby="partner-coverage-heading">
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--pri)]">14 categories · {new Set(ALL_DIRECTORY_PLATFORMS).size}+ partner platforms</p>
                      <h2 id="partner-coverage-heading" className="text-xl sm:text-2xl font-extrabold text-[var(--ink)] font-display tracking-tight">Compare across the places you already use</h2>
                    </div>
                    <span className="hidden sm:inline-flex text-[10px] font-bold text-[var(--mut)] border border-[var(--bd)] rounded-full px-2.5 py-1">Source-backed data is marked</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {PLATFORM_GROUPS.map(group => {
                      const activeCount = group.platforms.length;
                      return (
                        <article key={group.id} className="rounded-2xl border-2 border-[var(--bd)] bg-[var(--card)] p-4 shadow-[3px_3px_0_var(--bd)] hover:translate-y-[-1px] transition-transform">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3"><span className="text-2xl" aria-hidden="true">{group.icon}</span><div><h3 className="font-extrabold text-sm text-[var(--ink)]">{group.title}</h3><p className="text-[11px] text-[var(--mut)] mt-0.5 leading-relaxed">{group.description}</p></div></div>
                            <span className="shrink-0 text-[9px] font-black uppercase px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">{activeCount} platforms active</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {group.platforms.map(platform => <span key={platform} className="text-[10px] font-semibold text-[var(--ink)] bg-[var(--bg)] border border-[var(--bd)]/60 rounded-lg px-2 py-1">{platform}</span>)}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-[var(--mut)]">DealNest labels source-backed listings separately from partner coverage that still requires checkout confirmation. Prices, stock, fees and eligibility can change.</p>
                </section>

                <PlatformSourceDirectory />

                {/* How It Works Explainer Card */}
                <div className="dn-card p-6 sm:p-7 bg-[var(--card)]">
                  <h2 className="text-lg sm:text-xl font-extrabold text-[var(--ink)] font-display mb-2">
                    How DealNest Works
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--mut)] leading-relaxed max-w-3xl">
                    Search once. We compare available partner listings, calculate total landed cost where fees are published, score each offer from 0 to 100, and guide you directly to the partner to complete your purchase. Platforms without confirmed data stay clearly labeled instead of showing guessed prices.
                  </p>
                </div>
              </div>
            )}

            {/* 2. SEARCH VIEW */}
            {view === 'search' && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <HeroSearch
                  initialQuery={searchQuery}
                  onSearch={handleSearch}
                  items={items}
                  onToast={showToast}
                  onOpenScanner={() => setShowScannerModal(true)}
                  onOpenLinkInspector={handleOpenLinkInspector}
                />

                {/* Filters & Sorting Bar */}
                <div className="flex items-center justify-between gap-3 flex-wrap border-b-2 border-[var(--bd)] pb-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                    {[
                      { id: 'all' as const, label: 'All Results', enabled: true },
                      { id: 'shop' as const, label: 'Shopping', enabled: activeSections.shop },
                      { id: 'food' as const, label: 'Food & Cafe', enabled: activeSections.food },
                      { id: 'qc' as const, label: 'Quick Commerce', enabled: activeSections.qc },
                    ]
                      .filter(tab => tab.enabled !== false)
                      .map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setSearchCategoryTab(tab.id)}
                          className={`dn-chip text-xs py-1.5 px-3.5 ${
                            searchCategoryTab === tab.id ? 'on' : ''
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--mut)] hidden sm:inline">Sort:</span>
                    <select
                      value={currentSort}
                      onChange={e => setCurrentSort(e.target.value as SortOption)}
                      className="dn-input text-xs py-1.5 px-2 font-semibold"
                    >
                      {Object.entries(SORT_COMPARATORS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                  {/* Catalog scanning indicator */}
                {isAnalyzingQuery && (
                  <div className="p-4 rounded-2xl bg-[var(--card)] border-2 border-[var(--bd)] shadow-[3px_3px_0_var(--bd)] flex items-center gap-3 animate-pulse">
                    <div className="w-9 h-9 rounded-xl bg-[var(--lime)] border-2 border-[var(--bd)] flex items-center justify-center font-bold flex-shrink-0">
                      <Sparkles className="w-5 h-5 text-[#12102b] animate-spin" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-[var(--ink)]">
                          Cross-Platform Scanner Active
                        </span>
                        <span className="bg-[#ccff00] text-[#12102b] text-[9px] font-black uppercase px-2 py-0.5 rounded-full border border-black/20">
                          Connected + catalog · {state.loc}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--mut)] truncate">
                        Analyzing your request and checking connected partner data, fees, and available offers...
                      </p>
                    </div>
                  </div>
                )}

                {/* Cross-Platform Search & URL Analysis Card with Best Deal Winner */}
                {crossPlatformResult && (
                  <div className="dn-card p-5 sm:p-6 bg-[var(--card)] border-2 border-[var(--bd)] shadow-[5px_5px_0_var(--bd)] space-y-5">
                    {/* Header with input analysis badge */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-[var(--bd)]">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {crossPlatformResult.isUrl ? (
                            <span className="bg-[#5b3df5] text-white text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border border-[var(--bd)] flex items-center gap-1">
                              <span>🔗 Analyzed {crossPlatformResult.sourcePlatform || 'Store'} Link</span>
                            </span>
                          ) : (
                            <span className="bg-[#5b3df5] text-white text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border border-[var(--bd)]">
                              ⚡ Multi-Platform Deal Search
                            </span>
                          )}
                          <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Connected data + catalog record</span>
                          </span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black font-display text-[var(--ink)] tracking-tight">
                          Exact Match: {crossPlatformResult.identifiedItem}
                        </h2>
                        <p className="text-xs text-[var(--mut)] mt-0.5">
                          {crossPlatformResult.isUrl
                            ? `Extracted from ${crossPlatformResult.sourcePlatform || 'URL'} and compared against ${crossPlatformResult.offers.length} available candidates in ${state.loc}. Partner coverage spans ${new Set(ALL_DIRECTORY_PLATFORMS).size}+ platforms; final availability and checkout terms still need confirmation.`
                            : `Checked the available catalog and partner directory across ${new Set(ALL_DIRECTORY_PLATFORMS).size}+ platforms in ${state.loc}. Only ${crossPlatformResult.offers.length} source-backed offers have numeric prices; the rest require partner checkout confirmation.`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-center">
                        <span className="text-[11px] font-mono text-[var(--mut)] bg-[var(--bg)] px-2.5 py-1 rounded-lg border border-[var(--bd)]">
                          {crossPlatformResult.offers.length} verified offers · {new Set(ALL_DIRECTORY_PLATFORMS).size}+ coverage
                        </span>
                      </div>
                    </div>

                    {/* WINNER SPOTLIGHT BANNER ("Best Deal") */}
                    {crossPlatformResult.winner && (
                      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[var(--lime)]/20 via-[var(--lime)]/10 to-transparent border-2 border-[var(--bd)] shadow-[3px_3px_0_var(--bd)] flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-[var(--lime)] border-2 border-[var(--bd)] flex items-center justify-center shadow-[2px_2px_0_var(--bd)] flex-shrink-0">
                            <Trophy className="w-6 h-6 text-[#12102b]" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="bg-[#12102b] text-[var(--lime)] text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                                🏆 WINNER — BEST AVAILABLE DEAL
                              </span>
                              {crossPlatformResult.winner.savingsVsHighest > 0 && (
                                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                  Save ₹{crossPlatformResult.winner.savingsVsHighest.toLocaleString('en-IN')} vs highest store
                                </span>
                              )}
                            </div>
                            <div className="flex items-baseline gap-2 mt-1">
                              <span className="text-2xl sm:text-3xl font-black font-display text-[var(--ink)]">
                                {crossPlatformResult.winner.platform}
                              </span>
                              <span className="text-xl sm:text-2xl font-black text-[#5b3df5]">
                                ₹{crossPlatformResult.winner.totalPrice.toLocaleString('en-IN')}
                              </span>
                              <span className="text-xs text-[var(--mut)] font-bold">
                                (Final Landed Price)
                              </span>
                            </div>
                            <p className="text-xs text-[var(--ink)] font-semibold mt-1">
                              💡 <span className="font-bold">Why this won:</span> {crossPlatformResult.winner.reason}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (crossPlatformResult.winner?.directUrl) {
                              setOutboundData({
                                platform: crossPlatformResult.winner.platform,
                                url: crossPlatformResult.winner.directUrl,
                                itemName: crossPlatformResult.winner.productName,
                                currentPrice: crossPlatformResult.winner.totalPrice,
                              });
                            }
                          }}
                          className="dn-btn text-xs sm:text-sm py-2.5 px-5 font-black whitespace-nowrap self-start md:self-center flex items-center gap-2 cursor-pointer shadow-[3px_3px_0_var(--bd)]"
                        >
                          <span>Get Best Deal on {crossPlatformResult.winner.platform}</span>
                          <ExternalLink className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* All Discovered Platform Offers Grid */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-extrabold text-[var(--ink)] uppercase tracking-wider">
                          All Discovered Platform Offers ({crossPlatformResult.offers.length})
                        </h3>
                        <span className="text-[11px] text-[var(--mut)]">
                          Sorted by lowest total payable checkout price
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {crossPlatformResult.offers.map((offer, idx) => {
                          const isWinner = crossPlatformResult.winner?.platform === offer.platform;
                          return (
                            <div
                              key={idx}
                              className={`p-4 rounded-2xl border-2 transition-all flex flex-col justify-between gap-3 ${
                                isWinner
                                  ? 'bg-[var(--card)] border-[#5b3df5] shadow-[4px_4px_0_#5b3df5]'
                                  : 'bg-[var(--card)] border-[var(--bd)] shadow-[3px_3px_0_var(--bd)]'
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2 font-black text-sm text-[var(--ink)]">
                                    <span
                                      className="w-3 h-3 rounded-full border border-black/20"
                                      style={{ backgroundColor: PLATFORM_COLORS[offer.platform] || '#5b3df5' }}
                                    />
                                    <span>{offer.platform}</span>
                                    {isWinner && (
                                      <span className="bg-[#ccff00] text-[#12102b] text-[9px] font-black uppercase px-1.5 py-0.2 rounded">
                                        Best Deal
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                    ✓ Verified
                                  </span>
                                </div>

                                <div className="text-xs text-[var(--mut)] font-semibold mb-2 line-clamp-1">
                                  {offer.productName}
                                </div>

                                <div className="flex items-baseline gap-2">
                                  <span className="text-xl font-black text-[var(--ink)]">
                                    ₹{offer.totalPayable?.toLocaleString('en-IN')}
                                  </span>
                                  {offer.mrp && offer.mrp > (offer.price || 0) && (
                                    <span className="text-xs line-through text-[var(--mut)]">
                                      ₹{offer.mrp.toLocaleString('en-IN')}
                                    </span>
                                  )}
                                  {(offer.discountPct || 0) > 0 && (
                                    <span className="text-[10px] font-black text-rose-600 bg-rose-500/10 px-1.5 py-0.5 rounded">
                                      {offer.discountPct}% OFF
                                    </span>
                                  )}
                                </div>

                                <div className="mt-2 space-y-1 text-[11px] text-[var(--mut)]">
                                  <div className="flex items-center justify-between">
                                    <span>Delivery fee:</span>
                                    <span className="font-bold text-[var(--ink)]">
                                      {offer.deliveryFee === 0 ? 'FREE' : `₹${offer.deliveryFee}`}
                                    </span>
                                  </div>
                                  {offer.couponCode && (
                                    <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 font-bold">
                                      <span>Coupon:</span>
                                      <span className="truncate max-w-[140px]">{offer.couponCode}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="pt-2 border-t border-[var(--bd)]/40 flex items-center justify-between gap-2">
                                <span className="text-[10px] text-[var(--mut)] font-mono">
                                  {offer.etaMinutes ? `${offer.etaMinutes >= 60 ? Math.round(offer.etaMinutes/60) + 'h' : offer.etaMinutes + 'm'} ETA` : 'Direct Link'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOutboundData({
                                      platform: offer.platform,
                                      url: offer.directUrl,
                                      itemName: offer.productName,
                                      couponCode: offer.couponCode || null,
                                      currentPrice: offer.totalPayable,
                                    });
                                  }}
                                  className="dn-btn text-xs py-1.5 px-3 font-bold flex items-center gap-1.5 cursor-pointer"
                                >
                                  <span>Direct {offer.platform}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Search Results Display */}
                {searchResults.length > 0 ? (
                  <div className="space-y-4">
                    {crossPlatformResult && (
                      <h3 className="text-base font-extrabold font-display text-[var(--ink)]">
                        Interactive Deal Cards & Price Trend Graph
                      </h3>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {searchResults.map(item => (
                        <DealCard
                          key={item.id}
                          item={item}
                          isSaved={state.saved.includes(item.id)}
                          onToggleSave={handleToggleSave}
                          onPriceAlert={setActiveAlertItem}
                          onViewHistory={setActiveHistoryItem}
                          onShare={handleShare}
                          onGetDeal={handleGetDeal}
                          disabledPlatforms={state.plat}
                          demoMode={state.demo}
                          flashingOfferKey={flashingKey}
                        />
                      ))}
                    </div>
                  </div>
                ) : !crossPlatformResult && !isAnalyzingQuery && (
                  <div className="dn-card text-center p-10 max-w-lg mx-auto space-y-3">
                    <span className="text-4xl block">🔍</span>
                    <h2 className="text-xl font-bold font-display text-[var(--ink)]">
                      No matching deals found
                    </h2>
                    <p className="text-xs sm:text-sm text-[var(--mut)]">
                      Try searching for a product, meal, trip, service, or any supported partner name, or paste a partner URL.
                    </p>
                    <button
                      onClick={() => handleSearch('iPhone')}
                      className="dn-btn dn-btn-secondary text-xs py-2 px-4 font-bold cursor-pointer"
                    >
                      Explore Popular iPhone Deals
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 3. CATEGORY SPECIFIC VIEWS: SHOPPING, FOOD, QC */}
            {(view === 'shop' || view === 'food' || view === 'qc') && (
              !activeSections[view] ? (
                <div className="dn-card text-center p-12 max-w-lg mx-auto space-y-4 animate-in fade-in duration-200">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--pri2)] border-2 border-[var(--bd)] flex items-center justify-center mx-auto text-2xl shadow-[2px_2px_0_var(--bd)]">
                    🔒
                  </div>
                  <h2 className="text-xl font-extrabold font-display text-[var(--ink)]">
                    Section Hidden by Administrator
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--mut)] leading-relaxed">
                    This category ({view === 'shop' ? 'Shopping' : view === 'food' ? 'Food & Dining' : 'Quick Commerce'}) has been temporarily hidden in the Admin Control Center.
                  </p>
                  <div className="flex gap-2 justify-center pt-2">
                    <button onClick={() => handleNavigate('home')} className="dn-btn text-xs py-2 px-4 font-bold">
                      Back to Home
                    </button>
                    <button onClick={() => handleNavigate('admin')} className="dn-btn dn-btn-secondary text-xs py-2 px-4">
                      Open Admin Controls
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)] font-display tracking-tight">
                        {view === 'shop' && '🛒 Shopping & Electronics Deals'}
                        {view === 'food' && '🍔 Food & Dining Offers'}
                        {view === 'qc' && '⚡ 10-Minute Grocery & Quick Commerce'}
                      </h2>
                      <p className="text-xs sm:text-sm text-[var(--mut)] mt-1">
                        Compare available partner listings and catalog records; confirm discounts at checkout.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--mut)]">Sort:</span>
                      <select
                        value={currentSort}
                        onChange={e => setCurrentSort(e.target.value as SortOption)}
                        className="dn-input text-xs py-1.5 px-2 font-semibold"
                      >
                        {Object.entries(SORT_COMPARATORS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Manual catalog-data check */}
                  <div className="p-3 rounded-2xl bg-[var(--card)] border-2 border-[var(--bd)] shadow-[2px_2px_0_var(--bd)] flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs text-[var(--ink)]">
                            CONNECTED DATA REFRESH
                          </span>
                          <span className="bg-[#12102b] text-[var(--lime)] text-[9px] font-black uppercase px-1.5 py-0.2 rounded border border-[var(--bd)]">
                            Manual check
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--mut)]">
                          {view === 'shop' && 'Compare available shopping listings across Amazon, Flipkart, Croma, Reliance Digital, Myntra, AJIO, Nykaa, and Meesho. Confirm price and bank eligibility at checkout.'}
                          {view === 'food' && 'Compare available restaurant listings across Swiggy, Zomato, EatClub, and direct partners. Confirm delivery fees and promo eligibility at checkout.'}
                          {view === 'qc' && 'Manual check for quick-commerce catalog data across Zepto, Blinkit, and Instamart. Confirm stock, speed and final payable total at checkout.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--mut)] font-mono hidden sm:inline">
                        Manual only
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleRefreshPrices()}
                        disabled={isRefreshing}
                        className="dn-btn dn-btn-secondary text-xs py-1.5 px-3 font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <span>{isRefreshing ? 'Checking...' : 'Refresh available deals'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {items
                      .filter(i => {
                        if (view === 'shop') return i.type === 'shop';
                        if (view === 'food') return i.type === 'food' || i.type === 'cafe';
                        if (view === 'qc') return i.type === 'qc';
                        return true;
                      })
                      .map(item => (
                        <DealCard
                          key={item.id}
                          item={item}
                          isSaved={state.saved.includes(item.id)}
                          onToggleSave={handleToggleSave}
                          onPriceAlert={setActiveAlertItem}
                          onViewHistory={setActiveHistoryItem}
                          onShare={handleShare}
                          onGetDeal={handleGetDeal}
                          disabledPlatforms={state.plat}
                          demoMode={state.demo}
                          flashingOfferKey={flashingKey}
                        />
                      ))}
                  </div>
                </div>
              )
            )}

            {/* 4. COUPONS VIEW */}
            {view === 'coupons' && (
              !activeSections.coupons ? (
                <div className="dn-card text-center p-12 max-w-lg mx-auto space-y-4 animate-in fade-in duration-200">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--pri2)] border-2 border-[var(--bd)] flex items-center justify-center mx-auto text-2xl shadow-[2px_2px_0_var(--bd)]">
                    🔒
                  </div>
                  <h2 className="text-xl font-extrabold font-display text-[var(--ink)]">
                    Coupons Zone Hidden by Administrator
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--mut)] leading-relaxed">
                    The Coupon Code Zone has been temporarily deactivated in the Admin Control Center.
                  </p>
                  <div className="flex gap-2 justify-center pt-2">
                    <button onClick={() => handleNavigate('home')} className="dn-btn text-xs py-2 px-4 font-bold">
                      Back to Home
                    </button>
                    <button onClick={() => handleNavigate('admin')} className="dn-btn dn-btn-secondary text-xs py-2 px-4">
                      Open Admin Controls
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-8 animate-in fade-in duration-200">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)] font-display tracking-tight">
                      🎟 Coupon Discovery & Promo Codes
                    </h2>
                    <p className="text-xs sm:text-sm text-[var(--mut)] mt-1">
                      Browse source-backed DealNest offers, then ask AI for a cited web comparison when you need more context.
                    </p>
                  </div>

                  {/* Coupon source status */}
                  <div className="p-3 rounded-2xl bg-[var(--card)] border-2 border-[var(--bd)] shadow-[2px_2px_0_var(--bd)] flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs text-[var(--ink)]">
                            OFFICIAL COUPON SOURCES
                          </span>
                          <span className="bg-[#12102b] text-[var(--lime)] text-[9px] font-black uppercase px-1.5 py-0.2 rounded border border-[var(--bd)]">
                            Confirm at checkout
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--mut)]">
                          Official sources are partner-published. Unofficial leads come from third-party coupon or cashback directories and are never treated as confirmed. Eligibility, stock, fees, and final savings are confirmed by the partner checkout.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-[var(--mut)] font-mono hidden sm:inline">
                        Manual only
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleRefreshPrices()}
                        disabled={isRefreshing}
                        className="dn-btn dn-btn-secondary text-xs py-1.5 px-3 font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <span>{isRefreshing ? 'Checking...' : 'Refresh available deals'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                    <span className="rounded-full bg-[#12102b] text-[var(--lime)] px-2.5 py-1">OFFICIAL SOURCE · partner-published</span>
                    <span className="rounded-full bg-amber-100 text-amber-800 px-2.5 py-1">UNOFFICIAL LEAD · third-party, verify first</span>
                  </div>

                  {[
                    { id: 'food', label: '🍔 Food & Restaurant Coupons' },
                    { id: 'shop', label: '🛒 Shopping & Electronics Codes' },
                    { id: 'grocery', label: '⚡ Quick Grocery Deals' },
                    { id: 'fashion', label: '👕 Fashion Coupons' },
                    { id: 'beauty', label: '💄 Beauty & Skincare Offers' },
                    { id: 'medical', label: '💊 Pharmacy & Health Offers' },
                    { id: 'jewelry', label: '💎 Jewellery Offers' },
                    { id: 'fitness', label: '🏋️ Fitness Membership Offers' },
                    { id: 'gaming', label: '🎮 Gaming & Digital Subscriptions' },
                    { id: 'pay', label: '💳 Payment & Card Offers' },
                    { id: 'travel', label: '✈️ Travel & Hotel Offers' },
                    { id: 'entertainment', label: '🎬 Entertainment Offers' },
                    { id: 'mobility', label: '🚕 Ride & Mobility Offers' },
                    { id: 'services', label: '🏠 Home-Service Offers' },
                    { id: 'auto', label: '🚗 Auto-Service Offers' },
                  ].map(group => {
                    const groupCoupons = coupons.filter(c => c.category === group.id);
                    if (groupCoupons.length === 0) return null;

                    return (
                      <div key={group.id} className="space-y-3">
                        <h3 className="text-lg font-bold font-display text-[var(--ink)]">
                          {group.label}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {groupCoupons.map((coupon, idx) => (
                            <CouponCard
                              key={idx}
                              coupon={coupon}
                              onUseOffer={handleUseCoupon}
                              onToast={showToast}
                              demoMode={state.demo}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* 5. DEALS VIEW */}
            {view === 'deals' && (
              !activeSections.deals ? (
                <div className="dn-card text-center p-12 max-w-lg mx-auto space-y-4 animate-in fade-in duration-200">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--pri2)] border-2 border-[var(--bd)] flex items-center justify-center mx-auto text-2xl shadow-[2px_2px_0_var(--bd)]">
                    🔒
                  </div>
                  <h2 className="text-xl font-extrabold font-display text-[var(--ink)]">
                    Today's Deals Hidden by Administrator
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--mut)] leading-relaxed">
                    The Today's Deals section has been temporarily deactivated in the Admin Control Center.
                  </p>
                  <div className="flex gap-2 justify-center pt-2">
                    <button onClick={() => handleNavigate('home')} className="dn-btn text-xs py-2 px-4 font-bold">
                      Back to Home
                    </button>
                    <button onClick={() => handleNavigate('admin')} className="dn-btn dn-btn-secondary text-xs py-2 px-4">
                      Open Admin Controls
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-in fade-in duration-200">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--ink)] font-display tracking-tight">
                      🔥 Today’s Top Bargains & Price Drops
                    </h2>
                    <p className="text-xs sm:text-sm text-[var(--mut)] mt-1">
                      Ranked by highest discount percentage and best verified savings.
                    </p>
                  </div>
                </div>

                {/* Deal ranking status */}
                <div className="p-3 rounded-2xl bg-[var(--card)] border-2 border-[var(--bd)] shadow-[2px_2px_0_var(--bd)] flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-[var(--ink)]">
                          DEAL RANKING RADAR
                        </span>
                        <span className="bg-[#12102b] text-[var(--lime)] text-[9px] font-black uppercase px-1.5 py-0.2 rounded border border-[var(--bd)]">
                          Manual check
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--mut)]">
                        DealNest ranks available catalog data by discount context and landed-cost estimates; final prices are confirmed at checkout.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--mut)] font-mono hidden sm:inline">
                      Manual only
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleRefreshPrices()}
                      disabled={isRefreshing}
                      className="dn-btn dn-btn-secondary text-xs py-1.5 px-3 font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                        <span>{isRefreshing ? 'Checking...' : 'Check available bargains'}</span>
                    </button>
                  </div>
                </div>

                {/* Budget Range Filter Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {[
                    { cap: 0, label: 'All Budgets' },
                    { cap: 99, label: 'Under ₹99' },
                    { cap: 499, label: 'Under ₹499' },
                    { cap: 999, label: 'Under ₹999' },
                  ].map(b => (
                    <button
                      key={b.cap}
                      onClick={() => setDealsBudgetCap(b.cap)}
                      className={`dn-chip text-xs py-1.5 px-3.5 ${
                        dealsBudgetCap === b.cap ? 'on' : ''
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(() => {
                    const allScoredOffers: { item: Item; offer: any }[] = [];
                    items.forEach(item => {
                      const scored = scoreOffers(item, state.plat);
                      scored
                        .filter(o => !o.na)
                        .forEach(offer => {
                          allScoredOffers.push({ item, offer });
                        });
                    });

                    const filtered = allScoredOffers
                      .filter(x => !dealsBudgetCap || (x.offer.t ?? 9e9) <= dealsBudgetCap)
                      .sort((a, b) => b.offer.disc - a.offer.disc);

                    if (filtered.length === 0) {
                      return (
                        <div className="col-span-full dn-card text-center p-8">
                          <p className="text-sm text-[var(--mut)]">
                            No deals currently found under {fmt(dealsBudgetCap)}. Try browsing all budgets!
                          </p>
                        </div>
                      );
                    }

                    return filtered.map(({ item, offer }, idx) => {
                      const isFlashing = flashingKey === `${item.id}|${offer.p}`;
                      return (
                        <div
                          key={`${item.id}-${offer.p}-${idx}`}
                          className="dn-card flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">{item.em}</span>
                                <div>
                                  <span className="font-extrabold text-base text-[var(--ink)] leading-snug block">
                                    {item.name}
                                  </span>
                                  <div className="text-[10px] text-[var(--mut)] flex items-center gap-1 mt-0.5">
                                    <span>MRP {fmt(item.mrp)}</span>
                                    <span>·</span>
                                    <span className="text-emerald-600 font-bold flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                      <span>Listed price</span>
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="p-3 rounded-2xl border-2 border-[var(--bd)] bg-[var(--bg)] mb-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="w-7 h-7 rounded-full border border-[var(--bd)] flex items-center justify-center font-bold text-xs text-white"
                                    style={{ backgroundColor: PLATFORM_COLORS[offer.p] || '#473fa0' }}
                                  >
                                    {offer.p.charAt(0)}
                                  </span>
                                  <div>
                                    <span className="font-bold text-xs block text-[var(--ink)]">{offer.p}</span>
                                    <span className="text-[10px] text-[var(--mut)]">
                                      Score {offer.score}/100 · {offer.rating ? `${offer.rating}★` : 'Verified'}
                                    </span>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <div className={`font-display font-extrabold text-base text-[var(--ink)] ${isFlashing ? 'flash' : ''}`}>
                                    {fmt(offer.t)}
                                  </div>
                                  <span className="bg-[var(--cor)] text-white text-[10px] font-bold px-1.5 py-0.2 rounded">
                                    {offer.disc}% OFF
                                  </span>
                                </div>
                              </div>

                              {offer.coupon && (
                                <div className="p-1.5 rounded-xl border border-[var(--bd)]/40 bg-[var(--card)] text-[11px] font-semibold flex items-center justify-between gap-1.5">
                                  <span className="text-[var(--ink)] truncate">
                                    🏷️ {offer.coupon}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const codeMatch = offer.coupon.match(/^([A-Z0-9_-]+)/);
                                      const code = codeMatch ? codeMatch[1] : offer.coupon;
                                      navigator.clipboard.writeText(code);
                                      showToast(`Copied ${code} to clipboard!`);
                                    }}
                                    className="text-[10px] font-bold bg-[var(--bg)] hover:bg-[var(--lime)] text-[var(--ink)] px-2 py-0.5 rounded border border-[var(--bd)] cursor-pointer flex-shrink-0"
                                  >
                                    Copy
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleGetDeal(item, offer.p)}
                              className="dn-btn text-xs py-2 flex-1 font-bold"
                            >
                              GET DEAL
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleSave(item.id)}
                              className="dn-btn dn-btn-secondary text-xs py-2 px-3"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                <section className="space-y-4 pt-2" aria-labelledby="deal-directory-heading">
                  <div className="flex items-end justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--pri)]">{DEAL_DIRECTORY_TOTAL.toLocaleString()}+ directory records</p>
                      <h3 id="deal-directory-heading" className="text-xl sm:text-2xl font-extrabold text-[var(--ink)] font-display tracking-tight">All-category deal directory</h3>
                      <p className="text-xs text-[var(--mut)] mt-1 max-w-3xl">Browse searchable discovery records across every DealNest category. These are not live prices or confirmed coupons; open the Google result and verify the official partner page before ordering.</p>
                    </div>
                    <span className="text-[10px] font-black uppercase rounded-full bg-amber-100 text-amber-800 px-2.5 py-1">Directory mode · verify first</span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={directoryCategory}
                      onChange={event => { setDirectoryCategory(event.target.value); setDirectoryPlatform('all'); setDirectoryPage(0); }}
                      className="dn-input text-xs py-2 px-3 flex-1"
                      aria-label="Filter deal directory by category"
                    >
                      <option value="all">All categories</option>
                      {PLATFORM_GROUPS.map(group => <option key={group.id} value={group.id}>{group.icon} {group.title}</option>)}
                    </select>
                    <select
                      value={directoryPlatform}
                      onChange={event => { setDirectoryPlatform(event.target.value); setDirectoryPage(0); }}
                      className="dn-input text-xs py-2 px-3 flex-1"
                      aria-label="Filter deal directory by platform"
                    >
                      <option value="all">All platforms</option>
                      {(directoryCategory === 'all' ? PLATFORM_GROUPS.flatMap(group => group.platforms) : PLATFORM_GROUPS.find(group => group.id === directoryCategory)?.platforms || []).map(platform => (
                        <option key={platform} value={platform}>{platform}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {directoryRecords.map(record => (
                      <article key={record.id} className="rounded-2xl border-2 border-[var(--bd)] bg-[var(--card)] p-4 shadow-[2px_2px_0_var(--bd)]">
                        <div className="flex items-start gap-2">
                          <span className="text-2xl" aria-hidden="true">{record.icon}</span>
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-sm text-[var(--ink)] leading-snug">{record.title}</h4>
                            <p className="text-[10px] text-[var(--mut)] mt-1">{record.categoryTitle} · {record.platform}</p>
                          </div>
                        </div>
                        <p className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold mt-3">{record.sourceLabel}</p>
                        <a href={record.sourceUrl} target="_blank" rel="noopener noreferrer" className="dn-btn text-[10px] py-1.5 px-2.5 mt-3 inline-flex items-center gap-1.5">OPEN DISCOVERY <ExternalLink className="w-3 h-3" /></a>
                      </article>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] text-[var(--mut)] font-semibold">Showing {directoryRecords.length} records · page {directoryPage + 1}</span>
                    <div className="flex gap-2">
                      <button type="button" disabled={directoryPage === 0} onClick={() => setDirectoryPage(page => Math.max(0, page - 1))} className="dn-btn dn-btn-secondary text-xs py-1.5 px-3 disabled:opacity-40">Previous</button>
                      <button type="button" disabled={directoryRecords.length < DEAL_DIRECTORY_PAGE_SIZE} onClick={() => setDirectoryPage(page => page + 1)} className="dn-btn text-xs py-1.5 px-3 disabled:opacity-40">Next</button>
                    </div>
                  </div>
                </section>
              </div>
              )
            )}

            {/* 6. AI ASSISTANT VIEW (Admin activation only) */}
            {view === 'ai' && (
              !activeSections.ai ? (
                <div className="dn-card text-center p-12 max-w-lg mx-auto space-y-4 animate-in fade-in duration-200">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--lime)] border-2 border-[var(--bd)] flex items-center justify-center mx-auto text-3xl shadow-[4px_4px_0_var(--bd)]">
                    🤖
                  </div>
                  <h2 className="text-xl font-extrabold font-display text-[var(--ink)]">
                    DealNest AI Assistant is Deactivated
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--mut)] leading-relaxed">
                    Only Administrator can activate the AI Shopping Assistant using the Admin Control Center.
                  </p>
                  <div className="flex gap-2 justify-center pt-2">
                    <button onClick={() => handleNavigate('home')} className="dn-btn text-xs py-2 px-4 font-bold">
                      Back to Home
                    </button>
                    <button onClick={() => handleNavigate('admin')} className="dn-btn dn-btn-lime text-xs py-2 px-4 font-bold">
                      Activate in Admin Controls
                    </button>
                  </div>
                </div>
              ) : (
                <div className="animate-in fade-in duration-200">
                  <AiAssistant
                    brandName={state.brand}
                    items={items}
                    location={state.loc}
                    userToken={userToken}
                    disabledPlatforms={state.plat}
                    onRecordHistory={q => {
                      setState(prev => ({
                        ...prev,
                        hist: [q, ...prev.hist.filter(h => h !== q)].slice(0, 30),
                      }));
                    }}
                    onNavigateSearch={handleSearch}
                  />
                </div>
              )
            )}

            {/* 7. ACCOUNT VIEW */}
            {view === 'account' && (
              <div className="animate-in fade-in duration-200">
                <AccountView
                  user={state.user}
                  enrolledUser={enrolledUser}
                  savedItemIds={state.saved}
                  allItems={items}
                  alerts={state.alerts}
                  searchHistory={state.hist}
                  onRemoveAlert={handleRemoveAlert}
                  onClearAllData={handleClearAllData}
                  onNavigateSearch={handleSearch}
                  onGetDeal={handleGetDeal}
                  onToast={showToast}
                  onToggleSave={handleToggleSave}
                  onLogoutUser={handleUserLogout}
                  onNavigateAdmin={() => handleNavigate('admin')}
                />
              </div>
            )}


          </main>

          {/* Canonical Footer as requested */}
          <footer className="mt-auto px-4 sm:px-8 py-8 border-t-2 border-[var(--bd)] bg-[var(--card)] text-xs text-[var(--mut)] leading-relaxed">
            <div className="max-w-[1180px] mx-auto space-y-3">
              <p>
                Prices, coupons, and availability are shown only when connected data is available; final price, stock, fees, and eligibility are confirmed on the relevant partner checkout page.
              </p>
              <p>
                Amazon, Flipkart, Swiggy, Zomato, Myntra, Tata 1mg, MakeMyTrip, and all other partner names and marks belong to their respective owners. DealNest is an independent comparison and discovery service.
              </p>
              <p className="font-extrabold text-[var(--ink)] text-sm">
                © 2026 DealNest. All rights reserved.
              </p>

              {/* Interactive footer policy links */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 font-semibold text-[var(--ink)]">
                <button
                  type="button"
                  onClick={() => setActiveLegalModal('privacy')}
                  className="hover:text-[var(--pri)] hover:underline cursor-pointer"
                >
                  Privacy
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setActiveLegalModal('terms')}
                  className="hover:text-[var(--pri)] hover:underline cursor-pointer"
                >
                  Terms
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setActiveLegalModal('cookies')}
                  className="hover:text-[var(--pri)] hover:underline cursor-pointer"
                >
                  Cookies
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setActiveLegalModal('affiliate')}
                  className="hover:text-[var(--pri)] hover:underline cursor-pointer text-[var(--pri)]"
                >
                  Affiliate Disclosure
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setActiveLegalModal('contact')}
                  className="hover:text-[var(--pri)] hover:underline cursor-pointer"
                >
                  Contact
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setActiveLegalModal('disclaimer')}
                  className="hover:text-[var(--pri)] hover:underline cursor-pointer"
                >
                  Disclaimer
                </button>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* Mobile Sticky Bottom Bar */}
      <MobileNav
        currentView={view}
        onNavigate={handleNavigate}
        user={state.user}
        sections={activeSections}
      />

      {globalDisclaimer?.required && userToken && (
        <GlobalDisclaimerModal
          token={userToken}
          disclaimer={globalDisclaimer}
          onAccepted={() => setGlobalDisclaimer(prev => prev ? { ...prev, required: false } : prev)}
          onToast={showToast}
        />
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-8 left-1/2 transform -translate-x-1/2 bg-[var(--lime)] text-[#12102b] border-2 border-[var(--bd)] shadow-[4px_4px_0_var(--bd)] font-bold text-xs sm:text-sm py-2.5 px-5 rounded-2xl z-50 max-w-[90vw] animate-in fade-in slide-in-from-bottom-2 duration-150">
          {toastMessage}
        </div>
      )}

      {/* Active Modals */}
      {activeAlertItem && (
        <PriceAlertModal
          item={activeAlertItem}
          onClose={() => setActiveAlertItem(null)}
          onSaveAlert={handleSaveAlert}
        />
      )}

      {activeHistoryItem && (
        <PriceHistoryModal
          item={activeHistoryItem}
          onClose={() => setActiveHistoryItem(null)}
          onSetAlert={item => setActiveAlertItem(item)}
        />
      )}

      {showScannerModal && (
        <BarcodeScannerModal
          onClose={() => setShowScannerModal(false)}
          onSelectProduct={handleSearch}
        />
      )}

      {showLinkInspector && (
        <ProductLinkInspectorModal
          initialUrl={linkInspectorUrl}
          items={items}
          userToken={userToken}
          onClose={() => setShowLinkInspector(false)}
          onSelectProduct={handleSearch}
          onUpdateItemPrice={handleUpdateItemPrice}
          onOpenHistory={setActiveHistoryItem}
          onOpenOffer={handleGetDeal}
        />
      )}

      {showAuthModal && (
        <AuthModal
          currentUser={state.user}
          onClose={() => setShowAuthModal(false)}
          onLogin={user => {
            setState(prev => ({ ...prev, user }));
            showToast(`Welcome back, ${user}!`);
          }}
          onLogout={() => {
            handleUserLogout();
          }}
          onOpenDashboard={() => handleNavigate('account')}
          onOpenAdmin={() => handleNavigate('admin')}
        />
      )}

      {activeLegalModal && (
        <LegalModal
          type={activeLegalModal}
          onClose={() => setActiveLegalModal(null)}
          brandName={state.brand}
          onToast={showToast}
        />
      )}

      {outboundData && (
        <OutboundModal
          platform={outboundData.platform}
          url={outboundData.url}
          itemName={outboundData.itemName}
          couponCode={outboundData.couponCode}
          currentPrice={outboundData.currentPrice}
          brandName={state.brand}
          onClose={() => setOutboundData(null)}
          onAdjustPrice={newPrice => {
            if (outboundData.itemId) {
              handleUpdateItemPrice(outboundData.itemId, outboundData.platform, newPrice);
            }
          }}
        />
      )}
    </div>
  );
}
