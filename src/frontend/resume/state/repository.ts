/**
 * ResumeRepository — storage abstraction. Today: LocalResumeRepository wraps
 * the Zustand-persisted state (which already lives in localStorage). Tomorrow:
 * SupabaseResumeRepository can be swapped in without changing Resume Studio.
 */
import type { ResumeJSON, ResumeVersion } from "@frontend/resume/schema";

export interface ResumeRepository {
  save(resume: ResumeJSON): Promise<void>;
  load(): Promise<ResumeJSON | null>;
  versions(): Promise<ResumeVersion[]>;
  saveVersion(v: ResumeVersion): Promise<void>;
}

const RESUME_KEY = "imperium-resume-current";
const VERSIONS_KEY = "imperium-resume-versions";

export class LocalResumeRepository implements ResumeRepository {
  async save(resume: ResumeJSON): Promise<void> {
    try { localStorage.setItem(RESUME_KEY, JSON.stringify(resume)); } catch { /* quota */ }
  }
  async load(): Promise<ResumeJSON | null> {
    try {
      const raw = localStorage.getItem(RESUME_KEY);
      return raw ? (JSON.parse(raw) as ResumeJSON) : null;
    } catch { return null; }
  }
  async versions(): Promise<ResumeVersion[]> {
    try {
      const raw = localStorage.getItem(VERSIONS_KEY);
      return raw ? (JSON.parse(raw) as ResumeVersion[]) : [];
    } catch { return []; }
  }
  async saveVersion(v: ResumeVersion): Promise<void> {
    const all = await this.versions();
    all.push(v);
    try { localStorage.setItem(VERSIONS_KEY, JSON.stringify(all)); } catch { /* quota */ }
  }
}

export const resumeRepository: ResumeRepository = new LocalResumeRepository();
