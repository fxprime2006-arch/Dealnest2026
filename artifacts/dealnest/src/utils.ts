import { Item, PlatformOffer, ScoredOffer, SortOption } from './types';
import { KEYWORDS, DEFAULT_PLATFORM_LINKS } from './data';

export const fmt = (n: number | null | undefined): string => {
  if (n == null || isNaN(n)) return '₹0';
  return '₹' + Math.round(n).toLocaleString('en-IN');
};

export const tot = (o: PlatformOffer): number | null => {
  return o.price == null ? null : o.price + (o.fee || 0);
};

export const ety = (e: number | null): string => {
  if (e == null) return 'Check on partner';
  if (e >= 1440) return Math.round(e / 1440) + ' days';
  return e + ' min';
};

export function scoreOffers(item: Item, disabledPlatforms: Record<string, boolean> = {}): ScoredOffer[] {
  const activeOffers = item.o.filter(o => disabledPlatforms[o.p] !== false);
  const validOffers = activeOffers.filter(o => o.price != null);
  
  if (validOffers.length === 0) {
    return activeOffers.map(o => ({
      ...o,
      t: null,
      disc: 0,
      score: 0,
      na: true,
    }));
  }

  const totals = validOffers.map(o => tot(o) as number);
  const mn = Math.min(...totals);
  const mx = Math.max(...totals);

  return activeOffers.map(o => {
    if (o.price == null) {
      return {
        ...o,
        t: null,
        disc: 0,
        score: 0,
        na: true,
      };
    }

    const t = tot(o) as number;
    const disc = Math.round(((item.mrp - o.price) / item.mrp) * 100);
    const ratingBonus = o.rating ? Math.max(0, Math.min(10, ((o.rating - 3.5) / 1.5) * 10)) : 0;
    const etaBonus = o.eta ? Math.max(0, 5 - o.eta / (item.type === 'shop' ? 1200 : 20)) : 2;
    const priceScore = mx === mn ? 45 : ((mx - t) / (mx - mn)) * 45;
    const discScore = Math.min(15, (disc / 40) * 15);

    const s = Math.round(25 + priceScore + discScore + ratingBonus + etaBonus);

    return {
      ...o,
      t,
      disc,
      score: Math.min(99, Math.max(1, s)),
      na: false,
    };
  });
}

