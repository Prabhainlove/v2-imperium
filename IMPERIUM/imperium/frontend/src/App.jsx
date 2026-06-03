
const API = import.meta.env.VITE_API_BASE_URL || "";

// ── HTTP helpers ──────────────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, opts);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || body.error || "Request failed");
  return body;
}

async function apiForm(path, formData) {
  return api(path, { method: "POST", body: formData });
}

// ── State management ──────────────────────────────────────────
const init = {
  health: null,
  agents: [],
  profile: null,
  profileHealth: null,
  dashboard: null,
  jobResult: null,
  taskResult: null,
  activity: [],
  notifications: [],
  error: "",
  loading: "",        // "job" | "task" | "profile" | "dashboard" | ""
  tab: "search",      // "search" | "applications" | "profile" | "activity"
  profileForm: {
    name: "Candidate",
    email: "candidate@example.com",
    phone: "",
    location: "Remote",
    skills: "Python, FastAPI, React, PostgreSQL, Docker, AWS",
    linkedin_profile: "",
    target_roles: "Python Developer",
    preferred_locations: "Remote",
    remote_only: false,
  },
  searchForm: {
    role: "Python Developer",
    location: "Remote",
    experience: "Backend Engineer",
    company: "Current Company",
    template: "modern",
    max_applications: 8,
  },
  resumeFile: null,
  task: "Summarize Imperium system health and next actions.",
};

function reducer(state, action) {
  switch (action.type) {
    case "SET": return { ...state, ...action.payload };
    case "SET_PROFILE_FORM": return { ...state, profileForm: { ...state.profileForm, ...action.payload } };
    case "SET_SEARCH_FORM": return { ...state, searchForm: { ...state.searchForm, ...action.payload } };
    default: return state;
  }
}

// ── Reusable components ───────────────────────────────────────
function Metric({ label, value, accent }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong style={accent ? { color: "var(--accent)" } : undefined}>{value ?? "—"}</strong>
    </div>
  );
}

function StatusPill({ online, label }) {
  return (
    <div className="system-pill">
      <span className={`dot${online ? " online" : ""}`} />
      {label}
    </div>
  );
}

function TabButton({ id, label, current, dispatch }) {
  return (
    <button
      type="button"
      className={`tab-btn${current === id ? " active" : ""}`}
      onClick={() => dispatch({ type: "SET", payload: { tab: id } })}
    >
      {label}
    </button>
  );
}

function Field({ label, children }) {
  return <label>{label}{children}</label>;
}

