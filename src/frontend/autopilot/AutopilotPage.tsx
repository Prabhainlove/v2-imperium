import "./autopilot.css";
import { useEffect, useMemo, useRef, useState } from "react";

type StepStatus = "pending" | "running" | "done";
type Step = { id: number; title: string; subtitle: string; status: StepStatus; ts?: string };

const INITIAL_STEPS: Step[] = [
  { id: 1, title: "Launch Browser",       subtitle: "Opening Chrome...",                status: "pending" },
  { id: 2, title: "Navigate to Job URL",  subtitle: "Loading job page...",              status: "pending" },
  { id: 3, title: "Extract Job Details",  subtitle: "Reading job information...",       status: "pending" },
  { id: 4, title: "Upload Resume",        subtitle: "Uploading resume.pdf...",          status: "pending" },
  { id: 5, title: "Fill Application Form",subtitle: "Filling personal and job details", status: "pending" },
  { id: 6, title: "Submit Application",   subtitle: "Submitting application...",        status: "pending" },
  { id: 7, title: "Verify Submission",    subtitle: "Verifying application status...",  status: "pending" },
];

const SAMPLE_LOG = [
  "[boot] local agent started successfully",
  "[chrome] browser launched",
  "[nav] navigated to: https://imperium.jobs/postings/frontend-engineer",
  "[scrape] job details extracted successfully",
  "[upload] resume.pdf uploaded successfully",
  "[form] filling application form fields...",
  "[click] submit button pressed",
  "[verify] application submitted successfully!",
];

function fmtTime(d = new Date()) {
  return d.toLocaleTimeString(undefined, { hour12: true });
}
function fmtDate(d = new Date()) {
  return d.toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric", year: "numeric" });
}

