import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
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
    <div className="page-font-auth imp-surface flex min-h-screen items-center justify-center px-4 py-12">
      <span aria-hidden className="imp-kanji imp-kanji-xl right-[-4vw] top-[8vh] !text-[rgba(255,107,61,0.07)]">鍵</span>
      <div className="relative z-10 w-full max-w-md">
        <Link to="/" className="mb-10 flex items-center justify-center gap-3">
          <span className="imp-mark-sm" aria-hidden />
          <div className="text-center">
            <div className="imp-display text-base text-[#d8e3f2]">IMPERIUM</div>
            <div className="imp-eyebrow">Saiki · 再起 · Reset</div>
          </div>
        </Link>
        <Card className="imp-panel p-6">
          <h1 className="imp-h text-2xl text-foreground">Forge a new key.</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ready
              ? "Choose a strong password (min. 8 characters)."
              : "Verifying recovery link…"}
          </p>
          <form onSubmit={submit} className="mt-6 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="np">New password</Label>
              <Input
                id="np"
                type="password"
                minLength={8}
                required
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={busy || !ready} className="w-full">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            <Link to="/auth" className="underline">Back to sign in</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
