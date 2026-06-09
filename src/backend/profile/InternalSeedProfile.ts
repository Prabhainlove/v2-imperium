/**
 * InternalSeedProfile — DEV-ONLY canonical seed.
 *
 * Purpose:
 *   - Development bootstrapping
 *   - Automated tests
 *   - Onboarding/preview fixtures
 *   - Fallback resume generation when no real profile exists in dev
 *
 * RULES:
 *   - Never the source of truth for an authenticated production user.
 *   - Never rendered as PII in the production UI.
 *   - Accessed via `getInternalSeedProfile()`, which returns `null` in production.
 *
 * Preserves the full original dataset (skills, projects, education,
 * certifications, achievements, languages, portfolio) intact so dev tooling
 * keeps working. PII strings remain here strictly for local development; the
 * production bundle gates them off through `getInternalSeedProfile()`.
 */
import type { ImperiumProfile } from "./ProfileTypes";

export const INTERNAL_SEED_PROFILE: Omit<ImperiumProfile, "id"> = {
  name: "Dinesh Kumar Merugu",
  email: "dinesh.merugu.kumar@gmail.com",
  phone: "+91 9121980375",
  location: "Hyderabad, Telangana",
  headline: "Full Stack & AI Engineer",
  summary:
    "MCA student with strong foundations in Software Engineering, AI, Full Stack Development, and Business Automation. Skilled in building scalable web applications with React, TypeScript, Node.js, Python, and PostgreSQL. Experience designing AI-powered systems, workflow automation platforms, and knowledge management tools.",
  target_role: "Full Stack / AI Engineer",
  seniority: "entry",
  work_mode: "any",
  target_locations: ["Hyderabad", "Bangalore", "Remote"],
  salary_expectation: { min: 600000, max: 1200000, currency: "INR", period: "year" },
  skills: [
    "Python", "JavaScript", "TypeScript", "Java",
    "React.js", "Next.js", "HTML5", "CSS3", "Tailwind CSS",
    "Node.js", "Express.js", "REST APIs",
    "PostgreSQL", "MySQL", "MongoDB",
    "Git", "GitHub", "Docker", "Postman", "VS Code",
    "Data Structures", "Algorithms", "OOP", "System Design", "AI Agents",
    "Problem Solving", "System Design Thinking", "Communication",
    "Team Collaboration", "Adaptability", "Ownership", "Time Management",
  ],
  experience: [],
  education: [
    { school: "Loyola College", degree: "Master of Computer Applications (MCA)", field: "Computer Applications", gpa: "9.5/10", start: "2024", end: "2026" },
    { school: "Pragathi Degree College", degree: "Bachelor of Science", field: "MPCS", gpa: "8.8/10", start: "2021", end: "2024" },
    { school: "Sri Gayatri Junior College", degree: "Intermediate", field: "MEC", gpa: "91%", start: "2019", end: "2021" },
  ],
  projects: [
    {
      name: "Imperium AI Business Operating System",
      description: "AI-powered Business OS for productivity, automation, and workflow management.",
      stack: ["React", "TypeScript", "Node.js", "PostgreSQL"],
      url: "https://github.com/dineshkumar/imperium",
      start: "Jan 2025",
      current: true,
      highlights: [
        "Built modular AI agent architecture (task execution, knowledge retrieval, business intelligence).",
        "Designed scalable frontend and backend with secure API integrations.",
        "Implemented automation workflows and centralized data management.",
      ],
    },
    {
      name: "KeyMind AI Knowledge Platform",
      description: "AI-powered knowledge management platform for storing and retrieving business info.",
      stack: ["React", "Node.js", "PostgreSQL", "AI APIs"],
      url: "https://github.com/dineshkumar/keymind",
      start: "Nov 2024",
      end: "Feb 2025",
      highlights: [
        "Implemented intelligent search and context-aware document retrieval.",
        "Built responsive dashboards and optimized database performance.",
      ],
    },
    {
      name: "Smart Finance Analytics Dashboard",
      description: "Real-time financial analytics platform with interactive dashboards.",
      stack: ["React", "Node.js", "PostgreSQL"],
      url: "https://github.com/dineshkumar/finance-dashboard",
      start: "Aug 2024",
      end: "Oct 2024",
      highlights: [
        "Built automated reporting and data visualization modules.",
        "Implemented authentication, role management, and DB optimization.",
      ],
    },
  ],
  certifications: [
    { name: "Full Stack Web Development" },
    { name: "Python Programming" },
    { name: "Artificial Intelligence Fundamentals" },
    { name: "Git & GitHub" },
    { name: "JavaScript Development" },
  ],
  languages: [
    { name: "English", proficiency: "fluent" },
    { name: "Telugu", proficiency: "native" },
    { name: "Hindi", proficiency: "conversational" },
  ],
  achievements: [
    "Built multiple AI-powered full-stack applications from concept to deployment.",
    "Completed 300+ coding challenges focused on algorithms and problem-solving.",
    "Developed enterprise-style software architectures for automation systems.",
    "Participated in hackathons, coding competitions, and technical workshops.",
  ],
  linkedin_url: "https://linkedin.com/in/dineshkumar",
  github_url: "https://github.com/dineshkumar",
  portfolio_url: "https://imperium-ai.vercel.app",
  github_intel: {},
  linkedin_intel: {},
  profile_intel: {},
  onboarded: false,
};

/**
 * Dev-only accessor. Returns the seed profile in development; returns `null`
 * in production builds so PII can never leak through a fallback path.
 *
 * Vite replaces `import.meta.env.PROD` at build time, so the seed object is
 * tree-shaken out of production bundles.
 */
export function getInternalSeedProfile(): Omit<ImperiumProfile, "id"> | null {
  if (import.meta.env?.PROD) return null;
  return INTERNAL_SEED_PROFILE;
}

/**
 * Like `getInternalSeedProfile()` but returns a generic empty stub in prod
 * so call-sites that destructure profile fields don't blow up. Use only
 * where a literal object (not `null`) is required.
 */
import { EMPTY_PROFILE } from "./ProfileTypes";
export function getSeedOrEmpty(): Omit<ImperiumProfile, "id"> {
  return getInternalSeedProfile() ?? EMPTY_PROFILE;
}
