import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Clock,
  Download,
  FileUp,
  History,
  Loader2,
  Printer,
  Save,
  Target,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import {
  RESUME_TEMPLATES,
  analyzeReadability,
  quickAts,
  renderResumeHtml,
  type ResumeTemplate,
} from "@/lib/imperium/resume-render";

const STARTER = `# Your Name
your.email@example.com · +00 000 0000 · City, Country
linkedin.com/in/your-handle · github.com/your-handle

## Summary
2–3 sentence summary of who you are and what you build.

## Experience
### Company — Role · Jan 2023 – Present
- Shipped X to Y users, improving Z by N%.
- Led a team of N engineers to deliver …

## Skills
- TypeScript, React, Node.js
- PostgreSQL, AWS, Docker

## Education
### University — Degree · 2018 – 2022
- Relevant coursework / honours.
`;

interface Version {
  id: string;
  label: string;
  content_md: string;
  template: string;
  created_at: string;
}

export function MasterResumeStudio({ userId: propUserId }: { userId?: string } = {}) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(propUserId ?? null);
  const [md, setMd] = useState<string>("");
  const [template, setTemplate] = useState<ResumeTemplate>("classic");
  const [jobDesc, setJobDesc] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (userId) return;
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [userId]);

  const doc = useQuery({
    queryKey: ["resume-doc", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resume_documents")
        .select("content_md,template,updated_at")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const versions = useQuery({
    queryKey: ["resume-versions", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resume_versions")
        .select("id,label,content_md,template,created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Version[];
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    if (loaded) return;
    if (doc.data) {
      setMd(doc.data.content_md || STARTER);
      setTemplate((doc.data.template as ResumeTemplate) || "classic");
      setLoaded(true);
    } else if (doc.isFetched && !doc.data) {
      setMd(STARTER);
      setLoaded(true);
    }
  }, [doc.data, doc.isFetched, loaded]);

  const html = useMemo(() => renderResumeHtml(md, template), [md, template]);
  const readability = useMemo(() => analyzeReadability(md), [md]);
  const ats = useMemo(
    () => (jobDesc.trim() ? quickAts(md, jobDesc) : null),
    [md, jobDesc],
  );

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("resume_documents")
      .upsert(
        { user_id: userId, content_md: md, template },
        { onConflict: "user_id" },
      );
    setSaving(false);
    if (error) return toast.error("Could not save", { description: error.message });
    toast.success("Master resume saved");
    qc.invalidateQueries({ queryKey: ["resume-doc", userId] });
  };

  const snapshot = async () => {
    if (!userId) return;
    const label = window.prompt("Version label (optional)", `v${versions.data?.length ?? 0 + 1}`) ?? "";
    setSnapshotting(true);
    const { error } = await supabase
      .from("resume_versions")
      .insert({ user_id: userId, content_md: md, template, label });
    setSnapshotting(false);
    if (error) return toast.error("Could not snapshot", { description: error.message });
    toast.success("Version saved");
    qc.invalidateQueries({ queryKey: ["resume-versions", userId] });
  };

  const restore = (v: Version) => {
    if (!window.confirm(`Restore "${v.label || v.id.slice(0, 6)}" into the editor? Current edits will be replaced.`))
      return;
    setMd(v.content_md);
    setTemplate((v.template as ResumeTemplate) || "classic");
    toast.message("Version restored to editor", { description: "Click Save to keep it." });
  };

  const removeVersion = async (id: string) => {
    if (!window.confirm("Delete this version permanently?")) return;
    const { error } = await supabase.from("resume_versions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["resume-versions", userId] });
  };

  const printPdf = () => {
    const w = window.open("", "_blank");
    if (!w) return toast.error("Pop-up blocked — allow pop-ups to print");
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const downloadMd = () => {
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resume.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!/\.(md|markdown|txt)$/i.test(f.name)) {
      toast.error("Only .md / .markdown / .txt files are supported");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setMd(text);
      toast.success("Resume loaded from file");
    };
    reader.readAsText(f);
    e.target.value = "";
  };

  const gradeTone =
    readability.recruiter_grade === "A"
      ? "bg-success/15 text-success border-success/30"
      : readability.recruiter_grade === "B"
        ? "bg-info/15 text-info border-info/30"
        : readability.recruiter_grade === "C"
          ? "bg-warning/15 text-warning border-warning/30"
          : "bg-destructive/15 text-destructive border-destructive/30";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">Master Resume</span>
          <div className="flex flex-wrap items-center gap-1">
            {RESUME_TEMPLATES.map((t) => (
              <button
                key={t.id}
                title={t.desc}
                onClick={() => setTemplate(t.id)}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
                  template === t.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={saving || !loaded} size="sm" className="bg-gradient-primary text-primary-foreground hover:opacity-95">
            {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
            Save
          </Button>
          <Button onClick={snapshot} disabled={snapshotting || !loaded} size="sm" variant="outline">
            {snapshotting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <History className="mr-1.5 h-3.5 w-3.5" />}
            Snapshot version
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <FileUp className="mr-1.5 h-3.5 w-3.5" /> Upload .md
          </Button>
          <input ref={fileRef} type="file" accept=".md,.markdown,.txt" hidden onChange={onUpload} />
          <Button size="sm" variant="outline" onClick={downloadMd}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Markdown
          </Button>
          <Button size="sm" variant="outline" onClick={printPdf}>
            <Printer className="mr-1.5 h-3.5 w-3.5" /> Print / PDF
          </Button>
        </div>

        <Tabs defaultValue="edit">
          <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-flex">
            <TabsTrigger value="edit">Edit + Preview</TabsTrigger>
            <TabsTrigger value="ats">ATS &amp; Readability</TabsTrigger>
            <TabsTrigger value="history">History ({versions.data?.length ?? 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="mt-3">
            <div className="grid gap-3 lg:grid-cols-2">
              <div>
                <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Markdown</div>
                <Textarea
                  value={md}
                  onChange={(e) => setMd(e.target.value)}
                  rows={26}
                  spellCheck={false}
                  className="resize-none font-mono text-[12px] leading-relaxed"
                />
              </div>
              <div>
                <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                  Live preview · {template}
                </div>
                <iframe
                  title="Master Resume Preview"
                  srcDoc={html}
                  className="h-[560px] w-full rounded-md border border-border/60 bg-white"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="ats" className="mt-3 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className={gradeTone}>
                Recruiter grade {readability.recruiter_grade}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {readability.word_count} words · {readability.bullet_count} bullets · {readability.section_count} sections
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-border/60 p-3">
                <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                  Reading ease (Flesch)
                </div>
                <Progress value={readability.flesch_reading_ease} className="h-2" />
                <div className="mt-1 text-xs text-muted-foreground">
                  {readability.flesch_reading_ease}/100 · avg bullet ≈ {readability.avg_bullet_words} words
                </div>
              </div>
              <div className="rounded-md border border-border/60 p-3">
                <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">Recruiter checklist</div>
                {readability.notes.length === 0 ? (
                  <p className="text-xs text-success">All checks passing — looks recruiter-ready.</p>
                ) : (
                  <ul className="space-y-0.5 text-xs">
                    {readability.notes.map((n, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-warning">•</span>
                        <span>{n}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Target a job description</span>
              </div>
              <Textarea
                value={jobDesc}
                onChange={(e) => setJobDesc(e.target.value)}
                rows={6}
                placeholder="Paste a job description to score keyword coverage against this resume."
                className="text-sm"
              />
              {ats && (
                <div className="rounded-md border border-border/60 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">
                      Keyword match
                    </span>
                    <Badge
                      className={
                        ats.score >= 70
                          ? "bg-success/15 text-success border-success/30"
                          : ats.score >= 40
                            ? "bg-warning/15 text-warning border-warning/30"
                            : "bg-destructive/15 text-destructive border-destructive/30"
                      }
                    >
                      {ats.score}%
                    </Badge>
                  </div>
                  <Progress value={ats.score} className="h-2" />
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <KwBlock title="Matched" items={ats.matched} tone="success" />
                    <KwBlock title="Missing" items={ats.missing} tone="warning" />
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="history" className="mt-3">
            {versions.isLoading ? (
              <div className="flex items-center justify-center p-6 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading versions…
              </div>
            ) : (versions.data ?? []).length === 0 ? (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                No snapshots yet. Click <strong>Snapshot version</strong> to save a checkpoint of the current resume.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {versions.data!.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 py-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{v.label || `Snapshot ${v.id.slice(0, 6)}`}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(v.created_at).toLocaleString()} · {v.template}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => restore(v)}>
                      Restore
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => removeVersion(v.id)} aria-label="Delete version">
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function KwBlock({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "success" | "warning";
}) {
  const cls =
    tone === "success"
      ? "border-success/30 bg-success/10 text-success"
      : "border-warning/30 bg-warning/10 text-warning";
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        {title} ({items.length})
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">—</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {items.slice(0, 16).map((k) => (
            <span key={k} className={`rounded border px-1.5 py-0.5 text-[10px] ${cls}`}>
              {k}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
