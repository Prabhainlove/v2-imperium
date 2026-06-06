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
 * SAMPLE_PROFILE — pre-fills the onboarding form for demos / first-run.
 * Owner: Dinesh Kumar Merugu. Edit freely; this is a default, not a lock.
 */
export const SAMPLE_PROFILE: Omit<ImperiumProfile, "id"> = {
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
    // Technical
    "Python", "JavaScript", "TypeScript", "Java",
    "React.js", "Next.js", "HTML5", "CSS3", "Tailwind CSS",
    "Node.js", "Express.js", "REST APIs",
    "PostgreSQL", "MySQL", "MongoDB",
    "Git", "GitHub", "Docker", "Postman", "VS Code",
    "Data Structures", "Algorithms", "OOP", "System Design", "AI Agents",
    // Soft skills
    "Problem Solving", "System Design Thinking", "Communication",
    "Team Collaboration", "Adaptability", "Ownership", "Time Management",
  ],
  experience: [],
  education: [
    { school: "Loyola College", degree: "Master of Computer Applications (MCA)", field: "Computer Applications", gpa: "9.5/10" },
    { school: "Pragathi Degree College", degree: "Bachelor of Science", field: "MPCS", gpa: "8.8/10" },
    { school: "Sri Gayatri Junior College", degree: "Intermediate", field: "MEC", gpa: "91%" },
  ],
  projects: [
    {
      name: "Imperium AI Business Operating System",
      description: "AI-powered Business OS for productivity, automation, and workflow management.",
      stack: ["React", "TypeScript", "Node.js", "PostgreSQL"],
      url: "https://github.com/dineshkumar/imperium",
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
