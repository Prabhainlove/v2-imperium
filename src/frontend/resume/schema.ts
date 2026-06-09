/**
 * Resume JSON — single source of truth for Resume Studio V2.
 * All templates render from this shape. All AI and ATS analysis operate on it.
 */

export type PaperSize = "A4" | "Letter";

export interface ResumeLink {
  label: string;
  url: string;
}

export interface ResumePersonal {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  links: ResumeLink[];
}

export interface ResumeSkillGroup {
  category: string;
  items: string[];
}

export interface ResumeExperience {
  id: string;
  company: string;
  title: string;
  location: string;
  start: string;
  end: string; // "" = Present
  bullets: string[];
}

export interface ResumeProject {
  id: string;
  name: string;
  stack: string[];
  url: string;
  bullets: string[];
}

export interface ResumeEducation {
  id: string;
  school: string;
  degree: string;
  field: string;
  start: string;
  end: string;
  gpa: string;
}

export interface ResumeCertification {
  id: string;
  name: string;
  issuer: string;
  date: string;
  url: string;
}

export interface ResumeMeta {
  templateId: string;
  themeId: string;
  accentColor: string; // legacy — kept for back-compat; themeId now drives color
  font: string;
  paper: PaperSize;
}

export interface ResumeJSON {
  personal: ResumePersonal;
  summary: string;
  skills: ResumeSkillGroup[];
  experience: ResumeExperience[];
  projects: ResumeProject[];
  education: ResumeEducation[];
  certifications: ResumeCertification[];
  meta: ResumeMeta;
}

export interface ResumeVersion {
  id: string;
  label: string;
  createdAt: number;
  json: ResumeJSON;
  /** Metadata snapshot — drives the future Application Tracker. */
  templateId?: string;
  themeId?: string;
  atsScore?: number;
  resumeHealth?: number;
  jdMatch?: number;
}

export const EMPTY_RESUME: ResumeJSON = {
  personal: { name: "", title: "", email: "", phone: "", location: "", links: [] },
  summary: "",
  skills: [],
  experience: [],
  projects: [],
  education: [],
  certifications: [],
  meta: {
    templateId: "classic-ats",
    themeId: "corporate-blue",
    accentColor: "#1d4ed8",
    font: "Inter",
    paper: "A4",
  },
};

export function uid(prefix = "id"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
