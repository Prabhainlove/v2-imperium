import "./settings.css";
import { useSession, signOut } from "@frontend/auth/mockAuth";
import { useNavigate } from "@tanstack/react-router";

export function SettingsPage() {
  const session = useSession();
  const navigate = useNavigate();
  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth", replace: true });
  };
  return (
    <div className="settings-root min-h-screen p-8 max-w-2xl mx-auto">
      <h1 className="settings-title text-3xl font-semibold mb-6">Settings</h1>
      <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-medium">Account</h2>
        <div className="text-sm text-muted-foreground">
          <div><span className="font-medium text-foreground">Name:</span> {session?.fullName ?? "—"}</div>
          <div><span className="font-medium text-foreground">Email:</span> {session?.email ?? "—"}</div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-md bg-destructive text-destructive-foreground px-4 py-2 text-sm font-medium hover:opacity-90 transition"
        >
          Sign out
        </button>
      </section>
    </div>
  );
}

export default SettingsPage;
