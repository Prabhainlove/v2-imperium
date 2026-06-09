import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@backend/database/SupabaseClient";
import { AuthShell } from "./components/AuthShell";
import { PillInput } from "./components/PillInput";
import { signUpSchema } from "./validation";

export function SignUpPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const parsed = signUpSchema.safeParse(values);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const i of parsed.error.issues) errs[i.path[0] as string] = i.message;
      setErrors(errs);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/dashboard` : undefined;
      const { error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: redirectTo,
          data: { full_name: parsed.data.fullName },
        },
      });
      if (error) throw error;
      // If email confirmation is OFF, the user is signed in; if ON, route to /auth to sign in after confirming.
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        // Seed profile name immediately (trigger creates the row; we update name).
        await supabase
          .from("profiles")
          .update({ name: parsed.data.fullName, email: parsed.data.email })
          .eq("id", data.session.user.id);
        navigate({ to: "/dashboard" });
      } else {
        setFormError("Check your email to confirm your account, then sign in.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign up failed";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      mode="signup"
      heading="Join Imperium"
      intro={
        <>
          is the AI job agent that orchestrates resumes, applications, and
          interviews end-to-end. Forge your account to begin.
        </>
      }
    >
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <PillInput
          type="text"
          placeholder="full name"
          autoComplete="name"
          value={values.fullName}
          onChange={set("fullName")}
          error={errors.fullName}
        />
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
          autoComplete="new-password"
          value={values.password}
          onChange={set("password")}
          error={errors.password}
        />
        <ul className="auth-rules" aria-label="Password requirements">
          <li className={values.password.length >= 8 ? "ok" : ""}>At least 8 characters</li>
          <li className={/[A-Z]/.test(values.password) ? "ok" : ""}>One uppercase letter</li>
          <li className={/[0-9]/.test(values.password) ? "ok" : ""}>One number</li>
        </ul>
        <PillInput
          isPassword
          placeholder="confirm password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={set("confirmPassword")}
          error={errors.confirmPassword}
        />
        <div className="auth-meta">
          <span>SIGN UP / 02</span>
          <span>BY CONTINUING YOU ACCEPT THE CODE</span>
        </div>
        <button type="submit" className="auth-submit" disabled={submitting}>
          {submitting ? "Forging…" : "Forge Account →"}
        </button>
        {formError ? <div className="auth-form-error">{formError}</div> : null}
      </form>
    </AuthShell>
  );
}

export default SignUpPage;
