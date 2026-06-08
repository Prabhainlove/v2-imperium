import "./auth.css";
import { useAuthPage } from "./auth.logic";

export function AuthPage() {
  const { title } = useAuthPage();
  return (
    <div className="auth-root min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <h1 className="auth-title text-3xl font-semibold">{title}</h1>
      <p className="auth-subtitle mt-3 text-sm text-muted-foreground">
        This page is part of the new architecture skeleton. UI coming soon.
      </p>
    </div>
  );
}

export default AuthPage;
