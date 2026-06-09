/** Template registry — metadata-driven. Powers the gallery + recommendation engine. */
import type { ComponentType } from "react";
import type { TemplateProps } from "./_shared";
import { ClassicAtsTemplate } from "./ClassicAts";
import { ProfessionalTemplate } from "./Professional";
import { ModernTemplate } from "./Modern";
import { MinimalTemplate } from "./Minimal";
import { DeveloperTemplate } from "./Developer";

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
];

export function getTemplate(id: string): TemplateMeta {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
