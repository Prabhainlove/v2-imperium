/** Jobs page logic — TanStack Query hooks for discovery + selection. */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import {
  discoverJobs,
  getDiscoveredJob,
  selectJobForResume,
  getProfileMetrics,
} from "@backend/api/jobs.api";

export interface SearchFiltersUI {
  title: string;
  skills: string;
  location: string;
  experience: string;
  workMode: string;
  salaryMin: string;
}

export const EMPTY_FILTERS: SearchFiltersUI = {
  title: "", skills: "", location: "", experience: "", workMode: "", salaryMin: "",
};

export function useProfileMetrics() {
  const fn = useServerFn(getProfileMetrics);
  return useQuery({
    queryKey: ["jobs", "profile-metrics"],
    queryFn: () => fn({}),
    staleTime: 60_000,
  });
}

type DiscoveryData = Awaited<ReturnType<typeof discoverJobs>>;

export function useDiscovery() {
  const qc = useQueryClient();
  const fn = useServerFn(discoverJobs);
  const [lastFilters, setLastFilters] = useState<SearchFiltersUI | null>(null);

  const search = useMutation({
    mutationFn: (filters: SearchFiltersUI) => {
      setLastFilters(filters);
      return fn({
        data: {
          title: filters.title,
          skills: filters.skills,
          location: filters.location,
          experience: filters.experience,
          workMode: filters.workMode,
          salaryMin: filters.salaryMin ? Number(filters.salaryMin) : null,
        },
      });
    },
    onSuccess: (data) => {
      qc.setQueryData(["jobs", "discovery"], data);
    },
  });

  const refresh = () => {
    if (lastFilters) search.mutate(lastFilters);
  };

  const data = (qc.getQueryData(["jobs", "discovery"]) as DiscoveryData | undefined) ?? null;
  return { search, refresh, data, lastFilters };
}

export function useJobDetails(jobId: string | null) {
  const fn = useServerFn(getDiscoveredJob);
  return useQuery({
    queryKey: ["jobs", "details", jobId],
    queryFn: () => fn({ data: { jobId: jobId! } }),
    enabled: !!jobId,
    staleTime: 30_000,
  });
}

export function useSelectJob() {
  const fn = useServerFn(selectJobForResume);
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (jobId: string) => fn({ data: { jobId } }),
    onSuccess: (res) => {
      navigate({ to: "/resume", search: { jobId: res.jobId } as never }).catch(() => {
        window.location.href = res.redirect;
      });
    },
  });
}

export const INTELLIGENCE_LABEL: Record<string, { text: string; tone: string }> = {
  high_opportunity: { text: "High Opportunity", tone: "tone-green" },
  strong_match:     { text: "Strong Match",     tone: "tone-blue" },
  competitive:      { text: "Competitive",      tone: "tone-amber" },
  long_shot:        { text: "Long Shot",        tone: "tone-grey" },
};

export function postedAgo(iso: string | null): string {
  if (!iso) return "Recently";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 Day Ago";
  if (days < 30) return `${days} Days Ago`;
  return `${Math.floor(days / 30)} mo ago`;
}

export function companyInitials(name: string): string {
  return (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}
