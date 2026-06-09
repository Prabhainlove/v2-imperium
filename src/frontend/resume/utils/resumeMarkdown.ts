/** Serialize ResumeJSON to a clean markdown view for the editor pane. */
import type { ResumeJSON } from "@frontend/resume/schema";

export function resumeToMarkdown(r: ResumeJSON): string {
  const out: string[] = [];
  out.push(`# ${r.personal.name || "Your Name"}`);
  if (r.personal.title) out.push(r.personal.title);
  out.push("");

  if (r.summary) {
    out.push("## Summary");
    out.push(wrap(r.summary, 64));
    out.push("");
  }

  if (r.experience.length) {
    out.push("## Experience");
    for (const e of r.experience) {
      out.push(`### ${e.title} — ${e.company}`);
      const range = [e.start, e.end || "Present"].filter(Boolean).join(" – ");
      if (range) out.push(range);
      for (const b of e.bullets) if (b) out.push(`- ${b}`);
      out.push("");
    }
  }

  if (r.projects.length) {
    out.push("## Projects");
    for (const p of r.projects) {
      out.push(`### ${p.name}${p.stack.length ? ` — ${p.stack.join(", ")}` : ""}`);
      for (const b of p.bullets) if (b) out.push(`- ${b}`);
      out.push("");
    }
  }

  if (r.skills.length) {
    out.push("## Skills");
    for (const g of r.skills) {
      out.push(`${g.category}: ${g.items.join(", ")}`);
    }
    out.push("");
  }

  if (r.education.length) {
    out.push("## Education");
    for (const ed of r.education) {
      out.push(`### ${ed.degree}${ed.field ? ` in ${ed.field}` : ""}`);
      out.push(`${ed.school}${ed.start || ed.end ? `  ·  ${ed.start} – ${ed.end}` : ""}`);
      out.push("");
    }
  }

  return out.join("\n").trimEnd();
}

function wrap(text: string, width: number): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > width) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = (line ? line + " " : "") + w;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}