function Alert({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="alert" role="alert">
      {message}
      <button type="button" className="alert-close" onClick={onDismiss} aria-label="Dismiss">×</button>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  const [s, dispatch] = useReducer(reducer, init);
  const set = useCallback((payload) => dispatch({ type: "SET", payload }), []);
  const pollRef = useRef(null);

  // Load system + profile + dashboard on mount
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [health, agents] = await Promise.all([api("/health"), api("/agents")]);
        if (alive) set({ health, agents });
      } catch { /* backend not ready yet */ }

      try {
        const [profileRes, dashRes] = await Promise.all([
          api("/api/job-agent/profile"),
          api("/api/job-agent/dashboard"),
        ]);
        if (!alive) return;
        if (profileRes.profile) {
          set({ profile: profileRes.profile, profileHealth: profileRes.profile_health });
          const p = profileRes.profile;
          const prefs = p.preferences || {};
          dispatch({
            type: "SET_PROFILE_FORM", payload: {
              name: p.name || "",
              email: p.contact?.email || "",
              phone: p.contact?.phone || "",
              location: p.contact?.location || "",
              skills: (p.skills || []).join(", "),
              linkedin_profile: p.linkedin_profile || "",
              target_roles: (prefs.target_roles || []).join(", "),
              preferred_locations: (prefs.preferred_locations || []).join(", "),
              remote_only: !!prefs.remote_only,
            }
          });
        }
        if (dashRes) {
          set({
            dashboard: dashRes,
            notifications: dashRes.notifications || [],
            activity: dashRes.activity || [],
          });
        }
      } catch { /* no profile yet */ }
    })();
    return () => { alive = false; };
  }, [set]);

  // Poll activity feed every 8 s when a job search is running
  useEffect(() => {
    if (s.loading === "job") {
      pollRef.current = setInterval(async () => {
        try {
          const data = await api("/api/job-agent/activity?limit=20");
          set({ activity: Array.isArray(data) ? data : [] });
        } catch { /* ignore */ }
      }, 8000);
    } else {
      clearInterval(pollRef.current);
    }
    return () => clearInterval(pollRef.current);
  }, [s.loading, set]);

  // ── Actions ──
  async function runJobSearch(e) {
    e.preventDefault();
    set({ error: "", jobResult: null, loading: "job" });
    try {
      const fd = new FormData();
      fd.append("role", s.searchForm.role);
      fd.append("location", s.searchForm.location);
      fd.append("name", s.profileForm.name);
      fd.append("email", s.profileForm.email);
      fd.append("phone", s.profileForm.phone);
      fd.append("skills", s.profileForm.skills);
      fd.append("experience", s.searchForm.experience);
      fd.append("company", s.searchForm.company);
      fd.append("template", s.searchForm.template);
      fd.append("application_mode", "manual");
      fd.append("max_applications", String(s.searchForm.max_applications));
      if (s.resumeFile) fd.append("resume", s.resumeFile);
      const result = await apiForm("/api/job-agent/search", fd);
      set({ jobResult: result });
      // Refresh dashboard after search
      try { const d = await api("/api/job-agent/dashboard"); set({ dashboard: d, activity: d.activity || [] }); } catch { /**/ }
    } catch (err) {
      set({ error: err.message });
    } finally {
      set({ loading: "" });
    }
  }

  async function saveProfile(e) {
    e.preventDefault();
    set({ error: "", loading: "profile" });
    try {
      const pf = s.profileForm;
      const body = {
        name: pf.name,
        email: pf.email,
        phone: pf.phone,
        location: pf.location,
        skills: pf.skills.split(",").map((x) => x.trim()).filter(Boolean),
        linkedin_profile: pf.linkedin_profile,
        github_repositories: [],
        target_roles: pf.target_roles.split(",").map((x) => x.trim()).filter(Boolean),
        preferred_locations: pf.preferred_locations.split(",").map((x) => x.trim()).filter(Boolean),
        remote_only: pf.remote_only,
      };
      const res = await api("/api/job-agent/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      set({ profile: res.profile, profileHealth: res.profile_health });
    } catch (err) {
      set({ error: err.message });
    } finally {
      set({ loading: "" });
    }
  }

  async function runTask(e) {
    e.preventDefault();
    if (!s.task.trim()) return;
    set({ error: "", taskResult: null, loading: "task" });
    try {
      const submitted = await api("/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: s.task.trim(), priority: 3 }),
      });
      let final = null;
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const st = await api(`/status/${submitted.task_id}`);
        if (["completed", "failed", "success", "failure"].includes(st.status)) { final = st; break; }
      }
      set({ taskResult: final || { status: "pending", task_id: submitted.task_id } });
    } catch (err) {
      set({ error: err.message });
    } finally {
      set({ loading: "" });
    }
  }

  // ── Derived ──
  const jobAgent = useMemo(() => s.agents.find((a) => a.name === "JobAgent"), [s.agents]);
  const metrics = useMemo(() => s.dashboard?.metrics || {}, [s.dashboard]);
  const completeness = s.profileHealth?.score != null
    ? `${Math.round(s.profileHealth.score * 100)}%` : "—";
  const unread = s.notifications.filter((n) => !n.read_at).length;

  return (
    <main className="app-shell">
      {/* ── Top bar ── */}
      <header className="topbar">
        <div>
          <p className="eyebrow">Imperium</p>
          <h1>AI Job Application Platform</h1>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <StatusPill online={!!s.health?.kernel_running} label={s.health?.kernel_running ? "Backend online" : "Connecting…"} />
          {unread > 0 && <div className="badge">{unread} new</div>}
        </div>
      </header>

      <Alert message={s.error} onDismiss={() => set({ error: "" })} />

      {/* ── KPI row ── */}
      <section className="metrics-grid">
        <Metric label="Profile" value={completeness} accent={s.profileHealth?.score >= 0.8} />
        <Metric label="Applications" value={metrics.applications_sent} />
        <Metric label="Interviews" value={metrics.interviews_received} />
        <Metric label="Offers" value={metrics.offers} />
        <Metric label="Job Agent" value={jobAgent?.status || "—"} />
        <Metric label="Agents" value={s.health?.agents_count} />
        <Metric label="Interview Rate" value={metrics.interview_rate != null ? `${(metrics.interview_rate * 100).toFixed(1)}%` : "—"} />
        <Metric label="Under Review" value={metrics.under_review} />
      </section>

      {/* ── Tabs ── */}
      <nav className="tab-bar">
        {[["search", "Job Search"], ["applications", "Applications"], ["profile", "My Profile"], ["activity", "Activity"]].map(([id, label]) => (
          <TabButton key={id} id={id} label={label} current={s.tab} dispatch={dispatch} />
        ))}
      </nav>

      {/* ── Search tab ── */}
      {s.tab === "search" && (
        <section className="workspace">
          <form className="panel job-panel" onSubmit={runJobSearch}>
            <div className="panel-header">
              <div><p className="eyebrow">Job Agent</p><h2>Real-Time Job Search</h2></div>
              <button type="submit" disabled={s.loading === "job"}>
                {s.loading === "job" ? "Searching…" : "Search Jobs"}
              </button>
            </div>
            <div className="form-grid">
              <Field label="Role"><input value={s.searchForm.role} onChange={(e) => dispatch({ type: "SET_SEARCH_FORM", payload: { role: e.target.value } })} required /></Field>
              <Field label="Location"><input value={s.searchForm.location} onChange={(e) => dispatch({ type: "SET_SEARCH_FORM", payload: { location: e.target.value } })} required /></Field>
              <Field label="Current / Last Title"><input value={s.searchForm.experience} onChange={(e) => dispatch({ type: "SET_SEARCH_FORM", payload: { experience: e.target.value } })} /></Field>
              <Field label="Current Company"><input value={s.searchForm.company} onChange={(e) => dispatch({ type: "SET_SEARCH_FORM", payload: { company: e.target.value } })} /></Field>
              <Field label="Max Packages"><input type="number" min="1" max="20" value={s.searchForm.max_applications} onChange={(e) => dispatch({ type: "SET_SEARCH_FORM", payload: { max_applications: Number(e.target.value) } })} /></Field>
              <Field label="Resume (optional)"><input type="file" accept=".txt,.pdf,.doc,.docx" onChange={(e) => set({ resumeFile: e.target.files?.[0] || null })} /></Field>
            </div>
            {s.profileHealth?.missing?.length > 0 && (
              <p className="hint">Profile gaps: {s.profileHealth.missing.join(", ")} — fill them in the Profile tab for better results.</p>
            )}
          </form>

          <form className="panel task-panel" onSubmit={runTask}>
            <div className="panel-header">
              <div><p className="eyebrow">Kernel</p><h2>General Task</h2></div>
              <button type="submit" disabled={s.loading === "task"}>{s.loading === "task" ? "Running…" : "Run"}</button>
            </div>
            <textarea rows={7} value={s.task} onChange={(e) => set({ task: e.target.value })} />
            {s.taskResult && <pre>{JSON.stringify(s.taskResult, null, 2)}</pre>}
          </form>
        </section>
      )}

      {/* ── Search Results ── */}
      {s.tab === "search" && s.jobResult && <SearchResults result={s.jobResult} />}

      {/* ── Applications tab ── */}
      {s.tab === "applications" && <ApplicationsTab dashboard={s.dashboard} />}

      {/* ── Profile tab ── */}
      {s.tab === "profile" && (
        <section className="panel profile-panel" style={{ marginTop: 16 }}>
          <form onSubmit={saveProfile}>
            <div className="panel-header">
              <div><p className="eyebrow">Profile</p><h2>Your Candidate Profile</h2></div>
              <button type="submit" disabled={s.loading === "profile"}>{s.loading === "profile" ? "Saving…" : "Save Profile"}</button>
            </div>
            {s.profileHealth && (
              <div className="profile-health">
                <div className="health-bar" style={{ "--pct": `${Math.round(s.profileHealth.score * 100)}%` }} />
                <span>{Math.round(s.profileHealth.score * 100)}% complete</span>
                {s.profileHealth.missing?.length > 0 && <span className="muted"> — add: {s.profileHealth.missing.join(", ")}</span>}
              </div>
            )}
            <div className="form-grid" style={{ marginTop: 16 }}>
              <Field label="Full Name"><input value={s.profileForm.name} onChange={(e) => dispatch({ type: "SET_PROFILE_FORM", payload: { name: e.target.value } })} /></Field>
              <Field label="Email"><input type="email" value={s.profileForm.email} onChange={(e) => dispatch({ type: "SET_PROFILE_FORM", payload: { email: e.target.value } })} /></Field>
              <Field label="Phone"><input value={s.profileForm.phone} onChange={(e) => dispatch({ type: "SET_PROFILE_FORM", payload: { phone: e.target.value } })} /></Field>
              <Field label="Location"><input value={s.profileForm.location} onChange={(e) => dispatch({ type: "SET_PROFILE_FORM", payload: { location: e.target.value } })} /></Field>
              <Field label="LinkedIn URL"><input value={s.profileForm.linkedin_profile} onChange={(e) => dispatch({ type: "SET_PROFILE_FORM", payload: { linkedin_profile: e.target.value } })} /></Field>
              <Field label="Target Roles (comma-separated)"><input value={s.profileForm.target_roles} onChange={(e) => dispatch({ type: "SET_PROFILE_FORM", payload: { target_roles: e.target.value } })} /></Field>
              <Field label="Preferred Locations (comma-separated)"><input value={s.profileForm.preferred_locations} onChange={(e) => dispatch({ type: "SET_PROFILE_FORM", payload: { preferred_locations: e.target.value } })} /></Field>
              <Field label="Remote Only">
                <input type="checkbox" checked={s.profileForm.remote_only} onChange={(e) => dispatch({ type: "SET_PROFILE_FORM", payload: { remote_only: e.target.checked } })} style={{ width: "auto" }} />
              </Field>
            </div>
            <Field label="Skills (comma-separated)">
              <textarea rows={4} value={s.profileForm.skills} onChange={(e) => dispatch({ type: "SET_PROFILE_FORM", payload: { skills: e.target.value } })} />
            </Field>
          </form>
        </section>
      )}

      {/* ── Activity tab ── */}
      {s.tab === "activity" && <ActivityTab activity={s.activity} notifications={s.notifications} />}
    </main>
  );
}

