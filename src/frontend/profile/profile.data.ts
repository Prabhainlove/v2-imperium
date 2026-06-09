/**
 * Profile page data layer (Phase 3 migrated).
 *
 * Source of truth: Supabase `profiles` table via `getProfile` server fn.
 * No more `InternalSeedProfile` fallback on the frontend.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useSession } from "@frontend/auth/session";
import { type ImperiumProfile, EMPTY_PROFILE } from "@backend/profile/ProfileTypes";
import { getProfile } from "@backend/api/imperium.api";

export interface ExtractionFlag { label: string; ok: boolean; }
export interface MissingItem { label: string; }
export interface OptimizationItem { label: string; }

export interface ProfilePageData {
  profile: ImperiumProfile;
  scores: { strength: number; atsReadiness: number; resumeQuality: number };
  extraction: ExtractionFlag[];
  missing: MissingItem[];
  optimization: OptimizationItem[];
  resume: { fileName: string; sizeLabel: string; lastUpdated: string; extracted: boolean; active: boolean };
  loading: boolean;
}

function score(profile: ImperiumProfile) {
  const has = (v: unknown) => (typeof v === "string" ? v.trim().length > 0 : !!v) ? 1 : 0;
  const personal = (has(profile.name) + has(profile.email) + has(profile.phone) + has(profile.location) + has(profile.headline)) / 5;
  const career = (has(profile.target_role) + has(profile.seniority) + has(profile.work_mode) + Math.min(1, profile.target_locations.length / 1)) / 4;
  const summary = Math.min(1, (profile.summary?.length ?? 0) / 240);
  const skills = Math.min(1, profile.skills.length / 8);
  const exp = Math.min(1, profile.experience.length / 2);
  const projects = Math.min(1, profile.projects.length / 3);
  const edu = Math.min(1, profile.education.length / 1);
  const certs = Math.min(1, profile.certifications.length / 1);
  const links = (has(profile.linkedin_url) + has(profile.github_url) + has(profile.portfolio_url)) / 3;

  const strength = Math.round((personal * 12 + career * 12 + summary * 10 + skills * 14 + exp * 14 + projects * 12 + edu * 8 + certs * 6 + links * 12) / 100 * 100);
  const atsReadiness = Math.round((skills * 0.35 + summary * 0.2 + exp * 0.25 + career * 0.2) * 100);
  const resumeQuality = Math.round((summary * 0.25 + projects * 0.25 + skills * 0.25 + certs * 0.15 + edu * 0.10) * 100);
  return { strength, atsReadiness, resumeQuality };
}

export function useProfilePageData(): ProfilePageData {
  const session = useSession();
  const fetchProfile = useServerFn(getProfile);
  const query = useQuery({
    queryKey: ["profile", session?.userId ?? "anon"],
    queryFn: () => fetchProfile(),
    enabled: !!session,
    staleTime: 30_000,
  });

  return useMemo<ProfilePageData>(() => {
    const profile: ImperiumProfile = (query.data?.profile as ImperiumProfile | undefined) ?? {
      ...EMPTY_PROFILE,
      name: session?.fullName ?? "",
      email: session?.email ?? "",
    };
    const scores = score(profile);
    const extraction: ExtractionFlag[] = [
      { label: "Resume Uploaded", ok: !!profile.summary || profile.experience.length > 0 },
      { label: "LinkedIn Connected", ok: !!profile.linkedin_url },
      { label: "Profile Synced", ok: !query.isLoading && !!query.data },
    ];
    const missing: MissingItem[] = [];
    if (profile.experience.length === 0) missing.push({ label: "Experience Missing" });
    if (profile.skills.length < 8) missing.push({ label: "Skills Incomplete" });
    if (profile.education.length === 0) missing.push({ label: "Education Missing" });
    if (!profile.summary) missing.push({ label: "Summary Missing" });

    const optimization: OptimizationItem[] = [];
    if (scores.atsReadiness < 80) optimization.push({ label: "ATS Score Low" });
    if (profile.skills.length < 12) optimization.push({ label: "Missing Keywords" });
    optimization.push({ label: "Skills Gap Found" });
    optimization.push({ label: "Resume Enhancement Available" });

    return {
      profile,
      scores,
      extraction,
      missing,
      optimization,
      resume: {
        fileName: profile.name ? `${profile.name.replace(/\s+/g, "_")}_Resume.pdf` : "resume.pdf",
        sizeLabel: "PDF",
        lastUpdated: "—",
        extracted: !!profile.name,
        active: !!profile.name,
      },
      loading: query.isLoading,
    };
  }, [session, query.data, query.isLoading]);
}
