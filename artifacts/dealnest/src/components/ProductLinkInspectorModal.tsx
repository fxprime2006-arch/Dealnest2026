import React, { useState } from 'react';
import { X, ExternalLink, TrendingDown, ShieldCheck, Ticket, Check, Sliders, AlertTriangle } from 'lucide-react';
import { Item, ScoredOffer } from '../types';
import { scoreOffers, fmt, ety } from '../utils';
import { PLATFORM_COLORS } from '../data';

interface ProductLinkInspectorModalProps {
  initialUrl?: string;
  items: Item[];
  onClose: () => void;
  onSelectProduct: (productName: string) => void;
  userToken?: string | null;
  onUpdateItemPrice?: (itemId: string, platform: string, newPrice: number) => void;
  onOpenHistory?: (item: Item) => void;
  onOpenOffer?: (item: Item, platform: string) => void;
}

export const ProductLinkInspectorModal: React.FC<ProductLinkInspectorModalProps> = ({
  initialUrl = '',
  items,
  onClose,
  onSelectProduct,
  userToken,
  onUpdateItemPrice,
  onOpenHistory,
  onOpenOffer,
}) => {
  const [urlInput, setUrlInput] = useState(initialUrl);
  const [analyzedItem, setAnalyzedItem] = useState<Item | null>(null);
  const [detectedPlatform, setDetectedPlatform] = useState<string>('Amazon');
  const [customPrice, setCustomPrice] = useState<number | null>(null);
  const [isAdjustingPrice, setIsAdjustingPrice] = useState(false);
  const [adjustedFeedback, setAdjustedFeedback] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisNotice, setAnalysisNotice] = useState<string | null>(null);

  // Sample real links to quickly test
  const sampleLinks = [
    { label: 'Amazon: iPhone 17 256GB', url: 'https://www.amazon.in/dp/B0BDK62PDX?tag=dealnest00-21', item: 'iph', plat: 'Amazon' },
    { label: 'Flipkart: AirPods Pro 2nd Gen', url: 'https://www.flipkart.com/apple-airpods-pro-2nd-gen/p/itm123', item: 'app', plat: 'Flipkart' },
    { label: 'Swiggy: Chicken Biryani', url: 'https://www.swiggy.com/restaurants/biryani-specials', item: 'bir', plat: 'Swiggy' },
    { label: 'Zepto: Amul Milk 1L', url: 'https://www.zepto.com/product/amul-milk-1l', item: 'mlk', plat: 'Zepto' },
  ];

  const analyzeUrl = async (url: string) => {
    const raw = url.trim();
    const looksLikeUrl = /^https?:\/\//i.test(raw) || /^(www\.)?[a-z0-9-]+\.(com|in|org|net|co)(\/|$)/i.test(raw);
    if (raw.length > 4096) {
      setAnalysisError('Product URLs can be up to 4096 characters.');
      return;
    }
    if (!looksLikeUrl) {
      setAnalyzedItem(null);
      setAnalysisError('Paste a supported product URL, such as an Amazon or Flipkart link.');
      return;
    }
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    try { new URL(normalized); } catch {
      setAnalyzedItem(null);
      setAnalysisError('Paste a valid http(s) product URL.');
      return;
    }
    setAnalysisError(null);
    setAnalysisNotice(null);
    setAnalyzedItem(null);
    setIsAnalyzing(true);
    const controller = new AbortController();
    const requestTimeout = window.setTimeout(() => controller.abort(), 15_000);
    fetch('/api/deals/inspect-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}) },
      signal: controller.signal,
      body: JSON.stringify({ url: normalized }),
    })
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.success || !data.product) throw new Error(data?.error || 'The product page did not return usable data.');
        const product = data.product;
        const inspectedItem: Item = {
          id: `inspected_${Date.now()}`,
          name: product.name,
          imageUrl: product.imageUrl,
          verifiedMrp: product.mrp,
          type: 'shop',
          em: '🛍️',
          mrp: product.mrp ?? product.price,
          pop: 0,
          o: [{ p: product.platform, price: product.price, rating: null, eta: null, fee: 0, coupon: null, directUrl: product.sourceUrl, isVerified: true }],
        };
        setDetectedPlatform(product.platform);
        setAnalyzedItem(inspectedItem);
        setCustomPrice(product.price);
        setAnalysisNotice(`Verified from the partner page: ${product.currency === 'INR' ? '₹' : product.currency} ${product.price.toLocaleString('en-IN')}. Competitor prices are shown only when independently fetched.`);
      })
      .catch((error: any) => {
        setAnalyzedItem(null);
        setAnalysisNotice(null);
        const message = error?.name === 'AbortError'
          ? 'Product data could not be verified for this URL. The partner page took too long to respond.'
          : /403|429|blocked|forbidden/i.test(error?.message || '')
            ? 'Product data could not be verified for this URL. The partner page blocked automated inspection.'
            : `Product data could not be verified for this URL. ${error?.message || 'The page did not expose reliable product data.'}`;
        setAnalysisError(message);
      })
      .finally(() => {
        window.clearTimeout(requestTimeout);
        setIsAnalyzing(false);
      });
  };

  React.useEffect(() => {
    if (initialUrl) analyzeUrl(initialUrl);
  }, [initialUrl]);

  const handleApplyAdjustedPrice = () => {
    if (!analyzedItem || customPrice == null || !Number.isFinite(customPrice) || customPrice <= 0) return;
    setAnalyzedItem(current => current ? {
      ...current,
      o: current.o.map(offer => offer.p === detectedPlatform ? { ...offer, price: customPrice } : offer),
    } : current);
    if (onUpdateItemPrice) {
      onUpdateItemPrice(analyzedItem.id, detectedPlatform, customPrice);
    }
    setAdjustedFeedback(true);
    setTimeout(() => setAdjustedFeedback(false), 2500);
  };

  const scoredList: ScoredOffer[] = analyzedItem ? scoreOffers(analyzedItem) : [];
  const validOffers = scoredList.filter(o => !o.na);
  const bestOffer = validOffers.length
    ? validOffers.reduce((p, c) => ((c.t ?? 9e9) < (p.t ?? 9e9) ? c : p))
    : null;

  const currentPlatOffer = validOffers.find(o => o.p === detectedPlatform);

  const observedPrice = customPrice || currentPlatOffer?.price || null;

  return (
    <div
      className="fixed inset-0 bg-[#12102b]/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-[var(--card)] border-2 border-[var(--bd)] rounded-[24px] p-6 max-w-2xl w-full shadow-[8px_8px_0_var(--pri)] relative max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg border border-[var(--bd)] text-[var(--mut)] hover:text-[var(--ink)] hover:bg-[var(--bg)] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5 mb-2">
          <span className="p-2 rounded-xl bg-[var(--lime)] border-2 border-[var(--bd)] text-lg">
            🔗
          </span>
          <div>
              <h2 className="text-xl font-extrabold text-[var(--ink)] font-display">
              Link Price Inspector
            </h2>
            <p className="text-xs text-[var(--mut)]">
              Extract the item, compare available DealNest prices, and confirm the final offer at checkout.
            </p>
          </div>
        </div>

        {/* URL Input Box */}
        <div className="mt-4 mb-3">
          <label className="text-xs font-bold text-[var(--ink)] block mb-1">
            Paste Product or Search URL:
          </label>
          <div className="flex flex-col sm:flex-row gap-2 min-w-0">
            <input
              type="text"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="e.g. https://www.amazon.in/dp/B0BDK62PDX"
              className="dn-input flex-1 min-w-0 text-xs py-2 font-mono"
            />
            <button
              type="button"
              onClick={() => analyzeUrl(urlInput)}
              disabled={isAnalyzing}
              className="dn-btn text-xs py-2 px-4 font-bold w-full sm:w-auto disabled:opacity-50"
            >
              {isAnalyzing ? 'Analyzing…' : 'Analyze'}
            </button>
          </div>
        </div>

        {analysisError && (
          <div className="mt-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-200" role="status">
            <div className="flex items-center justify-between gap-3">
              <span>{analysisError}</span>
              <button type="button" onClick={() => void analyzeUrl(urlInput)} className="shrink-0 underline font-bold cursor-pointer">Retry</button>
            </div>
          </div>
        )}
        {analysisNotice && !analysisError && (
          <div className="mt-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-[11px] text-cyan-700 dark:text-cyan-200" role="status">
            {analysisNotice}
          </div>
        )}

        {/* Quick Sample Links */}
        <div className="flex items-center gap-1.5 flex-wrap mb-4">
          <span className="text-[10px] font-bold text-[var(--mut)] uppercase">Try:</span>
          {sampleLinks.map(s => (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                setUrlInput(s.url);
                void analyzeUrl(s.url);
              }}
              disabled={isAnalyzing}
              className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-[var(--bd)] bg-[var(--bg)] hover:bg-[var(--lime)] text-[var(--ink)] cursor-pointer disabled:opacity-50"
            >
              {s.label}
            </button>
          ))}
        </div>

        {!analyzedItem && !isAnalyzing && (
          <div className="rounded-2xl border-2 border-dashed border-[var(--bd)] bg-[var(--bg)] p-5 text-center text-xs text-[var(--mut)]">
            Paste a partner URL above or choose a sample link to inspect its catalog match.
          </div>
        )}

        {analyzedItem && (
          <div className="space-y-4 pt-2 border-t-2 border-[var(--bd)]">
            {/* Analysis Result Banner */}
            <div className="p-3.5 rounded-2xl border-2 border-[var(--bd)] bg-[var(--bg)] flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {analyzedItem.imageUrl ? (
                  <img src={analyzedItem.imageUrl} alt={analyzedItem.name} className="w-16 h-16 rounded-xl object-contain bg-white border border-[var(--bd)]" />
                ) : (
                  <span className="text-3xl p-1 rounded-xl bg-[var(--card)] border border-[var(--bd)]">{analyzedItem.em}</span>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-extrabold text-white"
                      style={{ backgroundColor: PLATFORM_COLORS[detectedPlatform] || '#473fa0' }}
                    >
                      {detectedPlatform}
                    </span>
                    <span className="text-xs font-bold text-[var(--mut)]">
                      MRP {analyzedItem.verifiedMrp == null ? 'Not supplied' : fmt(analyzedItem.verifiedMrp)}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-base text-[var(--ink)] font-display mt-0.5">
                    {analyzedItem.name}
                  </h3>
                  <p className="text-xs text-emerald-700 font-bold mt-1">
                    {bestOffer?.p === detectedPlatform ? (
                      `🏆 ${detectedPlatform} has the lowest catalog listing (${fmt(bestOffer?.t)}).`
                    ) : (
                      `⚡ Catalog listing available on ${bestOffer?.p} at ${fmt(bestOffer?.t)} (difference ${fmt(
                        (currentPlatOffer?.t || 0) - (bestOffer?.t || 0)
                      )})!`
                    )}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-[var(--mut)] block">Catalog Price:</span>
                <span className="text-xl font-extrabold text-[var(--ink)] font-display">
                  {fmt(customPrice || currentPlatOffer?.price || analyzedItem.mrp)}
                </span>
              </div>
            </div>

            {/* Price Adjustment Feature (Directly addressing user prompt) */}
            <div className="p-3 rounded-2xl border border-[var(--bd)] bg-[var(--card)]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-[var(--pri)]" />
                  <span className="font-bold text-xs text-[var(--ink)]">
                    Adjust Observed Price for {detectedPlatform}:
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAdjustingPrice(!isAdjustingPrice)}
                  className="text-xs font-bold text-[var(--pri)] hover:underline cursor-pointer"
                >
                  {isAdjustingPrice ? 'Hide Controls' : 'Adjust Listed Price'}
                </button>
              </div>

              {isAdjustingPrice && (
                <div className="mt-3 pt-3 border-t border-[var(--bd)]/30 space-y-2">
                  <p className="text-[11px] text-[var(--mut)]">
                    If you see a different flash price or bank offer on {detectedPlatform}'s website, adjust it here to recalculate DealNest's comparison score immediately.
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={customPrice || ''}
                      onChange={e => setCustomPrice(Number(e.target.value))}
                      className="dn-input text-xs py-1.5 px-3 w-36 font-display font-bold"
                    />
                    <button
                      type="button"
                      onClick={handleApplyAdjustedPrice}
                      className="dn-btn dn-btn-lime text-xs py-1.5 px-3 font-bold cursor-pointer"
                    >
                      Update Price Match
                    </button>
                    {adjustedFeedback && (
                      <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Price Updated!
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Price history availability */}
            <div className="p-4 rounded-2xl border-2 border-[var(--bd)] bg-[var(--bg)]">
                  <div className="flex items-center justify-between gap-3 mb-2">
                <span className="font-extrabold text-xs uppercase text-[var(--ink)] flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4 text-[var(--pri)]" />
                  Price history
                </span>
                    <span className="text-[11px] text-[var(--mut)] font-semibold">{observedPrice ? `Observed: ${fmt(observedPrice)}` : 'Not available'}</span>
                  </div>
              <p className="text-[11px] text-[var(--mut)] leading-relaxed">Open the catalog history view to inspect the selected item’s price trend and set an alert. Live partner history requires a connected partner feed.</p>
              {onOpenHistory && (
                <button
                  type="button"
                  onClick={() => { onClose(); onOpenHistory(analyzedItem); }}
                  className="dn-btn dn-btn-secondary text-[11px] py-1.5 px-3 mt-2 font-bold"
                >
                  View Price History & Set Alert
                </button>
              )}
            </div>

            {/* Cross-Platform Comparison Table */}
            <div>
              <span className="text-xs font-bold uppercase text-[var(--mut)] block mb-2">
                Competitor Listing Matrix:
              </span>
              <div className="space-y-2">
                {validOffers.length <= 1 && (
                  <p className="text-[11px] text-[var(--mut)] rounded-xl border border-dashed border-[var(--bd)] p-3">No independently fetched competitor quote was returned for this URL. DealNest will not invent comparison prices.</p>
                )}
                {validOffers.map(offer => {
                  const isCurrent = offer.p === detectedPlatform;
                  const isBest = offer.p === bestOffer?.p;

                  return (
                    <div
                      key={offer.p}
                      className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                        isBest
                          ? 'bg-[var(--lime)] border-[var(--bd)] text-[#12102b] font-bold shadow-[2px_2px_0_var(--bd)]'
                          : 'bg-[var(--card)] border-[var(--bd)]/50 text-[var(--ink)]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white font-extrabold text-[10px]"
                          style={{ backgroundColor: PLATFORM_COLORS[offer.p] || '#473fa0' }}
                        >
                          {offer.p.charAt(0)}
                        </span>
                        <div>
                          <span className="font-extrabold">{offer.p}</span>
                          {isCurrent && <span className="ml-1 text-[10px] opacity-80">(From your URL)</span>}
                          {offer.coupon && (
                            <span className="block text-[10px] text-[var(--mut)] font-normal">
                              Offer: {offer.coupon}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-extrabold text-sm">{fmt(offer.t)}</div>
                        <span className="text-[10px] text-emerald-700">
                          {isBest ? '🏆 BEST PRICE' : `+${fmt((offer.t || 0) - (bestOffer?.t || 0))}`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex gap-2 pt-2">
              {bestOffer && onOpenOffer && (
                <button
                  type="button"
                  onClick={() => { onClose(); onOpenOffer(analyzedItem, bestOffer.p); }}
                  className="dn-btn dn-btn-lime flex-1 text-xs py-2.5 font-bold"
                >
                  Continue to Best Offer
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onSelectProduct(analyzedItem.name);
                  onClose();
                }}
                className="dn-btn flex-1 text-xs py-2.5 font-bold"
              >
                View Full Comparison Page
              </button>
              <button
                type="button"
                onClick={onClose}
                className="dn-btn dn-btn-secondary text-xs py-2.5 px-4"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
