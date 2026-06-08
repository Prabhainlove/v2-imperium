import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, Plus, Trash2, Save, X, Search as SearchIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/imperium/page-header";
import {
  deleteInterview,
  getInterviews,
  upsertInterview,
  type InterviewInput,
} from "@/lib/imperium/client";
import type { InterviewRecord } from "@/lib/imperium/types";
import { formatRelativeTime } from "@/lib/imperium/format";

const STAGES = ["Screening", "Technical", "Managerial", "Final Round", "Offer", "Rejected"] as const;

export const Route = createFileRoute("/_authenticated/interviews")({
  head: () => ({
    meta: [
      { title: "Interview Tracker — Imperium" },
      { name: "description", content: "Track every interview round: schedule, notes, feedback, outcome." },
      { property: "og:title", content: "Interview Tracker — Imperium" },
      { property: "og:description", content: "Pipeline of every interview Imperium is running for you." },
    ],
  }),
  component: InterviewsPage,
});

function emptyForm(): InterviewInput {
  return {
    company: "",
    position: "",
    stage: "Screening",
    interview_at: null,
    location: "",
    recruiter: "",
    notes: "",
    feedback: "",
    outcome: "",
  };
}

function InterviewsPage() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["interviews"],
    queryFn: () => getInterviews(),
    retry: false,
  });

  const [editing, setEditing] = useState<InterviewInput | null>(null);
  const [search, setSearch] = useState("");

  const save = useMutation({
    mutationFn: (payload: InterviewInput) => upsertInterview(payload),
    onSuccess: () => {
      toast.success("Interview saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["interviews"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteInterview(id),
    onSuccess: () => {
      toast.success("Interview removed");
      qc.invalidateQueries({ queryKey: ["interviews"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = list.data ?? [];
    if (!q) return items;
    return items.filter(
      (i) =>
        i.company.toLowerCase().includes(q) ||
        i.position.toLowerCase().includes(q) ||
        i.stage.toLowerCase().includes(q),
    );
  }, [list.data, search]);

  const stageCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of STAGES) m.set(s, 0);
    for (const i of list.data ?? []) m.set(i.stage, (m.get(i.stage) ?? 0) + 1);
    return m;
  }, [list.data]);

  return (
    <div className="page-font-autopilot mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Interview Tracker"
        kanji="面"
        kanjiLabel="Mensetsu · 面接 · Encounter"
        description="Every interview round in one pipeline — schedule, notes, feedback, outcomes."
        actions={
          <Button onClick={() => setEditing(emptyForm())} className="bg-gradient-primary text-primary-foreground hover:opacity-95">
            <Plus className="mr-2 h-4 w-4" /> New Interview
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {STAGES.map((s) => (
          <Card key={s} className="border-border/60">
            <CardContent className="p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s}</div>
              <div className="text-xl font-semibold">{stageCounts.get(s) ?? 0}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" /> Pipeline ({filtered.length})
          </CardTitle>
          <div className="relative w-64">
            <SearchIcon className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search interviews…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-7 h-8"
            />
          </div>
        </CardHeader>
        <CardContent>
          {list.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              No interviews yet. <Link to="/applications" className="text-primary underline">Open an application</Link> or add one above.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {filtered.map((i) => (
                <li key={i.id} className="flex items-center gap-3 py-3">
                  <Badge variant="outline" className="shrink-0">{i.stage}</Badge>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {i.position || "—"} <span className="text-muted-foreground">@</span> {i.company}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {i.interview_at ? new Date(i.interview_at).toLocaleString() : "Unscheduled"}
                      {i.recruiter && <> · {i.recruiter}</>}
                      <> · updated {formatRelativeTime(i.updated_at)}</>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setEditing(toForm(i))}>
                    Edit
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove.mutate(i.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {editing && (
        <InterviewEditor
          value={editing}
          onChange={setEditing}
          onCancel={() => setEditing(null)}
          onSave={() => save.mutate(editing)}
          saving={save.isPending}
        />
      )}
    </div>
  );
}

function toForm(i: InterviewRecord): InterviewInput {
  return {
    id: i.id,
    application_id: i.application_id,
    company: i.company,
    position: i.position,
    stage: i.stage as InterviewInput["stage"],
    interview_at: i.interview_at,
    location: i.location,
    recruiter: i.recruiter,
    notes: i.notes,
    feedback: i.feedback,
    outcome: i.outcome,
  };
}

function InterviewEditor({
  value,
  onChange,
  onCancel,
  onSave,
  saving,
}: {
  value: InterviewInput;
  onChange: (v: InterviewInput) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const set = <K extends keyof InterviewInput>(k: K, v: InterviewInput[K]) =>
    onChange({ ...value, [k]: v });
  const dt = value.interview_at ? value.interview_at.slice(0, 16) : "";

  return (
    <Card className="border-primary/40">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{value.id ? "Edit interview" : "New interview"}</CardTitle>
        <Button size="icon" variant="ghost" onClick={onCancel}><X className="h-4 w-4" /></Button>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>Company</Label>
          <Input value={value.company} onChange={(e) => set("company", e.target.value)} />
        </div>
        <div>
          <Label>Position</Label>
          <Input value={value.position ?? ""} onChange={(e) => set("position", e.target.value)} />
        </div>
        <div>
          <Label>Stage</Label>
          <Select value={value.stage} onValueChange={(v) => set("stage", v as InterviewInput["stage"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>When</Label>
          <Input
            type="datetime-local"
            value={dt}
            onChange={(e) =>
              set("interview_at", e.target.value ? new Date(e.target.value).toISOString() : null)
            }
          />
        </div>
        <div>
          <Label>Location / link</Label>
          <Input value={value.location ?? ""} onChange={(e) => set("location", e.target.value)} />
        </div>
        <div>
          <Label>Recruiter</Label>
          <Input value={value.recruiter ?? ""} onChange={(e) => set("recruiter", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label>Notes</Label>
          <Textarea rows={3} value={value.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <Label>Feedback / outcome</Label>
          <Textarea rows={3} value={value.feedback ?? ""} onChange={(e) => set("feedback", e.target.value)} />
        </div>
        <div className="md:col-span-2 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onSave} disabled={saving || !value.company.trim()}>
            <Save className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Save interview"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
