/**
 * Imperium Profile Editor — unified, section-based.
 * Used by both /onboarding (subset) and /settings (full editor).
 */
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  CertificationItem,
  EducationItem,
  ExperienceItem,
  ImperiumProfile,
  LanguageItem,
  ProjectItem,
} from "@/lib/imperium/profile/types";

type P = ImperiumProfile;
type Setter = (patch: Partial<P>) => void;

const newId = () => Math.random().toString(36).slice(2, 10);

/* ---------- Personal ---------- */
export function PersonalSection({ p, set }: { p: P; set: Setter }) {
  return (
    <div className="space-y-4">
      <Two>
        <Field label="Full name"><Input value={p.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Headline"><Input value={p.headline} onChange={(e) => set({ headline: e.target.value })} placeholder="Senior Full-Stack Engineer · React / Node" /></Field>
      </Two>
      <Two>
        <Field label="Location"><Input value={p.location} onChange={(e) => set({ location: e.target.value })} placeholder="Remote · EU" /></Field>
        <Field label="Phone"><Input value={p.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
      </Two>
      <Field label="Professional summary">
        <Textarea rows={5} value={p.summary} onChange={(e) => set({ summary: e.target.value })} placeholder="2–4 sentences about what you build, the stacks you love, and the roles you want." />
      </Field>
    </div>
  );
}

/* ---------- Career ---------- */
export function CareerSection({ p, set }: { p: P; set: Setter }) {
  const [loc, setLoc] = useState("");
  const addLoc = () => {
    const v = loc.trim(); if (!v || p.target_locations.includes(v)) return;
    set({ target_locations: [...p.target_locations, v] }); setLoc("");
  };
  return (
    <div className="space-y-4">
      <Two>
        <Field label="Target role"><Input value={p.target_role} onChange={(e) => set({ target_role: e.target.value })} placeholder="Senior Full-Stack Engineer" /></Field>
        <Field label="Seniority">
          <Select value={p.seniority || undefined} onValueChange={(v) => set({ seniority: v })}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {["Intern", "Junior", "Mid", "Senior", "Staff", "Principal", "Lead", "Manager", "Director"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </Two>
      <Two>
        <Field label="Work mode">
          <Select value={p.work_mode || undefined} onValueChange={(v) => set({ work_mode: v })}>
            <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
            <SelectContent>
              {["Remote", "Hybrid", "Onsite", "Any"].map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Salary expectation (annual)">
          <div className="flex gap-2">
            <Input type="number" placeholder="Min" value={p.salary_expectation.min ?? ""} onChange={(e) => set({ salary_expectation: { ...p.salary_expectation, min: e.target.value ? Number(e.target.value) : undefined } })} />
            <Input type="number" placeholder="Max" value={p.salary_expectation.max ?? ""} onChange={(e) => set({ salary_expectation: { ...p.salary_expectation, max: e.target.value ? Number(e.target.value) : undefined } })} />
            <Input className="w-20" placeholder="USD" value={p.salary_expectation.currency ?? ""} onChange={(e) => set({ salary_expectation: { ...p.salary_expectation, currency: e.target.value } })} />
          </div>
        </Field>
      </Two>
      <Field label="Target locations">
        <div className="flex gap-2">
          <Input value={loc} onChange={(e) => setLoc(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLoc())} placeholder="e.g. Remote EU, Berlin, London" />
          <Button type="button" variant="secondary" onClick={addLoc}>Add</Button>
        </div>
        {p.target_locations.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {p.target_locations.map((l) => (
              <Badge key={l} variant="secondary" className="cursor-pointer" onClick={() => set({ target_locations: p.target_locations.filter((x) => x !== l) })}>{l} ×</Badge>
            ))}
          </div>
        )}
      </Field>
    </div>
  );
}

/* ---------- Skills ---------- */
export function SkillsSection({ p, set }: { p: P; set: Setter }) {
  const [s, setS] = useState("");
  const add = () => {
    const v = s.trim(); if (!v || p.skills.includes(v)) return;
    set({ skills: [...p.skills, v] }); setS("");
  };
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input value={s} onChange={(e) => setS(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} placeholder="e.g. TypeScript, PostgreSQL, AWS" />
        <Button type="button" variant="secondary" onClick={add}>Add</Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {p.skills.map((k) => (
          <Badge key={k} variant="secondary" className="cursor-pointer" onClick={() => set({ skills: p.skills.filter((x) => x !== k) })}>{k} ×</Badge>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Add at least 8 skills for a strong profile.</p>
    </div>
  );
}

/* ---------- Experience ---------- */
export function ExperienceSection({ p, set }: { p: P; set: Setter }) {
  const items = p.experience;
  const upd = (i: number, patch: Partial<ExperienceItem>) =>
    set({ experience: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  const add = () => set({ experience: [...items, { id: newId(), title: "", company: "" }] });
  const del = (i: number) => set({ experience: items.filter((_, idx) => idx !== i) });
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <Repeater key={it.id ?? i} onDelete={() => del(i)}>
          <Two><Field label="Job title"><Input value={it.title} onChange={(e) => upd(i, { title: e.target.value })} /></Field>
            <Field label="Company"><Input value={it.company} onChange={(e) => upd(i, { company: e.target.value })} /></Field></Two>
          <Two><Field label="Start (YYYY-MM)"><Input value={it.start ?? ""} onChange={(e) => upd(i, { start: e.target.value })} placeholder="2023-01" /></Field>
            <Field label="End (or blank for present)"><Input value={it.end ?? ""} onChange={(e) => upd(i, { end: e.target.value })} placeholder="2024-06" /></Field></Two>
          <Field label="Description"><Textarea rows={3} value={it.description ?? ""} onChange={(e) => upd(i, { description: e.target.value })} /></Field>
        </Repeater>
      ))}
      <Button type="button" variant="outline" onClick={add}><Plus className="mr-1.5 h-4 w-4" /> Add experience</Button>
    </div>
  );
}

/* ---------- Education ---------- */
export function EducationSection({ p, set }: { p: P; set: Setter }) {
  const items = p.education;
  const upd = (i: number, patch: Partial<EducationItem>) =>
    set({ education: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  const add = () => set({ education: [...items, { id: newId(), school: "" }] });
  const del = (i: number) => set({ education: items.filter((_, idx) => idx !== i) });
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <Repeater key={it.id ?? i} onDelete={() => del(i)}>
          <Two><Field label="School"><Input value={it.school} onChange={(e) => upd(i, { school: e.target.value })} /></Field>
            <Field label="Degree"><Input value={it.degree ?? ""} onChange={(e) => upd(i, { degree: e.target.value })} placeholder="B.Sc. Computer Science" /></Field></Two>
          <Two><Field label="Start"><Input value={it.start ?? ""} onChange={(e) => upd(i, { start: e.target.value })} placeholder="2020" /></Field>
            <Field label="End"><Input value={it.end ?? ""} onChange={(e) => upd(i, { end: e.target.value })} placeholder="2024" /></Field></Two>
        </Repeater>
      ))}
      <Button type="button" variant="outline" onClick={add}><Plus className="mr-1.5 h-4 w-4" /> Add education</Button>
    </div>
  );
}

/* ---------- Projects ---------- */
export function ProjectsSection({ p, set }: { p: P; set: Setter }) {
  const items = p.projects;
  const upd = (i: number, patch: Partial<ProjectItem>) =>
    set({ projects: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  const add = () => set({ projects: [...items, { id: newId(), name: "", stack: [] }] });
  const del = (i: number) => set({ projects: items.filter((_, idx) => idx !== i) });
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <Repeater key={it.id ?? i} onDelete={() => del(i)}>
          <Two><Field label="Name"><Input value={it.name} onChange={(e) => upd(i, { name: e.target.value })} /></Field>
            <Field label="URL"><Input value={it.url ?? ""} onChange={(e) => upd(i, { url: e.target.value })} placeholder="https://…" /></Field></Two>
          <Field label="Description"><Textarea rows={2} value={it.description ?? ""} onChange={(e) => upd(i, { description: e.target.value })} /></Field>
          <Field label="Stack (comma-separated)">
            <Input value={(it.stack ?? []).join(", ")} onChange={(e) => upd(i, { stack: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} placeholder="React, Node, Postgres" />
          </Field>
        </Repeater>
      ))}
      <Button type="button" variant="outline" onClick={add}><Plus className="mr-1.5 h-4 w-4" /> Add project</Button>
    </div>
  );
}

/* ---------- Certifications ---------- */
export function CertsSection({ p, set }: { p: P; set: Setter }) {
  const items = p.certifications;
  const upd = (i: number, patch: Partial<CertificationItem>) =>
    set({ certifications: items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  const add = () => set({ certifications: [...items, { id: newId(), name: "" }] });
  const del = (i: number) => set({ certifications: items.filter((_, idx) => idx !== i) });
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <Repeater key={it.id ?? i} onDelete={() => del(i)}>
          <Two><Field label="Name"><Input value={it.name} onChange={(e) => upd(i, { name: e.target.value })} /></Field>
            <Field label="Issuer"><Input value={it.issuer ?? ""} onChange={(e) => upd(i, { issuer: e.target.value })} /></Field></Two>
          <Two><Field label="Year"><Input value={it.year ?? ""} onChange={(e) => upd(i, { year: e.target.value })} /></Field>
            <Field label="URL"><Input value={it.url ?? ""} onChange={(e) => upd(i, { url: e.target.value })} /></Field></Two>
        </Repeater>
      ))}
      <Button type="button" variant="outline" onClick={add}><Plus className="mr-1.5 h-4 w-4" /> Add certification</Button>
    </div>
  );
}

/* ---------- Links ---------- */
export function LinksSection({ p, set }: { p: P; set: Setter }) {
  return (
    <div className="space-y-4">
      <Field label="LinkedIn URL"><Input value={p.linkedin_url} onChange={(e) => set({ linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/…" /></Field>
      <Field label="GitHub URL"><Input value={p.github_url} onChange={(e) => set({ github_url: e.target.value })} placeholder="https://github.com/…" /></Field>
      <Field label="Portfolio / website"><Input value={p.portfolio_url} onChange={(e) => set({ portfolio_url: e.target.value })} placeholder="https://…" /></Field>
    </div>
  );
}

/* ---------- Languages & Achievements ---------- */
export function LanguagesSection({ p, set }: { p: P; set: Setter }) {
  const upd = (i: number, patch: Partial<LanguageItem>) =>
    set({ languages: p.languages.map((it, idx) => (idx === i ? { ...it, ...patch } : it)) });
  const add = () => set({ languages: [...p.languages, { name: "" }] });
  const del = (i: number) => set({ languages: p.languages.filter((_, idx) => idx !== i) });
  return (
    <div className="space-y-3">
      {p.languages.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input className="flex-1" value={it.name} onChange={(e) => upd(i, { name: e.target.value })} placeholder="English" />
          <Select value={it.proficiency ?? undefined} onValueChange={(v) => upd(i, { proficiency: v as LanguageItem["proficiency"] })}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Proficiency" /></SelectTrigger>
            <SelectContent>
              {(["basic", "conversational", "fluent", "native"] as const).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button type="button" variant="ghost" size="icon" onClick={() => del(i)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={add}><Plus className="mr-1.5 h-4 w-4" /> Add language</Button>
    </div>
  );
}

export function AchievementsSection({ p, set }: { p: P; set: Setter }) {
  const [v, setV] = useState("");
  const add = () => { const t = v.trim(); if (!t) return; set({ achievements: [...p.achievements, t] }); setV(""); };
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())} placeholder="e.g. Speaker at React Conf 2024" />
        <Button type="button" variant="secondary" onClick={add}>Add</Button>
      </div>
      <ul className="space-y-1.5">
        {p.achievements.map((a, i) => (
          <li key={i} className="flex items-center gap-2 rounded-md border border-border/60 p-2 text-sm">
            <span className="flex-1">{a}</span>
            <Button type="button" variant="ghost" size="icon" onClick={() => set({ achievements: p.achievements.filter((_, idx) => idx !== i) })}><Trash2 className="h-4 w-4" /></Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Small layout helpers ---------- */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function Two({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 md:grid-cols-2">{children}</div>;
}
function Repeater({ children, onDelete }: { children: React.ReactNode; onDelete: () => void }) {
  return (
    <div className="relative space-y-3 rounded-lg border border-border/60 bg-card/40 p-3">
      <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
      {children}
    </div>
  );
}