// Levenshtein distance
export function lev(a: string, b: string): number {
  const m: number[][] = [];
  for (let i = 0; i <= a.length; i++) m[i] = [i];
  for (let j = 0; j <= b.length; j++) m[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      m[i][j] = Math.min(
        m[i - 1][j] + 1,
        m[i][j - 1] + 1,
        m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return m[a.length][b.length];
}

export function searchCatalog(query: string, items: Item[]): Item[] {
  const cleanQ = query
    .toLowerCase()
    .replace(/[₹]/g, ' ')
    .replace(/\b(under\s*\d+|cheapest|best|near\s*me|find|me|where|can|i|get|offers?|deals?|price|prices|compare|comparison)\b/gi, ' ')
    .trim();

  if (!cleanQ) return [...items];

  // Exclude purely conversational words from catalog scoring
  const conversationalStopwords = new Set([
    'hi', 'hello', 'hey', 'yo', 'sup', 'howdy', 'hola', 
    'thanks', 'thank', 'you', 'ok', 'okay', 'yes', 'no', 
    'what', 'how', 'who', 'tell', 'show', 'please', 'help', 
    'good', 'morning', 'afternoon', 'evening', 'night'
  ]);

  const rawWords = cleanQ.split(/\s+/).filter(w => w.length > 0);
  const words = rawWords.filter(w => !conversationalStopwords.has(w));

  // If the query only contained greetings/conversational tokens, don't match random items
  if (words.length === 0) return [];

  const scoredList = items.map(item => {
    const hayStr = (item.name + ' ' + (KEYWORDS[item.id] || '')).toLowerCase();
    const hayTokens = hayStr.split(/\s+/);
    let s = 0;

    words.forEach(w => {
      // Substring check in full name/keywords
      if (hayStr.includes(w)) {
        s += 6;
      }

      hayTokens.forEach(h => {
        if (h === w) {
          s += 8; // exact token match
        } else if (w.length >= 3 && h.startsWith(w)) {
          s += 4;
        } else if (w.length >= 4 && (h.includes(w) || w.includes(h))) {
          s += 3;
        } else if (w.length >= 4 && lev(w, h) <= 1) {
          s += 2;
        }
      });
    });

    return { item, s };
  });

  return scoredList
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map(x => x.item);
}

export function extractItemFromUrl(urlString: string): {
  href: string;
  n: string;
  slug: string;
  itemName: string;
  category: 'shop' | 'food' | 'qc';
} | null {
  try {
    const u = new URL(urlString.trim());
    if (!/^https?:$/.test(u.protocol)) return null;

    const h = u.hostname.replace(/^www\./, '').toLowerCase();
    const map: Record<string, string> = {
      'amazon.in': 'Amazon',
      'amazon.com': 'Amazon',
      'flipkart.com': 'Flipkart',
      'meesho.com': 'Meesho',
      'shopsy.in': 'Shopsy',
      'snapdeal.com': 'Snapdeal',
      'tatacliq.com': 'Tata CLiQ',
      'tatadigital.com': 'Tata Neu',
      'vijaysales.com': 'Vijay Sales',
      'myntra.com': 'Myntra',
      'ajio.com': 'AJIO',
      'nykaafashion.com': 'Nykaa Fashion',
      'bewakoof.com': 'Bewakoof',
      'thesouledstore.com': 'The Souled Store',
      'urbanic.com': 'Urbanic',
      'snitch.co.in': 'SNITCH',
      'beyoung.in': 'Beyoung',
      'westside.com': 'Westside',
      'lifestylestores.com': 'Lifestyle',
      'pantaloons.com': 'Pantaloons',
      'croma.com': 'Croma',
      'reliancedigital.in': 'Reliance Digital',
      'zomato.com': 'Zomato',
      'swiggy.com': 'Swiggy',
      'eatclub.com': 'EatClub',
      'dominos.co.in': "Domino's",
      'dominos.com': "Domino's",
      'magicpin.in': 'Magicpin',
      'eatsure.com': 'EatSure',
      'dineout.co.in': 'Dineout',
      'eazydiner.com': 'EazyDiner',
      'dotpe.in': 'DotPe',
      'freshmenu.com': 'FreshMenu',
      'pizzahut.co.in': 'Pizza Hut',
      'kfc.co.in': 'KFC',
      'burgerking.in': 'Burger King',
      'mcdelivery.co.in': "McDonald's",
      'zepto.com': 'Zepto',
      'zeptonow.com': 'Zepto',
      'blinkit.com': 'Blinkit',
      'bigbasket.com': 'BigBasket',
      'jiomart.com': 'JioMart',
      'dmartready.com': 'DMart Ready',
      'nykaa.com': 'Nykaa',
      'tirabeauty.com': 'Tira',
      'purplle.com': 'Purplle',
      'sephora.in': 'Sephora',
      'smytten.com': 'Smytten',
      'maccaron.in': 'Maccaron',
      '1mg.com': 'Tata 1mg',
      'pharmeasy.in': 'PharmEasy',
      'netmeds.com': 'Netmeds',
      'apollo247.com': 'Apollo 24|7',
      'medplusmart.com': 'MedPlus',
      'practo.com': 'Practo',
      'medibuddy.in': 'MediBuddy',
      'tanishq.co.in': 'Tanishq',
      'caratlane.com': 'CaratLane',
      'bluestone.com': 'BlueStone',
      'giva.co': 'GIVA',
      'melorra.com': 'Melorra',
      'candere.com': 'Candere',
      'kalyanjewellers.net': 'Kalyan Jewellers',
      'malabargoldanddiamonds.com': 'Malabar Gold & Diamonds',
      'cult.fit': 'Cult.fit',
      'healthifyme.com': 'HealthifyMe',
      'decathlon.in': 'Decathlon',
      'cultsport.com': 'Cultsport',
      'bookmyshow.com': 'BookMyShow',
      'district.in': 'District',
      'insider.in': 'Paytm Insider',
      'ticketnew.com': 'TicketNew',
      'pvrcinemas.com': 'PVR INOX',
      'cinepolisindia.com': 'Cinepolis',
      'netflix.com': 'Netflix',
      'primevideo.com': 'Prime Video',
      'hotstar.com': 'JioHotstar',
      'sonyliv.com': 'Sony LIV',
      'zee5.com': 'ZEE5',
      'aha.video': 'Aha',
      'makemytrip.com': 'MakeMyTrip',
      'cleartrip.com': 'Cleartrip',
      'easemytrip.com': 'EaseMyTrip',
      'ixigo.com': 'ixigo',
      'yatra.com': 'Yatra',
      'goibibo.com': 'Goibibo',
      'booking.com': 'Booking.com',
      'agoda.com': 'Agoda',
      'oyorooms.com': 'OYO',
      'airbnb.com': 'Airbnb',
      'redbus.in': 'RedBus',
      'abhibus.com': 'AbhiBus',
      'intrcity.com': 'IntrCity',
      'flixbus.in': 'FlixBus',
      'uber.com': 'Uber',
      'olacabs.com': 'Ola',
      'rapido.bike': 'Rapido',
      'nammayatri.in': 'Namma Yatri',
      'indrive.com': 'inDrive',
      'blu-smart.com': 'BluSmart',
      'yulu.bike': 'Yulu',
      'bounce.in': 'Bounce',
      'royalbrothers.com': 'Royal Brothers',
      'urbancompany.com': 'Urban Company',
      'nobroker.in': 'NoBroker',
      'housejoy.in': 'Housejoy',
      'mrright.in': 'Mr. Right',
      'justdial.com': 'Justdial',
      'cars24.com': 'Cars24',
    };

    let platform = map[h] || h;
    if (h.includes('swiggy.com') && u.pathname.includes('/instamart')) {
      platform = 'Instamart';
    }

    // 1. Check query parameters first
    const qParam = u.searchParams.get('dish') || 
                   u.searchParams.get('q') || 
                   u.searchParams.get('query') || 
                   u.searchParams.get('product') || 
                   u.searchParams.get('item');

    // 2. Parse pathname segments
    const segments = u.pathname.split('/').filter(Boolean);
    const ignoredPrefixes = new Set(['p', 'dp', 'gp', 'product', 'products', 'restaurants', 'city', 'prn', 'prid', 'buy', 'pd', 'ps', 'order', 'menu', 'search', 's']);
    const meaningfulSegments = segments.filter(s => !ignoredPrefixes.has(s.toLowerCase()));

    // Find longest meaningful segment which usually holds product/dish title
    const bestSegment = meaningfulSegments.sort((a, b) => b.length - a.length)[0] || segments[0] || '';
    const rawTarget = qParam || bestSegment;

    // Clean up slug
    let cleaned = decodeURIComponent(rawTarget)
      .replace(/[?#].*$/, '')
      .replace(/\/dp\/[A-Z0-9]+.*$/i, '')
      .replace(/\/p\/itm[a-z0-9]+.*$/i, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b(pid|itm|ref|tag|ascsubtag|cid|qid)=[a-zA-Z0-9_-]+/gi, '')
      .trim();

    // Specific domain entity extractions
    const lowerClean = cleaned.toLowerCase();
    let category: 'shop' | 'food' | 'qc' = 'shop';
    let itemName = cleaned;

    if (platform === 'Swiggy' || platform === 'Zomato' || platform === 'EatClub' || platform === "Domino's" || platform === 'Magicpin' || lowerClean.includes('biryani') || lowerClean.includes('pizza') || lowerClean.includes('burger') || lowerClean.includes('chicken') || lowerClean.includes('food')) {
      category = 'food';
      if (lowerClean.includes('biryani')) {
        itemName = lowerClean.includes('mutton') ? 'Mutton Biryani' : 'Chicken Dum Biryani';
      } else if (lowerClean.includes('pizza') || platform === "Domino's") {
        itemName = 'Margherita Pizza';
      } else if (lowerClean.includes('burger')) {
        itemName = 'Crispy Chicken Burger';
      } else if (lowerClean.includes('coffee')) {
        itemName = 'Iced Cold Coffee';
      } else {
        // Capitalize words
        itemName = cleaned.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') || 'Restaurant Meal';
      }
    } else if (platform === 'Zepto' || platform === 'Blinkit' || platform === 'Instamart' || platform === 'BigBasket' || lowerClean.includes('milk') || lowerClean.includes('dairy') || lowerClean.includes('grocery') || lowerClean.includes('bread') || lowerClean.includes('egg')) {
      category = 'qc';
      if (lowerClean.includes('milk') || lowerClean.includes('amul')) {
        itemName = 'Amul Taaza Toned Milk 1L';
      } else if (lowerClean.includes('egg')) {
        itemName = 'Farm Fresh Eggs (12 pcs)';
      } else {
        itemName = cleaned.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') || 'Grocery Essential';
      }
    } else {
      category = 'shop';
      if (lowerClean.includes('iphone 17') || (lowerClean.includes('iphone') && lowerClean.includes('17'))) {
        itemName = 'iPhone 17 256GB';
      } else if (lowerClean.includes('airpod') || lowerClean.includes('earbud')) {
        itemName = 'AirPods Pro (2nd gen)';
      } else if (lowerClean.includes('headphone')) {
        itemName = 'Wireless Headphones ANC';
      } else if (lowerClean.includes('shoe') || lowerClean.includes('running') || lowerClean.includes('sneaker')) {
        itemName = 'Running Shoes Pro';
      } else {
        itemName = cleaned.split(' ').slice(0, 6).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      }
    }

    if (!itemName || itemName.length < 2) {
      itemName = 'Featured Item';
    }

    return {
      href: u.href,
      n: platform,
      slug: cleaned,
      itemName,
      category,
    };
  } catch {
    return null;
  }
}

export function parseUrlInfo(query: string): { href: string; n: string; slug: string; itemName?: string; category?: 'shop' | 'food' | 'qc' } | null {
  const extracted = extractItemFromUrl(query);
  if (!extracted) return null;
  return {
    href: extracted.href,
    n: extracted.n,
    slug: extracted.slug,
    itemName: extracted.itemName,
    category: extracted.category,
  };
}

export function generatePartnerUrl(
  platform: string,
  itemName: string,
  customAffiliates: Record<string, string> = {}
): string | null {
  const cleanName = itemName.replace(/\s*\(.*\)|\s*\d+GB/g, '').trim();
  const affTemplate = typeof customAffiliates[platform] === 'string' ? customAffiliates[platform].trim() : '';
  const template = affTemplate || DEFAULT_PLATFORM_LINKS[platform];

  if (!template) return null;

  const destination = template
    .replace('{qd}', encodeURIComponent(cleanName.toLowerCase().replace(/\s+/g, '-')))
    .replace('{q}', encodeURIComponent(cleanName));
  return isSafeOutboundUrl(destination, platform) ? destination : null;
}

export function isSafeOutboundUrl(url: string | null | undefined, platform?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (platform && DEFAULT_PLATFORM_LINKS[platform]) {
      const reference = new URL(DEFAULT_PLATFORM_LINKS[platform].replace('{qd}', 'item').replace('{q}', 'item'));
      return parsed.hostname === reference.hostname || parsed.hostname.endsWith(`.${reference.hostname}`);
    }
    return parsed.hostname === 'www.google.com' || parsed.hostname === 'google.com';
  } catch {
    return false;
  }
}

export const SORT_COMPARATORS: Record<SortOption, { label: string; fn: (a: ScoredOffer, b: ScoredOffer) => number }> = {
  rec: {
    label: 'Recommended',
    fn: (a, b) => b.score - a.score,
  },
  low: {
    label: 'Lowest price',
    fn: (a, b) => (a.t ?? 9e9) - (b.t ?? 9e9),
  },
  disc: {
    label: 'Highest discount',
    fn: (a, b) => b.disc - a.disc,
  },
  rate: {
    label: 'Best rating',
    fn: (a, b) => (b.rating ?? 0) - (a.rating ?? 0),
  },
  fast: {
    label: 'Fastest delivery',
    fn: (a, b) => (a.eta ?? 9e9) - (b.eta ?? 9e9),
  },
  val: {
    label: 'Best value',
    fn: (a, b) => {
      const valA = (a.score || 0) / (a.t || 1);
      const valB = (b.score || 0) / (b.t || 1);
      return valB - valA;
    },
  },
  pop: {
    label: 'Most popular',
    fn: (a, b) => b.score - a.score,
  },
};

export interface PriceTrendData {
  direction: 'down' | 'up' | 'stable';
  changePct: number;
  label: string;
  points: number[];
  currentPrice: number;
  previousPrice: number;
  isAllTimeLow: boolean;
}

export function getItemPriceTrend(item: Item): PriceTrendData {
  const validPrices = item.o
    .map(o => (item.type === 'food' || item.type === 'cafe' ? (o.price != null ? o.price + (o.fee || 0) : null) : o.price))
    .filter((p): p is number => p != null && p > 0);

  const currentLowest = validPrices.length ? Math.min(...validPrices) : item.mrp;

  let direction: 'down' | 'up' | 'stable' = 'down';
  let changePct = -8.5;
  let points: number[] = [];

  if (item.id === 'iph') {
    // iPhone 17: MRP 89900 -> 87900 -> 84900 -> 81999
    direction = 'down';
    changePct = -8.8;
    points = [89900, 88500, 87200, 85900, 84200, 82900, 81999];
  } else if (item.id === 'app') {
    // AirPods Pro 2: MRP 26900 -> was 11999 -> now 9999
    direction = 'down';
    changePct = -16.7;
    points = [11999, 11499, 10999, 10799, 10499, 10299, 9999];
  } else if (item.id === 'hdp') {
    direction = 'down';
    changePct = -11.5;
    points = [2599, 2549, 2499, 2450, 2399, 2350, 2299];
  } else if (item.id === 'bir') {
    // Chicken Biryani: was 169 -> 159 -> 139 (EatClub/Zomato)
    direction = 'down';
    changePct = -17.7;
    points = [169, 165, 159, 155, 149, 145, 139];
  } else if (item.id === 'piz') {
    // Margherita Pizza: was 189 -> 179 -> 159
    direction = 'down';
    changePct = -15.8;
    points = [189, 185, 179, 175, 169, 165, 159];
  } else if (item.id === 'cof') {
    direction = 'down';
    changePct = -7.8;
    points = [135, 132, 129, 128, 125, 122, 119];
  } else if (item.id === 'btr') {
    direction = 'down';
    changePct = -13.1;
    points = [229, 225, 219, 215, 209, 205, 199];
  } else if (item.id === 'bur') {
    direction = 'down';
    changePct = -11.8;
    points = [169, 165, 159, 155, 152, 149, 149];
  } else if (item.id === 'mlk') {
    direction = 'stable';
    changePct = 0;
    points = [64, 65, 64, 64, 65, 64, 64];
  } else if (item.id === 'egg') {
    direction = 'down';
    changePct = -6.4;
    points = [95, 94, 92, 90, 89, 89, 88];
  } else if (item.id === 'brd') {
    direction = 'down';
    changePct = -4.2;
    points = [48, 48, 47, 47, 46, 46, 46];
  } else if (item.id === 'shoe') {
    direction = 'down';
    changePct = -12.0;
    points = [2499, 2450, 2399, 2350, 2299, 2249, 2199];
  } else {
    // Deterministic fallback based on character code
    const charCode = item.name.charCodeAt(0) || 65;
    const mod = charCode % 3;
    if (mod === 0) {
      direction = 'down';
      changePct = -(4 + (charCode % 10));
      const start = Math.round(currentLowest * (1 + Math.abs(changePct) / 100));
      points = [
        start,
        Math.round(start * 0.98),
        Math.round(start * 0.96),
        Math.round(start * 0.94),
        Math.round(start * 0.92),
        Math.round(start * 0.91),
        currentLowest,
      ];
    } else if (mod === 1) {
      direction = 'up';
      changePct = +(2 + (charCode % 5));
      const start = Math.round(currentLowest * (1 - Math.abs(changePct) / 100));
      points = [
        start,
        Math.round(start * 1.01),
        Math.round(start * 1.01),
        Math.round(start * 1.02),
        Math.round(start * 1.02),
        Math.round(start * 1.02),
        currentLowest,
      ];
    } else {
      direction = 'stable';
      changePct = 0;
      points = [currentLowest, currentLowest, currentLowest, currentLowest, currentLowest, currentLowest, currentLowest];
    }
  }

  const isAllTimeLow = direction === 'down' && Math.abs(changePct) >= 8;
  let label = 'Price Stable';
  if (isAllTimeLow) {
    label = 'Lowest Price in 30 Days';
  } else if (direction === 'down') {
    label = `Trending Down ${Math.abs(changePct)}%`;
  } else if (direction === 'up') {
    label = `Trending Up +${changePct}%`;
  }

  const previousPrice = points[0];

  return {
    direction,
    changePct,
    label,
    points,
    currentPrice: currentLowest,
    previousPrice,
    isAllTimeLow,
  };
}
