export const ASSISTANT_COLORS = [
  { border: '#818CF8', bg: 'rgba(99,102,241,0.15)',  text: '#818CF8' },
  { border: '#34D399', bg: 'rgba(52,211,153,0.15)',  text: '#059669' },
  { border: '#F59E0B', bg: 'rgba(245,158,11,0.15)',  text: '#D97706' },
  { border: '#F472B6', bg: 'rgba(244,114,182,0.15)', text: '#DB2777' },
  { border: '#60A5FA', bg: 'rgba(96,165,250,0.15)',  text: '#2563EB' },
  { border: '#A78BFA', bg: 'rgba(167,139,250,0.15)', text: '#7C3AED' },
  { border: '#4ADE80', bg: 'rgba(74,222,128,0.15)',  text: '#16A34A' },
  { border: '#FB923C', bg: 'rgba(251,146,60,0.15)',  text: '#EA580C' },
];

export function getAssistantColor(assistantName, catalogAssistants) {
  const idx = (catalogAssistants || []).findIndex(a => {
    const en = typeof a.name === 'object' ? a.name.en || '' : a.name || '';
    return en === assistantName;
  });
  return idx >= 0 ? ASSISTANT_COLORS[idx % ASSISTANT_COLORS.length] : ASSISTANT_COLORS[0];
}
