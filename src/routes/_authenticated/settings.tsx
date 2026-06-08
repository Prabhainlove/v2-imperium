import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Github, Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/imperium/page-header";
import { ProfileCompletenessPanel } from "@/components/imperium/profile-completeness-panel";
import { ProfileImportCard } from "@/components/imperium/profile-import";

import {
  AchievementsSection, CareerSection, CertsSection, EducationSection, ExperienceSection,
  LanguagesSection, LinksSection, PersonalSection, ProjectsSection, SkillsSection,
} from "@/components/imperium/profile-sections";
import { getProfile, refreshGithubIntel, saveProfile } from "@/lib/imperium/client";
import { EMPTY_PROFILE, type ImperiumProfile } from "@/lib/imperium/profile/types";
import { computeCompleteness } from "@/lib/imperium/profile/completeness";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Profile & Settings — Imperium" },
      { name: "description", content: "Your Imperium profile — the source of truth for every workflow." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const profileQ = useQuery({ queryKey: ["profile"], queryFn: getProfile, retry: false });
  const [draft, setDraft] = useState<ImperiumProfile | null>(null);

  useEffect(() => {
    if (profileQ.data?.profile) setDraft(profileQ.data.profile as ImperiumProfile);
  }, [profileQ.data]);

  const completeness = useMemo(
    () => computeCompleteness(draft ?? EMPTY_PROFILE),
    [draft],
  );

  const save = useMutation({
    mutationFn: async (patch: Partial<ImperiumProfile>) => saveProfile(patch),
    onSuccess: () => {
      toast.success("Profile saved");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ghRefresh = useMutation({
    mutationFn: async () => refreshGithubIntel(draft?.github_url),
    onSuccess: () => {
      toast.success("GitHub intelligence refreshed");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!draft) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const set = (patch: Partial<ImperiumProfile>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const persist = () => save.mutate(draft);

  const gh = draft.github_intel as { username?: string; summary?: string; top_languages?: { name: string }[]; error?: string };

  return (
    <div className="app-surface-crm min-h-screen mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Profile & Settings"
        kanji="設"
        kanjiLabel="Settei · 設定 · Configure"
        description="Your profile is the source of truth for every Imperium workflow."
        actions={
          <Button onClick={persist} disabled={save.isPending} className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
            {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save changes
          </Button>
        }
      />

      <ProfileCompletenessPanel completeness={completeness} />

      <ProfileImportCard
        current={draft}
        onApply={(patch) => setDraft((d) => (d ? { ...d, ...patch } : d))}
      />


      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> Profile Editor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="personal">
            <TabsList className="flex h-auto flex-wrap justify-start gap-1">
              <TabsTrigger value="personal">Personal</TabsTrigger>
              <TabsTrigger value="career">Career</TabsTrigger>
              <TabsTrigger value="skills">Skills</TabsTrigger>
              <TabsTrigger value="experience">Experience</TabsTrigger>
              <TabsTrigger value="projects">Projects</TabsTrigger>
              <TabsTrigger value="education">Education</TabsTrigger>
              <TabsTrigger value="certs">Certs</TabsTrigger>
              <TabsTrigger value="languages">Languages</TabsTrigger>
              <TabsTrigger value="achievements">Achievements</TabsTrigger>
              <TabsTrigger value="links">Links & Intel</TabsTrigger>
            </TabsList>
            <div className="mt-6">
              <TabsContent value="personal"><PersonalSection p={draft} set={set} /></TabsContent>
              <TabsContent value="career"><CareerSection p={draft} set={set} /></TabsContent>
              <TabsContent value="skills"><SkillsSection p={draft} set={set} /></TabsContent>
              <TabsContent value="experience"><ExperienceSection p={draft} set={set} /></TabsContent>
              <TabsContent value="projects"><ProjectsSection p={draft} set={set} /></TabsContent>
              <TabsContent value="education"><EducationSection p={draft} set={set} /></TabsContent>
              <TabsContent value="certs"><CertsSection p={draft} set={set} /></TabsContent>
              <TabsContent value="languages"><LanguagesSection p={draft} set={set} /></TabsContent>
              <TabsContent value="achievements"><AchievementsSection p={draft} set={set} /></TabsContent>
              <TabsContent value="links" className="space-y-6">
                <LinksSection p={draft} set={set} />

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Github className="h-4 w-4" /> GitHub Intelligence
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Imperium analyzes your public repos to infer your tech stack and suggest resume bullets. No credentials needed.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => ghRefresh.mutate()}
                      disabled={ghRefresh.isPending || !draft.github_url}
                    >
                      {ghRefresh.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                      {gh.username ? "Re-analyze GitHub" : "Analyze GitHub"}
                    </Button>
                    {gh.error && <p className="text-sm text-destructive">{gh.error}</p>}
                    {gh.summary && (
                      <div className="rounded-md border border-border/60 bg-card/40 p-3 text-sm">
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">Local summary</div>
                        <p className="mt-1">{gh.summary}</p>
                      </div>
                    )}
                    {gh.top_languages && gh.top_languages.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {gh.top_languages.map((l) => <Badge key={l.name} variant="secondary">{l.name}</Badge>)}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
