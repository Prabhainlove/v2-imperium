import { useState, useEffect, type FormEvent } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@backend/database/SupabaseClient";
import { AuthShell } from "./components/AuthShell";
import { PillInput } from "./components/PillInput";

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"request" | "set">("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Detect Supabase recovery callback (#access_token=...&type=recovery).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash.includes("type=recovery")) setMode("set");
  }, []);

  async function onRequest(e: FormEvent) {
    e.preventDefault();
    setError(null); setInfo(null);
    if (!email.trim()) return setError("Enter your email.");
    setSubmitting(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (err) throw err;
      setInfo("Reset link sent. Check your inbox.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email.");
    } finally { setSubmitting(false); }
  }

  async function onSet(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords do not match.");
    setSubmitting(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      navigate({ to: "/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password.");
    } finally { setSubmitting(false); }
  }

  return (
    <AuthShell
      mode="signin"
      heading={mode === "set" ? "Set New Password" : "Reset Password"}
      intro={<>recovers your access. Set a fresh password and continue forging your career.</>}
    >
      {mode === "request" ? (
        <form className="auth-form" onSubmit={onRequest} noValidate>
          <PillInput type="email" placeholder="enter@your.email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="auth-meta"><span>RESET / 01</span><Link to="/auth">Back to sign in</Link></div>
          <button type="submit" className="auth-submit" disabled={submitting}>{submitting ? "Sending…" : "Send Reset Link →"}</button>
          {info ? <div className="auth-form-error" style={{ color: "var(--mint)" }}>{info}</div> : null}
          {error ? <div className="auth-form-error">{error}</div> : null}
        </form>
      ) : (
        <form className="auth-form" onSubmit={onSet} noValidate>
          <PillInput isPassword placeholder="new password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <PillInput isPassword placeholder="confirm password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <div className="auth-meta"><span>RESET / 02</span><Link to="/auth">Cancel</Link></div>
          <button type="submit" className="auth-submit" disabled={submitting}>{submitting ? "Updating…" : "Update Password →"}</button>
          {error ? <div className="auth-form-error">{error}</div> : null}
        </form>
      )}
    </AuthShell>
  );
}

export default ResetPasswordPage;
