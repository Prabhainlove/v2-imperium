import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ensureDemoUser } from "./mockAuth";
import { AuthShell } from "./components/AuthShell";
import { PillInput } from "./components/PillInput";
import { signInSchema } from "./validation";
import { signIn } from "./mockAuth";

export function SignInPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void ensureDemoUser();
  }, []);

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
      await signIn(parsed.data);
      navigate({ to: "/" });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Sign in failed");
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
          <a href="#" onClick={(e) => e.preventDefault()}>Forgot password?</a>
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