export function AutopilotPage() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  const [jobUrl, setJobUrl] = useState("https://imperium.jobs/postings/frontend-engineer");
  const [steps, setSteps] = useState<Step[]>(INITIAL_STEPS);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [log, setLog] = useState<string[]>(SAMPLE_LOG);
  const timersRef = useRef<number[]>([]);

  const elapsed = useMemo(() => {
    if (!startedAt) return "00:00:00";
    const s = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
    const hh = String(Math.floor(s / 3600)).padStart(2, "0");
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    return `${hh}:${mm}:${ss}`;
  }, [now, startedAt]);

  const completedCount = steps.filter((s) => s.status === "done").length;
  const status: "IDLE" | "IN PROGRESS" | "COMPLETED" = !startedAt
    ? "IDLE"
    : completedCount === steps.length ? "COMPLETED" : "IN PROGRESS";

  const pushLog = (line: string) => setLog((l) => [...l, `[${fmtTime()}] ${line}`].slice(-200));

  const clearTimers = () => { timersRef.current.forEach((t) => clearTimeout(t)); timersRef.current = []; };

  const start = () => {
    if (running) return;
    clearTimers();
    setRunning(true);
    setPaused(false);
    setStartedAt(new Date());
    setSteps(INITIAL_STEPS.map((s) => ({ ...s })));
    pushLog("agent started");
    let delay = 600;
    INITIAL_STEPS.forEach((step, i) => {
      const tStart = window.setTimeout(() => {
        setSteps((curr) => curr.map((c) => c.id === step.id ? { ...c, status: "running" } : c));
        pushLog(`${step.title.toLowerCase()}...`);
      }, delay);
      const tDone = window.setTimeout(() => {
        setSteps((curr) => curr.map((c) => c.id === step.id ? { ...c, status: "done", ts: fmtTime() } : c));
        pushLog(`✓ ${step.title}`);
        if (i === INITIAL_STEPS.length - 1) { setRunning(false); pushLog("agent finished"); }
      }, delay + 1200);
      timersRef.current.push(tStart, tDone);
      delay += 1500;
    });
  };

  const pause = () => { setPaused((p) => !p); pushLog(paused ? "▶ resumed" : "⏸ paused"); };
  const reset = () => {
    clearTimers();
    setRunning(false); setPaused(false); setStartedAt(null);
    setSteps(INITIAL_STEPS.map((s) => ({ ...s })));
    pushLog("task reset");
  };
  const stop = () => { clearTimers(); setRunning(false); pushLog("⛔ agent stopped"); };

  useEffect(() => () => clearTimers(), []);

  return (
    <div className="la-root">
      <header className="la-header">
        <div className="la-header-center">
          <h1>Local Agent Control Center</h1>
          <p>AI Powered · Local Execution · Real Browser Automation</p>
        </div>
        <div className="la-clock">
          <div className="la-clock-time">{fmtTime(now)}</div>
          <div className="la-clock-date">{fmtDate(now)}</div>
        </div>
        <div className="la-bot" aria-hidden>🤖</div>
      </header>

      <section className="la-status-strip">
        <StatusCard label="Local Agent" value="ONLINE" />
        <StatusCard label="Ollama (qwen3:8b)" value="CONNECTED" />
        <StatusCard label="Browser (Chrome)" value="CONNECTED" />
        <StatusCard label="System Status" value="HEALTHY" />
      </section>

      <div className="la-grid">
        <div className="la-col">
          <section className="la-card">
            <div className="la-card-head">
              <div>
                <h2>New Agent Task</h2>
                <p>Tell the agent what you want to do</p>
              </div>
            </div>
            <label className="la-label">Paste Job URL</label>
            <div className="la-input-row">
              <input
                className="la-input"
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://imperium.jobs/postings/..."
              />
              <button className="la-btn la-btn-primary" onClick={start} disabled={running}>
                ▶ Start Agent
              </button>
            </div>
            <div className="la-quick">
              <span className="la-quick-label">Quick Actions:</span>
              <button className="la-chip" onClick={() => pushLog("opened job URL")}>🌐 Open Job URL</button>
              <button className="la-chip" onClick={() => pushLog("apply triggered")}>📨 Apply to Job</button>
              <button className="la-chip" onClick={() => pushLog("resume upload triggered")}>⬆ Upload Resume</button>
              <button className="la-chip" onClick={() => pushLog("fill application triggered")}>📝 Fill Application</button>
            </div>
          </section>

          <div className="la-row-2">
            <section className="la-card">
              <h2>Agent Execution Steps</h2>
              <ul className="la-steps">
                {steps.map((s) => (
                  <li key={s.id} className={`la-step la-step-${s.status}`}>
                    <span className="la-step-num">{s.id}</span>
                    <div className="la-step-body">
                      <div className="la-step-title">{s.title}</div>
                      <div className="la-step-sub">{s.subtitle}</div>
                    </div>
                    <span className="la-step-meta">
                      {s.status === "done" ? <span className="la-tick">✓</span>
                       : s.status === "running" ? <span className="la-spin">◐</span>
                       : <span className="la-pending">○</span>}
                      <span className="la-step-ts">{s.ts ?? (s.status === "pending" ? "Pending" : "—")}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="la-card">
              <h2>Task Summary</h2>
              <SummaryRow k="Task Type" v="Apply to Job" />
              <SummaryRow k="Portal" v={<span><b>🟢 Imperium Jobs</b></span>} />
              <SummaryRow k="Job Title" v="Frontend Engineer" />
              <SummaryRow k="Company" v="Imperium Labs" />
              <SummaryRow k="Status" v={<span className={`la-pill la-pill-${status === "COMPLETED" ? "ok" : status === "IN PROGRESS" ? "run" : "idle"}`}>{status}</span>} />
              <SummaryRow k="Started At" v={startedAt ? fmtTime(startedAt) : "—"} />
              <SummaryRow k="Elapsed Time" v={elapsed} />
              <div className="la-sub-label">Resume</div>
              <div className="la-file"><span>📄 resume.pdf</span><span className="la-file-size">1.2 MB</span><span className="la-tick">✓</span></div>
              <div className="la-sub-label">Form Profile</div>
              <div className="la-file"><span>👤 Default Profile</span><span className="la-tick">✓</span></div>
            </section>
          </div>

          <section className="la-card la-log-card">
            <div className="la-log-head">
              <h2>Activity Log</h2>
              <div className="la-log-actions">
                <button className="la-btn-ghost" onClick={() => setLog([])}>🗑 Clear Log</button>
                <button className="la-btn-ghost" onClick={() => {
                  const blob = new Blob([log.join("\n")], { type: "text/plain" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob); a.download = "local-agent-log.txt"; a.click();
                }}>⬇ Download Log</button>
              </div>
            </div>
            <pre className="la-log">
              {log.map((l, i) => <div key={i} className={l.includes("✓") ? "la-log-ok" : "la-log-line"}>{l}</div>)}
            </pre>
          </section>
        </div>

        <div className="la-col la-col-right">
          <section className="la-card la-browser">
            <div className="la-browser-head">
              <h2>Live Browser (Chrome)</h2>
              <span className="la-live">● LIVE</span>
            </div>
            <div className="la-chrome">
              <div className="la-chrome-bar">
                <span className="la-dot la-dot-r" /><span className="la-dot la-dot-y" /><span className="la-dot la-dot-g" />
                <div className="la-chrome-tab">Frontend Engineer · Imperium Labs</div>
              </div>
              <div className="la-chrome-url">🔒 imperium.jobs/postings/frontend-engineer</div>
              <div className="la-chrome-body">
                <div className="la-job-head">
                  <div className="la-job-logo">IL</div>
                  <div>
                    <div className="la-job-title">Frontend Engineer</div>
                    <div className="la-job-company">Imperium Labs</div>
                    <div className="la-job-meta">Remote · Worldwide · 1 hour ago · 142 applicants</div>
                  </div>
                </div>
                <div className="la-job-tags">
                  <span className="la-tag">Full-time</span>
                  <span className="la-tag">Mid–Senior level</span>
                  <span className="la-tag">React</span>
                </div>
                <div className="la-job-cta">
                  <button className="la-btn la-btn-primary">Apply ↗</button>
                  <button className="la-btn la-btn-secondary">Save</button>
                </div>
                <div className="la-job-section-title">About the job</div>
                <p className="la-job-desc">
                  Imperium Labs is building the AI-powered Career Operating System. We're hiring a Frontend
                  Engineer to craft a premium, fast, and intelligent experience across Job Discovery, Resume
                  Studio, and the Application Tracker.
                </p>
              </div>
            </div>
          </section>

          <section className="la-card">
            <div className="la-card-head"><h2>Portal Status</h2><span>🌐</span></div>
            <PortalRow k="Website" v="Imperium Jobs" />
            <PortalRow k="Current URL" v="imperium.jobs/postings/frontend-engineer" mono />
            <PortalRow k="Page Status" v={<span className="la-ok">Form Page Loaded</span>} />
            <PortalRow k="Detection" v={<span className="la-ok">Application Form Detected</span>} />
            <PortalRow k="Next Action" v={<span className="la-info">Filling Form Fields</span>} />
          </section>

          <section className="la-card la-controls">
            <h2>Agent Controls</h2>
            <button className="la-btn la-btn-primary" onClick={pause} disabled={!running}>
              {paused ? "▶ Resume Agent" : "⏸ Pause Agent"}
            </button>
            <button className="la-btn la-btn-warn" onClick={reset}>↻ Reset Task</button>
            <button className="la-btn la-btn-danger" onClick={stop} disabled={!running}>⛔ Stop Agent</button>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="la-status-card">
      <span className="la-status-dot" />
      <div>
        <div className="la-status-label">{label}</div>
        <div className="la-status-value">{value}</div>
      </div>
    </div>
  );
}
function SummaryRow({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="la-sum-row"><span className="la-sum-k">{k}</span><span className="la-sum-v">{v}</span></div>;
}
function PortalRow({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return <div className="la-portal-row"><span className="la-portal-k">{k}</span><span className={`la-portal-v ${mono ? "mono" : ""}`}>{v}</span></div>;
}

export default AutopilotPage;
