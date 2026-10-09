import { PLATFORM_GROUPS } from './platformDirectory';

export const DEAL_DIRECTORY_TOTAL = 100800;
export const DEAL_DIRECTORY_PAGE_SIZE = 24;

export type DealDirectoryRecord = {
  id: string;
  title: string;
  platform: string;
  categoryId: string;
  categoryTitle: string;
  icon: string;
  sourceUrl: string;
  sourceLabel: string;
};

const OFFER_TEMPLATES = [
  'Shopping offers and price-drop listings',
  'New-customer promotions',
  'Bank and payment savings',
  'Member and loyalty benefits',
  'Seasonal sale listings',
  'Delivery-fee and service offers',
  'Bundle and category promotions',
  'Travel, booking, or appointment offers',
];

const entries = PLATFORM_GROUPS.flatMap(group =>
  group.platforms.map(platform => ({ group, platform }))
);

function discoveryUrl(platform: string, template: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${platform} India ${template}`)}`;
}

export function getDealDirectoryRecords(
  offset: number,
  limit: number,
  categoryId = 'all',
  platform = 'all'
): DealDirectoryRecord[] {
  const records: DealDirectoryRecord[] = [];
  const normalizedPlatform = platform.toLowerCase();
  let matchIndex = 0;

  for (let index = 0; index < DEAL_DIRECTORY_TOTAL && records.length < limit; index += 1) {
    const entry = entries[index % entries.length];
    const template = OFFER_TEMPLATES[Math.floor(index / entries.length) % OFFER_TEMPLATES.length];
    const categoryMatches = categoryId === 'all' || entry.group.id === categoryId;
    const platformMatches = platform === 'all' || entry.platform.toLowerCase() === normalizedPlatform;
    if (!categoryMatches || !platformMatches) continue;
    if (matchIndex < offset) {
      matchIndex += 1;
      continue;
    }

    records.push({
      id: `directory-${index + 1}`,
      title: `${template} — ${entry.platform}`,
      platform: entry.platform,
      categoryId: entry.group.id,
      categoryTitle: entry.group.title,
      icon: entry.group.icon,
      sourceUrl: discoveryUrl(entry.platform, template),
      sourceLabel: 'Google discovery directory · verify on official partner page',
    });
    matchIndex += 1;
  }

  return records;
}
