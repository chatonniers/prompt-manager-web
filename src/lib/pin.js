const STORAGE_KEY = 'pm-admin-pin';
const RESET_KEY = 'pm-admin-pin-reset';
const ADMIN_EMAIL = 'sylvain.chatonnier@gmail.com';

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function isPinSet() {
  return !!localStorage.getItem(STORAGE_KEY);
}

export async function setPin(pin) {
  const hash = await sha256(pin);
  localStorage.setItem(STORAGE_KEY, hash);
}

export async function verifyPin(pin) {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return false;
  const hash = await sha256(pin);
  return hash === stored;
}

export function generateResetToken() {
  const token = crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
  const expires = Date.now() + 30 * 60 * 1000; // 30 min
  localStorage.setItem(RESET_KEY, JSON.stringify({ token, expires }));
  return token;
}

export function verifyResetToken(input) {
  const raw = localStorage.getItem(RESET_KEY);
  if (!raw) return false;
  try {
    const { token, expires } = JSON.parse(raw);
    if (Date.now() > expires) { localStorage.removeItem(RESET_KEY); return false; }
    return input.trim().toUpperCase() === token;
  } catch { return false; }
}

export function clearPin() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(RESET_KEY);
}

export function openResetEmail(token) {
  const subject = encodeURIComponent('Prompt Manager – PIN Reset Request');
  const body = encodeURIComponent(
    `Hi Sylvain,\n\nI need to reset my admin PIN for the Prompt Manager.\n\nMy reset token is: ${token}\n\nPlease confirm this token so I can proceed with the reset.\n\nThanks`
  );
  window.open(`mailto:${ADMIN_EMAIL}?subject=${subject}&body=${body}`);
}

export { ADMIN_EMAIL };
