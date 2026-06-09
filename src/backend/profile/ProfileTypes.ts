/**
 * Imperium Profile — V2 source-of-truth types.
 * Client-safe. Mirrors public.profiles columns plus structured sub-records.
 */

export interface ExperienceItem {
  id?: string;
  title: string;
  company: string;
  location?: string;
  start?: string; // YYYY-MM
  end?: string;   // YYYY-MM or "" for present
  current?: boolean;
  description?: string;
  highlights?: string[];
}

export interface EducationItem {
  id?: string;
  school: string;
  degree?: string;
  field?: string;
  start?: string;
  end?: string;
  gpa?: string;
  description?: string;
}

export interface ProjectItem {
  id?: string;
  name: string;
  description?: string;
  stack?: string[];
  url?: string;
  start?: string;
  end?: string;
  current?: boolean;
  highlights?: string[];
}

export interface CertificationItem {
  id?: string;
  name: string;
  issuer?: string;
  year?: string;
  url?: string;
}

export interface LanguageItem {
  name: string;
  proficiency?: "basic" | "conversational" | "fluent" | "native";
}

export interface SalaryExpectation {
  min?: number;
  max?: number;
  currency?: string;
  period?: "year" | "month" | "hour";
}

export interface ImperiumProfile {
  id: string;
  // Personal
  name: string;
  email: string;
  phone: string;
  location: string;
  headline: string;
  summary: string;
  // Career
  target_role: string;
  seniority: string;
  work_mode: string; // remote | hybrid | onsite | any
  target_locations: string[];
  salary_expectation: SalaryExpectation;
  // Sections
  skills: string[];
  experience: ExperienceItem[];
  education: EducationItem[];
  projects: ProjectItem[];
  certifications: CertificationItem[];
  languages: LanguageItem[];
  achievements: string[];
  // Links
  linkedin_url: string;
  github_url: string;
  portfolio_url: string;
  // Intelligence (managed by Brain)
  github_intel: GithubIntel | Record<string, never>;
  linkedin_intel: LinkedinIntel | Record<string, never>;
  profile_intel: Record<string, unknown>;
  // Meta
  onboarded: boolean;
}

export interface GithubIntel {
  username?: string;
  fetched_at?: string;
  public_repos?: number;
  followers?: number;
  top_languages?: { name: string; bytes: number }[];
  top_repos?: {
    name: string;
    description?: string;
    stars: number;
    language?: string;
    url: string;
    updated_at?: string;
  }[];
  inferred_stack?: string[];
  summary?: string;
  resume_bullets?: string[];
  error?: string;
}

export interface LinkedinIntel {
  url?: string;
  fetched_at?: string;
  positioning?: string;
  industry?: string;
  notes?: string[];
}

export const EMPTY_PROFILE: Omit<ImperiumProfile, "id"> = {
  name: "",
  email: "",
  phone: "",
  location: "",
  headline: "",
  summary: "",
  target_role: "",
  seniority: "",
  work_mode: "",
  target_locations: [],
  salary_expectation: {},
  skills: [],
  experience: [],
  education: [],
  projects: [],
  certifications: [],
  languages: [],
  achievements: [],
  linkedin_url: "",
  github_url: "",
  portfolio_url: "",
  github_intel: {},
  linkedin_intel: {},
  profile_intel: {},
  onboarded: false,
};

/**
 * SAMPLE_PROFILE has been moved to `./InternalSeedProfile`.
 * Import `getInternalSeedProfile()` (dev-only) or `getSeedOrEmpty()` instead.
 * Production code MUST consume real profile data from the backend.
 */
