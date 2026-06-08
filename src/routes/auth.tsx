import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import katanaAsset from "@/assets/imperium/katana_vertical.png.asset.json";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Imperium" },
      { name: "description", content: "Sign in or create an Imperium account to launch your AI job agent." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetSending, setResetSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled && data.user) navigate({ to: "/dashboard", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) navigate({ to: "/dashboard", replace: true });
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: { name } },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created. Check your email to confirm.");
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
  };

  const google = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/dashboard" },
    });
    if (error) { setBusy(false); toast.error(error.message ?? "Google sign-in failed"); }
  };

  const sendReset = async () => {
    if (!email) return toast.error("Enter your email above first");
    setResetSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetSending(false);
    if (error) return toast.error(error.message);
    toast.success("Reset email sent", { description: "Check your inbox for a link to reset your password." });
  };

  return (
    <div className="page-font-auth imp-surface relative grid min-h-screen grid-cols-1 overflow-hidden lg:grid-cols-[1.05fr_1fr]">
      <span className="imp-tick imp-tick-tl" aria-hidden />
      <span className="imp-tick imp-tick-tr" aria-hidden />
      <span className="imp-tick imp-tick-bl" aria-hidden />
      <span className="imp-tick imp-tick-br" aria-hidden />

      {/* LEFT — ceremonial katana panel */}
      <aside className="relative hidden overflow-hidden border-r border-[rgba(216,227,242,0.08)] lg:flex lg:flex-col">
        {/* giant kanji watermark */}
        <span aria-hidden className="imp-kanji imp-kanji-xl right-[-2vw] top-[10vh] !text-[rgba(255,107,61,0.07)]">鍵</span>
        <span aria-hidden className="imp-kanji imp-kanji-md left-8 bottom-32 !text-[rgba(216,227,242,0.06)] [writing-mode:vertical-rl]">
          一期一会
        </span>

        {/* katana art centered */}
        <img
          src={katanaAsset.url}
          alt=""
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[92vh] w-auto -translate-x-1/2 -translate-y-1/2 select-none opacity-90 drop-shadow-[0_30px_60px_rgba(0,0,0,0.6)]"
        />

        {/* top-left mark */}
        <div className="relative z-10 flex items-center gap-3 px-10 pt-10">
          <span className="imp-mark-sm" aria-hidden />
          <div>
            <div className="imp-display text-[13px] text-[#d8e3f2]">IMPERIUM</div>
            <div className="imp-eyebrow">AI Job Agent · 自動応募</div>
          </div>
        </div>

        {/* bottom-left poetry */}
        <div className="relative z-10 mt-auto px-10 pb-14">
          <div className="imp-brush-divider mb-5 max-w-xs opacity-70" aria-hidden />
          <p className="imp-h text-[28px] leading-tight text-[#d8e3f2]">
            Unsheathe<br/>your career.
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-[rgba(216,227,242,0.55)]">
            道に迷うな — Walk the way without hesitation. Imperium discovers, tailors and tracks every application with the discipline of a tachi cut.
          </p>
          <div className="mt-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-[rgba(216,227,242,0.45)]">
            <span>志</span><span>·</span><span>Resolve</span>
            <span className="ml-3">技</span><span>·</span><span>Craft</span>
            <span className="ml-3">勝</span><span>·</span><span>Victory</span>
          </div>
        </div>
      </aside>

      {/* RIGHT — form */}
      <main className="relative flex items-center justify-center px-4 py-12 lg:px-12">
        <span aria-hidden className="imp-kanji imp-kanji-xl -top-10 -right-10 !text-[rgba(255,107,61,0.05)] lg:hidden">鍵</span>
        <div className="relative z-10 w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center justify-center gap-3 lg:hidden">
            <span className="imp-mark-sm" aria-hidden />
            <div className="text-center">
              <div className="imp-display text-base text-[#d8e3f2]">IMPERIUM</div>
              <div className="imp-eyebrow">AI Job Agent</div>
            </div>
          </Link>

          <div className="mb-6 hidden lg:block">
            <div className="imp-eyebrow">参 — Enter</div>
            <h1 className="imp-h mt-2 text-4xl text-[#d8e3f2]">Welcome to Imperium</h1>
            <p className="mt-2 text-sm text-[rgba(216,227,242,0.55)]">
              Sign in to your dōjō, or forge a new account.
            </p>
            <div className="imp-hairline mt-5 w-24" />
          </div>

          <Card className="imp-panel p-6">
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2 bg-white/[0.04]">
                <TabsTrigger value="signin">Sign in · 入</TabsTrigger>
                <TabsTrigger value="signup">Create · 新</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-6 space-y-4">
                <form onSubmit={signIn} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="si-email">Email</Label>
                    <Input id="si-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="si-pass">Password</Label>
                    <Input id="si-pass" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" disabled={busy} className="bg-gradient-primary w-full">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in · 抜刀"}
                  </Button>
                  <button type="button" onClick={sendReset} disabled={resetSending}
                    className="block w-full text-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                    {resetSending ? "Sending reset link…" : "Forgot password?"}
                  </button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-6 space-y-4">
                <form onSubmit={signUp} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="su-name">Full name</Label>
                    <Input id="su-name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-email">Email</Label>
                    <Input id="su-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-pass">Password</Label>
                    <Input id="su-pass" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" disabled={busy} className="bg-gradient-primary w-full">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Forge account · 鍛"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.32em] text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              <span>又 · or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <Button variant="outline" onClick={google} disabled={busy} className="w-full">
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0012 23z" />
                <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 015.5 12c0-.73.13-1.43.34-2.1V7.06H2.18A10.99 10.99 0 001 12c0 1.78.43 3.46 1.18 4.94l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
              </svg>
              Continue with Google
            </Button>
          </Card>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            一期一会 · One encounter, one chance. Data stays in your private workspace.
          </p>
        </div>
      </main>
    </div>
  );
}
