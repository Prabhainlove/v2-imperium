/**
 * Resume Studio themes. Themes are pure visual tokens (CSS variables) injected
 * onto a template's root element. Switching themes never changes ResumeJSON
 * data — only presentation. Templates consume tokens via CSS variables.
 */

export interface ResumeTheme {
  id: string;
  name: string;
  accent: string;       // primary brand color
  accentDark: string;   // hover / strong variant
  accentSoft: string;   // tinted background
  text: string;         // body text
  textMuted: string;    // secondary text
  divider: string;      // separators
  sidebarBg: string;    // sidebar background (templates that support it)
  sidebarText: string;  // sidebar text
}

export const THEMES: ResumeTheme[] = [
  {
    id: "corporate-blue",
    name: "Corporate Blue",
    accent: "#1d4ed8",
    accentDark: "#1e3a8a",
    accentSoft: "#eff6ff",
    text: "#0f172a",
    textMuted: "#475569",
    divider: "#e2e8f0",
    sidebarBg: "#0f172a",
    sidebarText: "#f8fafc",
  },
  {
    id: "executive-black",
    name: "Executive Black",
    accent: "#111827",
    accentDark: "#000000",
    accentSoft: "#f3f4f6",
    text: "#0f172a",
    textMuted: "#4b5563",
    divider: "#d1d5db",
    sidebarBg: "#111827",
    sidebarText: "#f9fafb",
  },
  {
    id: "emerald",
    name: "Emerald",
    accent: "#047857",
    accentDark: "#064e3b",
    accentSoft: "#ecfdf5",
    text: "#0f172a",
    textMuted: "#475569",
    divider: "#d1fae5",
    sidebarBg: "#064e3b",
    sidebarText: "#ecfdf5",
  },
  {
    id: "purple-modern",
    name: "Purple Modern",
    accent: "#7c3aed",
    accentDark: "#5b21b6",
    accentSoft: "#f5f3ff",
    text: "#1e1b4b",
    textMuted: "#52525b",
    divider: "#ede9fe",
    sidebarBg: "#312e81",
    sidebarText: "#ede9fe",
  },
  {
    id: "minimal-gray",
    name: "Minimal Gray",
    accent: "#374151",
    accentDark: "#111827",
    accentSoft: "#f9fafb",
    text: "#111827",
    textMuted: "#6b7280",
    divider: "#e5e7eb",
    sidebarBg: "#f3f4f6",
    sidebarText: "#111827",
  },
];

export const DEFAULT_THEME_ID = "corporate-blue";

export function getTheme(id?: string): ResumeTheme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** Spread onto a template root element to expose theme as CSS variables. */
export function themeVars(theme: ResumeTheme): Record<string, string> {
  return {
    "--rt-accent": theme.accent,
    "--rt-accent-dark": theme.accentDark,
    "--rt-accent-soft": theme.accentSoft,
    "--rt-text": theme.text,
    "--rt-text-muted": theme.textMuted,
    "--rt-divider": theme.divider,
    "--rt-sidebar-bg": theme.sidebarBg,
    "--rt-sidebar-text": theme.sidebarText,
  } as Record<string, string>;
}
