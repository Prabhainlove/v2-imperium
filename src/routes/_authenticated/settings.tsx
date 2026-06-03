import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Globe,
  KeyRound,
  RotateCcw,
  Save,
  Server,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/imperium/page-header";
import {
  getApiBaseUrl,
  setApiBaseUrl,
  getDefaultBaseUrl,
  REAL_SOURCES,
} from "@/lib/imperium/config";
import { getAgents, getHealth } from "@/lib/imperium/client";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Imperium" },
      {
        name: "description",
        content: "Configure the Imperium API base URL and review system status.",
      },
      { property: "og:title", content: "Settings — Imperium" },
      { property: "og:description", content: "Imperium frontend configuration." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [base, setBase] = useState("");
  useEffect(() => setBase(getApiBaseUrl()), []);

  const health = useQuery({
    queryKey: ["health", base],
    queryFn: ({ signal }) => getHealth(signal),
    retry: false,
    refetchInterval: 10_000,
  });

  const agents = useQuery({
    queryKey: ["agents", base],
    queryFn: ({ signal }) => getAgents(signal),
    retry: false,
  });

  function save() {
    setApiBaseUrl(base);
    toast.success(`Backend URL set to ${getApiBaseUrl()}`);
    health.refetch();
    agents.refetch();
  }

  function reset() {
    setApiBaseUrl("");
    setBase(getDefaultBaseUrl());
    toast.message("Reset to default");
    setTimeout(() => {
      health.refetch();
      agents.refetch();
    }, 50);
  }

  const ok = !!health.data && !health.error;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
      <PageHeader
        title="Settings"
        description="Configure the connection to the Imperium FastAPI backend."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4 text-primary" /> Backend Connection
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="base">API Base URL</Label>
            <div className="mt-1 flex gap-2">
              <Input
                id="base"
                value={base}
                onChange={(e) => setBase(e.target.value)}
                placeholder="http://localhost:8000"
                className="font-mono text-sm"
              />
              <Button onClick={save} className="bg-gradient-primary text-primary-foreground">
                <Save className="mr-1.5 h-4 w-4" /> Save
              </Button>
              <Button variant="outline" onClick={reset}>
                <RotateCcw className="mr-1.5 h-4 w-4" /> Reset
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Imperium ships with a FastAPI server on port 8000. Run{" "}
              <code className="rounded bg-muted px-1.5 py-0.5">
                uvicorn main:app --host 0.0.0.0 --port 8000 --reload
              </code>{" "}
              inside the IMPERIUM directory. For a deployed backend, paste the
              public HTTPS URL here.
            </p>
          </div>

          <div
            className={`flex items-start gap-3 rounded-md border p-3 ${
              ok
                ? "border-success/30 bg-success/5"
                : "border-destructive/30 bg-destructive/5"
            }`}
          >
            {ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
            )}
            <div className="flex-1 text-sm">
              {ok ? (
                <>
                  <div className="font-medium text-success">
                    Connected · {health.data?.agents_count ?? 0} agents · v
                    {health.data?.version ?? "?"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Kernel status: {String(health.data?.status)}
                  </div>
                </>
              ) : (
                <>
                  <div className="font-medium text-destructive">
                    Cannot reach backend
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {(health.error as Error | undefined)?.message ??
                      "Start the FastAPI server or update the URL above."}
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4 text-primary" /> Real Job Sources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            These are the sources actually queried by{" "}
            <code className="rounded bg-muted px-1.5 py-0.5">
              imperium/agents/job_agent/services/discovery.py
            </code>
            . Sources marked with a key icon are skipped if their API key env vars
            are not set on the backend.
          </p>
          <ul className="grid gap-2 md:grid-cols-2">
            {REAL_SOURCES.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 rounded-md border border-border/60 p-2 text-sm"
              >
                <Globe className="h-4 w-4 text-primary" />
                <span className="flex-1">{s.label}</span>
                {s.requiresKey ? (
                  <Badge variant="outline" className="text-[10px]">
                    <KeyRound className="mr-1 h-3 w-3" /> API key
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">
                    Public
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Registered Agents</CardTitle>
        </CardHeader>
        <CardContent>
          {agents.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : agents.error ? (
            <p className="text-sm text-destructive">
              Backend unreachable; agent list unavailable.
            </p>
          ) : (agents.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No agents registered.</p>
          ) : (
            <ul className="space-y-1.5">
              {(agents.data ?? []).map((a) => (
                <li
                  key={a.name}
                  className="flex items-center gap-2 rounded-md border border-border/60 p-2 text-sm"
                >
                  <span className="font-medium">{a.name}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {a.status ?? "ready"}
                  </Badge>
                  {(a.capabilities ?? []).length > 0 && (
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {(a.capabilities ?? []).slice(0, 3).join(" · ")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
