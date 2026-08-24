/**
 * Hook for communicating with the local PromptDeck Agent (localhost:27384).
 * Returns null for each value when the agent is not reachable.
 */

const AGENT_URL = 'http://localhost:27384';
const TIMEOUT = 3000;

async function agentFetch(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(AGENT_URL + path, { ...options, signal: controller.signal });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export const JouleAgent = {
  async isRunning() {
    try {
      const data = await agentFetch('/status');
      return data.running === true;
    } catch {
      return false;
    }
  },

  // Trigger start-agent.bat / start-agent.sh via the promptdeck:// URI scheme.
  // Poll until agent is reachable (URI launch triggered by user button click in modal).
  async startViaURIScheme(maxWaitMs = 20000) {
    const interval = 2000;
    const deadline = Date.now() + maxWaitMs;
    await new Promise(r => setTimeout(r, 2000));
    while (Date.now() < deadline) {
      if (await this.isRunning()) return true;
      await new Promise(r => setTimeout(r, interval));
    }
    return false;
  },

  async jouleStatus() {
    const data = await agentFetch('/joule/status');
    return data; // { running: bool, installed: bool }
  },

  async launchJoule() {
    const data = await agentFetch('/joule/launch', { method: 'POST' });
    return data; // { ok, wasRunning }
  },

  async checkSkill(name) {
    const data = await agentFetch('/skills/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    return data; // { installed, id }
  },

  async installSkill(name, content) {
    const data = await agentFetch('/skills/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, content }),
    });
    return data; // { ok, id, alreadyInstalled? }
  },

  async sendPrompt(prompt) {
    const data = await agentFetch('/joule/send-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    return data; // { ok: bool }
  },

  shutdown() {
    // Fire-and-forget — no await, used on page unload
    try {
      fetch(AGENT_URL + '/shutdown', { method: 'POST', keepalive: true }).catch(() => {});
    } catch { /* ignore */ }
  },
};
