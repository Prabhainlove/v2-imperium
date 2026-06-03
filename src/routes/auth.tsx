import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Eye, EyeOff, Check, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Imperium" },
      { name: "description", content: "Sign in or create an Imperium account to launch your AI job agent." },
    ],
  }),
  component: AuthPage,
});

type PwChecks = { len: boolean; upper: boolean; lower: boolean; num: boolean };
function checkPassword(pw: string): PwChecks {
  return {
    len: pw.length >= 8,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    num: /\d/.test(pw),
  };
}
function pwScore(c: PwChecks, pw: string): { score: number; label: string; tone: string } {
  const base = [c.len, c.upper, c.lower, c.num].filter(Boolean).length;
  const bonus = pw.length >= 12 ? 1 : 0;
  const score = base + bonus; // 0..5
  if (score <= 1) return { score: 1, label: "Weak", tone: "bg-red-500" };
  if (score === 2) return { score: 2, label: "Weak", tone: "bg-red-500" };
  if (score === 3) return { score: 3, label: "Medium", tone: "bg-yellow-500" };
  if (score === 4) return { score: 4, label: "Strong", tone: "bg-green-500" };
  return { score: 5, label: "Very strong", tone: "bg-emerald-500" };
}

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetSending, setResetSending] = useState(false);

  // If already signed in, bounce to dashboard.
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


  const pwChecks = useMemo(() => checkPassword(password), [password]);
  const pwOk = pwChecks.len && pwChecks.upper && pwChecks.lower && pwChecks.num;
  const strength = useMemo(() => pwScore(pwChecks, password), [pwChecks, password]);

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwOk) return toast.error("Password does not meet all requirements");
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { name },
      },
    });
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    // Email confirmation is disabled — sign the user in immediately.
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (signInError) return toast.error(signInError.message);
    toast.success("Account created", { description: "Welcome to Imperium." });
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
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
    <div className="imp-surface flex items-center justify-center px-4 py-12">
      <span className="imp-tick imp-tick-tl" aria-hidden />
      <span className="imp-tick imp-tick-tr" aria-hidden />
      <span className="imp-tick imp-tick-bl" aria-hidden />
      <span className="imp-tick imp-tick-br" aria-hidden />
      <div className="relative z-10 w-full max-w-md">
        <Link to="/" className="mb-10 flex items-center justify-center gap-3">
          <span className="imp-mark-sm" aria-hidden />
          <div className="text-center">
            <div className="imp-display text-base text-[#d8e3f2]">IMPERIUM</div>
            <div className="imp-eyebrow">AI Job Agent</div>
          </div>
        </Link>

        <Card className="p-6">
          {(

            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-6 space-y-4">
                <form onSubmit={signIn} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="si-email">Email</Label>
                    <Input id="si-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="si-pass">Password</Label>
                    <div className="relative">
                      <Input id="si-pass" type={showPw ? "text" : "password"} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                      <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground" aria-label={showPw ? "Hide password" : "Show password"}>
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" disabled={busy} className="w-full">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                  </Button>
                  <button
                    type="button"
                    onClick={sendReset}
                    disabled={resetSending}
                    className="block w-full text-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
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
                    <Input id="su-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-pass">Password</Label>
                    <div className="relative">
                      <Input id="su-pass" type={showPw ? "text" : "password"} required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                      <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground" aria-label={showPw ? "Hide password" : "Show password"}>
                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {/* strength meter */}
                    {password.length > 0 && (
                      <>
                        <div className="mt-1.5 flex h-1 gap-1">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className={`flex-1 rounded ${i <= strength.score ? strength.tone : "bg-border"}`} />
                          ))}
                        </div>
                        <div className="text-[11px] text-muted-foreground">Strength: <span className="font-medium text-foreground">{strength.label}</span></div>
                      </>
                    )}
                    {/* checklist */}
                    <ul className="space-y-0.5 pt-1 text-[11px]">
                      <ReqRow ok={pwChecks.len} label="At least 8 characters" />
                      <ReqRow ok={pwChecks.upper} label="One uppercase letter" />
                      <ReqRow ok={pwChecks.lower} label="One lowercase letter" />
                      <ReqRow ok={pwChecks.num} label="One number" />
                    </ul>
                  </div>
                  <Button type="submit" disabled={busy || !pwOk} className="w-full">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our terms. Data is stored in your private workspace.
        </p>
      </div>
    </div>
  );
}

function ReqRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-1.5 ${ok ? "text-green-500" : "text-muted-foreground"}`}>
      {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      <span>{label}</span>
    </li>
  );
}
