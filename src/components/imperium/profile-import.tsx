/**
 * Profile Import card — upload a resume file or paste a LinkedIn URL
 * and let the Brain auto-fill the profile editor.
 */
import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileText, Linkedin, Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { importProfileFromLinkedin, importProfileFromPdf, importProfileFromText } from "@/lib/imperium/client";
import { extractTextFromFile } from "@/lib/imperium/profile/file-parse";
import type { ImperiumProfile } from "@/lib/imperium/profile/types";

type Patch = Partial<ImperiumProfile>;

interface Props {
  current: ImperiumProfile;
  onApply: (patch: Patch) => void;
}

/** Merge an imported patch into the current profile (non-destructive for arrays). */
function mergePatch(current: ImperiumProfile, patch: Patch): Patch {
  const out: Patch = {};
  const cur = current as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(patch) as [keyof Patch, unknown][]) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string") {
      if (!v.trim()) continue;
      const existing = cur[k as string];
      if (typeof existing !== "string" || !existing.trim()) {
        (out as Record<string, unknown>)[k] = v.trim();
      }
    } else if (Array.isArray(v)) {
      const existing = cur[k as string];
      const existingArr = Array.isArray(existing) ? existing : [];
      if (k === "skills" || k === "achievements") {
        const merged = Array.from(
          new Set([...(existingArr as string[]), ...(v as string[])].map((s) => s.trim()).filter(Boolean)),
        );
        (out as Record<string, unknown>)[k] = merged;
      } else {
        if (existingArr.length === 0) (out as Record<string, unknown>)[k] = v;
      }
    }
  }
  return out;
}


function summary(patch: Patch): string[] {
  const bits: string[] = [];
  if (patch.name) bits.push("name");
  if (patch.email) bits.push("email");
  if (patch.phone) bits.push("phone");
  if (patch.location) bits.push("location");
  if (patch.headline) bits.push("headline");
  if (patch.summary) bits.push("summary");
  if (patch.skills?.length) bits.push(`${patch.skills.length} skills`);
  if (patch.experience?.length) bits.push(`${patch.experience.length} roles`);
  if (patch.education?.length) bits.push(`${patch.education.length} education`);
  if (patch.projects?.length) bits.push(`${patch.projects.length} projects`);
  if (patch.certifications?.length) bits.push(`${patch.certifications.length} certs`);
  if (patch.linkedin_url) bits.push("LinkedIn");
  if (patch.github_url) bits.push("GitHub");
  return bits;
}

export function ProfileImportCard({ current, onApply }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkedin, setLinkedin] = useState(current.linkedin_url ?? "");
  const [parsing, setParsing] = useState(false);

  const resumeImport = useMutation({
    mutationFn: async (file: File) => {
      setParsing(true);
      try {
        const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
        let text = "";
        try {
          text = await extractTextFromFile(file);
        } catch (err) {
          // For PDFs, fall back to server OCR below. For other types, surface the error.
          if (!isPdf) throw err;
          console.warn("Local PDF parse failed, falling back to server OCR:", err);
        }
        if (text && text.length >= 200) {
          return importProfileFromText(text);
        }
        if (isPdf) {
          // Scanned / image-based PDF — send to server for Gemini OCR.
          const buf = await file.arrayBuffer();
          const bytes = new Uint8Array(buf);
          let binary = "";
          const chunk = 0x8000;
          for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
          }
          const base64 = btoa(binary);
          return importProfileFromPdf(base64);
        }
        if (!text || text.length < 40) {
          throw new Error("Couldn't read text from that file. Try a different export or paste it manually.");
        }
        return importProfileFromText(text);
      } finally {
        setParsing(false);
      }
    },
    onSuccess: (res) => {
      const merged = mergePatch(current, res.patch);
      const filled = summary(merged);
      if (filled.length === 0) {
        toast.info("Resume parsed — your profile already has this info.");
        return;
      }
      onApply(merged);
      toast.success(`Imported from resume: ${filled.join(", ")}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const linkedinImport = useMutation({
    mutationFn: async () => importProfileFromLinkedin(linkedin.trim()),
    onSuccess: (res) => {
      const merged = mergePatch(current, res.patch);
      const filled = summary(merged);
      if (filled.length === 0) {
        toast.info("LinkedIn fetched — nothing new to import.");
        return;
      }
      onApply(merged);
      toast.success(`Imported from LinkedIn: ${filled.join(", ")}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = parsing || resumeImport.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" /> Autofill your profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Resume upload */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4 text-muted-foreground" /> Upload a resume
          </div>
          <p className="text-xs text-muted-foreground">
            PDF, DOCX, or TXT. We extract your details locally, then ask the Brain to structure them — empty fields are filled, your existing entries are kept.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) resumeImport.mutate(f);
              if (fileRef.current) fileRef.current.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            {parsing ? "Reading file…" : resumeImport.isPending ? "Brain extracting…" : "Choose resume file"}
          </Button>
        </div>

        <div className="h-px w-full bg-border/60" />

        {/* LinkedIn URL */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Linkedin className="h-4 w-4 text-muted-foreground" /> Import from LinkedIn URL
          </div>
          <p className="text-xs text-muted-foreground">
            Paste your public LinkedIn profile URL. Requires the Firecrawl connector to scrape public profile content.
          </p>
          <div className="grid gap-2">
            <Label htmlFor="li-url" className="sr-only">LinkedIn URL</Label>
            <div className="flex gap-2">
              <Input
                id="li-url"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="https://www.linkedin.com/in/your-handle"
              />
              <Button
                type="button"
                onClick={() => linkedinImport.mutate()}
                disabled={linkedinImport.isPending || !linkedin.trim()}
                className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"
              >
                {linkedinImport.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Import
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 pt-1">
          <Badge variant="secondary" className="text-[10px]">Non-destructive merge</Badge>
          <Badge variant="secondary" className="text-[10px]">Click Save to persist</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
