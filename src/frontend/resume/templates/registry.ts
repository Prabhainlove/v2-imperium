/** Template registry — metadata-driven. Powers the gallery + recommendation engine. */
import type { ComponentType } from "react";
import type { TemplateProps } from "./_shared";
import { ClassicAtsTemplate } from "./ClassicAts";
import { ProfessionalTemplate } from "./Professional";
import { ModernTemplate } from "./Modern";
import { MinimalTemplate } from "./Minimal";
import { DeveloperTemplate } from "./Developer";
import { ExecutiveTemplate } from "./Executive";
import { CreativeTemplate } from "./Creative";
import { StudentTemplate } from "./Student";

export type TemplateCategory =
  | "ATS"
  | "Professional"
  | "Executive"
  | "Creative"
  | "Developer"
  | "Student";

export interface TemplateMeta {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  atsCompatibility: number;      // 0-100
  visualAppeal: number;          // 0-100
  recruiterReadability: number;  // 0-100
  supportsPhoto: boolean;
  supportsSidebar: boolean;
  supportsMultiPage: boolean;
  bestFor: string[];
  component: ComponentType<TemplateProps>;
}

export const TEMPLATES: TemplateMeta[] = [
  {
    id: "classic-ats",
    name: "Classic ATS",
    description: "Single-column, parser-perfect. Recommended for mass applications.",
    category: "ATS",
    atsCompatibility: 99,
    visualAppeal: 70,
    recruiterReadability: 92,
    supportsPhoto: false,
    supportsSidebar: false,
    supportsMultiPage: true,
    bestFor: ["Mass Applications", "Corporate", "Engineering", "Finance"],
    component: ClassicAtsTemplate,
  },
  {
    id: "professional",
    name: "Professional",
    description: "Accent-colored headings, balanced spacing. The corporate default.",
    category: "Professional",
    atsCompatibility: 95,
    visualAppeal: 86,
    recruiterReadability: 94,
    supportsPhoto: false,
    supportsSidebar: false,
    supportsMultiPage: true,
    bestFor: ["Product Manager", "Consulting", "Operations", "Marketing"],
    component: ProfessionalTemplate,
  },
  {
    id: "modern",
    name: "Modern",
    description: "Two-column with sidebar. Highlights skills and contact prominently.",
    category: "Professional",
    atsCompatibility: 82,
    visualAppeal: 95,
    recruiterReadability: 90,
    supportsPhoto: true,
    supportsSidebar: true,
    supportsMultiPage: true,
    bestFor: ["Frontend", "Design", "Product", "UX"],
    component: ModernTemplate,
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Serif typography, generous whitespace. Quiet confidence.",
    category: "Professional",
    atsCompatibility: 96,
    visualAppeal: 84,
    recruiterReadability: 93,
    supportsPhoto: false,
    supportsSidebar: false,
    supportsMultiPage: true,
    bestFor: ["Senior IC", "Research", "Writing", "Academia"],
    component: MinimalTemplate,
  },
  {
    id: "developer",
    name: "Developer",
    description: "Monospaced accents, projects-forward. Built for engineers.",
    category: "Developer",
    atsCompatibility: 90,
    visualAppeal: 88,
    recruiterReadability: 89,
    supportsPhoto: false,
    supportsSidebar: false,
    supportsMultiPage: true,
    bestFor: ["Software Engineer", "Backend", "DevOps", "Open Source"],
    component: DeveloperTemplate,
  },
  {
    id: "executive",
    name: "Executive",
    description: "Centered serif header, conservative palette. For senior leadership.",
    category: "Executive",
    atsCompatibility: 92,
    visualAppeal: 90,
    recruiterReadability: 95,
    supportsPhoto: false,
    supportsSidebar: false,
    supportsMultiPage: true,
    bestFor: ["Director", "VP", "Head of", "C-Suite"],
    component: ExecutiveTemplate,
  },
  {
    id: "creative",
    name: "Creative",
    description: "Colored header band with two-column body. Stand-out without losing parsing.",
    category: "Creative",
    atsCompatibility: 78,
    visualAppeal: 97,
    recruiterReadability: 88,
    supportsPhoto: true,
    supportsSidebar: true,
    supportsMultiPage: true,
    bestFor: ["Brand", "Marketing", "Content", "Design"],
    component: CreativeTemplate,
  },
  {
    id: "student",
    name: "Student / Fresher",
    description: "Education-first ordering; projects and coursework front and center.",
    category: "Student",
    atsCompatibility: 95,
    visualAppeal: 84,
    recruiterReadability: 92,
    supportsPhoto: false,
    supportsSidebar: false,
    supportsMultiPage: false,
    bestFor: ["New Grad", "Intern", "Fresher", "Junior"],
    component: StudentTemplate,
  },
];

export function getTemplate(id: string): TemplateMeta {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

