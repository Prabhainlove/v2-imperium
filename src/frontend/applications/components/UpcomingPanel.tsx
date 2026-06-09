/** Compact calendar + upcoming interviews list (reference bottom row). */
import { useMemo, useState } from "react";
import { useApplicationsStore } from "../state/useApplicationsStore";
import { CompanyAvatar } from "./CompanyAvatar";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function buildMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1);
  const startDow = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();
  const cells: { day: number; muted: boolean; date: Date }[] = [];
  for (let i = startDow - 1; i >= 0; i--) {
    const day = daysInPrev - i;
    cells.push({ day, muted: true, date: new Date(year, month - 1, day) });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, muted: false, date: new Date(year, month, d) });
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const day = cells.length - daysInMonth - startDow + 1;
    cells.push({ day, muted: true, date: new Date(year, month + 1, day) });
    if (cells.length >= 42) break;
  }
  return cells;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function CalendarPanel() {
  const apps = useApplicationsStore((s) => s.applications);
  const select = useApplicationsStore((s) => s.selectApplication);

  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const interviews = useMemo(
    () => apps.filter((a) => a.status === "interview" || a.status === "assessment"),
    [apps],
  );

  // Build event days from interview app dates (use applied date as a stand-in scheduling slot)
  const eventDays = useMemo(() => {
    const set = new Set<string>();
    interviews.forEach((a) => {
      try {
        const d = new Date(a.appliedAt);
        d.setDate(d.getDate() + 7); // simulate scheduled date 1 week after apply
        set.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
      } catch { /* skip */ }
    });
    return set;
  }, [interviews]);

  const cells = buildMonthGrid(cursor.getFullYear(), cursor.getMonth());

  const fmtTime = (idx: number) => {
    const base = ["10:00 AM", "02:00 PM", "11:30 AM", "03:00 PM", "04:30 PM"];
    return base[idx % base.length]!;
  };

  return (
    <div className="tracker-bottom">
      <div className="tracker-section">
        <div className="calendar-head">
          <div className="calendar-title">Calendar</div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div className="calendar-nav">
              <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>‹</button>
            </div>
            <div style={{ minWidth: 110, textAlign: "center", fontWeight: 600, fontSize: "0.85rem" }}>
              {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
            </div>
            <div className="calendar-nav">
              <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>›</button>
            </div>
            <button className="calendar-today" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>Today</button>
          </div>
        </div>
        <div className="calendar-grid">
          {DOW.map((d) => <div key={d} className="cal-dow">{d}</div>)}
          {cells.map((c, i) => {
            const key = `${c.date.getFullYear()}-${c.date.getMonth()}-${c.date.getDate()}`;
            const hasEvent = eventDays.has(key);
            const isToday = isSameDay(c.date, today);
            const cls = ["cal-day", c.muted ? "muted" : "", isToday ? "today" : "", hasEvent ? "has-event" : ""].filter(Boolean).join(" ");
            return <div key={i} className={cls}>{c.day}</div>;
          })}
        </div>
      </div>

      <div className="tracker-section">
        <div className="section-head">
          <h2>Upcoming Interviews</h2>
        </div>
        {interviews.length === 0 ? (
          <div className="empty-state">No interviews scheduled.</div>
        ) : (
          <>
            <div className="interview-list">
              {interviews.slice(0, 4).map((a, idx) => (
                <div key={a.id} className="interview-item" onClick={() => select(a.id)}>
                  <div className="interview-left">
                    <CompanyAvatar company={a.company} size={34} />
                    <div className="interview-meta">
                      <div className="interview-name">{a.company}</div>
                      <div className="interview-round">{idx === 0 ? "Technical Round" : idx === 1 ? "HR Round" : idx === 2 ? "Onsite Interview" : "Final Round"}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span className="interview-time">{fmtTime(idx)}</span>
                    <span className="interview-tag">Interview</span>
                  </div>
                </div>
              ))}
            </div>
            <a className="view-all-link" href="#">View all interviews →</a>
          </>
        )}
      </div>
    </div>
  );
}

// Keep legacy export name used by ApplicationsPage so we can swap painlessly.
export const UpcomingPanel = CalendarPanel;
