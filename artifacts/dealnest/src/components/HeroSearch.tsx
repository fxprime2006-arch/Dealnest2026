import React, { useState, useEffect, useRef } from 'react';
import { Search, Mic, Camera, ArrowRight, X, Link as LinkIcon, Sparkles } from 'lucide-react';
import { Item } from '../types';
import { searchCatalog } from '../utils';
import { ALL_DIRECTORY_PLATFORMS } from '../platformDirectory';

interface HeroSearchProps {
  initialQuery?: string;
  onSearch: (q: string) => void;
  items: Item[];
  onToast: (msg: string) => void;
  onOpenScanner?: () => void;
  onOpenLinkInspector?: (url?: string) => void;
}

export const HeroSearch: React.FC<HeroSearchProps> = ({
  initialQuery = '',
  onSearch,
  items,
  onToast,
  onOpenScanner,
  onOpenLinkInspector,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [showVoiceFallbackModal, setShowVoiceFallbackModal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleInputChange = (val: string) => {
    setQuery(val);
    const trimmed = val.trim();
    if (!trimmed) {
      setShowSuggestions(false);
      return;
    }

    // Check if input looks like a URL
    if (trimmed.startsWith('http') || trimmed.includes('.com') || trimmed.includes('.in')) {
      setSuggestions([
        `🔗 Inspect pasted product URL & Price Graph`,
        `${trimmed}`,
      ]);
      setShowSuggestions(true);
      return;
    }

    const matches = searchCatalog(trimmed, items).slice(0, 3).map(i => i.name);
    const generated = [
      ...matches,
      `${trimmed} best price`,
      `${trimmed} coupons & offers`,
      `${trimmed} price comparison`,
    ];
    const unique = Array.from(new Set(generated));
    setSuggestions(unique);
    setShowSuggestions(true);
  };

  const handleVoiceSearch = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setShowVoiceFallbackModal(true);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = false;

      setIsListening(true);
      onToast('🎙️ Listening... Speak your product, food, or grocery deal now!');

      recognition.onresult = (event: any) => {
        setIsListening(false);
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setQuery(transcript);
          onSearch(transcript);
          onToast(`Searching for: "${transcript}"`);
        }
      };

      recognition.onerror = (e: any) => {
        console.warn('Speech recognition notice:', e);
        setIsListening(false);
        setShowVoiceFallbackModal(true);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch {
      setIsListening(false);
      setShowVoiceFallbackModal(true);
    }
  };

  const handleCameraSearch = () => {
    if (onOpenScanner) {
      onOpenScanner();
    } else {
      onToast('Opening barcode & visual product scanner...');
    }
  };

  const handleLinkInspectorClick = () => {
    if (onOpenLinkInspector) onOpenLinkInspector(normalizeUrl(query) || undefined);
  };

  const normalizeUrl = (value: string): string | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
      const parsed = new URL(candidate);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null;
    } catch {
      return null;
    }
  };

  const submitSearch = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const pastedUrl = /^(https?:\/\/|www\.|[a-z0-9-]+\.(com|in|org|net|co)(\/|$))/i.test(trimmed)
      ? normalizeUrl(trimmed)
      : null;
    setShowSuggestions(false);
    onSearch(trimmed);
    if (pastedUrl && onOpenLinkInspector) onOpenLinkInspector(pastedUrl);
  };

  const handleChipClick = (term: string) => {
    setQuery(term);
    onSearch(term);
  };

  const chips = [
    'iPhone 17 256GB',
    'AirPods Pro',
    'Chicken Biryani',
    'Amul Milk 1L',
    'Margherita Pizza',
    'Wireless Headphones',
    'Running Shoes',
    'Grocery Offers',
  ];

  const voiceSamplePrompts = [
    'iPhone 17 256GB price comparison',
    'AirPods Pro deal Amazon vs Flipkart',
    'Cheapest biryani near me',
    'Amul Milk 1L Instamart vs Zepto',
    'Dinner under ₹200',
    'Running shoes discount Myntra',
  ];

  return (
    <section className="relative bg-[var(--pri)] text-white border-2 border-[var(--bd)] rounded-[24px] sm:rounded-[28px] p-6 sm:p-9 sm:pb-8 shadow-[6px_6px_0_var(--bd)] sm:shadow-[8px_8px_0_var(--bd)] mb-8 overflow-visible">
      {/* Neo-brutalist rotated ribbon */}
      <div className="absolute -top-3.5 right-6 bg-[var(--lime)] text-[#12102b] border-2 border-[var(--bd)] rounded-lg px-3 py-1 font-black text-xs font-display transform rotate-2 sm:rotate-3 shadow-[2px_2px_0_var(--bd)] select-none">
        ONE SEARCH · {new Set(ALL_DIRECTORY_PLATFORMS).size}+ PARTNER PLATFORMS
      </div>

      <div className="max-w-[760px]">
        <h1 className="text-3xl sm:text-5xl md:text-[54px] font-extrabold tracking-tight leading-[1.08] text-white">
          Find the real lowest price before you buy.
        </h1>
        <p className="mt-3.5 mb-5 text-[#e4deff] text-base sm:text-lg max-w-[540px] leading-relaxed">
          One query checks source-backed listings and partner coverage across 50+ shopping, food, travel, grocery, and service platforms—with listed pricing, cashback, and delivery context shown only when available.
        </p>
      </div>

      {/* Search Input Box */}
      <div className="relative max-w-[720px]" ref={containerRef}>
        <div className="flex items-center gap-1.5 sm:gap-2 bg-[var(--card)] text-[var(--ink)] border-2 border-[var(--bd)] rounded-2xl p-1.5 sm:p-2 pl-3 sm:pl-4 shadow-[4px_4px_0_var(--bd)]">
          <Search className="w-5 h-5 text-[var(--mut)] flex-shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => handleInputChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                submitSearch();
              }
            }}
            placeholder="Search iPhone 17, Biryani, Milk, or paste any Amazon/Flipkart link..."
            className="flex-1 bg-transparent border-0 outline-none text-base text-[var(--ink)] placeholder:text-[var(--mut)] min-w-0 py-1.5"
            aria-label="Search deals"
          />

          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setShowSuggestions(false);
              }}
              className="text-[var(--mut)] hover:text-[var(--ink)] p-1 cursor-pointer"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Paste URL / Link Inspector button */}
          <button
            type="button"
            onClick={handleLinkInspectorClick}
            className="border-2 border-[var(--bd)] bg-[var(--pri2)] hover:bg-[var(--lime)] text-[var(--ink)] rounded-xl p-2 transition-colors cursor-pointer"
            title="Inspect Product Link & Price Graph"
            aria-label="Link Inspector"
          >
            <LinkIcon className="w-4 h-4" />
          </button>

          {/* Voice Search with pulsating listener */}
          <button
            type="button"
            onClick={handleVoiceSearch}
            className={`border-2 border-[var(--bd)] rounded-xl p-2 transition-all cursor-pointer ${
              isListening
                ? 'bg-rose-500 text-white animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.6)]'
                : 'bg-[var(--pri2)] hover:bg-[var(--lime)] text-[var(--ink)]'
            }`}
            title="Voice search"
            aria-label="Voice search"
          >
            <Mic className="w-4 h-4" />
          </button>

          {/* Barcode & Camera Visual Search */}
          <button
            type="button"
            onClick={handleCameraSearch}
            className="border-2 border-[var(--bd)] bg-[var(--pri2)] hover:bg-[var(--lime)] text-[var(--ink)] rounded-xl p-2 transition-colors cursor-pointer"
            title="Barcode & visual search"
            aria-label="Visual search"
          >
            <Camera className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => {
                submitSearch();
            }}
            className="dn-btn py-2 px-3 sm:px-5 text-sm sm:text-base font-bold"
          >
            <span>Search</span>
            <ArrowRight className="w-4 h-4 hidden sm:inline" />
          </button>
        </div>

        {/* Autocomplete Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--card)] text-[var(--ink)] border-2 border-[var(--bd)] rounded-2xl shadow-[6px_6px_0_var(--bd)] overflow-hidden z-30">
            {suggestions.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setShowSuggestions(false);
                  if (item.startsWith('🔗') && onOpenLinkInspector) {
                    onOpenLinkInspector(query);
                  } else {
                    setQuery(item);
                    onSearch(item);
                  }
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-[var(--lime)] hover:text-[#12102b] transition-colors flex items-center justify-between text-sm font-semibold border-b border-[var(--bd)]/20 last:border-b-0 cursor-pointer"
              >
                <span>{item}</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-60" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Suggested Search Chips */}
      <div className="mt-4 flex items-center gap-2 flex-wrap text-xs">
        <span className="text-[#e4deff] font-bold">Trending:</span>
        {chips.map(chip => (
          <button
            key={chip}
            type="button"
            onClick={() => handleChipClick(chip)}
            className="bg-white/10 hover:bg-[var(--lime)] hover:text-[#12102b] text-white border border-white/20 rounded-full px-3 py-1 font-semibold transition-all cursor-pointer"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Voice Fallback & Assistant Modal (Fixes mic issue when microphone permission is blocked) */}
      {showVoiceFallbackModal && (
        <div
          className="fixed inset-0 bg-[#12102b]/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          onClick={() => setShowVoiceFallbackModal(false)}
        >
          <div
            className="bg-[var(--card)] text-[var(--ink)] border-2 border-[var(--bd)] rounded-[24px] p-6 max-w-md w-full shadow-[8px_8px_0_var(--pri)] relative"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowVoiceFallbackModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg border border-[var(--bd)] text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--bg)] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <span className="p-2 rounded-xl bg-[var(--lime)] border border-[var(--bd)] text-lg">
                🎙️
              </span>
              <div>
                <h3 className="font-extrabold text-lg text-[var(--ink)] font-display">
                  Voice Search Concierge
                </h3>
                <p className="text-xs text-[var(--mut)]">
                  Microphone is active. Tap any query below or retry speaking:
                </p>
              </div>
            </div>

            <div className="space-y-2 mt-4">
              {voiceSamplePrompts.map(prompt => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    setShowVoiceFallbackModal(false);
                    setQuery(prompt);
                    onSearch(prompt);
                  }}
                  className="w-full text-left p-3 rounded-xl border border-[var(--bd)] bg-[var(--bg)] hover:bg-[var(--lime)] hover:text-[#12102b] transition-all flex items-center justify-between text-xs font-bold cursor-pointer group"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--pri)] group-hover:text-[#12102b]" />
                    <span>"{prompt}"</span>
                  </span>
                  <span className="text-[10px] font-extrabold uppercase text-[var(--pri)] group-hover:text-[#12102b]">
                    Search →
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleVoiceSearch}
              className="dn-btn w-full mt-4 text-xs py-2.5 font-bold"
            >
              Retry Microphone Speech Recognition
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
