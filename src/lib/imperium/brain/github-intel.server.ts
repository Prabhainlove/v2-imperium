/**
 * GitHub Intelligence.
 * Server-only. Fetches public GitHub data and summarizes it locally.
 */
import type { GithubIntel } from "@/lib/imperium/profile/types";

function parseUsername(url: string): string | null {
  if (!url) return null;
  const cleaned = url.trim().replace(/\/+$/, "");
  if (!cleaned) return null;
  if (!cleaned.includes("/")) return cleaned.replace(/^@/, "");
  try {
    const u = new URL(cleaned.startsWith("http") ? cleaned : `https://${cleaned}`);
    if (!u.hostname.endsWith("github.com")) return null;
    const seg = u.pathname.split("/").filter(Boolean);
    return seg[0] ?? null;
  } catch {
    return null;
  }
}

async function gh<T>(path: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const r = await fetch(`https://api.github.com${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Imperium-Brain",
      },
      signal,
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

interface GhUser { login: string; public_repos: number; followers: number; bio?: string }
interface GhRepo {
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  html_url: string;
  updated_at: string;
  fork: boolean;
  archived: boolean;
  pushed_at: string;
}

export async function analyzeGithubUrl(url: string): Promise<GithubIntel> {
  const username = parseUsername(url);
  if (!username) return { error: "Could not parse GitHub username from URL", fetched_at: new Date().toISOString() };

  const user = await gh<GhUser>(`/users/${username}`);
  if (!user) return { username, error: "GitHub user not found or rate-limited", fetched_at: new Date().toISOString() };

  const repos = (await gh<GhRepo[]>(`/users/${username}/repos?per_page=100&sort=pushed`)) ?? [];
  const ownRepos = repos.filter((r) => !r.fork && !r.archived);

  // Language aggregation (approx — use primary language as proxy; bytes via languages endpoint is N requests)
  const langMap = new Map<string, number>();
  for (const r of ownRepos) {
    if (r.language) langMap.set(r.language, (langMap.get(r.language) ?? 0) + 1);
  }
  const top_languages = [...langMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, bytes]) => ({ name, bytes }));

  const top_repos = ownRepos
    .sort((a, b) => b.stargazers_count - a.stargazers_count || Date.parse(b.pushed_at) - Date.parse(a.pushed_at))
    .slice(0, 8)
    .map((r) => ({
      name: r.name,
      description: r.description ?? undefined,
      stars: r.stargazers_count,
      language: r.language ?? undefined,
      url: r.html_url,
      updated_at: r.pushed_at,
    }));

  const intel: GithubIntel = {
    username,
    fetched_at: new Date().toISOString(),
    public_repos: user.public_repos,
    followers: user.followers,
    top_languages,
    top_repos,
    inferred_stack: top_languages.map((l) => l.name),
  };

  intel.summary = `${username} has ${user.public_repos} public repos, ${user.followers} followers, and strongest visible activity in ${top_languages.slice(0, 3).map((l) => l.name).join(", ") || "public repositories"}.`;
  intel.resume_bullets = top_repos.slice(0, 3).map((r) =>
    `Built ${r.name}${r.language ? ` with ${r.language}` : ""}${r.stars ? `, earning ${r.stars} GitHub stars` : ""}.`,
  );

  return intel;
}
