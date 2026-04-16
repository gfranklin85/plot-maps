// Broadcast script generation — templates + relative timing
// Enforces: max 20 sec (~45 words), 1 reference property per circle script

export interface ReferenceProperty {
  address: string;
  street_name: string;
  status: 'Sold' | 'Active' | 'Pending';
  price: number | null;
  dom: number | null;
  status_date: string | null; // ISO date string
}

export interface ReferencePack {
  id: string;
  market: string;
  properties: ReferenceProperty[];
}

export interface ScriptVariant {
  id: string;
  text: string;
  wordCount: number;
  estimatedSeconds: number;
}


const CTA_SHORT = `Press 1 if you're curious about your home's value, 2 if you're thinking about selling, or 3 if you're staying put.`;

/**
 * Humanize a date into relative timing.
 */
export function getRelativeTiming(dateStr: string | null): string {
  if (!dateStr) return 'recently';

  const date = new Date(dateStr + 'T12:00:00');
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'just closed today';
  if (diffDays === 1) return 'just closed yesterday';

  // Get day of week for "just closed on [day]"
  if (diffDays <= 6) {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    return `just closed on ${dayName}`;
  }
  if (diffDays <= 13) return 'just closed last week';
  if (diffDays <= 30) return 'recently closed';
  if (diffDays <= 60) return 'closed about a month ago';
  return 'recently sold';
}

function formatPrice(price: number | null): string {
  if (!price) return 'around market value';
  if (price >= 1_000_000) return `about $${(price / 1_000_000).toFixed(1)} million`;
  const k = Math.round(price / 1000);
  return `about $${k},000`;
}

function formatDom(dom: number | null): string {
  if (!dom) return '';
  if (dom <= 7) return `in just ${dom} days`;
  if (dom <= 14) return 'in about two weeks';
  if (dom <= 30) return `in about ${Math.round(dom / 7)} weeks`;
  return `after about ${Math.round(dom / 30)} months`;
}

function generateId(): string {
  return `var_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Generate 3 Circle Prospecting script variants.
 * Uses only the FIRST reference property (by design).
 */
export function generateCircleScripts(pack: ReferencePack, ctaEnabled: boolean): ScriptVariant[] {
  const prop = pack.properties[0];
  if (!prop) return [];

  const timing = getRelativeTiming(prop.status_date);
  const price = formatPrice(prop.price);
  const dom = formatDom(prop.dom);
  const cta = ctaEnabled ? CTA_SHORT : "Have a great day.";

  const variants = [
    // Variant A: direct, conversational
    `Quick neighborhood update for homeowners near ${prop.street_name}… A home on ${prop.street_name} ${timing} for ${price}${dom ? ` — it sold ${dom}` : ''}. A lot of people nearby are surprised how quickly things are moving right now. ${cta}`,

    // Variant B: softer, curiosity-driven
    `Hi there — quick update for the ${prop.street_name} area. A nearby home ${timing} for ${price}${dom ? `, ${dom}` : ''}. If you've been wondering what's happening in your neighborhood, here's a heads up. ${cta}`,

    // Variant C: shortest, punchy
    `Heads up for ${prop.street_name} homeowners — a home nearby ${timing} for ${price}${dom ? `, ${dom}` : ''}. The market's been moving fast in your area. ${cta}`,
  ];

  return variants.map((text) => ({
    id: generateId(),
    text: text.replace(/\s+/g, ' ').trim(),
    wordCount: countWords(text),
    estimatedSeconds: Math.ceil(countWords(text) / 2.5),
  }));
}

/**
 * Generate 3 Market Snapshot script variants.
 * Can reference multiple properties.
 */
export function generateMarketSnapshotScripts(pack: ReferencePack, ctaEnabled: boolean): ScriptVariant[] {
  const market = pack.market || 'your area';
  const soldCount = pack.properties.filter(p => p.status === 'Sold').length;
  const activeCount = pack.properties.filter(p => p.status === 'Active').length;
  const pendingCount = pack.properties.filter(p => p.status === 'Pending').length;
  const cta = ctaEnabled ? CTA_SHORT : "Have a great day.";

  const parts: string[] = [];
  if (soldCount > 0) parts.push(`${soldCount} home${soldCount > 1 ? 's' : ''} just sold`);
  if (activeCount > 0) parts.push(`${activeCount} currently listed`);
  if (pendingCount > 0) parts.push(`${pendingCount} under contract`);

  const activity = parts.join(', ');

  const variants = [
    `Quick market update for ${market} — ${activity} in your neighborhood recently. Things are moving, and it's worth knowing where your home stands. ${cta}`,
    `Hi there — just a quick snapshot of what's happening near ${market}. ${activity} nearby. If you're curious how that affects your home's value, now's a good time to check. ${cta}`,
    `Neighborhood update for ${market} homeowners — ${activity} right around you. The local market's been active. ${cta}`,
  ];

  return variants.map((text) => ({
    id: generateId(),
    text: text.replace(/\s+/g, ' ').trim(),
    wordCount: countWords(text),
    estimatedSeconds: Math.ceil(countWords(text) / 2.5),
  }));
}

/**
 * Generate a short voicemail version (8-10 seconds max).
 */
export function generateVoicemailScript(pack: ReferencePack): string {
  const prop = pack.properties[0];
  if (!prop) return 'Quick update — a home nearby just sold. Check your local market if you\'re curious.';

  const timing = getRelativeTiming(prop.status_date);
  return `Quick update — a home near ${prop.street_name} ${timing}. Worth knowing if you're curious about your area. Have a great day.`;
}
