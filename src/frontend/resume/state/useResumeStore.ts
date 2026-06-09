/**
 * Resume Studio store — Zustand. Holds the canonical ResumeJSON, the
 * selected job description (optimization target), and version snapshots.
 * Persists to localStorage so changes survive reloads.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  type ResumeJSON,
  type ResumeVersion,
  EMPTY_RESUME,
  uid,
} from "@frontend/resume/schema";
import { SAMPLE_PROFILE } from "@backend/profile/ProfileTypes";
import type { ImperiumProfile } from "@backend/profile/ProfileTypes";

function seedFromProfile(p: Pick<
  ImperiumProfile,
  "name" | "email" | "phone" | "location" | "headline" | "summary" | "skills"
  | "experience" | "projects" | "education" | "certifications"
  | "linkedin_url" | "github_url" | "portfolio_url"
>): ResumeJSON {
  return {
    ...EMPTY_RESUME,
    personal: {
      name: p.name,
      title: p.headline,
      email: p.email,
      phone: p.phone,
      location: p.location,
      links: [
        p.linkedin_url && { label: "LinkedIn", url: p.linkedin_url },
        p.github_url && { label: "GitHub", url: p.github_url },
        p.portfolio_url && { label: "Portfolio", url: p.portfolio_url },
      ].filter(Boolean) as { label: string; url: string }[],
    },
    summary: p.summary,
    skills: p.skills.length
      ? [{ category: "Skills", items: p.skills }]
      : [],
    experience: p.experience.map((e) => ({
      id: uid("exp"),
      company: e.company,
      title: e.title,
      location: e.location ?? "",
      start: e.start ?? "",
      end: e.current ? "" : (e.end ?? ""),
      bullets: e.highlights ?? (e.description ? [e.description] : []),
    })),
    projects: p.projects.map((pr) => ({
      id: uid("prj"),
      name: pr.name,
      stack: pr.stack ?? [],
      url: pr.url ?? "",
      bullets: pr.highlights ?? (pr.description ? [pr.description] : []),
    })),
    education: p.education.map((ed) => ({
      id: uid("edu"),
      school: ed.school,
      degree: ed.degree ?? "",
      field: ed.field ?? "",
      start: ed.start ?? "",
      end: ed.end ?? "",
      gpa: ed.gpa ?? "",
    })),
    certifications: p.certifications.map((c) => ({
      id: uid("cer"),
      name: c.name,
      issuer: c.issuer ?? "",
      date: c.year ?? "",
      url: c.url ?? "",
    })),
  };
}

interface SelectedJob {
  company: string;
  title: string;
  description: string;
}

export interface VersionScores {
  atsScore?: number;
  resumeHealth?: number;
  jdMatch?: number;
}

interface ResumeStore {
  resume: ResumeJSON;
  selectedJob: SelectedJob | null;
  versions: ResumeVersion[];
  setResume: (r: ResumeJSON) => void;
  patch: (fn: (r: ResumeJSON) => void) => void;
  setTemplate: (id: string) => void;
  setTheme: (id: string) => void;
  setSelectedJob: (j: SelectedJob | null) => void;
  saveVersion: (label?: string, scores?: VersionScores) => void;
  restoreVersion: (id: string) => void;
  reset: () => void;
}

const INITIAL = seedFromProfile(SAMPLE_PROFILE);

export const useResumeStore = create<ResumeStore>()(
  persist(
    (set, get) => ({
      resume: INITIAL,
      selectedJob: {
        company: "Google",
        title: "Senior Software Engineer",
        description:
          "We're seeking a Senior Software Engineer experienced in TypeScript, React, Node.js, and distributed systems. Familiarity with Kubernetes, Terraform, CI/CD, PostgreSQL, AWS, and Docker is a plus. You'll design scalable microservices, mentor engineers, and lead delivery of high-impact features.",
      },
      versions: [
        {
          id: uid("v"),
          label: "V1",
          createdAt: Date.now(),
          json: INITIAL,
          templateId: INITIAL.meta.templateId,
          themeId: INITIAL.meta.themeId,
        },
      ],
      setResume: (r) => set({ resume: r }),
      patch: (fn) =>
        set((s) => {
          const next = structuredClone(s.resume);
          fn(next);
          return { resume: next };
        }),
      setTemplate: (id) =>
        set((s) => ({ resume: { ...s.resume, meta: { ...s.resume.meta, templateId: id } } })),
      setTheme: (id) =>
        set((s) => ({ resume: { ...s.resume, meta: { ...s.resume.meta, themeId: id } } })),
      setSelectedJob: (j) => set({ selectedJob: j }),
      saveVersion: (label, scores) =>
        set((s) => ({
          versions: [
            ...s.versions,
            {
              id: uid("v"),
              label: label ?? `V${s.versions.length + 1}`,
              createdAt: Date.now(),
              json: structuredClone(s.resume),
              templateId: s.resume.meta.templateId,
              themeId: s.resume.meta.themeId,
              atsScore: scores?.atsScore,
              resumeHealth: scores?.resumeHealth,
              jdMatch: scores?.jdMatch,
            },
          ],
        })),
      restoreVersion: (id) => {
        const v = get().versions.find((x) => x.id === id);
        if (v) set({ resume: structuredClone(v.json) });
      },
      reset: () => set({ resume: INITIAL }),
    }),
    {
      name: "imperium-resume-studio-v1",
      partialize: (s) => ({ resume: s.resume, versions: s.versions, selectedJob: s.selectedJob }),
    },
  ),
);