// ── Search Results component ──────────────────────────────────
function SearchResults({ result }) {
  const summary = result.summary || {};
  const stats = [
    ["Jobs Found", summary.jobs_found ?? 0],
    ["Qualified", summary.qualified_matches ?? 0],
    ["Packages", summary.application_packages ?? 0],
    ["Submitted", summary.real_submissions ?? 0],
  ];

  return (
    <section className="results">
      <div className="results-header">
        <div>
          <p className="eyebrow">Results</p>
          <h2>{result.message || "Application packages prepared"}</h2>
        </div>
        <div className="status-chip">{result.mode || "manual-safe"}</div>
      </div>

      {result.profile_health?.missing?.length > 0 && (
        <p className="hint">Improve profile completeness: {result.profile_health.missing.join(", ")}</p>
      )}

      <div className="stats-row">
        {stats.map(([label, value]) => (
          <div className="stat" key={label}><span>{label}</span><strong>{value}</strong></div>
        ))}
      </div>

      {(result.matches || []).length === 0 && (
        <p className="placeholder">No matches found. Try broadening your role or location.</p>
      )}

      <div className="jobs-list">
        {(result.matches || []).map((job) => (
          <article className="job-card" key={job.listing_id || job.url}>
            <div>
              <h3>{job.title}</h3>
              <p>{job.company} · {job.location || "Location unavailable"} · {job.source}</p>
              <p className="job-meta">
                Match {Math.round((job.match_score || 0) * 100)}%
                {job.submission_status ? ` · ${job.submission_status}` : ""}
                {job.matched_skills?.length > 0 && ` · ✓ ${job.matched_skills.slice(0, 3).join(", ")}`}
              </p>
              {job.missing_skills?.length > 0 && (
                <p className="job-gaps">Missing: {job.missing_skills.slice(0, 4).join(", ")}</p>
              )}
            </div>
            <div className="job-actions">
              {job.url && <a href={job.url} target="_blank" rel="noreferrer">Open Job ↗</a>}
              {job.resume_path && <a href={`${import.meta.env.VITE_API_BASE_URL || ""}/api/job-agent/artifact?path=${encodeURIComponent(job.resume_path)}`} target="_blank" rel="noreferrer">Resume</a>}
              {job.cover_letter_path && <a href={`${import.meta.env.VITE_API_BASE_URL || ""}/api/job-agent/artifact?path=${encodeURIComponent(job.cover_letter_path)}`} target="_blank" rel="noreferrer">Cover</a>}
            </div>
          </article>
        ))}
      </div>

      {result.reflection && (
        <details className="reflection">
          <summary>Cycle reflection &amp; next actions</summary>
          <p>{result.reflection.summary}</p>
          {result.reflection.next_actions?.length > 0 && (
            <ul>{result.reflection.next_actions.map((a, i) => <li key={i}>{a}</li>)}</ul>
          )}
        </details>
      )}
    </section>
  );
}

