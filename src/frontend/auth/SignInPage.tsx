import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { supabase } from "@backend/database/SupabaseClient";
import { AuthShell } from "./components/AuthShell";
import { PillInput } from "./components/PillInput";
import { signInSchema } from "./validation";

export function SignInPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = signInSchema.safeParse(values);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[i.path[0] as string] = i.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (error) throw error;
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign in failed";
      setFormError(msg.includes("Invalid login") ? "Incorrect email or password." : msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      mode="signin"
      heading="Welcome Back"
      intro={
        <>
          is the AI job agent. Discover, analyze, optimize, apply and track —
          orchestrated end-to-end. Sign in to continue your craft.
        </>
      }
    >
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <PillInput
          type="email"
          placeholder="enter@your.email"
          autoComplete="email"
          value={values.email}
          onChange={set("email")}
          error={errors.email}
        />
        <PillInput
          isPassword
          placeholder="password"
          autoComplete="current-password"
          value={values.password}
          onChange={set("password")}
          error={errors.password}
        />
        <div className="auth-meta">
          <span>SIGN IN / 01</span>
          <Link to="/reset-password">Forgot password?</Link>
        </div>
        <button type="submit" className="auth-submit" disabled={submitting}>
          {submitting ? "Entering…" : "Enter Imperium →"}
        </button>
        {formError ? <div className="auth-form-error">{formError}</div> : null}
      </form>
    </AuthShell>
  );
}

export default SignInPage;
