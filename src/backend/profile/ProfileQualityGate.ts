/**
 * Resume Quality Gate.
 * Hard checks the generated markdown against ATS/recruiter rules.
 * If gate fails, generator can retry with compression knobs.
 */

export interface QualityGateResult {
  pass: boolean;
  failures: string[];
  warnings: string[];
}

const BANNED_OPENERS = /^\s*[-*•]\s*(developed a|built a|created a|worked on|helped|responsible for|tasked with)\b/i;
const PLACEHOLDER_URL = /\b(example\.com|your[- _]?(name|username)|yourname|linkedin\.com\/in\/yourname|github\.com\/yourname)\b/i;

export function runQualityGate(
  md: string,
  opts: { maxBulletWords?: number; maxProjectBullets?: number; maxSummaryWords?: number; maxLines?: number } = {},
): QualityGateResult {
  const maxBulletWords = opts.maxBulletWords ?? 28;
  const maxProjectBullets = opts.maxProjectBullets ?? 4;
  const maxSummaryWords = opts.maxSummaryWords ?? 60;
  const maxLines = opts.maxLines ?? 60; // rough one-page proxy when PDF measurement unavailable

  const failures: string[] = [];
  const warnings: string[] = [];

  const lines = md.split(/\r?\n/);

  // Summary length
  const summaryIdx = lines.findIndex((l) => /^##\s*profile summary/i.test(l));
  if (summaryIdx >= 0) {
    const summaryEnd = lines.findIndex((l, i) => i > summaryIdx && /^##\s+/.test(l));
    const block = lines.slice(summaryIdx + 1, summaryEnd === -1 ? undefined : summaryEnd).join(" ");
    const words = block.split(/\s+/).filter(Boolean).length;
    if (words > maxSummaryWords) failures.push(`Summary too long: ${words} words (max ${maxSummaryWords}).`);
  }

  // Bullet rules
  let bulletCount = 0;
  let bulletsInCurrentProject = 0;
  let inProjects = false;
  for (const raw of lines) {
    if (/^##\s+/.test(raw)) {
      inProjects = /projects/i.test(raw);
      bulletsInCurrentProject = 0;
      continue;
    }
    if (/^###\s+/.test(raw)) {
      bulletsInCurrentProject = 0;
      continue;
    }
    if (/^\s*[-*•]\s+/.test(raw)) {
      bulletCount++;
      const text = raw.replace(/^\s*[-*•]\s+/, "");
      const words = text.split(/\s+/).filter(Boolean).length;
      if (words > maxBulletWords) warnings.push(`Bullet over ${maxBulletWords} words: "${text.slice(0, 60)}…"`);
      if (BANNED_OPENERS.test(raw)) warnings.push(`Generic opener: "${text.slice(0, 60)}…"`);
      if (inProjects) {
        bulletsInCurrentProject++;
        if (bulletsInCurrentProject > maxProjectBullets) failures.push(`Project has more than ${maxProjectBullets} bullets.`);
      }
    }
  }

  // Placeholders
  if (PLACEHOLDER_URL.test(md)) failures.push("Placeholder URL leaked into resume.");

  // Duplicate skills
  const skillsLine = lines.find((l) => /^\*\*(languages|skills|technical skills)/i.test(l)) ?? "";
  if (skillsLine) {
    const items = skillsLine.replace(/^\*\*[^:]+:\*\*/, "").split(/,/).map((s) => s.trim().toLowerCase()).filter(Boolean);
    const dup = items.filter((v, i) => items.indexOf(v) !== i);
    if (dup.length) warnings.push(`Duplicate skills: ${Array.from(new Set(dup)).join(", ")}`);
  }

  // Rough one-page proxy
  const nonEmpty = lines.filter((l) => l.trim()).length;
  if (nonEmpty > maxLines) failures.push(`Estimated > 1 page: ${nonEmpty} content lines (max ${maxLines}).`);

  return { pass: failures.length === 0, failures, warnings };
}
