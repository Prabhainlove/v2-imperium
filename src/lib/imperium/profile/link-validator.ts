/**
 * Link validator — rejects placeholders, malformed URLs, and obvious examples.
 * Used by resume generator to omit (not "Broken link" text) bad URLs.
 */

const PLACEHOLDER_PATTERNS = [
  /example\.com/i,
  /your[- _]?(name|username|handle)/i,
  /\byourname\b/i,
  /\busername\b/i,
  /(linkedin|github)\.com\/(in\/)?(yourname|username|handle|your[- _]?name)/i,
  /^(http(s)?:\/\/)?(www\.)?(github|linkedin|portfolio)\.com\/?$/i,
  /^https?:\/\/(www\.)?example\./i,
  /lorem|ipsum/i,
];

export function isValidLink(raw?: string | null): boolean {
  if (!raw) return false;
  const trimmed = String(raw).trim();
  if (!trimmed) return false;
  if (trimmed.length > 300) return false;
  for (const p of PLACEHOLDER_PATTERNS) if (p.test(trimmed)) return false;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(candidate);
    if (!/^https?:$/i.test(u.protocol)) return false;
    if (!u.hostname.includes(".")) return false;
    return true;
  } catch {
    return false;
  }
}

export interface ValidatedLinks {
  linkedin?: string;
  github?: string;
  portfolio?: string;
  warnings: string[];
}

export function validateProfileLinks(p: {
  linkedin_url?: string;
  github_url?: string;
  portfolio_url?: string;
}): ValidatedLinks {
  const warnings: string[] = [];
  const out: ValidatedLinks = { warnings };
  const fields: Array<[keyof ValidatedLinks, string | undefined, string]> = [
    ["linkedin", p.linkedin_url, "LinkedIn"],
    ["github", p.github_url, "GitHub"],
    ["portfolio", p.portfolio_url, "Portfolio"],
  ];
  for (const [key, raw, label] of fields) {
    if (raw && raw.trim()) {
      if (isValidLink(raw)) {
        (out as Record<string, unknown>)[key] = raw.trim();
      } else {
        warnings.push(`${label} URL looks like a placeholder — fix it in Profile to include it on resume.`);
      }
    }
  }
  return out;
}

export function cleanDisplayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}
