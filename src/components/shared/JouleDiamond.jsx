export default function JouleDiamond({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <polygon points="24,3 42,17 34,45 14,45 6,17" fill="#6D28D9"/>
      {/* Top-left facet — lighter */}
      <polygon points="24,3 6,17 24,21" fill="#A78BFA"/>
      {/* Top-right facet — mid */}
      <polygon points="24,3 42,17 24,21" fill="#7C3AED"/>
      {/* Left facet — dark */}
      <polygon points="6,17 24,21 14,45" fill="#4C1D95"/>
      {/* Right facet — mid-dark */}
      <polygon points="42,17 34,45 24,21" fill="#5B21B6"/>
      {/* Bottom facet — darkest */}
      <polygon points="24,21 14,45 34,45" fill="#2E1065"/>
      {/* Subtle outline */}
      <polygon points="24,3 42,17 34,45 14,45 6,17" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8"/>
      {/* 4-pointed sparkle */}
      <path transform="translate(24,11)" d="M0,-5.5 C0.3,-1.4 1.4,-0.3 5.5,0 C1.4,0.3 0.3,1.4 0,5.5 C-0.3,1.4 -1.4,0.3 -5.5,0 C-1.4,-0.3 -0.3,-1.4 0,-5.5 Z" fill="white"/>
    </svg>
  );
}
