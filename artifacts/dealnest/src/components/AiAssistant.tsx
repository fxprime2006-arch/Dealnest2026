import React, { useState, useRef, useEffect } from 'react';
import { Item } from '../types';
import { searchCatalog, scoreOffers, fmt, ety, tot } from '../utils';
import { 
  Bot, 
  Send, 
  Sparkles, 
  Loader2, 
  ArrowRight, 
  ExternalLink, 
  ShieldCheck, 
  Clock, 
  CheckCircle2
} from 'lucide-react';

interface ChatMessage {
  id: string;
  isAi: boolean;
  text: string;
  matchedItems?: Item[];
  timestamp?: number;
  sources?: Array<{ title: string; uri?: string }>;
  sourceLabel?: string;
  grounded?: boolean;
}

function safeSourceUrl(uri?: string): string | null {
  if (!uri) return null;
  try {
    const parsed = new URL(uri);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

interface AiAssistantProps {
  brandName: string;
  items: Item[];
  location?: string;
  userToken?: string | null;
  disabledPlatforms: Record<string, boolean>;
  onRecordHistory: (query: string) => void;
  onNavigateSearch: (query: string) => void;
}

export const AiAssistant: React.FC<AiAssistantProps> = ({
  brandName,
  items,
  location = 'Hyderabad',
  userToken,
  disabledPlatforms,
  onRecordHistory,
  onNavigateSearch,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      isAi: true,
      text: `👋 Hi! I’m **${brandName} Intelligence** for **${location}**. I compare the DealNest catalog, cited partner offers, coupons, fees, and checkout coverage across shopping, food, grocery, fashion, beauty, travel, entertainment, and services.\n\nAsk me anything or pick a prompt below:\n- *"Where is biryani or pizza listed at the lowest price?"*\n- *"Compare AirPods Pro across connected stores"*\n- *"Find dinner under ₹200 with available offers"*\n- *"Compare a hotel, bus, cab, or pharmacy option"*`,
      timestamp: Date.now(),
      grounded: false,
      sourceLabel: 'Intro — ask for a source-backed comparison',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Build live catalog summary for the AI prompt
  const generateCatalogSummary = () => {
    return items
      .map(item => {
        const scored = scoreOffers(item, disabledPlatforms);
        const valid = scored.filter(o => !o.na && o.price != null);
        const offersStr = valid
          .map(
            o =>
              `${o.p}: ₹${o.price} (delivery fee: ₹${o.fee || 0}, rating: ${o.rating}★, ETA: ${ety(o.eta)}${
                o.coupon ? `, coupon: ${o.coupon}` : ''
              })`
          )
          .join('; ');
        return `• ${item.name} (${item.type}, MRP ₹${item.mrp}): ${offersStr}`;
      })
      .join('\n');
  };

  const handleSendMessage = async (rawQuery: string) => {
    const q = rawQuery.trim();
    if (!q || loading) return;

    const userMsgId = `user-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      isAi: false,
      text: q,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    onRecordHistory(q);

    const matched = searchCatalog(q, items).slice(0, 3);

    try {
      const catalogSummary = generateCatalogSummary();
      const controller = new AbortController();
      const requestTimeout = window.setTimeout(() => controller.abort(), 12_000);
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}) },
        signal: controller.signal,
        body: JSON.stringify({
          message: q,
          history: messages.slice(-4),
          catalogSummary,
          location,
        }),
      });
      window.clearTimeout(requestTimeout);

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      const aiReply = data.reply || "I compared the available catalog and source-backed offers for your inquiry.";

      setMessages(prev => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          isAi: true,
          text: aiReply,
          matchedItems: matched.length > 0 ? matched : undefined,
          timestamp: data.realTimeTimestamp || Date.now(),
          sources: Array.isArray(data.sources) ? data.sources : [],
          sourceLabel: data.sourceLabel || (data.fallback ? 'Live catalog fallback — confirm at checkout' : 'Live Concierge response'),
          grounded: data.grounded === true,
        },
      ]);
    } catch (err) {
      console.warn('Fallback to local calculation:', err);
      // Seamless local calculation engine fallback
      const budgetMatch = q.match(/(?:under|below|<)\s*₹?\s*(\d+)/i);
      const budgetCap = budgetMatch ? parseInt(budgetMatch[1], 10) : 1e9;

      let fallbackText = '';
      if (/^(hi|hello|hey|yo|greetings|good\s*(morning|afternoon|evening)|sup|howdy)\b/i.test(q)) {
        fallbackText = `Hello! 👋 I'm **${brandName} Intelligence**, checking the available DealNest catalog in **${location}**.\n\nWhat product, food, grocery, travel, entertainment, or service do you want to compare?`;
      } else if (matched.length > 0) {
        const primary = matched[0];
        const scored = scoreOffers(primary, disabledPlatforms);
        const valid = scored.filter(o => !o.na && (tot(o) ?? 9e9) <= budgetCap);

        if (valid.length > 0) {
          const cheapest = valid.reduce((p, c) => ((c.t ?? 9e9) <= (p.t ?? 9e9) ? c : p));
          const best = valid.reduce((p, c) => (c.score >= p.score ? c : p));

          fallbackText = `⚡ **DealNest catalog comparison for ${primary.name} in ${location}:**\n\n- 🏆 **Lowest Listed Landed Cost:** **${cheapest.p}** at **${fmt(
            cheapest.t
          )}** (Includes delivery fee)\n- 🥈 **Highest Rated Offer:** **${best.p}** at **${fmt(
            primary.type === 'food' || primary.type === 'cafe' ? best.t : best.price
          )}** (Score: ${best.score}/100, ETA: ${ety(best.eta)})\n\nClick below to compare connected offers, then confirm the current price, eligibility, fees, and final payable total at checkout.`;
        } else {
          fallbackText = `I checked the connected catalog for **${primary.name}**, but none of the listed stores are below **${fmt(
            budgetCap
          )}**. Try increasing your budget or checking our Today's Deals.`;
        }
      } else {
        fallbackText = `⚡ I checked DealNest coverage in ${location} for **"${q}"**.\n\nAsk about a specific item, city, budget, coupon, delivery fee, travel route, ride, pharmacy product, or service. I will identify source-backed listings and label checkout-only partner coverage clearly.`;
      }

      setMessages(prev => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          isAi: true,
          text: fallbackText,
          matchedItems: matched.length > 0 ? matched : undefined,
          timestamp: Date.now(),
          grounded: false,
          sourceLabel: 'Local catalog calculation',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const samplePrompts = [
    'Find the cheapest iPhone 17',
    'Compare this product everywhere',
    'Find the cheapest biryani from this link',
    'Find this milk cheaper',
    'Find new-user coupons for dinner',
    'Find returning-user offers under ₹500',
    'Is there a better deal?',
  ];

  // Helper to format simple markdown (bold, lists, links, tables)
  const renderFormattedText = (text: string) => {
    const lines = text.split('\n');
    return (
      <div className="space-y-1 text-xs sm:text-sm">
        {lines.map((line, lIdx) => {
          if (!line.trim()) return <div key={lIdx} className="h-1" />;

          // Check if table row (e.g. | Store | Price |)
          if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
            const cells = line.split('|').slice(1, -1).map(c => c.trim());
            // separator line (e.g. |---|---|)
            if (cells.every(c => /^:?-+:?$/.test(c))) {
              return <hr key={lIdx} className="border-t border-[var(--bd)]/30 my-1" />;
            }
            return (
              <div
                key={lIdx}
                className="grid gap-2 py-1.5 px-2 rounded bg-black/5 dark:bg-white/5 font-mono text-[11px] items-center overflow-x-auto"
                style={{ gridTemplateColumns: `repeat(${Math.max(cells.length, 1)}, minmax(80px, 1fr))` }}
              >
                {cells.map((cell, cIdx) => {
                  const linkMatch = cell.match(/\[(.*?)\]\((.*?)\)/);
                  if (linkMatch) {
                    const href = safeSourceUrl(linkMatch[2]);
                    if (!href) {
                      return <span key={cIdx} className="truncate font-semibold">{linkMatch[1]}</span>;
                    }
                    return (
                      <a
                        key={cIdx}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--pri)] hover:underline font-bold inline-flex items-center gap-0.5 truncate"
                      >
                        <span>{linkMatch[1]}</span>
                        <ExternalLink className="w-2.5 h-2.5 inline" />
                      </a>
                    );
                  }
                  return (
                    <span key={cIdx} className="truncate font-semibold">
                      {cell.replace(/\*\*/g, '')}
                    </span>
                  );
                })}
              </div>
            );
          }

          // Format links and bold text
          // First split by markdown link pattern [text](url)
          const linkPattern = /(\[.*?\]\(.*?\))/g;
          const linkSegments = line.split(linkPattern);

          return (
            <p key={lIdx} className="leading-relaxed">
              {linkSegments.map((seg, sIdx) => {
                const matchLink = seg.match(/^\[(.*?)\]\((.*?)\)$/);
                if (matchLink) {
                  const href = safeSourceUrl(matchLink[2]);
                  if (!href) return <span key={sIdx}>{matchLink[1]}</span>;
                  return (
                    <a
                      key={sIdx}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-extrabold text-[var(--pri)] hover:text-[#4121d4] underline inline-flex items-center gap-0.5 mx-0.5"
                    >
                      <span>{matchLink[1]}</span>
                      <ExternalLink className="w-3 h-3 inline" />
                    </a>
                  );
                }

                // Inner bold parsing
                const boldParts = seg.split(/(\*\*.*?\*\*)/g);
                return boldParts.map((part, bIdx) => {
                  if (part.startsWith('**') && part.endsWith('**')) {
                    return (
                      <strong key={`${sIdx}-${bIdx}`} className="font-extrabold text-[var(--ink)]">
                        {part.slice(2, -2)}
                      </strong>
                    );
                  }
                  return part;
                });
              })}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with source-aware assistant status */}
      <div className="flex items-center justify-between flex-wrap gap-3 p-4 rounded-2xl bg-[var(--card)] border-2 border-[var(--bd)] shadow-[4px_4px_0_var(--bd)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[var(--lime)] border-2 border-[var(--bd)] flex items-center justify-center shadow-[2px_2px_0_var(--bd)]">
            <Bot className="w-6 h-6 text-[#12102b]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black text-[var(--ink)] font-display tracking-tight">
                {brandName} Intelligence Concierge
              </h2>
              <span className="bg-[#12102b] text-[var(--lime)] text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-[var(--bd)] inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[var(--lime)] animate-ping" />
                <span>Source-aware answers</span>
              </span>
            </div>
            <p className="text-xs text-[var(--mut)] mt-0.5">
              Ask for offers, coupons, fees, and partner coverage in <strong className="text-[var(--ink)]">{location}</strong>; every response labels its evidence.
            </p>
          </div>
        </div>

      </div>

      {/* Data-source status bar */}
      <div className="p-2.5 px-3.5 rounded-xl bg-[var(--bg)] border border-[var(--bd)] text-xs flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-[var(--ink)]">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="font-bold">Data sources:</span>
          <span className="text-[var(--mut)]">Answers use the catalog and cited partner pages. Unknown values stay labeled for checkout verification.</span>
        </div>
      </div>

      {/* Chat Messages Container */}
      <div
        ref={chatContainerRef}
        className="dn-card min-h-[320px] max-h-[550px] overflow-y-auto flex flex-col gap-3.5 p-3 sm:p-6 bg-[var(--card)]"
      >
        {messages.map(msg => (
          <div
            key={msg.id}
            className={`p-3.5 sm:p-4 rounded-2xl border-2 border-[var(--bd)] max-w-full sm:max-w-[85%] leading-relaxed break-words ${
              msg.isAi
                ? 'bg-[var(--pri2)] text-[var(--ink)] shadow-[2px_2px_0_var(--bd)] mr-auto'
                : 'bg-[var(--pri)] text-white shadow-[2px_2px_0_var(--bd)] ml-auto font-medium'
            }`}
          >
            {renderFormattedText(msg.text)}

            {msg.isAi && (msg.sourceLabel || (msg.sources && msg.sources.length > 0)) && (
              <div className="mt-3 pt-3 border-t border-[var(--bd)]/15 space-y-2">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--mut)]">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  <span>{msg.sourceLabel || 'Source-aware response'}</span>
                </div>
                {msg.sources && msg.sources.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {msg.sources.slice(0, 5).map((source, sourceIndex) => {
                      const href = safeSourceUrl(source.uri);
                      return href ? (
                        <a
                          key={`${source.uri}-${sourceIndex}`}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--bd)]/30 bg-[var(--card)] px-2 py-1 text-[10px] font-semibold text-[var(--pri)] hover:underline"
                          title={source.title}
                        >
                          <span className="truncate max-w-[180px]">{source.title}</span>
                          <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                        </a>
                      ) : (
                        <span key={`${source.title}-${sourceIndex}`} className="rounded-full border border-[var(--bd)]/20 px-2 py-1 text-[10px] font-semibold text-[var(--mut)]">
                          {source.title}
                        </span>
                      );
                    })}
                  </div>
                )}
                <p className="text-[10px] leading-relaxed text-[var(--mut)]">
                  Prices, stock, eligibility, delivery fees, and final totals can change. Confirm the final payable amount on the official checkout page before ordering.
                </p>
              </div>
            )}

            {/* Attached Interactive Deal Action Chips */}
            {msg.matchedItems && msg.matchedItems.length > 0 && (
              <div className="mt-3 pt-3 border-t border-[var(--bd)]/20 space-y-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--mut)] block">
                  Matching catalog items:
                </span>
                <div className="flex flex-wrap gap-2">
                  {msg.matchedItems.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onNavigateSearch(item.name)}
                      className="dn-btn dn-btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{item.em}</span>
                      <span className="font-bold">{item.name}</span>
                      <ArrowRight className="w-3 h-3 text-[var(--pri)]" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Evidence footnote on AI responses */}
            {msg.isAi && (
              <div className="mt-2.5 pt-2 border-t border-[var(--bd)]/15 flex items-center justify-between text-[10px] text-[var(--mut)] flex-wrap gap-2">
                <span className={`flex items-center gap-1 font-semibold ${msg.grounded ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-300'}`}>
                  <CheckCircle2 className={`w-3 h-3 ${msg.grounded ? 'text-emerald-500' : 'text-amber-500'}`} />
                  <span>{msg.grounded ? 'Google-grounded or cited partner evidence' : 'Catalog evidence — confirm at checkout'}</span>
                </span>
                {msg.timestamp && (
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Thinking indicator */}
        {loading && (
          <div className="p-3.5 rounded-2xl border-2 border-[var(--bd)] bg-[var(--pri2)] text-[var(--ink)] shadow-[2px_2px_0_var(--bd)] mr-auto flex items-center gap-2 text-xs font-semibold">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--pri)]" />
            <span>Comparing catalog items, coupons, fees, and partner coverage...</span>
          </div>
        )}
      </div>

      {/* Query Input Box */}
      <form
        onSubmit={e => {
          e.preventDefault();
          handleSendMessage(input);
        }}
        className="flex flex-col sm:flex-row items-stretch gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask DealNest AI anything (e.g. 'lowest listed pizza price', 'compare headphones')..."
          className="dn-input flex-1 text-xs sm:text-sm py-2.5 min-w-0"
          disabled={loading}
          aria-label="Ask DealNest AI"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="dn-btn py-2.5 px-4 text-xs sm:text-sm font-bold disabled:opacity-50 flex items-center gap-1.5 cursor-pointer sm:shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          <span>Ask AI</span>
        </button>
      </form>

      {/* Quick Prompts */}
      <div className="flex gap-2 flex-wrap items-center pt-1">
        <span className="text-xs font-bold text-[var(--mut)]">Suggested prompts:</span>
        {samplePrompts.map(prompt => (
          <button
            key={prompt}
            type="button"
            disabled={loading}
            onClick={() => handleSendMessage(prompt)}
            className="dn-chip text-xs py-1 px-3 disabled:opacity-50 cursor-pointer"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
};
