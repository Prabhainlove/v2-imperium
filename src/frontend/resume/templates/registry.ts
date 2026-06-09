/** Template registry — id → component + metadata. */
import type { ComponentType } from "react";
import type { ResumeJSON } from "@frontend/resume/schema";
import { ClassicAtsTemplate } from "./ClassicAts";

export interface TemplateMeta {
  id: string;
  label: string;
  description: string;
  atsSafe: boolean;
  component: ComponentType<{ resume: ResumeJSON }>;
}

export const TEMPLATES: TemplateMeta[] = [
  {
    id: "classic-ats",
    label: "Classic ATS",
    description: "Single column, ATS-safe. Recommended for tech & corporate roles.",
    atsSafe: true,
    component: ClassicAtsTemplate,
  },
];

export function getTemplate(id: string): TemplateMeta {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
