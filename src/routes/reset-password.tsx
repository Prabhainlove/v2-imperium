import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";


export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password — Imperium" },
      { name: "description", content: "Set a new Imperium password." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);

  // Wait for Supabase to process the `#access_token=...&type=recovery` hash.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // If user landed without a recovery hash, still let them try (will fail gracefully).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) return toast.error("Password must be at least 8 characters");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <div className="app-surface-studio flex min-h-screen items-center justify-center px-4 py-12">
      <div className="relative z-10 w-full max-w-md">
        <Link to="/" className="mb-10 flex items-center justify-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "#FF5A3A" }}>
            <span className="text-base font-bold text-black">I</span>
          </div>
          <div className="text-center">
            <div className="text-[13px] font-semibold tracking-[0.18em] text-white">IMPERIUM</div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-white/40">Reset password</div>
          </div>
        </Link>
        <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-sm">
          <h1 className="studio-display text-3xl text-white">Set a new password.</h1>
          <p className="mt-2 text-sm text-white/55">
            {ready ? "Choose a strong password (min. 8 characters)." : "Verifying recovery link…"}
          </p>
          <form onSubmit={submit} className="mt-6 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="np" className="text-[11px] uppercase tracking-[0.18em] text-white/55">New password</Label>
              <Input
                id="np" type="password" minLength={8} required
                value={pwd} onChange={(e) => setPwd(e.target.value)}
                className="h-11 rounded-full border-white/12 bg-white/[0.03] px-4 text-white placeholder:text-white/30"
              />
            </div>
            <Button type="submit" disabled={busy || !ready}
              className="h-11 w-full rounded-full text-[14px] font-medium"
              style={{ background: "#FF5A3A", color: "#0A0A0A" }}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-white/50">
            <Link to="/auth" className="underline">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

