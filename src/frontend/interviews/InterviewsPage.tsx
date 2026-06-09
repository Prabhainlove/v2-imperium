import "./interviews.css";
import { useState } from "react";

type Round = "Technical" | "HR" | "System Design" | "Behavioral";
type Upcoming = { id: string; company: string; logo: string; role: string; when: string; round: Round; };
type Practice = { id: string; title: string; desc: string; minutes: number; emoji: string; tone: string; };
type Session = { id: string; date: string; mode: string; score: number; duration: string; };

const UPCOMING: Upcoming[] = [
  { id: "u1", company: "Imperium Labs",   logo: "IL", role: "Frontend Engineer",  when: "Today · 4:00 PM",      round: "Technical" },
  { id: "u2", company: "Aether Systems",  logo: "AS", role: "Full-Stack Engineer", when: "Tomorrow · 11:00 AM", round: "System Design" },
  { id: "u3", company: "Nova Robotics",   logo: "NR", role: "Senior React Dev",   when: "Wed · 2:30 PM",        round: "HR" },
];

const PRACTICE: Practice[] = [
  { id: "p1", title: "Behavioral",        desc: "STAR-method coaching with AI feedback.",   minutes: 25, emoji: "🧠", tone: "tone-indigo" },
  { id: "p2", title: "DSA",               desc: "Live coding rounds with hints & timer.",   minutes: 45, emoji: "💻", tone: "tone-emerald" },
  { id: "p3", title: "System Design",     desc: "Whiteboard scenarios from real interviews.", minutes: 60, emoji: "🧩", tone: "tone-violet" },
  { id: "p4", title: "Resume Walkthrough",desc: "Defend every bullet on your resume.",      minutes: 20, emoji: "📄", tone: "tone-amber" },
  { id: "p5", title: "HR Round",          desc: "Compensation, culture-fit, expectations.", minutes: 15, emoji: "🤝", tone: "tone-rose" },
  { id: "p6", title: "Imperium Mock",     desc: "AI mock interview using your profile + JD.", minutes: 30, emoji: "✨", tone: "tone-cyan" },
];

const SESSIONS: Session[] = [
  { id: "s1", date: "Jun 8, 2026", mode: "Behavioral",     score: 88, duration: "24m" },
  { id: "s2", date: "Jun 7, 2026", mode: "System Design",  score: 74, duration: "58m" },
  { id: "s3", date: "Jun 5, 2026", mode: "DSA",            score: 82, duration: "42m" },
  { id: "s4", date: "Jun 3, 2026", mode: "Imperium Mock",  score: 91, duration: "31m" },
];

export function InterviewsPage() {
  const [openMock, setOpenMock] = useState(false);

  return (
    <div className="iv-root">
      <header className="iv-header">
        <div>
          <h1>Interview Studio</h1>
          <p>Practice, prep, and rehearse with your Imperium AI coach.</p>
        </div>
        <button className="iv-btn iv-btn-primary" onClick={() => setOpenMock(true)}>✨ Start Mock Interview</button>
      </header>

      <section className="iv-kpis">
        <Kpi label="Upcoming"        value="3"   sub="next 7 days"     tone="tone-indigo"  emoji="📅" />
        <Kpi label="Completed"       value="18"  sub="all time"        tone="tone-emerald" emoji="✅" />
        <Kpi label="Avg Score"       value="84%" sub="last 5 sessions" tone="tone-violet"  emoji="📈" />
        <Kpi label="Practice Hours"  value="12h" sub="this month"      tone="tone-amber"   emoji="⏱" />
      </section>

      <div className="iv-grid">
        <section className="iv-card">
          <div className="iv-card-head">
            <h2>Upcoming Interviews</h2>
            <button className="iv-link">View all</button>
          </div>
          <ul className="iv-upcoming">
            {UPCOMING.map((u) => (
              <li key={u.id} className="iv-up-row">
                <div className="iv-logo">{u.logo}</div>
                <div className="iv-up-body">
                  <div className="iv-up-title">{u.role}</div>
                  <div className="iv-up-sub">{u.company} · {u.when}</div>
                </div>
                <span className={`iv-tag tag-${u.round.toLowerCase().replace(/ /g,"-")}`}>{u.round}</span>
                <div className="iv-up-actions">
                  <button className="iv-btn iv-btn-ghost">Prep</button>
                  <button className="iv-btn iv-btn-primary-sm">Join</button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <aside className="iv-card iv-coach">
          <div className="iv-coach-badge">AI Coach</div>
          <h3>Tip of the day</h3>
          <p>For system design rounds, always anchor the conversation in <b>scale numbers</b>—DAU, QPS, payload size. It shows seniority faster than any diagram.</p>
          <div className="iv-coach-row">
            <span>Today's focus</span><b>System Design · Caching</b>
          </div>
          <div className="iv-coach-row">
            <span>Recommended drill</span><b>Design a job-board feed</b>
          </div>
          <button className="iv-btn iv-btn-primary" onClick={() => setOpenMock(true)}>Start guided session</button>
        </aside>
      </div>

      <section className="iv-card">
        <div className="iv-card-head"><h2>Practice Library</h2><span className="iv-muted">6 modes</span></div>
        <div className="iv-practice-grid">
          {PRACTICE.map((p) => (
            <div key={p.id} className={`iv-practice ${p.tone}`}>
              <div className="iv-practice-emoji">{p.emoji}</div>
              <div className="iv-practice-title">{p.title}</div>
              <div className="iv-practice-desc">{p.desc}</div>
              <div className="iv-practice-foot">
                <span>{p.minutes} min</span>
                <button className="iv-btn iv-btn-primary-sm">Start Session</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="iv-card">
        <div className="iv-card-head"><h2>Recent Sessions</h2><button className="iv-link">Export</button></div>
        <div className="iv-table">
          <div className="iv-tr iv-th">
            <span>Date</span><span>Mode</span><span>Score</span><span>Duration</span><span></span>
          </div>
          {SESSIONS.map((s) => (
            <div key={s.id} className="iv-tr">
              <span>{s.date}</span>
              <span>{s.mode}</span>
              <span><b className={s.score >= 85 ? "iv-good" : s.score >= 70 ? "iv-okscore" : "iv-bad"}>{s.score}</b></span>
              <span>{s.duration}</span>
              <span><button className="iv-link">Review</button></span>
            </div>
          ))}
        </div>
      </section>

      {openMock && (
        <div className="iv-modal" role="dialog" onClick={() => setOpenMock(false)}>
          <div className="iv-modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>Start Imperium Mock Interview</h2>
            <p>Your AI coach will run a 30-minute mock based on your profile and the latest job in your tracker.</p>
            <div className="iv-modal-actions">
              <button className="iv-btn iv-btn-ghost" onClick={() => setOpenMock(false)}>Cancel</button>
              <button className="iv-btn iv-btn-primary" onClick={() => setOpenMock(false)}>Begin Session</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, sub, tone, emoji }: { label: string; value: string; sub: string; tone: string; emoji: string }) {
  return (
    <div className="iv-kpi">
      <div className={`iv-kpi-icon ${tone}`}>{emoji}</div>
      <div>
        <div className="iv-kpi-label">{label}</div>
        <div className="iv-kpi-value">{value}</div>
        <div className="iv-kpi-sub">{sub}</div>
      </div>
    </div>
  );
}

export default InterviewsPage;
