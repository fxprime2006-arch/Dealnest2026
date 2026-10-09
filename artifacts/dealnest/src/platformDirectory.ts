export type PlatformCoverageState = 'live' | 'checkout' | 'directory';

export interface PlatformDirectoryGroup {
  id: string;
  title: string;
  icon: string;
  accent: string;
  description: string;
  platforms: string[];
}

export const PLATFORM_GROUPS: PlatformDirectoryGroup[] = [
  {
    id: 'commerce',
    title: 'E-Commerce & Electronics',
    icon: '🛒',
    accent: '#ffd6dc',
    description: 'Phones, electronics, appliances, and everyday retail price checks.',
    platforms: ['Amazon', 'Flipkart', 'Meesho', 'Shopsy', 'Snapdeal', 'JioMart', 'Tata CLiQ', 'Tata Neu', 'Croma', 'Reliance Digital', 'Vijay Sales'],
  },
  {
    id: 'quick-commerce',
    title: 'Quick Commerce & Groceries',
    icon: '⚡',
    accent: '#ffe9a3',
    description: 'Essentials, fresh grocery, delivery fees, and ETA comparison.',
    platforms: ['Blinkit', 'Zepto', 'Swiggy Instamart', 'BigBasket BB Now', 'Flipkart Minutes', 'Amazon Now', 'JioMart', 'DMart Ready'],
  },
  {
    id: 'food',
    title: 'Food & Dining',
    icon: '🍔',
    accent: '#d9f7a8',
    description: 'Food delivery, restaurant offers, dining vouchers, and checkout totals.',
    platforms: ['Swiggy', 'Zomato', 'EatSure', 'Magicpin/ONDC', 'Thrive', 'Dineout', 'EazyDiner', 'DotPe', 'FreshMenu', 'EatClub', "Domino's", 'Pizza Hut', 'KFC', 'Burger King', "McDonald's"],
  },
  {
    id: 'fashion',
    title: 'Fashion & Apparel',
    icon: '👕',
    accent: '#f7d8ff',
    description: 'Apparel, footwear, accessories, size variants, and fashion coupons.',
    platforms: ['Myntra', 'AJIO', 'Tata CLiQ Fashion', 'Nykaa Fashion', 'Meesho', 'SHEIN India', 'Bewakoof', 'The Souled Store', 'Urbanic', 'NEWME', 'SNITCH', 'Beyoung', 'Westside', 'Lifestyle', 'Pantaloons'],
  },
  {
    id: 'beauty',
    title: 'Beauty & Cosmetics',
    icon: '💄',
    accent: '#ffd9e8',
    description: 'Beauty, skincare, makeup, samples, bundles, and member offers.',
    platforms: ['Nykaa', 'Tira', 'Purplle', 'Sephora', 'Foxy', 'Tata CLiQ Palette', 'Smytten', 'Maccaron'],
  },
  {
    id: 'medical',
    title: 'Medical & Pharmacy',
    icon: '💊',
    accent: '#d8f4ff',
    description: 'Medicine, lab tests, wellness, and prescription checkout comparisons.',
    platforms: ['Tata 1mg', 'PharmEasy', 'Netmeds', 'Apollo 24|7', 'Truemeds', 'MedPlus', 'Practo', 'MediBuddy'],
  },
  {
    id: 'jewelry',
    title: 'Jewelry',
    icon: '💎',
    accent: '#e7ddff',
    description: 'Jewelry pricing, making charges, collections, and store availability.',
    platforms: ['Tanishq', 'CaratLane', 'BlueStone', 'GIVA', 'Mia by Tanishq', 'Melorra', 'Candere', 'Kalyan Jewellers', 'Malabar Gold & Diamonds'],
  },
  {
    id: 'fitness',
    title: 'Fitness',
    icon: '🏋️',
    accent: '#d8f7db',
    description: 'Fitness memberships, equipment, classes, and local gym options.',
    platforms: ['Cult.fit', 'HealthifyMe', 'Decathlon', 'Cultsport', 'Local gym memberships'],
  },
  {
    id: 'entertainment',
    title: 'Movies & Entertainment',
    icon: '🎬',
    accent: '#d9e2ff',
    description: 'Movie tickets, events, streaming plans, and entertainment offers.',
    platforms: ['BookMyShow', 'District', 'Paytm Insider', 'TicketNew', 'PVR INOX', 'Cinepolis', 'Netflix', 'Prime Video', 'JioHotstar', 'Sony LIV', 'ZEE5', 'Aha'],
  },
  {
    id: 'travel',
    title: 'Travel: Hotels, Flights & Buses',
    icon: '✈️',
    accent: '#d8f4ff',
    description: 'Fare, hotel, bus, cancellation, and travel coupon comparisons.',
    platforms: ['MakeMyTrip', 'Cleartrip', 'EaseMyTrip', 'ixigo', 'Yatra', 'Goibibo', 'Booking.com', 'Agoda', 'OYO', 'Airbnb', 'RedBus', 'AbhiBus', 'IntrCity', 'FlixBus'],
  },
  {
    id: 'cabs',
    title: 'Cabs & Ride Services',
    icon: '🚕',
    accent: '#fff0b8',
    description: 'Ride estimates, service fees, availability, and pickup comparison.',
    platforms: ['Uber', 'Ola', 'Rapido', 'Namma Yatri', 'inDrive', 'BluSmart'],
  },
  {
    id: 'bike-rentals',
    title: 'Bike & Scooter Rentals',
    icon: '🛵',
    accent: '#e5f5c8',
    description: 'Two-wheeler rental prices, deposits, and local availability.',
    platforms: ['Rapido Moto', 'Uber Moto', 'Ola Bike', 'Yulu', 'Bounce', 'Royal Brothers'],
  },
  {
    id: 'home-services',
    title: 'Home Services',
    icon: '🏠',
    accent: '#ffe0cf',
    description: 'Home repair, cleaning, moving, rental, and service-provider discovery.',
    platforms: ['Urban Company', 'NoBroker', 'Housejoy', 'Mr. Right', 'Justdial'],
  },
  {
    id: 'auto-services',
    title: 'Cars & Auto Services',
    icon: '🚗',
    accent: '#e2e2ff',
    description: 'Car purchase discovery and automotive service comparisons.',
    platforms: ['Cars24'],
  },
];

export const ALL_DIRECTORY_PLATFORMS = PLATFORM_GROUPS.flatMap(group => group.platforms);

// Only these platforms currently have seeded, continuously refreshed comparison data in this app.
export const LIVE_COMPARISON_PLATFORMS = ['Amazon', 'Flipkart', 'Croma', 'Reliance Digital', 'Myntra', 'AJIO', 'Meesho', 'Zomato', 'Swiggy', 'EatClub', "Domino's", 'Magicpin', 'Zepto', 'Blinkit', 'Instamart', 'BigBasket', 'JioMart'];

export function getPlatformCoverage(platform: string): PlatformCoverageState {
  if (LIVE_COMPARISON_PLATFORMS.includes(platform)) return 'live';
  if (ALL_DIRECTORY_PLATFORMS.includes(platform)) return 'checkout';
  return 'directory';
}

export function getDirectorySummary(): string {
  return PLATFORM_GROUPS.map(group => `${group.title}: ${group.platforms.join(', ')}`).join('\n');
}
