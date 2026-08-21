// Fixed color palette for story flows — index matches DEFAULT_CATALOG.storyFlows order,
// with hash-based fallback for custom flows added later.
const PALETTE = [
  { bg: '#FEF3C7', text: '#B45309', border: '#F59E0B' }, // Procure-to-Pay      — amber
  { bg: '#DCFCE7', text: '#166534', border: '#22C55E' }, // Order-to-Cash       — green
  { bg: '#E0F2FE', text: '#0369A1', border: '#38BDF8' }, // Plan-to-Inventory   — sky
  { bg: '#FCE7F3', text: '#9D174D', border: '#EC4899' }, // Hire-to-Retire      — pink
  { bg: '#EDE9FE', text: '#5B21B6', border: '#8B5CF6' }, // Record-to-Report    — violet
  { bg: '#FEE2E2', text: '#991B1B', border: '#EF4444' }, // Lead-to-Cash        — red
  { bg: '#CCFBF1', text: '#115E59', border: '#14B8A6' }, // Design-to-Operate   — teal
  { bg: '#F1F5F9', text: '#475569', border: '#94A3B8' }, // Other               — slate
];

const KNOWN_FLOWS = [
  'Procure-to-Pay',
  'Order-to-Cash',
  'Plan-to-Inventory',
  'Hire-to-Retire',
  'Record-to-Report',
  'Lead-to-Cash',
  'Design-to-Operate',
  'Other',
];

function hashIndex(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % PALETTE.length;
}

export function getFlowColor(flow) {
  const idx = KNOWN_FLOWS.indexOf(flow);
  return idx >= 0 ? PALETTE[idx] : PALETTE[hashIndex(flow)];
}
