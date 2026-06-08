import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
    toast.success("Reset email sent");
  };

  return (
    <div className="app-surface-studio relative grid min-h-screen grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
      {/* Top chrome */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-8 py-6">
        <Link to="/" className="pointer-events-auto flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "#FF5A3A" }}>
            <span className="text-base font-bold text-black">I</span>
          </div>
          <div>
            <div className="text-[13px] font-semibold tracking-[0.18em]">IMPERIUM</div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-white/40">AI Job Agent · v_1.2.0</div>
          </div>
        </Link>
        <nav className="pointer-events-auto hidden items-center gap-2 md:flex">
          <span className="studio-pill is-active">Sign in</span>
          <Link to="/" className="studio-pill">Back to site →</Link>
        </nav>
      </header>

      {/* LEFT: editorial copy */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-white/5 px-12 pb-12 pt-32 lg:flex">
        {/* faint grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
        />
        <div className="relative">
          <div className="meta-ticks mb-6">V_ 1.2.0 / EARLY ACCESS</div>
          <h1 className="studio-display text-[clamp(56px,7vw,112px)]">
            Unsheathe<br />your career.
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-white/55">
            Imperium discovers roles, tailors resumes, fires applications and tracks every interview — automatically. A studio for your career.
          </p>
        </div>

        <div className="relative grid grid-cols-3 gap-4 text-[11px] uppercase tracking-[0.22em] text-white/40">
          <div>01. Discover</div><div>02. Tailor</div><div>03. Apply</div>
          <div className="col-span-3 mt-6 h-px bg-white/10" />
          <div className="col-span-2">© Imperium 2026</div>
          <div className="text-right">SCROLL ↓</div>
        </div>
      </aside>

      {/* RIGHT: form */}
      <main className="relative flex items-center justify-center px-6 pb-12 pt-28 lg:px-16">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <div className="meta-ticks mb-3">00. ENTER</div>
            <h2 className="studio-display text-4xl">Welcome back.</h2>
            <p className="mt-2 text-sm text-white/55">Sign in to your Imperium workspace.</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-sm">
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2 rounded-full bg-white/[0.04] p-1">
                <TabsTrigger value="signin" className="rounded-full data-[state=active]:bg-white data-[state=active]:text-black">Sign in</TabsTrigger>
                <TabsTrigger value="signup" className="rounded-full data-[state=active]:bg-white data-[state=active]:text-black">Create</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-6 space-y-4">
                <form onSubmit={signIn} className="space-y-3">
                  <Field id="si-email" label="Email" type="email" value={email} setValue={setEmail} placeholder="you@example.com" />
                  <Field id="si-pass" label="Password" type="password" value={password} setValue={setPassword} />
                  <Button type="submit" disabled={busy} className="h-11 w-full rounded-full text-[14px] font-medium" style={{ background: "#FF5A3A", color: "#0A0A0A" }}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Sign in <ArrowRight className="ml-2 h-4 w-4" /></>)}
                  </Button>
                  <button type="button" onClick={sendReset} disabled={resetSending}
                    className="block w-full text-center text-xs text-white/50 hover:text-white">
                    {resetSending ? "Sending reset link…" : "Forgot password?"}
                  </button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-6 space-y-4">
                <form onSubmit={signUp} className="space-y-3">
                  <Field id="su-name" label="Full name" value={name} setValue={setName} placeholder="Ada Lovelace" />
                  <Field id="su-email" label="Email" type="email" value={email} setValue={setEmail} placeholder="you@example.com" />
                  <Field id="su-pass" label="Password" type="password" value={password} setValue={setPassword} />
                  <Button type="submit" disabled={busy} className="h-11 w-full rounded-full text-[14px] font-medium" style={{ background: "#FF5A3A", color: "#0A0A0A" }}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Create account <ArrowRight className="ml-2 h-4 w-4" /></>)}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] text-white/40">
              <div className="h-px flex-1 bg-white/10" /><span>or</span><div className="h-px flex-1 bg-white/10" />
            </div>

            <Button variant="outline" onClick={google} disabled={busy}
              className="h-11 w-full rounded-full border-white/15 bg-transparent text-white hover:bg-white/[0.04]">
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0012 23z" />
                <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 015.5 12c0-.73.13-1.43.34-2.1V7.06H2.18A10.99 10.99 0 001 12c0 1.78.43 3.46 1.18 4.94l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
              </svg>
              Continue with Google
            </Button>
          </div>

          <p className="mt-6 text-center text-xs text-white/40">
            By continuing you agree to Imperium's terms.
          </p>
        </div>
      </main>

      {/* bottom-left progress mark like Dev Studios */}
      <div className="meta-ticks absolute bottom-6 left-8 hidden lg:block">00% — READY</div>
      <div className="meta-ticks absolute bottom-6 right-8 hidden lg:block">© IMPERIUM</div>
    </div>
  );
}

function Field({ id, label, type = "text", value, setValue, placeholder }: { id: string; label: string; type?: string; value: string; setValue: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[11px] uppercase tracking-[0.18em] text-white/55">{label}</Label>
      <Input
        id={id} type={type} required
        value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder}
        className="h-11 rounded-full border-white/12 bg-white/[0.03] px-4 text-white placeholder:text-white/30 focus-visible:ring-1 focus-visible:ring-white/40"
      />
    </div>
  );
}
