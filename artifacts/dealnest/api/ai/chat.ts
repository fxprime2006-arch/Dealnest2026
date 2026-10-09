const CATEGORY_GUIDE = [
  'E-Commerce & Electronics',
  'Quick Commerce & Groceries',
  'Food & Dining',
  'Fashion & Apparel',
  'Beauty & Cosmetics',
  'Medical & Pharmacy',
  'Jewelry',
  'Fitness',
  'Movies & Entertainment',
  'Travel: Hotels, Flights & Buses',
  'Cabs & Ride Services',
  'Bike & Scooter Rentals',
  'Home Services',
  'Cars & Auto Services',
];

function generateSmartFallback(message: string, location: string, catalogSummary: string): string {
  const q = message.toLowerCase().trim();

  if (/^(hi|hello|hey|yo|greetings|good\s*(morning|afternoon|evening)|sup|howdy)\b/i.test(q)) {
    return `Hello! I’m **DealNest Intelligence**, your comparison and offer guide in **${location}**.\n\nI can help with shopping, food, groceries, fashion, beauty, pharmacy, jewelry, fitness, entertainment, travel, rides, rentals, home services, and auto services. What would you like to compare?`;
  }

  if (/who are you|what can you do|how does this work|help/i.test(q)) {
    return `I compare connected live prices, delivery fees, available coupons, and partner checkout coverage across ${CATEGORY_GUIDE.length} DealNest categories. I label unavailable live data instead of inventing prices or codes. Ask for an exact item, platform, route, city, service, offer, or budget.`;
  }

  const budget = q.match(/(?:under|below|less than|<)\s*₹?\s*(\d+)/i)?.[1];
  const context = catalogSummary ? '\n\nI also received the latest DealNest catalog context and will use it when a matching connected item is available.' : '';
  return `I can compare **${message}** in **${location}** across the connected DealNest categories. ${budget ? `Your budget is ₹${budget}. ` : ''}Tell me the exact product, meal, route, service, or platform and I’ll show current connected data, coupons when verified, delivery/fees, and checkout confirmation requirements.${context}`;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, catalogSummary = '', location = 'Hyderabad' } = req.body || {};
  if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Message is required' });

  return res.status(200).json({ reply: generateSmartFallback(message, location, catalogSummary), grounded: Boolean(catalogSummary), realTimeTimestamp: Date.now() });
}