// ── Applications Tab ──────────────────────────────────────────
function ApplicationsTab({ dashboard }) {
  if (!dashboard) return <p className="placeholder" style={{ padding: 24 }}>Loading applications…</p>;
  const apps = dashboard.recent_applications || [];
  const metrics = dashboard.metrics || {};

  return (
    <section style={{ marginTop: 16 }}>
      <div className="stats-row" style={{ marginBottom: 16 }}>
        {[["Sent", metrics.applications_sent], ["Interviews", metrics.interviews_received],
        ["Offers", metrics.offers], ["Rejected", metrics.rejections]].map(([l, v]) => (
          <div className="stat" key={l}><span>{l}</span><strong>{v ?? 0}</strong></div>
        ))}
      </div>
      {apps.length === 0 && <p className="placeholder">No applications yet. Run a job search to get started.</p>}
      <div className="jobs-list">
        {apps.map((app) => (
          <article className="job-card" key={app.application_id}>
            <div>
              <h3>{app.job_title}</h3>
              <p>{app.company} · Applied {app.date_applied}</p>
              <p className="job-meta">
                <span className={`status-badge status-${app.status.toLowerCase().replace(/\s+/g, "-")}`}>
                  {app.status}
                </span>
                {" · "} Match {Math.round((app.match_score || 0) * 100)}%
              </p>
            </div>
            <div className="job-actions">
              {app.resume_path && <a href={`${import.meta.env.VITE_API_BASE_URL || ""}/api/job-agent/artifact?path=${encodeURIComponent(app.resume_path)}`} target="_blank" rel="noreferrer">Resume</a>}
              {app.cover_letter_path && <a href={`${import.meta.env.VITE_API_BASE_URL || ""}/api/job-agent/artifact?path=${encodeURIComponent(app.cover_letter_path)}`} target="_blank" rel="noreferrer">Cover</a>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ── Activity Tab ──────────────────────────────────────────────
function ActivityTab({ activity, notifications }) {
  return (
    <section style={{ marginTop: 16, display: "grid", gap: 16 }}>
      {notifications.filter((n) => !n.read_at).length > 0 && (
        <div className="panel" style={{ padding: 18 }}>
          <p className="eyebrow">Unread Notifications</p>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {notifications.filter((n) => !n.read_at).slice(0, 10).map((n) => (
              <div key={n.notification_id} className="notif-row">
                <span className={`priority-dot priority-${n.priority}`} />
                <div><strong>{n.title}</strong><p style={{ margin: 0, color: "var(--muted)", fontSize: ".88rem" }}>{n.message}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel" style={{ padding: 18 }}>
        <p className="eyebrow">Agent Activity Log</p>
        {activity.length === 0 && <p className="placeholder">No activity yet.</p>}
        <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
          {activity.slice(0, 50).map((row) => (
            <div key={row.log_id} className="activity-row">
              <span className={`act-status act-${row.status}`}>{row.status}</span>
              <span className="act-agent">{row.agent}</span>
              <span className="act-action">{row.action}</span>
              {row.detail && <span className="act-detail">{row.detail}</span>}
              <span className="act-time">{row.created_at?.slice(11, 19)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
