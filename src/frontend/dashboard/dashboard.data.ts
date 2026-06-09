/**
 * Dashboard data layer. v1 returns a generic Imperium identity overlaid
 * with the current mockAuth session's name/email when present. Swap the
 * body of `useDashboardData` for a server function later — the contract stays.
 * PII has been stripped (Phase 0): no hardcoded personal email/name.
 */
import { useMemo } from "react";
import { useSession } from "@frontend/auth/mockAuth";

export type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";

export type ModuleColor =
  | "coral"
  | "mint"
  | "lavender"
  | "butter"
  | "sky"
  | "rose";

export interface IdentityData {
  fullName: string;
  title: string;
  email: string;
  imperiumId: string;
  country: string;
  level: number;
  rank: number;
  rankLabel: string;
  xp: number;
  xpMax: number;
  stars: number; // 0–7
}

export interface AttributesData {
  atsScore: number;
  capacity: number;
  speed: number;
  accuracy: number;
}

export interface PowerData {
  id: string;
  name: string;
  level: number;
  color: ModuleColor;
  iconKey: "mastery" | "interview" | "speed";
  description: string;
}

export interface CareerOverviewData {
  jobsFound: { value: number; delta: number };
  applications: { value: number; delta: number };
  interviews: { value: number; delta: number };
  offers: { value: number; delta: number };
}

export interface ActivityItem {
  id: string;
  iconKey: "resume" | "applied" | "interview" | "ats";
  label: string;
  timeAgo: string;
}

export interface CoreModuleData {
  id: string;
  name: string;
  description: string;
  powerLevel: number; // 0..5 (supports half)
  color: ModuleColor;
  iconKey: string;
}

export interface InventoryModule {
  id: string;
  name: string;
  level: number;
  color: ModuleColor;
  rarity: Rarity;
  route: string;
  iconKey:
    | "job"
    | "resume"
    | "ats"
    | "tracker"
    | "interview"
    | "skill"
    | "assistant"
    | "recruiter"
    | "network"
    | "salary";
  description: string;
  locked?: boolean;
}

export interface DashboardData {
  identity: IdentityData;
  attributes: AttributesData;
  powers: PowerData[];
  resources: { gems: number; coins: number };
  careerOverview: CareerOverviewData;
  recentActivity: ActivityItem[];
  equippedCore: CoreModuleData;
  inventory: InventoryModule[];
  quote: string;
}

const BASE: DashboardData = {
  identity: {
    fullName: "Imperium Operator",
    title: "Career Architect",
    email: "",
    imperiumId: "IMP-0000-0000",
    country: "",
    level: 1,
    rank: 0,
    rankLabel: "Initiate",
    xp: 0,
    xpMax: 1000,
    stars: 0,
  },
  attributes: {
    atsScore: 85,
    capacity: 78,
    speed: 72,
    accuracy: 88,
  },
  resources: { gems: 297, coins: 1258 },
  powers: [
    {
      id: "resume-mastery",
      name: "Resume Mastery",
      level: 12,
      color: "coral",
      iconKey: "mastery",
      description: "Craft ATS-perfect resumes faster than the meta.",
    },
    {
      id: "interview-power",
      name: "Interview Power",
      level: 9,
      color: "mint",
      iconKey: "interview",
      description: "Confidence under fire — mock interviews mastered.",
    },
    {
      id: "application-speed",
      name: "Application Speed",
      level: 7,
      color: "butter",
      iconKey: "speed",
      description: "Submit qualified apps at record velocity.",
    },
  ],
  careerOverview: {
    jobsFound: { value: 128, delta: 12 },
    applications: { value: 23, delta: 5 },
    interviews: { value: 7, delta: 2 },
    offers: { value: 3, delta: 1 },
  },
  recentActivity: [
    { id: "a1", iconKey: "resume", label: "Resume generated for Senior AI Engineer at NovaTech", timeAgo: "2h ago" },
    { id: "a2", iconKey: "applied", label: "Applied for Data Scientist at FutureNet", timeAgo: "1d ago" },
    { id: "a3", iconKey: "interview", label: "Interview scheduled with TechNova", timeAgo: "2d ago" },
    { id: "a4", iconKey: "ats", label: "Profile optimized for ATS", timeAgo: "3d ago" },
  ],
  equippedCore: {
    id: "job-agent-core",
    name: "Job Agent Core",
    description: "Primary intelligence module for job discovery, analysis and application automation.",
    powerLevel: 4.5,
    color: "mint",
    iconKey: "core",
  },
  inventory: [
    { id: "job-agent", name: "Job Agent", level: 5, color: "coral", rarity: "legendary", route: "/jobs", iconKey: "job", description: "Discovery, ranking, analysis and application orchestration." },
    { id: "resume-studio", name: "Resume Studio", level: 4, color: "mint", rarity: "epic", route: "/resume", iconKey: "resume", description: "Tailored, ATS-optimized resumes per role." },
    { id: "application-tracker", name: "Application Tracker", level: 4, color: "lavender", rarity: "epic", route: "/applications", iconKey: "tracker", description: "Pipeline view across every applied role." },
    { id: "autopilot", name: "Autopilot", level: 3, color: "butter", rarity: "rare", route: "/autopilot", iconKey: "assistant", description: "Local agent: browser automation, form fill, submit." },
  ],
  quote: "Automate applications. Optimize opportunities. Elevate your career.",
};

export function useDashboardData(): DashboardData {
  const session = useSession();
  return useMemo<DashboardData>(() => {
    if (!session) return BASE;
    return {
      ...BASE,
      identity: {
        ...BASE.identity,
        fullName: session.fullName?.split(" ")[0] || BASE.identity.fullName,
        email: session.email || BASE.identity.email,
      },
    };
  }, [session]);
}
