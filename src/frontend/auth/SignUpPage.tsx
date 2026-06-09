import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AuthShell } from "./components/AuthShell";
import { PillInput } from "./components/PillInput";
import { signUpSchema } from "./validation";
import { signUp } from "./mockAuth";

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
      await signUp({
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        password: parsed.data.password,
      });
      navigate({ to: "/dashboard" });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Sign up failed");
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
