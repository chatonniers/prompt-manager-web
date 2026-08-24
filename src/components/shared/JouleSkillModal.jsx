import { useState, useEffect, useCallback } from 'react';
import JouleDiamond from './JouleDiamond.jsx';
import { JouleAgent } from '../../lib/jouleAgent.js';

const STEPS = {
  AGENT_CHECK: 'agent_check',
  AGENT_STARTING: 'agent_starting',
  NO_AGENT: 'no_agent',
  NO_JOULE: 'no_joule',
  SKILL_CHECK: 'skill_check',
  SKILL_MISSING: 'skill_missing',
  LAUNCHING: 'launching',
  DONE: 'done',
  ERROR: 'error',
};

/**
 * Modal that walks the user through:
 * 1. Check agent is running
 * 2. Check / install skill in Joule Desktop
 * 3. Launch / focus Joule Desktop
 * 4. Auto-send the prompt text to Joule
 *
 * Props:
 *   skillName    string   – kebab-case name from SKILL.md frontmatter
 *   skillContent string   – full SKILL.md text to install if missing
 *   promptText   string   – the prompt body to auto-send after launch
 *   onClose      fn       – called when user closes
 */
export default function JouleSkillModal({ skillName, skillContent, promptText, setupOnly, onClose }) {
  const [step, setStep] = useState(STEPS.AGENT_CHECK);
  const [error, setError] = useState('');
  const [skillInstalled, setSkillInstalled] = useState(false);
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgentData?.platform || '');

  const continueAfterAgent = useCallback(async () => {
    try {
      if (setupOnly) { onClose(); return; }
      const jouleStatus = await JouleAgent.jouleStatus();
      if (!jouleStatus.installed) { setStep(STEPS.NO_JOULE); return; }
      if (!skillName) { await doLaunch(); return; }
      setStep(STEPS.SKILL_CHECK);
      const check = await JouleAgent.checkSkill(skillName);
      if (check.installed) { setSkillInstalled(true); await doLaunch(); return; }
      setStep(STEPS.SKILL_MISSING);
    } catch (e) { setError(e.message); setStep(STEPS.ERROR); }
  }, [skillName, setupOnly]);

  const go = useCallback(async () => {
    try {
      setStep(STEPS.AGENT_CHECK);
      const agentUp = await JouleAgent.isRunning();
      if (!agentUp) { setStep(STEPS.AGENT_STARTING); return; } // wait for user to click Launch Agent
      await continueAfterAgent();
    } catch (e) { setError(e.message); setStep(STEPS.ERROR); }
  }, [continueAfterAgent]);

  function fireURI() {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = 'promptdeck://start';
    document.body.appendChild(iframe);
    setTimeout(() => document.body.removeChild(iframe), 2000);
  }

  function downloadSkill() {
    if (!skillContent) return;
    const blob = new Blob([skillContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${skillName || 'skill'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function doLaunch() {
    setStep(STEPS.LAUNCHING);
    try {
      await JouleAgent.launchJoule();
    } catch (e) {
      setError(e.message);
      setStep(STEPS.ERROR);
      return;
    }
    setStep(STEPS.DONE);
  }

  useEffect(() => { go(); }, [go]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box joule-skill-modal" onClick={e => e.stopPropagation()}>
        <div className="jsm-header">
          <JouleDiamond size={22} />
          <span>Joule Desktop Integration</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="jsm-body">
          {step === STEPS.AGENT_CHECK && (
            <div>
              <Step icon="⏳" text="Connecting to PromptDeck Agent…" />
              <p className="jsm-hint" style={{ marginTop: 8 }}>Starting agent in background, please wait up to 30 seconds…</p>
            </div>
          )}

          {step === STEPS.AGENT_STARTING && (
            <div className="jsm-starting">
              <p>The PromptDeck Agent is not running.</p>
              <p className="jsm-hint">Click <strong>Launch Agent</strong> — your browser will ask permission once. Then wait a few seconds and click <strong>Check</strong>.</p>
              <div className="jsm-actions" style={{ marginTop: 12 }}>
                <button className="btn-secondary" onClick={onClose}>Cancel</button>
                <button className="btn-secondary" onClick={() => fireURI()}>Launch Agent</button>
                <button className="btn-primary" onClick={go}>Check</button>
              </div>
            </div>
          )}

          {step === STEPS.NO_AGENT && (
            <div className="jsm-no-agent">
              <p className="jsm-warn">Could not start PromptDeck Agent automatically.</p>
              <p>Run this one-time installer — it sets up everything automatically:</p>

              <ol className="jsm-setup-steps">
                <li>
                  <span className="jsm-step-num">1</span>
                  <div>
                    {isMac ? (
                      <>Open <strong>Terminal</strong> and paste:<CopyBlock code={'curl -fsSL https://raw.githubusercontent.com/chatonniers/prompt-manager-web/master/promptdeck-agent/install.sh | bash'} /></>
                    ) : (
                      <>Press <kbd>Win+R</kbd>, type <code>powershell</code>, press Enter, then paste:<CopyBlock code={'irm https://raw.githubusercontent.com/chatonniers/prompt-manager-web/master/promptdeck-agent/install.ps1 | iex'} /></>
                    )}
                    <span className="jsm-hint">This installs Node.js if needed, downloads the agent, registers the auto-start shortcut, and starts it — all automatically.</span>
                  </div>
                </li>
                <li>
                  <span className="jsm-step-num">2</span>
                  <div>
                    <strong>Click "Try again"</strong> once the installer finishes — the Joule toggle will start the agent automatically from now on.
                  </div>
                </li>
              </ol>

              <div className="jsm-actions">
                <button className="btn-secondary" onClick={onClose}>Cancel</button>
                <button className="btn-primary" onClick={go}>Try again</button>
              </div>
            </div>
          )}

          {step === STEPS.NO_JOULE && (
            <div>
              <p className="jsm-warn">Joule Desktop is not installed on this computer.</p>
              <p>
                Download Joule Desktop from your SAP IT portal or contact your SAP administrator to get access.
              </p>
              <div className="jsm-actions">
                <button className="btn-secondary" onClick={onClose}>Close</button>
                <button className="btn-primary" onClick={go}>Retry</button>
              </div>
            </div>
          )}

          {step === STEPS.SKILL_CHECK && (
            <Step icon="⏳" text={`Checking skill "${skillName}"…`} />
          )}

          {step === STEPS.SKILL_MISSING && (
            <div>
              <p>
                The skill <strong>{skillName}</strong> is not installed in Joule Desktop yet.
              </p>
              <ol className="jsm-setup-steps">
                <li>
                  <span className="jsm-step-num">1</span>
                  <div>
                    <strong>Download the skill file</strong> and save it somewhere you can find it.
                    <div style={{ marginTop: 8 }}>
                      <button className="btn-primary" onClick={downloadSkill}>
                        Download {skillName}.md
                      </button>
                    </div>
                  </div>
                </li>
                <li>
                  <span className="jsm-step-num">2</span>
                  <div>
                    In <strong>Joule Desktop</strong>, go to <strong>Settings → Skills → Import</strong> and select the downloaded file.
                  </div>
                </li>
                <li>
                  <span className="jsm-step-num">3</span>
                  <div>
                    Click <strong>Launch Joule</strong> below — your prompt is already on the clipboard, press <strong>Ctrl+V</strong> to submit.
                  </div>
                </li>
              </ol>
              <div className="jsm-actions" style={{ marginTop: 12 }}>
                <button className="btn-secondary" onClick={onClose}>Cancel</button>
                <button className="btn-primary" onClick={doLaunch}>Launch Joule</button>
              </div>
            </div>
          )}

          {step === STEPS.LAUNCHING && (
            <Step icon="⏳" text="Opening Joule Desktop…" />
          )}

          {step === STEPS.DONE && (
            <div className="jsm-done">
              <div className="jsm-done-icon">
                <JouleDiamond size={36} />
              </div>
              {skillName && (
                <p>{skillInstalled ? `Skill "${skillName}" is active.` : `Import "${skillName}.md" in Joule Settings → Skills if you haven't yet.`}</p>
              )}
              <p className="jsm-paste-hint">
                Joule is opening — your prompt is on the clipboard.<br />
                <strong>Press Ctrl+V in Joule to submit.</strong>
              </p>
              <div className="jsm-actions">
                <button className="btn-primary" onClick={onClose}>Done</button>
              </div>
            </div>
          )}

          {step === STEPS.ERROR && (
            <div>
              <p className="jsm-warn">Something went wrong:</p>
              <pre className="jsm-code jsm-error">{error}</pre>
              <div className="jsm-actions">
                <button className="btn-secondary" onClick={onClose}>Close</button>
                <button className="btn-primary" onClick={go}>Retry</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Step({ icon, text }) {
  return (
    <p className="jsm-step">
      <span className="jsm-step-icon">{icon}</span>
      {text}
    </p>
  );
}

function CopyBlock({ code }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div className="jsm-copy-block">
      <pre className="jsm-code">{code}</pre>
      <button className="jsm-copy-btn" onClick={copy} title="Copy to clipboard">
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );
}
