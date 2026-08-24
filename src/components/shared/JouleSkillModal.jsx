import { useState, useEffect, useCallback, useRef } from 'react';
import JouleDiamond from './JouleDiamond.jsx';
import { JouleAgent } from '../../lib/jouleAgent.js';

const STEPS = {
  AGENT_CHECK: 'agent_check',
  AGENT_STARTING: 'agent_starting',
  NO_AGENT: 'no_agent',
  NO_JOULE: 'no_joule',
  SKILL_CHECK: 'skill_check',
  CONFIRM_INSTALL: 'confirm_install',
  INSTALLING: 'installing',
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
  const [step, setStep] = useState(setupOnly ? STEPS.NO_AGENT : STEPS.AGENT_CHECK);
  const [error, setError] = useState('');
  const [skillInstalled, setSkillInstalled] = useState(false);
  const [sendOk, setSendOk] = useState(null);

  const go = useCallback(async () => {
    try {
      // 1. Check agent
      setStep(STEPS.AGENT_CHECK);
      let agentUp = await JouleAgent.isRunning();

      // 1a. Agent not running — try to auto-start via URI scheme
      if (!agentUp) {
        setStep(STEPS.AGENT_STARTING);
        agentUp = await JouleAgent.startViaURIScheme(15000);
        if (!agentUp) { setStep(STEPS.NO_AGENT); return; }
      }

      // setup-only mode: just confirm agent is running then close
      if (setupOnly) { onClose(); return; }

      // 1b. Check Joule Desktop is installed
      const jouleStatus = await JouleAgent.jouleStatus();
      if (!jouleStatus.installed) { setStep(STEPS.NO_JOULE); return; }

      // 2. Check skill
      setStep(STEPS.SKILL_CHECK);
      const check = await JouleAgent.checkSkill(skillName);
      if (check.installed) {
        setSkillInstalled(true);
        await doLaunch();
        return;
      }

      // 3. Confirm install
      setStep(STEPS.CONFIRM_INSTALL);
    } catch (e) {
      setError(e.message);
      setStep(STEPS.ERROR);
    }
  }, [skillName, setupOnly]);

  async function doInstallAndLaunch() {
    try {
      setStep(STEPS.INSTALLING);
      await JouleAgent.installSkill(skillName, skillContent);
      await doLaunch();
    } catch (e) {
      setError(e.message);
      setStep(STEPS.ERROR);
    }
  }

  async function doLaunch() {
    setStep(STEPS.LAUNCHING);
    try {
      if (promptText) {
        // send-prompt launches/focuses Joule AND pastes+submits the text
        const result = await JouleAgent.sendPrompt(promptText);
        setSendOk(result.ok);
      } else {
        await JouleAgent.launchJoule();
        await new Promise(r => setTimeout(r, 800));
      }
      setStep(STEPS.DONE);
    } catch (e) {
      setError(e.message);
      setStep(STEPS.ERROR);
    }
  }

  useEffect(() => { if (!setupOnly) go(); }, [go]);

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
            <Step icon="⏳" text="Connecting to PromptDeck Agent…" />
          )}

          {step === STEPS.AGENT_STARTING && (
            <div className="jsm-starting">
              <Step icon="⏳" text="Starting PromptDeck Agent…" />
              <p className="jsm-hint" style={{ marginTop: 10 }}>
                The agent is launching in the background. This takes a few seconds.<br />
                If a browser dialog asks permission to open a link, click <strong>Open</strong>.
              </p>
            </div>
          )}

          {step === STEPS.NO_AGENT && (
            <div className="jsm-no-agent">
              <p className="jsm-warn">Could not start PromptDeck Agent automatically.</p>
              <p>Complete this one-time setup so the agent starts automatically next time:</p>

              <ol className="jsm-setup-steps">
                <li>
                  <span className="jsm-step-num">1</span>
                  <div>
                    <strong>Install Node.js 18+</strong> if you don't have it yet.<br />
                    <a href="https://nodejs.org/en/download" target="_blank" rel="noreferrer">Download from nodejs.org</a>
                    <span className="jsm-hint"> — free, ~30 MB, run the installer and click Next.</span>
                  </div>
                </li>
                <li>
                  <span className="jsm-step-num">2</span>
                  <div>
                    <strong>Download the PromptDeck Agent</strong> and unzip it to <code>C:\promptdeck-agent</code>.<br />
                    <a href="https://github.com/chatonniers/prompt-manager-web/releases" target="_blank" rel="noreferrer">
                      Get the latest release on GitHub
                    </a>
                  </div>
                </li>
                <li>
                  <span className="jsm-step-num">3</span>
                  <div>
                    <strong>Register the auto-start shortcut</strong> (Windows — run once):<br />
                    <span className="jsm-hint">Open File Explorer, go to <code>C:\promptdeck-agent</code>, double-click <code>install-windows.reg</code>, click Yes.</span>
                    <br /><span className="jsm-hint">On Mac: open Terminal and run <code>bash ~/promptdeck-agent/install-mac.sh</code></span>
                  </div>
                </li>
                <li>
                  <span className="jsm-step-num">4</span>
                  <div>
                    <strong>Install dependencies</strong> — open a terminal and run once:
                    <CopyBlock code={'cd C:\\promptdeck-agent\nnpm install'} />
                  </div>
                </li>
                <li>
                  <span className="jsm-step-num">5</span>
                  <div>
                    <strong>Click "Try again"</strong> — the agent will start automatically from now on.
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

          {step === STEPS.CONFIRM_INSTALL && (
            <div>
              <p>
                The skill <strong>{skillName}</strong> is not installed in Joule Desktop.
                Install it now?
              </p>
              <div className="jsm-actions">
                <button className="btn-secondary" onClick={onClose}>Cancel</button>
                <button className="btn-primary" onClick={doInstallAndLaunch}>
                  Install &amp; Launch Joule
                </button>
              </div>
            </div>
          )}

          {step === STEPS.INSTALLING && (
            <Step icon="⏳" text={`Installing skill "${skillName}"…`} />
          )}

          {step === STEPS.LAUNCHING && (
            <Step icon="⏳" text="Sending prompt to Joule Desktop…" />
          )}

          {step === STEPS.DONE && (
            <div className="jsm-done">
              <div className="jsm-done-icon">
                <JouleDiamond size={36} />
              </div>
              <p>
                {skillInstalled
                  ? `Skill "${skillName}" is already active.`
                  : `Skill "${skillName}" installed.`}
              </p>
              {promptText ? (
                <p className="jsm-paste-hint">
                  {sendOk
                    ? <><strong>Prompt sent to Joule!</strong> Your conversation has started.</>
                    : <>Joule is open — <strong>paste your prompt (Ctrl+V)</strong> to start.</>}
                </p>
              ) : (
                <p className="jsm-paste-hint">
                  Joule Desktop is ready.<br />
                  <strong>Paste your prompt (Ctrl+V) to start a conversation.</strong>
                </p>
              )}
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
